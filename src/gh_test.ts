import { assertEquals, assertRejects } from "jsr:@std/assert";

import {
  createPR,
  getPRNumber,
  getPRState,
  isPRDraft,
  markPRReady,
  mergePR,
  resetCommandRunner,
  setCommandRunner,
  updatePRBase,
  updatePRBody,
} from "./gh.ts";
import type { CommandResult } from "./utils.ts";

// Helper to create a mock CommandResult
function mockResult(
  stdout: string,
  stderr: string = "",
  code: number = 0,
): CommandResult {
  return { code, stdout, stderr };
}

Deno.test("getPRNumber - returns PR number when found", async () => {
  setCommandRunner(() => Promise.resolve(mockResult(JSON.stringify([{ number: 42 }]))));

  try {
    const result = await getPRNumber("feature-branch");
    assertEquals(result, 42);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getPRNumber - returns -1 when command fails", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("", "Error: no PR found", 1)));

  try {
    const result = await getPRNumber("nonexistent-branch");
    assertEquals(result, -1);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getPRNumber - returns -1 when no PRs found", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("[]")));

  try {
    const result = await getPRNumber("branch-without-pr");
    assertEquals(result, -1);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getPRNumber - returns -1 when JSON parsing fails", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("invalid json")));

  try {
    const result = await getPRNumber("branch");
    assertEquals(result, -1);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("createPR - creates PR and returns URL", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("https://github.com/owner/repo/pull/1")));

  try {
    const result = await createPR("feature", "main", false, "My PR Title");
    assertEquals(result, "https://github.com/owner/repo/pull/1");
  } finally {
    resetCommandRunner();
  }
});

Deno.test("createPR - includes draft flag when draft is true", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult("https://github.com/owner/repo/pull/2"));
  });

  try {
    await createPR("feature", "main", true, "Draft PR");
    assertEquals(capturedArgs.includes("--draft"), true);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("createPR - does not include draft flag when draft is false", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult("url"));
  });

  try {
    await createPR("feature", "main", false, "Non-draft PR");
    assertEquals(capturedArgs.includes("--draft"), false);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("createPR - passes correct arguments", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult("url"));
  });

  try {
    await createPR("my-feature", "develop", false, "Title");

    assertEquals(capturedArgs.includes("-H"), true);
    assertEquals(capturedArgs.includes("my-feature"), true);
    assertEquals(capturedArgs.includes("-B"), true);
    assertEquals(capturedArgs.includes("develop"), true);
    assertEquals(capturedArgs.includes("--title"), true);
    assertEquals(capturedArgs.includes("Title"), true);
    assertEquals(capturedArgs.includes("--fill-first"), true);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("updatePRBody - updates PR body successfully", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult("PR updated"));
  });

  try {
    const result = await updatePRBody(123, "New body content");
    assertEquals(result, "PR updated");

    assertEquals(capturedArgs.includes("123"), true);
    assertEquals(capturedArgs.includes("-b"), true);
    assertEquals(capturedArgs.includes("New body content"), true);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("isPRDraft - returns true when PR is draft", async () => {
  setCommandRunner(() => Promise.resolve(mockResult(JSON.stringify({ isDraft: true }))));

  try {
    const result = await isPRDraft("draft-branch");
    assertEquals(result, true);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("isPRDraft - returns false when PR is not draft", async () => {
  setCommandRunner(() => Promise.resolve(mockResult(JSON.stringify({ isDraft: false }))));

  try {
    const result = await isPRDraft("ready-branch");
    assertEquals(result, false);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("isPRDraft - throws error when JSON parsing fails", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("invalid json")));

  try {
    await assertRejects(
      () => isPRDraft("branch"),
      Error,
      "Failed to parse PR draft status",
    );
  } finally {
    resetCommandRunner();
  }
});

Deno.test("markPRReady - marks PR as ready", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await markPRReady("my-branch");

    assertEquals(capturedArgs.includes("pr"), true);
    assertEquals(capturedArgs.includes("ready"), true);
    assertEquals(capturedArgs.includes("my-branch"), true);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("mergePR - merges non-draft PR directly", async () => {
  let callCount = 0;
  setCommandRunner(() => {
    callCount++;
    if (callCount === 1) {
      // isPRDraft call
      return Promise.resolve(mockResult(JSON.stringify({ isDraft: false })));
    }
    // merge call
    return Promise.resolve(mockResult(""));
  });

  try {
    await mergePR("ready-branch");
    assertEquals(callCount, 2); // isPRDraft + merge
  } finally {
    resetCommandRunner();
  }
});

Deno.test("mergePR - marks draft PR as ready before merging", async () => {
  let callCount = 0;
  setCommandRunner(() => {
    callCount++;
    if (callCount === 1) {
      // isPRDraft call
      return Promise.resolve(mockResult(JSON.stringify({ isDraft: true })));
    }
    // markPRReady or merge call
    return Promise.resolve(mockResult(""));
  });

  try {
    await mergePR("draft-branch");
    assertEquals(callCount, 3); // isPRDraft + markPRReady + merge
  } finally {
    resetCommandRunner();
  }
});

Deno.test("mergePR - uses squash merge strategy", async () => {
  let mergeArgs: string[] = [];
  let callCount = 0;
  setCommandRunner((_cmd, args) => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(mockResult(JSON.stringify({ isDraft: false })));
    }
    mergeArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await mergePR("branch");
    assertEquals(mergeArgs.includes("--squash"), true);
    assertEquals(mergeArgs.includes("merge"), true);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("updatePRBase - updates PR base branch", async () => {
  let capturedArgs: string[] = [];
  setCommandRunner((_cmd, args) => {
    capturedArgs = args;
    return Promise.resolve(mockResult(""));
  });

  try {
    await updatePRBase("feature-branch", "develop");

    assertEquals(capturedArgs.includes("pr"), true);
    assertEquals(capturedArgs.includes("edit"), true);
    assertEquals(capturedArgs.includes("feature-branch"), true);
    assertEquals(capturedArgs.includes("--base"), true);
    assertEquals(capturedArgs.includes("develop"), true);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getPRState - returns OPEN state", async () => {
  setCommandRunner(() => Promise.resolve(mockResult(JSON.stringify({ state: "OPEN" }))));

  try {
    const result = await getPRState("open-branch");
    assertEquals(result, "OPEN");
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getPRState - returns MERGED state", async () => {
  setCommandRunner(() => Promise.resolve(mockResult(JSON.stringify({ state: "MERGED" }))));

  try {
    const result = await getPRState("merged-branch");
    assertEquals(result, "MERGED");
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getPRState - returns null when command fails", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("", "Error", 1)));

  try {
    const result = await getPRState("nonexistent-branch");
    assertEquals(result, null);
  } finally {
    resetCommandRunner();
  }
});

Deno.test("getPRState - returns null when JSON parsing fails", async () => {
  setCommandRunner(() => Promise.resolve(mockResult("invalid json")));

  try {
    const result = await getPRState("branch");
    assertEquals(result, null);
  } finally {
    resetCommandRunner();
  }
});
