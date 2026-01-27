import LoggerService from "../base/LoggerService";
import { TYPES } from "../../../lib/core/types";
import { inject } from "../../../lib/core/di";
import { CandleInterval } from "backtest-kit";
import StorageMockService from "./StorageMockService";
import ExchangeService from "../base/ExchangeService";

export class ExchangeMockService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly storageMockService = inject<StorageMockService>(
    TYPES.storageMockService,
  );
  private readonly exchangeService = inject<ExchangeService>(
    TYPES.exchangeService,
  );

  public getCandles = async (signalId: string, interval: CandleInterval) => {
    this.loggerService.log("exchangeMockService getCandles", {
      signalId,
      interval,
    });
    const signal = await this.storageMockService.findSignalById(signalId);
    if (!signal) {
      throw new Error(`Signal with ID ${signalId} not found`);
    }
    const {
      pendingAt,
      scheduledAt,
      createdAt = pendingAt || scheduledAt,
      updatedAt,
    } = signal;
    const currentTime = Math.max(createdAt, updatedAt);
    return await this.exchangeService.getCandles({
      symbol: signal.symbol,
      exchangeName: signal.exchangeName,
      currentTime,
      interval,
    });
  };
}

export default ExchangeMockService;
