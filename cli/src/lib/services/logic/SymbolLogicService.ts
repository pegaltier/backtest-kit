import { singleshot } from "functools-kit";
import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import { getArgs } from "src/helpers/getArgs";

export class SymbolLogicService {
  public readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public init = singleshot(async () => {
    this.loggerService.log("symbolLogicService init");
    if (!getArgs().values.symbol) {
      console.warn(
        "Warning: The default symbol is set to BTCUSDT. Please make sure to update it according to your needs using --symbol cli param.",
      );
    }
  });
}

export default SymbolLogicService;
