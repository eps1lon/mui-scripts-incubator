const core = require("@actions/core");
const github = require("@actions/github");
const a11ySnapshot = require("../../lib/a11y-snapshot");

main().catch(error => {
  core.setFailed(error.message);
});

async function main() {
  const { eventName, event } = github.context;

  if (eventName === "push") {
    a11ySnapshot({ argv: "--updateSnapshot" });
  } else if (eventName === "repository_dispatch") {
    a11ySnapshot({ prNumber: event.client_payload.pr_number });
  }
}
