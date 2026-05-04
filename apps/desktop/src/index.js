import { createCodexExecPlan } from "./codex/codex-cli.js";
import { loadSettings } from "./config/settings.js";
import { createRetentionPlan } from "./maintenance/retention-policy.js";
import { createMobileRelayPlan } from "./mobile/mobile-relay-plan.js";
import { createDemoTask, createSchedulerPlan, runDemoRoutineOnce, runDemoScheduler } from "./runner/routine-runner.js";
import { buildCodexPrompt } from "./tasks/codex-task.js";

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const settings = loadSettings();
  const task = createDemoTask(settings);

  if (args.has("--demo-task")) {
    printJson(task);
    return;
  }

  if (args.has("--codex-dry-run")) {
    printJson({
      plan: createCodexExecPlan({ cwd: process.cwd(), settings }),
      prompt: buildCodexPrompt(task)
    });
    return;
  }

  if (args.has("--retention-plan")) {
    printJson(createRetentionPlan({ settings }));
    return;
  }

  if (args.has("--mobile-relay-plan")) {
    printJson(createMobileRelayPlan({ settings }));
    return;
  }

  if (args.has("--scheduler-plan")) {
    printJson(createSchedulerPlan({ settings }));
    return;
  }

  if (args.has("--run-once")) {
    printJson(await runDemoRoutineOnce({ settings }));
    return;
  }

  if (args.has("--scheduler-run")) {
    await runDemoScheduler({ settings });
    return;
  }

  process.stderr.write("Usage: node src/index.js --demo-task | --codex-dry-run | --retention-plan | --mobile-relay-plan | --scheduler-plan | --run-once | --scheduler-run\n");
  process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`auto-ducktape-wallpapers failed: ${message}\n`);
  process.exitCode = 1;
}
