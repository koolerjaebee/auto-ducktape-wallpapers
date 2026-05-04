export function createRetentionPlan({
  settings,
  now = new Date()
}) {
  const generatedImagesDirectory = settings.output.generatedImagesDirectory;
  const currentWallpaperDirectory = settings.output.currentWallpaperDirectory;

  return {
    task: "retention_cleanup",
    schedule: settings.retention.schedule,
    olderThanDays: settings.retention.olderThanDays,
    action: settings.retention.action,
    scope: settings.retention.scope,
    generatedImagesDirectory,
    currentWallpaperDirectory,
    runAfter: nextMonthlyRun(now, settings.retention.runAtUtc).toISOString(),
    exclusions: [
      {
        reason: "current_wallpaper_reference",
        directory: currentWallpaperDirectory
      }
    ],
    platformStrategies: settings.platformStrategies.retention
  };
}

function nextMonthlyRun(now, runAtUtc) {
  const [hour, minute] = parseRunAtUtc(runAtUtc);

  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + 1,
    1,
    hour,
    minute,
    0
  ));
}

function parseRunAtUtc(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return [3, 0];
  }

  return [Number(match[1]), Number(match[2])];
}
