const { Octokit } = require("@octokit/core");
const childProcess = require("child_process");
const fse = require("fs-extra");
const { promisify } = require("util");
const yargs = require("yargs");
const a11ySnapshot = require("../lib/a11y-snapshot");

const exec = promisify(childProcess.exec);

const muiMainBranch = "next";
const githubToken = process.env.GITHUB_TOKEN;

yargs
	.command({
		command: "$0",
		describe: "Creates PR with updated a11y-snapshots for material-ui.com.",
		builder: (command) => {
			return command
				.option("githubEventPath", {
					demandOption: true,
					describe:
						"The path of the file with the complete webhook event payload.",
					type: "string",
				})
				.option("githubEventName", {
					demandOption: true,
					describe: "Name of the event that triggered this action.",
					type: "string",
				})
				.option("githubRepository", {
					demandOption: true,
					describe:
						"The owner and repository name. For example, octocat/Hello-World.",
					type: "string",
				});
		},
		handler: main,
	})
	.help()
	.strict(true)
	.version(false)
	.parse();

async function main(argv) {
	const {
		githubEventPath,
		githubEventName: eventName,
		githubRepository,
	} = argv;

	const [repoOwner, repoName] = githubRepository.split("/");
	const payload = await fse.readJSON(githubEventPath);
	const targetUrl =
		eventName === "repository_dispatch"
			? payload.client_payload.target_url
			: `https://${muiMainBranch}--material-ui.netlify.app/`;
	console.debug(`client_payload: ${JSON.stringify(payload.client_payload)}`);

	const prNumberMatch = targetUrl.match(/deploy-preview-(\d+)/);
	const prNumber = prNumberMatch === null ? Number.NaN : +prNumberMatch[1];

	const isPr = Number.isNaN(prNumber) === false;
	const muiBranch = !isPr ? muiMainBranch : `pr/${prNumber}`;
	console.info(
		!isPr ? `using \`${muiMainBranch}\`` : `using deploy preview #${prNumber}`
	);

	await a11ySnapshot({
		argv: "--updateSnapshot --runInBand --detectOpenHandles",
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
		const octokit = new Octokit({ auth: githubToken });
		try {
			await octokit.pulls.create({
				owner: repoOwner,
				repo: repoName,
				base: "main",
				head: branch,
				title: `Update snapshots for ${muiBranch}`,
				body: isPr
					? `changes of https://github.com/mui-org/material-ui/pull/${prNumber}`
					: `changes on \`${muiMainBranch}\``,
				maintainer_can_modify: true,
			});
		} catch (error) {
			console.warn(`Error when creating a pull request: ${error}`);
		}
	}
}

async function git(command, ...args) {
	const { stdout, stderr } = await exec(`git ${command}`, ...args);
	if (stdout) console.info(stdout);
	//if (stderr) core.error(stderr);
	return { stdout, stderr };
}
