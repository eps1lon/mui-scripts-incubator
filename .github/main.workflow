workflow "lighthouse" {
  on = "push"
  resolves = ["publish"]
}

action "release publishable" {
  uses = "./.github/actions/release-publishable"
}

action "publish" {
  uses = "actions/npm@master"
  args = "publish"
  needs = ["release publishable"]
  secrets = ["NPM_AUTH_TOKEN"]
}