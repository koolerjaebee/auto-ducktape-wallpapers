import { createCodexExecPlan } from "./codex/codex-cli.js";
import { resolveTargets } from "./devices/resolution-resolver.js";
import { createDemoRoutine } from "./routines/demo-routine.js";
import { buildCodexPrompt, buildCodexTask } from "./tasks/codex-task.js";

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function createDemoTask() {
  const routine = createDemoRoutine();
  const targets = resolveTargets(routine);
  return buildCodexTask({
    routine,
    targets,
    output: {
      directory: "./out",
      manifest: "./out/manifest.json"
    }
  });
}

function main() {
  const args = new Set(process.argv.slice(2));
  const task = createDemoTask();

  if (args.has("--demo-task")) {
    printJson(task);
    return;
  }

  if (args.has("--codex-dry-run")) {
    printJson({
      plan: createCodexExecPlan({ cwd: process.cwd() }),
      prompt: buildCodexPrompt(task)
    });
    return;
  }

  process.stderr.write("Usage: node src/index.js --demo-task | --codex-dry-run\n");
  process.exitCode = 1;
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`auto-ducktape-desktop failed: ${message}\n`);
  process.exitCode = 1;
}
