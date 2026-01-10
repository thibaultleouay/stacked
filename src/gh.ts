import { parseJson, PRListItemSchema, runCommand } from "./utils.ts";

export async function getNextAvailablePRNumber(): Promise<number> {
  const result = await runCommand("gh", [
    "pr",
    "list",
    "-L",
    "1",
    "--state",
    "all",
    "--json",
    "number",
  ], { errorPrefix: "Failed to get PR list" });

  const parsed = parseJson(result.stdout, PRListItemSchema);
  if (!parsed || parsed.length === 0) {
    return 1;
  }

  return parsed[0].number + 1;
}

export async function getPRNumber(branch: string): Promise<number> {
  const result = await runCommand(
    "gh",
    [
      "pr",
      "list",
      "-L",
      "1",
      "--state",
      "all",
      "--json",
      "number",
      "--head",
      branch,
    ],
    { throwOnError: false },
  );

  if (result.code !== 0) {
    console.error(`Warning: Failed to get PR for branch ${branch}: ${result.stderr}`);
    return -1;
  }

  const parsed = parseJson(result.stdout, PRListItemSchema);
  if (!parsed || parsed.length === 0) {
    return -1;
  }

  return parsed[0].number;
}

export async function createPR(
  head: string,
  base: string,
  draft: boolean,
  title: string,
): Promise<string> {
  const args = [
    "pr",
    "create",
    "-H",
    head,
    "-B",
    base,
    "--fill-first",
    "--title",
    title,
  ];
  if (draft) {
    args.push("--draft");
  }

  const result = await runCommand("gh", args, {
    errorPrefix: "Failed to create PR",
  });

  return result.stdout;
}

export async function updatePRBody(
  prNum: number,
  body: string,
): Promise<string> {
  const result = await runCommand(
    "gh",
    ["pr", "edit", String(prNum), "-b", body],
    { errorPrefix: `Failed to update PR #${prNum}` },
  );

  return result.stdout;
}

export async function mergePR(branch: string): Promise<void> {
  await runCommand(
    "gh",
    ["pr", "merge", branch, "--squash"],
    { errorPrefix: `Failed to merge PR for branch ${branch}` },
  );
}

export async function updatePRBase(
  branch: string,
  newBase: string,
): Promise<void> {
  await runCommand(
    "gh",
    ["pr", "edit", branch, "--base", newBase],
    { errorPrefix: `Failed to update base branch for PR ${branch}` },
  );
}
