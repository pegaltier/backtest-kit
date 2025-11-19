import backtest from "../lib/index";
import { IStrategySchema } from "../interfaces/Strategy.interface";
import { ICandleSchema } from "../interfaces/Candle.interface";

export function addStrategy(strategySchema: IStrategySchema) {
  backtest.strategySchemaService.addSchema(strategySchema);
};

export function addCandle(candleSchema: ICandleSchema) {
  backtest.candleSchemaService.addSchema(candleSchema);
};

