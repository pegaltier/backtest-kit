import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import { TExecutionContextService } from "../context/ExecutionContextService";
import {
  CandleInterval,
  IExchange,
} from "../../../interfaces/Exchange.interface";
import { memoize } from "functools-kit";
import ClientExchange from "../../../client/ClientExchange";
import ExchangeSchemaService from "../schema/ExchangeSchemaService";

export class ExchangeConnectionService implements IExchange {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly executionContextService = inject<TExecutionContextService>(
    TYPES.executionContextService
  );
  private readonly exchangeSchemaService = inject<ExchangeSchemaService>(
    TYPES.exchangeSchemaService
  );

  public getExchange = memoize<(symbol: string) => ClientExchange>(
    (symbol) => `${symbol}`,
    () => {
      const { getCandles, formatPrice, formatQuantity, callbacks } =
        this.exchangeSchemaService.getSchema();
      return new ClientExchange({
        execution: this.executionContextService,
        logger: this.loggerService,
        getCandles,
        formatPrice,
        formatQuantity,
        callbacks,
      });
    }
  );

  public getCandles = async (
    symbol: string,
    interval: CandleInterval,
    limit: number
  ) => {
    this.loggerService.log("exchangeConnectionService getCandles", {
      symbol,
      interval,
      limit,
    });
    return await this.getExchange(symbol).getCandles(symbol, interval, limit);
  };

  public getAveragePrice = async (symbol: string) => {
    this.loggerService.log("exchangeConnectionService getAveragePrice", {
      symbol,
    });
    return await this.getExchange(symbol).getAveragePrice(symbol);
  };

  public formatPrice = async (symbol: string, price: number) => {
    this.loggerService.log("exchangeConnectionService getAveragePrice", {
      symbol,
      price,
    });
    return await this.getExchange(symbol).formatPrice(symbol, price);
  };

  public formatQuantity = async (symbol: string, quantity: number) => {
    this.loggerService.log("exchangeConnectionService getAveragePrice", {
      symbol,
      quantity,
    });
    return await this.getExchange(symbol).formatQuantity(symbol, quantity);
  };
}

export default ExchangeConnectionService;
