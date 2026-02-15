# Verify OpenClaw Configuration

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "Verifying Configuration File..." -ForegroundColor Cyan
Write-Host "============================"

# Using single quotes for PowerShell allows easier double quotes for Linux
$CMD = 'ls -la /opt/openclaw_config && ls -la /opt/openclaw_config/openclaw.json && echo "--- Model Config ---" && grep -A 5 "model" /opt/openclaw_config/openclaw.json || echo "Model section not found" && echo "--- Primary ---" && grep "primary" /opt/openclaw_config/openclaw.json || echo "Primary not found"'

ssh ${VPS_USER}@${VPS_HOST} $CMD
