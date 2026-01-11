#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env
import { Command } from "@cliffy/command";
import { logger } from "./logger.ts";
import { loadConfig } from "./config.ts";
import {
  createBookmark,
  getBookmark,
  getDescription,
  getStackBookmarks,
  getStackChangeIDs,
  gitFetch,
  gitPush,
  gitPushAll,
  rebaseAll,
} from "./jj.ts";
import {
  createPR,
  getPRNumber,
  getPRState,
  mergePR,
  updatePRBase,
  updatePRBody,
} from "./gh.ts";

async function runDefaultCommand(featureName?: string, changeId: string = "@") {
  const config = await loadConfig();

  const changeIDs = await getStackChangeIDs(config.mainBranch, changeId);
  if (changeIDs.length === 0) {
    logger.info("No stacked commits found");
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
    logger.info("Branch pushed to remote");

    let prNum = await getPRNumber(bookmark);

    if (prNum === -1) {
      logger.info("No PR created for branch yet, creating: {bookmark}", { bookmark });
      const firstLine = desc.split("\n")[0];
      const title = `${bookmark}: ${firstLine}`;
      const baseBranch = lastBranch || config.mainBranch;
      await createPR(bookmark, baseBranch, config.draft, title);
      logger.info("PR created");
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
      logger.info("Successfully updated PR: {result}", { result });
    }
  }
}

async function runMergeCommand(targetBookmark: string) {
  const config = await loadConfig();

  const bookmarks = await getStackBookmarks(config.mainBranch, targetBookmark);
  if (bookmarks.length === 0) {
    logger.info("No bookmarks found in stack");
    return;
  }

  if (!bookmarks.includes(targetBookmark)) {
    logger.info("Bookmark '{targetBookmark}' not found in current stack", { targetBookmark });
    return;
  }

  logger.info("Merging {count} PR(s) to {mainBranch}...", { count: bookmarks.length, mainBranch: config.mainBranch });

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i];
    logger.info("\nProcessing PR for branch: {bookmark}", { bookmark });

    if ((await getPRState(bookmark)) === "MERGED") {
      logger.info("PR for {bookmark} is already merged, skipping...", { bookmark });
      continue;
    }

    await mergePR(bookmark);
    logger.info("Merged {bookmark}", { bookmark });

    logger.info("Fetching from remote...");
    await gitFetch();

    logger.info("Rebasing onto {mainBranch}...", { mainBranch: config.mainBranch });
    await rebaseAll(config.mainBranch);

    logger.info("Pushing to remote...");
    await gitPushAll();

    // Update base branches for remaining PRs in the stack (within target bookmarks)
    const remainingBookmarks = bookmarks.slice(i + 1);
    if (remainingBookmarks.length > 0) {
      logger.info("Updating base branches for remaining PRs...");
      for (let j = 0; j < remainingBookmarks.length; j++) {
        const remainingBookmark = remainingBookmarks[j];
        const newBase = j === 0 ? config.mainBranch : remainingBookmarks[j - 1];
        await updatePRBase(remainingBookmark, newBase);
        logger.info("Updated {bookmark} to target {base}", { bookmark: remainingBookmark, base: newBase });
      }
    }
  }

  // After all merges, check if there are remaining bookmarks in the stack beyond the target
  const allRemainingBookmarks = await getStackBookmarks(config.mainBranch);
  if (allRemainingBookmarks.length > 0) {
    logger.info("\nUpdating base branch for remaining PRs in the stack...");
    // Update all remaining PRs: first targets main, rest target previous bookmark
    let lastOpenBookmark = "";
    for (let j = 0; j < allRemainingBookmarks.length; j++) {
      const remainingBookmark = allRemainingBookmarks[j];
      if ((await getPRState(remainingBookmark)) !== "OPEN") {
        logger.info("Skipping {bookmark} (PR is not open)", { bookmark: remainingBookmark });
        continue;
      }
      const newBase = lastOpenBookmark || config.mainBranch;
      await updatePRBase(remainingBookmark, newBase);
      logger.info("Updated {bookmark} to target {base}", { bookmark: remainingBookmark, base: newBase });
      lastOpenBookmark = remainingBookmark;
    }
  }

  logger.info("\nAll PRs merged successfully!");
}

const pushCommand = new Command()
  .description("Push commits and create/update stacked PRs")
  .option("-b, --bookmark <bookmark:string>", "Bookmark name for the branch prefix", { required: true })
  .option("-c, --change <change_id:string>", "Change ID to use as the stack tip", { default: "@" })
  .action(async (options: { bookmark: string; change: string }) => {
    try {
      await runDefaultCommand(options.bookmark, options.change);
    } catch (err) {
      logger.error("Error: {error}", { error: err instanceof Error ? err.message : err });
      Deno.exit(1);
    }
  });

const mergeCommand = new Command()
  .description("Merge all PRs up to and including the specified bookmark")
  .option("-b, --bookmark <bookmark:string>", "Target bookmark to merge up to", { required: true })
  .action(async (options: { bookmark: string }) => {
    try {
      await runMergeCommand(options.bookmark);
    } catch (err) {
      logger.error("Error: {error}", { error: err instanceof Error ? err.message : err });
      Deno.exit(1);
    }
  });

const cmd = new Command()
  .name("stacked")
  .version("0.0.1")
  .description("Create/merge stacked PRs on GitHub for jj changes")
  .command("push", pushCommand)
  .command("merge", mergeCommand);

if (Deno.args.length === 0) {
  cmd.showHelp();
} else {
  await cmd.parse(Deno.args);
}
