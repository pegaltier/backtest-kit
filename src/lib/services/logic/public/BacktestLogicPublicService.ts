import { inject } from "../../../core/di";
import LoggerService from "../../base/LoggerService";
import TYPES from "../../../core/types";
import BacktestLogicPrivateService from "../private/BacktestLogicPrivateService";
import MethodContextService from "../../context/MethodContextService";

export class BacktestLogicPublicService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly backtestLogicPrivateService =
    inject<BacktestLogicPrivateService>(TYPES.backtestLogicPrivateService);

  public run = async (
    symbol: string,
    context: {
      strategyName: string;
      exchangeName: string;
      frameName: string;
    }
  ) => {
    this.loggerService.log("backtestLogicPublicService run", {
      symbol,
      context,
    });
    return await MethodContextService.runInContext(
      async () => {
        return await this.backtestLogicPrivateService.run(symbol);
      },
      {
        exchangeName: context.exchangeName,
        strategyName: context.strategyName,
        frameName: context.frameName,
      }
    );
  };
}

export default BacktestLogicPublicService;
