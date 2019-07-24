# mui-scripts

material-ui scripts incubator

## install

```bash
$ yarn global add @eps1lon/mui-scripts
```

If you don't want to install the package globally you can use `npx` instead:

```diff
- $ @eps1lon/mui-scripts
+ $ npx @eps1lon/mui-scripts
```

## usage

```bash
$ @eps1lon/mui-scripts --help
entrypoint.js [command]

Commands:
  entrypoint.js lighthouse-audit            audit pages with lighthouse
  [pr-number]

Options:
  --version  Show version number                                       [boolean]
  --help     Show help                                                 [boolean]
```

## lighthouse audit

```sh
# audit specific pr
$ @eps1lon/mui-scripts lighthouse-audit $PR_NUMBER > $PR_NUMBER.json
# audit master
$ @eps1lon/mui-scripts lighthouse-audit > master.json
```
