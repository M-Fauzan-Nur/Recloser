# Tahap 5 — End-to-end validation script.
# Read-only with respect to research files. Stops any prior uvicorn, starts a
# fresh one, runs smoke regressions, exercises ABC reproducibility against
# saved Tahap 4 JSON files, verifies SHA256 of all research files before/after.

$ErrorActionPreference = 'Stop'

$root       = 'D:\Penelitian\program pengujian\Pengujian_penelitian'
$backendDir = Join-Path $root 'recloser-research-web\backend'
$venvPy     = Join-Path $root 'rec\Scripts\python.exe'
$api        = 'http://127.0.0.1:8000'
$tmp        = Join-Path $env:TEMP 'tahap5'

if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Path $tmp | Out-Null

# ----------------------------------------------------------------------
# Step 0: Collect research files (.py + .csv) across 5 scenario folders.
# ----------------------------------------------------------------------
$researchDirs = @('scenario_a_website','scenario_b','scenario_c','scenario_d','scenario_e')
$researchFiles = New-Object System.Collections.Generic.List[object]
foreach ($d in $researchDirs) {
    $p = Join-Path $root $d
    if (Test-Path $p) {
        Get-ChildItem -Path $p -Recurse -File -Include '*.py','*.csv' -ErrorAction SilentlyContinue |
            ForEach-Object { $researchFiles.Add($_) }
    }
}
$researchFiles = $researchFiles | Sort-Object FullName

Write-Host ("Research files collected: {0}" -f $researchFiles.Count) -ForegroundColor Cyan
if ($researchFiles.Count -ne 27) { throw ("Expected 27 research files, got {0}" -f $researchFiles.Count) }

# ----------------------------------------------------------------------
# Step 1: SHA256 BEFORE.
# ----------------------------------------------------------------------
$beforeCsv = Join-Path $tmp 'sha256_before.csv'
$researchFiles | ForEach-Object {
    [PSCustomObject]@{
        Path = $_.FullName.Substring($root.Length + 1)
        Hash = (Get-FileHash -Algorithm SHA256 -Path $_.FullName).Hash
    }
} | Export-Csv -NoTypeInformation -Encoding utf8 -Path $beforeCsv

# ----------------------------------------------------------------------
# Step 2: Start uvicorn (kills any prior listener on :8000).
# ----------------------------------------------------------------------
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Seconds 1

$uvicornLog = Join-Path $tmp 'uvicorn.out'
$uvicornErr = Join-Path $tmp 'uvicorn.err'
$env:PYTHONPATH = $backendDir
$uvicornProc = Start-Process -FilePath $venvPy `
    -ArgumentList @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--log-level','warning') `
    -PassThru -NoNewWindow -RedirectStandardOutput $uvicornLog -RedirectStandardError $uvicornErr

# Wait for readiness (up to 30s).
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-WebRequest -Uri "$api/" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch { }
}
if (-not $ready) { throw 'Backend did not become ready in 30 s.' }

Write-Host 'Backend ready.' -ForegroundColor Green

# Helper: HTTP call with status capture (success or exception).
function Invoke-Api {
    param([string]$Method, [string]$Url, [int]$Expected)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $status = 0; $body = ''
    try {
        $r = Invoke-WebRequest -Method $Method -Uri $Url -UseBasicParsing -TimeoutSec 60
        $body = $r.Content
        $status = [int]$r.StatusCode
    } catch {
        $ex = $_.Exception
        if ($ex.Response) { $status = [int]$ex.Response.StatusCode }
        try { $body = (New-Object IO.StreamReader($ex.Response.GetResponseStream())).ReadToEnd() } catch {}
    }
    $sw.Stop()
    [PSCustomObject]@{
        Method = $Method
        Url = $Url
        Expected = $Expected
        Actual = $status
        Ok = ($status -eq $Expected)
        Ms = [int]$sw.ElapsedMilliseconds
    }
}

# ----------------------------------------------------------------------
# Step 3: Smoke regression matrix (30 calls).
# ----------------------------------------------------------------------
$matrix = New-Object System.Collections.Generic.List[object]
$matrix.Add((Invoke-Api -Method GET  -Url "$api/"                              -Expected 200)) | Out-Null
$matrix.Add((Invoke-Api -Method GET  -Url "$api/api/dashboard"                  -Expected 200)) | Out-Null
$matrix.Add((Invoke-Api -Method GET  -Url "$api/api/scenarios"                  -Expected 200)) | Out-Null
foreach ($id in @('a','b','c','d','e')) {
    $matrix.Add((Invoke-Api -Method GET -Url "$api/api/scenarios/$id"           -Expected 200)) | Out-Null
    $matrix.Add((Invoke-Api -Method GET -Url "$api/api/scenarios/$id/prediction" -Expected 200)) | Out-Null
    $matrix.Add((Invoke-Api -Method GET -Url "$api/api/scenarios/$id/dataset"    -Expected 200)) | Out-Null
    $matrix.Add((Invoke-Api -Method GET -Url "$api/api/scenarios/$id/latest"     -Expected 200)) | Out-Null
    $matrix.Add((Invoke-Api -Method POST -Url "$api/api/scenarios/$id/lstm/predict" -Expected 200)) | Out-Null
}
$matrix.Add((Invoke-Api -Method POST -Url "$api/api/scenarios/z/abc/optimize"  -Expected 404)) | Out-Null
$matrix.Add((Invoke-Api -Method POST -Url "$api/api/scenarios/z/lstm/predict" -Expected 404)) | Out-Null

$smokePass = ($matrix | Where-Object { $_.Ok }).Count
Write-Host ("Smoke regression: {0}/{1} pass" -f $smokePass, $matrix.Count) -ForegroundColor $(if ($smokePass -eq $matrix.Count) {'Green'} else {'Red'})

# ----------------------------------------------------------------------
# Step 4: ABC reproducibility vs Tahap 4 saved JSONs.
# Each leaf is compared as JSON-string equality.
# ----------------------------------------------------------------------
$leafs = @(
    @('scenario_id'),
    @('scenario_name'),
    @('source_file'),
    @('status'),
    @('parameters','num_reclosers'),
    @('parameters','colony_size'),
    @('parameters','max_iterations'),
    @('parameters','weights','W_SAIDI'),
    @('parameters','weights','W_SAIFI'),
    @('parameters','weights','W_RISK'),
    @('parameters','penalties','MAX_PROTECTED_FRACTION'),
    @('parameters','penalties','MAX_ZONE_OVERLAP'),
    @('parameters','penalties','PENALTY_PROXIMITY_COEF'),
    @('parameters','penalties','PENALTY_ZONE_SIZE_COEF'),
    @('parameters','penalties','RISK_SCALE'),
    @('parameters','penalties','RANDOM_SEED'),
    @('totals','total_customers'),
    @('totals','total_system_risk'),
    @('totals','total_lines'),
    @('totals','jumlah_iterasi'),
    @('baseline','saidi'),
    @('baseline','saifi'),
    @('optimal','positions'),
    @('optimal','fitness'),
    @('optimal','saidi'),
    @('optimal','saifi'),
    @('optimal','risk_unprotected'),
    @('improvement','saidi_pct'),
    @('improvement','saifi_pct'),
    @('improvement','risk_remaining_pct')
)

$repro = New-Object System.Collections.Generic.List[object]
foreach ($id in @('a','b','c','d','e')) {
    $refPath = Join-Path $root ("abc_$id.json")
    if (-not (Test-Path $refPath)) {
        $repro.Add([PSCustomObject]@{ Scenario=$id; Status="missing_ref"; Pass=$false; Total=$leafs.Count; Matched=0 }) | Out-Null
        continue
    }
    $refRaw = Get-Content $refPath -Raw
    $ref = $refRaw | ConvertFrom-Json

    $post = Invoke-Api -Method POST -Url "$api/api/scenarios/$id/abc/optimize" -Expected 200
    if (-not $post.Ok) {
        $repro.Add([PSCustomObject]@{ Scenario=$id; Status="post_failed"; Pass=$false; Total=$leafs.Count; Matched=0 }) | Out-Null
        continue
    }
    $newRaw = (Invoke-WebRequest -Method POST -Uri "$api/api/scenarios/$id/abc/optimize" -UseBasicParsing -TimeoutSec 300).Content
    $newRaw | Set-Content -Encoding utf8 (Join-Path $tmp "abc_${id}_t5.json")
    $new = $newRaw | ConvertFrom-Json

    # Per-leaf equality (JSON-string compare).
    $matched = 0
    foreach ($path in $leafs) {
        $rv = $ref; $nv = $new
        foreach ($p in $path) { $rv = $rv.$p; $nv = $nv.$p }
        $rvJson = $rv | ConvertTo-Json -Depth 10 -Compress
        $nvJson = $nv | ConvertTo-Json -Depth 10 -Compress
        if ($rvJson -eq $nvJson) { $matched++ }
    }

    $expectedSource = "hasil_prediksi_gangguan_final_$id.csv"
    $isolation = ($new.source_file -eq $expectedSource)
    $expectedPos = 'line_27,line_52,line_35,line_9'
    $posOk = ($new.optimal.positions -join ',') -eq $expectedPos
    $fitnessOk = ([math]::Round([double]$new.optimal.fitness, 6)) -eq ([math]::Round([double]$ref.optimal.fitness, 6))

    $repro.Add([PSCustomObject]@{
        Scenario        = $id
        Status          = 'ok'
        Pass            = ($matched -eq $leafs.Count) -and $isolation -and $posOk -and $fitnessOk
        Total           = $leafs.Count
        Matched         = $matched
        Isolation       = $isolation
        PositionsOk     = $posOk
        FitnessRef      = [double]$ref.optimal.fitness
        FitnessNew      = [double]$new.optimal.fitness
        FitnessOk       = $fitnessOk
        BaselineSaidi   = [double]$new.baseline.saidi
        OptimalSaidi    = [double]$new.optimal.saidi
        BaselineSaifi   = [double]$new.baseline.saifi
        OptimalSaifi    = [double]$new.optimal.saifi
        PositionsJoined = ($new.optimal.positions) -join ','
        RuntimeSec      = [double]$new.runtime_seconds
    }) | Out-Null
}

# ----------------------------------------------------------------------
# Step 5: Stop backend.
# ----------------------------------------------------------------------
try {
    Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {} }
    if ($uvicornProc -and -not $uvicornProc.HasExited) {
        Stop-Process -Id $uvicornProc.Id -Force -ErrorAction SilentlyContinue
    }
} catch {}

Start-Sleep -Seconds 2

# ----------------------------------------------------------------------
# Step 6: SHA256 AFTER; compare.
# ----------------------------------------------------------------------
$afterCsv = Join-Path $tmp 'sha256_after.csv'
$researchFiles | ForEach-Object {
    [PSCustomObject]@{
        Path = $_.FullName.Substring($root.Length + 1)
        Hash = (Get-FileHash -Algorithm SHA256 -Path $_.FullName).Hash
    }
} | Export-Csv -NoTypeInformation -Encoding utf8 -Path $afterCsv

$beforeRows = Import-Csv $beforeCsv
$afterRows  = Import-Csv $afterCsv
$shaDiff = Compare-Object -ReferenceObject $beforeRows -DifferenceObject $afterRows -Property Path,Hash
$shaPass = ($shaDiff.Count -eq 0)

# ----------------------------------------------------------------------
# Step 7: Write report.
# ----------------------------------------------------------------------
$report = Join-Path $tmp 'tahap5_report.md'
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# Tahap 5 Validation Report')
[void]$sb.AppendLine(("- Date (UTC): {0}" -f (Get-Date).ToUniversalTime()))
[void]$sb.AppendLine('- Backend: uvicorn app.main:app @ http://127.0.0.1:8000')
[void]$sb.AppendLine(("- Python venv: {0}" -f $venvPy))
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## 1. Smoke regression (30 calls)')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| # | Method | URL | Expected | Actual | Ok | Latency (ms) |')
[void]$sb.AppendLine('|---|--------|-----|----------|--------|----|--------------|')
$i = 0
foreach ($row in $matrix) {
    $i++
    [void]$sb.AppendLine(('| {0} | {1} | `{2}` | {3} | {4} | {5} | {6} |' -f $i, $row.Method, $row.Url.Replace($api,''), $row.Expected, $row.Actual, $row.Ok, $row.Ms))
}
[void]$sb.AppendLine('')
[void]$sb.AppendLine(('**Smoke pass: {0}/{1}**' -f $smokePass, $matrix.Count))
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## 2. ABC reproducibility vs Tahap 4 saved JSONs')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('| Scenario | Leaves matched | Isolation | Positions ok | Fitness ref | Fitness new | Fitness ok | Runtime (s) | Pass |')
[void]$sb.AppendLine('|----------|----------------|-----------|--------------|-------------|-------------|------------|-------------|------|')
foreach ($r in $repro) {
    [void]$sb.AppendLine(('| {0} | {1}/{2} | {3} | {4} | {5} | {6} | {7} | {8} | {9} |' -f `
        $r.Scenario, $r.Matched, $r.Total, $r.Isolation, $r.PositionsOk,
        $r.FitnessRef, $r.FitnessNew, $r.FitnessOk, $r.RuntimeSec, $r.Pass))
}
[void]$sb.AppendLine('')
[void]$sb.AppendLine('### Per-scenario detail')
[void]$sb.AppendLine('')
foreach ($r in $repro) {
    [void]$sb.AppendLine(('#### Scenario {0}' -f $r.Scenario))
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine(('- Baseline SAIDI: {0:N4}' -f $r.BaselineSaidi))
    [void]$sb.AppendLine(('- Optimal SAIDI:  {0:N4}' -f $r.OptimalSaidi))
    [void]$sb.AppendLine(('- Baseline SAIFI: {0:N4}' -f $r.BaselineSaifi))
    [void]$sb.AppendLine(('- Optimal SAIFI:  {0:N4}' -f $r.OptimalSaifi))
    [void]$sb.AppendLine(('- Positions: `{0}`' -f $r.PositionsJoined))
    [void]$sb.AppendLine(('- Runtime (server): {0:N3}s' -f $r.RuntimeSec))
    [void]$sb.AppendLine('')
}
[void]$sb.AppendLine('## 3. Research file integrity (SHA256)')
[void]$sb.AppendLine('')
[void]$sb.AppendLine(('- Files snapshotted: {0}' -f $researchFiles.Count))
[void]$sb.AppendLine(('- Mismatched before vs after: {0}' -f $shaDiff.Count))
[void]$sb.AppendLine(('- Result: **{0}**' -f ($(if ($shaPass) {'PASS'} else {'FAIL'}))))
if ($shaPass) {
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('All research `.py` and `.csv` files (27 across 5 scenario folders) are byte-identical before/after Tahap 5.')
}
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## 4. Architecture constraints')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('- DB / auth / deployment / OPEX / investment added: **NO**')
[void]$sb.AppendLine('- New dependencies: **NO**')
[void]$sb.AppendLine('- New endpoints: **NO**')
[void]$sb.AppendLine('- Backend changed: **NO**')
[void]$sb.AppendLine('- Frontend changed: `frontend/src/components/ScenarioView.jsx` (display-only: scenarioName in block headings + scenario_id pill, reusing `.metric-pill`)')
[void]$sb.AppendLine('- Node.js installed: **NO** (frontend cannot be built/run without it; no workaround added)')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('## 5. Stop point')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('Tahap 5 complete. Per user instruction, development stops here.')

Set-Content -Path $report -Encoding utf8 -Value ($sb.ToString())

# Persist report outside $tmp so it survives cleanup.
$finalReport = Join-Path $backendDir 'tahap5_report.md'
Copy-Item -Path $report -Destination $finalReport -Force

# Cleanup tmp directory (keep report copy in backend/).
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "=== Tahap 5 summary ===" -ForegroundColor Cyan
Write-Host ("Smoke regression: {0}/{1} pass" -f $smokePass, $matrix.Count)
foreach ($r in $repro) {
    if ($r.Status -eq 'ok') {
        Write-Host ("  Scenario {0}: {1}/{2} leaves ok, isolation={3}, positions ok={4}, fitness match={5} (ref={6:N6}, new={7:N6}), runtime={8:N3}s" -f `
            $r.Scenario, $r.Matched, $r.Total, $r.Isolation, $r.PositionsOk, $r.FitnessOk, $r.FitnessRef, $r.FitnessNew, $r.RuntimeSec)
    } else {
        Write-Host ("  Scenario {0}: {1}" -f $r.Scenario, $r.Status) -ForegroundColor Red
    }
}
Write-Host ("SHA256: {0} (27 files, before == after)" -f $(if ($shaPass) {'PASS'} else {'FAIL'}))
Write-Host ("Report: $finalReport")