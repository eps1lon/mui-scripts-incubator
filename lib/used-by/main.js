const fs = require("fs");
const { render, Color, Box, Text } = require("ink");
const JSONStream = require("JSONStream");
const path = require("path");
const React = require("react");
const stream = require("stream");
const util = require("util");
const yargs = require("yargs");
const usedByLive = require("./streams/usedByLive");
const usedBySnapshot = require("./streams/usedBySnapshot");
const filterInteresting = require("./streams/filterInteresting");
const downloadRepo = require("./streams/downloadRepo");
const filterUsageFiles = require("./streams/filterUsageFiles");
const filterUsageCode = require("./streams/filterUsageCode");
const usingLatestDefaultRef = require("./streams/usingLatestDefaultRef");

const pipeline = util.promisify(stream.pipeline);

yargs
	.command({
		command: "$0 outputPath",
		describe: "creates JSON file containing all dependend repositories",
		builder: (command) => {
			return command
				.positional("outputPath", {
					describe: "path to the file that should be written",
					type: "string",
				})
				.option("usedBySnapshotFile", {
					default: false,
					describe: "Path the used by snapshot that should be used",
					type: "string",
				});
		},
		handler: (argv) => {
			const { outputPath, usedBySnapshotFile } = argv;

			function usedBy({ onPressureChange }) {
				if (usedBySnapshotFile) {
					return usedBySnapshot(path.resolve(usedBySnapshotFile));
				}

				const repository = "mui-org/material-ui";
				const [orgName, repoName] = repository.split("/");
				// @material-ui/core
				const packageId = "UGFja2FnZS00NTUzMzAxNTM";
				return usedByLive(orgName, repoName, { onPressureChange, packageId });
			}

			return main({
				filter: (dependent) => dependent.stars >= 1,
				githubAPIToken: process.env.GITHUB_API_TOKEN,
				// repository memory usage is relatively stable (object with fixed properties)
				maxRepositoriesInMemory: 1024,
				// file memory usage can vary due to dynamic length
				maxFilesInMemory: 1024,
				outputPath: path.resolve(outputPath),
				usedBy,
			});
		},
	})
	.help()
	.strict(true)
	.version(false)
	.parse();

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
						latest: action.payload.slice(-1)[0],
						progress: prevState.progress + action.payload.length,
						done: false,
					};
				default:
					throw new Error(`unrecognized action '${action.type}'`);
			}
		},
		{
			done: false,
			progress: 0,
			latest: initialLatest,
		}
	);

	const batchRef = React.useRef([]);
	const batchUpdateRef = React.useRef(null);

	// throttled at 30fps
	const setNext = React.useCallback((next) => {
		if (batchUpdateRef.current === null) {
			batchUpdateRef.current = setTimeout(() => {
				const { current: batch } = batchRef;
				batchRef.current = [];
				batchUpdateRef.current = null;
				dispatch({ type: "next", payload: batch });
			}, 1000 / 30);
		}
		batchRef.current.push(next);
	});

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
		},
	];
}

function PressureMeter(props) {
	const { prefix, value } = props;

	return (
		<Box width={19}>
			<Text>{prefix}: </Text>
			<Box alignItems="flex-end" justifyContent="space-between" width={200}>
				<FloatColor rgb={[255 * value, 255 * (1 - value), 0]}>
					{"█".repeat(Math.round(Math.min(10, value * 10))).padEnd(10, " ")}
				</FloatColor>
				<Text>
					{Math.round(value * 100)
						.toString()
						.padStart(4, " ")}
					%
				</Text>
			</Box>
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
	return ellipsis(`${repository.orgName}/${repository.repoName}`, 15);
}
function ellipsis(text, maxLength) {
	if (text.length > maxLength) {
		return `${text.slice(0, maxLength - 3)}…${text.slice(-3)}`;
	}
	return text;
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
		usedBy,
	} = props;

	const [dependents, nextDependent, dependentsDone] = useProgress();
	const [dependentsPressure, onDependentsPressureChange] = usePressure();

	const [interesting, nextInteresting, interestingDone] = useProgress();
	const [interestingPressure, onInterestingPressureChange] = usePressure();

	const [latestRefs, nextLatestRef, latestRefsDone] = useProgress();
	const [latestRefsPressure, onLatestRefsPressureChange] = usePressure();

	const [downloadedFiles, nextDownloadedFile, downloadedFilesDone] =
		useProgress();
	const [downloadedFilesPressure, onDownloadedFilesPressureChange] =
		usePressure();

	const [filesWithUsage, nextFileWithUsage, filesWithUsageDone] = useProgress();
	const [filesWithUsagePressure, onFilesWithUsagePressureChange] =
		usePressure();

	const [, nextCodeUsage, codeUsagesDone] = useProgress();
	const [, onCodeUsagesPressureChange] = usePressure();

	const [remainingGhApiScore, setRemainingGhApiScore] = React.useState(null);

	React.useEffect(() => {
		const debugLog = fs.createWriteStream("debug.log", { encoding: "utf8" });
		const debug = (message) => debugLog.write(`${message}\n`);

		pressurePipeline(
			// usedBy
			usedBy({
				onPressureChange: onDependentsPressureChange,
			})
				.on("error", (error) => {
					onError(`usedBy error: \n${error}`);
				})
				.on("data", nextDependent)
				.on("end", dependentsDone),
			// => filterInteresting
			filterInteresting(isInterestingRepository, {
				highWaterMark: maxRepositoriesInMemory,
				onPressureChange: onInterestingPressureChange,
			})
				.on("error", (error) => {
					onError(`filterInteresting error: \n${error}`);
				})
				.on("data", nextInteresting)
				.on("end", interestingDone),
			// => usingLatestDefaultRef
			usingLatestDefaultRef(githubAPIToken, {
				debug,
				highWaterMark: maxRepositoriesInMemory,
				onRateLimitChange: setRemainingGhApiScore,
				onPressureChange: onLatestRefsPressureChange,
			})
				.on("error", (error) => {
					onError(`usingLatestDefaultRef error: \n${error}`);
				})
				.on("data", nextLatestRef)
				.on("end", latestRefsDone),
			// => downloadRepo
			downloadRepo({
				highWaterMark: maxRepositoriesInMemory,
				onPressureChange: onDownloadedFilesPressureChange,
			})
				.on("error", (error) => {
					onError(`downloadRepo error: \n${error}`);
				})
				.on("data", nextDownloadedFile)
				.on("end", downloadedFilesDone),
			// => filterUsageFiles
			filterUsageFiles({
				highWaterMark: maxFilesInMemory,
				onPressureChange: onFilesWithUsagePressureChange,
			})
				.on("error", (error) => {
					onError(`usedBy error: \n${error}`);
				})
				.on("data", nextFileWithUsage)
				.on("end", filesWithUsageDone),
			// => filterUsageCode
			filterUsageCode({
				highWaterMark: maxFilesInMemory,
				onPressureChange: onCodeUsagesPressureChange,
			})
				.on("error", (error) => {
					onError(`filterUsageCode error:\n ${error}`);
				})
				.on("data", nextCodeUsage)
				.on("end", codeUsagesDone),
			// => jsonOutput
			JSONStream.stringify("[\n", "\n,", "\n]\n").on("error", (error) => {
				onError(`stringifying JSON error:\n ${error}`);
			}),
			fs.createWriteStream(outputPath).on("error", (error) => {
				onError(`writing to ${outputPath} error:\n ${error}`);
			})
		).then(onEnd, onError);

		// TODO return pipeline close?
		() => {
			debugLog.close();
			console.log("unmount");
		};
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
			<Text>Pipeline: </Text>
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
			{latestRefs.latest !== null && (
				<Box>
					<Pressure {...latestRefsPressure} />
					repo refs fetched: {latestRefs.progress}
					{latestRefs.done && " - done"}
				</Box>
			)}
			{downloadedFiles.latest !== null && (
				<Box>
					<Pressure {...downloadedFilesPressure} />
					downloaded files: {downloadedFiles.progress}
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
	filter,
	githubAPIToken,
	maxFilesInMemory,
	maxRepositoriesInMemory,
	outputPath,
	usedBy,
}) {
	return new Promise((resolve, reject) => {
		render(
			<Main
				githubAPIToken={githubAPIToken}
				isInterestingRepository={filter}
				maxFilesInMemory={maxFilesInMemory}
				maxRepositoriesInMemory={maxRepositoriesInMemory}
				outputPath={outputPath}
				onEnd={resolve}
				onError={reject}
				usedBy={usedBy}
			/>,
			{ debug: false }
		);
	});
}

function FloatColor({ children, rgb }) {
	return (
		<Color
			rgb={rgb.map((color) => Math.max(0, Math.min(255, Math.round(color))))}
		>
			{children}
		</Color>
	);
}

/**
 * Will resume readable stream as soon as the piped stream is writable again.
 * By default node will wait for the `drain` event to start reading again
 * @param  {...import('stream').Transform} streams
 */
function pressurePipeline(...streams) {
	return pipeline(
		...streams.map((stream, index) => {
			const previous = streams[index - 1];
			if (previous !== undefined) {
				stream.on("data", () => {
					const previousResumable = previous.isPaused && previous.isPaused();
					// <= means pressures stays at >100%
					// < means pressures stays below 100%
					const streamCanBeFilled =
						stream.writableLength <= stream.writableHighWaterMark;

					if (previousResumable && streamCanBeFilled) {
						previous.resume();
					}
				});
			}
			return stream;
		})
	);
}
