import { execFileSync } from "node:child_process";

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

let relativeSharedImports = "";
try {
  relativeSharedImports = execFileSync(
    "rg",
    [
      "-n",
      "from\\s+[\"'](?:\\.\\./)+packages/shared/",
      "apps",
      "e2e",
      "scripts",
      "--glob",
      "!node_modules",
    ],
    { encoding: "utf8" },
  );
} catch (error) {
  if (error && typeof error === "object" && "status" in error && error.status === 1) {
    relativeSharedImports = "";
  } else {
    throw error;
  }
}

const importDrift = relativeSharedImports
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

if (importDrift.length > 0) {
  console.error("Workspace import drift detected. Use @intel-dashboard/shared package imports instead:");
  for (const line of importDrift) {
    console.error(`- ${line}`);
  }
  process.exit(1);
}

console.log("Repo hygiene checks passed.");
