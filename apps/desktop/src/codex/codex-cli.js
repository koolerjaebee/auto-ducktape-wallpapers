import { spawn } from "node:child_process";

export function createCodexExecPlan({ cwd, settings }) {
  return {
    command: settings.codex.command,
    args: settings.codex.args,
    cwd
  };
}

export function runCodexExec({ prompt, cwd, settings }) {
  const plan = createCodexExecPlan({ cwd, settings });
  const timeoutSeconds = settings.codex.timeoutSeconds ?? 600;

  return new Promise((resolve, reject) => {
    let timedOut = false;
    let settled = false;
    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutSeconds * 1000);

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      rejectOnce(error);
    });

    child.on("close", (code) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      if (timedOut) {
        reject(new Error(`codex exec timed out after ${timeoutSeconds} seconds.`));
        return;
      }

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`codex exec exited with code ${code}: ${stderr}`));
    });

    child.stdin.on("error", (error) => {
      // The child can exit before stdin finishes when command setup fails.
      if (error?.code !== "EPIPE") {
        rejectOnce(error);
      }
    });

    // Use stdin so prompt content never depends on shell quoting.
    child.stdin.end(prompt);

    function rejectOnce(error) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      reject(error);
    }
  });
}
