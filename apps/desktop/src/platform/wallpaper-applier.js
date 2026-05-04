export function createApplyPlan({ platform, filePath }) {
  if (platform === "macos") {
    return {
      platform,
      filePath,
      strategy: "nsworkspace",
      status: "planned"
    };
  }

  if (platform === "windows") {
    return {
      platform,
      filePath,
      strategy: "idesktopwallpaper",
      status: "planned"
    };
  }

  if (platform === "android") {
    return {
      platform,
      filePath,
      strategy: "android-agent",
      status: "roadmap"
    };
  }

  throw new Error(`Unsupported wallpaper platform: ${platform}`);
}
