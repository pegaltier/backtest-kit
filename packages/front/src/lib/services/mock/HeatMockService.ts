import fs from "fs/promises";
import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import { TYPES } from "../../../lib/core/types";
import { singleshot } from "functools-kit";

const MOCK_DATA_PATH = "./mock/heat.json";
const MOCK_REPORT_PATH = "./mock/heat-report.md";

const READ_HEAT_DATA_FN = singleshot(
  async () => {
    const data = await fs.readFile(MOCK_DATA_PATH, "utf-8");
    return JSON.parse(data);
  },
);

const READ_HEAT_REPORT_FN = singleshot(
  async () => {
    return await fs.readFile(MOCK_REPORT_PATH, "utf-8");
  },
);

export class HeatMockService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public getStrategyHeatData = async () => {
    this.loggerService.log("heatMockService getStrategyHeatData");
    return await READ_HEAT_DATA_FN();
  };

  public getStrategyHeatReport = async () => {
    this.loggerService.log("heatMockService getStrategyHeatReport");
    return await READ_HEAT_REPORT_FN();
  };
}

export default HeatMockService;
