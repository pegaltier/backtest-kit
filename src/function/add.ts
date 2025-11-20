import backtest from "../lib/index";
import { IStrategySchema } from "../interfaces/Strategy.interface";
import { IExchangeSchema } from "../interfaces/Exchange.interface";
import { IFrameSchema } from "../interfaces/Frame.interface";

export function addStrategy(strategySchema: IStrategySchema) {
  backtest.strategySchemaService.register(
    strategySchema.strategyName,
    strategySchema
  );
}

export function addExchange(exchangeSchema: IExchangeSchema) {
  backtest.exchangeSchemaService.register(
    exchangeSchema.exchangeName,
    exchangeSchema
  );
}

export function addFrame(frameSchema: IFrameSchema) {
  backtest.frameSchemaService.register(
    frameSchema.frameName,
    frameSchema
  );
}

