# Builds a 3x3 contact sheet from a list of slide images (for quick visual review).
param([string[]]$Files, [string]$Out, [int]$CellW = 640)
Add-Type -AssemblyName System.Drawing
$cellH = [int]($CellW * 0.75); $cols = 3; $rowsN = [math]::Ceiling($Files.Count / $cols)
$bmp = New-Object System.Drawing.Bitmap ($CellW * $cols), ($cellH * $rowsN)
$g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::Gray)
$font = New-Object System.Drawing.Font "Arial", 16, ([System.Drawing.FontStyle]::Bold)
for ($i = 0; $i -lt $Files.Count; $i++) {
  $img = [System.Drawing.Image]::FromFile($Files[$i]); $x = ($i % $cols) * $CellW; $y = [math]::Floor($i / $cols) * $cellH
  $s = [math]::Min(($CellW - 6) / $img.Width, ($cellH - 6) / $img.Height)
  $g.DrawImage($img, $x + 3, $y + 3, [int]($img.Width * $s), [int]($img.Height * $s))
  $g.FillRectangle([System.Drawing.Brushes]::Red, $x + 3, $y + 3, 70, 26); $g.DrawString([IO.Path]::GetFileNameWithoutExtension($Files[$i]), $font, [System.Drawing.Brushes]::White, $x + 6, $y + 4)
  $img.Dispose()
}
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Jpeg); $g.Dispose(); $bmp.Dispose()
