#!/bin/sh

set -e

action=$(jq -r .ref "$GITHUB_EVENT_PATH")

if "$ACTION" == "a"; then
  exit 0
fi

echo "release was not created"
exit 78