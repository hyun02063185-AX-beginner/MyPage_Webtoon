import { createHash, randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import dotenv from "dotenv";

const repositoryRoot = path.resolve(process.cwd());
const dataRoot = path.join(repositoryRoot, "data");
const backupsRoot = path.join(dataRoot, "backups");
const validationRoot = path.join(dataRoot, "restore-validation");
const requiredTables = ["Project", "ScenarioVersion", "ImageAttempt", "ImageReview", "ExportBundle", "GenerationLock", "Term"];

dotenv.config({ path: path.join(repositoryRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repositoryRoot, ".env"), quiet: true });

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertWithin(parent, child, label) {
  if (!isWithin(parent, child)) throw new Error(`${label} must stay inside ${path.relative(repositoryRoot, parent) || "."}.`);
}

function checksum(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readCurrentDatabaseChecksum() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("file:")) return null;
  // Prisma resolves SQLite file URLs relative to prisma/schema.prisma, not the shell cwd.
  const databasePath = path.resolve(repositoryRoot, "prisma", decodeURIComponent(databaseUrl.slice("file:".length).split("?")[0]));
  assertWithin(dataRoot, databasePath, "SQLite database");
  try {
    return checksum(await fs.readFile(databasePath));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function backupArgument() {
  const index = process.argv.indexOf("--backup");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error("Usage: npm run ops:restore:validate -- --backup data/backups/backup-...");
  const candidate = path.resolve(repositoryRoot, value);
  assertWithin(backupsRoot, candidate, "Backup to validate");
  return candidate;
}

function parseManifest(value) {
  if (!value || value.formatVersion !== 1 || value.databaseRelativePath !== "app.db" || !Array.isArray(value.files) || value.files.length === 0) {
    throw new Error("BACKUP_VALIDATION_ERROR: storage-manifest.json has an invalid format.");
  }
  const seen = new Set();
  for (const file of value.files) {
    if (!file || typeof file.path !== "string" || typeof file.bytes !== "number" || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error("BACKUP_VALIDATION_ERROR: storage-manifest.json has an invalid file entry.");
    }
    if (file.path.includes("\\") || file.path.startsWith("/") || file.path.split("/").some((part) => !part || part === "." || part === "..") || seen.has(file.path)) {
      throw new Error("BACKUP_VALIDATION_ERROR: storage-manifest.json contains an unsafe or duplicate path.");
    }
    seen.add(file.path);
  }
  if (!seen.has("app.db")) throw new Error("BACKUP_VALIDATION_ERROR: storage-manifest.json does not include app.db.");
  return value;
}

async function verifyManifest(backupDirectory, manifest) {
  for (const file of manifest.files) {
    const candidate = path.resolve(backupDirectory, file.path);
    assertWithin(backupDirectory, candidate, "Manifest file");
    const bytes = await fs.readFile(candidate);
    if (bytes.length !== file.bytes || checksum(bytes) !== file.sha256) throw new Error(`BACKUP_VALIDATION_ERROR: checksum mismatch for ${file.path}.`);
  }
}

async function validateExportJsons(restoredStorage) {
  const exportsRoot = path.join(restoredStorage, "exports");
  try {
    const bundleDirectories = await fs.readdir(exportsRoot, { withFileTypes: true });
    for (const bundle of bundleDirectories) {
      if (!bundle.isDirectory()) continue;
      const files = await fs.readdir(path.join(exportsRoot, bundle.name));
      for (const file of files.filter((name) => name.endsWith(".json"))) {
        const parsed = JSON.parse(await fs.readFile(path.join(exportsRoot, bundle.name, file), "utf8"));
        if (!parsed || typeof parsed.slug !== "string" || typeof parsed.image !== "string" || typeof parsed.prompt !== "string" || typeof parsed.model !== "string") {
          throw new Error(`BACKUP_VALIDATION_ERROR: invalid gallery JSON: ${file}.`);
        }
      }
    }
  } catch (error) {
    if (error?.code === "ENOENT") return 0;
    throw error;
  }
  return 1;
}

async function main() {
  const backupInput = backupArgument();
  const backupDirectory = await fs.realpath(backupInput);
  const resolvedBackupsRoot = await fs.realpath(backupsRoot);
  assertWithin(resolvedBackupsRoot, backupDirectory, "Backup to validate");
  const databaseBefore = await readCurrentDatabaseChecksum();
  const validationDirectory = path.join(validationRoot, `validate-${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${randomUUID().slice(0, 8)}`);
  const restoredDirectory = path.join(validationDirectory, "restored");
  const report = { backup: path.relative(repositoryRoot, backupDirectory), startedAt: new Date().toISOString(), result: "FAILED", checks: [] };

  try {
    await fs.mkdir(restoredDirectory, { recursive: true });
    const manifest = parseManifest(JSON.parse(await fs.readFile(path.join(backupDirectory, "storage-manifest.json"), "utf8")));
    await verifyManifest(backupDirectory, manifest);
    report.checks.push(`checksums:${manifest.files.length}`);

    await fs.copyFile(path.join(backupDirectory, "app.db"), path.join(restoredDirectory, "app.db"), constants.COPYFILE_EXCL);
    for (const file of manifest.files.filter((entry) => entry.path.startsWith("storage/"))) {
      const source = path.resolve(backupDirectory, file.path);
      const destination = path.resolve(restoredDirectory, file.path);
      assertWithin(restoredDirectory, destination, "Restored storage file");
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(source, destination, constants.COPYFILE_EXCL);
    }

    const restoredDatabase = new Database(path.join(restoredDirectory, "app.db"), { readonly: true, fileMustExist: true });
    try {
      const integrity = restoredDatabase.pragma("integrity_check", { simple: true });
      if (integrity !== "ok") throw new Error("BACKUP_VALIDATION_ERROR: SQLite integrity_check failed.");
      const foreignKeys = restoredDatabase.pragma("foreign_key_check");
      if (foreignKeys.length !== 0) throw new Error("BACKUP_VALIDATION_ERROR: SQLite foreign_key_check failed.");
      const availableTables = new Set(restoredDatabase.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name));
      const missingTables = requiredTables.filter((name) => !availableTables.has(name));
      if (missingTables.length) throw new Error(`BACKUP_VALIDATION_ERROR: missing tables: ${missingTables.join(", ")}.`);
    } finally {
      restoredDatabase.close();
    }
    report.checks.push("sqlite-integrity:ok", "schema:ok");
    const jsonBundleGroups = await validateExportJsons(path.join(restoredDirectory, "storage"));
    report.checks.push(`gallery-json-bundle-groups:${jsonBundleGroups}`);

    const databaseAfter = await readCurrentDatabaseChecksum();
    if (databaseBefore !== databaseAfter) throw new Error("BACKUP_VALIDATION_ERROR: the active database changed while validation was running.");
    report.checks.push("active-database-unchanged");
    report.result = "PASS";
    console.log("Restore validation passed; the active database was not modified.");
  } catch (error) {
    report.error = error instanceof Error ? error.message : "unknown error";
    throw error;
  } finally {
    report.completedAt = new Date().toISOString();
    await fs.mkdir(validationDirectory, { recursive: true });
    await fs.writeFile(path.join(validationDirectory, "validation-report.json"), `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    console.log(`Validation report: ${path.relative(repositoryRoot, path.join(validationDirectory, "validation-report.json"))}`);
  }
}

main().catch((error) => {
  console.error(`Restore validation failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
