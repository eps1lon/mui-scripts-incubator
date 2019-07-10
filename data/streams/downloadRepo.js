const stream = require("stream");

module.exports = downloadRepo;

function downloadRepo() {
  return new DownloadRepo();
}

class DownloadRepo extends stream.PassThrough {}
