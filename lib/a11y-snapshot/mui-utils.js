/* global __HOST__ */
module.exports = { blockAds, blockSocials, gotoMuiPage };

/**
 * @param {import('playwright').Page} page
 * @param {string} route
 * @returns {import('playwright').Page}
 */
async function gotoMuiPage(page, route) {
	await page.goto(`${__HOST__}${route}`, { waitUntil: "domcontentloaded" });
	// we wait for a React.lazy component which is mounted in a useEffect
	// at this point we definitely hydrated
	await page.waitForSelector("#docsearch-input");

	console.log(
		"waiting for %d lazy elements",
		(await page.$$("[aria-busy]")).length
	);
	// demo toolbars are deferred with React.lazy and use a aria-busy skeleton.
	await page.waitForFunction(() => {
		// eslint-disable-next-line no-undef -- document function
		return document.querySelector('[aria-busy="true"]') === null;
	});
	// If the above, generic approach doesn't work try an approach tailored to our toolbars:
	// await page.waitForSelector('[role="toolbar"][aria-label="demo source"] *', {
	// 	state: "attached",
	// });
	console.log(
		"%d lazy elements remaining",
		(await page.$$("[aria-busy]")).length
	);

	return page;
}

/**
 * @param {import('playwright').Page} page
 */
function blockAds(page) {
	return Promise.all(
		[
			"https://codefund.io/**",
			"https://cd2n.codefund.io/**",
			"https://cdn.carbonads.com/**",
		].map((url) => {
			return page.route(url, (route) => {
				route.abort();
			});
		})
	);
}

/**
 * @param {import('playwright').Page} page
 */
function blockSocials(page) {
	return Promise.all(
		["https://platform.twitter.com/**", "https://buttons.github.io/**"].map(
			(url) => {
				return page.route(url, (route) => {
					route.abort();
				});
			}
		)
	);
}
