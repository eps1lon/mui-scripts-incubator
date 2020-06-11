const stream = require("stream");

module.exports = filterInteresting;

/**
 *
 * @param {object} [options]
 * @param {number} [options.highWaterMark]
 * @param {(readable: number, writeable: number)} [options.onPressureChange]
 */
function filterInteresting(isInteresting, options = {}) {
	const { highWaterMark, onPressureChange = () => {} } = options;

	return new stream.Transform({
		highWaterMark,
		objectMode: true,
		transform(repository, encoding, callback) {
			if (isInteresting(repository)) {
				this.push(repository);
			}
			onPressureChange(
				this.readableLength / this.readableHighWaterMark,
				this.writableLength / this.writableHighWaterMark
			);
			callback();
		},
	});
}
