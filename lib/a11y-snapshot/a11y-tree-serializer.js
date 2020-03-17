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
  // use babel so that the output is treated as jsx
  return unescapeSafeJsxText(prettier.format(a11yXML, { parser: "babel" }));
}

function serializeAxNode(node) {
  const { children = [], name, role, ...attributes } = node;

  const serializedAttributes = Object.keys(attributes)
    .map(attribute => {
      return `${attribute}="${attributes[attribute]}"`;
    })
    .join(" ");

  // need a separate namespace for prettier html parser
  return `<${role} ${serializedAttributes}>
${escapeUnsafeJsxText(name)}
${children
  .map(node =>
    serializeAxNode(node)
      .split("\n")
      .map(line => `  ${line}`)
      .join("\n")
  )
  .join("\n")}
</${role}>`;
}

module.exports = {
  test: node => typeof node.role === "string",
  print: node => {
    return prettifyA11yXML(serializeAxNode(node));
  }
};
