#!/usr/bin/env node
const childProcess = require("child_process");
const _ = require("lodash");
const url = require("url");
const { promisify } = require("util");

const exec = promisify(childProcess.exec);

module.exports = lighthouseAudit;

/**
 *
 * @param {object} report
 */
function writeReport(report) {
  return new Promise((resolve, reject) => {
    process.stdout.write(JSON.stringify(report, null, 2), error => {
      if (error) reject(error);
      resolve();
    });
  });
}

const concurrency = 5;
function skipAudit(audit) {
  const complainsOnlyAboutCarbonAds =
    audit.id === "link-name" &&
    audit.details.items.length === 1 &&
    audit.details.items[0].node.selector === ".carbon-img";

  const complainsOnlyAboutCodefundLink =
    audit.id === "link-name" &&
    audit.details.items.length === 1 &&
    audit.details.items[0].node.selector === ".cf-img-wrapper";

  const complainsOnlyAboutCodefundImage =
    audit.id === "image-alt" &&
    audit.details.items.length === 1 &&
    audit.details.items[0].node.selector === ".cf-img";

  return (
    complainsOnlyAboutCarbonAds ||
    complainsOnlyAboutCodefundImage ||
    complainsOnlyAboutCodefundLink
  );
}
const pages = [
  "/",
  // Layout
  "/components/box",
  "/components/container",
  "/components/grid",
  "/components/grid-list",
  // Inputs
  "/components/autocomplete",
  "/components/buttons",
  "/components/checkboxes",
  "/components/pickers",
  "/components/radio-buttons",
  "/components/selects",
  "/components/switches",
  "/components/text-fields",
  "/components/transfer-list",
  // Navigation
  "/components/bottom-navigation",
  "/components/breadcrumbs",
  "/components/drawers",
  "/components/links",
  "/components/menus",
  "/components/steppers",
  "/components/tabs",
  // Surfaces
  "/components/app-bar",
  "/components/paper",
  "/components/cards",
  "/components/expansion-panels",
  // Feedback
  "/components/progress",
  "/components/dialogs",
  "/components/snackbars",
  // data display
  "/components/avatars",
  "/components/badges",
  "/components/chips",
  "/components/dividers",
  "/components/icons",
  "/components/lists",
  "/components/tables",
  "/components/tooltips",
  "/components/typography",
  // Utils
  "/components/click-away-listener",
  "/components/css-baseline",
  "/components/modal",
  "/components/no-ssr",
  "/components/popover",
  "/components/popper",
  "/components/portal",
  "/components/transitions",
  "/components/use-media-query"
];
/**
 * skip color-contrast because its an issue with the theme i.e. designer
 */
const lighthouseArgs = [
  "--only-categories=accessibility",
  "--skip-audits=color-contrast",
  '--chrome-flags="--headless"'
];

async function lighthouseAudit(options) {
  const { prNumber } = options;

  const runOnMaster = Number.isNaN(prNumber);
  const lighthouseUrl = runOnMaster
    ? "https://material-ui.netlify.com/"
    : `https://deploy-preview-${prNumber}--material-ui.netlify.com/`;

  const chunks = _.chunk(pages, concurrency);
  const auditedChunks = [];

  // chunks serial but each page in a chunk is processed concurrently
  for (const chunk of chunks) {
    const auditedChunk = await Promise.all(
      chunk.map(page => {
        return auditPage(lighthouseUrl, page);
      })
    );

    auditedChunks.push(auditedChunk);
  }

  const reports = _.flatten(auditedChunks);
  await writeReport(reports.filter(Boolean));
}

async function auditPage(inputUrl, page) {
  const pageUrl = url.resolve(inputUrl, page);
  const args = [pageUrl, "--output json", ...lighthouseArgs].join(" ");
  const { stdout } = await exec(`yarn --silent lighthouse ${args}`);

  const report = JSON.parse(stdout);
  const snapshot = Object.values(report.audits)
    .filter(audit => {
      return audit.score === 0 && !skipAudit(audit);
    })
    .map(audit => {
      return audit.title;
    })
    .sort((a, b) => a.localeCompare(b));

  const isEmptySnapshot = snapshot.length === 0;

  if (isEmptySnapshot) {
    return null;
  }

  return { page, snapshot };
}
