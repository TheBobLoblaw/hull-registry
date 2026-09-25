# Hull Registry setup: fetches the models and blueprints from the GitHub release into this folder and starts the viewer.
# Idempotent: run it again after a new release to update. No installs, no registry, nothing outside this folder.
#   powershell -ExecutionPolicy Bypass -File setup.ps1            (or right-click, Run with PowerShell)
#   powershell -ExecutionPolicy Bypass -File setup.ps1 -NoStart   (fetch only)
param([switch]$NoStart, [string]$Release = "latest")
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
$repo = "TheBobLoblaw/hull-registry"
$api = if ($Release -eq "latest") { "https://api.github.com/repos/$repo/releases/latest" } else { "https://api.github.com/repos/$repo/releases/tags/$Release" }
Write-Host "Hull Registry setup in $PSScriptRoot"
$rel = Invoke-RestMethod -Uri $api -Headers @{ "User-Agent" = "hull-registry-setup" }
Write-Host "release $($rel.tag_name): $(($rel.assets | ForEach-Object { $_.name }) -join ', ')"
$want = $rel.assets | Where-Object { $_.name -like "models*.zip" -or $_.name -eq "blueprints.zip" }
$tmp = Join-Path $PSScriptRoot "_download"; New-Item -ItemType Directory -Force $tmp | Out-Null
foreach ($a in $want) {
    $target = if ($a.name -eq "blueprints.zip") { "blueprints" } else { "models" }
    $stamp = Join-Path $PSScriptRoot "$target\.release-$($rel.tag_name)-$($a.name)"
    if (Test-Path $stamp) { Write-Host "$($a.name): already unpacked for $($rel.tag_name)"; continue }
    $zip = Join-Path $tmp $a.name
    if (-not (Test-Path $zip) -or (Get-Item $zip).Length -ne $a.size) {
        Write-Host "downloading $($a.name) ($([math]::Round($a.size / 1MB)) MB)..."
        $curl = Get-Command curl.exe -ErrorAction SilentlyContinue      # Windows 10+ ships curl.exe; it is many times faster than Invoke-WebRequest
        if ($curl) { & $curl.Source -L --retry 5 --retry-delay 5 -C - -o $zip $a.browser_download_url; if ($LASTEXITCODE -ne 0) { throw "download failed: $($a.name)" } }
        else { $ProgressPreference = "SilentlyContinue"; Invoke-WebRequest -Uri $a.browser_download_url -OutFile $zip -Headers @{ "User-Agent" = "hull-registry-setup" }; $ProgressPreference = "Continue" }
    }
    Write-Host "unpacking $($a.name)..."
    Expand-Archive -Path $zip -DestinationPath $PSScriptRoot -Force     # the zips contain models\... and blueprints\... already
    New-Item -ItemType File -Force $stamp | Out-Null
    Remove-Item $zip -Force
}
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
$models = @(Get-ChildItem -Path (Join-Path $PSScriptRoot "models") -Recurse -Filter *.glb -ErrorAction SilentlyContinue).Count
$bps = @(Get-ChildItem -Path (Join-Path $PSScriptRoot "blueprints") -Recurse -Filter *.json -ErrorAction SilentlyContinue).Count
$rows = (Get-Content (Join-Path $PSScriptRoot "catalog.json") -Raw | ConvertFrom-Json).Count
Write-Host "ready: $rows hulls in the catalogue, $models models, $bps blueprint files"
if ($models -lt 400) { Write-Warning "fewer models than expected; run the script again" }
if (-not $NoStart) { Start-Process -FilePath (Join-Path $PSScriptRoot "HullRegistry.exe") }
