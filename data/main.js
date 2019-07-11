const stream = require("stream");
const util = require("util");
const usedBy = require("./streams/usedBy");
const filterInteresting = require("./streams/filterInteresting");
const downloadRepo = require("./streams/downloadRepo");
const filterUsageFiles = require("./streams/filterUsageFiles");
const filterUsageCode = require("./streams/filterUsageCode");

const pipeline = util.promisify(stream.pipeline);

main().catch(err => {
  console.error(err);
  process.exit(1);
});

async function main() {
  await pipeline(
    usedBy("mui-org", "material-ui"),
    filterInteresting(repository => repository.stars >= 0).on(
      "data",
      repository =>
        console.log(
          `interesting repository ${repository.orgName}/${repository.repoName}`
        )
    ),
    downloadRepo().on("data", ({ entry, repository }) => {
      console.log(
        `downloaded ${entry.path} in ${repository.orgName}/${
          repository.repoName
        }`
      );
    }),
    filterUsageFiles().on("data", file => {
      console.log(
        `file with mui usage: ${file.name} in ${file.repository.orgName}/${
          file.repository.repoName
        }`
      );
    }),
    filterUsageCode(),
    new stream.PassThrough({objectMode: tru})
  );

}
