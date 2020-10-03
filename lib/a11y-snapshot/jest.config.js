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
	testTimeout: 10000,
};
