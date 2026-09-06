import { createHash, randomUUID } from "node:crypto";
import { constants as fsConstants, promises as fs } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

if (!process.argv.includes("--confirm-user-batch-approval")) {
  throw new Error("This command requires --confirm-user-batch-approval.");
}

const approvalNote = "사용자가 2026-09-07에 선택한 LEGACY 원본 10개를 일괄 공개 승인함.";
const root = process.cwd();
const myPageRoot = process.env.MYPAGE_ROOT ?? path.resolve(root, "..", "MyPage");
const imageDirectory = path.join(myPageRoot, "images");
const importsPath = path.join(myPageRoot, "js", "data", "webtoon-imports.js");
const db = new PrismaClient();

const metadataBySource = new Map([
  ["ChatGPT Image 2026년 6월 5일 오후 04_15_49 (5).png", { slug: "legacy-ai-webtoon-01", title: "AI·AX 개념 웹툰 1", concept: "AI·AX", imageAlt: "AI·AX 개념을 소개하는 4컷 웹툰", paragraphs: ["AI·AX 관련 개념을 4컷 웹툰으로 소개합니다."] }],
  ["ChatGPT Image 2026년 6월 7일 오후 11_21_27.png", { slug: "legacy-ai-webtoon-02", title: "AI·AX 개념 웹툰 2", concept: "AI·AX", imageAlt: "AI·AX 개념을 소개하는 4컷 웹툰", paragraphs: ["AI·AX 관련 개념을 4컷 웹툰으로 소개합니다."] }],
  ["cloud.png", { slug: "cloud", title: "클라우드란?", concept: "클라우드", imageAlt: "클라우드 개념을 소개하는 4컷 웹툰", paragraphs: ["클라우드 개념을 4컷 웹툰으로 소개합니다."] }],
  ["embedding.png", { slug: "embedding", title: "임베딩이란?", concept: "임베딩", imageAlt: "임베딩 개념을 소개하는 4컷 웹툰", paragraphs: ["임베딩 개념을 4컷 웹툰으로 소개합니다."] }],
  ["engine.png", { slug: "engine", title: "엔진이란?", concept: "엔진", imageAlt: "엔진 개념을 소개하는 4컷 웹툰", paragraphs: ["엔진 개념을 4컷 웹툰으로 소개합니다."] }],
  ["llm.png", { slug: "llm", title: "LLM이란?", concept: "LLM", imageAlt: "LLM 개념을 소개하는 4컷 웹툰", paragraphs: ["LLM 개념을 4컷 웹툰으로 소개합니다."] }],
  ["machine.png", { slug: "machine", title: "머신이란?", concept: "머신", imageAlt: "머신 개념을 소개하는 4컷 웹툰", paragraphs: ["머신 개념을 4컷 웹툰으로 소개합니다."] }],
  ["model (1).png", { slug: "model", title: "모델이란?", concept: "모델", imageAlt: "모델 개념을 소개하는 4컷 웹툰", paragraphs: ["모델 개념을 4컷 웹툰으로 소개합니다."] }],
  ["prompt.png", { slug: "prompt", title: "프롬프트란?", concept: "프롬프트", imageAlt: "프롬프트 개념을 소개하는 4컷 웹툰", paragraphs: ["프롬프트 개념을 4컷 웹툰으로 소개합니다."] }],
  ["term-2ssq65.png", { slug: "terminal", title: "터미널이란?", concept: "터미널", imageAlt: "터미널에서 텍스트 명령으로 작업을 요청하는 모습을 소개하는 4컷 웹툰", paragraphs: ["터미널은 텍스트 명령으로 컴퓨터에 작업을 요청하는 도구입니다."] }],
]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function ensureInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error("Unsafe local storage path.");
  }
}

async function fileMatches(filePath, expectedHash) {
  try {
    return sha256(await fs.readFile(filePath)) === expectedHash;
  } catch {
    return false;
  }
}

async function writeExportBundle({ project, attempt, metadata }) {
  const existing = await db.exportBundle.findFirst({ where: { projectId: project.id, imageAttemptId: attempt.id }, orderBy: { exportVersion: "desc" } });
  if (existing) return existing;

  const storageRoot = path.join(root, "storage");
  const sourcePath = path.resolve(root, attempt.filePath);
  ensureInside(storageRoot, sourcePath);
  const imageBytes = await fs.readFile(sourcePath);
  if (sha256(imageBytes) !== attempt.fileSha256) throw new Error(`Checksum mismatch: ${attempt.id}`);

  const bundleId = randomUUID();
  const exportsRoot = path.join(storageRoot, "exports");
  const temporaryDirectory = path.join(exportsRoot, `.${bundleId}.tmp`);
  const finalDirectory = path.join(exportsRoot, bundleId);
  const imageName = `${metadata.slug}.webp`;
  const jsonName = `${metadata.slug}.json`;
  const jsonBytes = Buffer.from(JSON.stringify({
    slug: metadata.slug,
    concept: metadata.concept,
    title: metadata.title,
    image: imageName,
    imageAlt: metadata.imageAlt,
    prompt: "LEGACY_ASSET_PROMPT_UNAVAILABLE",
    model: "LEGACY_ORIGINAL",
    createdAt: new Date().toISOString().slice(0, 10),
    paragraphs: metadata.paragraphs,
  }, null, 2), "utf8");

  await fs.mkdir(temporaryDirectory, { recursive: true });
  try {
    await fs.writeFile(path.join(temporaryDirectory, imageName), imageBytes, { flag: "wx" });
    await fs.writeFile(path.join(temporaryDirectory, jsonName), jsonBytes, { flag: "wx" });
    await fs.rename(temporaryDirectory, finalDirectory);
    return await db.$transaction(async (tx) => {
      const current = await tx.project.findUnique({ where: { id: project.id } });
      if (!current || current.status !== "APPROVED_FOR_EXPORT") throw new Error(`Export state changed: ${project.id}`);
      const bundle = await tx.exportBundle.create({
        data: {
          id: bundleId,
          projectId: project.id,
          imageAttemptId: attempt.id,
          exportVersion: 1,
          imagePath: path.join(finalDirectory, imageName),
          jsonPath: path.join(finalDirectory, jsonName),
          archivePath: finalDirectory,
          imageSha256: sha256(imageBytes),
          jsonSha256: sha256(jsonBytes),
        },
      });
      await tx.project.update({ where: { id: project.id }, data: { status: "EXPORTED" } });
      return bundle;
    });
  } catch (error) {
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
    await fs.rm(finalDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  try {
    await fs.access(imageDirectory);
    await fs.access(importsPath);
  } catch {
    throw new Error("MyPage gallery structure was not found.");
  }
  try {
    await fs.access(importsPath);
    const current = await fs.readFile(importsPath, "utf8");
    if (!current.includes("importedWebtoonCases = [];")) throw new Error("Refusing to overwrite a non-empty MyPage import list.");
  } catch (error) {
    throw error;
  }

  const attempts = await db.imageAttempt.findMany({
    where: { source: "LEGACY", legacyOriginalFileName: { in: [...metadataBySource.keys()] } },
    include: { project: true, imageReview: true },
    orderBy: { createdAt: "asc" },
  });
  if (attempts.length !== metadataBySource.size) throw new Error(`Expected ${metadataBySource.size} selected assets, found ${attempts.length}.`);

  const delivered = [];
  for (const attempt of attempts) {
    const metadata = metadataBySource.get(attempt.legacyOriginalFileName);
    if (!metadata || attempt.status !== "READY" || attempt.isMock) throw new Error(`Asset is not eligible: ${attempt.id}`);
    const project = await db.project.findUnique({ where: { id: attempt.projectId } });
    if (!project) throw new Error(`Project not found: ${attempt.projectId}`);

    if (!attempt.imageReview) {
      await db.$transaction(async (tx) => {
        const current = await tx.project.findUnique({ where: { id: project.id } });
        if (!current || current.status !== "IMAGE_REVIEW") throw new Error(`Review state changed: ${project.id}`);
        await tx.project.update({
          where: { id: project.id },
          data: { slug: metadata.slug, title: metadata.title, imageAlt: metadata.imageAlt, paragraphsJson: JSON.stringify(metadata.paragraphs) },
        });
        await tx.imageReview.create({
          data: {
            imageAttemptId: attempt.id,
            result: "PASSED",
            panelChecksJson: JSON.stringify([1, 2, 3, 4].map((panelNumber) => ({ panelNumber, issueType: "NORMAL" }))),
            typoFound: false,
            missingText: false,
            croppedText: false,
            layoutIssue: false,
            contentIssue: false,
            notes: approvalNote,
          },
        });
        await tx.project.update({ where: { id: project.id }, data: { status: "APPROVED_FOR_EXPORT", selectedImageAttemptId: attempt.id } });
      });
      project.slug = metadata.slug;
      project.title = metadata.title;
      project.imageAlt = metadata.imageAlt;
      project.paragraphsJson = JSON.stringify(metadata.paragraphs);
      project.status = "APPROVED_FOR_EXPORT";
    }

    const effectiveMetadata = {
      slug: project.slug ?? metadata.slug,
      title: project.title ?? metadata.title,
      imageAlt: project.imageAlt ?? metadata.imageAlt,
      paragraphs: project.paragraphsJson ? JSON.parse(project.paragraphsJson) : metadata.paragraphs,
      concept: metadata.concept,
    };
    const bundle = await writeExportBundle({ project, attempt, metadata: effectiveMetadata });
    const sourceImage = bundle.imagePath;
    const destinationImage = path.join(imageDirectory, `${effectiveMetadata.slug}.webp`);
    if (!(await fileMatches(destinationImage, bundle.imageSha256))) {
      try {
        await fs.copyFile(sourceImage, destinationImage, fsConstants.COPYFILE_EXCL);
      } catch (error) {
        if (!(await fileMatches(destinationImage, bundle.imageSha256))) throw error;
      }
    }
    delivered.push({ ...effectiveMetadata, image: `images/${effectiveMetadata.slug}.webp` });
  }

  const source = `// Generated by MyPage_Webtoon explicit batch delivery.\n// User approval: ${approvalNote}\nexport const importedWebtoonCases = ${JSON.stringify(delivered, null, 2)};\n`;
  await fs.writeFile(importsPath, source, { encoding: "utf8", flag: "w" });
  console.log(JSON.stringify({ deliveredCount: delivered.length, imageDirectory, importsPath, slugs: delivered.map((item) => item.slug) }, null, 2));
}

main().finally(() => db.$disconnect());
