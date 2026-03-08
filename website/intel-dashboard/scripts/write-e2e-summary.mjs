import { existsSync, readFileSync } from "node:fs";

const logPath = process.argv[2];
if (!logPath) {
  throw new Error("Usage: node scripts/write-e2e-summary.mjs <log-path>");
}

if (!existsSync(logPath)) {
  throw new Error(`Log file not found: ${logPath}`);
}

const log = readFileSync(logPath, "utf8");
const lines = log.split(/\r?\n/);

function createEmptySection() {
  return {
    tests: null,
    pass: null,
    fail: null,
    skipped: null,
    todo: null,
    cancelled: null,
  };
}

const sections = {
  fetch: createEmptySection(),
  browser: createEmptySection(),
};

let current = null;
for (const line of lines) {
  if (line.includes("> test:e2e:browser")) {
    current = "browser";
    continue;
  }
  if (line.includes("> test:e2e")) {
    current = "fetch";
    continue;
  }
  if (!current) continue;

  const match = line.match(/^ℹ (tests|pass|fail|skipped|todo|cancelled) (\d+)/);
  if (match) {
    sections[current][match[1]] = Number(match[2]);
  }
}

function formatSection(name, stats) {
  return `| ${name} | ${stats.tests ?? "-"} | ${stats.pass ?? "-"} | ${stats.fail ?? "-"} | ${stats.skipped ?? "-"} | ${stats.todo ?? "-"} | ${stats.cancelled ?? "-"} |`;
}

const markdown = [
  "## E2E Summary",
  "",
  "| Suite | Tests | Pass | Fail | Skipped | Todo | Cancelled |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  formatSection("Fetch E2E", sections.fetch),
  formatSection("Browser E2E", sections.browser),
  "",
].join("\n");

console.log(markdown);

if (process.env.GITHUB_STEP_SUMMARY) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  await import("node:fs/promises").then(({ appendFile }) => appendFile(summaryPath, `${markdown}\n`));
}
