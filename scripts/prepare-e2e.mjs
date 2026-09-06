import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { promises as fs } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(process.cwd());
const dataRoot = path.join(repositoryRoot, "data");
const e2eDataRoot = path.join(dataRoot, "e2e");
const databaseUrl = "file:../data/e2e/app.db";

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function run(command, argumentsList) {
  await execFileAsync(command, argumentsList, {
    cwd: repositoryRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    windowsHide: true,
  });
}

async function applyMigrations(databasePath) {
  const migrationsRoot = path.join(repositoryRoot, "prisma", "migrations");
  const migrations = (await fs.readdir(migrationsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const database = new Database(databasePath);
  try {
    for (const migration of migrations) {
      const sql = await fs.readFile(path.join(migrationsRoot, migration, "migration.sql"), "utf8");
      database.exec(sql);
    }
  } finally {
    database.close();
  }
}

async function main() {
  if (!isWithin(dataRoot, e2eDataRoot) || e2eDataRoot === dataRoot) {
    throw new Error("The E2E database directory must remain inside data/e2e.");
  }

  // Only the dedicated, Git-ignored E2E database is reset between test runs.
  await fs.rm(e2eDataRoot, { recursive: true, force: true });
  await fs.mkdir(e2eDataRoot, { recursive: true });

  await applyMigrations(path.join(e2eDataRoot, "app.db"));
  await run(process.execPath, ["prisma/seed.mjs"]);
  console.log("Prepared isolated E2E database: data/e2e/app.db");
}

main().catch((error) => {
  console.error(`E2E database setup failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
