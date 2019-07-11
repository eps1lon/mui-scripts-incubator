const fetch = require("node-fetch");
const stream = require("stream");
const unzip = require("unzipper");

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

      fetch(url).then(response => {
        stream.pipeline(
          response.body.on("end", () => callback()),
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
          }),
          error => {
            if (error) {
              // don't know what to do with it
              console.error(error);
            }
            callback();
          }
        );
      });
    }
  });
}
