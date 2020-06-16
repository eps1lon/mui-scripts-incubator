#!/usr/bin/env node
const lighthouseAudit = require("../lib/lighthouse-audit");
const a11ySnapshot = require("../lib/a11y-snapshot");

require("yargs")
	.command({
		command: "lighthouse-audit [pr-number]",
		desc: "audit pages with lighthouse",
		builder: (yargs) => {
			yargs.positional("pr-number", {
				describe:
					"number of a Pull Request or empty to target the default branch",
				type: "number",
			});
		},
		handler: (argv) => {
			lighthouseAudit({ prNumber: +argv["pr-number"] });
		},
	})
	.command({
		command: "a11y-snapshot [pr-number]",
		desc: "checks a11y tree snapshots",
		builder: (yargs) => {
			yargs.positional("pr-number", {
				describe:
					"number of a Pull Request or empty to target the default branch",
				type: "number",
				default: Number.NaN,
			});
		},
		handler: (argv) => {
			a11ySnapshot({ prNumber: +argv["pr-number"] });
		},
	})
	.help().argv;
