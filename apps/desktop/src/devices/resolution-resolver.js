import { findPhoneProfile } from "./phone-catalog.js";

export function resolveTargets(routine) {
  if (!Array.isArray(routine.targets) || routine.targets.length === 0) {
    throw new Error("Routine must include at least one target.");
  }

  return routine.targets.map((target) => resolveTarget(target));
}

function resolveTarget(target) {
  if (target.kind === "desktop") {
    return resolveDesktopTarget(target);
  }

  if (target.kind === "phone-model") {
    return resolvePhoneModelTarget(target);
  }

  if (target.kind === "manual") {
    return resolveManualTarget(target);
  }

  throw new Error(`Unsupported target kind: ${target.kind}`);
}

function resolveDesktopTarget(target) {
  assertPositiveSize(target);

  return {
    id: target.id,
    platform: target.platform,
    width: target.width,
    height: target.height,
    usage: target.usage ?? "desktop_wallpaper",
    source: "manual-desktop"
  };
}

function resolvePhoneModelTarget(target) {
  const profile = findPhoneProfile(target.modelId);
  if (!profile) {
    throw new Error(`Unknown phone model: ${target.modelId}`);
  }

  return {
    id: target.id,
    platform: profile.platform,
    model: profile.model,
    width: profile.width,
    height: profile.height,
    aspectRatio: profile.aspectRatio,
    safeArea: profile.safeArea,
    usage: target.usage ?? "phone_wallpaper",
    source: "phone-catalog"
  };
}

function resolveManualTarget(target) {
  assertPositiveSize(target);

  return {
    id: target.id,
    platform: target.platform,
    width: target.width,
    height: target.height,
    safeArea: target.safeArea,
    usage: target.usage ?? "wallpaper",
    source: "manual"
  };
}

function assertPositiveSize(target) {
  if (!Number.isInteger(target.width) || target.width <= 0) {
    throw new Error(`Invalid width for target ${target.id}.`);
  }

  if (!Number.isInteger(target.height) || target.height <= 0) {
    throw new Error(`Invalid height for target ${target.id}.`);
  }
}
