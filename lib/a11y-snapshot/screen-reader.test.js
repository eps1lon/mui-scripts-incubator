const playwright = require("playwright");
const { getDocument, queries } = require("playwright-testing-library");
const { awaitNvdaRecording } = require("screen-reader-testing-library");
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

		await expect(async () => {
			await page.keyboard.press("s");
		}).toMatchSpeechInlineSnapshot(`
					"banner landmark"
					"Search, combo box, expanded, has auto complete, editable, Search…"
				`);

		await expect(async () => {
			await page.keyboard.type("Rating");
		}).toMatchSpeechInlineSnapshot(``);

		await expect(async () => {
			await page.keyboard.press("ArrowDown");
		}).toMatchSpeechInlineSnapshot(`
					"list"
					"Link to the result, 1 of 5"
				`);
	}, 20000);

	test("settings drawer", async () => {
		await blockAds(page);
		await gotoMuiPage(page, "/components/box");
		const $document = await getDocument(page);

		const $openSettingsButton = await queries.getByRole($document, "button", {
			name: "Toggle settings drawer",
		});
		await expect(async () => {
			await $openSettingsButton.focus();
		}).toMatchSpeechInlineSnapshot(
			`"banner landmark, Toggle settings drawer, button"`
		);

		await expect(async () => {
			await page.keyboard.press("Enter");
		}).toMatchSpeechInlineSnapshot(
			`"clickable, Settings, heading, level 5,  , button,  , separator, Mode, Mode, grouping, light, toggle button, not pressed, system, toggle button, pressed, dark, toggle button, not pressed, out of grouping, Direction, Direction, grouping, light, toggle button, pressed, system, toggle button, not pressed, out of grouping, Color, Edit website colors"`
		);

		await expect(async () => {
			await page.keyboard.press("Tab");
		}).toMatchSpeechInlineSnapshot(`"button"`);

		await expect(async () => {
			await page.keyboard.press("Tab");
		}).toMatchSpeechInlineSnapshot(
			`"Mode, grouping, light, toggle button, not pressed"`
		);

		await expect(async () => {
			await page.keyboard.press("Tab");
		}).toMatchSpeechInlineSnapshot(`"system, toggle button, pressed"`);

		await expect(async () => {
			await page.keyboard.press("Tab");
		}).toMatchSpeechInlineSnapshot(`"dark, toggle button, not pressed"`);

		await expect(async () => {
			await page.keyboard.press("Tab");
		}).toMatchSpeechInlineSnapshot(
			`"Direction, grouping, light, toggle button, pressed"`
		);

		await expect(async () => {
			await page.keyboard.press("Tab");
		}).toMatchSpeechInlineSnapshot(`"system, toggle button, not pressed"`);
	}, 30000);

	describe("Slider", () => {
		test("keyboard navigation", async () => {
			await blockAds(page);
			await gotoMuiPage(page, "/components/slider");
			const $document = await getDocument(page);

			const [$slider] = await queries.getAllByRole($document, "slider", {
				name: "Volume",
			});

			await expect(async () => {
				await $slider.focus();
			}).toMatchSpeechInlineSnapshot(`
						"main landmark"
						"Volume, slider, 30"
					`);

			await expect(async () => {
				page.keyboard.press("ArrowRight");
			}).toMatchSpeechInlineSnapshot(`"31"`);

			await expect(async () => {
				page.keyboard.press("ArrowRight");
			}).toMatchSpeechInlineSnapshot(`"32"`);

			await expect(async () => {
				page.keyboard.press("ArrowLeft");
			}).toMatchSpeechInlineSnapshot(`"31"`);

			await expect(async () => {
				page.keyboard.press("End");
			}).toMatchSpeechInlineSnapshot(`"100"`);

			await expect(async () => {
				page.keyboard.press("Home");
			}).toMatchSpeechInlineSnapshot(`"0"`);
		});
	});
});
