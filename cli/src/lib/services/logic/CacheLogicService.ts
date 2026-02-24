import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import {
  listFrameSchema,
  checkCandles,
  warmCandles,
  CandleInterval,
} from "backtest-kit";
import { getErrorMessage, retry } from "functools-kit";

const GET_TIMEFRAME_RANGE_FN = async (frameName: string) => {
  const frameList = await listFrameSchema();
  const frameSchema = frameList.find(
    (frameSchema) => frameSchema.frameName === frameName,
  );
  if (!frameSchema) {
    throw new Error(`Frame with name ${frameName} not found`);
  }
  const { startDate, endDate } = frameSchema;
  return { startDate, endDate };
};

const CACHE_CANDLES_FN = retry(
  async (
    interval: string,
    dto: {
      symbol: string;
      exchangeName: string;
      from: Date;
      to: Date;
    },
  ) => {
    try {
      console.log(
        `Checking candles cache for ${dto.symbol} ${interval} from ${dto.from} to ${dto.to}`,
      );
      await checkCandles({
        exchangeName: dto.exchangeName,
        from: dto.from,
        to: dto.to,
        symbol: dto.symbol,
        interval: <CandleInterval>interval,
      });
    } catch (error) {
      console.log(
        `Caching candles for ${dto.symbol} ${interval} from ${dto.from} to ${dto.to}`,
      );
      await warmCandles({
        symbol: dto.symbol,
        exchangeName: dto.exchangeName,
        from: dto.from,
        to: dto.to,
        interval: <CandleInterval>interval,
      });
      throw error;
    }
  },
  2,
);

export class CacheLogicService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public execute = async (
    intervalList: CandleInterval[],
    dto: {
      symbol: string;
      frameName: string;
      exchangeName: string;
    },
  ) => {
    this.loggerService.log("cacheLogicService execute", {
      dto,
    });
    const { startDate, endDate } = await GET_TIMEFRAME_RANGE_FN(dto.frameName);
    try {
      for (const interval of intervalList) {
        await CACHE_CANDLES_FN(interval, {
          symbol: dto.symbol,
          exchangeName: dto.exchangeName,
          from: startDate,
          to: endDate,
        });
      }
    } catch (error) {
      console.log(getErrorMessage(error));
      throw error;
    }
  };
}

export default CacheLogicService;
