const path = require("path");
const { read } = require("./jestGlobals");

module.exports = {
	globals: {
		...read(),
		__NVDA_LOG_FILE_PATH__: path.resolve(__dirname, "./nvda.log"),
	},
	snapshotSerializers: [require.resolve("./a11y-tree-serializer")],
	setupFilesAfterEnv: ["./jest.setup.js"],
	testRegex: "\\.test\\.js$",
	// With the default runner:
	// - snapshots spill over into another tests
	// - beforeEach starts before afterEach in the same context finishes
	// Using workaround described in https://github.com/facebook/jest/issues/9527#issuecomment-776271802
	testRunner: "jest-circus/runner",
	testTimeout: 20000,
};
