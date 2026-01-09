export interface Config {
  mainBranch: string;
  branchPrefix: string;
  draft: boolean;
}

export const defaultConfig: Config = {
  mainBranch: "main",
  branchPrefix: "username/pr-",
  draft: true,
};
