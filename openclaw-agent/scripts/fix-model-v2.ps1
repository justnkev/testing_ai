# Fix OpenClaw Model Configuration (V2)

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"
$OLD_MODEL_STR = '"primary": "openrouter/auto"'
$NEW_MODEL_STR = '"primary": "anthropic/claude-3.5-sonnet"'

Write-Host "OpenClaw Config Auto-Fixer V2" -ForegroundColor Cyan
Write-Host "============================"

Write-Host "`n1. Replacing '$OLD_MODEL_STR' with '$NEW_MODEL_STR'..." -ForegroundColor Yellow

# Escape for PowerShell variable interpolation AND sed syntax
# In sed, we need to escape the forward slash in the model name: openrouter\/auto
# But since we are passing it as a string to ssh, let's try a simpler delimiter for sed like |
# s|pattern|replacement|

# Construction of the sed command:
# search: "primary": "openrouter/auto"
# replace: "primary": "anthropic/claude-3.5-sonnet"
# We must be careful with quotes.

$sed_cmd = "sed -i 's|`"primary`": `"openrouter/auto`"|`"primary`": `"anthropic/claude-3.5-sonnet`"|' /opt/openclaw_config/openclaw.json"

Write-Host "Executing remote command..."
ssh $VPS_USER@$VPS_HOST $sed_cmd

Write-Host "`n2. Verifying the change..." -ForegroundColor Yellow
$verify_cmd = "grep '`"primary`":' /opt/openclaw_config/openclaw.json"
ssh $VPS_USER@$VPS_HOST $verify_cmd

Write-Host "`n3. Restarting openclaw-gateway..." -ForegroundColor Yellow
ssh $VPS_USER@$VPS_HOST "cd /opt/openclaw && docker compose restart openclaw-gateway && sleep 5 && docker compose logs --tail 20 openclaw-gateway"

Write-Host "`nFix complete. Check logs above." -ForegroundColor Green
