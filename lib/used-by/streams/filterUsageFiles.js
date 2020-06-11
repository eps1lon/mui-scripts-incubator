const stream = require("stream");

module.exports = filterUsageFiles;

/**
 *
 * @param {object} [options]
 * @param {number} [options.highWaterMark]
 * @param {(readable: number, writeable: number)} [options.onPressureChange]
 */
function filterUsageFiles(options = {}) {
	const { highWaterMark, onPressureChange = () => {} } = options;

	return new stream.Transform({
		highWaterMark,
		objectMode: true,
		transform({ fileName, repository, source }, encoding, callback) {
			onPressureChange(
				this.readableLength / this.readableHighWaterMark,
				this.writableLength / this.writableHighWaterMark
			);

			// some people actually have their node modules in source control
			if (isPossiblyJs(fileName) && !isNodeModule(fileName)) {
				const name = fileName.replace(
					`${repository.repoName}-${repository.ref}/`,
					""
				);

				if (source.indexOf("@material-ui")) {
					this.push({ name, repository, source });
				}
			}

			callback();
		},
	});
}

/**
 *
 * @param {string} entry
 */
function isPossiblyJs(fileName) {
	return /\.(jsx?|tsx?)$/.test(fileName);
}

/**
 *
 * @param {string} entry
 */
function isNodeModule(fileName) {
	return /\/node_modules\//.test(fileName);
}
