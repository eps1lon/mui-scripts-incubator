/* global __NVDA_LOG_FILE_PATH__ */
const playwright = require("playwright");
const {
	awaitNvdaRecording,
	createJestSpeechRecorder,
} = require("screen-reader-testing-library");
const {
	gotoMuiPage: gotoMuiPage_actual,
	blockSocials,
} = require("./mui-utils");

/**
 * @param {import('playwright').Page} page
 * @param {string} route
 * @returns {Promise<import('playwright').Page}>}
 */
function gotoMuiPage(page, route) {
	// To prevent NVDA focus caching.
	// Also prevents skipped announcements if NVDA wasn't restarted between test runs.
	return gotoMuiPage_actual(
		page,
		`${route}?nvda-reset=${Math.random().toString(36).slice(2)}`
	);
}

describe("nvda", () => {
	const speechRecorder = createJestSpeechRecorder(__NVDA_LOG_FILE_PATH__);
	/**
	 * @type {import('playwright').Browser}
	 */
	let browser;
	/**
	 * @type {import('playwright').Page}
	 */
	let page;

	beforeAll(async () => {
		browser = await playwright.chromium.launch({ headless: false });
	});

	afterAll(async () => {
		await browser.close();
	});

	beforeEach(async () => {
		page = await browser.newPage();
	});

	afterEach(async () => {
		await page.close();
	});

	test("quick access to the docs search", async () => {
		blockSocials(page);
		await gotoMuiPage(page, "/");
		// Without bringing it to front the adress bar will still be focused.
		// NVDA wouldn't record any page actions
		await page.bringToFront();
		await awaitNvdaRecording();

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.press("s");
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "banner landmark",
		  ],
		  Array [
		    "Search",
		    "combo box",
		    "expanded",
		    "has auto complete",
		    "editable",
		    "Search…",
		  ],
		]
	`);

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.type("Rating");
			})
		).toMatchInlineSnapshot(`Array []`);

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.press("ArrowDown");
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "list",
		  ],
		  Array [
		    "Link to the result",
		    "1 of 5",
		  ],
		]
	`);
	}, 20000);
});
