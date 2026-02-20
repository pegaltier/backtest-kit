import { GLOBAL_CONFIG } from "../config/params";
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
    if (!GLOBAL_CONFIG.CC_ENABLE_CANDLE_FETCH_MUTEX) {
      return;
    }
    return await this._lock.acquireLock();
  };

  public releaseLock = async (source: string) => {
    backtest.loggerService.info(METHOD_NAME_RELEASE_LOCK, {
      source,
    });
    if (!GLOBAL_CONFIG.CC_ENABLE_CANDLE_FETCH_MUTEX) {
      return;
    }
    return await this._lock.releaseLock();
  };
}

export const Candle = new CandleUtils();
