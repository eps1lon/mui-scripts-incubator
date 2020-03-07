const core = require("@actions/core");
const github = require("@actions/github");
const a11ySnapshot = require("../../lib/a11y-snapshot");
const childProcess = require("child_process");
const { promisify } = require("util");
const exec = promisify(childProcess.exec);

main().catch(error => {
  core.error(error.stdout);
  core.error(error.stderr);
  core.setFailed(error.message);
});

async function main() {
  const { eventName, event } = github.context;

  if (eventName === "push") {
    await a11ySnapshot({ argv: "--updateSnapshot" });

    const { stdout: gotUpdated } = await git("status --porcelain");
    if (gotUpdated) {
      await git('config --local user.email "action@github.com"');
      await git('config --local user.name "GitHub Action"');

      const branch = `github-actions/fix/master`;
      await git(`checkout -b ${branch}`);
      await git("add -A");
      await git('commit -m "Update snapshots"');

      await git(`push origin ${branch}`);
      const octokit = new github.GitHub(core.getInput("token"));
      octokit.pulls.create({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        base: "master",
        head: branch
      });
    }
  } else if (eventName === "repository_dispatch") {
    a11ySnapshot({
      argv: "--updateSnapshot",
      prNumber: event.client_payload.pr_number
    });
  }
}

async function git(command, ...args) {
  const { stdout, stderr } = await exec(`git ${command}`, ...args);
  if (stdout) core.info(stdout);
  //if (stderr) core.error(stderr);
  return { stdout, stderr };
}
