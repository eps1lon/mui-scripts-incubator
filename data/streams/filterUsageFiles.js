const stream = require("stream");

module.exports = filterUsageFiles;

function filterUsageFiles() {
  return new stream.Transform({
    objectMode: true,
    transform({ entry, repository }, encoding, callback) {
      if (/\.(jsx?|tsx?)$/.test(entry.path)) {
        readTextEntry(entry).then(source => {
          const fileName = entry.path.replace(
            `${repository.repoName}-master/`,
            ""
          );

          if (source.indexOf("@material-ui")) {
            this.push({ name: fileName, repository, source });
          }
          callback();
          entry.autodrain();
        });
      } else {
        entry.autodrain();
        callback();
      }
    }
  });
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
