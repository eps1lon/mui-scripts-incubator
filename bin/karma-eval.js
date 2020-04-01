#!/usr/bin/env node
/* eslint-disable no-console */
const graphql = require("@octokit/graphql");

main({
  cursor: process.argv[2],
  limit: 100,
  token: process.env.GITHUB_API_TOKEN
});

/**
 * We are looking for commits where test_browser failed but test_unit passed
 * @param {object} commit
 */
function isCommitOfInterest(commit) {
  const { status } = commit;

  if (status === null) {
    return false;
  }

  const testUnitStatus = status.contexts.find(
    node => node.context === "ci/circleci: test_unit"
  );
  const testBrowserStatus = status.contexts.find(
    node => node.context === "ci/circleci: test_browser"
  );

  return (
    testBrowserStatus !== undefined &&
    testUnitStatus !== undefined &&
    testUnitStatus.state === "SUCCESS" &&
    testBrowserStatus.state === "FAILURE"
  );
}

/**
 *
 * @param {string} token
 */
async function main({ token, cursor: initalCursor, limit }) {
  let cursor = initalCursor;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await graphql(
      `
        query($cursor: String, $limit: Int) {
          repository(owner: "mui-org", name: "material-ui") {
            pullRequests(states: MERGED, last: $limit, before: $cursor) {
              nodes {
                title
                url
                commits(first: 100) {
                  nodes {
                    commit {
                      id
                      status {
                        state
                        contexts {
                          context
                          state
                        }
                      }
                    }
                  }
                }
              }
              pageInfo {
                startCursor
              }
            }
          }
        }
      `,
      {
        headers: {
          authorization: `token ${token}`
        },
        cursor,
        limit
      }
    );

    const {
      repository: {
        pullRequests: { nodes: pullRequests, pageInfo }
      }
    } = response;

    for (const pullRequest of pullRequests) {
      const {
        commits: { nodes: commits },
        url
      } = pullRequest;

      const isInterestingPR = commits.some(node => {
        return isCommitOfInterest(node.commit);
      });

      if (isInterestingPR) {
        console.log(`${url}/commits`);
      }
    }

    cursor = pageInfo.startCursor;
    console.log(`resume with ${cursor}`);
  }
}
