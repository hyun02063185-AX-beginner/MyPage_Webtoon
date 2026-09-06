import { createHash, randomUUID } from "node:crypto";
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import dotenv from "dotenv";

const repositoryRoot = path.resolve(process.cwd());
const dataRoot = path.join(repositoryRoot, "data");
const backupsRoot = path.join(dataRoot, "backups");

dotenv.config({ path: path.join(repositoryRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repositoryRoot, ".env"), quiet: true });

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function assertWithin(parent, child, label) {
  if (!isWithin(parent, child)) throw new Error(`${label} must stay inside ${path.relative(repositoryRoot, parent) || "."}.`);
}

function databasePathFromEnvironment() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith("file:")) throw new Error("DATABASE_URL must be a local SQLite file: URL.");
  // Prisma resolves SQLite file URLs relative to prisma/schema.prisma, not the shell cwd.
  const databasePath = path.resolve(repositoryRoot, "prisma", decodeURIComponent(databaseUrl.slice("file:".length).split("?")[0]));
  assertWithin(dataRoot, databasePath, "SQLite database");
  return databasePath;
}

function checksum(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function backupName() {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `backup-${timestamp}-${randomUUID().slice(0, 8)}`;
}

async function copyDirectory(sourceRoot, destinationRoot) {
  const sourceStat = await fs.lstat(sourceRoot);
  if (!sourceStat.isDirectory() || sourceStat.isSymbolicLink()) throw new Error("storage must be a real directory, not a symbolic link.");
  await fs.mkdir(destinationRoot, { recursive: true });
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(sourceRoot, entry.name);
    const destination = path.join(destinationRoot, entry.name);
    const stat = await fs.lstat(source);
    if (stat.isSymbolicLink()) throw new Error(`storage contains a symbolic link: ${entry.name}`);
    if (stat.isDirectory()) await copyDirectory(source, destination);
    else if (stat.isFile()) await fs.copyFile(source, destination, constants.COPYFILE_EXCL);
    else throw new Error(`storage contains an unsupported entry: ${entry.name}`);
  }
}

async function collectFiles(root) {
  const files = [];
  async function walk(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolutePath);
      else if (entry.isFile()) {
        const bytes = await fs.readFile(absolutePath);
        files.push({ path: path.relative(root, absolutePath).split(path.sep).join("/"), bytes: bytes.length, sha256: checksum(bytes) });
      }
    }
  }
  await walk(root);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function main() {
  const databasePath = databasePathFromEnvironment();
  await fs.access(databasePath);
  await fs.mkdir(backupsRoot, { recursive: true });

  const temporaryDirectory = await fs.mkdtemp(path.join(backupsRoot, ".backup-tmp-"));
  const finalDirectory = path.join(backupsRoot, backupName());
  assertWithin(backupsRoot, temporaryDirectory, "Temporary backup directory");
  assertWithin(backupsRoot, finalDirectory, "Backup directory");

  try {
    // SQLite's online backup API makes a consistent DB snapshot without writing to the source DB.
    const sourceDatabase = new Database(databasePath, { readonly: true, fileMustExist: true });
    try {
      await sourceDatabase.backup(path.join(temporaryDirectory, "app.db"));
    } finally {
      sourceDatabase.close();
    }

    const storagePath = path.join(repositoryRoot, "storage");
    try {
      await fs.access(storagePath);
      await copyDirectory(storagePath, path.join(temporaryDirectory, "storage"));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }

    const files = await collectFiles(temporaryDirectory);
    const manifest = {
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      databaseRelativePath: "app.db",
      files,
    };
    await fs.writeFile(path.join(temporaryDirectory, "storage-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await fs.writeFile(path.join(temporaryDirectory, "checksums.txt"), `${files.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`, { encoding: "utf8", flag: "wx" });
    await fs.rename(temporaryDirectory, finalDirectory);
    console.log(`Backup created: ${path.relative(repositoryRoot, finalDirectory)}`);
    console.log(`Verified manifest entries: ${files.length}`);
  } catch (error) {
    // Only the unique staging directory created by this process is removed on failure.
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  console.error(`Backup failed: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
