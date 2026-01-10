import { parseJson, PRListItemSchema, PRStateSchema, PRViewSchema, runCommand } from "./utils.ts";

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

export async function isPRDraft(branch: string): Promise<boolean> {
  const result = await runCommand(
    "gh",
    ["pr", "view", branch, "--json", "isDraft"],
    { errorPrefix: `Failed to get PR draft status for branch ${branch}` },
  );

  const parsed = parseJson(result.stdout, PRViewSchema);
  if (!parsed) {
    throw new Error(`Failed to parse PR draft status for branch ${branch}`);
  }

  return parsed.isDraft;
}

export async function markPRReady(branch: string): Promise<void> {
  await runCommand(
    "gh",
    ["pr", "ready", branch],
    { errorPrefix: `Failed to mark PR as ready for branch ${branch}` },
  );
}

export async function mergePR(branch: string): Promise<void> {
  const isDraft = await isPRDraft(branch);
  if (isDraft) {
    console.log(`PR for ${branch} is a draft, marking as ready for review...`);
    await markPRReady(branch);
  }

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

async function getPRState(branch: string): Promise<string | null> {
  const result = await runCommand(
    "gh",
    ["pr", "view", branch, "--json", "state"],
    { throwOnError: false },
  );

  if (result.code !== 0) {
    return null;
  }

  const parsed = parseJson(result.stdout, PRStateSchema);
  return parsed?.state ?? null;
}

export async function isPRMerged(branch: string): Promise<boolean> {
  return (await getPRState(branch)) === "MERGED";
}

export async function isPROpen(branch: string): Promise<boolean> {
  return (await getPRState(branch)) === "OPEN";
}
