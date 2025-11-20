import { ISignalRow, IStrategyPnL } from "../interfaces/Strategy.interface";

const PERCENT_SLIPPAGE = 0.1;
const PERCENT_FEE = 0.1;

export const toProfitLossDto = (
  signal: ISignalRow,
  priceClose: number
): IStrategyPnL => {
  const priceOpen = signal.priceOpen;

  let priceOpenWithSlippage: number;
  let priceCloseWithSlippage: number;

  if (signal.position === "long") {
    // LONG: покупаем дороже, продаем дешевле
    priceOpenWithSlippage = priceOpen * (1 + PERCENT_SLIPPAGE / 100);
    priceCloseWithSlippage = priceClose * (1 - PERCENT_SLIPPAGE / 100);
  } else {
    // SHORT: продаем дешевле, покупаем дороже
    priceOpenWithSlippage = priceOpen * (1 - PERCENT_SLIPPAGE / 100);
    priceCloseWithSlippage = priceClose * (1 + PERCENT_SLIPPAGE / 100);
  }

  // Применяем комиссию дважды (при открытии и закрытии)
  const totalFee = PERCENT_FEE * 2;

  let pnlPercentage: number;

  if (signal.position === "long") {
    // LONG: прибыль при росте цены
    pnlPercentage =
      ((priceCloseWithSlippage - priceOpenWithSlippage) /
        priceOpenWithSlippage) *
      100;
  } else {
    // SHORT: прибыль при падении цены
    pnlPercentage =
      ((priceOpenWithSlippage - priceCloseWithSlippage) /
        priceOpenWithSlippage) *
      100;
  }

  // Вычитаем комиссии
  pnlPercentage -= totalFee;

  return {
    pnlPercentage,
    priceOpen,
    priceClose,
  };
};

export default toProfitLossDto;
