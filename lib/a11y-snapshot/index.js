const { write: setJestGlobals } = require("./jestGlobals");
const childProcess = require("child_process");
const path = require("path");
const os = require("os");

module.exports = a11ySnapshot;

function a11ySnapshot(options) {
	const { argv = [], targetUrl } = options;
	setJestGlobals({
		__HOST__: targetUrl,
	});

	// Can't do `yarn jest` because in GitHub actions spawn fails with "yarn ENOENT"
	const jestCommandName = os.platform() === "win32" ? "jest.cmd" : "jest";
	const jestBinPath = path.resolve(
		process.cwd(),
		`node_modules/.bin/${jestCommandName}`
	);
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
			// https://github.com/sass/node-sass/issues/1283#issuecomment-169450661
			const ignoredErrorCodes =
				os.platform() === "win32" ? new Set([3221225477]) : new Set();
			if (code !== 0 && !ignoredErrorCodes.has(code)) {
				reject(`Jest failed with exit code '${code}'.`);
			} else {
				resolve();
			}
		});
	});
}
