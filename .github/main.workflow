workflow "lighthouse" {
  on = "push"
  resolves = ["publish"]
}

action "release publishable" {
  uses = "./.github/actions/release-publishable"
}

action "publish" {
  uses = "actions/npm@master"
  args = "install"
  needs = ["release publishable"]
}