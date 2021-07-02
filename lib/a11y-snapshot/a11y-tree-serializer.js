const prettier = require("prettier");

function escapeUnsafeJsxText(unsafeText) {
	return unsafeText
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;")
		.replace(/{/g, "&#123;")
		.replace(/}/g, "&#125;");
}

function unescapeSafeJsxText(safeJsxText) {
	return safeJsxText
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'")
		.replace(/&#123;/g, "{")
		.replace(/&#125;/g, "}");
}

function prettifyA11yXML(a11yXML) {
	let formatted = "";
	try {
		// use babel so that the output is treated as jsx
		formatted = prettier.format(a11yXML, { parser: "babel" });
	} catch (error) {
		throw new Error(
			`error formatting using prettier:\n${error}\n\nxml:\n${a11yXML}`
		);
	}
	return unescapeSafeJsxText(formatted);
}

function serializeAxNode(node) {
	const { children = [], name, role, ...attributes } = node;

	const tagName =
		{
			"combobox list": "MenuListPopup", // what chromium uses
			"combobox option": "menuitem", // what chromium uses
			"date editor": "DateTime", // what chromium uses
			Iframe: "iframe", // what chromium uses
			"internal frame": "iframe", // not reproducible in chromium
			"list item marker": "ListMarker", // what chromium uses
			// Chromium still uses textbox.
			"password text": "textbox",
			// TODO: should probably use the paragraph role instead?
			"text container": "text-container",
			"text leaf": "text",
			"time editor": "InputTime", // what chromium uses
			// Chrome uses <button pressed="true|false" />
			"toggle button": "togglebutton",
		}[role] || role;

	const serializedAttributes = Object.keys(attributes)
		.filter((attribute) => {
			// We didn't used to filter but at some point `value`, `pressed`, and `checked` got included with an undefined value
			if (attributes[attribute] === undefined) {
				return false;
			}

			// firefox includes the hrefs of links in the node value
			// chromium omits them. They're less interesting anyway
			// since they change between deploys (material-ui.netlify vs deploy-preview-X--material-ui.netlify)
			if (role === "link") {
				return attribute !== "value";
			}
			return true;
		})
		// Attribute order can be different (across browsers? CI?).
		.sort((a, b) => {
			return a.localeCompare(b);
		})
		.map((attribute) => {
			return `${attribute}="${attributes[attribute]}"`;
		})
		.join(" ");

	// need a separate namespace for prettier html parser
	return `<${tagName} ${serializedAttributes}>
${escapeUnsafeJsxText(name)}
${children
	.map((node) =>
		serializeAxNode(node)
			.split("\n")
			.map((line) => `  ${line}`)
			.join("\n")
	)
	.join("\n")}
</${tagName}>`;
}

module.exports = {
	test: (node) => node != null && typeof node.role === "string",
	print: (node) => {
		return prettifyA11yXML(serializeAxNode(node));
	},
};
