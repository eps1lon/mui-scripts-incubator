const stream = require("stream");

module.exports = filterInteresting;

function filterInteresting() {
  return new FilterInteresting();
}

class FilterInteresting extends stream.PassThrough {
  constructor(options) {
    super({ ...options, objectMode: true });
  }
}
