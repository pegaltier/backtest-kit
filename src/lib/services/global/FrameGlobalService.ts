import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import ExecutionContextService from "../context/ExecutionContextService";
import FrameConnectionService from "../connection/FrameConnectionService";

export class FrameGlobalService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly frameConnectionService = inject<FrameConnectionService>(
    TYPES.frameConnectionService
  );

  public getTimeframe = async (symbol: string) => {
    this.loggerService.log("frameGlobalService getTimeframe", {
      symbol,
    });
    return await this.frameConnectionService.getTimeframe(symbol);
  };
}

export default FrameGlobalService;
