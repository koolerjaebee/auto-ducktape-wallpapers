import { spawn } from "node:child_process";

export function createCodexExecPlan({ cwd }) {
  return {
    command: "codex",
    args: ["exec", "--json", "--sandbox", "workspace-write", "-"],
    cwd
  };
}

export function runCodexExec({ prompt, cwd }) {
  const plan = createCodexExecPlan({ cwd });

  return new Promise((resolve, reject) => {
    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      stdio: ["pipe", "pipe", "pipe"]
    });

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
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`codex exec exited with code ${code}: ${stderr}`));
    });

    // Use stdin so prompt content never depends on shell quoting.
    child.stdin.end(prompt);
  });
}
