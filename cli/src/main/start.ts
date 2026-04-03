import { getArgs } from "../helpers/getArgs";
import getEntry from "../helpers/getEntry";

declare const __PACKAGE_VERSION__: string;

const MODES = ["backtest", "paper", "live", "pine", "dump", "init", "help", "version"] as const;

export const main = async () => {
  if (!getEntry(import.meta.url)) {
    return;
  }

  const { values } = getArgs();

  if (MODES.some((mode) => values[mode])) {
    return;
  }

  process.stdout.write(`@backtest-kit/cli ${__PACKAGE_VERSION__}\n`);
  process.stdout.write(`Run with --help to see available commands.\n`);
  process.exit(0);
};

main();
