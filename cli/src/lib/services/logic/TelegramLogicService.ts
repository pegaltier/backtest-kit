import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import { singleshot } from "functools-kit";
import { getTelegram } from "src/config/telegram";

const STOP_BOT_FN = singleshot(async () => {
  const { stopBot } = await getTelegram();
  stopBot();
});

export class TelegramLogicService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public connect = singleshot(() => {
    this.loggerService.log("telegramLogicService connect");

    return () => {
      STOP_BOT_FN();
    };
  });
}

export default TelegramLogicService;
