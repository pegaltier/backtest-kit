import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import ExecutionContextService, {
  TExecutionContextService,
} from "../context/ExecutionContextService";
import { CandleInterval, ICandle } from "../../../interfaces/Candle.interface";
import { memoize } from "functools-kit";
import ClientStrategy from "../../../client/ClientStrategy";
import CandleSchemaService from "../schema/CandleSchemaService";
import {
  IStrategy,
  IStrategyTickResult,
} from "../../../interfaces/Strategy.interface";
import StrategyConnectionService from "../connection/StrategyConnectionService";

export class StrategyPublicService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly strategyConnectionService =
    inject<StrategyConnectionService>(TYPES.strategyConnectionService);

  public tick = async (
    symbol: string,
    when: Date,
    backtest: boolean,
  ): Promise<IStrategyTickResult> => {
    this.loggerService.log("strategyPublicService tick", {
      symbol,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.strategyConnectionService.tick(symbol);
      },
      {
        when,
        backtest,
      }
    );
  };
}

export default StrategyPublicService;
