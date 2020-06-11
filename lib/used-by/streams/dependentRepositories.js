const fs = require("fs");
const JSONStream = require("JSONStream");
const stream = require("stream");

module.exports = dependentRepositories;

function dependentRepositories(dataPath) {
	const fileReadStream = fs.createReadStream(dataPath, { encoding: "utf8" });

	return fileReadStream.pipe(JSONStream.parse()).pipe(arrayToSingleStream());
}

function arrayToSingleStream() {
	return new stream.Transform({
		objectMode: true,
		transform(repositories, encoding, callback) {
			repositories.forEach((repository) => this.push(repository));
			callback();
		},
	});
}
