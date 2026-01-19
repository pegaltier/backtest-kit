const { spawn } = require("child_process");
const { apps } = require("./config/ecosystem.config.js");

const { sleep, singlerun } = require("functools-kit");

const RESTART_DELAY = 10_000;

function isBun() {
  if ("Bun" in globalThis) {
    return true;
  }
  return false;
}

Object.entries(process.env).filter(([key]) => key.startsWith("CC_")).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
})

// Store all child processes
const processes = [];

// Handle process termination
const killAllAndExit = singlerun(async (code) => {
  console.error(`A child process exited with code ${code}. Terminating all processes.`);
  processes.forEach((proc) => {
    if (!proc.killed) {
      proc.kill("SIGTERM");
    }
  });
  await sleep(RESTART_DELAY);
  process.exit(-1);
});

// Start all apps
apps.forEach((app) => {

  const args = [];

  {
    args.push(app.script);
    app.args && args.push(...app.args);
  }

  const child = spawn(isBun() ? "bun" : "node", args, {
    env: { ...process.env, ...app.env },
    stdio: ["inherit", "pipe", "pipe"],
  });

  // Pipe stdout and stderr to root process
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  // Log process start
  console.log(`Started ${app.name} with PID ${child.pid}`);

  // Handle child process exit
  child.on("exit", (code, signal) => {
    console.error(`${app.name} exited with code ${code} and signal ${signal}`);
    killAllAndExit(code);
  });

  // Handle child process errors
  child.on("error", (err) => {
    console.error(`${app.name} encountered an error: ${err.message}`);
    killAllAndExit(1);
  });

  processes.push(child);
});

// Handle main process termination
process.on("SIGINT", () => {
  console.log("\nReceived SIGINT. Terminating all child processes...");
  processes.forEach((proc) => {
    if (!proc.killed) {
      proc.kill("SIGTERM");
    }
  });
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\nReceived SIGTERM. Terminating all child processes...");
  processes.forEach((proc) => {
    if (!proc.killed) {
      proc.kill("SIGTERM");
    }
  });
  process.exit(0);
});

// Log when all processes are started
console.log(`Started ${apps.length} applications`);
