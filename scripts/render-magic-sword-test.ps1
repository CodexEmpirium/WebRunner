param(
  [string]$OutputPath = "tmp/magic-sword-overlay-test.png"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$source = Get-Content -Raw -LiteralPath (Join-Path $root "src/main.js")
$states = [System.Collections.Generic.List[object]]::new()
$states.Add(@{ Name = "STANDING"; Mode = "idle"; File = "rogue-action-v2-clean.png"; Columns = 4; Frame = 0 })
0..7 | ForEach-Object { $states.Add(@{ Name = "WALK F$_"; Mode = "walk"; File = "rogue-run-v3-clean.png"; Columns = 8; Frame = $_ }) }
0..5 | ForEach-Object { $states.Add(@{ Name = "CROUCH F$_"; Mode = "crouch"; File = "rogue-crouch-v1-clean.png"; Columns = 6; Frame = $_ }) }
$directions = @("S", "SW", "W", "NW", "N", "NE", "E", "SE")

function Read-BladeMap([string]$mode) {
  $nextMode = switch ($mode) {
    "idle" { "walk" }
    "walk" { "crouch" }
    "crouch" { "strike" }
  }
  $block = [regex]::Match(
    $source,
    "(?s)\b$mode\s*:\s*\[(?<body>.*?)\]\s*,\s*$nextMode\s*:",
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )
  if (-not $block.Success) { throw "Unable to read the $mode Magic Sword map." }
  $pairs = [regex]::Matches(
    $block.Groups["body"].Value,
    "\[\[([0-9.]+),\s*([0-9.]+)\],\s*\[([0-9.]+),\s*([0-9.]+)\]\]"
  )
  if ($pairs.Count -ne 8) { throw "Expected 8 $mode directions; found $($pairs.Count)." }
  return @($pairs | ForEach-Object {
    [pscustomobject]@{
      BaseX = [double]$_.Groups[1].Value
      BaseY = [double]$_.Groups[2].Value
      TipX = [double]$_.Groups[3].Value
      TipY = [double]$_.Groups[4].Value
    }
  })
}

function Test-BladeHidden([string]$mode, [int]$row, [int]$frame) {
  if ($mode -ne "crouch") { return $false }
  $hidden = [regex]::Match($source, "(?s)magicSwordHiddenFrames\s*=.*?crouch\s*:\s*\{.*?\b$row\s*:\s*new Set\(\[(?<frames>.*?)\]\)")
  if (-not $hidden.Success) { return $false }
  $frames = @([regex]::Matches($hidden.Groups["frames"].Value, "\d+") | ForEach-Object { [int]$_.Value })
  return $frames -contains $frame
}

$cellWidth = 230
$cellHeight = 205
$labelHeight = 26
$canvas = [System.Drawing.Bitmap]::new($cellWidth * 8, ($cellHeight + $labelHeight) * $states.Count)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.Clear([System.Drawing.Color]::FromArgb(255, 19, 17, 15))
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$font = [System.Drawing.Font]::new("Consolas", 11, [System.Drawing.FontStyle]::Bold)
$labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 232, 220, 192))
$outerPen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(90, 48, 205, 255), 14)
$corePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(235, 190, 242, 255), 4)
$outerPen.StartCap = $outerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$corePen.StartCap = $corePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

try {
  for ($stateIndex = 0; $stateIndex -lt $states.Count; $stateIndex++) {
    $state = $states[$stateIndex]
    $map = Read-BladeMap $state.Mode
    $imagePath = Join-Path $root "assets/art/$($state.File)"
    $sheet = [System.Drawing.Bitmap]::FromFile($imagePath)
    try {
      $sourceCellWidth = [int]($sheet.Width / $state.Columns)
      $sourceCellHeight = [int]($sheet.Height / 8)
      for ($row = 0; $row -lt 8; $row++) {
        $destinationX = $row * $cellWidth
        $destinationY = $stateIndex * ($cellHeight + $labelHeight) + $labelHeight
        $sourceRect = [System.Drawing.Rectangle]::new($state.Frame * $sourceCellWidth, $row * $sourceCellHeight, $sourceCellWidth, $sourceCellHeight)
        $scale = [Math]::Min(($cellWidth - 8) / $sourceCellWidth, ($cellHeight - 8) / $sourceCellHeight)
        $drawWidth = $sourceCellWidth * $scale
        $drawHeight = $sourceCellHeight * $scale
        $drawX = $destinationX + ($cellWidth - $drawWidth) / 2
        $drawY = $destinationY + ($cellHeight - $drawHeight) / 2
        $destinationRect = [System.Drawing.RectangleF]::new($drawX, $drawY, $drawWidth, $drawHeight)
        $graphics.DrawImage($sheet, $destinationRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)

        $blade = $map[$row]
        $baseX = $drawX + $blade.BaseX * $drawWidth
        $baseY = $drawY + $blade.BaseY * $drawHeight
        $tipX = $drawX + $blade.TipX * $drawWidth
        $tipY = $drawY + $blade.TipY * $drawHeight
        if (-not (Test-BladeHidden $state.Mode $row $state.Frame)) {
          $graphics.DrawLine($outerPen, $baseX, $baseY, $tipX, $tipY)
          $graphics.DrawLine($corePen, $baseX, $baseY, $tipX, $tipY)
        }
        $graphics.DrawString("$($state.Name) $($directions[$row])", $font, $labelBrush, $destinationX + 8, $destinationY - $labelHeight + 4)
      }
    } finally {
      $sheet.Dispose()
    }
  }

  $resolvedOutput = Join-Path $root $OutputPath
  $outputDirectory = Split-Path -Parent $resolvedOutput
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
  $canvas.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Output $resolvedOutput
  Write-Output "Rendered $($states.Count * 8) Magic Sword alignment cases across 8 directions."
} finally {
  $outerPen.Dispose()
  $corePen.Dispose()
  $labelBrush.Dispose()
  $font.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
}
