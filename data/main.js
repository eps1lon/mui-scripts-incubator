const fs = require("fs");
const JSONStream = require("JSONStream");
const path = require("path");
const stream = require("stream");
const util = require("util");
const usedBy = require("./streams/usedBy");
const filterInteresting = require("./streams/filterInteresting");
const downloadRepo = require("./streams/downloadRepo");
const filterUsageFiles = require("./streams/filterUsageFiles");
const filterUsageCode = require("./streams/filterUsageCode");
const usingLatestDefaultRef = require("./streams/usingLatestDefaultRef");

const pipeline = util.promisify(stream.pipeline);

main().catch(err => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const outputPath = path.resolve(process.cwd(), process.argv[2]);
  const isInterestingRepository = repository => repository.stars >= 10;

  await pipeline(
    usedBy("mui-org", "material-ui"),
    filterInteresting(isInterestingRepository).on("data", repository =>
      console.log(
        `interesting repository ${repository.orgName}/${repository.repoName}`
      )
    ),
    usingLatestDefaultRef(process.env.GITHUB_API_TOKEN),
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
    JSONStream.stringify("[\n", "\n,", "\n]\n"),
    fs.createWriteStream(outputPath)
  );
}
