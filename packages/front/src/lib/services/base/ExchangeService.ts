import { inject } from "src/lib/core/di";
import LoggerService from "./LoggerService";
import { TYPES } from "src/lib/core/types";
import { CandleInterval, Exchange } from "backtest-kit";

type ExchangeName = string;

export class ExchangeService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public getCandles = async (dto: {
    symbol: string;
    interval: CandleInterval;
    exchangeName: ExchangeName;
    currentTime: number;
  }) => {
    this.loggerService.log("exchangeService getCandles", {
      dto,
    });
    return await Exchange.getRawCandles(dto.symbol, dto.interval, {
      exchangeName: dto.exchangeName,
    });
  };
}

export default ExchangeService;
