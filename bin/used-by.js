#!/usr/bin/env node
/* eslint-disable no-console */
const cheerio = require("cheerio");
const fs = require("fs");
const JSONStream = require("JSONStream");
const fetch = require("node-fetch");
const path = require("path");
const yargs = require("yargs");

yargs
	.command({
		command: "$0 outputPath [repository]",
		describe: "creates JSON file containing all dependend repositories",
		builder: (command) => {
			return command
				.positional("outputPath", {
					describe: "path to the file that should be written",
					type: "string",
				})
				.positional("repository", {
					describe: "repository to use",
					type: "string",
					default: "mui-org/material-ui",
				})
				.option("packageId", {
					// @material-ui/core
					default: "UGFja2FnZS00NTUzMzAxNTM%3D",
					describe:
						"For repositories with multiple packages. Omit for using the default package.",
					type: "string",
				})
				.option("delay", {
					default: 500,
					describe: "Delay in milliseconds between each request to github.com",
					type: "number",
				});
		},
		handler: (argv) => {
			const { delay, outputPath, packageId, repository } = argv;
			const [owner, name] = repository.split("/");

			main({
				delay,
				name,
				owner,
				packageId,
				outputPath: path.resolve(outputPath),
			});
		},
	})
	.help()
	.strict(true)
	.version(false)
	.parse();

async function main({ delay, owner, name, outputPath, packageId }) {
	const outputStream = JSONStream.stringify("[\n", "\n,", "\n]\n");
	outputStream.pipe(fs.createWriteStream(outputPath));

	const startUrl = `https://github.com/${owner}/${name}/network/dependents?package_id=${packageId}`;

	for await (const result of getResult(startUrl, { delay })) {
		outputStream.write(result);
	}

	outputStream.end();
}

async function* getResult(url, { delay }) {
	let cursor = url;

	while (cursor !== null) {
		console.log(`fetching ${cursor}`);
		const response = await fetch(cursor);
		const body = await response.text();
		const $ = cheerio.load(body);

		const items = $("#dependents .Box .flex-items-center").get();
		for (const item of items) {
			const $item = $(item);

			const $links = $item.find("span a");
			if ($links.length !== 2) {
				yield { error: "not enough links" };
			} else {
				// $links.map() throws on second pass
				const [orgName, repoName] = $links.get().map((link) => {
					return $(link).text();
				});
				const [, stars, forks] = $item
					.find("div > span")
					.get()
					.map((element) => {
						return +$(element).text().trim();
					});

				yield { orgName, repoName, stars, forks };
			}
		}

		const paginationLinks = $(".paginate-container a").get();
		const nextLink = paginationLinks.find(
			(link) => $(link).text().trim().toLowerCase() === "next"
		);
		cursor = nextLink === undefined ? null : $(nextLink).attr("href");

		await sleep(delay);
	}

	return;
}

function sleep(timeout) {
	return new Promise((resolve) => {
		setTimeout(() => resolve(), timeout);
	});
}
