import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import { compose, singleshot } from "functools-kit";
import { getTelegram } from "src/config/telegram";
import {
  BreakevenCommit,
  IStrategyTickResultCancelled,
  IStrategyTickResultClosed,
  IStrategyTickResultOpened,
  IStrategyTickResultScheduled,
  listenSignal,
  listenStrategyCommit,
  PartialLossCommit,
  PartialProfitCommit,
  TrailingStopCommit,
  TrailingTakeCommit,
} from "backtest-kit";

const STOP_BOT_FN = singleshot(async () => {
  const { stopBot } = await getTelegram();
  stopBot();
});

export class TelegramLogicService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  private notifyTrailingTake = async (event: TrailingTakeCommit) => {};

  private notifyTrailingStop = async (event: TrailingStopCommit) => {};

  private notifyBreakeven = async (event: BreakevenCommit) => {};

  private notifyPartialProfit = async (event: PartialProfitCommit) => {};

  private notifyPartialLoss = async (event: PartialLossCommit) => {};

  private notifyScheduled = async (event: IStrategyTickResultScheduled) => {};

  private notifyCancelled = async (event: IStrategyTickResultCancelled) => {};

  private notifyOpened = async (event: IStrategyTickResultOpened) => {};

  private notifyClosed = async (event: IStrategyTickResultClosed) => {};

  public connect = singleshot(() => {
    this.loggerService.log("telegramLogicService connect");

    const unSignal = listenSignal(async (event) => {
      if (event.action === "scheduled") {
        await this.notifyScheduled(event);
        return;
      }
      if (event.action === "cancelled") {
        await this.notifyCancelled(event);
        return;
      }
      if (event.action === "opened") {
        await this.notifyOpened(event);
        return;
      }
      if (event.action === "closed") {
        await this.notifyClosed(event);
        return;
      }
    });

    const unCommit = listenStrategyCommit(async (event) => {
      if (event.action === "trailing-take") {
        await this.notifyTrailingTake(event);
        return;
      }
      if (event.action === "trailing-stop") {
        await this.notifyTrailingStop(event);
        return;
      }
      if (event.action === "breakeven") {
        await this.notifyBreakeven(event);
        return;
      }
      if (event.action === "partial-profit") {
        await this.notifyPartialProfit(event);
        return;
      }
      if (event.action === "partial-loss") {
        await this.notifyPartialLoss(event);
        return;
      }
    });

    const unListen = compose(
      () => unSignal(),
      () => unCommit(),
    );

    return () => {
      STOP_BOT_FN();
      unListen();
    };
  });
}

export default TelegramLogicService;
