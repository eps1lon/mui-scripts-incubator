const playwright = require("playwright");
const os = require("os");

async function main() {
	const browsers = await Promise.all(
		["chromium", "firefox"].map(async (browserType) => {
			const browser = await playwright[browserType].launch();
			const version = browser.version();
			const name = playwright[browserType].name();
			await browser.close();

			return [name, version];
		})
	);

	console.log("Node\t%s", process.version);
	console.log("OS\t%s, %s, %s, %s", os.platform, os.type, os.version, os.arch);
	console.log("Browsers:");
	browsers.map(([name, version]) => {
		console.log("  %s\t%s", name, version);
	});
}

main();
