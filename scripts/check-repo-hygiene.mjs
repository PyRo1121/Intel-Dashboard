import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const LEGACY_LOCKFILES = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

export function collectLockfiles(rootDir = ".") {
  const results = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (LEGACY_LOCKFILES.has(entry.name)) {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

export function collectWorkflowFiles(rootDir = ".github/workflows") {
  return readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml")))
    .map((entry) => join(rootDir, entry.name))
    .sort();
}

export function collectWorkflowPackageManagerDrift(
  workflowFiles,
  forbiddenTokens = ["npm ci", "npm run", "npm install"],
) {
  const offenders = [];
  for (const workflowFile of workflowFiles) {
    const workflow = readFileSync(workflowFile, "utf8");
    for (const token of forbiddenTokens) {
      if (workflow.includes(token)) {
        offenders.push({ workflowFile, token });
      }
    }
  }
  return offenders;
}

const textFileExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const relativeImportPattern =
  /\b(?:from|import(?:\s*\(|\s+)|require\s*\()\s*["'](?:\.\.\/)+packages\/shared(?:\/|["'])/;

export function walkFiles(rootDir) {
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

export function collectSharedImportDrift(rootDirs = ["apps", "e2e", "scripts"]) {
  const importDrift = [];
  for (const rootDir of rootDirs) {
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
  return importDrift;
}

export function runRepoHygieneChecks() {
  const lockfiles = collectLockfiles();
  if (lockfiles.length > 0) {
    console.error("Legacy package-manager lockfiles are not allowed in this Bun workspace:");
    for (const file of lockfiles) {
      console.error(`- ${file}`);
    }
    process.exit(1);
  }

  const workflowOffenders = collectWorkflowPackageManagerDrift(collectWorkflowFiles());
  if (workflowOffenders.length > 0) {
    console.error("Bun workspace drift detected in GitHub Actions workflows:");
    for (const offender of workflowOffenders) {
      console.error(`- ${offender.workflowFile}: found forbidden token ${offender.token}`);
    }
    process.exit(1);
  }

  const importDrift = collectSharedImportDrift();
  if (importDrift.length > 0) {
    console.error("Workspace import drift detected. Use @intel-dashboard/shared package imports instead:");
    for (const line of importDrift) {
      console.error(`- ${line}`);
    }
    process.exit(1);
  }

  console.log("Repo hygiene checks passed.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runRepoHygieneChecks();
}
