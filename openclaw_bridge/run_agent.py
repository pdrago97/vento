import sys
import requests
import os
import json
import subprocess
import time

def main(agent_id):
    vento_url = os.environ.get("VENTO_URL", "http://localhost:8000")
    
    print(f"[*] Fetching manifest for agent: {agent_id} from {vento_url}...")
    try:
        # Retry mechanism in case Vento is still starting up
        max_retries = 5
        manifest = None
        for attempt in range(max_retries):
            try:
                resp = requests.get(f"{vento_url}/agents/{agent_id}/openclaw-manifest")
                resp.raise_for_status()
                manifest = resp.json().get("manifest", {})
                break
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise e
                print(f"[!] Vento not ready yet, retrying... ({attempt+1}/{max_retries})")
                time.sleep(2)
    except Exception as e:
        print(f"[ERROR] Failed to fetch manifest: {e}")
        sys.exit(1)
        
    manifest_path = f"{agent_id}_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        
    print(f"[*] Manifest saved to {manifest_path}")
    
    channels = manifest.get("channels", {})
    env = os.environ.copy()
    
    active_channels = []
    
    if channels.get("discord", {}).get("enabled"):
        env["DISCORD_BOT_TOKEN"] = channels["discord"].get("bot_token", "")
        active_channels.append("Discord")
        
    if channels.get("slack", {}).get("enabled"):
        env["SLACK_BOT_TOKEN"] = channels["slack"].get("bot_token", "")
        active_channels.append("Slack")
        
    if channels.get("whatsapp", {}).get("enabled"):
        env["WHATSAPP_API_TOKEN"] = channels["whatsapp"].get("api_token", "")
        active_channels.append("WhatsApp")
        
    if active_channels:
        print(f"[*] Configured channels: {', '.join(active_channels)}")
    else:
        print("[!] No channels configured or enabled. Agent will run in local-only mode.")
        
    print(f"\n[*] Starting OpenClaw agent '{agent_id}'...")
    
    # Generate the OpenClaw configuration file
    openclaw_config = {
        "agent": {
            "name": manifest.get("name", agent_id),
            "instruction": manifest.get("instruction", ""),
            "tools": manifest.get("tools", []),
            "ontology": manifest.get("ontology", {})
        },
        "channels": channels
    }
    
    config_path = f"{agent_id}_openclaw_config.json"
    with open(config_path, "w") as f:
        json.dump(openclaw_config, f, indent=2)
        
    print(f"[*] Generated OpenClaw configuration at {config_path}")
    print("--------------------------------------------------")
    print(f"[*] Executing OpenClaw Agent {agent_id} via subprocess...")
    print("--------------------------------------------------")
    
    # Example subprocess call to run OpenClaw
    try:
        process = subprocess.Popen(
            ["openclaw", "start", "--config", config_path],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1
        )
        
        for line in process.stdout:
            print(line, end="")
            try:
                requests.post(
                    f"{vento_url}/agents/{agent_id}/logs",
                    json={"log": line.rstrip("\n")}
                )
            except Exception:
                pass
                
        process.wait()
        if process.returncode != 0:
            print(f"[ERROR] OpenClaw exited with code {process.returncode}")
            
    except FileNotFoundError:
        print("[ERROR] 'openclaw' command not found. Please ensure the OpenClaw CLI is installed and in your PATH.")
    except KeyboardInterrupt:
        print("\n[*] Exiting OpenClaw bridge.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_agent.py <agent_id>")
        sys.exit(1)
    main(sys.argv[1])
