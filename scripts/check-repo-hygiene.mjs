import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

function collectLockfiles() {
  const output = execFileSync(
    "find",
    [
      ".",
      "-path",
      "./node_modules",
      "-prune",
      "-o",
      "(",
      "-name",
      "package-lock.json",
      "-o",
      "-name",
      "pnpm-lock.yaml",
      "-o",
      "-name",
      "yarn.lock",
      ")",
      "-print",
    ],
    { encoding: "utf8" },
  );

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
}

const lockfiles = collectLockfiles();

if (lockfiles.length > 0) {
  console.error("Legacy package-manager lockfiles are not allowed in this Bun workspace:");
  for (const file of lockfiles) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

const workflow = execFileSync("sed", ["-n", "1,260p", ".github/workflows/e2e-production.yml"], { encoding: "utf8" });
const forbiddenWorkflowTokens = ["npm ci", "npm run"];
const offenders = forbiddenWorkflowTokens.filter((token) => workflow.includes(token));

if (offenders.length > 0) {
  console.error("Bun workspace drift detected in CI workflow:");
  for (const token of offenders) {
    console.error(`- Found forbidden token: ${token}`);
  }
  process.exit(1);
}

const textFileExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const relativeImportPattern = /from\s+["'](?:\.\.\/)+packages\/shared\//g;

function walkFiles(rootDir) {
  const results = [];
  const entries = readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules") continue;
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath));
      continue;
    }
    const ext = entry.name.slice(entry.name.lastIndexOf("."));
    if (textFileExtensions.has(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

const importDrift = [];

for (const rootDir of ["apps", "e2e", "scripts"]) {
  for (const file of walkFiles(rootDir)) {
    const source = readFileSync(file, "utf8");
    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (relativeImportPattern.test(lines[index])) {
        importDrift.push(`${relative(process.cwd(), file)}:${index + 1}:${lines[index].trim()}`);
      }
      relativeImportPattern.lastIndex = 0;
    }
  }
}

if (importDrift.length > 0) {
  console.error("Workspace import drift detected. Use @intel-dashboard/shared package imports instead:");
  for (const line of importDrift) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log("Repo hygiene checks passed.");
