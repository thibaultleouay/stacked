import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

await configure({
  sinks: {
    console: getConsoleSink(),
  },
  loggers: [
    { category: ["stacked"], sinks: ["console"], lowestLevel: "info" },
  ],
});

export const logger = getLogger(["stacked"]);
