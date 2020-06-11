const { graphql } = require("@octokit/graphql");
const stream = require("stream");

module.exports = usingLatestDefaultRef;

/**
 * given { repoName, orgName } find the latest ref on the default branch
 * @param {string} ghApiToken
 * @param {object} [options]
 * @param {(remainingScore: number) => void} [options.onRateLimitChange]
 * @param {number} [options.highWaterMark]
 * @param {(message: string) => void} [options.debug]
 */
function usingLatestDefaultRef(ghApiToken, options = {}) {
	const {
		debug = () => {},
		highWaterMark,
		onPressureChange,
		onRateLimitChange = () => {},
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
						authorization: `token ${ghApiToken}`,
					},
					orgName: repository.orgName,
					repoName: repository.repoName,
				}
			)
				.then(
					(response) => {
						const {
							rateLimit,
							repository: {
								defaultBranchRef: {
									target: { oid },
								},
							},
						} = response;

						onRateLimitChange(rateLimit.remaining);
						this.push({ ...repository, ref: oid });

						onPressureChange(
							this.readableLength / this.readableHighWaterMark,
							this.writableLength / this.writableHighWaterMark
						);

						const timeout =
							rateLimit.remaining <= 1
								? new Date(rateLimit.reset * 1000) - new Date()
								: 0;
						if (timeout > 0) {
							debug(
								`sleeping for ${timeout}ms because ${JSON.stringify(
									rateLimit,
									null,
									2
								)}`
							);
						}

						setTimeout(() => {
							onPressureChange(
								this.readableLength / this.readableHighWaterMark,
								this.writableLength / this.writableHighWaterMark
							);
							callback();
						}, timeout);
					},
					(reason) => {
						// ignore not found errors, can happen between crawling github and fetch from the api
						if (reason.name === "GraphqlError") {
							const [firstError, ...otherErrors] = reason.errors;
							const isOnlyNotFoundError =
								otherErrors.length === 0 && firstError.type === "NOT_FOUND";

							if (isOnlyNotFoundError) {
								debug(`skipped ${repository.orgName}/${repository.repoName}`);
								callback();
								return;
							}
						}

						throw reason;
					}
				)
				.catch((reason) => {
					this.emit("error", reason);
				});
		},
	});
}
