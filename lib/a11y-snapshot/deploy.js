const { promises: fs } = require("fs");
const NetlifyAPI = require("netlify");
const path = require("path");
const prettier = require("prettier");
const { read } = require("./jestGlobals");

module.exports = { updateDeploy };

async function updateDeploy(targetUrl) {
	const deploySnapshotPath = path.resolve(__dirname, "deploy.json");
	// material-ui.netlify.app -> material-ui.netlify.app
	// next--material-ui.netlify.app -> material-ui.netlify.app
	const [branchOrSite, siteIfBranch] = targetUrl.hostname.split("--");
	const siteId = siteIfBranch !== undefined ? siteIfBranch : branchOrSite;

	const client = new NetlifyAPI();
	async function findLatestDeploy() {
		const deploys = await client.listSiteDeploys({ siteId });
		return deploys.find((deploy) => {
			return targetUrl.hostname === new URL(deploy.deploy_url).hostname;
		});
	}

	const latestDeploy = await findLatestDeploy();
	if (latestDeploy === undefined) {
		throw new Error(`Could not find deploy matching ${targetUrl}`);
	}
	const latestDeploySnapshot = JSON.stringify(latestDeploy, null, 2);
	const prettierConfig = await prettier.resolveConfig(deploySnapshotPath);
	await fs.writeFile(
		deploySnapshotPath,
		prettier.format(latestDeploySnapshot, {
			filepath: latestDeploySnapshot,
			parser: "json",
			...prettierConfig,
		})
	);
}

if (require.main === module) {
	const { __HOST__ } = read();
	updateDeploy(new URL(__HOST__)).catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
