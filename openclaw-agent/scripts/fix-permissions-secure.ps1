# Fix OpenClaw Permissions (Secure) - Resilient to Windows Line Endings

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Applying permissions fix (chmod 644/755)..." -ForegroundColor Cyan
Write-Host "============================"

# Using a single-line command to avoid Windows/Linux newline issues
$CMD = "chmod 755 /opt/openclaw_config && chmod 644 /opt/openclaw_config/openclaw.json && cd /opt/openclaw && docker compose restart openclaw-gateway && echo 'Waiting for restart...' && sleep 5 && docker compose logs --tail 20 openclaw-gateway"

ssh ${VPS_USER}@${VPS_HOST} $CMD
