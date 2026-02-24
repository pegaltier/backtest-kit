import { ILogger } from "../interfaces/Logger.interface";
import cli from "../lib";

export function setLogger(logger: ILogger) {
  cli.loggerService.setLogger(logger);
}
