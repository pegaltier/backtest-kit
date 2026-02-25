import IDailyTrades from "./DailyTrades.model";
import IRevenueCount from "./RevenueCount.model";
import ISuccessRate from "./SuccessRate.model";
import ITradePerfomance from "./TradePerfomance.model";

export interface ISuccessRateWithSymbol extends ISuccessRate {
    displayName: string;
    symbol: string;
}

export interface IMeasure {
    dailyTrades: IDailyTrades[];
    successRate: ISuccessRateWithSymbol[];
    tradePerfomance: ITradePerfomance;
    revenueCount: IRevenueCount;
}

export default IMeasure;
