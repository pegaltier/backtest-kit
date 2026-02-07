import { CandleInterval } from "backtest-kit";
import lib from "../lib";
import { Code } from "../classes/Code";
import { File } from "../classes/File";
import { PlotModel } from "../model/Plot.model";
import ContextService, {
  ExchangeName,
} from "../lib/services/base/ContextService";

const METHOD_NAME_RUN = "run.run";

const GET_SOURCE_FN = async (source: File | Code) => {
  if (File.isFile(source)) {
    const code = await lib.pineCacheService.readFile(
      source.path,
      source.baseDir,
    );
    return Code.fromString(code);
  }
  if (Code.isCode(source)) {
    return source;
  }
  throw new Error("Source must be a File or Code instance");
};

const RUN_INFERENCE_FN = async (
  script: Code,
  symbol: string,
  timeframe: CandleInterval,
  limit: number,
  exchangeName?: ExchangeName,
) => {
  if (exchangeName) {
    return await ContextService.runInContext(
      async () =>
        await lib.pineJobService.run(script, symbol, timeframe, limit),
      { exchangeName },
    );
  }
  return await lib.pineJobService.run(script, symbol, timeframe, limit);
};

interface IRunParams {
  symbol: string;
  timeframe: CandleInterval;
  limit: number;
}

export async function run(
  source: File | Code,
  { symbol, timeframe, limit }: IRunParams,
  exchangeName?: ExchangeName,
): Promise<PlotModel> {
  lib.loggerService.info(METHOD_NAME_RUN, {
    source,
    symbol,
    timeframe,
    limit,
  });
  const script = await GET_SOURCE_FN(source);
  const { plots } = await RUN_INFERENCE_FN(
    script,
    symbol,
    timeframe,
    limit,
    exchangeName,
  );
  return plots;
}
