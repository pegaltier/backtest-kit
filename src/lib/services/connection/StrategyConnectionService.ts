import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import { TExecutionContextService } from "../context/ExecutionContextService";
import { CandleInterval, IExchange } from "../../../interfaces/Exchange.interface";
import { memoize } from "functools-kit";
import ClientStrategy from "../../../client/ClientStrategy";
import ExchangeSchemaService from "../schema/ExchangeSchemaService";
import {
  IStrategy,
  IStrategyTickResult,
} from "../../../interfaces/Strategy.interface";
import StrategySchemaService from "../schema/StrategySchemaService";
import ExchangeConnectionService from "./ExchangeConnectionService";

export class StrategyConnectionService implements IStrategy {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly executionContextService = inject<TExecutionContextService>(
    TYPES.executionContextService
  );
  private readonly strategySchemaService = inject<StrategySchemaService>(
    TYPES.strategySchemaService
  );
  private readonly exchangeConnectionService = inject<ExchangeConnectionService>(
    TYPES.exchangeConnectionService
  );

  private getStrategy = memoize<(symbol: string) => ClientStrategy>(
    (symbol) => `${symbol}`,
    (symbol: string) => {
      const { getSignal, callbacks } = this.strategySchemaService.getSchema();
      return new ClientStrategy({
        symbol,
        execution: this.executionContextService,
        logger: this.loggerService,
        exchange: this.exchangeConnectionService,
        getSignal,
        callbacks,
      });
    }
  );

  public tick = async (symbol: string): Promise<IStrategyTickResult> => {
    this.loggerService.log("strategyConnectionService tick", {
      symbol,
    });
    return await this.getStrategy(symbol).tick(symbol);
  };
}

export default StrategyConnectionService;
