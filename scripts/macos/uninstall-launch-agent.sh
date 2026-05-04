#!/usr/bin/env zsh
set -euo pipefail

LABEL="com.autoducktape.wallpapers.scheduler"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"

echo "Uninstalled $LABEL"
