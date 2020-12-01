const playwright = require("playwright");
const { blockAds, blockSocials, gotoMuiPage } = require("./mui-utils");

/**
 * @param {import('playwright').Page} page
 */
function axeRun(page) {
	return page.evaluate(() => {
		/**
		 * @type {typeof import('axe-core')}
		 */
		const axe =
			// eslint-disable-next-line no-undef -- it's defined in the context where `playwright` runs it.
			window.axe;

		return axe.run({
			exclude: [
				// Exclude https://github.com/mui-org/material-ui/blob/aabdcaf3dcb73f2aeecb6b629e1ad675e6776ce1/docs/src/modules/components/Ad.js#L223-L230
				['[data-ga-event-category="ad"]'],
			],
		});
	});
}

describe.each(["chromium"])("%s", (browserType) => {
	/**
	 * @type {import('playwright').Browser}
	 */
	let browser;
	/**
	 * @type {import('playwright').Page}
	 */
	let page;

	beforeAll(async () => {
		browser = await playwright[browserType].launch();
	});

	afterAll(async () => {
		await browser.close();
	});

	beforeEach(async () => {
		page = await browser.newPage();
		await page.addInitScript({
			path: require.resolve("axe-core"),
		});
	});

	afterEach(async () => {
		await page.close();
	});

	it("/", async () => {
		blockSocials(page);
		await gotoMuiPage(page, "/");

		await expect(axeRun(page)).resolves.toMatchAxeSnapshot();
	});

	// markdowndocs
	it.each([
		"/api/button/",
		"/api/select/",
		"/components/breadcrumbs",
		"/components/buttons/",
		"/components/button-group/",
		"/components/checkboxes/",
		"/components/dialogs/",
		"/components/pickers",
		"/components/radio-buttons",
		"/components/selects/",
		"/components/slider",
		"/components/switches/",
		"/components/tabs/",
		"/components/text-fields/",
		"/components/tooltips/",
		"/components/transfer-list",
		// lab
		"/components/pagination/",
		"/components/rating/",
		"/components/tree-view/",
	])(`%s`, async (docsRoute) => {
		blockAds(page);
		await gotoMuiPage(page, docsRoute);

		await expect(axeRun(page)).resolves.toMatchAxeSnapshot();
	});
});
