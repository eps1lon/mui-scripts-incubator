const fs = require("fs");
const { render, Color, Box, Text } = require("ink");
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
  // @material-ui/core
  packageId: "UGFja2FnZS00NTUzMzAxNTM",
  filter: dependent => dependent.stars >= 1,
  githubAPIToken: process.env.GITHUB_API_TOKEN,
  // repository memory usage is relatively stable (object with fixed properties)
  maxRepositoriesInMemory: 16 * 8192,
  // file memory usage can vary due to dynamic length
  maxFilesInMemory: 16 * 1024,
  outputPath: path.resolve(process.cwd(), process.argv[2])
}).catch(error => {
  console.error(error);
  process.exit(1);
});

/**
 * @returns {[{done: boolean,latest: T, progress: number}, (next: T) => void]}
 */
function useProgress(initialLatest = null) {
  const [state, dispatch] = React.useReducer(
    (prevState, action) => {
      switch (action.type) {
        case "done":
          return { ...prevState, done: true };
        case "next":
          return {
            latest: action.payload,
            progress: prevState.progress + 1,
            done: false
          };
        default:
          throw new Error(`unrecognized action '${action.type}'`);
      }
    },
    {
      done: false,
      progress: 0,
      latest: initialLatest
    }
  );

  const setNext = React.useCallback(next =>
    dispatch({ type: "next", payload: next })
  );

  function setDone() {
    dispatch({ type: "done" });
  }

  return [state, setNext, setDone];
}

function usePressure() {
  const [readable, setReadable] = React.useState(0.0);
  const [writeable, setWriteable] = React.useState(0.0);

  return [
    { readable, writeable },
    function onPressureChange(nextReadable, nextWriteable) {
      setReadable(nextReadable);
      setWriteable(nextWriteable);
    }
  ];
}

function PressureMeter(props) {
  const { prefix, value } = props;

  return (
    <Box width={15}>
      <Text>{prefix}: </Text>
      <Color rgb={[255 * value, 255 * (1 - value), 0]}>
        {"█".repeat(Math.ceil(value * 10))}
      </Color>
    </Box>
  );
}

/**
 * Renders the given pressure as a progress bar. High pressure is red, low is green
 * @param {object} props
 */
function Pressure(props) {
  const { readable, writeable } = props;

  return (
    <React.Fragment>
      <PressureMeter prefix="R" value={readable} />
      <PressureMeter prefix="W" value={writeable} />
    </React.Fragment>
  );
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
    githubAPIToken,
    maxFilesInMemory,
    maxRepositoriesInMemory,
    onEnd,
    onError,
    outputPath,
    packageId,
    repository
  } = props;

  const [orgName, repoName] = repository.split("/");

  const [dependents, nextDependent, dependentsDone] = useProgress();
  const [dependentsPressure, onDependentsPressureChange] = usePressure();

  const [interesting, nextInteresting, interestingDone] = useProgress();
  const [interestingPressure, onInterestingPressureChange] = usePressure();

  const [latestRefs, nextLatestRef, latestRefsDone] = useProgress();

  const [
    downloadedFiles,
    nextDownloadedFile,
    downloadedFilesDone
  ] = useProgress();
  const [
    downloadedFilesPressure,
    onDownloadedFilesPressureChange
  ] = usePressure();

  const [filesWithUsage, nextFileWithUsage, filesWithUsageDone] = useProgress();
  const [
    filesWithUsagePressure,
    onFilesWithUsagePressureChange
  ] = usePressure();

  const [codeUsages, nextCodeUsage, codeUsagesDone] = useProgress();
  const [codeUsagesPressure, onCodeUsagesPressureChange] = usePressure();

  const [isRunning, running] = React.useState(false);
  const [remainingGhApiScore, setRemainingGhApiScore] = React.useState(null);

  React.useEffect(() => {
    running(true);

    pipeline(
      // usedBy
      usedBy(orgName, repoName, {
        onPressureChange: onDependentsPressureChange,
        packageId
      })
        .on("data", nextDependent)
        .on("end", dependentsDone),
      // => filterInteresting
      filterInteresting(isInterestingRepository, {
        highWaterMark: maxRepositoriesInMemory,
        onPressureChange: onInterestingPressureChange
      })
        .on("data", nextInteresting)
        .on("end", interestingDone),
      // => usingLatestDefaultRef
      usingLatestDefaultRef(githubAPIToken, {
        highWaterMark: maxRepositoriesInMemory,
        onRateLimitChange: setRemainingGhApiScore
      })
        .on("data", nextLatestRef)
        .on("end", latestRefsDone),
      // => downloadRepo
      downloadRepo({
        highWaterMark: maxRepositoriesInMemory,
        onPressureChange: onDownloadedFilesPressureChange
      })
        .on("data", nextDownloadedFile)
        .on("end", downloadedFilesDone),
      // => filterUsageFiles
      filterUsageFiles({
        highWaterMark: maxFilesInMemory,
        onPressureChange: onFilesWithUsagePressureChange
      })
        .on("data", nextFileWithUsage)
        .on("end", filesWithUsageDone),
      // => filterUsageCode
      filterUsageCode({
        highWaterMark: maxFilesInMemory,
        onPressureChange: onCodeUsagesPressureChange
      })
        .on("data", nextCodeUsage)
        .on("end", codeUsagesDone),
      // => jsonOutput
      JSONStream.stringify("[\n", "\n,", "\n]\n"),
      fs.createWriteStream(outputPath)
    )
      .then(onEnd, onError)
      .finally(() => {
        running(false);
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
          <Pressure {...dependentsPressure} />
          dependents: {dependents.progress}
          {dependents.done && " - done"} (
          {repositoryToString(dependents.latest)})
        </Box>
      )}
      {interesting.latest && (
        <Box>
          <Pressure {...interestingPressure} />
          interesting repository: {interesting.progress}
          {interesting.done && " - done"} (
          {repositoryToString(interesting.latest)})
        </Box>
      )}
      {downloadedFiles.latest !== null && (
        <Box>
          <Pressure {...downloadedFilesPressure} />
          downloads: {downloadedFiles.progress}
          {downloadedFiles.done && " - done"}
        </Box>
      )}
      {filesWithUsage.latest !== null && (
        <Box>
          <Pressure {...filesWithUsagePressure} />
          files with usage: {filesWithUsage.progress}
          {filesWithUsage.done && " - done"}
        </Box>
      )}
    </Box>
  );
}

/**
 *
 * @param {object} param0
 * @param {string} param0.repository
 * @param {(repository: object) => boolean} param0.filter
 * @param {string} param0.githubAPIToken
 * @param {number} param0.maxFilesInMemory
 * @param {number} param0.maxRepositoriesInMemory
 * @param {string} param0.outputPath
 * @param {string} param0.packageId
 */
function main({
  repository,
  filter,
  githubAPIToken,
  maxFilesInMemory,
  maxRepositoriesInMemory,
  outputPath,
  packageId
}) {
  return new Promise((resolve, reject) => {
    render(
      <Main
        key={repository}
        repository={repository}
        githubAPIToken={githubAPIToken}
        isInterestingRepository={filter}
        maxFilesInMemory={maxFilesInMemory}
        maxRepositoriesInMemory={maxRepositoriesInMemory}
        outputPath={outputPath}
        onEnd={resolve}
        onError={reject}
        packageId={packageId}
      />
    );
  });
}
