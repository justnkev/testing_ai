# Quick SSH into OpenClaw VPS
# Usage: .\ssh-vps.ps1

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "🖥️  Connecting to OpenClaw VPS..." -ForegroundColor Cyan
Write-Host "   Host: $VPS_USER@$VPS_HOST" -ForegroundColor Yellow
Write-Host ""

ssh ${VPS_USER}@${VPS_HOST}
