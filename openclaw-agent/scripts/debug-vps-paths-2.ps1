# Debug VPS Paths 2
# Lists directories and reads .env to find the config path.

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

Write-Host "Debugging VPS Paths (Attempt 2)..." -ForegroundColor Cyan
Write-Host "=================================="

# 1. List valid openclaw directories
Write-Host "`n[1/2] Listing /opt/openclaw* directories..."
ssh ${VPS_USER}@${VPS_HOST} "ls -Fd /opt/openclaw*"

# 2. Check .env content
Write-Host "`n[2/2] Reading /opt/openclaw/.env..."
ssh ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw/.env"
