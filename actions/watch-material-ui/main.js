const core = require("@actions/core");
const github = require("@actions/github");
const a11ySnapshot = require("../../lib/a11y-snapshot");
const childProcess = require("child_process");
const { promisify } = require("util");
const exec = promisify(childProcess.exec);

main().catch(error => {
  core.setFailed(error.message);
});

async function main() {
  const { eventName, event } = github.context;

  if (eventName === "push") {
    a11ySnapshot({ argv: "--updateSnapshot" });

    const gotUpdated = await exec("git status --porcelain");
    core.info(gotUpdated);
    if (gotUpdated) {
      const branch = `github-actions/fix/master`;
      await exec(`git checkout -b ${branch}`);
      await exec("git add -A");
      await exec('git commit -m "Update snapshots"');

      // await exec(`git push origin ${branch}`);
      //const octokit = new github.GitHub(core.getInput("token"));
      /* octokit.pulls.create({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo
    }); */
    }
  } else if (eventName === "repository_dispatch") {
    a11ySnapshot({
      argv: "--updateSnapshot",
      prNumber: event.client_payload.pr_number
    });
  }
}
