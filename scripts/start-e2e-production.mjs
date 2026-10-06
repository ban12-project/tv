import { spawn } from "node:child_process";
import { cp } from "node:fs/promises";

// Match the container's standalone server and static-asset layout.
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  env: {
    ...process.env,
    HOSTNAME: "127.0.0.1",
    PORT: process.env.E2E_PORT ?? "3102",
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
