# Fix OpenClaw VPS Permissions
# Run this if you see "EACCES: permission denied" in the logs.

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

Write-Host "🛠️  OpenClaw Permission Fixer" -ForegroundColor Cyan
Write-Host "============================"

# 1. Fix Permissions
Write-Host "`n1. Setting correct ownership (1000:1000) for config files..." -ForegroundColor Yellow
$fix_cmd = "chown -R 1000:1000 /opt/openclaw_config"
ssh ${VPS_USER}@${VPS_HOST} $fix_cmd

# 2. Restart Containers
Write-Host "`n2. Restarting OpenClaw Agent..." -ForegroundColor Yellow
$restart_cmd = "cd /opt/openclaw && docker compose restart"
ssh ${VPS_USER}@${VPS_HOST} $restart_cmd

Write-Host "`n✅ Permissions fixed and agent restarted." -ForegroundColor Green
Write-Host "Please run '.\openclaw-agent\scripts\troubleshoot-billing.ps1' again to verify the logs are clean." -ForegroundColor Gray
