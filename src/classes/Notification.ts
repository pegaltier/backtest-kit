import { singleshot, randomString, errorData, getErrorMessage } from "functools-kit";
import {
  signalEmitter,
  partialProfitSubject,
  partialLossSubject,
  riskSubject,
  doneLiveSubject,
  doneBacktestSubject,
  errorEmitter,
  exitEmitter,
  validationSubject,
  progressBacktestEmitter,
} from "../config/emitters";
import { NotificationModel } from "../model/Notification.model";
import { IStrategyTickResult } from "../interfaces/Strategy.interface";
import { PartialProfitContract } from "../contract/PartialProfit.contract";
import { PartialLossContract } from "../contract/PartialLoss.contract";
import { RiskContract } from "../contract/Risk.contract";
import { DoneContract } from "../contract/Done.contract";
import { ProgressBacktestContract } from "../contract/ProgressBacktest.contract";

/** Maximum number of notifications to store in history */
const MAX_NOTIFICATIONS = 250;

/** Function to create unique notification IDs */
const CREATE_KEY_FN = () => randomString();

/**
 * Instance class for notification history management.
 *
 * Contains all business logic for notification collection from emitters/subjects.
 * Stores notifications in chronological order with automatic limit management.
 *
 * @example
 * ```typescript
 * const instance = new NotificationInstance();
 * await instance.waitForInit();
 *
 * // Get all notifications
 * const all = instance.getData();
 *
 * // Process notifications with type discrimination
 * all.forEach(notification => {
 *   switch (notification.type) {
 *     case "signal.closed":
 *       console.log(`Closed: ${notification.pnlPercentage}%`);
 *       break;
 *     case "partial.loss":
 *       if (notification.level >= 30) {
 *         alert("High loss!");
 *       }
 *       break;
 *     case "risk.rejection":
 *       console.warn(notification.rejectionNote);
 *       break;
 *   }
 * });
 *
 * // Clear history
 * instance.clear();
 * ```
 */
export class NotificationInstance {
  /** Internal notification history storage (newest first) */
  private _notifications: NotificationModel[] = [];

  /**
   * Adds notification to history with automatic limit management.
   */
  private _addNotification(notification: NotificationModel): void {
    this._notifications.unshift(notification);

    // Trim history if exceeded MAX_NOTIFICATIONS
    if (this._notifications.length > MAX_NOTIFICATIONS) {
      this._notifications.pop();
    }
  }

  /**
   * Processes signal events and creates appropriate notifications.
   */
  private _handleSignal = async (data: IStrategyTickResult) => {
    if (data.action === "opened") {
      this._addNotification({
        type: "signal.opened",
        id: CREATE_KEY_FN(),
        timestamp: data.signal.pendingAt,
        backtest: data.backtest,
        symbol: data.symbol,
        strategyName: data.strategyName,
        exchangeName: data.exchangeName,
        signalId: data.signal.id,
        position: data.signal.position,
        priceOpen: data.signal.priceOpen,
        priceTakeProfit: data.signal.priceTakeProfit,
        priceStopLoss: data.signal.priceStopLoss,
        note: data.signal.note,
      });
    } else if (data.action === "closed") {
      const durationMs = data.closeTimestamp - data.signal.pendingAt;
      const durationMin = Math.round(durationMs / 60000);

      this._addNotification({
        type: "signal.closed",
        id: CREATE_KEY_FN(),
        timestamp: data.closeTimestamp,
        backtest: data.backtest,
        symbol: data.symbol,
        strategyName: data.strategyName,
        exchangeName: data.exchangeName,
        signalId: data.signal.id,
        position: data.signal.position,
        priceOpen: data.signal.priceOpen,
        priceClose: data.currentPrice,
        pnlPercentage: data.pnl.pnlPercentage,
        closeReason: data.closeReason,
        duration: durationMin,
        note: data.signal.note,
      });
    } else if (data.action === "scheduled") {
      this._addNotification({
        type: "signal.scheduled",
        id: CREATE_KEY_FN(),
        timestamp: data.signal.scheduledAt,
        backtest: data.backtest,
        symbol: data.symbol,
        strategyName: data.strategyName,
        exchangeName: data.exchangeName,
        signalId: data.signal.id,
        position: data.signal.position,
        priceOpen: data.signal.priceOpen,
        scheduledAt: data.signal.scheduledAt,
        currentPrice: data.currentPrice,
      });
    } else if (data.action === "cancelled") {
      const durationMs = data.closeTimestamp - data.signal.scheduledAt;
      const durationMin = Math.round(durationMs / 60000);

      this._addNotification({
        type: "signal.cancelled",
        id: CREATE_KEY_FN(),
        timestamp: data.closeTimestamp,
        backtest: data.backtest,
        symbol: data.symbol,
        strategyName: data.strategyName,
        exchangeName: data.exchangeName,
        signalId: data.signal.id,
        position: data.signal.position,
        cancelReason: data.reason,
        cancelId: data.cancelId,
        duration: durationMin,
      });
    }
  };

  /**
   * Processes partial profit events.
   */
  private _handlePartialProfit = async (data: PartialProfitContract) => {
    this._addNotification({
      type: "partial.profit",
      id: CREATE_KEY_FN(),
      timestamp: data.timestamp,
      backtest: data.backtest,
      symbol: data.symbol,
      strategyName: data.strategyName,
      exchangeName: data.exchangeName,
      signalId: data.data.id,
      level: data.level,
      currentPrice: data.currentPrice,
      priceOpen: data.data.priceOpen,
      position: data.data.position,
    });
  };

  /**
   * Processes partial loss events.
   */
  private _handlePartialLoss = async (data: PartialLossContract) => {
    this._addNotification({
      type: "partial.loss",
      id: CREATE_KEY_FN(),
      timestamp: data.timestamp,
      backtest: data.backtest,
      symbol: data.symbol,
      strategyName: data.strategyName,
      exchangeName: data.exchangeName,
      signalId: data.data.id,
      level: data.level,
      currentPrice: data.currentPrice,
      priceOpen: data.data.priceOpen,
      position: data.data.position,
    });
  };

  /**
   * Processes risk rejection events.
   */
  private _handleRisk = async (data: RiskContract) => {
    this._addNotification({
      type: "risk.rejection",
      id: CREATE_KEY_FN(),
      timestamp: data.timestamp,
      backtest: data.backtest,
      symbol: data.symbol,
      strategyName: data.strategyName,
      exchangeName: data.exchangeName,
      rejectionNote: data.rejectionNote,
      rejectionId: data.rejectionId,
      activePositionCount: data.activePositionCount,
      currentPrice: data.currentPrice,
      pendingSignal: data.pendingSignal,
    });
  };

  /**
   * Processes done events (live/backtest).
   */
  private _handleDoneLive = async (data: DoneContract) => {
    this._addNotification({
      type: "live.done",
      id: CREATE_KEY_FN(),
      timestamp: Date.now(),
      backtest: false,
      symbol: data.symbol,
      strategyName: data.strategyName,
      exchangeName: data.exchangeName,
    });
  };

  /**
   * Processes done events (backtest).
   */
  private _handleDoneBacktest = async (data: DoneContract) => {
    this._addNotification({
      type: "backtest.done",
      id: CREATE_KEY_FN(),
      timestamp: Date.now(),
      backtest: true,
      symbol: data.symbol,
      strategyName: data.strategyName,
      exchangeName: data.exchangeName,
    });
  };

  /**
   * Processes error events.
   */
  private _handleError = async (error: Error) => {
    this._addNotification({
      type: "error.info",
      id: CREATE_KEY_FN(),
      timestamp: Date.now(),
      error: errorData(error),
      message: getErrorMessage(error),
      backtest: false,
    });
  };

  /**
   * Processes critical error events.
   */
  private _handleCriticalError = async (error: Error) => {
    this._addNotification({
      type: "error.critical",
      id: CREATE_KEY_FN(),
      timestamp: Date.now(),
      error: errorData(error),
      message: getErrorMessage(error),
      backtest: false,
    });
  };

  /**
   * Processes validation error events.
   */
  private _handleValidationError = async (error: Error) => {
    this._addNotification({
      type: "error.validation",
      id: CREATE_KEY_FN(),
      timestamp: Date.now(),
      error: errorData(error),
      message: getErrorMessage(error),
      backtest: false,
    });
  };

  /**
   * Processes progress events.
   */
  private _handleProgressBacktest = async (data: ProgressBacktestContract) => {
    this._addNotification({
      type: "progress.backtest",
      id: CREATE_KEY_FN(),
      timestamp: Date.now(),
      backtest: true,
      exchangeName: data.exchangeName,
      strategyName: data.strategyName,
      symbol: data.symbol,
      totalFrames: data.totalFrames,
      processedFrames: data.processedFrames,
      progress: data.progress,
    });
  };

  /**
   * Returns all notifications in chronological order (newest first).
   *
   * @returns Array of strongly-typed notification objects
   *
   * @example
   * ```typescript
   * const notifications = instance.getData();
   *
   * notifications.forEach(notification => {
   *   switch (notification.type) {
   *     case "signal.closed":
   *       console.log(`${notification.symbol}: ${notification.pnlPercentage}%`);
   *       break;
   *     case "partial.loss":
   *       if (notification.level >= 30) {
   *         console.warn(`High loss: ${notification.symbol}`);
   *       }
   *       break;
   *   }
   * });
   * ```
   */
  public getData(): NotificationModel[] {
    return [...this._notifications];
  }

  /**
   * Clears all notification history.
   *
   * @example
   * ```typescript
   * instance.clear();
   * ```
   */
  public clear(): void {
    this._notifications = [];
  }

  /**
   * Initializes notification system by subscribing to all emitters.
   * Uses singleshot to ensure initialization happens only once.
   * Automatically called on first use.
   */
  public waitForInit = singleshot(async () => {
    // Add bootstrap notification to mark initialization
    this._addNotification({
      type: "bootstrap",
      id: CREATE_KEY_FN(),
      timestamp: Date.now(),
    });

    // Signal events
    signalEmitter.subscribe(this._handleSignal);

    // Partial profit/loss events
    partialProfitSubject.subscribe(this._handlePartialProfit);
    partialLossSubject.subscribe(this._handlePartialLoss);

    // Risk events
    riskSubject.subscribe(this._handleRisk);

    // Done events
    doneLiveSubject.subscribe(this._handleDoneLive);
    doneBacktestSubject.subscribe(this._handleDoneBacktest);

    // Error events
    errorEmitter.subscribe(this._handleError);
    exitEmitter.subscribe(this._handleCriticalError);
    validationSubject.subscribe(this._handleValidationError);

    // Progress events
    progressBacktestEmitter.subscribe(this._handleProgressBacktest);
  });
}

/**
 * Public facade for notification operations.
 *
 * Automatically calls waitForInit on each userspace method call.
 * Provides simplified access to notification instance methods.
 *
 * @example
 * ```typescript
 * import { Notification } from "./classes/Notification";
 *
 * // Get all notifications
 * const all = await Notification.getData();
 *
 * // Process notifications with type discrimination
 * all.forEach(notification => {
 *   switch (notification.type) {
 *     case "signal.closed":
 *       console.log(`Closed: ${notification.pnlPercentage}%`);
 *       break;
 *     case "partial.loss":
 *       if (notification.level >= 30) {
 *         alert("High loss!");
 *       }
 *       break;
 *     case "risk.rejection":
 *       console.warn(notification.rejectionNote);
 *       break;
 *   }
 * });
 *
 * // Clear history
 * await Notification.clear();
 * ```
 */
export class NotificationUtils {
  /** Internal instance containing business logic */
  private _instance = new NotificationInstance();

  /**
   * Returns all notifications in chronological order (newest first).
   *
   * @returns Array of strongly-typed notification objects
   *
   * @example
   * ```typescript
   * const notifications = await Notification.getData();
   *
   * notifications.forEach(notification => {
   *   switch (notification.type) {
   *     case "signal.closed":
   *       console.log(`${notification.symbol}: ${notification.pnlPercentage}%`);
   *       break;
   *     case "partial.loss":
   *       if (notification.level >= 30) {
   *         console.warn(`High loss: ${notification.symbol}`);
   *       }
   *       break;
   *   }
   * });
   * ```
   */
  public async getData(): Promise<NotificationModel[]> {
    await this._instance.waitForInit();
    return this._instance.getData();
  }

  /**
   * Clears all notification history.
   *
   * @example
   * ```typescript
   * await Notification.clear();
   * ```
   */
  public async clear(): Promise<void> {
    await this._instance.waitForInit();
    this._instance.clear();
  }
}

/**
 * Singleton instance of NotificationUtils for convenient notification access.
 *
 * @example
 * ```typescript
 * import { Notification } from "./classes/Notification";
 *
 * // Get all notifications
 * const all = await Notification.getData();
 *
 * // Filter by type using type discrimination
 * const closedSignals = all.filter(n => n.type === "signal.closed");
 * const highLosses = all.filter(n =>
 *   n.type === "partial.loss" && n.level >= 30
 * );
 *
 * // Clear history
 * await Notification.clear();
 * ```
 */
export const Notification = new NotificationUtils();
