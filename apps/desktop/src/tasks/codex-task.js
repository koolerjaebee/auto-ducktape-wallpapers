export function buildCodexTask({ routine, targets, output }) {
  return {
    task: "generate_and_prepare_wallpaper",
    imageModel: "gpt-image-2",
    fallback: "disabled",
    promptMode: routine.promptMode,
    userInstruction: routine.userInstruction,
    routine: {
      id: routine.id,
      name: routine.name,
      schedule: routine.schedule
    },
    targets,
    output
  };
}

export function buildCodexPrompt(taskSpec) {
  const manifestSchema = {
    status: "ok",
    model: "gpt-image-2",
    finalPrompt: "string",
    outputs: [
      {
        targetId: "string",
        path: "string",
        width: 0,
        height: 0,
        format: "png"
      }
    ],
    warnings: []
  };

  return [
    "You are running inside Codex as the wallpaper generation worker.",
    "Generate wallpaper images through Codex image generation capabilities only.",
    "Use gpt-image-2 only. Do not fall back to any other image model.",
    "Do not write code that calls the OpenAI API directly.",
    "For simple promptMode, expand userInstruction into a detailed image prompt.",
    "For advanced promptMode, preserve the user's prompt intent and only adapt it for wallpaper constraints.",
    "Create one image per target using the exact requested width and height when possible.",
    "Write all outputs under the requested output.directory.",
    "Write a manifest JSON file at output.manifest.",
    "If generation fails, write a manifest with status \"error\" and no successful outputs.",
    "",
    "Expected manifest shape:",
    JSON.stringify(manifestSchema, null, 2),
    "",
    "Task spec:",
    JSON.stringify(taskSpec, null, 2)
  ].join("\n");
}
