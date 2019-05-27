workflow "lighthouse" {
  on = "push"
  resolves = ["publish"]
}

action "release publishable" {
  uses = "docker://stedolan/jq"
  args = "-r .ref $GITHUB_EVENT_PATH"
}

action "publish" {
  uses = "actions/npm@master"
  args = "install"
  needs = ["release publishable"]
}