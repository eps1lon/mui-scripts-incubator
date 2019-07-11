const path = require("path");
const dependentRepositories = require("./streams/dependentRepositories");
const filterInteresting = require("./streams/filterInteresting");
const downloadRepo = require("./streams/downloadRepo");
const filterUsageFiles = require("./streams/filterUsageFiles");
const filterUsageCode = require("./streams/filterUsageCode");

main().catch(err => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const dataPath = path.join(__dirname, "./used-by-repositories.json");

  dependentRepositories(dataPath)
    .pipe(
      filterInteresting(repository => repository.stars > 100).on(
        "data",
        createMonitor("filterInteresting")
      )
    )
    .pipe(
      downloadRepo().on("data", ({ entry, repository }) => {
        console.log(
          `downloaded ${entry.path} in ${repository.orgName}/${
            repository.repoName
          }`
        );
      })
    )
    .pipe(
      filterUsageFiles().on("data", file => {
        console.log(
          `file with mui usage: ${file.name} in ${file.repository.orgName}/${
            file.repository.repoName
          }`
        );
      })
    )

    .pipe(filterUsageCode())
    .on("data", createMonitor("filterUsageCode"));
}

function createMonitor(name) {
  return function monitor(data) {
    console.log(`received data on ${name}: ${data.orgName}/${data.repoName}`);
    //console.log(data);
  };
}
