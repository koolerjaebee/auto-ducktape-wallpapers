export function createDemoRoutine(settings) {
  const routine = structuredClone(settings.routines.demo);

  routine.targets = routine.targets.map((target) => {
    if (target.kind !== "desktop" || target.platform !== "auto") {
      return target;
    }

    return {
      ...target,
      platform: process.platform === "darwin" ? "macos" : "windows"
    };
  });

  return routine;
}
