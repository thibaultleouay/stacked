import { runCommand, runCommandInteractive } from "./utils.ts";

async function jj(args: string[]): Promise<string> {
  const result = await runCommand("jj", args);
  return result.stdout;
}

export async function getChangeIDs(revset: string): Promise<string[]> {
  const output = await jj([
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

export async function getStackChangeIDs(mainBranch: string, changeId: string = "@"): Promise<string[]> {
  return getChangeIDs(`${mainBranch}..${changeId}`);
}

export async function getDescription(changeID: string): Promise<string> {
  return jj(["log", "--no-graph", "-T", "description", "-r", changeID]);
}

export async function getBookmark(changeID: string): Promise<string> {
  const output = await jj(["bookmark", "list", "-r", changeID]);
  if (!output) {
    return "";
  }

  const colonIndex = output.indexOf(":");
  if (colonIndex === -1) {
    return output.trim();
  }

  return output.slice(0, colonIndex);
}

export async function getStackBookmarks(mainBranch: string, targetBookmark: string): Promise<string[]> {
  const changeIDs = await getStackChangeIDs(mainBranch);
  const bookmarks: string[] = [];

  for (const changeID of changeIDs) {
    const bookmark = await getBookmark(changeID);
    if (bookmark) {
      bookmarks.push(bookmark);
      if (bookmark === targetBookmark) {
        break;
      }
    }
  }

  return bookmarks;
}

export async function getAllStackBookmarks(mainBranch: string): Promise<string[]> {
  const changeIDs = await getStackChangeIDs(mainBranch);
  const bookmarks: string[] = [];

  for (const changeID of changeIDs) {
    const bookmark = await getBookmark(changeID);
    if (bookmark) {
      bookmarks.push(bookmark);
    }
  }

  return bookmarks;
}

export async function createBookmark(
  changeID: string,
  branchPrefix: string,
  commitNumber: number,
): Promise<string> {
  const branchName = `${branchPrefix}${commitNumber}`;
  await jj(["bookmark", "create", "-r", changeID, branchName]);
  await jj(["bookmark", "track", branchName]);
  return branchName;
}

export async function gitPush(bookmark: string): Promise<void> {
  await runCommand("jj", ["git", "push", "-b", bookmark], {
    errorPrefix: `Failed to push branch ${bookmark}`,
  });
}

export async function gitPushAll(): Promise<void> {
  await jj(["git", "push", "--all"]);
}

export async function gitFetch(): Promise<void> {
  await jj(["git", "fetch"]);
}

export async function rebase(mainBranch: string): Promise<void> {
  await jj(["rebase", "-d", mainBranch]);
}

export async function rebaseAll(mainBranch: string): Promise<void> {
  await jj(["rebase", "-A", mainBranch]);
}

export async function abandon(changeID: string): Promise<void> {
  await jj(["abandon", "-r", changeID]);
}

export async function log(revset: string): Promise<void> {
  await runCommandInteractive("jj", ["log", "-r", revset]);
}

export async function getEmptyChangeIDs(mainBranch: string): Promise<string[]> {
  return getChangeIDs(`(${mainBranch}..@-) & empty()`);
}
