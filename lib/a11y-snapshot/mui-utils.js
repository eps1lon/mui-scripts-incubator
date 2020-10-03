/* global __HOST__ */
module.exports = { blockAds, blockSocials, gotoMuiPage };

/**
 *
 * @param {import('playwright').BrowserContext} context
 * @param {*} route
 * @returns {Promise<import('playwright').Page>}
 */
async function gotoMuiPage(page, route) {
	await page.goto(`${__HOST__}${route}`, { waitUntil: "domcontentloaded" });
	// we wait for a React.lazy component which is mounted in a useEffect
	// at this point we definitely hydrated
	await page.waitForSelector("#docsearch-input");
	return page;
}

/**
 * @param {import('playwright').Page} page
 */
function blockAds(page) {
	[
		"https://codefund.io/**",
		"https://cd2n.codefund.io/**",
		"https://cdn.carbonads.com/**",
	].forEach((url) => {
		page.route(url, (route) => {
			route.abort();
		});
	});
}

/**
 * @param {import('playwright').Page} page
 */
function blockSocials(page) {
	["https://platform.twitter.com/**", "https://buttons.github.io/**"].forEach(
		(url) => {
			page.route(url, (route) => {
				route.abort();
			});
		}
	);
}
