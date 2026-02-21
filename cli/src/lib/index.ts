import "./core/provide";
import { inject, init } from "./core/di";
import TYPES from "./core/types";
import LoggerService from "./services/base/LoggerService";
import PaperMainService from "./services/main/PaperMainService";
import LiveMainService from "./services/main/LiveMainService";
import BacktestMainService from "./services/main/BacktestMainService";
import ExchangeLogicService from "./services/logic/ExchangeLogicService";
import FrameLogicService from "./services/logic/FrameLogicService";

const baseServices = {
  loggerService: inject<LoggerService>(TYPES.loggerService),
};

const mainServices = {
  backtestMainService: inject<BacktestMainService>(TYPES.backtestMainService),
  paperMainService: inject<PaperMainService>(TYPES.paperMainService),
  liveMainService: inject<LiveMainService>(TYPES.liveMainService),
}

const logicServices = {
  exchangeLogicService: inject<ExchangeLogicService>(TYPES.exchangeLogicService),
  frameLogicService: inject<FrameLogicService>(TYPES.frameLogicService),
}

export const backtest = {
  ...baseServices,
  ...mainServices,
  ...logicServices,
};

init();

export default backtest;
