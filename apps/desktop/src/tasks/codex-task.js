import { randomInt, randomUUID } from "node:crypto";

export function buildCodexTask({ routine, targets, output, settings, now = new Date() }) {
  const timestamp = toFilenameTimestamp(now);
  const promptVariation = createPromptVariation(routine.promptVariation);
  const randomPromptScript = createRandomPromptScript({
    routine,
    settings,
    promptVariation
  });

  return {
    task: "generate_and_prepare_wallpaper",
    imageModel: settings.codex.imageModel,
    fallback: settings.codex.fallback,
    promptMode: routine.promptMode,
    userInstruction: routine.userInstruction,
    promptVariation,
    randomPromptScript,
    run: {
      timestamp: now.toISOString(),
      filenameTimestamp: timestamp
    },
    naming: {
      imageFilenamePattern: settings.naming.imageFilenamePattern,
      timestamp,
      example: renderFilename(settings.naming.imageFilenamePattern, {
        routineId: routine.id,
        targetId: "{targetId}",
        timestamp
      })
    },
    postProcessing: settings.postProcessing,
    retention: settings.retention,
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
  const maxAttempts = taskSpec.postProcessing.maxGptImage2UpscaleAttempts;
  const upscaleInstructions = maxAttempts > 0
    ? [
        "If an image is smaller than its target, keep this Codex session alive, send that same image back to gpt-image-2, and ask for a higher-resolution version that preserves composition, subject identity, style, and mood.",
        "Try the gpt-image-2 upscale/edit pass at most postProcessing.maxGptImage2UpscaleAttempts times.",
        "If target resolution still fails after the maximum attempts, select the best available image for that target and proceed.",
        "Use local resize, crop, or padding only as the final canvas-conformance fallback after the gpt-image-2 upscale/edit pass has been attempted or clearly determined unnecessary."
      ]
    : [
        "Do not run any gpt-image-2 upscale/edit retry pass.",
        "If a generated image is smaller than its target, select the best available generated image for that target and proceed immediately.",
        "Use local resize, crop, or padding only as the final canvas-conformance fallback when needed."
      ];

  const manifestSchema = {
    status: "ok",
    model: taskSpec.imageModel,
    finalPrompt: "string",
    postProcessing: {
      nativeGeneration: "attempted",
      gptImage2Upscale: {
        status: "not_required",
        attempts: 0,
        maxAttempts
      },
      selectedOutputReason: "native_target_size",
      localFinalFit: "not_required"
    },
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
    `Use ${taskSpec.imageModel} only. Do not fall back to any other image model.`,
    "Do not write code that calls the OpenAI API directly.",
    "For simple promptMode, first use taskSpec.randomPromptScript.script as the intermediate randomization script, then expand userInstruction into a detailed image prompt from that script.",
    "For advanced promptMode, preserve the user's prompt intent and only adapt it for wallpaper constraints.",
    "If taskSpec.randomPromptScript.enabled is true, the finalPrompt must clearly incorporate its selected composition, content, mood, palette, and surprise details.",
    "If taskSpec.promptVariation.enabled is true, treat taskSpec.promptVariation.selected as strong creative direction for this run.",
    "When generic randomPromptScript choices and routine-specific promptVariation choices overlap, blend them without contradiction and prioritize routine-specific subject choices.",
    "Make each recurring run feel meaningfully different from a previous run while preserving wallpaper usability.",
    "Create one image per target using the exact requested width and height when possible.",
    "Name each output image with the provided naming.imageFilenamePattern and naming.timestamp.",
    "After each generation, inspect the actual image dimensions.",
    ...upscaleInstructions,
    "For recurring routines, prioritize writing usable outputs and a manifest before timeout over perfect target resolution.",
    "Record native generation, gpt-image-2 upscale/edit, and local final fit decisions in manifest.postProcessing.",
    "If local final fit is used, add a warning explaining that final canvas conformance required local processing.",
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

function toFilenameTimestamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function renderFilename(pattern, values) {
  return pattern
    .replaceAll("{routineId}", values.routineId)
    .replaceAll("{targetId}", values.targetId)
    .replaceAll("{timestamp}", values.timestamp);
}

function createPromptVariation(promptVariation) {
  if (!promptVariation?.enabled) {
    return {
      enabled: false
    };
  }

  const dimensions = promptVariation.dimensions ?? {};
  const selected = Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, values]) => [key, pickOne(values)])
      .filter(([, value]) => value !== null)
  );

  return {
    enabled: true,
    seed: randomUUID(),
    direction: promptVariation.direction,
    selected
  };
}

function createRandomPromptScript({ routine, settings, promptVariation }) {
  if (routine.promptMode !== "simple") {
    return {
      enabled: false,
      reason: "advanced_prompt_mode"
    };
  }

  const config = settings.simplePromptRandomization ?? {};
  if (config.enabled === false) {
    return {
      enabled: false,
      reason: "disabled_by_settings"
    };
  }

  const selected = {
    ...selectDimensions(config.dimensions),
    routineSpecific: promptVariation.enabled ? promptVariation.selected : {}
  };
  const seed = randomUUID();

  return {
    enabled: true,
    seed,
    mode: config.mode ?? "always_for_simple_prompts",
    direction: config.direction ?? "Create a varied wallpaper prompt from a short user instruction.",
    selected,
    script: renderRandomPromptScript({
      userInstruction: routine.userInstruction,
      selected,
      direction: config.direction
    })
  };
}

function selectDimensions(dimensions = {}) {
  return Object.fromEntries(
    Object.entries(dimensions)
      .map(([key, values]) => [key, pickOne(values)])
      .filter(([, value]) => value !== null)
  );
}

function renderRandomPromptScript({ userInstruction, selected, direction }) {
  const routineSpecific = selected.routineSpecific ?? {};
  const routineSpecificText = Object.entries(routineSpecific)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");

  return [
    "Intermediate random prompt script:",
    `Base user instruction: ${userInstruction}`,
    `Run direction: ${direction ?? "Make this run distinct, delightful, and wallpaper-friendly."}`,
    `Content twist: ${selected.contentTwist ?? "fresh subject detail"}`,
    `Composition: ${selected.composition ?? "clean wallpaper composition with useful negative space"}`,
    `Scene logic: ${selected.sceneLogic ?? "coherent environment around the subject"}`,
    `Viewpoint: ${selected.viewpoint ?? "natural camera viewpoint"}`,
    `Mood: ${selected.mood ?? "pleasant and visually calm"}`,
    `Palette: ${selected.palette ?? "balanced colors with readable desktop icon space"}`,
    `Texture/detail: ${selected.textureDetail ?? "subtle tactile detail without clutter"}`,
    `Surprise detail: ${selected.surpriseDetail ?? "one small charming detail"}`,
    routineSpecificText ? `Routine-specific choices: ${routineSpecificText}` : "Routine-specific choices: none",
    "Blend rule: if generic and routine-specific choices overlap, prioritize the routine-specific subject and setting while using generic choices for framing, mood nuance, and surprise.",
    "Final prompt rule: make the selected choices visible, but keep the result uncluttered, text-free, logo-free, and suitable as a wallpaper."
  ].join("\n");
}

function pickOne(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  return values[randomInt(values.length)];
}
