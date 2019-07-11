const stream = require("stream");

module.exports = filterUsageCode;

function filterUsageCode() {
  return new stream.Transform({
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
