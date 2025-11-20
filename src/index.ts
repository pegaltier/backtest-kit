export { addCandle, addStrategy } from "./function/add";
export { runBacktest, runBacktestGUI } from "./function/backtest";
export { reduce } from "./function/reduce";
export { startRun, stopRun, stopAll } from "./function/run";
export { getCandles, getAveragePrice } from "./function/candle";

export {
  CandleInterval,
  ICandleData,
  ICandleSchema,
} from "./interfaces/Candle.interface";

export {
  ISignalData,
  IStrategySchema,
  IStrategyTickResult,
  IStrategyTickResultActive,
  IStrategyTickResultClosed,
  IStrategyTickResultIdle,
  IStrategyTickResultOpened,
  IStrategyPnL
} from "./interfaces/Strategy.interface";

export { ExecutionContextService } from "./lib/services/context/ExecutionContextService";

export { backtest } from "./lib";
