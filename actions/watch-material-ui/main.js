const core = require("@actions/core");
const github = require("@actions/github");
const a11ySnapshot = require("../../lib/a11y-snapshot");
const childProcess = require("child_process");
const { promisify } = require("util");
const exec = promisify(childProcess.exec);

main().catch((error) => {
	core.error(error.stdout);
	core.error(error.stderr);
	core.setFailed(error.message);
});

async function main() {
	const { eventName, payload } = github.context;

	const targetUrl =
		eventName === "repository_dispatch"
			? payload.client_payload.target_url
			: "https://material-ui.netlify.com/";
	core.info(`client_payload: ${JSON.stringify(payload.client_payload)}`);

	const prNumberMatch = targetUrl.match(/deploy-preview-(\d+)/);
	const prNumber = prNumberMatch === null ? Number.NaN : +prNumberMatch[1];

	const isPr = Number.isNaN(prNumber) === false;
	const muiBranch = !isPr ? "master" : `pr/${prNumber}`;
	core.info(!isPr ? "using master" : `using deploy preview #${prNumber}`);

	await a11ySnapshot({
		argv: "--updateSnapshot --runInBand",
		prNumber,
	});

	const { stdout: gotUpdated } = await git("status --porcelain");
	if (gotUpdated) {
		await git('config --local user.email "action@github.com"');
		await git('config --local user.name "GitHub Action"');

		const branch = `github-actions/fix/${muiBranch}`;
		await git(`checkout -b ${branch}`);
		await git("add -A");
		await git('commit -m "Update snapshots"');

		await git(`push origin -f ${branch}`);
		const octokit = new github.GitHub(core.getInput("token"));
		try {
			await octokit.pulls.create({
				owner: github.context.repo.owner,
				repo: github.context.repo.repo,
				base: "master",
				head: branch,
				title: `Update snapshots for ${muiBranch}`,
				body: isPr
					? `changes of https://github.com/mui-org/material-ui/pull/${prNumber}`
					: "changes on `master`",
				maintainer_can_modify: true,
			});
		} catch (error) {
			core.warning(`'${JSON.stringify(error, null, 2)}'`);
		}
	}
}

async function git(command, ...args) {
	const { stdout, stderr } = await exec(`git ${command}`, ...args);
	if (stdout) core.info(stdout);
	//if (stderr) core.error(stderr);
	return { stdout, stderr };
}
