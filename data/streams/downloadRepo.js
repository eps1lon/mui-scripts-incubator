const fetch = require("node-fetch");
const stream = require("stream");
const unzip = require("unzipper");

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
        stream
          .pipeline(response.body, unzip.Parse(), error => {
            if (error) {
              // don't know what to do with it
              console.error(error);
            }
            callback();
          })
          .on("entry", entry => {
            if (entry.type === "File") {
              this.push({ entry, repository });
            } else {
              entry.autodrain();
            }
          });
      });
    }
  });
}
