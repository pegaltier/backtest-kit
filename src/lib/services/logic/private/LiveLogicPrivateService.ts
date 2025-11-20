import { inject } from "../../../core/di";
import LoggerService from "../../base/LoggerService";
import TYPES from "../../../core/types";

export class LiveLogicPrivateService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  public run = async (symbol: string) => {
    this.loggerService.log("liveLogicPrivateService run", {
      symbol,
    });
  };
}

export default LiveLogicPrivateService;
