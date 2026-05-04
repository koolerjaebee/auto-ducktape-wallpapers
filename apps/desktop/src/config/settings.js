import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultSettingsPath = path.resolve(__dirname, "../../../../settings.json");

export function loadSettings({ settingsPath = process.env.AUTO_DUCKTAPE_SETTINGS } = {}) {
  const resolvedPath = path.resolve(settingsPath ?? defaultSettingsPath);

  try {
    const raw = fs.readFileSync(resolvedPath, "utf8");
    const settings = JSON.parse(raw);
    validateSettings(settings, resolvedPath);
    return settings;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in settings file: ${resolvedPath}`);
    }

    throw error;
  }
}

function validateSettings(settings, resolvedPath) {
  const requiredPaths = [
    ["codex", "command"],
    ["codex", "args"],
    ["codex", "imageModel"],
    ["output", "directory"],
    ["output", "manifest"],
    ["naming", "imageFilenamePattern"],
    ["postProcessing", "maxGptImage2UpscaleAttempts"],
    ["retention", "olderThanDays"],
    ["routines", "demo"]
  ];

  for (const parts of requiredPaths) {
    if (getPath(settings, parts) === undefined) {
      throw new Error(`Missing settings.${parts.join(".")} in ${resolvedPath}`);
    }
  }

  if (!Array.isArray(settings.codex.args)) {
    throw new Error(`settings.codex.args must be an array in ${resolvedPath}`);
  }

  if (settings.codex.timeoutSeconds !== undefined && !Number.isInteger(settings.codex.timeoutSeconds)) {
    throw new Error(`settings.codex.timeoutSeconds must be an integer in ${resolvedPath}`);
  }

  if (!Number.isInteger(settings.postProcessing.maxGptImage2UpscaleAttempts)) {
    throw new Error(`settings.postProcessing.maxGptImage2UpscaleAttempts must be an integer in ${resolvedPath}`);
  }

  if (!Number.isInteger(settings.retention.olderThanDays)) {
    throw new Error(`settings.retention.olderThanDays must be an integer in ${resolvedPath}`);
  }

  validateRoutineSchedule(settings.routines.demo.schedule, resolvedPath);
  validateNaming(settings.naming, resolvedPath);
  validateSimplePromptRandomization(settings.simplePromptRandomization, resolvedPath);
  validatePromptVariation(settings.routines.demo.promptVariation, resolvedPath);
  validateMobileRelay(settings.mobileRelay, resolvedPath);
  validateRuntimeFallback(settings.runtimeFallback, resolvedPath);
}

function validateNaming(naming, resolvedPath) {
  if (!naming || typeof naming !== "object") {
    throw new Error(`settings.naming must be an object in ${resolvedPath}`);
  }

  if (typeof naming.imageFilenamePattern !== "string" || naming.imageFilenamePattern.length === 0) {
    throw new Error(`settings.naming.imageFilenamePattern must be a non-empty string in ${resolvedPath}`);
  }

  if (naming.promptSlug === undefined) {
    return;
  }

  if (!naming.promptSlug || typeof naming.promptSlug !== "object") {
    throw new Error(`settings.naming.promptSlug must be an object in ${resolvedPath}`);
  }

  if (typeof naming.promptSlug.enabled !== "boolean") {
    throw new Error(`settings.naming.promptSlug.enabled must be a boolean in ${resolvedPath}`);
  }

  if (!Number.isInteger(naming.promptSlug.maxWords) || naming.promptSlug.maxWords < 1) {
    throw new Error(`settings.naming.promptSlug.maxWords must be a positive integer in ${resolvedPath}`);
  }

  if (!Number.isInteger(naming.promptSlug.maxLength) || naming.promptSlug.maxLength < 1) {
    throw new Error(`settings.naming.promptSlug.maxLength must be a positive integer in ${resolvedPath}`);
  }

  if (typeof naming.promptSlug.fallback !== "string" || naming.promptSlug.fallback.length === 0) {
    throw new Error(`settings.naming.promptSlug.fallback must be a non-empty string in ${resolvedPath}`);
  }
}

function validateRoutineSchedule(schedule, resolvedPath) {
  if (!schedule || typeof schedule !== "object") {
    throw new Error(`settings.routines.demo.schedule must be an object in ${resolvedPath}`);
  }

  if (schedule.kind === "manual") {
    return;
  }

  if (schedule.kind === "interval") {
    if (!Number.isInteger(schedule.everyMinutes) || schedule.everyMinutes < 1) {
      throw new Error(`settings.routines.demo.schedule.everyMinutes must be a positive integer in ${resolvedPath}`);
    }

    if (schedule.runOnlyWhenComputerAwake !== undefined && typeof schedule.runOnlyWhenComputerAwake !== "boolean") {
      throw new Error(`settings.routines.demo.schedule.runOnlyWhenComputerAwake must be a boolean in ${resolvedPath}`);
    }

    return;
  }

  throw new Error(`settings.routines.demo.schedule.kind must be manual or interval in ${resolvedPath}`);
}

function validateMobileRelay(mobileRelay, resolvedPath) {
  if (mobileRelay === undefined) {
    return;
  }

  if (!mobileRelay || typeof mobileRelay !== "object") {
    throw new Error(`settings.mobileRelay must be an object in ${resolvedPath}`);
  }

  if (typeof mobileRelay.enabled !== "boolean") {
    throw new Error(`settings.mobileRelay.enabled must be a boolean in ${resolvedPath}`);
  }

  if (mobileRelay.database !== "disabled") {
    throw new Error(`settings.mobileRelay.database must be disabled in ${resolvedPath}`);
  }

  if (!Number.isInteger(mobileRelay.imageRetentionHours) || mobileRelay.imageRetentionHours < 1) {
    throw new Error(`settings.mobileRelay.imageRetentionHours must be a positive integer in ${resolvedPath}`);
  }

  if (!Number.isInteger(mobileRelay.maxImageBytes) || mobileRelay.maxImageBytes < 1) {
    throw new Error(`settings.mobileRelay.maxImageBytes must be a positive integer in ${resolvedPath}`);
  }

  if (!mobileRelay.security || typeof mobileRelay.security !== "object") {
    throw new Error(`settings.mobileRelay.security must be an object in ${resolvedPath}`);
  }

  if (mobileRelay.security.remoteCodexExecution !== "disabled") {
    throw new Error(`settings.mobileRelay.security.remoteCodexExecution must be disabled in ${resolvedPath}`);
  }
}

function validatePromptVariation(promptVariation, resolvedPath) {
  if (promptVariation === undefined) {
    return;
  }

  if (!promptVariation || typeof promptVariation !== "object") {
    throw new Error(`settings.routines.demo.promptVariation must be an object in ${resolvedPath}`);
  }

  if (typeof promptVariation.enabled !== "boolean") {
    throw new Error(`settings.routines.demo.promptVariation.enabled must be a boolean in ${resolvedPath}`);
  }

  if (promptVariation.dimensions === undefined) {
    return;
  }

  if (!promptVariation.dimensions || typeof promptVariation.dimensions !== "object") {
    throw new Error(`settings.routines.demo.promptVariation.dimensions must be an object in ${resolvedPath}`);
  }

  validateDimensionMap(promptVariation.dimensions, "settings.routines.demo.promptVariation.dimensions", resolvedPath);
}

function validateSimplePromptRandomization(simplePromptRandomization, resolvedPath) {
  if (simplePromptRandomization === undefined) {
    return;
  }

  if (!simplePromptRandomization || typeof simplePromptRandomization !== "object") {
    throw new Error(`settings.simplePromptRandomization must be an object in ${resolvedPath}`);
  }

  if (typeof simplePromptRandomization.enabled !== "boolean") {
    throw new Error(`settings.simplePromptRandomization.enabled must be a boolean in ${resolvedPath}`);
  }

  if (simplePromptRandomization.generator !== undefined &&
    simplePromptRandomization.generator !== "codex" &&
    simplePromptRandomization.generator !== "local") {
    throw new Error(`settings.simplePromptRandomization.generator must be codex or local in ${resolvedPath}`);
  }

  if (simplePromptRandomization.dimensions === undefined) {
    return;
  }

  if (!simplePromptRandomization.dimensions || typeof simplePromptRandomization.dimensions !== "object") {
    throw new Error(`settings.simplePromptRandomization.dimensions must be an object in ${resolvedPath}`);
  }

  validateDimensionMap(simplePromptRandomization.dimensions, "settings.simplePromptRandomization.dimensions", resolvedPath);
}

function validateDimensionMap(dimensions, label, resolvedPath) {
  for (const [key, values] of Object.entries(dimensions)) {
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.length === 0)) {
      throw new Error(`${label}.${key} must be a non-empty string array in ${resolvedPath}`);
    }
  }
}

function validateRuntimeFallback(runtimeFallback, resolvedPath) {
  if (runtimeFallback === undefined) {
    return;
  }

  if (!runtimeFallback || typeof runtimeFallback !== "object") {
    throw new Error(`settings.runtimeFallback must be an object in ${resolvedPath}`);
  }

  if (typeof runtimeFallback.enabled !== "boolean") {
    throw new Error(`settings.runtimeFallback.enabled must be a boolean in ${resolvedPath}`);
  }

  if (!Number.isInteger(runtimeFallback.candidateModifiedAfterRunStartGraceSeconds) || runtimeFallback.candidateModifiedAfterRunStartGraceSeconds < 0) {
    throw new Error(`settings.runtimeFallback.candidateModifiedAfterRunStartGraceSeconds must be a non-negative integer in ${resolvedPath}`);
  }

  if (typeof runtimeFallback.desktopAspectRatioTolerance !== "number" || runtimeFallback.desktopAspectRatioTolerance <= 0) {
    throw new Error(`settings.runtimeFallback.desktopAspectRatioTolerance must be a positive number in ${resolvedPath}`);
  }
}

function getPath(value, parts) {
  return parts.reduce((current, part) => current?.[part], value);
}
