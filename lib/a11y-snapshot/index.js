const { write: setJestGlobals } = require("./jestGlobals");
const jest = require("jest");
const path = require("path");

module.exports = a11ySnapshot;

function a11ySnapshot(options) {
	const { argv = "", targetUrl } = options;
	setJestGlobals({
		__HOST__: targetUrl,
	});

	const jestConfigPath = path.relative(
		process.cwd(),
		path.resolve(__dirname, "./jest.config.js")
	);

	return jest.run(`-c ${jestConfigPath} ${argv}`);
}
