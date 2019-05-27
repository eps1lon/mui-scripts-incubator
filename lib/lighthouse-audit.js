const childProcess = require("child_process");
const fse = require("fs-extra");
const path = require("path");
const url = require("url");
const { promisify } = require("util");

const exec = promisify(childProcess.exec);

const pages = ["/", "/components/autocomplete"];
const lighthouseArgs = ["--only-categories=accessibility"];
const prNumber = +process.argv[2];
const previewUrl = `https://deploy-preview-${prNumber}--material-ui.netlify.com/`;
const outputPath = path.join(
  __dirname,
  `../__snapshots__/lighthouse/${prNumber}.json`
);

run(previewUrl).catch(error => {
  console.error(error);
  process.exit(1);
});

async function run(inputUrl) {
  const reports = [];

  for (const page of pages) {
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
        return audit.id;
      })
      .sort((a, b) => a.localeCompare(b));

    const isEmptySnapshot = snapshot.length === 0;

    if (!isEmptySnapshot) {
      reports.push({ page, snapshot });
    }
  }

  await fse.writeJSON(outputPath, reports, { spaces: 2 });
  console.log(`report ready in ${outputPath}`);
}
