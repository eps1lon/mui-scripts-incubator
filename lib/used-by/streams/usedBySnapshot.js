const fs = require("fs");
const JSONStream = require("JSONStream");

module.exports = usedBySnapshot;

/**
 *
 * @param {string} snapshotFile
 * @param {object} [options]
 * @param {(readable: number, writeable: number)} [options.onPressureChange]
 * @returns {import('stream').Readable} chunks are {DependentRepository}
 */
function usedBySnapshot(snapshotFile) {
	const stream = fs.createReadStream(snapshotFile).pipe(JSONStream.parse("*"));

	return stream;
}
