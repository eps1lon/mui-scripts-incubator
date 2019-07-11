const fetch = require("node-fetch");
const stream = require("stream");
const unzip = require("node-unzip-2");

module.exports = downloadRepo;

function downloadRepo() {
  return new stream.Transform({
    objectMode: true,
    transform(repository, encoding, callback) {
      const repoUrl = `https://github.com/${repository.orgName}/${
        repository.repoName
      }`;
      const url = `${repoUrl}/archive/master.zip`;

      fetch(url).then(response => {
        const unzipping = response.body.pipe(unzip.Parse());
        unzipping.on("entry", entry => {
          if (entry.type === "File") {
            this.push({ entry, repository });
          } else {
            entry.autodrain();
          }
        });
        response.body.on("end", () => {
          callback();
        });
      });
    }
  });
}
