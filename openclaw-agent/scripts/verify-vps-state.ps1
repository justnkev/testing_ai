# Verify OpenClaw Configuration

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

Write-Host "Verifying Configuration File..." -ForegroundColor Cyan
Write-Host "============================"

# Using single quotes for PowerShell allows easier double quotes for Linux
$CMD = 'ls -la /opt/openclaw_config && ls -la /opt/openclaw_config/openclaw.json && echo "--- Model Config ---" && grep -A 5 "model" /opt/openclaw_config/openclaw.json || echo "Model section not found" && echo "--- Primary ---" && grep "primary" /opt/openclaw_config/openclaw.json || echo "Primary not found"'

ssh ${VPS_USER}@${VPS_HOST} $CMD
