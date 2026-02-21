import { singleshot } from "functools-kit";
import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import { addFrameSchema, listFrameSchema } from "backtest-kit";
import FrameName from "../../../enum/FrameName";

const ADD_FRAME_FN = (self: FrameLogicService) => {
  self.loggerService.log("Adding February 2024 as a default frame schema");
  addFrameSchema({
    frameName: FrameName.DefaultFrame,
    interval: "1m",
    startDate: new Date("2024-02-01T00:00:00Z"),
    endDate: new Date("2024-02-29T23:59:59Z"),
  });
};

export class FrameLogicService {
  public readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public init = singleshot(async () => {
    this.loggerService.log("frameLogicService init");
    const { length } = await listFrameSchema();
    !length && ADD_FRAME_FN(this);
  });
}

export default FrameLogicService;
