import backtest from "../lib/index";
import { IStrategySchema } from "../interfaces/Strategy.interface";
import { IExchangeSchema } from "../interfaces/Exchange.interface";

export function addStrategy(strategySchema: IStrategySchema) {
  backtest.strategySchemaService.addSchema(strategySchema);
};

export function addExchange(exchangeSchema: IExchangeSchema) {
  backtest.exchangeSchemaService.addSchema(exchangeSchema);
};

