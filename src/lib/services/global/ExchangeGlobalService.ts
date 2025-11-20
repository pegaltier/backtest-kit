import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import ExecutionContextService from "../context/ExecutionContextService";
import { CandleInterval } from "../../../interfaces/Exchange.interface";
import ExchangeConnectionService from "../connection/ExchangeConnectionService";

export class ExchangeGlobalService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly exchangeConnectionService =
    inject<ExchangeConnectionService>(TYPES.exchangeConnectionService);

  public getCandles = async (
    symbol: string,
    interval: CandleInterval,
    limit: number,
    when: Date,
    backtest: boolean
  ) => {
    this.loggerService.log("exchangeGlobalService getCandles", {
      symbol,
      interval,
      limit,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.exchangeConnectionService.getCandles(
          symbol,
          interval,
          limit
        );
      },
      {
        symbol,
        when,
        backtest,
      }
    );
  };

  public getNextCandles = async (
    symbol: string,
    interval: CandleInterval,
    limit: number,
    when: Date,
    backtest: boolean
  ) => {
    this.loggerService.log("exchangeGlobalService getNextCandles", {
      symbol,
      interval,
      limit,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.exchangeConnectionService.getNextCandles(
          symbol,
          interval,
          limit
        );
      },
      {
        symbol,
        when,
        backtest,
      }
    );
  };

  public getAveragePrice = async (
    symbol: string,
    when: Date,
    backtest: boolean
  ) => {
    this.loggerService.log("exchangeGlobalService getAveragePrice", {
      symbol,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.exchangeConnectionService.getAveragePrice(symbol);
      },
      {
        symbol,
        when,
        backtest,
      }
    );
  };

  public formatPrice = async (
    symbol: string,
    price: number,
    when: Date,
    backtest: boolean
  ) => {
    this.loggerService.log("exchangeGlobalService formatPrice", {
      symbol,
      price,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.exchangeConnectionService.formatPrice(symbol, price);
      },
      {
        symbol,
        when,
        backtest,
      }
    );
  };

  public formatQuantity = async (
    symbol: string,
    quantity: number,
    when: Date,
    backtest: boolean
  ) => {
    this.loggerService.log("exchangeGlobalService formatQuantity", {
      symbol,
      quantity,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.exchangeConnectionService.formatQuantity(
          symbol,
          quantity
        );
      },
      {
        symbol,
        when,
        backtest,
      }
    );
  };
}

export default ExchangeGlobalService;
