import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import ActionConnectionService from "../connection/ActionConnectionService";
import { IAction, ActionName } from "../../../interfaces/Action.interface";
import { memoize } from "functools-kit";
import ActionValidationService from "../validation/ActionValidationService";
import ExchangeValidationService from "../validation/ExchangeValidationService";
import FrameValidationService from "../validation/FrameValidationService";
import { ExchangeName } from "../../../interfaces/Exchange.interface";
import { FrameName } from "../../../interfaces/Frame.interface";
import { StrategyName } from "../../../interfaces/Strategy.interface";
import { IStrategyTickResult } from "../../../interfaces/Strategy.interface";
import { BreakevenContract } from "../../../contract/Breakeven.contract";
import { PartialProfitContract } from "../../../contract/PartialProfit.contract";
import { PartialLossContract } from "../../../contract/PartialLoss.contract";
import { PingContract } from "../../../contract/Ping.contract";
import { RiskContract } from "../../../contract/Risk.contract";

/**
 * Type definition for action methods.
 * Maps all keys of IAction to any type.
 * Used for dynamic method routing in ActionGlobalService.
 */
type TAction = {
  [key in keyof IAction]: any;
};

/**
 * Global service for action operations.
 *
 * Wraps ActionConnectionService for action event routing.
 * Used internally by strategy execution and public API.
 */
export class ActionGlobalService implements TAction {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly actionConnectionService = inject<ActionConnectionService>(
    TYPES.actionConnectionService
  );
  private readonly actionValidationService = inject<ActionValidationService>(
    TYPES.actionValidationService
  );
  private readonly exchangeValidationService = inject<ExchangeValidationService>(
    TYPES.exchangeValidationService
  );
  private readonly frameValidationService = inject<FrameValidationService>(
    TYPES.frameValidationService
  );

  /**
   * Validates action configuration.
   * Memoized to avoid redundant validations for the same action-exchange-frame combination.
   * Logs validation activity.
   * @param payload - Payload with actionName, exchangeName and frameName
   * @returns Promise that resolves when validation is complete
   */
  private validate = memoize(
    ([payload]) => `${payload.actionName}:${payload.exchangeName}:${payload.frameName}`,
    async (payload: { actionName: ActionName; exchangeName: ExchangeName; frameName: FrameName }) => {
      this.loggerService.log("actionGlobalService validate", {
        payload,
      });
      this.actionValidationService.validate(
        payload.actionName,
        "actionGlobalService validate"
      );
      this.exchangeValidationService.validate(
        payload.exchangeName,
        "actionGlobalService validate"
      );
      payload.frameName && this.frameValidationService.validate(payload.frameName, "actionGlobalService validate");
    }
  );

  /**
   * Routes signal event to appropriate ClientAction instance.
   *
   * @param event - Signal event data
   * @param payload - Execution payload with action name, strategy name, exchange name, frame name and backtest mode
   */
  public signal = async (
    event: IStrategyTickResult,
    payload: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ) => {
    this.loggerService.log("actionGlobalService signal", {
      action: event.action,
      payload,
    });
    await this.validate(payload);
    await this.actionConnectionService.signal(event, payload);
  };

  /**
   * Routes signalLive event to appropriate ClientAction instance.
   *
   * @param event - Signal event data from live trading
   * @param payload - Execution payload with action name, strategy name, exchange name, frame name and backtest mode
   */
  public signalLive = async (
    event: IStrategyTickResult,
    payload: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ) => {
    this.loggerService.log("actionGlobalService signalLive", {
      action: event.action,
      payload,
    });
    await this.validate(payload);
    await this.actionConnectionService.signalLive(event, payload);
  };

  /**
   * Routes signalBacktest event to appropriate ClientAction instance.
   *
   * @param event - Signal event data from backtest
   * @param payload - Execution payload with action name, strategy name, exchange name, frame name and backtest mode
   */
  public signalBacktest = async (
    event: IStrategyTickResult,
    payload: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ) => {
    this.loggerService.log("actionGlobalService signalBacktest", {
      action: event.action,
      payload,
    });
    await this.validate(payload);
    await this.actionConnectionService.signalBacktest(event, payload);
  };

  /**
   * Routes breakeven event to appropriate ClientAction instance.
   *
   * @param event - Breakeven event data
   * @param payload - Execution payload with action name, strategy name, exchange name, frame name and backtest mode
   */
  public breakeven = async (
    event: BreakevenContract,
    payload: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ) => {
    this.loggerService.log("actionGlobalService breakeven", {
      payload,
    });
    await this.validate(payload);
    await this.actionConnectionService.breakeven(event, payload);
  };

  /**
   * Routes partialProfit event to appropriate ClientAction instance.
   *
   * @param event - Partial profit event data
   * @param payload - Execution payload with action name, strategy name, exchange name, frame name and backtest mode
   */
  public partialProfit = async (
    event: PartialProfitContract,
    payload: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ) => {
    this.loggerService.log("actionGlobalService partialProfit", {
      payload,
    });
    await this.validate(payload);
    await this.actionConnectionService.partialProfit(event, payload);
  };

  /**
   * Routes partialLoss event to appropriate ClientAction instance.
   *
   * @param event - Partial loss event data
   * @param payload - Execution payload with action name, strategy name, exchange name, frame name and backtest mode
   */
  public partialLoss = async (
    event: PartialLossContract,
    payload: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ) => {
    this.loggerService.log("actionGlobalService partialLoss", {
      payload,
    });
    await this.validate(payload);
    await this.actionConnectionService.partialLoss(event, payload);
  };

  /**
   * Routes ping event to appropriate ClientAction instance.
   *
   * @param event - Ping event data
   * @param payload - Execution payload with action name, strategy name, exchange name, frame name and backtest mode
   */
  public ping = async (
    event: PingContract,
    payload: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ) => {
    this.loggerService.log("actionGlobalService ping", {
      payload,
    });
    await this.validate(payload);
    await this.actionConnectionService.ping(event, payload);
  };

  /**
   * Routes riskRejection event to appropriate ClientAction instance.
   *
   * @param event - Risk rejection event data
   * @param payload - Execution payload with action name, strategy name, exchange name, frame name and backtest mode
   */
  public riskRejection = async (
    event: RiskContract,
    payload: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ) => {
    this.loggerService.log("actionGlobalService riskRejection", {
      payload,
    });
    await this.validate(payload);
    await this.actionConnectionService.riskRejection(event, payload);
  };

  /**
   * Disposes the ClientAction instance.
   *
   * @param payload - Execution payload with action name, strategy name, exchange name, frame name and backtest mode
   */
  public dispose = async (
    payload: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ): Promise<void> => {
    this.loggerService.log("actionGlobalService dispose", {
      payload,
    });
    await this.validate(payload);
    await this.actionConnectionService.dispose(payload);
  };

  /**
   * Clears action data.
   * If payload is provided, clears data for that specific action instance.
   * If no payload is provided, clears all action data.
   * @param payload - Optional payload with actionName, strategyName, exchangeName, frameName, backtest (clears all if not provided)
   */
  public clear = async (
    payload?: { actionName: ActionName; strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName; backtest: boolean }
  ): Promise<void> => {
    this.loggerService.log("actionGlobalService clear", {
      payload,
    });
    if (payload) {
      await this.validate(payload);
    }
    return await this.actionConnectionService.clear(payload);
  };
}

export default ActionGlobalService;
