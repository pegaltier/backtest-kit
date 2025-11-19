import "./core/provide";
import { inject, init } from "./core/di";
import TYPES from "./core/types";
import LoggerService from "./services/base/LoggerService";
import CandleConnectionService from "./services/connection/CandleConnectionService";
import ExecutionContextService, {
  TExecutionContextService,
} from "./services/context/ExecutionContextService";
import CandleSchemaService from "./services/schema/CandleSchemaService";
import StrategySchemaService from "./services/schema/StrategySchemaService";
import StrategyConnectionService from "./services/connection/StrategyConnectionService";
import CandlePublicService from "./services/public/CandlePublicService";
import StrategyPublicService from "./services/public/StrategyPublicService";

const baseServices = {
  loggerService: inject<LoggerService>(TYPES.loggerService),
};

const contextServices = {
  executionContextService: inject<TExecutionContextService>(
    TYPES.executionContextService
  ),
};

const connectionServices = {
  candleConnectionService: inject<CandleConnectionService>(
    TYPES.candleConnectionService
  ),
  strategyConnectionService: inject<StrategyConnectionService>(
    TYPES.strategyConnectionService
  ),
};

const schemaServices = {
  candleSchemaService: inject<CandleSchemaService>(TYPES.candleSchemaService),
  strategySchemaService: inject<StrategySchemaService>(
    TYPES.strategySchemaService
  ),
};

const publicServices = {
  candlePublicService: inject<CandlePublicService>(TYPES.candlePublicService),
  strategyPublicService: inject<StrategyPublicService>(
    TYPES.strategyPublicService
  ),
};

export const backtest = {
  ...baseServices,
  ...contextServices,
  ...connectionServices,
  ...schemaServices,
  ...publicServices,
};

init();

export { ExecutionContextService };

export default backtest;
