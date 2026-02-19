import backtest from "../lib";
import { Lock } from "./Lock";

const METHOD_NAME_ACQUIRE_LOCK = "CandleUtils.acquireLock";
const METHOD_NAME_RELEASE_LOCK = "CandleUtils.releaseLock";

export class CandleUtils {
  private _lock = new Lock();

  public acquireLock = async (source: string) => {
    backtest.loggerService.info(METHOD_NAME_ACQUIRE_LOCK, {
      source,
    });
    return await this._lock.acquireLock();
  };

  public releaseLock = async (source: string) => {
    backtest.loggerService.info(METHOD_NAME_RELEASE_LOCK, {
      source,
    });
    return await this._lock.releaseLock();
  };
}

export const Candle = new CandleUtils();
