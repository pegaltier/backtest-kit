export { setLogger } from "./function/setup";
export { addExchange, addStrategy, addFrame } from "./function/add";
export { listExchanges, listStrategies, listFrames } from "./function/list";
export {
  listenSignal,
  listenSignalOnce,
  listenSignalBacktest,
  listenSignalBacktestOnce,
  listenSignalLive,
  listenSignalLiveOnce,
  listenError,
  listenDone,
  listenDoneOnce,
  listenProgress,
} from "./function/event";
export {
  getCandles,
  getAveragePrice,
  getDate,
  getMode,
  formatPrice,
  formatQuantity,
} from "./function/exchange";

export {
  CandleInterval,
  ICandleData,
  IExchangeSchema,
} from "./interfaces/Exchange.interface";

export {
  SignalInterval,
  ISignalDto,
  ISignalRow,
  IStrategySchema,
  IStrategyTickResult,
  IStrategyTickResultActive,
  IStrategyTickResultClosed,
  IStrategyTickResultIdle,
  IStrategyTickResultOpened,
  IStrategyPnL,
} from "./interfaces/Strategy.interface";

export { FrameInterval, IFrameSchema } from "./interfaces/Frame.interface";

export { DoneContract } from "./contract/Done.contract";
export { ProgressContract } from "./contract/Progress.contract";

export type { BacktestStatistics } from "./lib/services/markdown/BacktestMarkdownService";
export type { LiveStatistics } from "./lib/services/markdown/LiveMarkdownService";

export { ExecutionContextService } from "./lib/services/context/ExecutionContextService";
export { MethodContextService } from "./lib/services/context/MethodContextService";

export {
  ISignalData,
  EntityId,
  PersistBase,
  TPersistBase,
  IPersistBase,
  TPersistBaseCtor,
  PersistSignalAdaper,
} from "./classes/Persist";

export { Backtest } from "./classes/Backtest";
export { Live } from "./classes/Live";

export { backtest as lib } from "./lib";
