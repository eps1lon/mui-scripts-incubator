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

	beforeAll(async () => {
		browser = await playwright.chromium.launch({ headless: false });
	});

	afterAll(async () => {
		await browser.close();
	});

	test("quick access to the docs search", async () => {
		const page = await browser.newPage();
		await blockSocials(page);
		await gotoMuiPage(page, "/");

		await expect(async () => {
			await page.keyboard.press("Control+k");
		}).toMatchSpeechInlineSnapshot(`
					"landmark"
					"Search, combo box, expanded, has auto complete, editable, Search…, blank"
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
		const page = await browser.newPage();
		await blockAds(page);
		await gotoMuiPage(page, "/components/box");
		const $document = await getDocument(page);

		const $openSettingsButton = await queries.getByRole($document, "button", {
			name: "Toggle settings drawer",
		});
		await expect(async () => {
			await $openSettingsButton.focus();
		}).toMatchSpeechInlineSnapshot(
			`"clickable, landmark, Toggle settings drawer, button"`
		);

		await expect(async () => {
			await page.keyboard.press("Enter");
		}).toMatchSpeechInlineSnapshot(``);

		await expect(async () => {
			await page.keyboard.press("Tab");
		}).toMatchSpeechInlineSnapshot(`"clickable, button"`);

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
		test("keyboard navigation when horizontal", async () => {
			const page = await browser.newPage();
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
				page.keyboard.press("ArrowUp");
			}).toMatchSpeechInlineSnapshot(`"32"`);

			await expect(async () => {
				page.keyboard.press("ArrowDown");
			}).toMatchSpeechInlineSnapshot(`"31"`);

			await expect(async () => {
				page.keyboard.press("End");
			}).toMatchSpeechInlineSnapshot(`"100"`);

			await expect(async () => {
				page.keyboard.press("Home");
			}).toMatchSpeechInlineSnapshot(`"0"`);
		}, 30000);

		test("keyboard navigation when vertical", async () => {
			const page = await browser.newPage();
			await blockAds(page);
			await gotoMuiPage(page, "/components/slider");
			const $document = await getDocument(page);

			const [$slider] = await queries
				// getAllByRole('slider')
				// 	.filter(element => element.getAttribute('aria-orientation') === "vertical")
				.getAllByRole($document, "slider")
				.then((sliderHandles) => {
					return Promise.all(
						sliderHandles.map(async ($slider) => {
							const ariaOrientation = await $slider.getAttribute(
								"aria-orientation"
							);
							if (ariaOrientation === "vertical") {
								return $slider;
							}
							return null;
						})
					).then((handles) => {
						return handles.filter((handle) => {
							return handle !== null;
						});
					});
				});

			await expect(async () => {
				await $slider.focus();
			}).toMatchSpeechInlineSnapshot(`
						"main landmark"
						"Temperature, slider, 30°C"
					`);

			await expect(async () => {
				page.keyboard.press("ArrowRight");
			}).toMatchSpeechInlineSnapshot(`"31°C"`);

			await expect(async () => {
				page.keyboard.press("ArrowRight");
			}).toMatchSpeechInlineSnapshot(`"32°C"`);

			await expect(async () => {
				page.keyboard.press("ArrowLeft");
			}).toMatchSpeechInlineSnapshot(`"31°C"`);

			await expect(async () => {
				page.keyboard.press("ArrowUp");
			}).toMatchSpeechInlineSnapshot(`"32°C"`);

			await expect(async () => {
				page.keyboard.press("ArrowDown");
			}).toMatchSpeechInlineSnapshot(`"31°C"`);

			await expect(async () => {
				page.keyboard.press("End");
			}).toMatchSpeechInlineSnapshot(`"100°C"`);

			await expect(async () => {
				page.keyboard.press("Home");
			}).toMatchSpeechInlineSnapshot(`"0°C"`);
		}, 30000);
	});

	describe("TimePicker", () => {
		test("keyboard navigation for desktop variant", async () => {
			const page = await browser.newPage();
			await blockAds(page);
			await gotoMuiPage(page, "/components/time-picker");

			const [desktopTimePickerOpenTrigger] = await page.$$(
				'#ResponsiveTimePickers + div button[aria-label*="Choose time"]'
			);

			await expect(() =>
				desktopTimePickerOpenTrigger.focus()
			).toMatchSpeechInlineSnapshot(
				`"clickable, main landmark, Choose time, selected time is 12:00 AM, button"`
			);

			await expect(() => page.keyboard.press("Enter"))
				.toMatchSpeechInlineSnapshot(`
						"dialog"
						"Select hours. Selected time is 12:00 AM, list"
						"dialog"
						"Select hours. Selected time is 12:00 AM, list"
						"12 hours, 12 of 12"
					`);

			await expect(() =>
				page.keyboard.press("ArrowUp")
			).toMatchSpeechInlineSnapshot(`"1 hours, 1 of 12"`);

			await expect(() =>
				page.keyboard.press("ArrowDown")
			).toMatchSpeechInlineSnapshot(`"12 hours, 12 of 12"`);

			await expect(() =>
				page.keyboard.press("End")
			).toMatchSpeechInlineSnapshot(`"11 hours, 11 of 12"`);

			await expect(() =>
				page.keyboard.press("Home")
			).toMatchSpeechInlineSnapshot(`"12 hours, 12 of 12"`);

			await expect(() =>
				page.keyboard.press("Escape")
			).toMatchSpeechInlineSnapshot(
				`"clickable, main landmark, button, Choose time, selected time is 12:00 AM"`
			);
		});
	});
});
