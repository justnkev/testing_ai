# Fix OpenClaw Permissions (Nuclear Option)

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Applying permissions fix (chmod 777)..." -ForegroundColor Cyan
Write-Host "============================"

$CMD = @"
echo '--- Fixing /opt/openclaw_config ---'
chmod -R 777 /opt/openclaw_config

# Also ensure workspace is writable
mkdir -p /opt/openclaw_config/workspace
chmod -R 777 /opt/openclaw_config/workspace

echo '--- Restarting Gateway ---'
cd /opt/openclaw
docker compose restart openclaw-gateway
sleep 5
docker compose logs --tail 20 openclaw-gateway
"@

ssh ${VPS_USER}@${VPS_HOST} $CMD
