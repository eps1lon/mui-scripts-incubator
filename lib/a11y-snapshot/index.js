const { write: setJestGlobals } = require("./jestGlobals");
const jest = require("jest");
const path = require("path");

module.exports = a11ySnapshot;

function a11ySnapshot(options) {
  const { argv = "", prNumber = Number.NaN } = options;
  const runOnMaster = Number.isNaN(prNumber);
  setJestGlobals({
    __HOST__: runOnMaster
      ? "https://material-ui.netlify.com"
      : `https://deploy-preview-${prNumber}--material-ui.netlify.com`
  });

  const jestConfigPath = path.relative(
    process.cwd(),
    path.resolve(__dirname, "./jest.config.js")
  );

  return jest.run(`-c ${jestConfigPath} ${argv}`);
}
