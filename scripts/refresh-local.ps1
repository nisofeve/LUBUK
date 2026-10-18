param([switch]$PackagePC)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$gamesRoot = [System.IO.Path]::GetFullPath((Join-Path $root 'site\games'))

function Sync-Game($source, $slug, $excludeDirs = @(), $excludeFiles = @()) {
    if (-not (Test-Path -LiteralPath $source -PathType Container)) { throw "Missing source: $source" }
    $target = [System.IO.Path]::GetFullPath((Join-Path $gamesRoot $slug))
    if (-not $target.StartsWith($gamesRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Invalid target: $target" }
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    $args = @($source, $target, '/MIR', '/NFL', '/NDL', '/NJH', '/NJS', '/NP')
    if ($excludeDirs.Count) { $args += '/XD'; $args += $excludeDirs }
    if ($excludeFiles.Count) { $args += '/XF'; $args += $excludeFiles }
    & robocopy @args | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copy failed for $slug (robocopy exit $LASTEXITCODE)" }
    Write-Host "Synced $slug"
}

Sync-Game 'F:\Projects\MyGames\ComFront\dist' 'comfront' @() @('*.map','_headers','_redirects','.gitkeep')
Sync-Game 'F:\Projects\MyGames\Companion & Me\Game' 'compy' @() @('*.zip','serve.ps1')
Sync-Game 'F:\Projects\MyGames\Plotbound\dist' 'plotbound' @() @('*.map')
Sync-Game 'F:\Projects\MyGames\Sigilbound\dist' 'sigilbound' @() @('*.map')
Sync-Game 'F:\Projects\MyGames\Type Zomba' 'type-zomba' @() @('README.md')

$mymythSource = 'F:\Projects\MyGames\Mymyth_v2'
$mymythTarget = Join-Path $gamesRoot 'mymyth'
New-Item -ItemType Directory -Path $mymythTarget -Force | Out-Null
foreach ($subdir in @('assets','data','js')) {
    $target = Join-Path $mymythTarget $subdir
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    & robocopy (Join-Path $mymythSource $subdir) $target /MIR /NFL /NDL /NJH /NJS /NP /XF 'organise-art.ps1' | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copy failed for MyMyth/$subdir (robocopy exit $LASTEXITCODE)" }
}
Copy-Item -LiteralPath (Join-Path $mymythSource 'index.html') -Destination (Join-Path $mymythTarget 'index.html') -Force
Write-Host 'Synced mymyth'

$ketumTarget = Join-Path $gamesRoot 'ketum-farmer'
New-Item -ItemType Directory -Path $ketumTarget -Force | Out-Null
Copy-Item -LiteralPath 'F:\Projects\Others\Ketum Farmer\JDJ_PublisherBuild_Alpha.html' -Destination (Join-Path $ketumTarget 'index.html') -Force
Write-Host 'Synced ketum-farmer'

& node (Join-Path $PSScriptRoot 'fix-page-paths.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Path fix failed' }
if ($PackagePC) {
    & python (Join-Path $PSScriptRoot 'package-pc.py')
    if ($LASTEXITCODE -ne 0) { throw 'PC packaging failed' }
}
& node (Join-Path $PSScriptRoot 'update-report.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Report update failed' }
