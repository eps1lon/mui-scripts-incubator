#!/bin/sh

set -e

action=$(jq -r .action "$GITHUB_EVENT_PATH")

if "$ACTION" == "created"; then
  exit 0
fi

echo "release was not created but $action instead"
exit 78