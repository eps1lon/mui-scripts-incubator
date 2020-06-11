const stream = require("stream");
const cheerio = require("cheerio");
const fetch = require("node-fetch");

module.exports = usedByLive;

/**
 * @typedef {object} DependentRepository
 * @property {string} orgName
 * @property {string} repoName
 * @property {number} stars
 * @property {number} forks
 */

/**
 *
 * @param {string} orgName
 * @param {string} repoName
 * @param {object} [options]
 * @param {(readable: number, writeable: number)} [options.onPressureChange]
 * @param {string} [options.packageId]
 * @returns {import('stream').Readable} chunks are {DependentRepository}
 */
function usedByLive(orgName, repoName, options = {}) {
	const { onPressureChange = () => {}, packageId = "" } = options;
	const startUrl = `https://github.com/${orgName}/${repoName}/network/dependents?package_id=${packageId}&dependent_type=REPOSITORY`;
	const allUsedBy = loadAllUsedBy(startUrl, { delay: 3000 });

	return new stream.Readable({
		objectMode: true,
		async read() {
			for await (const repository of allUsedBy) {
				const backpressure = !this.push(repository);

				onPressureChange(
					this.readableLength / this.readableHighWaterMark,
					this.writableLength / this.writableHighWaterMark
				);

				if (backpressure) {
					return;
				}
			}

			onPressureChange(
				this.readableLength / this.readableHighWaterMark,
				this.writableLength / this.writableHighWaterMark
			);

			// loop exited uninterrupted => generator at end
			this.push(null);
		},
	});
}

/**
 * Parses the static html result of the used by dependents on github e.g.
 * https://github.com/mui-org/material-ui/network/dependents?dependent_type=REPOSITORY
 * and returns a list of dependent repositories with as much meta data for those
 * repositories as possible
 *
 * TODO: This should probably be a stream as well but it's easier handling backpressure
 * by calling iterator.next() manually
 *
 * @param {string} url
 * @param {object} param1
 * @param {number} param1.delay - Delay between requests to github.com (2s caused 429)
 * @returns {DependentRepository[]}
 */
async function* loadAllUsedBy(url, { delay }) {
	let cursor = url;

	while (cursor !== null) {
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
