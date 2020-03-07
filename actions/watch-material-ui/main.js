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

    const gotUpdated = await git("status --porcelain");
    core.info(gotUpdated);
    if (gotUpdated) {
      await git('config --local user.email "action@github.com"');
      await git('config --local user.name "GitHub Action"');

      const branch = `github-actions/fix/master`;
      await git(`checkout -b ${branch}`);
      await git("add -A");
      await git('commit -m "Update snapshots"');

      // await git(`push origin ${branch}`);
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

function git(command, ...args) {
  return exec(`git ${command}`, ...args);
}
