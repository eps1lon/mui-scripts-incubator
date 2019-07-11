const graphql = require("@octokit/graphql");
const stream = require("stream");

module.exports = usingLatestDefaultRef;

/**
 * given { repoName, orgName } find the latest ref on the default branch
 */
function usingLatestDefaultRef(ghApiToken) {
  return new stream.Transform({
    objectMode: true,
    transform(repository, encoding, callback) {
      graphql(
        `
          query($orgName: String!, $repoName: String!) {
            repository(owner: $orgName, name: $repoName) {
              defaultBranchRef {
                target {
                  oid
                }
              }
            }
            rateLimit {
              cost
              limit
              remaining
              resetAt
            }
          }
        `,
        {
          headers: {
            authorization: `token ${ghApiToken}`
          },
          orgName: repository.orgName,
          repoName: repository.repoName
        }
      ).then(response => {
        const {
          rateLimit,
          repository: {
            defaultBranchRef: {
              target: { oid }
            }
          }
        } = response;

        this.push({ ...repository, ref: oid });
        callback();
      });
    }
  });
}
