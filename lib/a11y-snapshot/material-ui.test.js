/* global __HOST__ */
const playwright = require("playwright");

describe.each(["chromium", "firefox"])("%s", (browserType) => {
	/**
	 * @type {import('playwright').Browser}
	 */
	let browser;

	beforeAll(async () => {
		browser = await playwright[browserType].launch();
	});

	afterAll(async () => {
		await browser.close();
	});

	it("/", async () => {
		const page = await browser.newPage();
		["https://platform.twitter.com/**", "https://buttons.github.io/**"].forEach(
			(url) => {
				page.route(url, (route) => {
					route.abort();
				});
			}
		);
		await gotoMuiPage(page, "/");
		const tree = await page.accessibility.snapshot();

		expect(
			pruneA11yTree(tree, {
				makeStableNode: (node, index, siblings) => {
					// is praise quote?
					const heading = siblings
						.slice(0, index)
						.reverse()
						.find((sibling) => {
							return sibling.role === "heading";
						});
					if (
						heading !== undefined &&
						heading.name === "Praise for Material-UI" &&
						node.role === "link"
					) {
						return {
							...node,
							children: [],
							name: "a random quote about Material-UI",
						};
					}

					const previous = siblings[index - 1];

					if (
						previous !== undefined &&
						previous.name === "Get Professional Support"
					) {
						return {
							...node,
							name: "random sponsor",
						};
					}

					// is quick word?
					if (
						previous !== undefined &&
						previous.name === "A quick word from our sponsors:"
					) {
						return {
							...node,
							name: "a random quick word",
						};
					}

					return node;
				},
			})
		).toMatchSnapshot();
	});

	// markdowndocs
	it.each([
		"/api/buttons/",
		"/api/selects/",
		"/components/breadcrumbs",
		"/components/buttons/",
		"/components/button-group/",
		"/components/checkboxes/",
		"/components/dialogs/",
		"/components/pickers",
		"/components/radio-buttons",
		"/components/selects/",
		"/components/slider",
		"/components/switch/",
		"/components/tabs/",
		"/components/text-fields/",
		"/components/tooltips/",
		"/components/transfer-list",
		// lab
		"/components/pagination/",
		"/components/rating/",
		"/components/tree-view/",
	])("%s", async () => {
		const page = await browser.newPage();
		[
			"https://codefund.io/**",
			"https://cd2n.codefund.io/**",
			"https://cdn.carbonads.com/**",
		].forEach((url) => {
			page.route(url, (route) => {
				route.abort();
			});
		});
		await gotoMuiPage(page, "/components/selects/");
		const main = await page.$("main");
		const tree = await page.accessibility.snapshot({ root: main });

		expect(
			pruneA11yTree(tree, {
				makeStableNode: (node, index, siblings) => {
					const next = siblings[index + 1];
					// ad link between h1 and h2
					if (
						node.role === "link" &&
						next !== undefined &&
						next.role === "link" &&
						next.name === "ad by Material-UI"
					) {
						return null;
					}

					if (node.name === "ad by Material-UI") {
						return null;
					}

					return node;
				},
			})
		).toMatchSnapshot();
	});
});

/**
 *
 * @param {import('playwright').BrowserContext} context
 * @param {*} route
 * @returns {import('playwright').Page}
 */
async function gotoMuiPage(page, route) {
	await page.goto(`${__HOST__}${route}`, { waitUntil: "domcontentloaded" });
	// we wait for a React.lazy component which is mounted in a useEffect
	// at this point we definitely hydrated
	await page.waitForSelector("#docsearch-input");
	return page;
}

/**
 *
 * @param {import('puppeteer').AXNode} left
 * @param {import('puppeteer').AXNode} right
 * @returns {boolean} - true if only both are text nodes and only their text content is different
 */
function textNodesOnlyDifferInText(left, right) {
	if (
		(left.role === "text" && right.role === "text") ||
		(left.role === "text leaf" && right.role === "text leaf")
	) {
		// I don't know if role: "text" has other properties that might be different
		// so I'm prematurely checking
		const keysOfDifferentValues = Array.from(
			new Set([...Object.keys(left), ...Object.keys(right)])
		).filter((key) => left[key] !== right[key]);

		// for text roles the accessible name is the content
		return (
			keysOfDifferentValues.length === 1 && keysOfDifferentValues[0] === "name"
		);
	}
	return false;
}

/**
 * prune axNode by
 * - squashing neighbouring text nodes otherwise there's a lot of noise in code blocks
 * @param {import('puppeteer').AXNode} axNode
 * @param {object} options
 * @param {(node: import('puppeteer').AXNode) => import('puppeteer').AXNode | null} makeStableNode - return `null` to remove the node
 */
function pruneA11yTree(axNode, options) {
	const { makeStableNode } = options;
	const { children, ...other } = axNode;
	if (children === undefined) {
		return axNode;
	}

	const squashedChildren = [];
	for (const child of children) {
		const previous = squashedChildren[squashedChildren.length - 1];
		if (previous !== undefined && textNodesOnlyDifferInText(previous, child)) {
			const start = squashedChildren.length - 1;
			const deleteCount = 1;
			const item = {
				...previous,
				name: previous.name + child.name,
			};
			squashedChildren.splice(start, deleteCount, item);
		} else {
			squashedChildren.push(pruneA11yTree(child, options));
		}
	}

	return {
		...other,
		children: squashedChildren
			.map(makeStableNode)
			.filter((node) => node !== null),
	};
}
