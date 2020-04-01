const { graphql } = require("@octokit/graphql");
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
  const {
    highWaterMark,
    onPressureChange,
    onRateLimitChange = () => {}
  } = options;

  return new stream.Transform({
    highWaterMark,
    objectMode: true,
    transform(repository, encoding, callback) {
      onPressureChange(
        this.readableLength / this.readableHighWaterMark,
        this.writableLength / this.writableHighWaterMark
      );

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
      )
        .then(
          response => {
            const {
              rateLimit,
              repository: {
                defaultBranchRef: {
                  target: { oid }
                }
              }
            } = response;

            onRateLimitChange(rateLimit.remaining);
            //console.log("PUSH DEFAULT REF");
            this.push({ ...repository, ref: oid });

            onPressureChange(
              this.readableLength / this.readableHighWaterMark,
              this.writableLength / this.writableHighWaterMark
            );

            // github allows 5000 requests per hour, we're throttling prematurely
            // to never exceed it
            setTimeout(() => {
              onPressureChange(
                this.readableLength / this.readableHighWaterMark,
                this.writableLength / this.writableHighWaterMark
              );
              callback();
            }, Math.ceil((3600 / 5000) * 1000));
          },
          reason => {
            // ignore not found errors, can happen between crawling github and fetch from the api
            if (reason.name === "GraphqlError") {
              const [firstError, ...otherErrors] = reason.errors;
              const isOnlyNotFoundError =
                otherErrors.length === 0 && firstError.type === "NOT_FOUND";

              if (isOnlyNotFoundError) {
                return;
              }
            }

            throw reason;
          }
        )
        .catch(error => {
          this.emit("error", error);
        });
    }
  });
}
