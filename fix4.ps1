$path = 'H:\folderrr\docs\pr.md'
$lines = Get-Content $path
$out = @()
for($i=0; $i -lt 144 -and $i -lt $lines.Count; $i++) {
    $out += $lines[$i]
}
Set-Content -Path $path -Value ($out -join "`n") -Encoding UTF8