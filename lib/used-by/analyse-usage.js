const fs = require("fs");
const JSONStream = require("JSONStream");
const path = require("path");
const stream = require("stream");
const yargs = require("yargs");
const babel = require("@babel/core");
const traverse = require("@babel/traverse").default;

// we analyze each file by looking for "Things" each things is something we're
// interested in e.g. a callsite or props usage etc
// here: list all files that use component hooks
// const findThings = findComponentHooksUsage;
// here: list all files that use the `Select` component
const findThings = findSelectComponentUsage;
const Things = SelectUsageThing;

// eslint-disable-next-line no-unused-vars -- can be used by config
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

function findSelectComponentUsage(file) {
	const { source } = file;
	const importsFromCore = source.indexOf("@material-ui/core") !== -1;
	const mentionsSelect = /\s+Select\s+/.test(source);

	if (importsFromCore && mentionsSelect) {
		let ast;
		try {
			ast = babel.parse(source, {
				ast: true,
				filename: file.name,
				presets: [
					[require.resolve("@babel/preset-env"), { shippedProposals: true }],
					require.resolve("@babel/preset-react"),
					require.resolve("@babel/preset-flow"),
					require.resolve("@babel/preset-typescript"),
				],
			});
		} catch (error) {
			console.warn(`${fileToString(file)} ${error.message}`);
		}

		let referencePaths = [];
		// find all references to `@material-ui/core#Select`
		// supports:
		// - `import MySelect from '@material-ui/core/Select'`
		// - `import { Select as MySelect } from '@material-ui/core'`
		traverse(ast, {
			ImportDeclaration(path) {
				let binding = null;

				if (path.get("source.value").node === "@material-ui/core/Select") {
					const importedName = path.get("specifiers")[0].get("local.name").node;
					binding = path.scope.bindings[importedName];
				} else if (path.get("source.value").node === "@material-ui/core") {
					path.get("specifiers").forEach((specifierPath) => {
						const {
							node: { imported: { name } = {} },
						} = specifierPath;
						if (name === "Select") {
							const importedName = specifierPath.get("local.name").node;
							binding = path.scope.bindings[importedName];
						}
					});
				}

				if (binding != null) {
					referencePaths = binding.referencePaths;
				}
			},
		});

		return referencePaths
			.map((referencePath) => {
				if (
					babel.types.isJSXIdentifier(referencePath.node) &&
					babel.types.isJSXOpeningElement(referencePath.parentPath.node)
				) {
					const elementPath = referencePath.parentPath.parentPath;

					const usesElements =
						elementPath.get("children").find((childPath) => {
							return babel.types.isJSXElement(childPath.node);
						}) !== undefined;

					const spreadsProps =
						referencePath.parentPath.get("attributes").find((attributePath) => {
							return babel.types.isJSXSpreadAttribute(attributePath.node);
						}) !== undefined;

					const attributes = referencePath.parentPath
						.get("attributes")
						.filter((attributePath) => {
							return babel.types.isJSXAttribute(attributePath.node);
						})
						.map((attributePath) => {
							const name = attributePath.get("name");
							const value = attributePath.get("value");
							return [
								name.get("name").node,
								value.node === null
									? // expand boolean shorthand
									  "{true}"
									: source.slice(value.node.start, value.node.end),
							];
						});

					return {
						line: referencePath.node.loc.start.line,
						usesElements,
						attributes: Object.fromEntries(attributes),
						spreadsProps,
					};
				}

				return null;
			})
			.filter((maybeAnalysis) => maybeAnalysis !== null)
			.map(({ line, ...rest }) => {
				return {
					...file,
					// github fragment link for line of callsite
					name: `${file.name}#L${line}`,
					...rest,
				};
			});
	}

	return [];
}

function SelectUsageThing(props) {
	const { things: filesWithData } = props;

	filesWithData.forEach((file) => {
		console.log(
			JSON.stringify({
				file: FileUrl({ file }),
				usesElements: file.usesElements,
				spreadsProps: file.spreadsProps,
				attributes: file.attributes,
			}) + ","
		);
	});
}

// eslint-disable-next-line no-unused-vars -- can be used by config
function FileThings(props) {
	const { things: files } = props;

	files.forEach((file) => {
		FileUrl({ file });
	});
}
function FileUrl({ file }) {
	return fileToString(file);
}

function fileToString(file) {
	return `https://github.com/${file.repository.orgName}/${file.repository.repoName}/blob/${file.repository.ref}/${file.name}`;
}

function render({ findThings, Things, usageDataFile }) {
	fs.createReadStream(usageDataFile)
		.pipe(JSONStream.parse("*"))
		.pipe(
			new stream.PassThrough({
				objectMode: true,
				write(file, encoding, callback) {
					const newThings = findThings(file);
					Things({ things: newThings });

					callback();
				},
			})
		);
}

yargs
	.command({
		command: "$0 usageDataFile",
		describe:
			"Analyse repo usages given a usageDataFile produced by used-by/main",
		builder: (command) => {
			return command.positional("usageDataFile", {
				describe: "path to the file that contains the usage data",
				type: "string",
			});
		},
		handler: (argv) => {
			const { usageDataFile } = argv;

			render({
				findThings,
				Things,
				usageDataFile: path.resolve(usageDataFile),
			});
		},
	})
	.help()
	.strict(true)
	.version(false)
	.parse();
