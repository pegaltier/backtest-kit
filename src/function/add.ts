import backtest from "../lib/index";
import { IStrategySchema } from "../interfaces/Strategy.interface";
import { IExchangeSchema } from "../interfaces/Exchange.interface";
import { IFrameSchema } from "../interfaces/Frame.interface";

const ADD_STRATEGY_METHOD_NAME = "add.addStrategy";
const ADD_EXCHANGE_METHOD_NAME = "add.addExchange";
const ADD_FRAME_METHOD_NAME = "add.addFrame";

export function addStrategy(strategySchema: IStrategySchema) {
  backtest.loggerService.info(ADD_STRATEGY_METHOD_NAME, {
    strategySchema,
  });
  backtest.strategySchemaService.register(
    strategySchema.strategyName,
    strategySchema
  );
}

export function addExchange(exchangeSchema: IExchangeSchema) {
  backtest.loggerService.info(ADD_EXCHANGE_METHOD_NAME, {
    exchangeSchema,
  });
  backtest.exchangeSchemaService.register(
    exchangeSchema.exchangeName,
    exchangeSchema
  );
}

export function addFrame(frameSchema: IFrameSchema) {
  backtest.loggerService.info(ADD_FRAME_METHOD_NAME, {
    frameSchema,
  });
  backtest.frameSchemaService.register(frameSchema.frameName, frameSchema);
}
