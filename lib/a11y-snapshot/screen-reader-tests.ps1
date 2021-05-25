# End of configuration. Changing anything below at your own risk
$REPO_PATH = (Get-Location).Path
$LOG_FILE_PATH = "$REPO_PATH\lib\a11y-snapshot\nvda.log"
$NVDA_BIN = "$REPO_PATH\node_modules\screen-reader-testing-library\bin\nvda.ps1"
& $NVDA_BIN -logFile $LOG_FILE_PATH
yarn a11y-snapshot screen-reader.test.js
& $NVDA_BIN -quit