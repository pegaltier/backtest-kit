import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import BacktestLogicPublicService from "../logic/public/BacktestLogicPublicService";

export class BacktestGlobalService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly backtestLogicPublicService =
    inject<BacktestLogicPublicService>(TYPES.backtestLogicPublicService);

  public run = (
    symbol: string,
    context: {
      strategyName: string;
      exchangeName: string;
      frameName: string;
    }
  ) => {
    this.loggerService.log("backtestGlobalService run", {
      symbol,
      context,
    });
    return this.backtestLogicPublicService.run(symbol, context);
  };
}

export default BacktestGlobalService;
