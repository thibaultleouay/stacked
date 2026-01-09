export async function run(args: string[]): Promise<string> {
  const [cmd, ...cmdArgs] = args;
  const command = new Deno.Command(cmd, {
    args: cmdArgs,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();
  if (code !== 0) {
    const stderrText = new TextDecoder().decode(stderr);
    throw new Error(`Command failed: ${args.join(" ")}\n${stderrText}`);
  }
  return new TextDecoder().decode(stdout).trimEnd();
}

export async function runWithStdout(args: string[]): Promise<void> {
  const [cmd, ...cmdArgs] = args;
  const command = new Deno.Command(cmd, {
    args: cmdArgs,
    stdout: "inherit",
    stderr: "inherit",
  });
  await command.output();
}

export async function getChangeIDs(revset: string): Promise<string[]> {
  const output = await run([
    "jj",
    "log",
    "--no-graph",
    "--reversed",
    "-r",
    revset,
    "-T",
    'change_id ++ "\\n"',
  ]);

  if (output.length === 0) {
    return [];
  }

  return output.split("\n").filter((id) => id.length > 0);
}

export async function getStackChangeIDs(mainBranch: string): Promise<string[]> {
  return getChangeIDs(`${mainBranch}..@`);
}

export async function getDescription(changeID: string): Promise<string> {
  return run(["jj", "log", "--no-graph", "-T", "description", "-r", changeID]);
}

export async function getBookmark(changeID: string): Promise<string> {
  const output = await run(["jj", "bookmark", "list", "-r", changeID]);
  if (!output) {
    return "";
  }
  return output.split(":")[0];
}

export async function createBookmark(
  changeID: string,
  branchPrefix: string,
  commitNumber: number,
): Promise<string> {
  const branchName = `${branchPrefix}${commitNumber}`;
  await run(["jj", "bookmark", "create", "-r", changeID, branchName]);
  await run(["jj", "bookmark", "track", branchName]);
  return branchName;
}

export async function gitPush(bookmark: string): Promise<void> {
  const command = new Deno.Command("jj", {
    args: ["git", "push", "-b", bookmark],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await command.output();
  if (code !== 0) {
    const stderrText = new TextDecoder().decode(stderr);
    throw new Error(`Failed to push branch: ${stderrText}`);
  }
}

export async function gitFetch(): Promise<void> {
  await run(["jj", "git", "fetch"]);
}

export async function rebase(mainBranch: string): Promise<void> {
  await run(["jj", "rebase", "-d", mainBranch]);
}

export async function abandon(changeID: string): Promise<void> {
  await run(["jj", "abandon", "-r", changeID]);
}

export async function log(revset: string): Promise<void> {
  await runWithStdout(["jj", "log", "-r", revset]);
}

export async function getEmptyChangeIDs(mainBranch: string): Promise<string[]> {
  return getChangeIDs(`(${mainBranch}..@-) & empty()`);
}
