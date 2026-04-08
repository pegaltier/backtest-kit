import "./core/provide";
import { inject, init } from "./core/di";
import TYPES from "./core/types";
import { TLoggerService } from "./services/base/LoggerService";
import ExchangeConnectionService from "./services/connection/ExchangeConnectionService";
import StrategyConnectionService from "./services/connection/StrategyConnectionService";
import FrameConnectionService from "./services/connection/FrameConnectionService";
import SizingConnectionService from "./services/connection/SizingConnectionService";
import RiskConnectionService from "./services/connection/RiskConnectionService";
import ActionConnectionService from "./services/connection/ActionConnectionService";
import ExecutionContextService, {
  TExecutionContextService,
} from "./services/context/ExecutionContextService";
import MethodContextService, {
  TMethodContextService,
} from "./services/context/MethodContextService";
import ExchangeCoreService from "./services/core/ExchangeCoreService";
import StrategyCoreService from "./services/core/StrategyCoreService";
import FrameCoreService from "./services/core/FrameCoreService";
import SizingGlobalService from "./services/global/SizingGlobalService";
import RiskGlobalService from "./services/global/RiskGlobalService";
import ActionCoreService from "./services/core/ActionCoreService";
import WalkerCommandService from "./services/command/WalkerCommandService";
import ExchangeSchemaService from "./services/schema/ExchangeSchemaService";
import StrategySchemaService from "./services/schema/StrategySchemaService";
import FrameSchemaService from "./services/schema/FrameSchemaService";
import SizingSchemaService from "./services/schema/SizingSchemaService";
import RiskSchemaService from "./services/schema/RiskSchemaService";
import ActionSchemaService from "./services/schema/ActionSchemaService";
import WalkerSchemaService from "./services/schema/WalkerSchemaService";
import BacktestLogicPrivateService from "./services/logic/private/BacktestLogicPrivateService";
import LiveLogicPrivateService from "./services/logic/private/LiveLogicPrivateService";
import WalkerLogicPrivateService from "./services/logic/private/WalkerLogicPrivateService";
import BacktestLogicPublicService from "./services/logic/public/BacktestLogicPublicService";
import LiveLogicPublicService from "./services/logic/public/LiveLogicPublicService";
import WalkerLogicPublicService from "./services/logic/public/WalkerLogicPublicService";
import LiveCommandService from "./services/command/LiveCommandService";
import BacktestCommandService from "./services/command/BacktestCommandService";
import { TBacktestMarkdownService } from "./services/markdown/BacktestMarkdownService";
import { TLiveMarkdownService } from "./services/markdown/LiveMarkdownService";
import { TScheduleMarkdownService } from "./services/markdown/ScheduleMarkdownService";
import { TPerformanceMarkdownService } from "./services/markdown/PerformanceMarkdownService";
import { TWalkerMarkdownService } from "./services/markdown/WalkerMarkdownService";
import { THeatMarkdownService } from "./services/markdown/HeatMarkdownService";
import ExchangeValidationService from "./services/validation/ExchangeValidationService";
import StrategyValidationService from "./services/validation/StrategyValidationService";
import FrameValidationService from "./services/validation/FrameValidationService";
import WalkerValidationService from "./services/validation/WalkerValidationService";
import SizingValidationService from "./services/validation/SizingValidationService";
import RiskValidationService from "./services/validation/RiskValidationService";
import ActionValidationService from "./services/validation/ActionValidationService";
import PartialConnectionService from "./services/connection/PartialConnectionService";
import { TPartialMarkdownService } from "./services/markdown/PartialMarkdownService";
import PartialGlobalService from "./services/global/PartialGlobalService";
import BreakevenConnectionService from "./services/connection/BreakevenConnectionService";
import { TBreakevenMarkdownService } from "./services/markdown/BreakevenMarkdownService";
import BreakevenGlobalService from "./services/global/BreakevenGlobalService";
import ConfigValidationService from "./services/validation/ConfigValidationService";
import { TRiskMarkdownService } from "./services/markdown/RiskMarkdownService";
import ColumnValidationService from "./services/validation/ColumnValidationService";
import { TBacktestReportService } from "./services/report/BacktestReportService";
import { TLiveReportService } from "./services/report/LiveReportService";
import { TScheduleReportService } from "./services/report/ScheduleReportService";
import { TPerformanceReportService } from "./services/report/PerformanceReportService";
import { TWalkerReportService } from "./services/report/WalkerReportService";
import { THeatReportService } from "./services/report/HeatReportService";
import { TPartialReportService } from "./services/report/PartialReportService";
import { TBreakevenReportService } from "./services/report/BreakevenReportService";
import { TRiskReportService } from "./services/report/RiskReportService";
import { TStrategyReportService } from "./services/report/StrategyReportService";
import { TSyncReportService } from "./services/report/SyncReportService";
import { THighestProfitReportService } from "./services/report/HighestProfitReportService";
import { TMaxDrawdownReportService } from "./services/report/MaxDrawdownReportService";
import { TStrategyMarkdownService } from "./services/markdown/StrategyMarkdownService";
import {
  TSyncMarkdownService,
} from "./services/markdown/SyncMarkdownService";
import { THighestProfitMarkdownService } from "./services/markdown/HighestProfitMarkdownService";
import { TMaxDrawdownMarkdownService } from "./services/markdown/MaxDrawdownMarkdownService";
import TimeMetaService from "./services/meta/TimeMetaService";
import PriceMetaService from "./services/meta/PriceMetaService";
import { TContextMetaService } from "./services/meta/ContextMetaService";

const baseServices = {
  loggerService: inject<TLoggerService>(TYPES.loggerService),
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
  sizingConnectionService: inject<SizingConnectionService>(
    TYPES.sizingConnectionService
  ),
  riskConnectionService: inject<RiskConnectionService>(
    TYPES.riskConnectionService
  ),
  actionConnectionService: inject<ActionConnectionService>(
    TYPES.actionConnectionService
  ),
  partialConnectionService: inject<PartialConnectionService>(
    TYPES.partialConnectionService
  ),
  breakevenConnectionService: inject<BreakevenConnectionService>(
    TYPES.breakevenConnectionService
  ),
};

const schemaServices = {
  exchangeSchemaService: inject<ExchangeSchemaService>(
    TYPES.exchangeSchemaService
  ),
  strategySchemaService: inject<StrategySchemaService>(
    TYPES.strategySchemaService
  ),
  frameSchemaService: inject<FrameSchemaService>(TYPES.frameSchemaService),
  walkerSchemaService: inject<WalkerSchemaService>(TYPES.walkerSchemaService),
  sizingSchemaService: inject<SizingSchemaService>(TYPES.sizingSchemaService),
  riskSchemaService: inject<RiskSchemaService>(TYPES.riskSchemaService),
  actionSchemaService: inject<ActionSchemaService>(TYPES.actionSchemaService),
};

const coreServices = {
  exchangeCoreService: inject<ExchangeCoreService>(TYPES.exchangeCoreService),
  strategyCoreService: inject<StrategyCoreService>(TYPES.strategyCoreService),
  actionCoreService: inject<ActionCoreService>(TYPES.actionCoreService),
  frameCoreService: inject<FrameCoreService>(TYPES.frameCoreService),
};

const metaServices = {
  timeMetaService: inject<TimeMetaService>(TYPES.timeMetaService),
  priceMetaService: inject<PriceMetaService>(TYPES.priceMetaService),
  contextMetaService: inject<TContextMetaService>(TYPES.contextMetaService),
}

const globalServices = {
  sizingGlobalService: inject<SizingGlobalService>(TYPES.sizingGlobalService),
  riskGlobalService: inject<RiskGlobalService>(TYPES.riskGlobalService),
  partialGlobalService: inject<PartialGlobalService>(
    TYPES.partialGlobalService
  ),
  breakevenGlobalService: inject<BreakevenGlobalService>(
    TYPES.breakevenGlobalService
  ),
};

const commandServices = {
  liveCommandService: inject<LiveCommandService>(TYPES.liveCommandService),
  backtestCommandService: inject<BacktestCommandService>(
    TYPES.backtestCommandService
  ),
  walkerCommandService: inject<WalkerCommandService>(
    TYPES.walkerCommandService
  ),
};

const logicPrivateServices = {
  backtestLogicPrivateService: inject<BacktestLogicPrivateService>(
    TYPES.backtestLogicPrivateService
  ),
  liveLogicPrivateService: inject<LiveLogicPrivateService>(
    TYPES.liveLogicPrivateService
  ),
  walkerLogicPrivateService: inject<WalkerLogicPrivateService>(
    TYPES.walkerLogicPrivateService
  ),
};

const logicPublicServices = {
  backtestLogicPublicService: inject<BacktestLogicPublicService>(
    TYPES.backtestLogicPublicService
  ),
  liveLogicPublicService: inject<LiveLogicPublicService>(
    TYPES.liveLogicPublicService
  ),
  walkerLogicPublicService: inject<WalkerLogicPublicService>(
    TYPES.walkerLogicPublicService
  ),
};

const markdownServices = {
  backtestMarkdownService: inject<TBacktestMarkdownService>(
    TYPES.backtestMarkdownService
  ),
  liveMarkdownService: inject<TLiveMarkdownService>(TYPES.liveMarkdownService),
  scheduleMarkdownService: inject<TScheduleMarkdownService>(
    TYPES.scheduleMarkdownService
  ),
  performanceMarkdownService: inject<TPerformanceMarkdownService>(
    TYPES.performanceMarkdownService
  ),
  walkerMarkdownService: inject<TWalkerMarkdownService>(
    TYPES.walkerMarkdownService
  ),
  heatMarkdownService: inject<THeatMarkdownService>(TYPES.heatMarkdownService),
  partialMarkdownService: inject<TPartialMarkdownService>(
    TYPES.partialMarkdownService
  ),
  breakevenMarkdownService: inject<TBreakevenMarkdownService>(
    TYPES.breakevenMarkdownService
  ),
  riskMarkdownService: inject<TRiskMarkdownService>(TYPES.riskMarkdownService),
  strategyMarkdownService: inject<TStrategyMarkdownService>(TYPES.strategyMarkdownService),
  syncMarkdownService: inject<TSyncMarkdownService>(TYPES.syncMarkdownService),
  highestProfitMarkdownService: inject<THighestProfitMarkdownService>(TYPES.highestProfitMarkdownService),
  maxDrawdownMarkdownService: inject<TMaxDrawdownMarkdownService>(TYPES.maxDrawdownMarkdownService),
};

const reportServices = {
  backtestReportService: inject<TBacktestReportService>(
    TYPES.backtestReportService
  ),
  liveReportService: inject<TLiveReportService>(TYPES.liveReportService),
  scheduleReportService: inject<TScheduleReportService>(
    TYPES.scheduleReportService
  ),
  performanceReportService: inject<TPerformanceReportService>(
    TYPES.performanceReportService
  ),
  walkerReportService: inject<TWalkerReportService>(
    TYPES.walkerReportService
  ),
  heatReportService: inject<THeatReportService>(TYPES.heatReportService),
  partialReportService: inject<TPartialReportService>(
    TYPES.partialReportService
  ),
  breakevenReportService: inject<TBreakevenReportService>(
    TYPES.breakevenReportService
  ),
  riskReportService: inject<TRiskReportService>(TYPES.riskReportService),
  strategyReportService: inject<TStrategyReportService>(TYPES.strategyReportService),
  syncReportService: inject<TSyncReportService>(TYPES.syncReportService),
  highestProfitReportService: inject<THighestProfitReportService>(TYPES.highestProfitReportService),
  maxDrawdownReportService: inject<TMaxDrawdownReportService>(TYPES.maxDrawdownReportService),
};

const validationServices = {
  exchangeValidationService: inject<ExchangeValidationService>(
    TYPES.exchangeValidationService
  ),
  strategyValidationService: inject<StrategyValidationService>(
    TYPES.strategyValidationService
  ),
  frameValidationService: inject<FrameValidationService>(
    TYPES.frameValidationService
  ),
  walkerValidationService: inject<WalkerValidationService>(
    TYPES.walkerValidationService
  ),
  sizingValidationService: inject<SizingValidationService>(
    TYPES.sizingValidationService
  ),
  riskValidationService: inject<RiskValidationService>(
    TYPES.riskValidationService
  ),
  actionValidationService: inject<ActionValidationService>(
    TYPES.actionValidationService
  ),
  configValidationService: inject<ConfigValidationService>(
    TYPES.configValidationService
  ),
  columnValidationService: inject<ColumnValidationService>(
    TYPES.columnValidationService
  ),
};

export const backtest = {
  ...baseServices,
  ...contextServices,
  ...connectionServices,
  ...schemaServices,
  ...coreServices,
  ...metaServices,
  ...globalServices,
  ...commandServices,
  ...logicPrivateServices,
  ...logicPublicServices,
  ...markdownServices,
  ...reportServices,
  ...validationServices,
};

init();

export { ExecutionContextService };
export { MethodContextService };

export default backtest;
