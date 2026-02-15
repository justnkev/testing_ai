# Fix OpenClaw VPS Permissions
# Run this if you see "EACCES: permission denied" in the logs.

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

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
