# Restart OpenClaw Agent

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Restarting OpenClaw Agent..." -ForegroundColor Cyan
Write-Host "============================"

# Restart and show logs
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose restart openclaw-gateway && sleep 5 && docker compose logs --tail 50 openclaw-gateway"

Write-Host "`nCheck logs above for 'listening on ws://...'" -ForegroundColor Green
