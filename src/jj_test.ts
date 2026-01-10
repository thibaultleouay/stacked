import { assertEquals } from "@std/assert";

import {
  abandon,
  createBookmark,
  getBookmark,
  getChangeIDs,
  getDescription,
  getEmptyChangeIDs,
  getStackBookmarks,
  getStackChangeIDs,
  gitFetch,
  gitPush,
  gitPushAll,
  log,
  rebase,
  rebaseAll,
  resetCommandRunner,
  resetInteractiveCommandRunner,
  setCommandRunner,
  setInteractiveCommandRunner,
} from "./jj.ts";
import type { CommandResult } from "./utils.ts";

// Helper to create a mock CommandResult
function mockResult(
  stdout: string,
  stderr: string = "",
  code: number = 0,
): CommandResult {
  return { code, stdout, stderr };
}

// getChangeIDs tests

Deno.test("getChangeIDs - returns array of change IDs", async () => {
  setCommandRunner(() =>
    Promise.resolve(mockResult("abc123\ndef456\nghi789\n"))
  );

  try {
    const result = await getChangeIDs("main..@");
    assertEquals(result, ["abc123", "def456", "ghi789"]);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getChangeIDs - returns empty array when output is empty", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("")));

  try {
    const result = await getChangeIDs("main..@");
    assertEquals(result, []);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getChangeIDs - filters out empty lines", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("abc123\n\ndef456\n\n")));

  try {
    const result = await getChangeIDs("main..@");
    assertEquals(result, ["abc123", "def456"]);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getChangeIDs - passes correct arguments", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult("abc123\n"));
  });

  try {
    await getChangeIDs("main..@-");
    assertEquals(capturedArgs.includes("log"), true);
    assertEquals(capturedArgs.includes("--no-graph"), true);
    assertEquals(capturedArgs.includes("--reversed"), true);
    assertEquals(capturedArgs.includes("-r"), true);
    assertEquals(capturedArgs.includes("main..@-"), true);
    assertEquals(capturedArgs.includes("-T"), true);
  } finally {
    resetCommandRunner();
  }
});

// getStackChangeIDs tests

Deno.test("getStackChangeIDs - uses correct revset format", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult("abc123\n"));
  });

  try {
    await getStackChangeIDs("main");
    const revsetIndex = capturedArgs.indexOf("-r");
    assertEquals(capturedArgs[revsetIndex + 1], "main..@");
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getStackChangeIDs - uses custom changeId when provided", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult("abc123\n"));
  });

  try {
    await getStackChangeIDs("main", "xyz789");
    const revsetIndex = capturedArgs.indexOf("-r");
    assertEquals(capturedArgs[revsetIndex + 1], "main..xyz789");
  } finally {
    resetCommandRunner();
  }
});

// getDescription tests

Deno.test("getDescription - returns description for change ID", async () => {
  setCommandRunner(() =>
    Promise.resolve(mockResult("This is my commit message"))
  );

  try {
    const result = await getDescription("abc123");
    assertEquals(result, "This is my commit message");
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getDescription - passes correct arguments", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult("description"));
  });

  try {
    await getDescription("xyz789");
    assertEquals(capturedArgs.includes("log"), true);
    assertEquals(capturedArgs.includes("--no-graph"), true);
    assertEquals(capturedArgs.includes("-T"), true);
    assertEquals(capturedArgs.includes("description"), true);
    assertEquals(capturedArgs.includes("-r"), true);
    assertEquals(capturedArgs.includes("xyz789"), true);
  } finally {
    resetCommandRunner();
  }
});

// getBookmark tests

Deno.test("getBookmark - returns bookmark name", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("feature-branch: abc123")));

  try {
    const result = await getBookmark("abc123");
    assertEquals(result, "feature-branch");
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getBookmark - returns empty string when no bookmark", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("")));

  try {
    const result = await getBookmark("abc123");
    assertEquals(result, "");
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getBookmark - handles bookmark without colon", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("simple-branch")));

  try {
    const result = await getBookmark("abc123");
    assertEquals(result, "simple-branch");
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getBookmark - trims whitespace from bookmark name", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("  branch-name  ")));

  try {
    const result = await getBookmark("abc123");
    assertEquals(result, "branch-name");
  } finally {
    resetCommandRunner();
  }
});

// getStackBookmarks tests

Deno.test("getStackBookmarks - returns all bookmarks in stack", async () => {
  let callCount = 0;
  setCommandRunner(() => {
    callCount++;
    if (callCount === 1) {
      // getStackChangeIDs call
      return Promise.resolve(mockResult("change1\nchange2\nchange3\n"));
    }
    // getBookmark calls
    const bookmarks = [
      "branch1: change1",
      "branch2: change2",
      "branch3: change3",
    ];
    return Promise.resolve(mockResult(bookmarks[callCount - 2] || ""));
  });

  try {
    const result = await getStackBookmarks("main");
    assertEquals(result, ["branch1", "branch2", "branch3"]);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getStackBookmarks - stops at target bookmark", async () => {
  let callCount = 0;
  setCommandRunner(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(mockResult("change1\nchange2\nchange3\n"));
    }
    const bookmarks = [
      "branch1: change1",
      "branch2: change2",
      "branch3: change3",
    ];
    return Promise.resolve(mockResult(bookmarks[callCount - 2] || ""));
  });

  try {
    const result = await getStackBookmarks("main", "branch2");
    assertEquals(result, ["branch1", "branch2"]);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getStackBookmarks - skips changes without bookmarks", async () => {
  let callCount = 0;
  setCommandRunner(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(mockResult("change1\nchange2\nchange3\n"));
    }
    // Only first and third have bookmarks
    const bookmarks = ["branch1: change1", "", "branch3: change3"];
    return Promise.resolve(mockResult(bookmarks[callCount - 2] || ""));
  });

  try {
    const result = await getStackBookmarks("main");
    assertEquals(result, ["branch1", "branch3"]);
  } finally {
    resetCommandRunner();
  }
});

// createBookmark tests

Deno.test("createBookmark - creates bookmark with correct name", async () => {
  const capturedCalls: string[][] = [];
  setCommandRunner((_cmd, args) => {
    capturedCalls.push(args);
    return Promise.resolve(mockResult(""));
  });

  try {
    const result = await createBookmark("abc123", "user/pr-", 42);
    assertEquals(result, "user/pr-42");
    assertEquals(capturedCalls.length, 2);
    // First call: bookmark create
    assertEquals(capturedCalls[0].includes("bookmark"), true);
    assertEquals(capturedCalls[0].includes("create"), true);
    assertEquals(capturedCalls[0].includes("-r"), true);
    assertEquals(capturedCalls[0].includes("abc123"), true);
    assertEquals(capturedCalls[0].includes("user/pr-42"), true);
    // Second call: bookmark track
    assertEquals(capturedCalls[1].includes("bookmark"), true);
    assertEquals(capturedCalls[1].includes("track"), true);
    assertEquals(capturedCalls[1].includes("user/pr-42"), true);
  } finally {
    resetCommandRunner();
  }
});

// gitPush tests

Deno.test("gitPush - pushes bookmark", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await gitPush("feature-branch");
    assertEquals(capturedArgs.includes("git"), true);
    assertEquals(capturedArgs.includes("push"), true);
    assertEquals(capturedArgs.includes("-b"), true);
    assertEquals(capturedArgs.includes("feature-branch"), true);
  } finally {
    resetCommandRunner();
  }
});

// gitPushAll tests

Deno.test("gitPushAll - pushes all branches", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await gitPushAll();
    assertEquals(capturedArgs.includes("git"), true);
    assertEquals(capturedArgs.includes("push"), true);
    assertEquals(capturedArgs.includes("--all"), true);
  } finally {
    resetCommandRunner();
  }
});

// gitFetch tests

Deno.test("gitFetch - fetches from git", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await gitFetch();
    assertEquals(capturedArgs.includes("git"), true);
    assertEquals(capturedArgs.includes("fetch"), true);
  } finally {
    resetCommandRunner();
  }
});

// rebase tests

Deno.test("rebase - rebases onto main branch", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await rebase("main");
    assertEquals(capturedArgs.includes("rebase"), true);
    assertEquals(capturedArgs.includes("-d"), true);
    assertEquals(capturedArgs.includes("main"), true);
  } finally {
    resetCommandRunner();
  }
});

// rebaseAll tests

Deno.test("rebaseAll - rebases all onto main branch", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await rebaseAll("develop");
    assertEquals(capturedArgs.includes("rebase"), true);
    assertEquals(capturedArgs.includes("-A"), true);
    assertEquals(capturedArgs.includes("develop"), true);
  } finally {
    resetCommandRunner();
  }
});

// abandon tests

Deno.test("abandon - abandons change ID", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await abandon("abc123");
    assertEquals(capturedArgs.includes("abandon"), true);
    assertEquals(capturedArgs.includes("-r"), true);
    assertEquals(capturedArgs.includes("abc123"), true);
  } finally {
    resetCommandRunner();
  }
});

// log tests

Deno.test("log - runs interactive log with revset", async () => {
  let capturedCmd: string = "";
  let capturedArgs: string[] = [];
  setInteractiveCommandRunner((cmd, args) => {
    capturedCmd = cmd;
    capturedArgs = args;
    return Promise.resolve();
  });

  try {
    await log("main..@");
    assertEquals(capturedCmd, "jj");
    assertEquals(capturedArgs.includes("log"), true);
    assertEquals(capturedArgs.includes("-r"), true);
    assertEquals(capturedArgs.includes("main..@"), true);
  } finally {
    resetInteractiveCommandRunner();
  }
});

// getEmptyChangeIDs tests

Deno.test("getEmptyChangeIDs - returns empty change IDs", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("empty1\nempty2\n")));

  try {
    const result = await getEmptyChangeIDs("main");
    assertEquals(result, ["empty1", "empty2"]);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getEmptyChangeIDs - uses correct revset format", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await getEmptyChangeIDs("main");
    const revsetIndex = capturedArgs.indexOf("-r");
    assertEquals(capturedArgs[revsetIndex + 1], "(main..@-) & empty()");
  } finally {
    resetCommandRunner();
  }
});
