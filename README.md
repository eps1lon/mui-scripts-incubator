# mui-scripts

material-ui scripts incubator

## install

In your .npmrc:

```
@eps1lon:registry=https://npm.pkg.github.com/
```

```bash
$ yarn global add @eps1lon/mui-scripts
```

If you don't want to install the package globally you can use `npx` instead:

```diff
- $ mui-lighthouse
+ $ npx -p @eps1lon/mui-scripts mui-lighthouse
```

## lighthouse audit

```sh
# audit specific pr
$ mui lighthouse $PR_NUMBER
# audit master
$ mui lighthouse
```
