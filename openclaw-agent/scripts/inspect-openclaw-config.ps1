# Inspect OpenClaw JSON Config

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "OpenClaw Config Inspector" -ForegroundColor Cyan
Write-Host "========================="

Write-Host "`nReading /opt/openclaw_config/openclaw.json (via Docker volume)..." -ForegroundColor Yellow
# We know the volume is mapped to /opt/openclaw_config on the host
ssh ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw_config/openclaw.json"

Write-Host "`nDone." -ForegroundColor Green
