import { inject } from "../../../lib/core/di";
import LoggerService from "../common/LoggerService";
import { TYPES } from "../../../lib/core/types";
import { IOutlineMessage, json } from "agent-swarm-kit";
import TSignalSchema from "../../../schema/Signal.schema";
import OutlineName from "../../../enum/OutlineName";
import toPlainString from "../../../helpers/toPlainString";

export class OutlinePrivateService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public getCompletion = async (messages: IOutlineMessage[]) => {
    this.loggerService.log("outlinePrivateService getCompletion", {
        messages,
    });
    const { data, resultId, error } = await json<TSignalSchema, IOutlineMessage[]>(
      OutlineName.SignalOutline,
      messages
    );
    if (error) {
      throw new Error(error);
    }
    if (data.position === "wait") {
      return null;
    }
    return {
      id: resultId,
      position: data.position,
      minuteEstimatedTime: +data.minute_estimated_time,
      priceStopLoss: +data.price_stop_loss,
      priceTakeProfit: +data.price_take_profit,
      note: await toPlainString(data.risk_note),
      priceOpen: +data.price_open,
    };
  };
}

export default OutlinePrivateService;
