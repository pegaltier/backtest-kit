import { StrategyName } from "../interfaces/Strategy.interface";
import { PartialLevel } from "../interfaces/Partial.interface";
import { ExchangeName } from "../interfaces/Exchange.interface";
import { ISignalDto } from "../interfaces/Strategy.interface";

/**
 * Signal opened notification.
 * Emitted when a new trading position is opened.
 */
export interface SignalOpenedNotification {
  type: "signal.opened";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  signalId: string;
  position: "long" | "short";
  priceOpen: number;
  priceTakeProfit: number;
  priceStopLoss: number;
  note?: string;
  /** Unix timestamp in milliseconds when the tick result was created (from candle timestamp in backtest or execution context when in live) */
  createdAt: number;
}

/**
 * Signal closed notification.
 * Emitted when a trading position is closed (TP/SL hit).
 */
export interface SignalClosedNotification {
  type: "signal.closed";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  signalId: string;
  position: "long" | "short";
  priceOpen: number;
  priceClose: number;
  pnlPercentage: number;
  closeReason: string;
  duration: number; // minutes
  note?: string;
  /** Unix timestamp in milliseconds when the tick result was created (from candle timestamp in backtest or execution context when in live) */
  createdAt: number;
}

/**
 * Partial profit notification.
 * Emitted when signal reaches profit level milestone (10%, 20%, etc).
 */
export interface PartialProfitAvailableNotification {
  type: "partial_profit.available";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  signalId: string;
  level: PartialLevel;
  currentPrice: number;
  priceOpen: number;
  position: "long" | "short";
}

/**
 * Partial loss notification.
 * Emitted when signal reaches loss level milestone (-10%, -20%, etc).
 */
export interface PartialLossAvailableNotification {
  type: "partial_loss.available";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  signalId: string;
  level: PartialLevel;
  currentPrice: number;
  priceOpen: number;
  position: "long" | "short";
}

/**
 * Breakeven available notification.
 * Emitted when signal's stop-loss is moved to breakeven (entry price).
 */
export interface BreakevenAvailableNotification {
  type: "breakeven.available";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  signalId: string;
  currentPrice: number;
  priceOpen: number;
  position: "long" | "short";
}

/**
 * Partial profit commit notification.
 * Emitted when partial profit action is executed.
 */
export interface PartialProfitCommitNotification {
  type: "partial_profit.commit";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  percentToClose: number;
  currentPrice: number;
}

/**
 * Partial loss commit notification.
 * Emitted when partial loss action is executed.
 */
export interface PartialLossCommitNotification {
  type: "partial_loss.commit";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  percentToClose: number;
  currentPrice: number;
}

/**
 * Breakeven commit notification.
 * Emitted when breakeven action is executed.
 */
export interface BreakevenCommitNotification {
  type: "breakeven.commit";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  currentPrice: number;
}

/**
 * Trailing stop commit notification.
 * Emitted when trailing stop action is executed.
 */
export interface TrailingStopCommitNotification {
  type: "trailing_stop.commit";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  percentShift: number;
  currentPrice: number;
}

/**
 * Trailing take commit notification.
 * Emitted when trailing take action is executed.
 */
export interface TrailingTakeCommitNotification {
  type: "trailing_take.commit";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  percentShift: number;
  currentPrice: number;
}

/**
 * Risk rejection notification.
 * Emitted when a signal is rejected due to risk management rules.
 */
export interface RiskRejectionNotification {
  type: "risk.rejection";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  rejectionNote: string;
  rejectionId: string | null;
  activePositionCount: number;
  currentPrice: number;
  pendingSignal: ISignalDto;
}

/**
 * Scheduled signal notification.
 * Emitted when a signal is scheduled for future execution.
 */
export interface SignalScheduledNotification {
  type: "signal.scheduled";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  signalId: string;
  position: "long" | "short";
  priceOpen: number;
  scheduledAt: number;
  currentPrice: number;
  /** Unix timestamp in milliseconds when the tick result was created (from candle timestamp in backtest or execution context when in live) */
  createdAt: number;
}

/**
 * Signal cancelled notification.
 * Emitted when a scheduled signal is cancelled before activation.
 */
export interface SignalCancelledNotification {
  type: "signal.cancelled";
  id: string;
  timestamp: number;
  backtest: boolean;
  symbol: string;
  strategyName: StrategyName;
  exchangeName: ExchangeName;
  signalId: string;
  position: "long" | "short";
  cancelReason: string;
  cancelId: string;
  duration: number; // minutes
  /** Unix timestamp in milliseconds when the tick result was created (from candle timestamp in backtest or execution context when in live) */
  createdAt: number;
}

/**
 * Error notification.
 * Emitted for recoverable errors in background tasks.
 */
export interface InfoErrorNotification {
  type: "error.info";
  id: string;
  error: object;
  message: string;
  timestamp: number;
  backtest: boolean;
}

/**
 * Critical error notification.
 * Emitted for fatal errors requiring process termination.
 */
export interface CriticalErrorNotification {
  type: "error.critical";
  id: string;
  error: object;
  message: string;
  timestamp: number;
  backtest: boolean;
}

/**
 * Validation error notification.
 * Emitted when risk validation functions throw errors.
 */
export interface ValidationErrorNotification {
  type: "error.validation";
  id: string;
  error: object;
  message: string;
  timestamp: number;
  backtest: boolean;
}

/**
 * Root discriminated union of all notification types.
 * Type discrimination is done via the `type` field.
 *
 * @example
 * ```typescript
 * function handleNotification(notification: NotificationModel) {
 *   switch (notification.type) {
 *     case "signal.opened":
 *       console.log(`Position opened: ${notification.signalId}`);
 *       break;
 *     case "signal.closed":
 *       console.log(`PNL: ${notification.pnlPercentage}%`);
 *       break;
 *     case "partial.loss":
 *       if (notification.level >= 30) {
 *         console.warn("High loss alert!");
 *       }
 *       break;
 *     case "risk.rejection":
 *       console.error(`Signal rejected: ${notification.rejectionNote}`);
 *       break;
 *   }
 * }
 * ```
 */
export type NotificationModel =
  | SignalOpenedNotification
  | SignalClosedNotification
  | PartialProfitAvailableNotification
  | PartialLossAvailableNotification
  | BreakevenAvailableNotification
  | PartialProfitCommitNotification
  | PartialLossCommitNotification
  | BreakevenCommitNotification
  | TrailingStopCommitNotification
  | TrailingTakeCommitNotification
  | RiskRejectionNotification
  | SignalScheduledNotification
  | SignalCancelledNotification
  | InfoErrorNotification
  | CriticalErrorNotification
  | ValidationErrorNotification;

export default NotificationModel;
