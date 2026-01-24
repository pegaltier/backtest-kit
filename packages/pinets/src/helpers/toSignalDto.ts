import { ISignalDto } from "backtest-kit";
import { randomString } from "functools-kit";

type ResultId = string | number;

interface SignalData {
  position: number;
  priceOpen: number;
  priceTakeProfit: number;
  priceStopLoss: number;
  minuteEstimatedTime: number;
}

interface Signal extends ISignalDto {
  id: string;
}

export function toSignalDto(id: ResultId, data: SignalData): Signal | null {
  if (data.position === 1) {
    return {
      id: String(id),
      position: "long",
      priceOpen: data.priceOpen,
      priceTakeProfit: data.priceTakeProfit,
      priceStopLoss: data.priceStopLoss,
      minuteEstimatedTime: data.minuteEstimatedTime,
    };
  }

  if (data.position === -1) {
    return {
      id: String(id),
      position: "short",
      priceOpen: data.priceOpen,
      priceTakeProfit: data.priceTakeProfit,
      priceStopLoss: data.priceStopLoss,
      minuteEstimatedTime: data.minuteEstimatedTime,
    };
  }

  return null;
}

export default toSignalDto;
