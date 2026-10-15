# Traces a pixel-art sprite from an image region into a character grid (R=red, S=skin, K=black, .=empty).
param([string]$Img, [int]$X0, [int]$Y0, [int]$X1, [int]$Y1, [double]$Cell)
Add-Type -AssemblyName System.Drawing
$b = New-Object System.Drawing.Bitmap $Img
function Cls($c) {
  if ($c.R -lt 70 -and $c.G -lt 70 -and $c.B -lt 70) { return 'K' }
  if ($c.R -gt 200 -and $c.G -lt 110 -and $c.B -lt 90) { return 'R' }
  if ($c.R -gt 220 -and $c.G -gt 180 -and $c.B -gt 140 -and $c.B -lt 215) { return 'S' }
  return '.'
}
# bounding box of sprite colors
$minx=9999;$miny=9999;$maxx=0;$maxy=0
for ($y=$Y0; $y -le $Y1; $y++) { for ($x=$X0; $x -le $X1; $x++) { if ((Cls $b.GetPixel($x,$y)) -ne '.') { if($x-lt$minx){$minx=$x};if($x-gt$maxx){$maxx=$x};if($y-lt$miny){$miny=$y};if($y-gt$maxy){$maxy=$y} } } }
"bbox $minx,$miny - $maxx,$maxy  w=$($maxx-$minx+1) h=$($maxy-$miny+1)"
$cols = [math]::Round(($maxx-$minx+1)/$Cell); $rows = [math]::Round(($maxy-$miny+1)/$Cell)
"grid $cols x $rows"
for ($r=0; $r -lt $rows; $r++) { $line=''; for ($c=0; $c -lt $cols; $c++) { $px=[int]($minx + ($c+0.5)*$Cell); $py=[int]($miny + ($r+0.5)*$Cell); $line += Cls $b.GetPixel([math]::Min($px,$b.Width-1),[math]::Min($py,$b.Height-1)) }; "'$line'," }
$b.Dispose()
