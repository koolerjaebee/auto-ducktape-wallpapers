import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_MACOS_WALLPAPER_CACHE_DIRECTORIES = [
  "~/Library/Containers/com.apple.wallpaper.agent/Data/Library/Caches/com.apple.wallpaper.caches/extension-com.apple.wallpaper.extension.image",
  "~/Library/Containers/com.apple.wallpaper.extension.image/Data/Library/Caches"
];
const RUN_TIMESTAMP_PATTERN = /(\d{8}T\d{6}Z)/g;

export async function cleanupPreviousRunArtifacts({
  cwd,
  settings,
  startedAt,
  currentOutputPaths = []
}) {
  const cleanup = settings.runCleanup;
  if (!cleanup?.enabled) {
    return {
      status: "skipped",
      reason: "run_cleanup_disabled"
    };
  }

  const keepPreviousRunCount = cleanup.keepPreviousRunCount ?? 0;
  const outputRoot = resolveOutputPath(cwd, settings.output.directory);
  const keepPaths = new Set(currentOutputPaths.map((filePath) => path.resolve(filePath)));
  const currentRunTimestamps = new Set(extractRunTimestamps(currentOutputPaths.join("\n")));
  const outputRunTimestamps = cleanup.deletePreviousOutputsOnSuccess === false
    ? []
    : await collectRunTimestamps(outputRoot);
  const keepRunTimestamps = selectRunTimestampsToKeep({
    currentRunTimestamps,
    outputRunTimestamps,
    keepPreviousRunCount
  });
  const staleBeforeMs = resolveStaleBeforeMs({
    keepRunTimestamps,
    fallback: startedAt
  });
  const results = [];

  if (cleanup.deletePreviousOutputsOnSuccess !== false) {
    results.push(await cleanupDirectory({
      root: outputRoot,
      staleBeforeMs,
      keepPaths,
      keepRunTimestamps,
      deleteTimestampedFilesOutsideKeep: true,
      pruneEmptyDirectories: true
    }));
  }

  if (process.platform === "darwin" && cleanup.deletePreviousMacosWallpaperCachesOnSuccess !== false) {
    const cacheDirectories = cleanup.macosWallpaperCacheDirectories ?? DEFAULT_MACOS_WALLPAPER_CACHE_DIRECTORIES;
    for (const directory of cacheDirectories) {
      results.push(await cleanupDirectory({
        root: expandHome(directory),
        staleBeforeMs,
        keepPaths,
        keepRunTimestamps: new Set(),
        deleteTimestampedFilesOutsideKeep: false,
        pruneEmptyDirectories: false
      }));
    }
  }

  return {
    status: results.some((result) => result.errors.length > 0) ? "partial" : "ok",
    keepPreviousRunCount,
    keptRunTimestamps: [...keepRunTimestamps].sort().reverse(),
    staleBefore: new Date(staleBeforeMs).toISOString(),
    results
  };
}

async function collectRunTimestamps(root) {
  const timestamps = new Set();
  await collectRunTimestampsFromDirectory(root, timestamps);
  return [...timestamps];
}

async function collectRunTimestampsFromDirectory(directory, timestamps) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    for (const timestamp of extractRunTimestamps(entryPath)) {
      timestamps.add(timestamp);
    }

    if (entry.isDirectory()) {
      await collectRunTimestampsFromDirectory(entryPath, timestamps);
    }
  }
}

function selectRunTimestampsToKeep({
  currentRunTimestamps,
  outputRunTimestamps,
  keepPreviousRunCount
}) {
  const allTimestamps = [...new Set([...outputRunTimestamps, ...currentRunTimestamps])].sort().reverse();
  const keep = new Set(currentRunTimestamps);
  const previous = allTimestamps.filter((timestamp) => !keep.has(timestamp));
  const previousLimit = Math.max(0, keepPreviousRunCount);

  for (const timestamp of previous.slice(0, previousLimit)) {
    keep.add(timestamp);
  }

  if (keep.size === 0) {
    for (const timestamp of allTimestamps.slice(0, previousLimit + 1)) {
      keep.add(timestamp);
    }
  }

  return keep;
}

function resolveStaleBeforeMs({
  keepRunTimestamps,
  fallback
}) {
  const keptTimes = [...keepRunTimestamps]
    .map(parseRunTimestamp)
    .filter((value) => value !== null);

  if (keptTimes.length === 0) {
    return fallback.getTime();
  }

  return Math.min(...keptTimes);
}

async function cleanupDirectory({
  root,
  staleBeforeMs,
  keepPaths,
  keepRunTimestamps,
  deleteTimestampedFilesOutsideKeep,
  pruneEmptyDirectories
}) {
  const result = {
    root,
    deletedFiles: 0,
    deletedBytes: 0,
    errors: []
  };

  try {
    await cleanupDirectoryContents({
      directory: root,
      root,
      staleBeforeMs,
      keepPaths,
      keepRunTimestamps,
      deleteTimestampedFilesOutsideKeep,
      pruneEmptyDirectories,
      result
    });
  } catch (error) {
    if (error?.code !== "ENOENT") {
      result.errors.push({
        path: root,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}

async function cleanupDirectoryContents({
  directory,
  root,
  staleBeforeMs,
  keepPaths,
  keepRunTimestamps,
  deleteTimestampedFilesOutsideKeep,
  pruneEmptyDirectories,
  result
}) {
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await cleanupDirectoryContents({
        directory: entryPath,
        root,
        staleBeforeMs,
        keepPaths,
        keepRunTimestamps,
        deleteTimestampedFilesOutsideKeep,
        pruneEmptyDirectories,
        result
      });
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    await deleteStaleFile({
      filePath: entryPath,
      staleBeforeMs,
      keepPaths,
      keepRunTimestamps,
      deleteTimestampedFilesOutsideKeep,
      result
    });
  }

  if (pruneEmptyDirectories && directory !== root) {
    await fs.rmdir(directory).catch((error) => {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTEMPTY") {
        result.errors.push({
          path: directory,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }
}

async function deleteStaleFile({
  filePath,
  staleBeforeMs,
  keepPaths,
  keepRunTimestamps,
  deleteTimestampedFilesOutsideKeep,
  result
}) {
  const resolvedPath = path.resolve(filePath);
  if (keepPaths.has(resolvedPath)) {
    return;
  }

  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      result.errors.push({
        path: filePath,
        message: error instanceof Error ? error.message : String(error)
      });
    }
    return;
  }

  const fileRunTimestamps = extractRunTimestamps(filePath);
  if (fileRunTimestamps.some((timestamp) => keepRunTimestamps.has(timestamp))) {
    return;
  }

  const isStaleTimestampedFile = deleteTimestampedFilesOutsideKeep && fileRunTimestamps.length > 0;
  if (!isStaleTimestampedFile && stats.mtimeMs >= staleBeforeMs) {
    return;
  }

  try {
    await fs.unlink(filePath);
    result.deletedFiles += 1;
    result.deletedBytes += stats.size;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      result.errors.push({
        path: filePath,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

function extractRunTimestamps(value) {
  return [...value.matchAll(RUN_TIMESTAMP_PATTERN)].map((match) => match[1]);
}

function parseRunTimestamp(timestamp) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(timestamp);
  if (!match) {
    return null;
  }

  return Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  );
}

function expandHome(filePath) {
  if (filePath === "~") {
    return process.env.HOME ?? filePath;
  }

  if (filePath.startsWith("~/")) {
    return path.join(process.env.HOME ?? "~", filePath.slice(2));
  }

  return filePath;
}

function resolveOutputPath(cwd, filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(cwd, filePath);
}
