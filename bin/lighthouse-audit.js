#!/usr/bin/env node
const childProcess = require("child_process");
const fse = require("fs-extra");
const path = require("path");
const url = require("url");
const { promisify } = require("util");

const exec = promisify(childProcess.exec);
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

function skipAudit(audit) {
  const complainsOnlyAboutCarbonAds =
    audit.id === "link-name" &&
    audit.details.items.length === 1 &&
    audit.details.items[0].node.selector === ".carbon-img";

  return complainsOnlyAboutCarbonAds;
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
const prNumber = +process.argv[2];
const runOnMaster = Number.isNaN(prNumber);
const lighthouseUrl = runOnMaster
  ? "https://material-ui.netlify.com/"
  : `https://deploy-preview-${prNumber}--material-ui.netlify.com/`;

run(lighthouseUrl).catch(error => {
  console.error(error);
  process.exit(1);
});

async function run(inputUrl) {
  const reports = await Promise.all(
    pages.map(async page => {
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
    })
  );

  await writeReport(reports.filter(Boolean));
}
