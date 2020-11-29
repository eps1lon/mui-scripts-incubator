# Maintainer helps

## yarn `a11y-snapshot`

The full test suite requires NVDA to be running.
Example workflow using Windows' powershell:

```bash
# The path you cloned this repository to
$REPO_PATH = "C:\Users\eps1lon\Development\mui-scripts-incubator"

# End of configuration. Changing anything below at your own risk
$LOG_FILE_PATH = "$REPO_PATH\lib\a11y-snapshot\nvda.log"
$NVDA_VENDOR = "$REPO_PATH\node_modules\screen-reader-testing-library\nvda"
$NVDA_BIN = "$NVDA_VENDOR\portable\nvda.exe"
& $NVDA_BIN --log-file=$LOG_FILE_PATH --config-path=$NVDA_VENDOR\settings
yarn a11y-snapshot screen-reader.test.js
& $NVDA_BIN -q
```

If you're not on windows you can skip `a11y-snapshot/screen-reader.test.js`.
