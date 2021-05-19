const { write: setJestGlobals } = require("./jestGlobals");
const childProcess = require("child_process");
const path = require("path");

module.exports = a11ySnapshot;

function a11ySnapshot(options) {
	const { argv = [], targetUrl } = options;
	setJestGlobals({
		__HOST__: targetUrl,
	});

	const jestConfigPath = path.relative(
		process.cwd(),
		path.resolve(__dirname, "./jest.config.js")
	);

	return new Promise((resolve, reject) => {
		const jestProcess = childProcess.spawn(
			`yarn`,
			["jest", "-c", jestConfigPath, ...argv],
			{ stdio: "inherit" }
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
