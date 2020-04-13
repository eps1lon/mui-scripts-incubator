const fs = require("fs");
const Ink = require("ink");
const JSONStream = require("JSONStream");
const path = require("path");
const React = require("react");
const stream = require("stream");
const yargs = require("yargs");

// we analyze each file by looking for "Things" each things is something we're
// interested in e.g. a callsite or props usage etc
// here: list all files that use component hooks
const findThings = findComponentHooksUsage;
const Things = FileThings;

function findComponentHooksUsage(file) {
  const { source } = file;
  const importsFromLab = source.indexOf("@material-ui/lab") !== -1;
  const usesAutoComplete = source.indexOf("useAutocomplete") !== -1;
  const usesComponentHook = importsFromLab && usesAutoComplete;

  if (usesComponentHook) {
    return [file];
  }
  return [];
}

function FileThings(props) {
  const { things: files } = props;

  return (
    <Ink.Box>
      <Ink.Static>
        {files.map((file, index) => {
          return (
            <Ink.Text key={index}>
              <FileUrl file={file} />
            </Ink.Text>
          );
        })}
      </Ink.Static>
      {/* <Ink.Text>Files found: {files.length}</Ink.Text> */}
    </Ink.Box>
  );
}
function FileUrl({ file }) {
  return `https://github.com/${file.repository.orgName}/${file.repository.repoName}/blob/${file.repository.ref}/${file.name}`;
}

yargs
  .command({
    command: "$0 usageDataFile",
    describe:
      "Analyse repo usages given a usageDataFile produced by used-by/main",
    builder: command => {
      return command.positional("usageDataFile", {
        describe: "path to the file that contains the usage data",
        type: "string"
      });
    },
    handler: argv => {
      const { usageDataFile } = argv;

      Ink.render(
        <Main
          Things={Things}
          findThings={findThings}
          usageDataFile={path.resolve(usageDataFile)}
        />,
        {
          experimental: true,
          stdout: fs.createWriteStream(path.resolve("files.log"))
        }
      );
    }
  })
  .help()
  .strict(true)
  .version(false)
  .parse();

function Main(props) {
  const { Things, findThings, usageDataFile } = props;

  const [things, setThings] = React.useState([]);
  const [fileTally, setFileTally] = React.useState(0);
  const [repos, setRepos] = React.useState(new Set());

  React.useEffect(() => {
    setThings([]);
    setFileTally(0);
    setRepos(new Set());

    let current = true;
    const inputStream = fs
      .createReadStream(usageDataFile)
      .pipe(JSONStream.parse("*"))
      .pipe(
        new stream.PassThrough({
          objectMode: true,
          write(file, encoding, callback) {
            setRepos(prevRepos => {
              const nextRepos = new Set(prevRepos);
              nextRepos.add(
                `${file.repository.orgName}/${file.repository.repoName}`
              );
              return nextRepos;
            });
            setFileTally(f => f + 1);

            const newThings = findThings(file);
            setThings(prevThings => {
              return prevThings.concat(newThings);
            });

            callback();
          }
        })
      );

    return () => {
      current = false;
      inputStream.close();
    };
  }, [usageDataFile]);

  return (
    <React.Fragment>
      <Things things={things} />
      {/* <Ink.Text>Repos: {repos.size}</Ink.Text>
      <Ink.Text>Files analyzed: {fileTally}</Ink.Text> */}
    </React.Fragment>
  );
}
