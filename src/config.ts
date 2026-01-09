import { parse, stringify } from "smol-toml";
import { join } from "@std/path";
import { type Config, defaultConfig } from "./types.ts";

async function getGitRoot(): Promise<string> {
  const command = new Deno.Command("git", {
    args: ["rev-parse", "--show-toplevel"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout } = await command.output();
  if (code !== 0) {
    throw new Error("Not in a git repo");
  }
  return new TextDecoder().decode(stdout).trim();
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
  const parsed = parse(content) as Partial<Config>;

  return {
    ...defaultConfig,
    ...parsed,
  };
}
