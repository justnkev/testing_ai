# OpenClaw - Gemini Deployment Notes

## How We Got It Running (2026-02-13)

### 1. VPS Connection
- **IP:** `<YOUR_VPS_IP>`
- **User:** `root`
- **Access:**
  - **Preferred:** SSH Key (`id_ed25519`)
  - **Fallback:** Root password (verified working for agent control)

### 2. File Structure
- **Config Path:** `/opt/openclaw_config`
- **App Path:** `/opt/openclaw`
- **Container Path:** `/home/node/.openclaw` (mapped from config)

### 3. Troubleshooting & Fixes

#### Issue 1: Permission Denied (EACCES)
**Symptom:** Logs showed `Error: EACCES: permission denied, open '/home/node/.openclaw/openclaw.json'`
**Cause:** Config files were owned by `root`, but the container runs as user `node` (UID 1000).
**Fix:**
```bash
chown -R 1000:1000 /opt/openclaw_config
```

#### Issue 2: Hardcoded Paths
**Symptom:** Logs showed `mkdir '/root/.openclaw/agents/main/sessions'`.
**Cause:** `sessions.json` contained absolute paths pointing to `/root` from a previous run.
**Fix:**
```bash
sed -i 's|/root/|/home/node/|g' /opt/openclaw_config/agents/main/sessions/sessions.json
```

### 4. Running the Agent
To start or restart the agent:
```bash
cd /opt/openclaw
docker compose down
docker compose up -d
docker compose logs -f
```

### 5. Failover System
- **Current Status:** Healthy
- **Billing Warning:** Received `FailoverError` for `google/gemini-2.5-flash`.
- **Behavior:** OpenClaw successfully switched to a fallback model (e.g., OpenRouter/Groq), ensuring the bot remained operational.

### 6. Configuration Guide (Manual)
Since the CLI wizard can be tricky to invoke inside Docker, manual editing is reliable.

**1. Edit Config:**
```bash
nano /opt/openclaw_config/openclaw.json
```

**2. Example: Adding OpenRouter Auto (Router)**
Add to `fallbacks` list (at the top):
```json
"openrouter/auto",
```
*(Note: `openrouter/auto` is already defined in the `models` section of your config, so you only need to add it to `fallbacks`)*

**3. Apply Changes:**
```bash
docker compose restart
```

### 7. Using the "PE Hunter" Subagent
Use this prompt to activate the subagent after deployment:

> **System Update:** A new specialized subagent named `pe-hunter` has been deployed to `agents/pe-hunter`. Its role is to find and enrich electrical service business leads in the NYC Tri-State area meeting specific criteria ($2M-$7M Rev, 20+ Years).
>
> **Task:** Please activate the `pe-hunter` subagent and instruct it to begin a search for 5 high-quality leads that match its defined "Buy Box" criteria. Compile the results into a summary table including Owner Name and Contact Info.

## FitVision Separation & Tooling Updates (2026-02-15)

### 1. Application Separation
- **Action:** Migrated FitVision into a standalone directory (`fit-vision-app/`).
- **Structure:**
  - `backend/`: Flask application
  - `mobile/`: React Native application
  - `docs/`: Product Requirement Documents (PRDs)
  - `fitvision_export.sql`: Database backup including schema and data for `profiles`, `meals`, `sleep`, `workouts`, etc.

### 2. PR Agent Configuration & Fixes
The `pr_agent` (CLI tool) running via GitHub Actions was debugged and fixed.

#### Issue 1: Syntax Error
- **Cause:** `pr_agent/__init__.py` contained raw text instead of a docstring.
- **Fix:** Converted text to a Python docstring.

#### Issue 2: 406 Not Acceptable (Header Issue)
- **Cause:** GitHub API rejected the `Accept` header `application/vnd.github.v3.diff` without user-agent.
- **Fix:** Updated `github_client.py` to use `application/vnd.github.v3.diff` *and* added a `User-Agent` header (`PR-Agent-v1`).

#### Issue 3: 406 Not Acceptable (Diff Too Large)
- **Cause:** The FitVision migration resulted in a diff larger than GitHub's API limit (300 files), causing a 406 error.
- **Fix:** Implemented error handling in `github_client.py`. Now, if a 406 "too_large" error occurs, the agent:
  1. Catches the exception.
  2. Sets a warning message as the diff text.
  3. Proceeds with the review (posting the warning comment) instead of crashing the CI pipeline.

## Server-Side Browser Configuration (2026-02-16)

The agent has been configured to use a headless browser running on the same VPS network, removing the need for a local Chrome extension.

### 1. Architecture
- **Service:** `browser` (running `ghcr.io/browserless/chromium:latest`)
- **Port:** `3000` (internal Docker network)
- **Connection:** `openclaw-gateway` connects via `http://browser:3000`.

### 2. Configuration Details

#### Docker Compose (`/opt/openclaw/docker-compose.yml`)
Added a dedicated browser service and configured the gateway to use it:

```yaml
services:
  openclaw-gateway:
    environment:
      # Connects to the browser service
      BROWSER_WS_ENDPOINT: http://browser:3000
    depends_on:
      - browser

  browser:
    image: ghcr.io/browserless/chromium:latest
    restart: always
    ports:
      - "3000:3000"
    environment:
      - "MAX_CONCURRENT_SESSIONS=10"
      - "CONNECTION_TIMEOUT=60000" # 60s timeout to prevent disconnects
```

#### Agent Config (`/opt/openclaw_config/openclaw.json`)
Enabled browser support and increased timeouts for stability:

```json
"browser": {
    "enabled": true,
    "defaultProfile": "openclaw",
    "cdpUrl": "${BROWSER_WS_ENDPOINT}",
    "remoteCdpTimeoutMs": 10000,          // 10s timeout for CDP commands
    "remoteCdpHandshakeTimeoutMs": 20000  // 20s timeout for initial handshake
}
```

### 3. Troubleshooting
If the agent says "Browser failed: ... tab not found" or disconnects:
1.  **Check Browser Logs:** `ssh root@... "docker compose logs browser --tail 20"`
2.  **Restart Stack:** `ssh root@... "cd /opt/openclaw && docker compose restart"`
3.  **Verify Configuration:** Ensure `openclaw.json` has the correct timeout keys (`remoteCdpTimeoutMs`, not `timeout`).

## Security Best Practices (Crucial)

> [!WARNING]
> **NEVER** hardcode sensitive information (API keys, passwords, IP addresses) directly into scripts or configuration files that are tracked by git.

### Correct Usage:
Always use the `.env` file to store sensitive variables. This file is ignored by git (`.gitignore`) and ensures secrets are not leaked.

1.  **Define in `.env`:**
    ```bash
    VPS_HOST=123.45.67.89
    VPS_USER=root
    GEMINI_API_KEY=your_key_here
    ```

2.  **Load in PowerShell Scripts:**
    ```powershell
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
    
    # Use variables
    $VPS_HOST = $env:VPS_HOST
    ```

