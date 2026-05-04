import { randomInt, randomUUID } from "node:crypto";

export function buildCodexTask({ routine, targets, output, settings, now = new Date() }) {
  const timestamp = toFilenameTimestamp(now);
  const randomizationGenerator = resolveRandomizationGenerator({
    routine,
    settings
  });
  const promptVariation = createPromptVariation(routine.promptVariation, {
    selectLocally: randomizationGenerator !== "codex"
  });
  const randomPromptScript = createRandomPromptScript({
    routine,
    settings,
    promptVariation,
    generator: randomizationGenerator
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
      promptSlug: settings.naming.promptSlug ?? defaultPromptSlugSettings(),
      example: renderFilename(settings.naming.imageFilenamePattern, {
        routineId: routine.id,
        promptSlug: "{promptSlug}",
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
    promptSlug: "string",
    intermediateRandomization: {
      generator: "codex",
      seed: "string",
      script: "string",
      selected: {}
    },
    warnings: []
  };

  return [
    "You are running inside Codex as the wallpaper generation worker.",
    "Generate wallpaper images through Codex image generation capabilities only.",
    "Use the authenticated Codex session's built-in image generation capability; do not require OPENAI_API_KEY.",
    "Never treat a missing OPENAI_API_KEY as a blocker because this app intentionally uses ChatGPT/Codex auth instead of API keys.",
    "Only report generation failure when Codex image generation itself is unavailable or returns an error.",
    `Use ${taskSpec.imageModel} only. Do not fall back to any other image model.`,
    "Do not write code that calls the OpenAI API directly.",
    "For simple promptMode, first write an intermediate randomization script yourself, then expand userInstruction into a detailed image prompt from that script.",
    "If taskSpec.randomPromptScript.generator is \"codex\", use taskSpec.randomPromptScript.candidateDimensions and routineSpecificDimensions as creative menus; choose a coherent subset instead of copying every option.",
    "If taskSpec.randomPromptScript.script is present, you may use it as a local seed, but still rewrite the intermediate randomization in your own words.",
    "Record the intermediate randomization script and chosen slots in manifest.intermediateRandomization.",
    "For advanced promptMode, preserve the user's prompt intent and only adapt it for wallpaper constraints.",
    "If taskSpec.randomPromptScript.enabled is true, the finalPrompt must clearly incorporate the selected composition, content, mood, palette, and surprise details.",
    "If taskSpec.promptVariation.enabled is true, treat taskSpec.promptVariation.selected or dimensions as strong creative direction for this run.",
    "When generic randomPromptScript choices and routine-specific promptVariation choices overlap, blend them without contradiction and prioritize routine-specific subject choices.",
    "Make each recurring run feel meaningfully different from a previous run while preserving wallpaper usability.",
    "Create one image per target using the exact requested width and height when possible.",
    "After finalPrompt is written, create one promptSlug from the actual finalPrompt if naming.promptSlug.enabled is true.",
    "The promptSlug must be lowercase ASCII kebab-case, filesystem-safe, short, descriptive, and derived from the visible wallpaper concept rather than the routine name.",
    "Do not include target id, platform, resolution, timestamp, private data, or unsupported characters in promptSlug.",
    "Name each output image with naming.imageFilenamePattern, naming.timestamp, targetId, and promptSlug when the pattern contains {promptSlug}.",
    "Use the same promptSlug for all targets in one run.",
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
    .replaceAll("{promptSlug}", values.promptSlug)
    .replaceAll("{targetId}", values.targetId)
    .replaceAll("{timestamp}", values.timestamp);
}

function resolveRandomizationGenerator({ routine, settings }) {
  if (routine.promptMode !== "simple") {
    return "local";
  }

  const config = settings.simplePromptRandomization ?? {};
  if (config.enabled === false) {
    return "local";
  }

  return config.generator ?? "codex";
}

function defaultPromptSlugSettings() {
  return {
    enabled: false,
    source: "routine_id",
    style: "lowercase_ascii_kebab",
    maxWords: 6,
    maxLength: 64,
    fallback: "wallpaper"
  };
}

function createPromptVariation(promptVariation, { selectLocally = true } = {}) {
  if (!promptVariation?.enabled) {
    return {
      enabled: false
    };
  }

  const dimensions = promptVariation.dimensions ?? {};
  const selected = selectLocally ? selectDimensions(dimensions) : undefined;

  const result = {
    enabled: true,
    seed: randomUUID(),
    direction: promptVariation.direction,
    dimensions
  };

  if (selected !== undefined) {
    result.selected = selected;
  }

  return result;
}

function createRandomPromptScript({ routine, settings, promptVariation, generator }) {
  if (routine.promptMode !== "simple") {
    return {
      enabled: false,
      reason: "advanced_prompt_mode"
    };
  }

  const config = settings.simplePromptRandomization ?? {};
  const seed = randomUUID();

  if (config.enabled === false) {
    return {
      enabled: false,
      reason: "disabled_by_settings"
    };
  }

  if (generator === "codex") {
    return {
      enabled: true,
      seed,
      generator: "codex",
      mode: config.mode ?? "codex_generated_for_simple_prompts",
      direction: config.direction ?? "Create a varied wallpaper prompt from a short user instruction.",
      candidateDimensions: config.dimensions ?? {},
      routineSpecificDimensions: promptVariation.enabled ? promptVariation.dimensions ?? {} : {},
      instructions: [
        "Write a fresh intermediate randomization script for this run.",
        "Use the candidate dimensions as a creative menu, not a checklist.",
        "Keep routine-specific subject choices coherent with the user's instruction.",
        "Then turn the script into a concise final image prompt."
      ]
    };
  }

  const selected = {
    ...selectDimensions(config.dimensions),
    routineSpecific: promptVariation.enabled ? promptVariation.selected : {}
  };

  return {
    enabled: true,
    seed,
    generator: "local",
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
