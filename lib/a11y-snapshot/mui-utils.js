const url = require("url");

/* global __HOST__ */
module.exports = {
	blockAds,
	blockSocials,
	gotoMuiPage,
	runWithRequestDiagnostics,
};

/**
 * @param {import('playwright').Page} page
 * @param {string} route
 */
async function gotoMuiPage(page, route) {
	const pageUrl = new url.URL(route, __HOST__);
	await page.goto(pageUrl.toString(), { waitUntil: "domcontentloaded" });
	// we wait for a React.lazy component which is mounted in a useEffect
	// at this point we definitely hydrated
	try {
		await page.waitForSelector("#docsearch-input", { timeout: 1000 });
	} catch (error) {
		// retry once
		await page.goto(page.url());
		await page.waitForSelector("#docsearch-input", { timeout: 1000 });
	}

	// demo toolbars are deferred with React.lazy and use a aria-busy skeleton.
	await page.waitForFunction(
		() => {
			// eslint-disable-next-line no-undef -- document function
			return document.querySelector('[aria-busy="true"]') === null;
		},
		{ timeout: 1000 }
	);
	// If the above, generic approach doesn't work try an approach tailored to our toolbars:
	// await page.waitForSelector('[role="toolbar"][aria-label="demo source"] *', {
	// 	state: "attached",
	// });
}

/**
 * Runs the callback and logs diagnostics about network request if the callback throws
 *
 * @template T
 * @param {import('playwright').Page} page
 * @param {() => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function runWithRequestDiagnostics(page, callback) {
	const requests = {
		pending: [],
		failed: [],
		finished: [],
	};
	page.on("request", (request) => {
		requests.pending.push(request.url());
	});
	page.on("requestfailed", (request) => {
		const requestIndex = requests.pending.indexOf(request.url());
		if (requestIndex === -1) {
			console.warn(
				`failed request '${request.url}' that wasn't registered as pending`
			);
		} else {
			requests.pending.splice(requestIndex, 1);
		}
		requests.failed.push({ url: request.url(), failure: request.failure() });
	});
	page.on("requestfinished", (request) => {
		const requestIndex = requests.pending.indexOf(request.url());
		if (requestIndex === -1) {
			console.warn(
				`failed request '${request.url}' that wasn't registered as pending`
			);
		} else {
			requests.pending.splice(requestIndex, 1);
		}
		requests.finished.push(request.url());
	});
	try {
		return await callback();
	} catch (error) {
		console.log(requests.pending);
		console.log(requests.failed);
		throw error;
	}
}

/**
 * @param {import('playwright').Page} page
 */
async function blockAds(page) {
	await Promise.all(
		[
			"https://codefund.io/**",
			"https://cd2n.codefund.io/**",
			"https://cdn.carbonads.com/**",
		].map((url) => {
			return page.route(url, async (route) => {
				await route.abort();
			});
		})
	);
}

/**
 * @param {import('playwright').Page} page
 */
async function blockSocials(page) {
	await Promise.all(
		["https://platform.twitter.com/**", "https://buttons.github.io/**"].map(
			(url) => {
				return page.route(url, async (route) => {
					await route.abort();
				});
			}
		)
	);
}
