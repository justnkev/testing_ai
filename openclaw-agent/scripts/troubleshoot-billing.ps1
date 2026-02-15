# Troubleshoot OpenClaw Billing Error on VPS

$VPS_HOST = "89.167.57.16"
$VPS_USER = "root"

Write-Host "OpenClaw Troubleshooting Tool" -ForegroundColor Cyan
Write-Host "================================"

# 1. Check Logs for the error
Write-Host "`n1. Checking recent logs for billing errors/issues..." -ForegroundColor Yellow
# Run docker compose logs from the correct directory (/opt/openclaw)
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose logs --tail 100 | grep -iE 'error|billing|insufficient'"

# 2. Check the Configured API Key (End of Key)
Write-Host "`n2. Verifying configured OpenRouter API Key (End of key)..." -ForegroundColor Yellow
# We check the config file at /opt/openclaw_config/openclaw.json on the host.
# We grep for 'openRouterApiKey' and tail the last 15 chars to see the suffix.
$remote_cmd = "grep 'openRouterApiKey' /opt/openclaw_config/openclaw.json | tail -c 15"
ssh ${VPS_USER}@${VPS_HOST} $remote_cmd

# 3. Restart the Agent
Write-Host "`n3. Restarting OpenClaw Agent (to refresh credit status)..." -ForegroundColor Yellow
ssh ${VPS_USER}@${VPS_HOST} "cd /opt/openclaw && docker compose restart"

Write-Host "`nDone! if you saw '...xyz', verify it matches your OpenRouter key." -ForegroundColor Green
