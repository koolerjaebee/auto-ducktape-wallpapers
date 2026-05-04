#!/usr/bin/env zsh
set -euo pipefail

LABEL="com.autoducktape.wallpapers.scheduler"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$REPO_ROOT/logs"
NPM_BIN="$(command -v npm)"
NODE_BIN="$(command -v node)"
BIN_DIR="$(dirname "$NPM_BIN")"
LAUNCHD_PATH="$BIN_DIR:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
INTERVAL_SECONDS="$("$NODE_BIN" -e "const s = require('$REPO_ROOT/settings.json'); const m = s.routines.demo.schedule.everyMinutes; if (!Number.isInteger(m) || m < 1) process.exit(1); process.stdout.write(String(m * 60));")"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
: > "$LOG_DIR/launchd.out.log"
: > "$LOG_DIR/launchd.err.log"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "https://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NPM_BIN</string>
    <string>run</string>
    <string>run-once</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$REPO_ROOT</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$LAUNCHD_PATH</string>
    <key>HOME</key>
    <string>$HOME</string>
    <key>LANG</key>
    <string>en_US.UTF-8</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>$INTERVAL_SECONDS</integer>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/launchd.err.log</string>
</dict>
</plist>
EOF

plutil -lint "$PLIST" >/dev/null
launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true

echo "Installed $LABEL"
echo "Interval: $INTERVAL_SECONDS seconds"
echo "Plist: $PLIST"
echo "Logs: $LOG_DIR/launchd.out.log and $LOG_DIR/launchd.err.log"
