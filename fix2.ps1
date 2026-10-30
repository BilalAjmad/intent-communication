$path = 'H:\folderrr\docs\pr.md'
$lines = Get-Content $path
$out = @()
for($i=0; $i -lt $lines.Count; $i++) {
    $l = $lines[$i]
    if($l -match '^## 9\. Cross-Check Summary') { break }
    $out += $l
}
Set-Content -Path $path -Value ($out -join "`n") -Encoding UTF8