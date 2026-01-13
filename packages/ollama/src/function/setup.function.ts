import { ILogger } from "../interface/Logger.interface";
import lib from "../lib";

export const setLogger = (logger: ILogger) => {
  lib.loggerService.setLogger(logger);
}
