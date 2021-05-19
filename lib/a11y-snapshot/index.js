const { write: setJestGlobals } = require("./jestGlobals");
const childProcess = require("child_process");
const path = require("path");

module.exports = a11ySnapshot;

function a11ySnapshot(options) {
	const { argv = [], targetUrl } = options;
	setJestGlobals({
		__HOST__: targetUrl,
	});

	// Can't do `yarn jest` because in GitHub actions spawn fails with "yarn ENOENT"
	const jestBinPath = path.resolve(process.cwd(), "node_modules/.bin/jest");
	const jestConfigPath = path.relative(
		process.cwd(),
		path.resolve(__dirname, "./jest.config.js")
	);

	return new Promise((resolve, reject) => {
		const jestProcess = childProcess.spawn(
			jestBinPath,
			["-c", jestConfigPath, ...argv],
			{ env: process.env, stdio: "inherit" }
		);
		jestProcess.once("exit", (code) => {
			if (code !== 0) {
				reject(`Jest failed with exit code '${code}'.`);
			} else {
				resolve();
			}
		});
	});
}
