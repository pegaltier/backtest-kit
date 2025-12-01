import { inject } from "../../../lib/core/di";
import {
  IOptimizerData,
  IOptimizerTemplate,
} from "../../../interfaces/Optimizer.interface";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import { str } from "functools-kit";

export class OptimizerTemplateService implements IOptimizerTemplate {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public getUserMessage = async (symbol: string, data: IOptimizerData[]) => {
    this.loggerService.log("optimizerTemplateService getUserMessage", {
      data,
    });
    return str.newline("Прочитай данные и скажи ОК", "", JSON.stringify(data));
  };

  public getAssistantMessage = async (symbol: string, data: IOptimizerData[]) => {
    this.loggerService.log("optimizerTemplateService getAssistantMessage", {
      data,
    });
    return "ОК";
  };
}

export default OptimizerTemplateService;
