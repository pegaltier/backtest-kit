import { IExchangeSchema } from "../../../interfaces/Exchange.interface";
import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";

export class ExchangeSchemaService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  private _exchangeSchema: IExchangeSchema;

  public getSchema = () => {
    this.loggerService.log("exchangeSchemaService getSchema");
    if (!this._exchangeSchema) {
      throw new Error("ExchangeSchemaService no exchange source provided");
    }
    return this._exchangeSchema;
  };

  public addSchema = (exchangeSchema: IExchangeSchema) => {
    this.loggerService.log("exchangeSchemaService addSchema");
    this._exchangeSchema = exchangeSchema;
  };
}

export default ExchangeSchemaService;
