const stream = require("stream");

module.exports = filterInteresting;

function filterInteresting(isInteresting) {
  return new stream.Transform({
    objectMode: true,
    transform(repository, encoding, callback) {
      if (isInteresting(repository)) {
        this.push(repository);
      }
      callback();
    }
  });
}
