#!/usr/bin/env -S deno run --allow-run

async function runJJ(args: string[]): Promise<number> {
  const command = new Deno.Command('jj', {
    args: args,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const process = command.spawn();
  const { code } = await process.status;

  return code;
}

if (import.meta.main) {
  const args = Deno.args;

  if (args.length === 0) {
    console.log("Usage: stacked <jj-command> [arguments...]");
    console.log("Example: stacked log");
    console.log("Example: stacked status");
    Deno.exit(0);
  }

  const exitCode = await runJJ(args);
  Deno.exit(exitCode);
}

export { runJJ };
