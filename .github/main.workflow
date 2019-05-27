workflow "lighthouse" {
  on = "push"
  resolves = ["publish"]
}

action "release publishable" {
  uses = "./actions/release-publishable"
}

action "publish" {
  uses = "actions/npm@master"
  args = "install"
  needs = ["release publishable"]
}