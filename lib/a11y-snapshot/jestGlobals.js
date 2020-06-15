const fs = require("fs");
const path = require("path");

const globalsPath = path.join(__dirname, "globals.json");

module.exports = { read, write };

function read() {
	try {
		return JSON.parse(fs.readFileSync(globalsPath, { encoding: "utf8" }));
	} catch (error) {
		return {
			// netlify default branch: https://material-ui.netlify.app
			// GitHub default branch: https://next--material-ui.netlify.app
			__HOST__: "https://next--material-ui.netlify.app",
		};
	}
}

function write(globals) {
	return fs.writeFileSync(globalsPath, JSON.stringify(globals, null, 2));
}
