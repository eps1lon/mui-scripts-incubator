/* global __HOST__ */
const playwright = require("playwright");

describe.each(["chromium", "firefox", "webkit"])(
	"%s material-ui.netlify.com",
	(browserType) => {
		/**
		 * @type {import('playwright').Browser}
		 */
		let browser;
		/**
		 * @type {import('playwright').BrowserContext}
		 */
		let context;

		beforeAll(async () => {
			browser = await playwright[browserType].launch();
		});
		beforeEach(async () => {
			// firefox times out on subsequent newPage-> page.goto with the same context
			context = await browser.newContext();
		});

		afterEach(async () => {
			await context.close();
		});
		afterAll(async () => {
			await browser.close();
		});

		it("matches the snapshot on /", async () => {
			const page = await gotoMuiPage(context, "/");
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
								value: "random href",
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
								value: "random href",
							};
						}

						// ignore flaky twitter follow button
						if (
							node.name === "Follow" ||
							// firefox, chromium, webkit
							(["internal frame", "Iframe", "Group"].indexOf(node.role) !==
								-1 &&
								node.name === "Twitter Follow Button")
						) {
							return null;
						}

						// ignore flaky stargazers
						if (
							(previous !== undefined &&
								/\d+ stargazers on GitHub/.test(node.name)) ||
							(node.role === "link" && node.name === "Star")
						) {
							return null;
						}

						return node;
					},
				})
			).toMatchSnapshot();
		});

		it("matches the snapshot on /components/selects/", async () => {
			const page = await gotoMuiPage(context, "/components/selects/");
			const main = await page.$("main");
			const tree = await page.accessibility.snapshot({ root: main });

			expect(
				pruneA11yTree(tree, {
					makeStableNode: (node, index, siblings) => {
						const previous = siblings[index - 1];
						// TODO: no idea why this is flaky in webkit
						if (browserType === "webkit" && node.level === 1) {
							return null;
						}
						// ad container, remove since flaky
						if (
							previous !== undefined &&
							previous.role === "heading" &&
							previous.level === 1 &&
							node.role !== "heading"
						) {
							return null;
						}

						const next = siblings[index + 1];
						// carbon adds: <link>ads via carbon</link>, <link>ad text</link>, <link>ads via carbon</link>
						// remove them since they're flaky
						if (
							node.name === "ads via Carbon" &&
							next !== undefined &&
							next.role !== "heading"
						) {
							return null;
						}
						const isLinkToAdProvder = (node) =>
							node.name === "ads via Carbon" ||
							node.name === "ad by CodeFund" ||
							node.name === "ad by Material-UI";
						if (next !== undefined && isLinkToAdProvder(next)) {
							return null;
						}
						if (isLinkToAdProvder(node)) {
							return null;
						}

						return node;
					},
				})
			).toMatchSnapshot();
		});
	}
);

/**
 *
 * @param {import('playwright').BrowserContext} context
 * @param {*} route
 * @returns {import('playwright').Page}
 */
async function gotoMuiPage(context, route) {
	const page = await context.newPage();
	await page.goto(`${__HOST__}${route}`, { waitUntil: "networkidle2" });
	// sometimes networkIdle2 fires before hydration is complete
	// we wait for a React.lazy component which is mounted in a useEffect
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
