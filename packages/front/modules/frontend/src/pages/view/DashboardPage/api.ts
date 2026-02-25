import { IStorageSignalRow } from "backtest-kit";
import ITradePerfomance from "../../../model/TradePerfomance.model";
import ISuccessRate from "../../../model/SuccessRate.model";
import IDailyTrades from "../../../model/DailyTrades.model";
import IRevenueCount from "../../../model/RevenueCount.model";
import ioc from "../../../lib";
import { dayjs, getMomentStamp } from "react-declarative";

type Mode = "live" | "backtest";
type ClosedSignal = Extract<IStorageSignalRow, { status: "closed" }>;

// Кэш промисов — общая загрузка на один цикл execute
const _signalCache = new Map<Mode, Promise<IStorageSignalRow[]>>();

const getSignals = (mode: Mode): Promise<IStorageSignalRow[]> => {
  if (!_signalCache.has(mode)) {
    const promise =
      mode === "live"
        ? ioc.storageViewService.listSignalLive()
        : ioc.storageViewService.listSignalBacktest();
    _signalCache.set(mode, promise);
  }
  return _signalCache.get(mode)!;
};

/** Сбросить кэш перед принудительным обновлением */
export const clearSignalCache = () => _signalCache.clear();

// ── Символы ──────────────────────────────────────────────────────────────────

export const fetchSymbolList = (): Promise<string[]> =>
  ioc.symbolGlobalService.getSymbolList();

export const fetchSymbolMap = (): Promise<Record<string, any>> =>
  ioc.symbolGlobalService.getSymbolMap();

// ── Вспомогательные ──────────────────────────────────────────────────────────

const getClosedBySymbol = async (symbol: string, mode: Mode): Promise<ClosedSignal[]> => {
  const all = await getSignals(mode);
  return all.filter(
    (s): s is ClosedSignal => s.status === "closed" && s.symbol === symbol
  );
};

// ── Метрики ──────────────────────────────────────────────────────────────────

export const fetchTradePerfomanceMeasure = async (
  symbol: string,
  mode: Mode
): Promise<ITradePerfomance> => {
  const closed = await getClosedBySymbol(symbol, mode);
  return {
    total: closed.length,
    resolvedCount: closed.filter((s) => s.pnl.pnlPercentage > 0).length,
    rejectedCount: closed.filter((s) => s.pnl.pnlPercentage <= 0).length,
  };
};

export const fetchSuccessRateMeasure = async (
  symbol: string,
  mode: Mode
): Promise<ISuccessRate> => {
  const closed = await getClosedBySymbol(symbol, mode);

  // Допуск 0.5% на slippage и комиссии при сравнении с TP/SL
  const TOLERANCE = 0.005;

  const isAtTP = (s: ClosedSignal): boolean =>
    Math.abs(s.pnl.priceClose - s.originalPriceTakeProfit) /
      s.originalPriceTakeProfit <
    TOLERANCE;

  const isAtSL = (s: ClosedSignal): boolean =>
    Math.abs(s.pnl.priceClose - s.originalPriceStopLoss) /
      s.originalPriceStopLoss <
    TOLERANCE;

  return {
    resolvedTakeProfitCount: closed.filter(
      (s) => s.pnl.pnlPercentage > 0 && isAtTP(s)
    ).length,
    rejectedStopLossCount: closed.filter(
      (s) => s.pnl.pnlPercentage <= 0 && isAtSL(s)
    ).length,
    resolvedCloseCount: closed.filter(
      (s) => s.pnl.pnlPercentage > 0 && !isAtTP(s)
    ).length,
    rejectedCloseCount: closed.filter(
      (s) => s.pnl.pnlPercentage <= 0 && !isAtSL(s)
    ).length,
  };
};

export const fetchDailyTradesMeasure = async (
  symbol: string,
  mode: Mode
): Promise<IDailyTrades[]> => {
  const closed = await getClosedBySymbol(symbol, mode);

  const map = new Map<number, { resolved: number; rejected: number }>();

  for (const s of closed) {
    const stamp = getMomentStamp(dayjs(s.updatedAt));
    const current = map.get(stamp) ?? { resolved: 0, rejected: 0 };
    if (s.pnl.pnlPercentage > 0) {
      map.set(stamp, { ...current, resolved: current.resolved + 1 });
    } else {
      map.set(stamp, { ...current, rejected: current.rejected + 1 });
    }
  }

  return Array.from(map.entries()).map(([stamp, { resolved, rejected }]) => ({
    stamp,
    count: resolved + rejected,
    resolved,
    rejected,
  }));
};

export const fetchRevenueCountMeasure = async (
  symbol: string,
  mode: Mode
): Promise<IRevenueCount> => {
  const closed = await getClosedBySymbol(symbol, mode);

  // Точка отсчёта «сегодня» — начало дня самого последнего сигнала.
  // Для бектеста это позволяет корректно считать окна (сегодня/вчера/7д/31д)
  // относительно конца прогона, а не текущей реальной даты.
  const latestUpdatedAt = closed.length
    ? Math.max(...closed.map((s) => s.updatedAt))
    : Date.now();

  const todayStart = dayjs(latestUpdatedAt).startOf("day").valueOf();
  const yesterdayStart = todayStart - 86400000;
  const sevenDaysStart = todayStart - 7 * 86400000;
  const thirtyOneDaysStart = todayStart - 31 * 86400000;

  const isToday = (s: ClosedSignal) => s.updatedAt >= todayStart;
  const isYesterday = (s: ClosedSignal) =>
    s.updatedAt >= yesterdayStart && s.updatedAt < todayStart;
  const isSevenDays = (s: ClosedSignal) => s.updatedAt >= sevenDaysStart;
  const isThirtyOneDays = (s: ClosedSignal) => s.updatedAt >= thirtyOneDaysStart;

  const sumPnl = (arr: ClosedSignal[]) =>
    arr.reduce((acc, s) => acc + s.pnl.pnlPercentage, 0);

  const todaySignals = closed.filter(isToday);
  const yesterdaySignals = closed.filter(isYesterday);
  const sevenDaysSignals = closed.filter(isSevenDays);
  const thirtyOneDaysSignals = closed.filter(isThirtyOneDays);

  return {
    symbol,
    todayRevenue: sumPnl(todaySignals),
    yesterdayRevenue: sumPnl(yesterdaySignals),
    sevenDaysRevenue: sumPnl(sevenDaysSignals),
    thirtyOneDaysRevenue: sumPnl(thirtyOneDaysSignals),
    todayCount: todaySignals.length,
    yesterdayCount: yesterdaySignals.length,
    sevenDaysCount: sevenDaysSignals.length,
    thirtyOneDaysCount: thirtyOneDaysSignals.length,
  };
};
