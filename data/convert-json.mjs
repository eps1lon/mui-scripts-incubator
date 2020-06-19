import { promises as fs } from "fs";
import * as path from "path";

main();

/**
 * Converts deep json into an array of flat objects while
 * - sorting attribute.* by their usage number
 */
async function main() {
	const inputFilename = path.resolve(process.argv[2]);
	const json = await fs.readFile(inputFilename);
	const data = JSON.parse(json);

	const flattened = [];

	const attributeCount = {};
	for (const entry of data) {
		flattened.push({
			...entry,
			attributes: undefined,
			...Object.fromEntries(
				Object.keys(entry.attributes).map((attribute) => {
					if (attributeCount[attribute] === undefined) {
						attributeCount[attribute] = 1;
					} else {
						attributeCount[attribute] += 1;
					}
					return [`$${attribute}`, entry.attributes[attribute]];
				})
			),
		});
	}
	// create a header row where the most used props come first
	const header = Object.fromEntries([
		...Object.keys(flattened[0])
			.filter((key) => !key.startsWith("$"))
			.map((key) => [key, null]),
		...Object.entries(attributeCount)
			.sort(([, a], [, b]) => b - a)
			.map(([key]) => [`$${key}`, null]),
	]);
	flattened.unshift(header);

	const flattenedJson = JSON.stringify(flattened, null, 2);

	await fs.writeFile(inputFilename + "-flattened", flattenedJson);
}
