# Stitches rendered viewer-capture pages (gray background, white slide cards) and crops each slide card.
param([string]$InDir, [string]$OutDir)
Add-Type -AssemblyName System.Drawing
$pages = Get-ChildItem $InDir -Filter *.png | Sort-Object Name
$strips = @()
foreach ($p in $pages) {
  $b = New-Object System.Drawing.Bitmap $p.FullName
  $gx = [int]($b.Width * 0.05)
  $rows = @(); for ($y = 0; $y -lt $b.Height; $y++) { $c = $b.GetPixel($gx, $y); if ($c.R -lt 245 -and $c.R -gt 200) { $rows += $y } }
  # skip the toolbar on page 1 (dark) - toolbar is dark so not in rows
  $strips += [pscustomobject]@{ bmp = $b; y0 = $rows[0]; y1 = $rows[-1] }
}
$W = $strips[0].bmp.Width
$H = ($strips | % { $_.y1 - $_.y0 + 1 } | Measure-Object -Sum).Sum
$tall = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($tall)
$yy = 0
foreach ($s in $strips) { $sh = $s.y1 - $s.y0 + 1; $g.DrawImage($s.bmp, (New-Object System.Drawing.Rectangle 0, $yy, $W, $sh), (New-Object System.Drawing.Rectangle 0, $s.y0, $W, $sh), [System.Drawing.GraphicsUnit]::Pixel); $yy += $sh }
$g.Dispose()
# find slide x-extent on a middle row: white run around center
$sx = [int]($W * 0.315)
# white runs in column sx
$runs = @(); $inW = $false; $start = 0
for ($y = 0; $y -lt $H; $y++) { $c = $tall.GetPixel($sx, $y); $isW = ($c.R -ge 250 -and $c.G -ge 250 -and $c.B -ge 250)
  if ($isW -and -not $inW) { $start = $y; $inW = $true } elseif (-not $isW -and $inW) { if ($y - $start -gt 200) { $runs += ,@($start, $y) }; $inW = $false } }
if ($inW -and ($H - $start) -gt 200) { $runs += ,@($start, $H) }
# horizontal extent from first run's middle row
$my = $runs[0][0] + 8
$x0 = $sx; while ($x0 -gt 0) { $c = $tall.GetPixel($x0 - 1, $my); if ($c.R -lt 250) { break }; $x0-- }
$x1 = $sx; while ($x1 -lt $W - 1) { $c = $tall.GetPixel($x1 + 1, $my); if ($c.R -lt 250 -and $c.G -lt 250) { break }; $x1++ }
New-Item -ItemType Directory -Force $OutDir | Out-Null
Get-ChildItem $OutDir -Filter *.jpg | Remove-Item
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | ? { $_.MimeType -eq 'image/jpeg' }
$ep = New-Object System.Drawing.Imaging.EncoderParameters 1
$ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88L
$i = 0
foreach ($r in $runs) { $i++; $rect = New-Object System.Drawing.Rectangle $x0, $r[0], ($x1 - $x0 + 1), ($r[1] - $r[0]); $crop = $tall.Clone($rect, $tall.PixelFormat); $crop.Save((Join-Path $OutDir ("{0:D2}.jpg" -f $i)), $enc, $ep); $crop.Dispose() }
"slides: $i  x0=$x0 x1=$x1 H=$H"
foreach ($s in $strips) { $s.bmp.Dispose() }
