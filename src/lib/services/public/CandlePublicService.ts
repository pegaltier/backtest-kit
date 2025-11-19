import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import ExecutionContextService from "../context/ExecutionContextService";
import { CandleInterval } from "../../../interfaces/Candle.interface";
import CandleConnectionService from "../connection/CandleConnectionService";

export class CandlePublicService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly candleConnectionService = inject<CandleConnectionService>(
    TYPES.candleConnectionService
  );

  public getCandles = async (
    symbol: string,
    interval: CandleInterval,
    limit: number,
    when: Date,
    backtest: boolean
  ) => {
    this.loggerService.log("candlePublicService getCandles", {
      symbol,
      interval,
      limit,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.candleConnectionService.getCandles(
          symbol,
          interval,
          limit
        );
      },
      {
        when,
        backtest,
      }
    );
  };

  public getAveragePrice = async (
    symbol: string,
    when: Date,
    backtest: boolean
  ) => {
    this.loggerService.log("candlePublicService getAveragePrice", {
      symbol,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.candleConnectionService.getAveragePrice(symbol);
      },
      {
        when,
        backtest,
      }
    );
  };
}

export default CandlePublicService;
