/* global __NVDA_LOG_FILE_PATH__ */
const playwright = require("playwright");
const { getDocument, queries } = require("playwright-testing-library");
const {
	awaitNvdaRecording,
	createJestSpeechRecorder,
} = require("screen-reader-testing-library");
const {
	gotoMuiPage: gotoMuiPage_actual,
	blockAds,
	blockSocials,
} = require("./mui-utils");

/**
 * @param {import('playwright').Page} page
 * @param {string} route
 * @returns {Promise<import('playwright').Page}>}
 */
async function gotoMuiPage(page, route) {
	// To prevent NVDA focus caching.
	// Also prevents skipped announcements if NVDA wasn't restarted between test runs.
	await gotoMuiPage_actual(
		page,
		`${route}?nvda-reset=${Math.random().toString(36).slice(2)}`
	);
	// Without bringing it to front the adress bar will still be focused.
	// NVDA wouldn't record any page actions
	await page.bringToFront();
	await awaitNvdaRecording();
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
		await blockSocials(page);
		await gotoMuiPage(page, "/");

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

	test.only("settings drawer", async () => {
		await blockAds(page);
		await gotoMuiPage(page, "/components/box");
		const $document = await getDocument(page);

		const $openSettingsButton = await queries.getByRole($document, "button", {
			name: "Toggle settings drawer",
		});
		expect(
			await speechRecorder.recordLines(async () => {
				await $openSettingsButton.focus();
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "banner landmark",
		    "Toggle settings drawer",
		    "button",
		  ],
		]
	`);

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.press("Enter");
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "clickable",
		    "Settings",
		    "heading",
		    "level 5",
		    " ",
		    "button",
		    " ",
		    "separator",
		    "Mode",
		    "Mode",
		    "grouping",
		    "light",
		    "toggle button",
		    "not pressed",
		    "system",
		    "toggle button",
		    "pressed",
		    "dark",
		    "toggle button",
		    "not pressed",
		    "out of grouping",
		    "Direction",
		    "Direction",
		    "grouping",
		    "light",
		    "toggle button",
		    "pressed",
		    "system",
		    "toggle button",
		    "not pressed",
		    "out of grouping",
		    "Color",
		    "Edit website colors",
		  ],
		]
	`);

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.press("Tab");
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "button",
		  ],
		]
	`);

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.press("Tab");
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "Mode",
		    "grouping",
		    "light",
		    "toggle button",
		    "not pressed",
		  ],
		]
	`);

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.press("Tab");
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "system",
		    "toggle button",
		    "pressed",
		  ],
		]
	`);

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.press("Tab");
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "dark",
		    "toggle button",
		    "not pressed",
		  ],
		]
	`);

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.press("Tab");
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "Direction",
		    "grouping",
		    "light",
		    "toggle button",
		    "pressed",
		  ],
		]
	`);

		expect(
			await speechRecorder.recordLines(async () => {
				await page.keyboard.press("Tab");
			})
		).toMatchInlineSnapshot(`
		Array [
		  Array [
		    "system",
		    "toggle button",
		    "not pressed",
		  ],
		]
	`);
	}, 30000);
});
