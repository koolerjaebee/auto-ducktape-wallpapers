import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const macosNativeWallpaperScript = path.join(repoRoot, "scripts/macos/set-wallpaper.swift");

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

export async function applyWallpaper({ platform, filePath }) {
  if (platform === "macos") {
    const strategy = await applyMacosWallpaper(filePath);
    return {
      platform,
      filePath,
      strategy,
      status: "applied"
    };
  }

  if (platform === "windows") {
    throw new Error("Windows wallpaper application is planned but not implemented yet.");
  }

  if (platform === "android") {
    throw new Error("Android wallpaper application must be handled by the companion app.");
  }

  throw new Error(`Unsupported wallpaper platform: ${platform}`);
}

async function applyMacosWallpaper(filePath) {
  try {
    await applyMacosWallpaperWithNSWorkspace(filePath);
    return "nsworkspace-swift";
  } catch (nativeError) {
    if (process.env.AUTO_DUCKTAPE_ALLOW_OSASCRIPT_FALLBACK !== "1") {
      throw nativeError;
    }

    try {
      await applyMacosWallpaperWithFinder(filePath);
      return "osascript-finder";
    } catch {
      await applyMacosWallpaperWithSystemEvents(filePath);
      return "osascript-system-events";
    }
  }
}

function applyMacosWallpaperWithNSWorkspace(filePath) {
  return runProcess("swift", [macosNativeWallpaperScript, filePath], { timeoutMs: 45000 });
}

function applyMacosWallpaperWithFinder(filePath) {
  const script = `tell application "Finder" to set desktop picture to POSIX file ${JSON.stringify(filePath)}`;
  return runProcess("osascript", ["-e", script], { timeoutMs: 45000 });
}

function applyMacosWallpaperWithSystemEvents(filePath) {
  const script = [
    "tell application \"System Events\"",
    `set picture of every desktop to ${JSON.stringify(filePath)}`,
    "end tell"
  ].join("\n");

  return runProcess("osascript", ["-e", script], { timeoutMs: 45000 });
}

function runProcess(command, args, { timeoutMs } = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });
    const timeout = timeoutMs
      ? setTimeout(() => {
          child.kill("SIGTERM");
          rejectOnce(new Error(`${command} timed out after ${timeoutMs}ms.`));
        }, timeoutMs)
      : null;

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", rejectOnce);
    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });

    function rejectOnce(error) {
      if (settled) {
        return;
      }

      settled = true;
      if (timeout) {
        clearTimeout(timeout);
      }

      reject(error);
    }
  });
}
