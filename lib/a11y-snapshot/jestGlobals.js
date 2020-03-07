const fs = require("fs");
const path = require("path");

const globalsPath = path.join(__dirname, "globals.json");

module.exports = { read, write };

function read() {
  try {
    return JSON.parse(fs.readFileSync(globalsPath, { encoding: "utf8" }));
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

function write(globals) {
  return fs.writeFileSync(globalsPath, JSON.stringify(globals, null, 2));
}
