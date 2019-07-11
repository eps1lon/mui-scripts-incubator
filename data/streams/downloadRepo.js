const fetch = require("node-fetch");
const stream = require("stream");
const util = require("util");
const yauzl = require("yauzl");

const zipFileFromBuffer = util.promisify(yauzl.fromBuffer);

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
          return response.buffer();
        })
        .then(buffer => {
          return zipFileFromBuffer(buffer);
        })
        .then(zipFile => {
          zipFile.on("entry", entry => {
            const isFile = !entry.fileName.endsWith("/");
            if (isFile) {
              zipFile.openReadStream(entry, (error, readStream) => {
                if (error) throw error;

                streamIntoBuffer(readStream).then(buffer => {
                  onPressureChange(
                    this.readableLength / this.readableHighWaterMark,
                    this.writable / this.writableHighWaterMark
                  );
                  this.push({
                    path: entry.fileName,
                    source: buffer.toString("utf8"),
                    repository
                  });
                });
              });
            }
          });
          zipFile.on("end", () => {
            onPressureChange(
              this.readableLength / this.readableHighWaterMark,
              this.writable / this.writableHighWaterMark
            );
            callback();
          });
        });
    }
  });
}

/**
 * https://stackoverflow.com/a/14269536/3406963
 * @param {import('stream').Readable} stream
 * @returns {Promise<Buffer>}
 */
function streamIntoBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", chunk => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", error => reject(error));
  });
}
