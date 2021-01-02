#!/bin/bash
# Runs until tests fail
# Used to investigate flaky parts of the website
#set -e
for (( ; ; ))
do
  yarn a11y-snapshot aom --testNamePattern="chromium \/components\/buttons/"
  exitCode=$?
  if [ $exitCode -ne 0 ]; then
    exit $exitCode
  fi
done