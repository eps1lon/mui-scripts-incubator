/* global __HOST__ */

describe("material-ui.netlify.com", () => {
  it("matches the snapshot on /", async () => {
    await gotoMuiPage(page, "/");
    const tree = await page.accessibility.snapshot();

    expect(
      pruneA11yTree(tree, {
        makeStableNode: (node, index, siblings) => {
          // is praise quote?
          const heading = siblings
            .slice(0, index)
            .reverse()
            .find(sibling => {
              return sibling.role === "heading";
            });
          if (
            heading !== undefined &&
            heading.name === "Praise for Material-UI"
          ) {
            return { ...node, name: "a random quote about Material-UI" };
          }

          const previous = siblings[index - 1];
          // is quick word?
          if (
            previous !== undefined &&
            previous.name === "A quick word from our sponsors:"
          ) {
            return { ...node, name: "a random quick word" };
          }

          // ignore flaky twitter follow button
          if (
            (previous !== undefined &&
              previous.name === "Twitter Follow Button" &&
              node.name === "Follow") ||
            (node.role === "Iframe" && node.name === "Twitter Follow Button")
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
        }
      })
    ).toMatchSnapshot();
  });

  it("matches the snapshot on /components/selects/", async () => {
    await gotoMuiPage(page, "/components/selects/");
    const main = await page.$("main");
    const tree = await page.accessibility.snapshot({ root: main });

    expect(
      pruneA11yTree(tree, {
        makeStableNode: (node, index, siblings) => {
          const previous = siblings[index - 1];
          // ad container, remove since flaky
          if (
            previous !== undefined &&
            previous.role === "heading" &&
            previous.level === 1
          ) {
            return null;
          }

          const next = siblings[index + 1];
          // carbon adds: <link>ads via carbon</link>, <link>ad text</link>, <link>ads via carbon</link>
          // remove them since they're flaky
          if (node.name === "ads via Carbon" && next.role !== "heading") {
            return null;
          }
          const isLinkToAdProvder = node =>
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
        }
      })
    ).toMatchSnapshot();
  });
});

/**
 *
 * @param {import('puppeteer').Page} page
 * @param {*} route
 */
async function gotoMuiPage(page, route) {
  await page.goto(`${__HOST__}${route}`, { waitUntil: "networkidle2" });
  // sometimes networkIdle2 fires before hydration is complete
  // we wait for a React.lazy component which is mounted in a useEffect
  await page.waitForSelector("#docsearch-input");
}

/**
 *
 * @param {import('puppeteer').AXNode} left
 * @param {import('puppeteer').AXNode} right
 * @returns {boolean} - true if only both are text nodes and only their text content is different
 */
function textNodesOnlyDifferInText(left, right) {
  if (left.role === "text" && right.role === "text") {
    // I don't know if role: "text" has other properties that might be different
    // so I'm prematurely checking
    const keysOfDifferentValues = Array.from(
      new Set([...Object.keys(left), ...Object.keys(right)])
    ).filter(key => left[key] !== right[key]);

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
        name: previous.name + child.name
      };
      squashedChildren.splice(start, deleteCount, item);
    } else {
      squashedChildren.push(pruneA11yTree(child, options));
    }
  }

  return {
    ...other,
    children: squashedChildren.map(makeStableNode).filter(node => node !== null)
  };
}
