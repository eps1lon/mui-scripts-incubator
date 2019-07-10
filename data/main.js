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
    .pipe(filterInteresting())
    .on("data", createMonitor("filterInteresting"))
    .pipe(downloadRepo())
    .on("data", createMonitor("downloadRepo"))
    .pipe(filterUsageFiles())
    .on("data", createMonitor("filterUsageFiles"))
    .pipe(filterUsageCode())
    .on("data", createMonitor("filterUsageCode"));
}

function createMonitor(name) {
  return function monitor(data) {
    console.log(`received data on ${name}: ${typeof data}`);
    //console.log(data);
  };
}
