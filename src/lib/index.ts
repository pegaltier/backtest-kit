import "./core/provide";
import { inject, init } from "./core/di";
import TYPES from "./core/types";
import LoggerService from "./services/base/LoggerService";
import ExchangeConnectionService from "./services/connection/ExchangeConnectionService";
import StrategyConnectionService from "./services/connection/StrategyConnectionService";
import FrameConnectionService from "./services/connection/FrameConnectionService";
import ExecutionContextService, {
  TExecutionContextService,
} from "./services/context/ExecutionContextService";
import MethodContextService, {
  TMethodContextService,
} from "./services/context/MethodContextService";
import ExchangeGlobalService from "./services/global/ExchangeGlobalService";
import StrategyGlobalService from "./services/global/StrategyGlobalService";
import FrameGlobalService from "./services/global/FrameGlobalService";
import ExchangeSchemaService from "./services/schema/ExchangeSchemaService";
import StrategySchemaService from "./services/schema/StrategySchemaService";
import FrameSchemaService from "./services/schema/FrameSchemaService";
import BacktestLogicService from "./services/logic/BacktestLogicService";
import LiveLogicService from "./services/logic/LiveLogicService";

const baseServices = {
  loggerService: inject<LoggerService>(TYPES.loggerService),
};

const contextServices = {
  executionContextService: inject<TExecutionContextService>(
    TYPES.executionContextService
  ),
  methodContextService: inject<TMethodContextService>(
    TYPES.methodContextService
  ),
};

const connectionServices = {
  exchangeConnectionService: inject<ExchangeConnectionService>(
    TYPES.exchangeConnectionService
  ),
  strategyConnectionService: inject<StrategyConnectionService>(
    TYPES.strategyConnectionService
  ),
  frameConnectionService: inject<FrameConnectionService>(
    TYPES.frameConnectionService
  ),
};

const schemaServices = {
  exchangeSchemaService: inject<ExchangeSchemaService>(
    TYPES.exchangeSchemaService
  ),
  strategySchemaService: inject<StrategySchemaService>(
    TYPES.strategySchemaService
  ),
  frameSchemaService: inject<FrameSchemaService>(
    TYPES.frameSchemaService
  ),
};

const globalServices = {
  exchangeGlobalService: inject<ExchangeGlobalService>(
    TYPES.exchangeGlobalService
  ),
  strategyGlobalService: inject<StrategyGlobalService>(
    TYPES.strategyGlobalService
  ),
  frameGlobalService: inject<FrameGlobalService>(
    TYPES.frameGlobalService
  ),
};

const logicServices = {
  backtestLogicService: inject<BacktestLogicService>(
    TYPES.backtestLogicService
  ),
  liveLogicService: inject<LiveLogicService>(TYPES.liveLogicService),
};

export const backtest = {
  ...baseServices,
  ...contextServices,
  ...connectionServices,
  ...schemaServices,
  ...globalServices,
  ...logicServices,
};

init();

export { ExecutionContextService };
export { MethodContextService };

export default backtest;
