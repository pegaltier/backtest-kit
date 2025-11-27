import {
  errorData,
  getErrorMessage,
  not,
  randomString,
  singleshot,
  trycatch,
} from "functools-kit";
import {
  IStrategy,
  ISignalRow,
  IScheduledSignalRow,
  IStrategyParams,
  IStrategyTickResult,
  IStrategyTickResultIdle,
  IStrategyTickResultScheduled,
  IStrategyTickResultOpened,
  IStrategyTickResultActive,
  IStrategyTickResultClosed,
  IStrategyTickResultCancelled,
  IStrategyBacktestResult,
  StrategyCloseReason,
  SignalInterval,
} from "../interfaces/Strategy.interface";
import toProfitLossDto from "../helpers/toProfitLossDto";
import { ICandleData } from "../interfaces/Exchange.interface";
import { PersistSignalAdaper } from "../classes/Persist";
import backtest from "../lib";
import { errorEmitter } from "../config/emitters";
import { CC_SCHEDULE_AWAIT_MINUTES } from "../config/params";

const INTERVAL_MINUTES: Record<SignalInterval, number> = {
  "1m": 1,
  "3m": 3,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
};

const VALIDATE_SIGNAL_FN = (signal: ISignalRow): void => {
  const errors: string[] = [];

  // Валидация цен
  if (signal.priceOpen <= 0) {
    errors.push(`priceOpen must be positive, got ${signal.priceOpen}`);
  }
  if (signal.priceTakeProfit <= 0) {
    errors.push(
      `priceTakeProfit must be positive, got ${signal.priceTakeProfit}`
    );
  }
  if (signal.priceStopLoss <= 0) {
    errors.push(`priceStopLoss must be positive, got ${signal.priceStopLoss}`);
  }

  // Валидация для long позиции
  if (signal.position === "long") {
    if (signal.priceTakeProfit <= signal.priceOpen) {
      errors.push(
        `Long: priceTakeProfit (${signal.priceTakeProfit}) must be > priceOpen (${signal.priceOpen})`
      );
    }
    if (signal.priceStopLoss >= signal.priceOpen) {
      errors.push(
        `Long: priceStopLoss (${signal.priceStopLoss}) must be < priceOpen (${signal.priceOpen})`
      );
    }
  }

  // Валидация для short позиции
  if (signal.position === "short") {
    if (signal.priceTakeProfit >= signal.priceOpen) {
      errors.push(
        `Short: priceTakeProfit (${signal.priceTakeProfit}) must be < priceOpen (${signal.priceOpen})`
      );
    }
    if (signal.priceStopLoss <= signal.priceOpen) {
      errors.push(
        `Short: priceStopLoss (${signal.priceStopLoss}) must be > priceOpen (${signal.priceOpen})`
      );
    }
  }

  // Валидация временных параметров
  if (signal.minuteEstimatedTime <= 0) {
    errors.push(
      `minuteEstimatedTime must be positive, got ${signal.minuteEstimatedTime}`
    );
  }
  if (signal.timestamp <= 0) {
    errors.push(`timestamp must be positive, got ${signal.timestamp}`);
  }

  // Кидаем ошибку если есть проблемы
  if (errors.length > 0) {
    throw new Error(
      `Invalid signal for ${signal.position} position:\n${errors.join("\n")}`
    );
  }
};

const GET_SIGNAL_FN = trycatch(
  async (self: ClientStrategy): Promise<ISignalRow | IScheduledSignalRow | null> => {
    if (self._isStopped) {
      return null;
    }
    const currentTime = self.params.execution.context.when.getTime();
    {
      const intervalMinutes = INTERVAL_MINUTES[self.params.interval];
      const intervalMs = intervalMinutes * 60 * 1000;

      // Проверяем что прошел нужный интервал с последнего getSignal
      if (
        self._lastSignalTimestamp !== null &&
        currentTime - self._lastSignalTimestamp < intervalMs
      ) {
        return null;
      }

      self._lastSignalTimestamp = currentTime;
    }
    const currentPrice = await self.params.exchange.getAveragePrice(
      self.params.execution.context.symbol
    );
    if (
      await not(
        self.params.risk.checkSignal({
          symbol: self.params.execution.context.symbol,
          strategyName: self.params.method.context.strategyName,
          exchangeName: self.params.method.context.exchangeName,
          currentPrice,
          timestamp: currentTime,
        })
      )
    ) {
      return null;
    }
    const signal = await self.params.getSignal(
      self.params.execution.context.symbol
    );
    if (!signal) {
      return null;
    }

    // Если priceOpen указан - создаем scheduled signal
    if (signal.priceOpen !== undefined) {
      const scheduledSignalRow: IScheduledSignalRow = {
        id: randomString(),
        priceOpen: signal.priceOpen,
        position: signal.position,
        note: signal.note,
        priceTakeProfit: signal.priceTakeProfit,
        priceStopLoss: signal.priceStopLoss,
        minuteEstimatedTime: signal.minuteEstimatedTime,
        symbol: self.params.execution.context.symbol,
        exchangeName: self.params.method.context.exchangeName,
        strategyName: self.params.method.context.strategyName,
        timestamp: currentTime,
      };

      // Валидируем сигнал перед возвратом
      VALIDATE_SIGNAL_FN(scheduledSignalRow);

      // @ts-ignore - runtime marker
      scheduledSignalRow._isScheduled = true;

      return scheduledSignalRow;
    }

    // Если priceOpen не указан - создаем обычный signal с текущей ценой
    const signalRow: ISignalRow = {
      id: randomString(),
      priceOpen: currentPrice,
      ...signal,
      symbol: self.params.execution.context.symbol,
      exchangeName: self.params.method.context.exchangeName,
      strategyName: self.params.method.context.strategyName,
      timestamp: currentTime,
    };

    // Валидируем сигнал перед возвратом
    VALIDATE_SIGNAL_FN(signalRow);

    // @ts-ignore - runtime marker
    signalRow._isScheduled = false;

    return signalRow;
  },
  {
    defaultValue: null,
    fallback: (error) => {
      backtest.loggerService.warn("ClientStrategy exception thrown", {
        error: errorData(error),
        message: getErrorMessage(error),
      });
      errorEmitter.next(error);
    },
  }
);

const GET_AVG_PRICE_FN = (candles: ICandleData[]): number => {
  const sumPriceVolume = candles.reduce((acc, c) => {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    return acc + typicalPrice * c.volume;
  }, 0);

  const totalVolume = candles.reduce((acc, c) => acc + c.volume, 0);

  return totalVolume === 0
    ? candles.reduce((acc, c) => acc + c.close, 0) / candles.length
    : sumPriceVolume / totalVolume;
};

const WAIT_FOR_INIT_FN = async (self: ClientStrategy) => {
  self.params.logger.debug("ClientStrategy waitForInit");
  if (self.params.execution.context.backtest) {
    return;
  }
  const pendingSignal = await PersistSignalAdaper.readSignalData(
    self.params.strategyName,
    self.params.execution.context.symbol
  );
  if (!pendingSignal) {
    return;
  }
  if (pendingSignal.exchangeName !== self.params.method.context.exchangeName) {
    return;
  }
  if (pendingSignal.strategyName !== self.params.method.context.strategyName) {
    return;
  }
  self._pendingSignal = pendingSignal;
};

/**
 * Client implementation for trading strategy lifecycle management.
 *
 * Features:
 * - Signal generation with interval throttling
 * - Automatic signal validation (prices, TP/SL logic, timestamps)
 * - Crash-safe persistence in live mode
 * - VWAP-based TP/SL monitoring
 * - Fast backtest with candle array processing
 *
 * All methods use prototype functions for memory efficiency.
 *
 * @example
 * ```typescript
 * const strategy = new ClientStrategy({
 *   strategyName: "my-strategy",
 *   interval: "5m",
 *   getSignal: async (symbol) => ({ ... }),
 *   execution: executionService,
 *   exchange: exchangeService,
 *   logger: loggerService,
 * });
 *
 * await strategy.waitForInit(); // Load persisted state
 * const result = await strategy.tick(); // Monitor signal
 * ```
 */
export class ClientStrategy implements IStrategy {
  _isStopped = false;
  _pendingSignal: ISignalRow | null = null;
  _scheduledSignal: IScheduledSignalRow | null = null;
  _lastSignalTimestamp: number | null = null;

  constructor(readonly params: IStrategyParams) {}

  /**
   * Initializes strategy state by loading persisted signal from disk.
   *
   * Uses singleshot pattern to ensure initialization happens exactly once.
   * In backtest mode: skips persistence, no state to load
   * In live mode: reads last signal state from disk
   *
   * @returns Promise that resolves when initialization is complete
   */
  public waitForInit = singleshot(async () => await WAIT_FOR_INIT_FN(this));

  /**
   * Updates pending signal and persists to disk in live mode.
   *
   * Centralized method for all signal state changes.
   * Uses atomic file writes to prevent corruption.
   *
   * @param pendingSignal - New signal state (null to clear)
   * @returns Promise that resolves when update is complete
   */
  public async setPendingSignal(pendingSignal: ISignalRow | null) {
    this.params.logger.debug("ClientStrategy setPendingSignal", {
      pendingSignal,
    });
    this._pendingSignal = pendingSignal;
    if (this.params.execution.context.backtest) {
      return;
    }
    await PersistSignalAdaper.writeSignalData(
      this._pendingSignal,
      this.params.strategyName,
      this.params.execution.context.symbol
    );
  }

  /**
   * Performs a single tick of strategy execution.
   *
   * Flow (LIVE mode):
   * 1. If scheduled signal exists: check activation/cancellation
   * 2. If no pending/scheduled signal: call getSignal with throttling and validation
   * 3. If signal opened: trigger onOpen callback, persist state
   * 4. If pending signal exists: check VWAP against TP/SL
   * 5. If TP/SL/time reached: close signal, trigger onClose, persist state
   *
   * Flow (BACKTEST mode):
   * 1. If no pending/scheduled signal: call getSignal
   * 2. If scheduled signal created: return "scheduled" (backtest() will handle it)
   * 3. Otherwise same as LIVE
   *
   * @returns Promise resolving to discriminated union result:
   * - idle: No signal generated
   * - scheduled: Scheduled signal created (backtest only)
   * - opened: New signal just created
   * - active: Signal monitoring in progress
   * - closed: Signal completed with PNL
   *
   * @example
   * ```typescript
   * const result = await strategy.tick();
   * if (result.action === "closed") {
   *   console.log(`PNL: ${result.pnl.pnlPercentage}%`);
   * }
   * ```
   */
  public async tick(): Promise<IStrategyTickResult> {
    this.params.logger.debug("ClientStrategy tick");

    // Мониторим scheduled signal независимо от режима
    if (this._scheduledSignal && !this._pendingSignal) {
      const averagePrice = await this.params.exchange.getAveragePrice(
        this.params.execution.context.symbol
      );

      const scheduled = this._scheduledSignal;
      let shouldActivate = false;
      let shouldCancel = false;

      // Проверяем время жизни scheduled signal
      const currentTime = this.params.execution.context.when.getTime();
      const signalTime = scheduled.timestamp;
      const maxTimeToWait = CC_SCHEDULE_AWAIT_MINUTES * 60 * 1000; // конвертируем в миллисекунды
      const elapsedTime = currentTime - signalTime;

      if (elapsedTime >= maxTimeToWait) {
        // Время истекло - отменяем scheduled signal
        this.params.logger.info("ClientStrategy scheduled signal cancelled by timeout", {
          symbol: this.params.execution.context.symbol,
          signalId: scheduled.id,
          elapsedMinutes: Math.floor(elapsedTime / 60000),
          maxMinutes: CC_SCHEDULE_AWAIT_MINUTES,
        });

        this._scheduledSignal = null;

        const result: IStrategyTickResultCancelled = {
          action: "cancelled",
          signal: scheduled,
          currentPrice: averagePrice,
          closeTimestamp: currentTime,
          strategyName: this.params.method.context.strategyName,
          exchangeName: this.params.method.context.exchangeName,
          symbol: this.params.execution.context.symbol,
        };

        if (this.params.callbacks?.onTick) {
          this.params.callbacks.onTick(
            this.params.execution.context.symbol,
            result,
            this.params.execution.context.backtest
          );
        }

        return result;
      }

      // Проверяем активацию и отмену для long позиции
      if (scheduled.position === "long") {
        if (averagePrice <= scheduled.priceOpen) {
          shouldActivate = true;
        }
        if (averagePrice <= scheduled.priceStopLoss) {
          shouldCancel = true;
        }
      }

      // Проверяем активацию и отмену для short позиции
      if (scheduled.position === "short") {
        if (averagePrice >= scheduled.priceOpen) {
          shouldActivate = true;
        }
        if (averagePrice >= scheduled.priceStopLoss) {
          shouldCancel = true;
        }
      }

      // Отменяем scheduled signal если цена прошла через StopLoss
      if (shouldCancel) {
        this.params.logger.info("ClientStrategy scheduled signal cancelled", {
          symbol: this.params.execution.context.symbol,
          signalId: scheduled.id,
          position: scheduled.position,
          averagePrice,
          priceStopLoss: scheduled.priceStopLoss,
        });

        this._scheduledSignal = null;

        const result: IStrategyTickResultIdle = {
          action: "idle",
          signal: null,
          strategyName: this.params.method.context.strategyName,
          exchangeName: this.params.method.context.exchangeName,
          symbol: this.params.execution.context.symbol,
          currentPrice: averagePrice,
        };

        if (this.params.callbacks?.onTick) {
          this.params.callbacks.onTick(
            this.params.execution.context.symbol,
            result,
            this.params.execution.context.backtest
          );
        }

        return result;
      }

      // Активируем scheduled signal если цена достигла priceOpen
      if (shouldActivate) {
        this.params.logger.info("ClientStrategy scheduled signal activated", {
          symbol: this.params.execution.context.symbol,
          signalId: scheduled.id,
          position: scheduled.position,
          averagePrice,
          priceOpen: scheduled.priceOpen,
        });

        // Конвертируем scheduled signal в pending signal
        this._scheduledSignal = null;
        await this.setPendingSignal(scheduled);

        // Register signal with risk management
        await this.params.risk.addSignal(
          this.params.execution.context.symbol,
          {
            strategyName: this.params.method.context.strategyName,
            riskName: this.params.riskName,
          }
        );

        if (this.params.callbacks?.onOpen) {
          this.params.callbacks.onOpen(
            this.params.execution.context.symbol,
            this._pendingSignal,
            this._pendingSignal.priceOpen,
            this.params.execution.context.backtest
          );
        }

        const result: IStrategyTickResultOpened = {
          action: "opened",
          signal: this._pendingSignal,
          strategyName: this.params.method.context.strategyName,
          exchangeName: this.params.method.context.exchangeName,
          symbol: this.params.execution.context.symbol,
          currentPrice: this._pendingSignal.priceOpen,
        };

        if (this.params.callbacks?.onTick) {
          this.params.callbacks.onTick(
            this.params.execution.context.symbol,
            result,
            this.params.execution.context.backtest
          );
        }

        return result;
      }

      // Если ни активация ни отмена - возвращаем active для scheduled signal
      const result: IStrategyTickResultActive = {
        action: "active",
        signal: scheduled,
        currentPrice: averagePrice,
        strategyName: this.params.method.context.strategyName,
        exchangeName: this.params.method.context.exchangeName,
        symbol: this.params.execution.context.symbol,
      };

      if (this.params.callbacks?.onTick) {
        this.params.callbacks.onTick(
          this.params.execution.context.symbol,
          result,
          this.params.execution.context.backtest
        );
      }

      return result;
    }

    // Если нет ни pending ни scheduled signal - пытаемся получить новый
    if (!this._pendingSignal && !this._scheduledSignal) {
      const signal = await GET_SIGNAL_FN(this);

      if (!signal) {
        // Нет сигнала - переходим к idle логике ниже
        await this.setPendingSignal(null);
      } else {
        // @ts-ignore - check runtime marker
        if (signal._isScheduled === true) {
          this._scheduledSignal = signal as IScheduledSignalRow;

          const currentPrice = await this.params.exchange.getAveragePrice(
            this.params.execution.context.symbol
          );

          this.params.logger.info("ClientStrategy scheduled signal created", {
            symbol: this.params.execution.context.symbol,
            signalId: this._scheduledSignal.id,
            position: this._scheduledSignal.position,
            priceOpen: this._scheduledSignal.priceOpen,
            currentPrice: currentPrice,
          });

          // Возвращаем "scheduled" независимо от режима
          const result: IStrategyTickResultScheduled = {
            action: "scheduled",
            signal: this._scheduledSignal,
            strategyName: this.params.method.context.strategyName,
            exchangeName: this.params.method.context.exchangeName,
            symbol: this.params.execution.context.symbol,
            currentPrice: currentPrice,
          };

          if (this.params.callbacks?.onTick) {
            this.params.callbacks.onTick(
              this.params.execution.context.symbol,
              result,
              this.params.execution.context.backtest
            );
          }

          return result;
        }

        // Если получили обычный signal (не scheduled)
        await this.setPendingSignal(signal);
      }

      // Продолжаем с обычным signal (если был установлен)

      if (this._pendingSignal) {
        // Register signal with risk management
        await this.params.risk.addSignal(
          this.params.execution.context.symbol,
          {
            strategyName: this.params.method.context.strategyName,
            riskName: this.params.riskName,
          }
        );

        if (this.params.callbacks?.onOpen) {
          this.params.callbacks.onOpen(
            this.params.execution.context.symbol,
            this._pendingSignal,
            this._pendingSignal.priceOpen,
            this.params.execution.context.backtest
          );
        }

        const result: IStrategyTickResultOpened = {
          action: "opened",
          signal: this._pendingSignal,
          strategyName: this.params.method.context.strategyName,
          exchangeName: this.params.method.context.exchangeName,
          symbol: this.params.execution.context.symbol,
          currentPrice: this._pendingSignal.priceOpen,
        };

        if (this.params.callbacks?.onTick) {
          this.params.callbacks.onTick(
            this.params.execution.context.symbol,
            result,
            this.params.execution.context.backtest
          );
        }

        return result;
      }

      const currentPrice = await this.params.exchange.getAveragePrice(
        this.params.execution.context.symbol
      );

      if (this.params.callbacks?.onIdle) {
        this.params.callbacks.onIdle(
          this.params.execution.context.symbol,
          currentPrice,
          this.params.execution.context.backtest
        );
      }

      const result: IStrategyTickResultIdle = {
        action: "idle",
        signal: null,
        strategyName: this.params.method.context.strategyName,
        exchangeName: this.params.method.context.exchangeName,
        symbol: this.params.execution.context.symbol,
        currentPrice,
      };

      if (this.params.callbacks?.onTick) {
        this.params.callbacks.onTick(
          this.params.execution.context.symbol,
          result,
          this.params.execution.context.backtest
        );
      }

      return result;
    }

    const when = this.params.execution.context.when;
    const signal = this._pendingSignal;

    // Получаем среднюю цену
    const averagePrice = await this.params.exchange.getAveragePrice(
      this.params.execution.context.symbol
    );

    this.params.logger.debug("ClientStrategy tick check", {
      symbol: this.params.execution.context.symbol,
      averagePrice,
      signalId: signal.id,
      position: signal.position,
    });

    let shouldClose = false;
    let closeReason: StrategyCloseReason | undefined;

    // Проверяем истечение времени
    const signalEndTime =
      signal.timestamp + signal.minuteEstimatedTime * 60 * 1000;
    if (when.getTime() >= signalEndTime) {
      shouldClose = true;
      closeReason = "time_expired";
    }

    // Проверяем достижение TP/SL для long позиции
    if (signal.position === "long") {
      if (averagePrice >= signal.priceTakeProfit) {
        shouldClose = true;
        closeReason = "take_profit";
      } else if (averagePrice <= signal.priceStopLoss) {
        shouldClose = true;
        closeReason = "stop_loss";
      }
    }

    // Проверяем достижение TP/SL для short позиции
    if (signal.position === "short") {
      if (averagePrice <= signal.priceTakeProfit) {
        shouldClose = true;
        closeReason = "take_profit";
      } else if (averagePrice >= signal.priceStopLoss) {
        shouldClose = true;
        closeReason = "stop_loss";
      }
    }

    // Закрываем сигнал если выполнены условия
    if (shouldClose) {
      const pnl = toProfitLossDto(signal, averagePrice);
      const closeTimestamp = this.params.execution.context.when.getTime();

      // Предупреждение о закрытии сигнала в убыток
      if (closeReason === "stop_loss") {
        this.params.logger.warn(
          `ClientStrategy tick: Signal closed with loss (stop_loss), PNL: ${pnl.pnlPercentage.toFixed(
            2
          )}%`
        );
      }

      // Предупреждение о закрытии сигнала в убыток
      if (closeReason === "time_expired" && pnl.pnlPercentage < 0) {
        this.params.logger.warn(
          `ClientStrategy tick: Signal closed with loss (time_expired), PNL: ${pnl.pnlPercentage.toFixed(
            2
          )}%`
        );
      }

      this.params.logger.debug("ClientStrategy closing", {
        symbol: this.params.execution.context.symbol,
        signalId: signal.id,
        reason: closeReason,
        priceClose: averagePrice,
        closeTimestamp,
        pnlPercentage: pnl.pnlPercentage,
      });

      if (this.params.callbacks?.onClose) {
        this.params.callbacks.onClose(
          this.params.execution.context.symbol,
          signal,
          averagePrice,
          this.params.execution.context.backtest
        );
      }

      // Remove signal from risk management
      await this.params.risk.removeSignal(
        this.params.execution.context.symbol,
        {
          strategyName: this.params.method.context.strategyName,
          riskName: this.params.riskName,
        }
      );

      await this.setPendingSignal(null);

      const result: IStrategyTickResultClosed = {
        action: "closed",
        signal: signal,
        currentPrice: averagePrice,
        closeReason: closeReason,
        closeTimestamp: closeTimestamp,
        pnl: pnl,
        strategyName: this.params.method.context.strategyName,
        exchangeName: this.params.method.context.exchangeName,
        symbol: this.params.execution.context.symbol,
      };

      if (this.params.callbacks?.onTick) {
        this.params.callbacks.onTick(
          this.params.execution.context.symbol,
          result,
          this.params.execution.context.backtest
        );
      }

      return result;
    }

    if (this.params.callbacks?.onActive) {
      this.params.callbacks.onActive(
        this.params.execution.context.symbol,
        signal,
        averagePrice,
        this.params.execution.context.backtest
      );
    }

    const result: IStrategyTickResultActive = {
      action: "active",
      signal: signal,
      currentPrice: averagePrice,
      strategyName: this.params.method.context.strategyName,
      exchangeName: this.params.method.context.exchangeName,
      symbol: this.params.execution.context.symbol,
    };

    if (this.params.callbacks?.onTick) {
      this.params.callbacks.onTick(
        this.params.execution.context.symbol,
        result,
        this.params.execution.context.backtest
      );
    }

    return result;
  }

  /**
   * Fast backtests a signal using historical candle data.
   *
   * For scheduled signals:
   * 1. Iterates through candles checking for activation (price reaches priceOpen)
   * 2. Or cancellation (price hits StopLoss before activation)
   * 3. If activated: converts to pending signal and continues with TP/SL monitoring
   * 4. If cancelled: returns closed result with closeReason "cancelled"
   *
   * For pending signals:
   * 1. Iterates through candles checking VWAP against TP/SL on each timeframe
   * 2. Starts from index 4 (needs 5 candles for VWAP calculation)
   * 3. Returns closed result (either TP/SL or time_expired)
   *
   * @param candles - Array of candles to process
   * @returns Promise resolving to closed signal result with PNL
   * @throws Error if no pending/scheduled signal or not in backtest mode
   *
   * @example
   * ```typescript
   * // After signal opened in backtest
   * const candles = await exchange.getNextCandles("BTCUSDT", "1m", signal.minuteEstimatedTime);
   * const result = await strategy.backtest(candles);
   * console.log(result.closeReason); // "take_profit" | "stop_loss" | "time_expired" | "cancelled"
   * ```
   */
  public async backtest(
    candles: ICandleData[]
  ): Promise<IStrategyBacktestResult> {
    this.params.logger.debug("ClientStrategy backtest", {
      symbol: this.params.execution.context.symbol,
      candlesCount: candles.length,
      hasScheduled: !!this._scheduledSignal,
      hasPending: !!this._pendingSignal,
    });

    if (!this.params.execution.context.backtest) {
      throw new Error("ClientStrategy backtest: running in live context");
    }

    if (!this._pendingSignal && !this._scheduledSignal) {
      throw new Error("ClientStrategy backtest: no pending or scheduled signal");
    }

    // Обработка scheduled signal
    if (this._scheduledSignal && !this._pendingSignal) {
      const scheduled = this._scheduledSignal;

      this.params.logger.debug("ClientStrategy backtest scheduled signal", {
        symbol: this.params.execution.context.symbol,
        signalId: scheduled.id,
        priceOpen: scheduled.priceOpen,
        position: scheduled.position,
      });

      // Ищем точку активации или отмены в свечах
      for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const recentCandles = candles.slice(Math.max(0, i - 4), i + 1);
        const averagePrice = GET_AVG_PRICE_FN(recentCandles);

        let shouldActivate = false;
        let shouldCancel = false;

        // Проверяем активацию и отмену для long позиции
        if (scheduled.position === "long") {
          // Активация: цена упала до priceOpen или ниже
          if (candle.low <= scheduled.priceOpen) {
            shouldActivate = true;
          }
          // Отмена: цена упала ниже StopLoss
          if (candle.low <= scheduled.priceStopLoss) {
            shouldCancel = true;
          }
        }

        // Проверяем активацию и отмену для short позиции
        if (scheduled.position === "short") {
          // Активация: цена выросла до priceOpen или выше
          if (candle.high >= scheduled.priceOpen) {
            shouldActivate = true;
          }
          // Отмена: цена выросла выше StopLoss
          if (candle.high >= scheduled.priceStopLoss) {
            shouldCancel = true;
          }
        }

        // Отмена имеет приоритет над активацией
        if (shouldCancel) {
          this.params.logger.info("ClientStrategy backtest scheduled signal cancelled", {
            symbol: this.params.execution.context.symbol,
            signalId: scheduled.id,
            candleTimestamp: candle.timestamp,
            averagePrice,
            priceStopLoss: scheduled.priceStopLoss,
          });

          this._scheduledSignal = null;

          // Возвращаем cancelled (позиция НЕ была открыта)
          const result: IStrategyTickResultCancelled = {
            action: "cancelled",
            signal: scheduled,
            currentPrice: averagePrice,
            closeTimestamp: candle.timestamp,
            strategyName: this.params.method.context.strategyName,
            exchangeName: this.params.method.context.exchangeName,
            symbol: this.params.execution.context.symbol,
          };

          if (this.params.callbacks?.onTick) {
            this.params.callbacks.onTick(
              this.params.execution.context.symbol,
              result,
              this.params.execution.context.backtest
            );
          }

          return result;
        }

        // Активация scheduled signal
        if (shouldActivate) {
          this.params.logger.info("ClientStrategy backtest scheduled signal activated", {
            symbol: this.params.execution.context.symbol,
            signalId: scheduled.id,
            candleTimestamp: candle.timestamp,
            priceOpen: scheduled.priceOpen,
          });

          // Конвертируем scheduled в pending
          this._scheduledSignal = null;
          await this.setPendingSignal(scheduled);

          // Register signal with risk management
          await this.params.risk.addSignal(
            this.params.execution.context.symbol,
            {
              strategyName: this.params.method.context.strategyName,
              riskName: this.params.riskName,
            }
          );

          if (this.params.callbacks?.onOpen) {
            this.params.callbacks.onOpen(
              this.params.execution.context.symbol,
              scheduled,
              scheduled.priceOpen,
              this.params.execution.context.backtest
            );
          }

          // Продолжаем с оставшимися свечами для мониторинга TP/SL
          const remainingCandles = candles.slice(i + 1);

          if (remainingCandles.length === 0) {
            // Нет свечей для бектеста - закрываем по time_expired
            const lastPrice = averagePrice;
            const pnl = toProfitLossDto(scheduled, lastPrice);

            this.params.logger.debug("ClientStrategy backtest time_expired (no candles after activation)", {
              symbol: this.params.execution.context.symbol,
              signalId: scheduled.id,
              priceClose: lastPrice,
              closeTimestamp: candle.timestamp,
              pnlPercentage: pnl.pnlPercentage,
            });

            if (this.params.callbacks?.onClose) {
              this.params.callbacks.onClose(
                this.params.execution.context.symbol,
                scheduled,
                lastPrice,
                this.params.execution.context.backtest
              );
            }

            await this.params.risk.removeSignal(
              this.params.execution.context.symbol,
              {
                strategyName: this.params.method.context.strategyName,
                riskName: this.params.riskName,
              }
            );

            await this.setPendingSignal(null);

            const result: IStrategyBacktestResult = {
              action: "closed",
              signal: scheduled,
              currentPrice: lastPrice,
              closeReason: "time_expired",
              closeTimestamp: candle.timestamp,
              pnl: pnl,
              strategyName: this.params.method.context.strategyName,
              exchangeName: this.params.method.context.exchangeName,
              symbol: this.params.execution.context.symbol,
            };

            if (this.params.callbacks?.onTick) {
              this.params.callbacks.onTick(
                this.params.execution.context.symbol,
                result,
                this.params.execution.context.backtest
              );
            }

            return result;
          }

          // Продолжаем backtest с оставшимися свечами (переходим к обычной логике ниже)
          candles = remainingCandles;
          break;
        }
      }

      // Если scheduled signal не активировался и не отменился - это "cancelled" (не сработал)
      // Позиция НЕ была открыта, поэтому это не time_expired, а именно cancelled
      if (this._scheduledSignal) {
        const lastCandles = candles.slice(-5);
        const lastPrice = GET_AVG_PRICE_FN(lastCandles);
        const closeTimestamp = candles[candles.length - 1].timestamp;

        this.params.logger.info("ClientStrategy backtest scheduled signal not activated (cancelled)", {
          symbol: this.params.execution.context.symbol,
          signalId: scheduled.id,
          closeTimestamp,
          reason: "price never reached priceOpen",
        });

        this._scheduledSignal = null;

        // Cancelled потому что позиция НЕ была открыта (цена не достигла priceOpen)
        const result: IStrategyTickResultCancelled = {
          action: "cancelled",
          signal: scheduled,
          currentPrice: lastPrice,
          closeTimestamp: closeTimestamp,
          strategyName: this.params.method.context.strategyName,
          exchangeName: this.params.method.context.exchangeName,
          symbol: this.params.execution.context.symbol,
        };

        if (this.params.callbacks?.onTick) {
          this.params.callbacks.onTick(
            this.params.execution.context.symbol,
            result,
            this.params.execution.context.backtest
          );
        }

        return result;
      }
    }

    // Обработка обычного pending signal (или после активации scheduled)
    const signal = this._pendingSignal;

    if (!signal) {
      throw new Error("ClientStrategy backtest: no pending signal after scheduled activation");
    }

    // Предупреждение если недостаточно свечей для VWAP
    if (candles.length < 5) {
      this.params.logger.warn(
        `ClientStrategy backtest: Expected at least 5 candles for VWAP, got ${candles.length}`
      );
    }

    // Проверяем каждую свечу на достижение TP/SL
    // Начинаем с индекса 4 (пятая свеча), чтобы было минимум 5 свечей для VWAP
    for (let i = 4; i < candles.length; i++) {
      // Вычисляем VWAP из последних 5 свечей для текущего момента
      const recentCandles = candles.slice(i - 4, i + 1);
      const averagePrice = GET_AVG_PRICE_FN(recentCandles);

      let shouldClose = false;
      let closeReason: StrategyCloseReason | undefined;

      // Проверяем достижение TP/SL для long позиции
      if (signal.position === "long") {
        if (averagePrice >= signal.priceTakeProfit) {
          shouldClose = true;
          closeReason = "take_profit";
        } else if (averagePrice <= signal.priceStopLoss) {
          shouldClose = true;
          closeReason = "stop_loss";
        }
      }

      // Проверяем достижение TP/SL для short позиции
      if (signal.position === "short") {
        if (averagePrice <= signal.priceTakeProfit) {
          shouldClose = true;
          closeReason = "take_profit";
        } else if (averagePrice >= signal.priceStopLoss) {
          shouldClose = true;
          closeReason = "stop_loss";
        }
      }

      // Если достигнут TP/SL, закрываем сигнал
      if (shouldClose) {
        const pnl = toProfitLossDto(signal, averagePrice);
        const closeTimestamp =
          recentCandles[recentCandles.length - 1].timestamp;

        this.params.logger.debug("ClientStrategy backtest closing", {
          symbol: this.params.execution.context.symbol,
          signalId: signal.id,
          reason: closeReason,
          priceClose: averagePrice,
          closeTimestamp,
          pnlPercentage: pnl.pnlPercentage,
        });

        // Предупреждение при убытке от stop_loss
        if (closeReason === "stop_loss") {
          this.params.logger.warn(
            `ClientStrategy backtest: Signal closed with loss (stop_loss), PNL: ${pnl.pnlPercentage.toFixed(
              2
            )}%`
          );
        }

        if (this.params.callbacks?.onClose) {
          this.params.callbacks.onClose(
            this.params.execution.context.symbol,
            signal,
            averagePrice,
            this.params.execution.context.backtest
          );
        }

        // Remove signal from risk management
        await this.params.risk.removeSignal(
          this.params.execution.context.symbol,
          {
            strategyName: this.params.method.context.strategyName,
            riskName: this.params.riskName,
          }
        );

        await this.setPendingSignal(null);

        const result: IStrategyTickResultClosed = {
          action: "closed",
          signal: signal,
          currentPrice: averagePrice,
          closeReason: closeReason,
          closeTimestamp: closeTimestamp,
          pnl: pnl,
          strategyName: this.params.method.context.strategyName,
          exchangeName: this.params.method.context.exchangeName,
          symbol: this.params.execution.context.symbol,
        };

        if (this.params.callbacks?.onTick) {
          this.params.callbacks.onTick(
            this.params.execution.context.symbol,
            result,
            this.params.execution.context.backtest
          );
        }

        return result;
      }
    }

    // Если TP/SL не достигнут за период, вычисляем VWAP из последних 5 свечей
    const lastFiveCandles = candles.slice(-5);
    const lastPrice = GET_AVG_PRICE_FN(lastFiveCandles);
    const closeTimestamp =
      lastFiveCandles[lastFiveCandles.length - 1].timestamp;

    const pnl = toProfitLossDto(signal, lastPrice);

    this.params.logger.debug("ClientStrategy backtest time_expired", {
      symbol: this.params.execution.context.symbol,
      signalId: signal.id,
      priceClose: lastPrice,
      closeTimestamp,
      pnlPercentage: pnl.pnlPercentage,
    });

    // Предупреждение при убытке от time_expired
    if (pnl.pnlPercentage < 0) {
      this.params.logger.warn(
        `ClientStrategy backtest: Signal closed with loss (time_expired), PNL: ${pnl.pnlPercentage.toFixed(
          2
        )}%`
      );
    }

    if (this.params.callbacks?.onClose) {
      this.params.callbacks.onClose(
        this.params.execution.context.symbol,
        signal,
        lastPrice,
        this.params.execution.context.backtest
      );
    }

    // Remove signal from risk management
    await this.params.risk.removeSignal(
      this.params.execution.context.symbol,
      {
        strategyName: this.params.method.context.strategyName,
        riskName: this.params.riskName,
      }
    );

    await this.setPendingSignal(null);

    const result: IStrategyTickResultClosed = {
      action: "closed",
      signal: signal,
      currentPrice: lastPrice,
      closeReason: "time_expired",
      closeTimestamp: closeTimestamp,
      pnl: pnl,
      strategyName: this.params.method.context.strategyName,
      exchangeName: this.params.method.context.exchangeName,
      symbol: this.params.execution.context.symbol,
    };

    if (this.params.callbacks?.onTick) {
      this.params.callbacks.onTick(
        this.params.execution.context.symbol,
        result,
        this.params.execution.context.backtest
      );
    }

    return result;
  }

  /**
   * Stops the strategy from generating new signals.
   *
   * Sets internal flag to prevent getSignal from being called.
   * Does NOT close active pending signals - they continue monitoring until TP/SL/time_expired.
   *
   * Use case: Graceful shutdown in live trading without forcing position closure.
   *
   * @returns Promise that resolves immediately when stop flag is set
   *
   * @example
   * ```typescript
   * // In Live.background() cancellation
   * await strategy.stop();
   * // Existing signal will continue until natural close
   * ```
   */
  public stop(): Promise<void> {
    this.params.logger.debug("ClientStrategy stop", {
      hasPendingSignal: this._pendingSignal !== null,
    });

    this._isStopped = true;

    return Promise.resolve();
  }
}

export default ClientStrategy;
