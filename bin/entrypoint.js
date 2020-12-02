#!/usr/bin/env node
const lighthouseAudit = require("../lib/lighthouse-audit");

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
			return lighthouseAudit({ prNumber: +argv["pr-number"] });
		},
	})
	.help().argv;
