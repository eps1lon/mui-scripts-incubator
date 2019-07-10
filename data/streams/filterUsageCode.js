const stream = require("stream");

module.exports = filterUsageCode;

function filterUsageCode() {
  return new FilterUsageCode();
}

class FilterUsageCode extends stream.PassThrough {
  constructor(options) {
    super({ ...options, objectMode: true });
  }
}
