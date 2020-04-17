#!/bin/bash
# Runs until tests fail
# Used to investigate flaky parts of the website
#set -e
for (( ; ; ))
do
  yarn a11y-snapshot --testNamePattern="firefox \/components"
  exitCode=$?
  if [ $exitCode -ne 0 ]; then
    exit $exitCode
  fi
done