import backtest from "../lib/index";
import { IStrategyTickResult } from "../interfaces/Strategy.interface";
import Table from "cli-table3";

export interface IBacktestResult {
  symbol: string;
  results: IStrategyTickResult[];
}

export async function runBacktest(
  symbol: string,
  timeframes: Date[]
): Promise<IBacktestResult> {
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
}

export default { runBacktest };
