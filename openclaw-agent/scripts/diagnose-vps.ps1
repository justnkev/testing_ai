# Diagnose OpenClaw Config Permissions

# Load .env variables
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir "..\.env"

if (Test-Path $EnvFile) {
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match "^\s*([^#=]+)\s*=\s*(.*)") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}
else {
    Write-Warning ".env file not found at $EnvFile"
}

$VPS_HOST = $env:VPS_HOST
$VPS_USER = $env:VPS_USER

if (-not $VPS_HOST) {
    Write-Error "VPS_HOST not set in .env"
    exit 1
}

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
