const stream = require("stream");

module.exports = filterUsageFiles;

function filterUsageFiles() {
  return new FilterUsageFiles();
}

class FilterUsageFiles extends stream.PassThrough {
  constructor(options) {
    super({ ...options, objectMode: true });
  }
}
