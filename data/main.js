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

const jsx = React.createElement;

const pipeline = util.promisify(stream.pipeline);

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

function Main(props) {
  const { isInterestingRepository, onEnd, outputPath } = props;

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
      usedBy("mui-org", "material-ui").on("data", nextDependent),
      filterInteresting(isInterestingRepository).on("data", nextInteresting),
      usingLatestDefaultRef(
        process.env.GITHUB_API_TOKEN,
        setRemainingGhApiScore
      ).on("data", nextLatestRef),
      downloadRepo().on("data", nextDownloadedFile),
      filterUsageFiles().on("data", nextFileWithUsage),
      filterUsageCode().on("data", nextCodeUsage),
      JSONStream.stringify("[\n", "\n,", "\n]\n"),
      fs.createWriteStream(outputPath)
    ).then(() => {
      running(false);
      onEnd();
    });
  }, [outputPath]);

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

render(
  <Main
    isInterestingRepository={repository => repository.stars >= 100}
    outputPath={path.resolve(process.cwd(), process.argv[2])}
    onEnd={() => console.log("done")}
  />
);
