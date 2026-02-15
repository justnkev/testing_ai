# OpenClaw SSH Tunnel Script
# This script establishes a local port forward to access the OpenClaw dashboard

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"
$LOCAL_PORT = 18789
$REMOTE_PORT = 18789

Write-Host "🔒 Establishing SSH tunnel to OpenClaw dashboard..." -ForegroundColor Cyan
Write-Host "   Local:  http://localhost:$LOCAL_PORT" -ForegroundColor Green
Write-Host "   Remote: $VPS_USER@$VPS_HOST:$REMOTE_PORT" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to close the tunnel" -ForegroundColor Gray
Write-Host ""

ssh -N -L ${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT} ${VPS_USER}@${VPS_HOST}
