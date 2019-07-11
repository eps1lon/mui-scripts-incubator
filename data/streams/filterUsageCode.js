const stream = require("stream");

module.exports = filterUsageCode;

/**
 *
 * @param {object} options
 * @param {number} [options.highWaterMark]
 */
function filterUsageCode(options = {}) {
  const { highWaterMark } = options;

  return new stream.Transform({
    highWaterMark,
    objectMode: true,
    /**
     *
     * @param {{source: string} & T} file
     * @param {*} encoding
     * @param {*} callback
     */
    transform(file, encoding, callback) {
      if (file.source.includes("@material-ui")) {
        this.push(file);
      }
      callback();
    }
  });
}
