const stream = require("stream");

module.exports = filterUsageCode;

function filterUsageCode() {
  return new stream.Transform({
    objectMode: true,
    transform(file, encoding, callback) {
      this.push(file);
      callback();
    }
  });
}
