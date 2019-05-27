workflow "lighthouse" {
  on = "release"
  resolves = ["publish"]
}

action "release publishable" {
  uses = "docker://stedolan/jq"
  args = "-r .action $GITHUB_EVENT_PATH"
}

action "publish" {
  uses = "actions/npm@master"
  args = "install"
  needs = ["release publishable"]
}