const fs = require("fs");
const { render, Color, Box } = require("ink");
const JSONStream = require("JSONStream");
const path = require("path");
const React = require("react");
const stream = require("stream");
const util = require("util");
const usedBy = require("./streams/usedBy");
const filterInteresting = require("./streams/filterInteresting");
const downloadRepo = require("./streams/downloadRepo");
const filterUsageFiles = require("./streams/filterUsageFiles");
const filterUsageCode = require("./streams/filterUsageCode");
const usingLatestDefaultRef = require("./streams/usingLatestDefaultRef");

const pipeline = util.promisify(stream.pipeline);

main({
  repository: "mui-org/material-ui",
  filter: dependent => dependent.stars >= 0,
  // repository memory usage is relatively stable (object with fixed properties)
  maxRepositoriesInMemory: 16 * 64,
  // file memory usage can vary due to dynamic length
  maxFilesInMemory: 16 * 64,
  outputPath: path.resolve(process.cwd(), process.argv[2])
});

/**
 * @returns {[{latest: T, progress: number}, (next: T) => void]}
 */
function useProgress(initialLatest = null) {
  const [state, dispatch] = React.useReducer(
    (prevState, action) => {
      switch (action.type) {
        case "next":
          return { latest: action.payload, progress: prevState.progress + 1 };
        default:
          throw new Error(`unrecognized action '${action.type}'`);
      }
    },
    {
      progress: 0,
      latest: initialLatest
    }
  );

  const setNext = React.useCallback(next =>
    dispatch({ type: "next", payload: next })
  );

  return [state, setNext];
}

/**
 *
 * @param {{orgName: string, repoName: string} | null} repository
 * @returns {string}
 */
function repositoryToString(repository) {
  if (repository === null) {
    return "null";
  }
  return `${repository.orgName}/${repository.repoName}`;
}

/**
 * never change props, to be sure encode all props in a `key`
 *
 * usedBy => filterInteresting => usingLatestDefaultRef => downloadRepo => filterUsageFiles
 * => filterUsageCode => JSON output
 */
function Main(props) {
  const {
    isInterestingRepository,
    maxFilesInMemory,
    maxRepositoriesInMemory,
    onEnd,
    outputPath,
    repository
  } = props;

  const [orgName, repoName] = repository.split("/");

  const [dependents, nextDependent] = useProgress();
  const [interesting, nextInteresting] = useProgress();
  const [latestRefs, nextLatestRef] = useProgress();
  const [downloadedFiles, nextDownloadedFile] = useProgress();
  const [filesWithUsage, nextFileWithUsage] = useProgress();
  const [codeUsages, nextCodeUsage] = useProgress();
  const [isRunning, running] = React.useState(false);
  const [remainingGhApiScore, setRemainingGhApiScore] = React.useState(null);

  React.useEffect(() => {
    running(true);

    pipeline(
      // usedBy
      usedBy(orgName, repoName).on("data", nextDependent),
      // => filterInteresting
      filterInteresting(isInterestingRepository, {
        highWaterMark: maxRepositoriesInMemory
      }).on("data", nextInteresting),
      // => usingLatestDefaultRef
      usingLatestDefaultRef(process.env.GITHUB_API_TOKEN, {
        highWaterMark: maxRepositoriesInMemory,
        onRateLimitChange: setRemainingGhApiScore
      }).on("data", nextLatestRef),
      // => downloadRepo
      downloadRepo({ highWaterMark: maxRepositoriesInMemory }).on(
        "data",
        nextDownloadedFile
      ),
      // => filterUsageFiles
      filterUsageFiles({ highWaterMark: maxFilesInMemory }).on(
        "data",
        nextFileWithUsage
      ),
      // => filterUsageCode
      filterUsageCode({ highWaterMark: maxFilesInMemory }).on(
        "data",
        nextCodeUsage
      ),
      // => jsonOutput
      JSONStream.stringify("[\n", "\n,", "\n]\n"),
      fs.createWriteStream(outputPath)
    ).then(() => {
      running(false);
      onEnd();
    });

    // TODO return pipeline close?
  }, []);

  return (
    <Box flexDirection="column">
      <Box>
        Remaining GitHub API score:{" "}
        <Color rgb={remainingGhApiScore > 100 ? [0, 255, 0] : [255, 0, 0]}>
          {remainingGhApiScore === null
            ? "??"
            : remainingGhApiScore.toLocaleString()}
        </Color>
      </Box>
      {dependents.latest && (
        <Box>
          dependents: {dependents.progress} (
          {repositoryToString(dependents.latest)})
        </Box>
      )}
      {interesting.latest && (
        <Box>
          interesting repository: {interesting.progress} (
          {repositoryToString(interesting.latest)})
        </Box>
      )}
      {downloadedFiles.latest !== null && (
        <Box>
          downloads: {downloadedFiles.progress} (
          {downloadedFiles.latest.entry.path})
        </Box>
      )}
      {filesWithUsage.latest !== null && (
        <React.Fragment>
          <Box>
            files with usage: {filesWithUsage.progress} (
            {filesWithUsage.latest.name})
          </Box>
        </React.Fragment>
      )}
    </Box>
  );
}

/**
 *
 * @param {object} param0
 * @param {string} param0.repository
 * @param {(repository: object) => boolean} param0.filter
 * @param {number} param0.maxFilesInMemory
 * @param {number} param0.maxRepositoriesInMemory
 * @param {string} param0.outputPath
 */
function main({
  repository,
  filter,
  maxFilesInMemory,
  maxRepositoriesInMemory,
  outputPath
}) {
  return new Promise(resolve => {
    render(
      <Main
        key={repository}
        repository={repository}
        isInterestingRepository={filter}
        maxFilesInMemory={maxFilesInMemory}
        maxRepositoriesInMemory={maxRepositoriesInMemory}
        outputPath={outputPath}
        onEnd={() => resolve()}
      />
    );
  });
}
