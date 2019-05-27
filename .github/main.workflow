workflow "lighthouse" {
  on = "push"
  resolves = ["publish"]
}

action "release publishable" {
  uses = "./.github/actions/release-publishable"
}

action "publish" {
  needs = ["release publishable"]
  uses = "actions/npm@master"
  args = "publish --access public"
  secrets = ["NPM_TOKEN"]
}