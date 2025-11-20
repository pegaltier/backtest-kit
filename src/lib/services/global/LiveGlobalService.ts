import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import LiveLogicPublicService from "../logic/public/LiveLogicPublicService";

export class LiveGlobalService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly liveLogicPublicService = inject<LiveLogicPublicService>(
    TYPES.liveLogicPublicService
  );

  public run = (
    symbol: string,
    context: {
      strategyName: string;
      exchangeName: string;
    }
  ) => {
    this.loggerService.log("liveGlobalService run", {
      symbol,
      context,
    });
    return this.liveLogicPublicService.run(symbol, context);
  };
}

export default LiveGlobalService;
