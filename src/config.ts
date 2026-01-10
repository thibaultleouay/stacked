import { parse, stringify } from "smol-toml";
import { join } from "@std/path";
import { logger } from "./logger.ts";
import { type Config, ConfigSchema, defaultConfig } from "./types.ts";
import { runCommand } from "./utils.ts";

async function getJJRoot(): Promise<string> {
  const result = await runCommand("jj", ["workspace", "root"], {
    errorPrefix: "Not in a jj repository",
  });
  return result.stdout;
}

export async function loadConfig(): Promise<Config> {
  const jjRoot = await getJJRoot();
  const configPath = join(jjRoot, ".stacked.toml");

  let content: string;
  try {
    content = await Deno.readTextFile(configPath);
  } catch {
    const tomlContent = stringify(defaultConfig);
    await Deno.writeTextFile(configPath, tomlContent);
    logger.info("Initialized default config at {configPath}, please re-run the command", { configPath });
    Deno.exit(0);
  }

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
