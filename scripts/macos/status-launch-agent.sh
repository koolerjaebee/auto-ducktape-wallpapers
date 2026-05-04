#!/usr/bin/env zsh
set -euo pipefail

LABEL="com.autoducktape.wallpapers.scheduler"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "Plist: $PLIST"
if [[ -f "$PLIST" ]]; then
  echo "Installed: yes"
else
  echo "Installed: no"
fi

if ! launchctl print "gui/$(id -u)/$LABEL"; then
  echo "Loaded: no"
fi
