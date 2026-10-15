# Exports each PPTX deck to JPG slide images + per-slide text (JSON) using PowerPoint COM.
param([string]$Root = "D:\Download3\Uni\301")
$decks = @{
  "1"  = "Chapter 1 Consumer Behavior and Technology.pptx"
  "2"  = "Chapter 2 Consumer Segmentation.pptx"
  "3"  = "Chapter 3 Consumer Motivation and Personality.pptx"
  "4"  = "Chapter 4 consumer perception positioning Fall 2026.pptx"
  "5"  = "CHapter 5 Consumer Learning.pptx"
  "14" = "Chapter 14 Consumer Decision-Making and Diffusion of Innovations.pptx"
}
$pp = New-Object -ComObject PowerPoint.Application
foreach ($ch in $decks.Keys) {
  $src = Join-Path $Root $decks[$ch]
  $out = Join-Path $Root "site\slides\ch$ch"
  New-Item -ItemType Directory -Force $out | Out-Null
  $pres = $pp.Presentations.Open($src, $true, $false, $false)
  $texts = @()
  $i = 0
  foreach ($s in $pres.Slides) {
    $i++
    $name = "{0:D2}.jpg" -f $i
    $s.Export((Join-Path $out $name), "JPG", 1280, 720)
    $t = @()
    foreach ($sh in $s.Shapes) {
      try { if ($sh.HasTextFrame -and $sh.TextFrame.HasText) { $t += $sh.TextFrame.TextRange.Text } } catch {}
      try { if ($sh.HasTable) { foreach ($r in $sh.Table.Rows) { foreach ($c in $r.Cells) { $t += $c.Shape.TextFrame.TextRange.Text } } } } catch {}
      try { if ($sh.Type -eq 6) { foreach ($g in $sh.GroupItems) { if ($g.HasTextFrame -and $g.TextFrame.HasText) { $t += $g.TextFrame.TextRange.Text } } } } catch {}
    }
    $texts += [pscustomobject]@{ n = $i; text = ($t -join "`n") }
  }
  $pres.Close()
  $texts | ConvertTo-Json -Depth 3 | Out-File -Encoding utf8 (Join-Path $Root ".tmp\ch$ch-slides.json")
  "ch$ch : $i slides"
}
$pp.Quit()
