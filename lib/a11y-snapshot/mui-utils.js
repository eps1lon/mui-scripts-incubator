const url = require("url");

/* global __HOST__ */
module.exports = {
	blockAds,
	blockSocials,
	gotoMuiPage,
	runWithRequestDiagnostics,
};

async function waitForMuiLazyHydration(page, timeout) {
	await Promise.all([
		// we wait for a React.lazy component which is mounted in a useEffect
		// at this point we definitely hydrated
		page.waitForSelector("button:text('Search…')", { timeout }),
		// demo toolbars are deferred with React.lazy and use a aria-busy skeleton.
		page.waitForFunction(
			() => {
				// eslint-disable-next-line no-undef -- document function
				return document.querySelector('[aria-busy="true"]') === null;
			},
			{ timeout }
		),
		// If the above, generic approach doesn't work try an approach tailored to our toolbars:
		// await page.waitForSelector('[role="toolbar"][aria-label="demo source"] *', {
		// 	state: "attached",
		// });
	]);
}

/**
 * @param {import('playwright').Page} page
 * @param {number} timeout
 * @param {string[]} alreadyPending
 * @returns {Promise<void>}
 */
async function waitForNetworkIdle(page, timeout, alreadyPending) {
	const requestsPending = alreadyPending.slice();

	function handleRequest(request) {
		requestsPending.push(request.url());
	}
	function handleRequestSettled(request) {
		const requestIndex = requestsPending.indexOf(request.url());
		if (requestIndex === -1) {
			console.warn(
				`settled a request '${request.url}' that wasn't registered as pending`
			);
		} else {
			requestsPending.splice(requestIndex, 1);
		}
	}

	page.addListener("request", handleRequest);
	page.addListener("requestfailed", handleRequestSettled);
	page.addListener("requestfinished", handleRequestSettled);

	const idle = new Promise((resolve) => {
		const intervalId = setInterval(() => {
			if (requestsPending.length === 0) {
				clearInterval(intervalId);
				resolve();
			}
		}, 500);
	});

	const timedOut = new Promise((resolve, reject) => {
		setTimeout(() => {
			reject(new Error("networkidle timed out"));
		}, timeout);
	});

	try {
		await Promise.race([idle, timedOut]);
	} finally {
		page.removeListener("request", handleRequest);
		page.removeListener("requestfailed", handleRequestSettled);
		page.removeListener("requestfinished", handleRequestSettled);
	}
}

/**
 * @param {import('playwright').Page} page
 * @param {string} route
 */
async function gotoMuiPage(page, route) {
	const pageUrl = new url.URL(route, __HOST__);

	const pendingRequests = [];
	page.on("request", (request) => pendingRequests.push(request.url()));

	await page.goto(pageUrl.toString(), { waitUntil: "domcontentloaded" });

	try {
		// wait for 10s for either lazy-hydration or networkidle
		const pageState = await Promise.any([
			waitForNetworkIdle(page, 10000, pendingRequests).then(
				() => "networkidle"
			),
			waitForMuiLazyHydration(page, 10000).then(() => "lazy-hydrated"),
		]);
		// if the network is idle then there's no reason for lazy-hydration to take longer than 1s
		if (pageState === "networkidle") {
			await waitForMuiLazyHydration(page, 1000);
		}
	} catch (error) {
		pendingRequests.length = 0;
		await page.goto(page.url(), { waitUntil: "domcontentloaded" });
		// retry once
		// wait for 10s for either lazy-hydration or networkidle
		const pageState = await Promise.any([
			waitForNetworkIdle(page, 10000, pendingRequests).then(
				() => "networkidle"
			),
			waitForMuiLazyHydration(page, 10000).then(() => "lazy-hydrated"),
		]);
		// if the network is idle then there's no reason for lazy-hydration to take longer than 1s
		if (pageState === "networkidle") {
			await waitForMuiLazyHydration(page, 1000);
		}
	}
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
