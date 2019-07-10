const fs = require("fs");
const JSONStream = require("JSONStream");

module.exports = dependentRepositories;

function dependentRepositories(dataPath) {
  const fileReadStream = fs.createReadStream(dataPath, { encoding: "utf8" });

  return fileReadStream.pipe(JSONStream.parse());
}
