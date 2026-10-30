$path = 'H:\folderrr\docs\pr.md'
$lines = Get-Content $path
$out = @()
$inSection12 = $false
$pastSection12 = $false
$prTableStarted = $false
$prTableEnded = $false
$pastSection15 = $false

for($i=0; $i -lt $lines.Count; $i++) {
    $l = $lines[$i]
    
    # Detect section 12 start
    if($l -match '^## 12\. Conflicts') {
        $inSection12 = $true
    }
    
    # Detect section 13 start
    if($l -match '^## 13\. Open Questions') {
        $pastSection12 = $true
        $inSection12 = $false
    }
    
    # Detect section 15 end
    if($l -match 'This completes Phase 0 document writing') {
        $pastSection15 = $true
    }
    
    # Skip the duplicate PR7-PR10 rows after section 15
    if($pastSection15 -and ($l -match '^\| PR[7-9]\|' -or $l -match '^\| PR10\|')) {
        continue
    }
    
    $out += $l
}

# Now insert PR7-PR10 into section 12's table after PR6
$finalOut = @()
$inSection12Table = $false
$pr6Found = $false

for($i=0; $i -lt $out.Count; $i++) {
    $l = $out[$i]
    
    # Detect start of PR table in section 12
    if($l -match '^\| ID \| Conflict or amendment') {
        $inSection12Table = $true
    }
    
    # Detect PR6 row
    if($inSection12Table -and $l -match '^\| PR6 \|') {
        $pr6Found = $true
    }
    
    # After PR6 row, insert PR7-PR10 before the table ends
    if($pr6Found -and $l -match '^\|---' -and -not $out[$i-1] -match 'PR6') {
        # This is the separator after PR6, insert PR7-PR10 here
        $finalOut += $l
        $finalOut += '| PR7 | **Source of truth: report, PR text or handoff.** R-B39 report, the handoff (context 7.3) and the PR description repeat fields. Proposal: the R-B39 report is the source. The PR description is a condensed copy of it. The handoff links to the PR. If they disagree, the report wins and the PR is corrected | rules R-B39, context 7.3 | accept |'
        $finalOut += '| PR8 | **Before S-0-02 there is no CI and no template.** Phase 0 documents and Step R PRs have no required checks. The user may commit Phase 0 documents directly, or review them with kind B and no CI | plan section 4, 3.1 | info |'
        $finalOut += '| PR9 | **Language.** Chat follows the user\'s language (R-B40). PR text, commit messages, titles and branch names are English | rules R-B40 | info |'
        $finalOut += '| PR10 | **Two new checks.** TC-DOC-12 (the template copy equals this doc\'s section 2) and TC-CIC-14 (PR body lint: required sections present, no blank field, test IDs exist). Each needs a bad fixture. TC-CIC-14 depends on what the CI provider exposes (verify at S-0-02) | test sections 6.10 and 7.5 | accept |'
        $pr6Found = $false  # Only insert once
        continue
    }
    
    # Detect end of table (blank line or next section)
    if($inSection12Table -and $l -match '^$' -and $pr6Found) {
        $inSection12Table = $false
    }
    
    $finalOut += $l
}

# Add the missing paragraphs after section 12 table
$finalOut2 = @()
$addedRulingOrder = $false
for($i=0; $i -lt $finalOut.Count; $i++) {
    $l = $finalOut[$i]
    $finalOut2 += $l
    
    # After the PR table ends (after PR10 row), add the ruling order and memory text
    if(-not $addedRulingOrder -and $l -match '^\| PR10 \|') {
        # Next line should be blank or next section
        if($i+1 -lt $finalOut.Count -and $finalOut[$i+1] -match '^$') {
            # Add after the blank line
        } elseif($i+1 -lt $finalOut.Count -and $finalOut[$i+1] -match '^##') {
            # Add before next section
            $finalOut2 += ''
            $finalOut2 += 'Ruling order that avoids rework: PR1 and PR3 together with loop L4 (all three decide what the agent may do with git), then the other items in one batch.'
            $finalOut2 += ''
            $finalOut2 += 'Memory\'s Pending total after this document is computed from the register. The agent adds PR1 to PR10 and verifies the total (memory M5). By my count the earlier 99 becomes 109, but the agent must recompute it.'
            $addedRulingOrder = $true
        }
    }
}

[IO.File]::WriteAllLines($path, $finalOut2, [System.Text.Encoding]::UTF8)