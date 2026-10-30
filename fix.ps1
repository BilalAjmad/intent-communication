$path = 'H:\folderrr\docs\pr.md'
$lines = Get-Content $path
$out = @()
foreach($l in $lines) {
    if($l -match '^## 14\. Change Log') { break }
    $out += $l
}
Set-Content -Path $path -Value ($out -join "`n") -Encoding UTF8