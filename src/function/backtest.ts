import backtest from "../lib/index";
import { IStrategyTickResult } from "../interfaces/Strategy.interface";
import Table from "cli-table3";

export interface IBacktestResult {
  symbol: string;
  results: IStrategyTickResult[];
}

export interface IBacktestGUIResult extends IBacktestResult {
  markdown: string;
}

export const runBacktest = async (
  symbol: string,
  timeframes: Date[]
): Promise<IBacktestResult> => {
  const results: IStrategyTickResult[] = [];

  for (const when of timeframes) {
    const result = await backtest.strategyPublicService.tick(
      symbol,
      when,
      true
    );

    // Сохраняем только результаты closed
    if (result.action === "closed") {
      results.push(result);
    }

  }

  return {
    symbol,
    results,
  };
};

export const runBacktestGUI = async (
  symbol: string,
  timeframes: Date[]
): Promise<IBacktestGUIResult> => {
  const backtestResult = await runBacktest(symbol, timeframes);
  const { results } = backtestResult;

  // Создаем markdown таблицу
  const table = new Table({
    head: ["#", "Time", "Action", "Note", "Price", "Reason", "PNL %"],
    style: {
      head: [],
      border: [],
    },
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "|",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "|",
      "right-mid": "",
      middle: "|",
    },
  });

  let totalPnl = 0;
  let winCount = 0;
  let lossCount = 0;

  results.forEach((result, index) => {
    if (result.action === "closed") {
      const pnl = result.pnl.pnlPercentage;
      totalPnl += pnl;

      if (pnl > 0) winCount++;
      else if (pnl < 0) lossCount++;

      const pnlFormatted =
        pnl > 0 ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`;
      const emoji = pnl > 0 ? "🟢" : pnl < 0 ? "🔴" : "⚪";

      table.push([
        index + 1,
        new Date(result.signal.timestamp).toISOString(),
        `${emoji} CLOSED`,
        result.signal.note,
        result.currentPrice.toFixed(2),
        result.closeReason,
        pnlFormatted,
      ]);
    }
  });

  // Добавляем статистику
  const closedCount = results.length;
  table.push([]);
  table.push([
    "TOTAL",
    `${closedCount} trades`,
    `Win: ${winCount}`,
    `Loss: ${lossCount}`,
    "-",
    `WR: ${closedCount > 0 ? ((winCount / closedCount) * 100).toFixed(1) : 0}%`,
    `${totalPnl > 0 ? "+" : ""}${totalPnl.toFixed(2)}%`,
  ]);

  const markdown = table.toString();

  return {
    ...backtestResult,
    markdown,
  };
};

export default { runBacktest, runBacktestGUI };
