# Verify OpenClaw VPS Configuration State (Deep Check)

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

Write-Host "VPS Config Inspector (Container Deep Dive)" -ForegroundColor Cyan
Write-Host "=============================================="

# 1. Check Directory Permissions on Host
Write-Host "`n1. Checking directory /opt/openclaw_config permissions..." -ForegroundColor Yellow
ssh ${VPS_USER}@${VPS_HOST} "ls -lad /opt/openclaw_config"

# 2. Check Permissions INSIDE CONTAINER
Write-Host "`n2. Listing openclaw.json INSIDE CONTAINER..." -ForegroundColor Yellow
# Use proper service name 'openclaw-gateway'
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose exec -T openclaw-gateway ls -lad /home/node/.openclaw/openclaw.json"

# 3. Check User ID INSIDE CONTAINER
Write-Host "`n3. Checking Container User ID..." -ForegroundColor Yellow
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose exec -T openclaw-gateway id"

# 4. Attempt Restart & Log
Write-Host "`n4. Attempting to start openclaw-gateway and read logs..." -ForegroundColor Yellow
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose restart openclaw-gateway && sleep 2 && docker compose logs --tail 20 openclaw-gateway"

Write-Host "`nDiagnostic complete." -ForegroundColor Green
