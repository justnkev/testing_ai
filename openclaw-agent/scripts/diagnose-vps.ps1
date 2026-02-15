# Diagnose OpenClaw Config Permissions

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Diagnosing VPS Configuration..." -ForegroundColor Cyan
Write-Host "============================"

$CMD = @"
echo '--- ENV (Config Path) ---'
grep OPENCLAW_CONFIG_DIR /opt/openclaw/.env || echo 'Variable not found in .env'

echo '--- LS -LA /opt/openclaw_config ---'
ls -la /opt/openclaw_config

echo '--- LS -LA /opt/openclaw_config/openclaw.json ---'
ls -la /opt/openclaw_config/openclaw.json

echo '--- CAT /opt/openclaw_config/openclaw.json (First 20 lines) ---'
head -n 20 /opt/openclaw_config/openclaw.json
"@

$CMD = $CMD -replace "`r", ""
ssh ${VPS_USER}@${VPS_HOST} $CMD
