# VehicleVault — one-line installer for Windows (PowerShell 5.1+).
# Run in an elevated PowerShell:
#   irm https://raw.githubusercontent.com/TeeCodeDev/VehicleVault/main/scripts/install.ps1 | iex
# With options (download first):
#   Invoke-WebRequest -Uri https://raw.githubusercontent.com/TeeCodeDev/VehicleVault/main/scripts/install.ps1 -OutFile install.ps1
#   .\install.ps1 -Dir "$env:USERPROFILE\VehicleVault" -Port 3084 -Tag latest
param(
  [string]$Dir = (Join-Path $env:USERPROFILE 'VehicleVault'),
  [int]$Port = 3084,
  [string]$Tag = 'latest',
  [switch]$Uninstall,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Image = 'ghcr.io/teecodedev/vehiclevault'

function Write-Log($msg) { Write-Host $msg }

function Get-RandomHex {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return (($bytes | ForEach-Object { $_.ToString('x2') }) -join '')
}

function Assert-Docker {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker not found. Install Docker Desktop for Windows (WSL2 backend): https://docs.docker.com/desktop/install/windows, or "winget install Docker.DockerDesktop", then re-run.'
  }
  try { docker info *>$null }
  catch { throw 'Docker daemon is not running. Start Docker Desktop and re-run.' }
  try { docker compose version *>$null }
  catch { throw 'Docker Compose v2 not found. Update Docker Desktop and re-run.' }
}

function Uninstall-Vault {
  if (-not (Test-Path (Join-Path $Dir 'docker-compose.yml'))) {
    throw "Nothing to uninstall: no docker-compose.yml in $Dir."
  }
  Write-Log "Stopping VehicleVault in $Dir ..."
  Push-Location $Dir
  try { docker compose down } finally { Pop-Location }
  Write-Log "Stopped. Data kept in $Dir\data. Delete that folder manually to wipe all data."
}

if ($Uninstall) { Uninstall-Vault; exit 0 }

Write-Log "Installing VehicleVault (${Image}:${Tag}) into $Dir (port $Port) ..."

New-Item -ItemType Directory -Force -Path (Join-Path $Dir 'data') *>$null
$composePath = Join-Path $Dir 'docker-compose.yml'
$envPath = Join-Path $Dir '.env'

if (-not (Test-Path $envPath)) {
  Write-Log "Generating .env with random JWT secrets ..."
  "PORT=$Port`r`nJWT_SECRET=$(Get-RandomHex)`r`nJWT_REFRESH_SECRET=$(Get-RandomHex)`r`n" | Out-File -FilePath $envPath -Encoding ascii
}

$compose = @"
services:
  vehiclevault:
    image: ${Image}:${Tag}
    restart: unless-stopped
    ports:
      - "`${PORT:-$Port}:3084"
    environment:
      - NODE_ENV=production
      - PORT=3084
      - DATA_DIR=/data
      - JWT_SECRET=`${JWT_SECRET:-change_this_to_a_random_secure_secret_in_production}
      - JWT_REFRESH_SECRET=`${JWT_REFRESH_SECRET:-change_this_to_another_random_secure_secret}
    volumes:
      - ./data:/data
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3084/healthz || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
"@
$compose | Out-File -FilePath $composePath -Encoding ascii

if ($DryRun) {
  Write-Log "--- $composePath (dry run, not started) ---"
  Get-Content $composePath | Write-Host
  exit 0
}

Assert-Docker
Push-Location $Dir
try {
  docker compose pull
  docker compose up -d
} finally { Pop-Location }

Write-Log "Waiting for http://localhost:$Port/healthz ..."
for ($i = 0; $i -lt 30; $i++) {
  try {
    (Invoke-WebRequest -Uri "http://localhost:$Port/healthz" -UseBasicParsing -TimeoutSec 3).StatusCode | Out-Null
    break
  } catch { Start-Sleep -Seconds 2 }
}

Write-Log ''
Write-Log "VehicleVault is up at http://localhost:$Port"
Write-Log 'The first account you register receives Administrator rights.'
Write-Log "Data directory: $Dir\data | Manage with: cd $Dir; docker compose logs|ps|down"
