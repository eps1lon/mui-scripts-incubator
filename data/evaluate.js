#!/usr/bin/env node
/* eslint-disable no-console */

const fse = require("fs-extra");
const path = require("path");

main().catch(err => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const rawPath = path.join(__dirname, "./used-by-repositories.json");
  const raw = await fse.readJSON(rawPath);

  const interesting = raw
    .filter(repository => repository.stars > 5)
    .sort((a, b) => b.stars - a.stars);
  
}
