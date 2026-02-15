# Verify OpenClaw Fix

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Verifying OpenClaw Fix" -ForegroundColor Cyan
Write-Host "======================"

Write-Host "`n1. Checking Configured Model..." -ForegroundColor Yellow
# Grep for 'model' to see what's in the file
ssh ${VPS_USER}@${VPS_HOST} "grep '\"model\":' /opt/openclaw_config/openclaw.json"

Write-Host "`n2. Checking Latest Logs..." -ForegroundColor Yellow
# Check logs for startup success
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose logs --tail 30 openclaw-gateway"

Write-Host "`nDone." -ForegroundColor Green
