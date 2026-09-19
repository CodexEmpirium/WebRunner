param(
  [Parameter(Mandatory = $true)] [string] $InputPath,
  [Parameter(Mandatory = $true)] [string] $OutputPath
)

Add-Type -AssemblyName System.Drawing

if (-not ('BombAtlasBuilder' -as [type])) {
  Add-Type -ReferencedAssemblies @('System.Drawing') -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class BombAtlasBuilder
{
    private const int CellSize = 288;
    private static readonly int[] GroupTop = { 88, 420, 755 };
    private static readonly int[] GroupBottom = { 320, 650, 990 };

    private struct FrameSpec
    {
        public int Group;
        public int Column;
        public bool Flip;
        public FrameSpec(int group, int column, bool flip)
        {
            Group = group;
            Column = column;
            Flip = flip;
        }
    }

    public static void Build(string inputPath, string outputPath)
    {
        // Runtime row order: S, SW, W, NW, N, NE, E, SE.
        var ready = new[] {
            new FrameSpec(0, 0, false), new FrameSpec(0, 7, false),
            new FrameSpec(0, 6, false), new FrameSpec(0, 5, false),
            new FrameSpec(0, 4, false), new FrameSpec(0, 5, true),
            new FrameSpec(0, 2, false), new FrameSpec(0, 1, false)
        };

        // The supplied SE pose in groups 1 and 2 actually faces NW. Reuse it for
        // NW and mirror it for NE. Poses with a duplicate bomb are replaced by
        // the matching sword-and-bomb frame from group 3.
        var throwing = new[] {
            new FrameSpec(1, 0, false), new FrameSpec(1, 1, true),
            new FrameSpec(2, 6, false), new FrameSpec(1, 3, false),
            new FrameSpec(2, 4, false), new FrameSpec(1, 3, true),
            new FrameSpec(2, 2, false), new FrameSpec(1, 1, false)
        };

        var armedStrike = new[] {
            new FrameSpec(2, 0, false), new FrameSpec(2, 7, false),
            new FrameSpec(2, 6, false), new FrameSpec(2, 5, false),
            new FrameSpec(2, 4, false), new FrameSpec(2, 3, false),
            new FrameSpec(2, 2, false), new FrameSpec(2, 1, false)
        };

        using (var source = new Bitmap(inputPath))
        using (var atlas = new Bitmap(CellSize * 3, CellSize * 8, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(atlas))
        {
            graphics.Clear(Color.Transparent);
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
            graphics.CompositingMode = CompositingMode.SourceCopy;

            var actions = new[] { ready, throwing, armedStrike };
            for (var row = 0; row < 8; row++)
            {
                for (var action = 0; action < actions.Length; action++)
                {
                    var spec = actions[action][row];
                    using (var frame = Extract(source, spec))
                        DrawAnchored(graphics, frame, action * CellSize, row * CellSize);
                }
            }
            atlas.Save(outputPath, ImageFormat.Png);
        }
    }

    private static Bitmap Extract(Bitmap source, FrameSpec spec)
    {
        var columnWidth = source.Width / 8.0;
        var centerX = (spec.Column + 0.5) * columnWidth;
        var cropX0 = Math.Max(0, (int)Math.Floor(centerX - 132));
        var cropX1 = Math.Min(source.Width, (int)Math.Ceiling(centerX + 132));
        var cropY0 = GroupTop[spec.Group];
        var cropY1 = GroupBottom[spec.Group];
        var width = cropX1 - cropX0;
        var height = cropY1 - cropY0;
        var foreground = new bool[width * height];
        var visited = new bool[foreground.Length];
        List<int> largest = null;

        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var index = y * width + x;
                var color = source.GetPixel(cropX0 + x, cropY0 + y);
                foreground[index] = Math.Max(color.R, Math.Max(color.G, color.B)) > 6;
            }
        }

        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var start = y * width + x;
                if (visited[start] || !foreground[start]) continue;
                var component = new List<int>();
                var queue = new Queue<int>();
                visited[start] = true;
                queue.Enqueue(start);
                while (queue.Count > 0)
                {
                    var current = queue.Dequeue();
                    component.Add(current);
                    var cx = current % width;
                    var cy = current / width;
                    Visit(cx - 1, cy, width, height, foreground, visited, queue);
                    Visit(cx + 1, cy, width, height, foreground, visited, queue);
                    Visit(cx, cy - 1, width, height, foreground, visited, queue);
                    Visit(cx, cy + 1, width, height, foreground, visited, queue);
                    Visit(cx - 1, cy - 1, width, height, foreground, visited, queue);
                    Visit(cx + 1, cy - 1, width, height, foreground, visited, queue);
                    Visit(cx - 1, cy + 1, width, height, foreground, visited, queue);
                    Visit(cx + 1, cy + 1, width, height, foreground, visited, queue);
                }
                if (largest == null || component.Count > largest.Count) largest = component;
            }
        }

        if (largest == null) return new Bitmap(1, 1, PixelFormat.Format32bppArgb);
        var minX = width;
        var minY = height;
        var maxX = 0;
        var maxY = 0;
        foreach (var pixel in largest)
        {
            var x = pixel % width;
            var y = pixel / width;
            minX = Math.Min(minX, x);
            minY = Math.Min(minY, y);
            maxX = Math.Max(maxX, x);
            maxY = Math.Max(maxY, y);
        }

        minX = Math.Max(0, minX - 3);
        minY = Math.Max(0, minY - 3);
        maxX = Math.Min(width - 1, maxX + 3);
        maxY = Math.Min(height - 1, maxY + 3);
        var keep = new bool[width * height];
        foreach (var pixel in largest)
        {
            var px = pixel % width;
            var py = pixel / width;
            for (var dy = -2; dy <= 2; dy++)
                for (var dx = -2; dx <= 2; dx++)
                    if (px + dx >= 0 && px + dx < width && py + dy >= 0 && py + dy < height)
                        keep[(py + dy) * width + px + dx] = true;
        }

        var result = new Bitmap(maxX - minX + 1, maxY - minY + 1, PixelFormat.Format32bppArgb);
        for (var y = minY; y <= maxY; y++)
        {
            for (var x = minX; x <= maxX; x++)
            {
                if (!keep[y * width + x]) continue;
                var color = source.GetPixel(cropX0 + x, cropY0 + y);
                var light = Math.Max(color.R, Math.Max(color.G, color.B));
                if (light <= 2) continue;
                var alpha = foreground[y * width + x] ? 255 : Math.Min(255, (light - 2) * 28);
                result.SetPixel(x - minX, y - minY, Color.FromArgb(alpha, color.R, color.G, color.B));
            }
        }
        if (spec.Flip) result.RotateFlip(RotateFlipType.RotateNoneFlipX);
        return result;
    }

    private static void DrawAnchored(Graphics graphics, Bitmap frame, int cellX, int cellY)
    {
        var scale = Math.Min(1.0, Math.Min((CellSize - 28.0) / frame.Width, (CellSize - 24.0) / frame.Height));
        var width = Math.Max(1, (int)Math.Round(frame.Width * scale));
        var height = Math.Max(1, (int)Math.Round(frame.Height * scale));
        var x = cellX + (CellSize - width) / 2;
        var y = cellY + CellSize - 10 - height;
        graphics.DrawImage(frame, new Rectangle(x, y, width, height), 0, 0, frame.Width, frame.Height, GraphicsUnit.Pixel);
    }

    private static void Visit(int x, int y, int width, int height, bool[] foreground, bool[] visited, Queue<int> queue)
    {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        var index = y * width + x;
        if (visited[index] || !foreground[index]) return;
        visited[index] = true;
        queue.Enqueue(index);
    }
}
'@
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
[BombAtlasBuilder]::Build($resolvedInput, $resolvedOutput)
