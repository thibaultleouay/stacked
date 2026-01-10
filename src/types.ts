import { z } from "zod";

export const ConfigSchema = z.object({
  mainBranch: z.string().min(1, "mainBranch cannot be empty"),
  draft: z.boolean(),
});

export type Config = z.infer<typeof ConfigSchema>;

export const defaultConfig: Config = {
  mainBranch: "main",
  draft: true,
};
