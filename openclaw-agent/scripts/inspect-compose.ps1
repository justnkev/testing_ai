# Inspect OpenClaw Docker Compose Configuration

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Docker Compose Inspector" -ForegroundColor Cyan
Write-Host "==========================="

Write-Host "`nReading /opt/openclaw/docker-compose.yml..." -ForegroundColor Yellow
ssh ${VPS_USER}@${VPS_HOST} "cat /opt/openclaw/docker-compose.yml"

Write-Host "`nDone." -ForegroundColor Green
