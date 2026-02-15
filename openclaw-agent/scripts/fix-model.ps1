# Fix OpenClaw Model Configuration

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"
$NEW_MODEL = "anthropic/claude-3.5-sonnet"

Write-Host "OpenClaw Config Auto-Fixer" -ForegroundColor Cyan
Write-Host "=========================="

Write-Host "`n1. Updating 'model' in openclaw.json to '$NEW_MODEL'..." -ForegroundColor Yellow

# Use a temporary variable to construct the sed command safely
# Notice the backticks before double quotes to escape them in PowerShell
$sed_cmd = "sed -i 's/`"model`": `".*`"/`"model`": `"$NEW_MODEL`"/' /opt/openclaw_config/openclaw.json"

Write-Host "Executing remote command: $sed_cmd"
ssh $VPS_USER@$VPS_HOST $sed_cmd

Write-Host "`n2. Verifying the change..." -ForegroundColor Yellow
$verify_cmd = "grep '`"model`":' /opt/openclaw_config/openclaw.json"
ssh $VPS_USER@$VPS_HOST $verify_cmd

Write-Host "`n3. Restarting openclaw-gateway..." -ForegroundColor Yellow
# Restart and check logs
ssh $VPS_USER@$VPS_HOST "cd /opt/openclaw && docker compose restart openclaw-gateway && sleep 5 && docker compose logs --tail 20 openclaw-gateway"

Write-Host "`nFix complete. Check logs above for clean startup." -ForegroundColor Green
