param(
  [Parameter(Mandatory = $true)] [string] $InputPath,
  [Parameter(Mandatory = $true)] [string] $OutputPath
)

Add-Type -AssemblyName System.Drawing

if (-not ('SlimeAtlasBuilder' -as [type])) {
  Add-Type -ReferencedAssemblies @('System.Drawing') -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class SlimeAtlasBuilder
{
    private const int CellSize = 128;
    private static readonly int[] RowTop = { 118, 220, 315, 425, 540, 660, 800, 900 };
    private static readonly int[] RowBottom = { 198, 305, 432, 558, 675, 795, 905, 998 };
    private static readonly int[] DirectionMap = { 0, 7, 6, 5, 4, 3, 2, 1 };

    private sealed class BackgroundSample
    {
        public Color TopLeft;
        public Color TopRight;
        public Color BottomLeft;
        public Color BottomRight;
    }

    public static void Build(string inputPath, string outputPath)
    {
        using (var source = new Bitmap(inputPath))
        using (var atlas = new Bitmap(CellSize * 8, CellSize * 8, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(atlas))
        {
            graphics.Clear(Color.Transparent);
            graphics.CompositingMode = CompositingMode.SourceCopy;
            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
            for (var direction = 0; direction < 8; direction++)
            {
                for (var action = 0; action < 8; action++)
                {
                    using (var frame = Extract(source, DirectionMap[direction], action))
                        DrawAnchored(graphics, frame, action * CellSize, direction * CellSize);
                }
            }
            atlas.Save(outputPath, ImageFormat.Png);
        }
    }

    private static Bitmap Extract(Bitmap source, int sourceColumn, int sourceRow)
    {
        var centerX = 204 + sourceColumn * 120;
        var cropX0 = Math.Max(0, centerX - 68);
        var cropX1 = Math.Min(1110, centerX + 68);
        var cropY0 = RowTop[sourceRow];
        var cropY1 = RowBottom[sourceRow];
        var width = cropX1 - cropX0;
        var height = cropY1 - cropY0;
        var background = SampleBackground(source, cropX0, cropY0, cropX1, cropY1);
        var foreground = new bool[width * height];
        var visited = new bool[foreground.Length];
        List<int> largest = null;

        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var color = source.GetPixel(cropX0 + x, cropY0 + y);
                foreground[y * width + x] = Distance(color, Expected(background, x, y, width, height)) > 34;
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
                    for (var dy = -1; dy <= 1; dy++)
                        for (var dx = -1; dx <= 1; dx++)
                            Visit(cx + dx, cy + dy, width, height, foreground, visited, queue);
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
        minX = Math.Max(0, minX - 2);
        minY = Math.Max(0, minY - 2);
        maxX = Math.Min(width - 1, maxX + 2);
        maxY = Math.Min(height - 1, maxY + 2);

        var keep = new bool[width * height];
        foreach (var pixel in largest)
        {
            var px = pixel % width;
            var py = pixel / width;
            for (var dy = -1; dy <= 1; dy++)
                for (var dx = -1; dx <= 1; dx++)
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
                var difference = Distance(color, Expected(background, x, y, width, height));
                if (difference <= 16) continue;
                var alpha = foreground[y * width + x] ? 255 : Math.Min(255, (difference - 16) * 16);
                result.SetPixel(x - minX, y - minY, Color.FromArgb(alpha, color.R, color.G, color.B));
            }
        }
        return result;
    }

    private static BackgroundSample SampleBackground(Bitmap source, int x0, int y0, int x1, int y1)
    {
        return new BackgroundSample {
            TopLeft = AveragePatch(source, x0 + 2, y0 + 2),
            TopRight = AveragePatch(source, x1 - 7, y0 + 2),
            BottomLeft = AveragePatch(source, x0 + 2, y1 - 7),
            BottomRight = AveragePatch(source, x1 - 7, y1 - 7)
        };
    }

    private static Color AveragePatch(Bitmap source, int x0, int y0)
    {
        var red = 0;
        var green = 0;
        var blue = 0;
        for (var y = 0; y < 5; y++)
            for (var x = 0; x < 5; x++)
            {
                var color = source.GetPixel(x0 + x, y0 + y);
                red += color.R;
                green += color.G;
                blue += color.B;
            }
        return Color.FromArgb(red / 25, green / 25, blue / 25);
    }

    private static Color Expected(BackgroundSample sample, int x, int y, int width, int height)
    {
        var tx = x / (double)Math.Max(1, width - 1);
        var ty = y / (double)Math.Max(1, height - 1);
        var topR = sample.TopLeft.R + (sample.TopRight.R - sample.TopLeft.R) * tx;
        var topG = sample.TopLeft.G + (sample.TopRight.G - sample.TopLeft.G) * tx;
        var topB = sample.TopLeft.B + (sample.TopRight.B - sample.TopLeft.B) * tx;
        var bottomR = sample.BottomLeft.R + (sample.BottomRight.R - sample.BottomLeft.R) * tx;
        var bottomG = sample.BottomLeft.G + (sample.BottomRight.G - sample.BottomLeft.G) * tx;
        var bottomB = sample.BottomLeft.B + (sample.BottomRight.B - sample.BottomLeft.B) * tx;
        return Color.FromArgb(
            (int)Math.Round(topR + (bottomR - topR) * ty),
            (int)Math.Round(topG + (bottomG - topG) * ty),
            (int)Math.Round(topB + (bottomB - topB) * ty));
    }

    private static int Distance(Color color, Color background)
    {
        var dr = color.R - background.R;
        var dg = color.G - background.G;
        var db = color.B - background.B;
        return (int)Math.Sqrt(dr * dr + dg * dg + db * db);
    }

    private static void DrawAnchored(Graphics graphics, Bitmap frame, int cellX, int cellY)
    {
        var scale = Math.Min(1.0, Math.Min(118.0 / frame.Width, 116.0 / frame.Height));
        var width = Math.Max(1, (int)Math.Round(frame.Width * scale));
        var height = Math.Max(1, (int)Math.Round(frame.Height * scale));
        var x = cellX + (CellSize - width) / 2;
        var y = cellY + CellSize - 7 - height;
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
[SlimeAtlasBuilder]::Build($resolvedInput, $resolvedOutput)
