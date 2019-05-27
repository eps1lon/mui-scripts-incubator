workflow "lighthouse" {
  on = "release"
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