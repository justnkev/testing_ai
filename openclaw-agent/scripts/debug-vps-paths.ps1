# Debug VPS Paths
# Checks the remote .env and lists directories to find the real config path.

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

Write-Host "Debugging VPS Paths..." -ForegroundColor Cyan
Write-Host "======================"

# 1. Check .env for OPENCLAW_CONFIG_DIR
Write-Host "`n[1/3] Reading /opt/openclaw/.env..."
ssh ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw/.env | grep OPENCLAW_CONFIG_DIR"

# 2. List /opt to see what directories exist
Write-Host "`n[2/3] Listing /opt..."
ssh ${VPS_USER}@${VPS_HOST} "ls -la /opt/"

# 3. Check /opt/openclaw contents
Write-Host "`n[3/3] Listing /opt/openclaw..."
ssh ${VPS_USER}@${VPS_HOST} "ls -la /opt/openclaw/"
