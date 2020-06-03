const { read } = require("./jestGlobals");

module.exports = {
	globals: read(),
	snapshotSerializers: [require.resolve("./a11y-tree-serializer")],
	setupFilesAfterEnv: ["./jest.setup.js"],
	testTimeout: 10000,
};
