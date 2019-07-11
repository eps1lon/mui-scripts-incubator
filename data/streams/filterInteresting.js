const stream = require("stream");

module.exports = filterInteresting;

/**
 *
 * @param {object} [options]
 * @param {number} [options.highWaterMark]
 */
function filterInteresting(isInteresting, options = {}) {
  const { highWaterMark } = options;

  return new stream.Transform({
    highWaterMark,
    objectMode: true,
    transform(repository, encoding, callback) {
      if (isInteresting(repository)) {
        this.push(repository);
      }
      callback();
    }
  });
}
