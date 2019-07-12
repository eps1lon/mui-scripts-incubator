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
  filter: dependent => dependent.stars >= 1,
  // repository memory usage is relatively stable (object with fixed properties)
  maxRepositoriesInMemory: 16 * 8192,
  // file memory usage can vary due to dynamic length
  maxFilesInMemory: 16 * 1024,
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
    maxFilesInMemory,
    maxRepositoriesInMemory,
    onEnd,
    outputPath,
    repository
  } = props;

  const [orgName, repoName] = repository.split("/");

  const [dependents, nextDependent] = useProgress();
  const [dependentsPressure, onDependentsPressureChange] = usePressure();

  const [interesting, nextInteresting] = useProgress();
  const [interestingPressure, onInterestingPressureChange] = usePressure();

  const [latestRefs, nextLatestRef] = useProgress();

  const [downloadedFiles, nextDownloadedFile] = useProgress();
  const [
    downloadedFilesPressure,
    onDownloadedFilesPressureChange
  ] = usePressure();

  const [filesWithUsage, nextFileWithUsage] = useProgress();
  const [
    filesWithUsagePressure,
    onFilesWithUsagePressureChange
  ] = usePressure();

  const [codeUsages, nextCodeUsage] = useProgress();
  const [codeUsagesPressure, onCodeUsagesPressureChange] = usePressure();

  const [isRunning, running] = React.useState(false);
  const [remainingGhApiScore, setRemainingGhApiScore] = React.useState(null);

  React.useEffect(() => {
    running(true);

    pipeline(
      // usedBy
      usedBy(orgName, repoName, {
        onPressureChange: onDependentsPressureChange
      }).on("data", nextDependent),
      // => filterInteresting
      filterInteresting(isInterestingRepository, {
        highWaterMark: maxRepositoriesInMemory,
        onPressureChange: onInterestingPressureChange
      }).on("data", nextInteresting),
      // => usingLatestDefaultRef
      usingLatestDefaultRef(process.env.GITHUB_API_TOKEN, {
        highWaterMark: maxRepositoriesInMemory,
        onRateLimitChange: setRemainingGhApiScore
      }).on("data", nextLatestRef),
      // => downloadRepo
      downloadRepo({
        highWaterMark: maxRepositoriesInMemory,
        onPressureChange: onDownloadedFilesPressureChange
      }).on("data", nextDownloadedFile),
      // => filterUsageFiles
      filterUsageFiles({
        highWaterMark: maxFilesInMemory,
        onPressureChange: onFilesWithUsagePressureChange
      }).on("data", nextFileWithUsage),
      // => filterUsageCode
      filterUsageCode({
        highWaterMark: maxFilesInMemory,
        onPressureChange: onCodeUsagesPressureChange
      }).on("data", nextCodeUsage),
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
          <Pressure {...dependentsPressure} />
          dependents: {dependents.progress} (
          {repositoryToString(dependents.latest)})
        </Box>
      )}
      {interesting.latest && (
        <Box>
          <Pressure {...interestingPressure} />
          interesting repository: {interesting.progress} (
          {repositoryToString(interesting.latest)})
        </Box>
      )}
      {downloadedFiles.latest !== null && (
        <Box>
          <Pressure {...downloadedFilesPressure} />
          downloads: {downloadedFiles.progress}
        </Box>
      )}
      {filesWithUsage.latest !== null && (
        <Box>
          <Pressure {...filesWithUsagePressure} />
          files with usage: {filesWithUsage.progress}
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
