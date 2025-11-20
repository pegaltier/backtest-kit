import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import ExecutionContextService from "../context/ExecutionContextService";
import FrameConnectionService from "../connection/FrameConnectionService";

export class FramePublicService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly frameConnectionService = inject<FrameConnectionService>(
    TYPES.frameConnectionService
  );

  public getTimeframe = async (symbol: string) => {
    this.loggerService.log("framePublicService getTimeframe", {
      symbol,
    });
    return await this.frameConnectionService.getTimeframe(symbol);
  };
}

export default FramePublicService;
