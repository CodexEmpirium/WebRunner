param(
  [Parameter(Mandatory = $true)] [string] $InputPath,
  [Parameter(Mandatory = $true)] [string] $OutputPath,
  [Parameter(Mandatory = $true)] [int] $Columns,
  [Parameter(Mandatory = $true)] [int] $Rows,
  [string] $MirrorRows = "",
  [string] $UpperBodyDonorRows = ""
)

Add-Type -AssemblyName System.Drawing

if (-not ('SpriteAtlasCleaner' -as [type])) {
  Add-Type -ReferencedAssemblies @('System.Drawing') -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;

public static class SpriteAtlasCleaner
{
    private sealed class Component
    {
        public readonly List<int> Pixels = new List<int>();
        public int MinX = int.MaxValue;
        public int MinY = int.MaxValue;
        public int MaxX;
        public int MaxY;
        public double CenterX;
    }

    public static void Clean(string inputPath, string outputPath, int columns, int rows)
    {
        using (var source = new Bitmap(inputPath))
        using (var normalized = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        {
            using (var graphics = Graphics.FromImage(normalized)) graphics.DrawImageUnscaled(source, 0, 0);
            var sourceBounds = new Rectangle(0, 0, normalized.Width, normalized.Height);
            var sourceData = normalized.LockBits(sourceBounds, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            var sourcePixels = new int[normalized.Width * normalized.Height];
            Marshal.Copy(sourceData.Scan0, sourcePixels, 0, sourcePixels.Length);
            normalized.UnlockBits(sourceData);

            var sourceCellWidth = (int)Math.Ceiling(normalized.Width / (double)columns);
            var sourceCellHeight = (int)Math.Ceiling(normalized.Height / (double)rows);
            var outputCellWidth = (int)Math.Ceiling(sourceCellWidth * 1.28);
            var outputCellHeight = (int)Math.Ceiling(sourceCellHeight * 1.22);
            var outputWidth = outputCellWidth * columns;
            var outputHeight = outputCellHeight * rows;
            var outputPixels = new int[outputWidth * outputHeight];

            for (var row = 0; row < rows; row++)
            {
                var y0 = (int)Math.Round(row * normalized.Height / (double)rows);
                var y1 = (int)Math.Round((row + 1) * normalized.Height / (double)rows);
                var frames = FindFrames(sourcePixels, normalized.Width, y0, y1, columns);
                for (var column = 0; column < frames.Count; column++)
                    PlaceFrame(sourcePixels, outputPixels, normalized.Width, outputWidth, frames[column],
                        column * outputCellWidth, row * outputCellHeight, outputCellWidth, outputCellHeight);
            }

            using (var output = new Bitmap(outputWidth, outputHeight, PixelFormat.Format32bppArgb))
            {
                var outputBounds = new Rectangle(0, 0, outputWidth, outputHeight);
                var outputData = output.LockBits(outputBounds, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
                Marshal.Copy(outputPixels, 0, outputData.Scan0, outputPixels.Length);
                output.UnlockBits(outputData);
                output.Save(outputPath, ImageFormat.Png);
            }
        }
    }

    public static void MirrorRow(string path, int columns, int rows, int targetRow, int sourceRow)
    {
        var temporaryPath = path + ".mirror.tmp.png";
        using (var original = new Bitmap(path))
        using (var output = new Bitmap(original))
        using (var graphics = Graphics.FromImage(output))
        {
            var cellWidth = original.Width / columns;
            var cellHeight = original.Height / rows;
            graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceCopy;
            for (var column = 0; column < columns; column++)
            {
                using (var cell = original.Clone(new Rectangle(column * cellWidth, sourceRow * cellHeight, cellWidth, cellHeight), PixelFormat.Format32bppArgb))
                {
                    cell.RotateFlip(RotateFlipType.RotateNoneFlipX);
                    graphics.DrawImageUnscaled(cell, column * cellWidth, targetRow * cellHeight);
                }
            }
            output.Save(temporaryPath, ImageFormat.Png);
        }
        File.Copy(temporaryPath, path, true);
        File.Delete(temporaryPath);
    }

    public static void RepairUpperBody(string path, int columns, int rows, int targetRow, int donorRow)
    {
        var temporaryPath = path + ".repair.tmp.png";
        using (var original = new Bitmap(path))
        using (var output = new Bitmap(original))
        using (var graphics = Graphics.FromImage(output))
        {
            var cellWidth = original.Width / columns;
            var cellHeight = original.Height / rows;
            var sourceX = (int)Math.Round(cellWidth * 0.385);
            var sourceY = (int)Math.Round(cellHeight * 0.185);
            var patchWidth = (int)Math.Round(cellWidth * 0.227);
            var patchHeight = (int)Math.Round(cellHeight * 0.284);
            var destinationX = (int)Math.Round(cellWidth * 0.398);
            var destinationY = (int)Math.Round(cellHeight * 0.139);
            graphics.CompositingMode = System.Drawing.Drawing2D.CompositingMode.SourceOver;
            for (var column = 0; column < columns; column++)
            {
                var source = new Rectangle(column * cellWidth + sourceX, donorRow * cellHeight + sourceY, patchWidth, patchHeight);
                var destination = new Rectangle(column * cellWidth + destinationX, targetRow * cellHeight + destinationY, patchWidth, patchHeight);
                graphics.DrawImage(original, destination, source, GraphicsUnit.Pixel);
            }
            output.Save(temporaryPath, ImageFormat.Png);
        }
        File.Copy(temporaryPath, path, true);
        File.Delete(temporaryPath);
    }

    private static List<Component> FindFrames(int[] source, int imageWidth, int y0, int y1, int count)
    {
        var height = y1 - y0;
        var visited = new bool[imageWidth * height];
        var components = new List<Component>();
        for (var localY = 0; localY < height; localY++)
        {
            for (var x = 0; x < imageWidth; x++)
            {
                var start = localY * imageWidth + x;
                if (visited[start] || Alpha(source[(y0 + localY) * imageWidth + x]) < 14) continue;
                var component = new Component();
                var queue = new Queue<int>();
                visited[start] = true;
                queue.Enqueue(start);
                while (queue.Count > 0)
                {
                    var current = queue.Dequeue();
                    var cx = current % imageWidth;
                    var cy = current / imageWidth;
                    var globalY = y0 + cy;
                    component.Pixels.Add(globalY * imageWidth + cx);
                    component.MinX = Math.Min(component.MinX, cx);
                    component.MinY = Math.Min(component.MinY, globalY);
                    component.MaxX = Math.Max(component.MaxX, cx);
                    component.MaxY = Math.Max(component.MaxY, globalY);
                    Visit(cx - 1, cy, imageWidth, height, y0, source, visited, queue);
                    Visit(cx + 1, cy, imageWidth, height, y0, source, visited, queue);
                    Visit(cx, cy - 1, imageWidth, height, y0, source, visited, queue);
                    Visit(cx, cy + 1, imageWidth, height, y0, source, visited, queue);
                }
                if (component.Pixels.Count > 40)
                {
                    component.CenterX = component.Pixels.Average(pixel => pixel % imageWidth);
                    components.Add(component);
                }
            }
        }

        return components.OrderByDescending(component => component.Pixels.Count)
            .Take(count).OrderBy(component => component.CenterX).ToList();
    }

    private static void PlaceFrame(int[] source, int[] output, int imageWidth, int outputWidth,
        Component frame, int outputX0, int outputY0, int outputCellWidth, int outputCellHeight)
    {
        var lowerBodyStart = frame.MinY + (frame.MaxY - frame.MinY) * 0.58;
        double weightedX = 0;
        double totalAlpha = 0;
        foreach (var pixel in frame.Pixels)
        {
            var x = pixel % imageWidth;
            var y = pixel / imageWidth;
            if (y < lowerBodyStart) continue;
            var alpha = Alpha(source[pixel]);
            weightedX += (x - frame.MinX) * alpha;
            totalAlpha += alpha;
        }
        var contactX = totalAlpha > 0 ? weightedX / totalAlpha : (frame.MaxX - frame.MinX) / 2.0;
        var offsetX = (int)Math.Round((outputCellWidth - 1) / 2.0 - contactX);
        var offsetY = outputCellHeight - 9 - (frame.MaxY - frame.MinY);
        var keep = new HashSet<int>();
        foreach (var pixel in frame.Pixels)
        {
            var px = pixel % imageWidth;
            var py = pixel / imageWidth;
            for (var dy = -2; dy <= 2; dy++)
                for (var dx = -2; dx <= 2; dx++)
                    if (px + dx >= 0 && px + dx < imageWidth && py + dy >= 0 && py + dy < source.Length / imageWidth)
                        keep.Add((py + dy) * imageWidth + px + dx);
        }

        foreach (var pixel in keep)
        {
            var x = pixel % imageWidth;
            var y = pixel / imageWidth;
            var destinationX = x - frame.MinX + offsetX;
            var destinationY = y - frame.MinY + offsetY;
            if (destinationX < 0 || destinationX >= outputCellWidth || destinationY < 0 || destinationY >= outputCellHeight) continue;
            output[(outputY0 + destinationY) * outputWidth + outputX0 + destinationX] = source[pixel];
        }
    }

    private static void Visit(int x, int y, int width, int height, int y0, int[] source, bool[] visited, Queue<int> queue)
    {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        var index = y * width + x;
        if (visited[index]) return;
        visited[index] = true;
        if (Alpha(source[(y0 + y) * width + x]) >= 14) queue.Enqueue(index);
    }

    private static int Alpha(int color) { return (int)((uint)color >> 24); }
}
'@
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
[SpriteAtlasCleaner]::Clean($resolvedInput, $resolvedOutput, $Columns, $Rows)
if ($UpperBodyDonorRows) {
  foreach ($pair in $UpperBodyDonorRows.Split(',')) {
    $parts = $pair.Split(':')
    if ($parts.Length -ne 2) { throw "UpperBodyDonorRows entries must use target:donor format." }
    [SpriteAtlasCleaner]::RepairUpperBody($resolvedOutput, $Columns, $Rows, [int]$parts[0], [int]$parts[1])
  }
}
if ($MirrorRows) {
  foreach ($pair in $MirrorRows.Split(',')) {
    $parts = $pair.Split(':')
    if ($parts.Length -ne 2) { throw "MirrorRows entries must use target:source format." }
    [SpriteAtlasCleaner]::MirrorRow($resolvedOutput, $Columns, $Rows, [int]$parts[0], [int]$parts[1])
  }
}
