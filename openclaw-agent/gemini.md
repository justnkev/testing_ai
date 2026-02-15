# OpenClaw - Gemini Deployment Notes

## How We Got It Running (2026-02-13)

### 1. VPS Connection
- **IP:** `89.167.57.16`
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
