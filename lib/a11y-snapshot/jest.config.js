const { read } = require("./jestGlobals");

module.exports = {
	globals: read(),
	snapshotSerializers: [require.resolve("./a11y-tree-serializer")],
	testTimeout: 10000,
};
