# Quick SSH into OpenClaw VPS
# Usage: .\ssh-vps.ps1

# Load .env variables
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir "..\.env"

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^\s*([^#=]+)\s*=\s*(.*)") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}
else {
    Write-Warning ".env file not found at $EnvFile"
}

$VPS_HOST = $env:VPS_HOST
$VPS_USER = $env:VPS_USER

if (-not $VPS_HOST) {
    Write-Error "VPS_HOST not set in .env"
    exit 1
}

Write-Host "🖥️  Connecting to OpenClaw VPS..." -ForegroundColor Cyan
Write-Host "   Host: $VPS_USER@$VPS_HOST" -ForegroundColor Yellow
Write-Host ""

ssh ${VPS_USER}@${VPS_HOST}
