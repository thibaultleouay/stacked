import { z } from "zod";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function decode(data: Uint8Array, trim = false): string {
  const text = decoder.decode(data);
  return trim ? text.trim() : text;
}

export function encode(text: string): Uint8Array {
  return encoder.encode(text);
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  throwOnError?: boolean;
  errorPrefix?: string;
}

export async function runCommand(
  cmd: string,
  args: string[],
  options: RunOptions = {},
): Promise<CommandResult> {
  const { throwOnError = true, errorPrefix } = options;

  const command = new Deno.Command(cmd, {
    args,
    stdout: "piped",
    stderr: "piped",
  });

  const output = await command.output();
  const result: CommandResult = {
    code: output.code,
    stdout: decode(output.stdout, true),
    stderr: decode(output.stderr),
  };

  if (throwOnError && result.code !== 0) {
    const prefix = errorPrefix ?? `Command failed: ${cmd} ${args.join(" ")}`;
    throw new Error(`${prefix}\n${result.stderr}`);
  }

  return result;
}

export async function runCommandInteractive(
  cmd: string,
  args: string[],
): Promise<void> {
  const command = new Deno.Command(cmd, {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });
  await command.output();
}

export function parseJson<T extends z.ZodType>(
  json: string,
  schema: T,
): z.infer<T> | undefined {
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);
    if (!result.success) {
      return undefined;
    }
    return result.data;
  } catch {
    return undefined;
  }
}

export const PRListItemSchema = z.array(
  z.object({
    number: z.number(),
  }),
);

export type PRListItem = z.infer<typeof PRListItemSchema>[number];

export const PRViewSchema = z.object({
  isDraft: z.boolean(),
});

export type PRView = z.infer<typeof PRViewSchema>;

export const PRStateSchema = z.object({
  state: z.string(),
});

export type PRState = z.infer<typeof PRStateSchema>;
