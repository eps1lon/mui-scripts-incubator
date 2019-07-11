const fetch = require("node-fetch");
const stream = require("stream");
const unzip = require("unzipper");
const util = require("util");

const pipeline = util.promisify(stream.pipeline);

module.exports = downloadRepo;

/**
 * repository => files[]
 *
 * @param {object} [options]
 * @param {number} [options.highWaterMark]
 * @param {(readable: number, writeable: number)} [options.onPressureChange]
 */
function downloadRepo(options = {}) {
  const { highWaterMark, onPressureChange = () => {} } = options;

  return new stream.Transform({
    highWaterMark,
    objectMode: true,
    transform(repository, encoding, callback) {
      onPressureChange(
        this.readableLength / this.readableHighWaterMark,
        this.writable / this.writableHighWaterMark
      );

      const repoUrl = `https://github.com/${repository.orgName}/${
        repository.repoName
      }`;
      const url = `${repoUrl}/archive/${repository.ref}.zip`;

      fetch(url)
        .then(response => {
          return pipeline(
            response.body,
            unzip.Parse().on("entry", entry => {
              if (entry.type === "File") {
                this.push({ entry, repository });
                onPressureChange(
                  this.readableLength / this.readableHighWaterMark,
                  this.writable / this.writableHighWaterMark
                );
              } else {
                entry.autodrain();
              }
            })
          );
        })
        .then(() => callback());
    }
  });
}
