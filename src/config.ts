import { parse, stringify } from "smol-toml";
import { join } from "@std/path";
import { type Config, ConfigSchema, defaultConfig } from "./types.ts";
import { runCommand } from "./utils.ts";

async function getGitRoot(): Promise<string> {
  const result = await runCommand("git", ["rev-parse", "--show-toplevel"], {
    errorPrefix: "Not in a git repository",
  });
  return result.stdout;
}

export async function loadConfig(): Promise<Config> {
  const gitRoot = await getGitRoot();
  const configPath = join(gitRoot, ".stacked.toml");

  let exists = false;
  try {
    const stat = await Deno.stat(configPath);
    exists = stat.isFile;
  } catch {
    exists = false;
  }

  if (!exists) {
    const tomlContent = stringify(defaultConfig);
    await Deno.writeTextFile(configPath, tomlContent);
    console.log(`Initialized default config at ${configPath}, please re-run the command`);
    Deno.exit(0);
  }

  const content = await Deno.readTextFile(configPath);
  const parsed = parse(content);

  const result = ConfigSchema.safeParse({
    ...defaultConfig,
    ...parsed,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid config in ${configPath}:\n${errors}`);
  }

  return result.data;
}
