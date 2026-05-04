export function createDemoRoutine() {
  return {
    id: "demo-morning-focus",
    name: "Morning Focus",
    promptMode: "simple",
    userInstruction: "매일 아침 집중 잘 되는 차분한 배경",
    schedule: {
      kind: "manual"
    },
    targets: [
      {
        id: "main-monitor",
        kind: "desktop",
        platform: process.platform === "darwin" ? "macos" : "windows",
        width: 3840,
        height: 2160,
        usage: "desktop_wallpaper"
      },
      {
        id: "galaxy-s24-ultra",
        kind: "phone-model",
        modelId: "samsung-galaxy-s24-ultra",
        usage: "phone_wallpaper"
      }
    ]
  };
}
