import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import ExecutionContextService from "../context/ExecutionContextService";
import FrameConnectionService from "../connection/FrameConnectionService";
import FrameValidationService from "../validation/FrameValidationService";

const METHOD_NAME_GET_TIMEFRAME = "frameGlobalService getTimeframe";

/**
 * Global service for frame operations.
 *
 * Wraps FrameConnectionService for timeframe generation.
 * Used internally by BacktestLogicPrivateService.
 */
export class FrameGlobalService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly frameConnectionService = inject<FrameConnectionService>(
    TYPES.frameConnectionService
  );
  private readonly frameValidationService = inject<FrameValidationService>(
    TYPES.frameValidationService
  );

  /**
   * Generates timeframe array for backtest iteration.
   *
   * @param symbol - Trading pair symbol
   * @returns Promise resolving to array of Date objects
   */
  public getTimeframe = async (symbol: string) => {
    this.loggerService.log(METHOD_NAME_GET_TIMEFRAME, {
      symbol,
    });
    this.frameValidationService.validate(symbol, METHOD_NAME_GET_TIMEFRAME);
    return await this.frameConnectionService.getTimeframe(symbol);
  };
}

export default FrameGlobalService;
