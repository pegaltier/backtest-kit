import { OptimizerName } from "../interfaces/Optimizer.interface";
import backtest from "../lib";

const OPTIMIZER_METHOD_NAME_GET_DATA = "OptimizerUtils.getData";
const OPTIMIZER_METHOD_NAME_GET_CODE = "OptimizerUtils.getCode";
const OPTIMIZER_METHOD_NAME_DUMP = "OptimizerUtils.dump";

export class OptimizerUtils {
  public getData = async (
    symbol: string,
    context: {
      optimizerName: OptimizerName;
    }
  ) => {
    backtest.loggerService.info(OPTIMIZER_METHOD_NAME_GET_DATA, {
      symbol,
      context,
    });
    return await backtest.optimizerGlobalService.getData(
      symbol,
      context.optimizerName
    );
  };

  public getCode = async (
    symbol: string,
    context: {
      optimizerName: OptimizerName;
    }
  ): Promise<string> => {
    backtest.loggerService.info(OPTIMIZER_METHOD_NAME_GET_CODE, {
      symbol,
      context,
    });
    return await backtest.optimizerGlobalService.getCode(
      symbol,
      context.optimizerName
    );
  };

  public dump = async (
    symbol: string,
    context: {
      optimizerName: string;
    },
    path?: string
  ): Promise<void> => {
    backtest.loggerService.info(OPTIMIZER_METHOD_NAME_DUMP, {
      symbol,
      context,
      path,
    });
    await backtest.optimizerGlobalService.dump(
      symbol,
      context.optimizerName,
      path
    );
  };
}

export const Optimizer = new OptimizerUtils();
