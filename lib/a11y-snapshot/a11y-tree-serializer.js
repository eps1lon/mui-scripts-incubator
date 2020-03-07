const prettier = require("prettier");

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function unescapeHTML(safe) {
  return safe
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

function prettifyA11yXML(a11yXML) {
  return unescapeHTML(prettier.format(a11yXML, { parser: "html" }))
    .replace(/<A:/g, "<")
    .replace(/<\/A:/g, "</");
}

function serializeAxNode(node) {
  const { children = [], name, role, ...attributes } = node;

  const serializedAttributes = Object.keys(attributes)
    .map(attribute => {
      return `${attribute}="${attributes[attribute]}"`;
    })
    .join(" ");

  // need a separate namespace for prettier html parser
  return `<A:${role} ${serializedAttributes}>
"${escapeHtml(name)}"
${children
  .map(node =>
    serializeAxNode(node)
      .split("\n")
      .map(line => `  ${line}`)
      .join("\n")
  )
  .join("\n")}
</A:${role}>`;
}

module.exports = {
  test: node => typeof node.role === "string",
  print: node => {
    return prettifyA11yXML(serializeAxNode(node));
  }
};
