#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env
import { Command } from "@cliffy/command";
import { loadConfig } from "./config.ts";
import {
  abandon,
  createBookmark,
  getBookmark,
  getDescription,
  getEmptyChangeIDs,
  getStackChangeIDs,
  gitFetch,
  gitPush,
  log,
  rebase,
} from "./jj.ts";
import {
  createPR,
  getNextAvailablePRNumber,
  getPRNumber,
  updatePRBody,
} from "./gh.ts";

async function prompt(question: string): Promise<string> {
  const buf = new Uint8Array(1024);
  await Deno.stdout.write(new TextEncoder().encode(question));
  const n = await Deno.stdin.read(buf);
  if (n === null) {
    return "";
  }
  return new TextDecoder().decode(buf.subarray(0, n)).trim();
}

async function runDefaultCommand(featureName?: string) {
  const config = await loadConfig();

  const changeIDs = await getStackChangeIDs(config.mainBranch);
  if (changeIDs.length === 0) {
    console.log("No stacked commits found");
    return;
  }

  const prStack: number[] = [];
  const descriptions: string[] = [];
  let lastBranch = "";

  for (let i = 0; i < changeIDs.length; i++) {
    const changeID = changeIDs[i];
    const commitNumber = i + 1;
    const desc = await getDescription(changeID);
    let bookmark = await getBookmark(changeID);

    if (!bookmark) {
      bookmark = await createBookmark(changeID, featureName!, commitNumber);
    }

    await gitPush(bookmark);
    console.log("Branch pushed to remote");

    let prNum = await getPRNumber(bookmark);

    if (prNum === -1) {
      console.log(`No PR created for branch yet, creating: ${bookmark}`);
      const firstLine = desc.split("\n")[0];
      const title = `${bookmark}: ${firstLine}`;
      const baseBranch = lastBranch || config.mainBranch;
      await createPR(bookmark, baseBranch, config.draft, title);
      console.log("PR created");
      prNum = await getPRNumber(bookmark);
    }

    prStack.push(prNum);
    descriptions.push(desc);
    lastBranch = bookmark;
  }

  for (let i = 0; i < prStack.length; i++) {
    const prNum = prStack[i];
    const desc = descriptions[i];

    let prInfo = "";
    if (prStack.length > 1) {
      prInfo = "\n---";
      for (let j = prStack.length - 1; j >= 0; j--) {
        if (i === j) {
          prInfo += `\n* **->** #${prStack[j]}`;
        } else {
          prInfo += `\n* #${prStack[j]}`;
        }
      }
    }

    const result = await updatePRBody(prNum, desc + "\n" + prInfo);
    if (result) {
      console.log("Successfully updated PR:", result);
    }
  }
}

async function runUpCommand() {
  const config = await loadConfig();

  console.log("Fetching from remote...");
  await gitFetch();

  console.log(`Rebasing onto ${config.mainBranch}...`);
  await rebase(config.mainBranch);

  const emptyChangeIDs = await getEmptyChangeIDs(config.mainBranch);

  await log(`${config.mainBranch}-..@`);

  for (const changeID of emptyChangeIDs) {
    const shortID = changeID.slice(0, 5);
    const answer = await prompt(`Abandoning change '${shortID}'? (y/n) `);
    const normalized = answer.toLowerCase().trim();

    if (normalized === "y" || normalized === "yes") {
      await abandon(changeID);
      console.log(`Abandoned ${shortID}`);
    } else {
      console.log("Abort");
      return;
    }
  }
}

const pushCommand = new Command()
  .description("Push commits and create/update stacked PRs")
  .arguments("<feature:string>")
  .action(async (_options: void, feature: string) => {
    try {
      await runDefaultCommand(feature);
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      Deno.exit(1);
    }
  });

const upCommand = new Command()
  .description("Fetch, rebase onto main, and abandon empty commits")
  .action(async () => {
    try {
      await runUpCommand();
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      Deno.exit(1);
    }
  });

const cmd = new Command()
  .name("stacked")
  .version("1.0.0")
  .description("Create/update stacked PRs for jj commits")
  .command("push", pushCommand)
  .command("up", upCommand);

if (Deno.args.length === 0) {
  cmd.showHelp();
} else {
  await cmd.parse(Deno.args);
}
