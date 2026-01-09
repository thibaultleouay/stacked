interface PRListItem {
  number: number;
}

export async function getNextAvailablePRNumber(): Promise<number> {
  const command = new Deno.Command("gh", {
    args: ["pr", "list", "-L", "1", "--state", "all", "--json", "number"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();

  if (code !== 0) {
    const stderrText = new TextDecoder().decode(stderr);
    throw new Error(`Failed to get PR list: ${stderrText}`);
  }

  const output = new TextDecoder().decode(stdout);
  const parsed = JSON.parse(output) as PRListItem[];
  if (parsed.length === 0 || parsed[0].number === undefined) {
    return 1;
  }

  return parsed[0].number + 1;
}

export async function getPRNumber(branch: string): Promise<number> {
  const command = new Deno.Command("gh", {
    args: [
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
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout } = await command.output();

  if (code !== 0) {
    return -1;
  }

  const output = new TextDecoder().decode(stdout);
  const parsed = JSON.parse(output) as PRListItem[];
  if (parsed.length === 0 || parsed[0].number === undefined) {
    return -1;
  }

  return parsed[0].number;
}

export async function createPR(
  head: string,
  base: string,
  draft: boolean
): Promise<string> {
  const args = ["pr", "create", "-H", head, "-B", base, "--fill-first"];
  if (draft) {
    args.push("--draft");
  }

  const command = new Deno.Command("gh", {
    args,
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await command.output();

  if (code !== 0) {
    const stderrText = new TextDecoder().decode(stderr);
    throw new Error(`Failed to create PR: ${stderrText}`);
  }

  return new TextDecoder().decode(stdout).trim();
}

export async function updatePRBody(prNum: number, body: string): Promise<string> {
  const command = new Deno.Command("gh", {
    args: ["pr", "edit", String(prNum), "-b", body],
    stdout: "piped",
    stderr: "piped",
  });
  const { stdout } = await command.output();
  return new TextDecoder().decode(stdout).trim();
}
