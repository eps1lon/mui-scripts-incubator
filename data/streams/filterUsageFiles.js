const stream = require("stream");

module.exports = filterUsageFiles;

/**
 *
 * @param {object} [options]
 * @param {number} [options.highWaterMark]
 * @param {(readable: number, writeable: number)} [options.onPressureChange]
 */
function filterUsageFiles(options = {}) {
  const { highWaterMark, onPressureChange = () => {} } = options;

  return new stream.Transform({
    highWaterMark,
    objectMode: true,
    transform({ entry, repository }, encoding, callback) {
      onPressureChange(
        this.readableLength / this.readableHighWaterMark,
        this.writable / this.writableHighWaterMark
      );

      // some people actually have their node modules in source control
      if (isPossiblyJs(entry) && !isNodeModule(entry)) {
        readTextEntry(entry).then(source => {
          const fileName = entry.path.replace(
            `${repository.repoName}-${repository.ref}/`,
            ""
          );

          if (source.indexOf("@material-ui")) {
            this.push({ name: fileName, repository, source });
          }

          onPressureChange(
            this.readableLength / this.readableHighWaterMark,
            this.writable / this.writableHighWaterMark
          );
          callback();
        });
      } else {
        entry.autodrain();
        callback();
      }
    }
  });
}

/**
 *
 * @param {{path: string}} entry
 */
function isPossiblyJs(entry) {
  return /\.(jsx?|tsx?)$/.test(entry.path);
}

/**
 *
 * @param {{path:string}} entry
 */
function isNodeModule(entry) {
  return /\/node_modules\//.test(entry.path);
}

function readTextEntry(entry) {
  return new Promise((resolve, reject) => {
    let content = "";
    entry.setEncoding("utf8");

    entry.on("data", chunk => {
      content += chunk;
    });

    entry.on("end", () => resolve(content));

    entry.on("error", error => reject(error));
  });
}
