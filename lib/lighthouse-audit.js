const childProcess = require("child_process");
const fse = require("fs-extra");
const path = require("path");
const url = require("url");
const { promisify } = require("util");

const exec = promisify(childProcess.exec);

const pages = ["/", "/components/autocomplete", ""];
/**
 * skip color-contrast because its an issue with the theme i.e. designer
 */
const lighthouseArgs = [
  "--only-categories=accessibility",
  "--skip-audits=color-contrast"
];
const prNumber = +process.argv[2];
const runOnMaster = Number.isNaN(prNumber);
const lighthouseUrl = runOnMaster
  ? "https://material-ui.netlify.com/"
  : `https://deploy-preview-${prNumber}--material-ui.netlify.com/`;
const outputPath = path.join(
  __dirname,
  `../__snapshots__/lighthouse/${runOnMaster ? "master" : prNumber}.json`
);

run(lighthouseUrl).catch(error => {
  console.error(error);
  process.exit(1);
});

async function run(inputUrl) {
  const reports = await Promise.all(
    pages.map(async page => {
      const pageUrl = url.resolve(inputUrl, page);

      const args = [pageUrl, "--output json", ...lighthouseArgs].join(" ");
      console.log(`running lighthouse ${args}`);
      const { stdout } = await exec(`yarn --silent lighthouse ${args}`);

      const report = JSON.parse(stdout);
      const snapshot = Object.values(report.audits)
        .filter(audit => {
          return audit.score === 0;
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

  await fse.writeJSON(outputPath, reports.filter(Boolean), { spaces: 2 });
  console.log(`report ready in ${outputPath}`);
}
