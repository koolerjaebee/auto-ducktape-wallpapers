import fs from "node:fs/promises";
import path from "node:path";

import { runCodexExec } from "../codex/codex-cli.js";
import { resolveTargets } from "../devices/resolution-resolver.js";
import { applyWallpaper } from "../platform/wallpaper-applier.js";
import { createDemoRoutine } from "../routines/demo-routine.js";
import { buildCodexPrompt, buildCodexTask } from "../tasks/codex-task.js";

export function createDemoTask(settings) {
  const routine = createDemoRoutine(settings);
  const targets = resolveTargets(routine);
  return buildCodexTask({
    routine,
    targets,
    output: settings.output,
    settings
  });
}

export function createSchedulerPlan({ settings, now = new Date() }) {
  const schedule = settings.routines.demo.schedule;
  if (schedule.kind !== "interval") {
    return {
      enabled: false,
      reason: "demo routine schedule is not interval",
      schedule
    };
  }

  return {
    enabled: true,
    routineId: settings.routines.demo.id,
    schedule,
    runImmediately: true,
    runOnlyWhenComputerAwake: schedule.runOnlyWhenComputerAwake ?? true,
    intervalMs: schedule.everyMinutes * 60 * 1000,
    nextRun: now.toISOString()
  };
}

export async function runDemoRoutineOnce({
  settings,
  cwd = process.cwd(),
  apply = true,
  now = new Date()
}) {
  const lock = await acquireRunLock({ cwd, settings, now });
  if (!lock) {
    return {
      status: "skipped",
      reason: "another_run_is_active",
      startedAt: now.toISOString()
    };
  }

  const task = createDemoTask(settings);
  const prompt = buildCodexPrompt(task);
  const manifestPath = resolveOutputPath(cwd, task.output.manifest);

  try {
    await removeStaleManifest(manifestPath);
    let codexResult = null;

    try {
      codexResult = await runCodexExec({ prompt, cwd, settings });
    } catch (error) {
      const fallback = await tryCodexGeneratedImageFallback({
        cwd,
        settings,
        task,
        manifestPath,
        startedAt: now,
        apply,
        cause: error
      });

      if (fallback) {
        return fallback;
      }

      throw error;
    }

    let manifest;
    try {
      manifest = await readManifest(manifestPath);
    } catch (error) {
      const fallback = await tryCodexGeneratedImageFallback({
        cwd,
        settings,
        task,
        manifestPath,
        startedAt: now,
        apply,
        cause: error
      });

      if (fallback) {
        return fallback;
      }

      throw error;
    }

    const applyResults = apply ? await applyDesktopOutputs({ cwd, task, manifest }) : [];

    return {
      status: "ok",
      startedAt: now.toISOString(),
      finishedAt: new Date().toISOString(),
      manifestPath,
      outputs: manifest.outputs,
      applyResults,
      codex: {
        stdoutBytes: Buffer.byteLength(codexResult.stdout),
        stderrBytes: Buffer.byteLength(codexResult.stderr)
      }
    };
  } finally {
    await lock.release();
  }
}

export async function runDemoScheduler({ settings, cwd = process.cwd() }) {
  const plan = createSchedulerPlan({ settings });
  if (!plan.enabled) {
    throw new Error(`Cannot run scheduler: ${plan.reason}`);
  }

  let running = false;

  const execute = async () => {
    if (running) {
      process.stderr.write("[scheduler] previous run still active; skipping this tick\n");
      return;
    }

    running = true;
    process.stdout.write(`[scheduler] running ${plan.routineId} at ${new Date().toISOString()}\n`);

    try {
      const result = await runDemoRoutineOnce({ settings, cwd });
      process.stdout.write(`[scheduler] applied ${result.applyResults.length} desktop output(s)\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[scheduler] run failed: ${message}\n`);
    } finally {
      running = false;
    }
  };

  await execute();
  process.stdout.write(`[scheduler] next runs every ${plan.schedule.everyMinutes} minute(s)\n`);
  setInterval(execute, plan.intervalMs);
}

async function removeStaleManifest(manifestPath) {
  try {
    await fs.unlink(manifestPath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

async function acquireRunLock({ cwd, settings, now }) {
  const runDirectory = resolveOutputPath(cwd, settings.output.generatedImagesDirectory ?? ".runs");
  const lockPath = path.join(runDirectory, "scheduler.lock");
  const staleAfterMs = ((settings.codex.timeoutSeconds ?? 600) + 300) * 1000;

  await fs.mkdir(runDirectory, { recursive: true });

  try {
    const handle = await fs.open(lockPath, "wx");
    await handle.writeFile(JSON.stringify({
      pid: process.pid,
      createdAt: now.toISOString()
    }, null, 2));

    return {
      async release() {
        await handle.close();
        await fs.unlink(lockPath).catch((error) => {
          if (error?.code !== "ENOENT") {
            throw error;
          }
        });
      }
    };
  } catch (error) {
    if (error?.code !== "EEXIST") {
      throw error;
    }

    const stale = await isStaleLock(lockPath, staleAfterMs, now);
    if (!stale) {
      return null;
    }

    await fs.unlink(lockPath);
    return acquireRunLock({ cwd, settings, now });
  }
}

async function isStaleLock(lockPath, staleAfterMs, now) {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    const lock = JSON.parse(raw);
    const createdAt = Date.parse(lock.createdAt);
    return Number.isNaN(createdAt) || now.getTime() - createdAt > staleAfterMs;
  } catch {
    return true;
  }
}

async function readManifest(manifestPath) {
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  if (manifest.status !== "ok") {
    throw new Error(`Codex manifest status is not ok: ${manifest.status}`);
  }

  if (!Array.isArray(manifest.outputs) || manifest.outputs.length === 0) {
    throw new Error("Codex manifest has no outputs.");
  }

  return manifest;
}

async function applyDesktopOutputs({ cwd, task, manifest }) {
  const results = [];
  const desktopTargets = task.targets.filter((target) => target.usage === "desktop_wallpaper");

  for (const target of desktopTargets) {
    const output = manifest.outputs.find((candidate) => candidate.targetId === target.id);
    if (!output) {
      throw new Error(`Manifest is missing desktop output for target ${target.id}.`);
    }

    const filePath = resolveOutputPath(cwd, output.path);
    results.push(await applyWallpaper({ platform: target.platform, filePath }));
  }

  return results;
}

async function tryCodexGeneratedImageFallback({
  cwd,
  settings,
  task,
  manifestPath,
  startedAt,
  apply,
  cause
}) {
  const fallbackSettings = settings.runtimeFallback;
  if (!fallbackSettings?.enabled) {
    return null;
  }

  const desktopTargets = task.targets.filter((target) => target.usage === "desktop_wallpaper");
  if (desktopTargets.length === 0) {
    return null;
  }

  const target = desktopTargets[0];
  const candidate = await findLatestGeneratedDesktopCandidate({
    settings,
    target,
    startedAt
  });

  if (!candidate) {
    return null;
  }

  const outputDirectory = resolveOutputPath(cwd, task.output.directory);
  await fs.mkdir(outputDirectory, { recursive: true });

  const outputPath = path.join(outputDirectory, renderOutputFilename(task, target));
  await fs.copyFile(candidate.path, outputPath);

  const manifest = createFallbackManifest({
    settings,
    task,
    target,
    outputPath,
    cwd,
    candidate,
    cause
  });

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const applyResults = apply ? await applyDesktopOutputs({ cwd, task, manifest }) : [];

  return {
    status: "ok",
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    manifestPath,
    outputs: manifest.outputs,
    applyResults,
    fallback: {
      status: "used",
      reason: "codex_worker_did_not_finish_manifest",
      selectedSource: candidate.path,
      cause: cause instanceof Error ? cause.message : String(cause)
    },
    codex: {
      stdoutBytes: 0,
      stderrBytes: 0
    }
  };
}

async function findLatestGeneratedDesktopCandidate({ settings, target, startedAt }) {
  const fallbackSettings = settings.runtimeFallback ?? {};
  const root = expandHome(fallbackSettings.generatedImagesRoot ?? "~/.codex/generated_images");
  const graceMs = (fallbackSettings.candidateModifiedAfterRunStartGraceSeconds ?? 60) * 1000;
  const earliestMtime = startedAt.getTime() - graceMs;
  const tolerance = fallbackSettings.desktopAspectRatioTolerance ?? 0.15;
  const targetRatio = target.width / target.height;
  const files = await listGeneratedPngs(root);
  const candidates = [];

  for (const filePath of files) {
    let stats;
    try {
      stats = await fs.stat(filePath);
    } catch {
      continue;
    }

    if (stats.mtimeMs < earliestMtime) {
      continue;
    }

    const dimensions = await readPngDimensions(filePath).catch(() => null);
    if (!dimensions) {
      continue;
    }

    const ratio = dimensions.width / dimensions.height;
    const aspectError = Math.abs(ratio - targetRatio) / targetRatio;
    if (aspectError > tolerance) {
      continue;
    }

    candidates.push({
      path: filePath,
      width: dimensions.width,
      height: dimensions.height,
      area: dimensions.width * dimensions.height,
      aspectError,
      mtimeMs: stats.mtimeMs
    });
  }

  candidates.sort((left, right) =>
    left.aspectError - right.aspectError ||
    right.area - left.area ||
    right.mtimeMs - left.mtimeMs
  );

  return candidates[0] ?? null;
}

async function listGeneratedPngs(root) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name.endsWith(".png")) {
      files.push(entryPath);
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    const nestedEntries = await fs.readdir(entryPath, { withFileTypes: true }).catch(() => []);
    for (const nestedEntry of nestedEntries) {
      if (nestedEntry.isFile() && nestedEntry.name.endsWith(".png")) {
        files.push(path.join(entryPath, nestedEntry.name));
      }
    }
  }

  return files;
}

async function readPngDimensions(filePath) {
  const buffer = await fs.readFile(filePath);
  const isPng = buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;

  if (!isPng) {
    throw new Error(`Not a PNG file: ${filePath}`);
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function createFallbackManifest({ settings, task, target, outputPath, cwd, candidate, cause }) {
  const relativeOutputPath = path.relative(cwd, outputPath);
  const causeMessage = cause instanceof Error ? cause.message : String(cause);

  return {
    status: "ok",
    model: settings.codex.imageModel,
    finalPrompt: "Fallback selected the best desktop candidate generated by Codex before the worker finished.",
    postProcessing: {
      nativeGeneration: "attempted",
      gptImage2Upscale: {
        status: "interrupted_or_unfinished",
        attempts: null,
        maxAttempts: settings.postProcessing.maxGptImage2UpscaleAttempts
      },
      selectedOutputReason: "latest_generated_desktop_candidate",
      localFinalFit: "not_required"
    },
    outputs: [
      {
        targetId: target.id,
        path: relativeOutputPath,
        width: candidate.width,
        height: candidate.height,
        format: "png"
      }
    ],
    warnings: [
      `Codex worker did not finish manifest creation: ${causeMessage}`,
      "Applied the best available generated desktop candidate instead."
    ],
    routine: {
      id: task.routine.id,
      name: task.routine.name
    }
  };
}

function renderOutputFilename(task, target) {
  return task.naming.imageFilenamePattern
    .replaceAll("{routineId}", task.routine.id)
    .replaceAll("{targetId}", target.id)
    .replaceAll("{timestamp}", task.naming.timestamp);
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
