const core = require("@actions/core");
const github = require("@actions/github");

const thisRepo = { owner: "eps1lon", repo: "mui-scripts-incubator" };
const muiRepo = { owner: "mui-org", repo: "material-ui" };

main().catch((error) => {
	core.error(error.stdout);
	core.error(error.stderr);
	core.setFailed(error.message);
});

async function main() {
	const octokit = new github.GitHub(core.getInput("token"));
	await cleanupSnapshotPrsForClosedMuiPrs(octokit);
}

/**
 * Deletes PRs tracking a Material-UI PR that is resolved (closed or merged)
 * @param {import('@actions/github').GitHub} octokit
 */
async function cleanupSnapshotPrsForClosedMuiPrs(octokit) {
	// find branches for Material-UI PRs
	const branchesRelatedToMui = await findBranchesRelatedToMui(octokit);
	core.debug(
		`found ${branchesRelatedToMui.length} branches related to Material-UI`
	);
	const tasks = branchesRelatedToMui.map(async (branch) => {
		const { data: pullRequest } = await octokit.pulls.get({
			...muiRepo,
			pull_number: branch.muiPrNumber,
		});
		if (pullRequest == null) {
			core.warning(`could not find Material-UI PR #${branch.muiPrNumber}`);
			return;
		}

		if (pullRequest.state === "open") {
			core.info(`Material-UI PR #${branch.muiPrNumber} is still open.`);
			return;
		}

		const ref = `heads/${branch.name}`;
		core.info(
			`Deleting ref '${ref}' for Material-UI PR #${branch.muiPrNumber} since it is '${pullRequest.state}'.`
		);
		return octokit.git
			.deleteRef({
				...thisRepo,
				ref: `heads/${branch.name}`,
			})
			.catch((error) => {
				core.warning(`failed to delete ref '${ref}'`);
				throw error;
			});
	});

	return Promise.all(tasks);
}
/**
 * Only finds branches within the first 100 of the repository
 * @param {import('@actions/github').GitHub} octokit
 */
async function findBranchesRelatedToMui(octokit) {
	const { data: branches } = await octokit.repos.listBranches({
		...thisRepo,
		per_page: 100,
	});

	core.debug(`found ${branches.length} branches`);

	return branches
		.filter((branch) => {
			core.debug(`checking branch ${branch.name}`);
			return /^github-actions\/fix\/pr\/\d+$/.test(branch.name);
		})
		.map((branch) => {
			return {
				name: branch.name,
				// strip leading 'github-actions/fix/pr/'
				muiPrNumber: Number(branch.name.replace("github-actions/fix/pr/", "")),
			};
		});
}
