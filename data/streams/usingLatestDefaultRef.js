const graphql = require("@octokit/graphql");
const stream = require("stream");

module.exports = usingLatestDefaultRef;

/**
 * given { repoName, orgName } find the latest ref on the default branch
 * @param {string} ghApiToken
 * @param {object} [options]
 * @param {(remainingScore: number) => void} [options.onRateLimitChange]
 * @param {number} [options.highWaterMark]
 */
function usingLatestDefaultRef(ghApiToken, options = {}) {
  const { highWaterMark, onRateLimitChange = () => {} } = options;

  return new stream.Transform({
    highWaterMark: 16 * 2,
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

        onRateLimitChange(rateLimit.remaining);
        this.push({ ...repository, ref: oid });
        callback();
      });
    }
  });
}
