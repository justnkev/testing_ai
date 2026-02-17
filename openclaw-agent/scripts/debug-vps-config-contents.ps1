# Debug VPS Config Contents
# Lists contents of the config directory to verify upload location.

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

Write-Host "Checking /opt/openclaw_config..." -ForegroundColor Cyan
Write-Host "================================"

# 1. List valid openclaw directories
Write-Host "`n[1/2] Recursive ls of /opt/openclaw_config..."
ssh ${VPS_USER}@${VPS_HOST} "ls -laR /opt/openclaw_config"
