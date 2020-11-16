/* global __HOST__ */
const playwright = require("playwright");

describe.each(["chromium", "firefox"])("%s", (browserType) => {
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
	});

	afterEach(async () => {
		await page.close();
	});

	it("/", async () => {
		["https://platform.twitter.com/**", "https://buttons.github.io/**"].forEach(
			(url) => {
				page.route(url, (route) => {
					route.abort();
				});
			}
		);
		await gotoMuiPage(page, "/");
		const tree = await page.accessibility.snapshot({ interestingOnly: false });

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
							children: undefined,
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
							children: undefined,
							name: "a random quick word",
						};
					}

					const next = siblings[index + 1];
					// is diamond sponsor in nav?
					if (
						isTextNode(previous) &&
						previous.name === "Diamond Sponsors" &&
						next !== undefined &&
						next.role === "link" &&
						next.name === "Diamond Sponsors"
					) {
						return null;
					}

					if (node.name === "Toggle notifications panel") {
						return {
							...node,
							children: (node.children || []).filter((notificationsChild) => {
								if (
									isTextNode(notificationsChild) &&
									!Number.isNaN(+notificationsChild.name)
								) {
									return false;
								}
								return true;
							}),
						};
					}

					return node;
				},
			})
		).toMatchSnapshot();
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
		[
			"https://codefund.io/**",
			"https://cd2n.codefund.io/**",
			"https://cdn.carbonads.com/**",
		].forEach((url) => {
			page.route(url, (route) => {
				route.abort();
			});
		});
		await gotoMuiPage(page, docsRoute);
		const main = await page.$("main");
		const tree = await page.accessibility.snapshot({
			interestingOnly: false,
			root: main,
		});

		expect(
			pruneA11yTree(tree, {
				makeStableNode: (node, index, siblings) => {
					const previous = siblings[index - 1];
					if (
						node.role === "paragraph" &&
						previous !== undefined &&
						previous.role === "heading" &&
						previous.level === 1
					) {
						return {
							...node,
							// first entry is description, rest is ads
							children: node.children.slice(0, 1),
						};
					}

					if (node.role === "code") {
						return { ...node, name: "$SOME_CODE", children: [] };
					}

					return node;
				},
			})
		).toMatchSnapshot();
	});
});

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

	// demo toolbars are deferred with React.lazy and use a aria-busy skeleton.
	const lazyElements = await page.$$('[aria-busy="true"]');
	await page.waitForFunction((elements) => {
		return elements.map((element) => {
			return element.getAttribute("aria-busy") !== "true";
		});
	}, lazyElements);
	return page;
}

/**
 * // Should be importable as SerializedAXNode in ^1.1.2 (https://github.com/microsoft/playwright/pull/2722)
 * @typedef {NonNullable<ReturnType<import('playwright').Accessibility['snapshot']> extends Promise<infer R> ? R : never>} AXNode
 */

/**
 *
 * @param {AXNode} left
 * @param {AXNode} right
 * @returns {boolean} - true if only both are text nodes and only their text content is different
 */
function textNodesOnlyDifferInText(left, right) {
	if (isTextNode(left) && isTextNode(right)) {
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

// join neighboring text nodes
function squashTextNodes(children) {
	if (children === undefined) {
		return undefined;
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
			squashedChildren.push(child);
		}
	}

	return squashedChildren;
}

/**
 * prune axNode by
 * - squashing neighbouring text nodes otherwise there's a lot of noise in code blocks
 * - only including flattened children of `role="generic"`
 * @param {AXNode} axNode
 * @param {object} options
 * @param {(node: AXNode) => AXNode | null} makeStableNode - return `null` to remove the node
 */
function pruneA11yTree(node, options) {
	const { makeStableNode } = options;

	const children = makeStableChildren(
		squashTextNodes(pruneChildren(node.children))
	);

	// chromium: generic, firefox: section
	if (node.role === "generic" || node.role === "section") {
		return children;
	}
	// firefox only
	// unknown what this does but empty ones are mostly used for ads
	if (node.role === "text container") {
		return children;
	}
	if (children === undefined) {
		return node;
	}

	return {
		...node,
		children,
	};

	function pruneChildren(children) {
		if (children === undefined) {
			return undefined;
		}
		return children
			.flatMap((child) => {
				// `text` descendants of `link` already contribute to its name.
				if (
					node.role === "link" &&
					// firefox also has `text container`
					(isTextNode(child) || child.role === "text container")
				) {
					return undefined;
				}
				return pruneA11yTree(child, options);
			})
			.filter((child) => child !== undefined);
	}

	function makeStableChildren(children) {
		if (children === undefined) {
			return undefined;
		}
		return children.map(makeStableNode).filter((node) => node !== null);
	}
}

function isTextNode(node) {
	// chromium: text, firefox: text leaf
	return node != null && (node.role === "text" || node.role === "text leaf");
}
