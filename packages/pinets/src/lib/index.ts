import "./core/provide";

import { init, inject } from "./core/di";
import { TYPES } from "./core/types";

import LoggerService from "./services/base/LoggerService";
import AxisProviderService from "./services/provider/AxisProviderService";
import CandleProviderService from "./services/provider/CandleProviderService";
import PineJobService from "./services/job/PineJobService";
import PineDataService from "./services/data/PineDataService";

const commonServices = {
  loggerService: inject<LoggerService>(TYPES.loggerService),
};

const providerServices = {
  axisProviderService: inject<AxisProviderService>(TYPES.axisProviderService),
  candleProviderService: inject<CandleProviderService>(TYPES.candleProviderService),
};

const jobServices = {
  pineJobService: inject<PineJobService>(TYPES.pineJobService),
};

const dataServices = {
  pineDataService: inject<PineDataService>(TYPES.pineDataService),
};

const pine = {
  ...commonServices,
  ...providerServices,
  ...jobServices,
  ...dataServices,
};

init();

export { pine };

export default pine;
