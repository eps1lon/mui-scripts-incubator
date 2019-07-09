#!/usr/bin/env node
/* eslint-disable no-console */
const cheerio = require("cheerio");
const fs = require("fs");
const JSONStream = require("JSONStream");
const fetch = require("node-fetch");
const path = require("path");

main({ delay: 3000, output: path.join(__dirname, "../result.json") });

async function main({ delay, output }) {
  const outputStream = JSONStream.stringify("[\n", "\n,", "\n]\n");
  outputStream.pipe(fs.createWriteStream(output));

  const startUrl =
    "https://github.com/mui-org/material-ui/network/dependents?dependent_type=REPOSITORY";

  for await (const result of getResult(startUrl, { delay })) {
    outputStream.write(result);
  }

  outputStream.end();
}

async function* getResult(url, { delay }) {
  let cursor = url;

  while (cursor !== null) {
    console.log(`fetching ${cursor}`);
    const response = await fetch(cursor);
    const body = await response.text();
    const $ = cheerio.load(body);

    const items = $("#dependents .Box .flex-items-center").get();
    for (const item of items) {
      const $item = $(item);

      const $links = $item.find("span a");
      if ($links.length !== 2) {
        yield { error: "not enough links" };
      } else {
        // $links.map() throws on second pass
        const [orgName, repoName] = $links.get().map(link => {
          return $(link).text();
        });
        const [, stars, forks] = $item
          .find("div > span")
          .get()
          .map(element => {
            return +$(element)
              .text()
              .trim();
          });

        yield { orgName, repoName, stars, forks };
      }
    }

    const paginationLinks = $(".paginate-container a").get();
    const nextLink = paginationLinks.find(
      link =>
        $(link)
          .text()
          .trim()
          .toLowerCase() === "next"
    );
    cursor = nextLink === undefined ? null : $(nextLink).attr("href");

    await sleep(delay);
  }

  return;
}

function sleep(timeout) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), timeout);
  });
}
