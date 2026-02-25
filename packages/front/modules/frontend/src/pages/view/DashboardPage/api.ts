import { fetchApi, randomString, singleshot } from "react-declarative";
import ITradePerfomance from "../../../model/TradePerfomance.model";
import ISuccessRate from "../../../model/SuccessRate.model";
import IDailyTrades from "../../../model/DailyTrades.model";
import IRevenueCount from "../../../model/RevenueCount.model";

export const fetchSymbolMap = singleshot(async (): Promise<Record<string, any>> => {
  const { error, data } = await fetchApi("/dict/symbol/map", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("tradegpt-token")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: randomString(),
      serviceName: "kpi-app",
    }),
  });
  if (error) {
    throw new Error(error);
  }
  return data;
});

export const fetchSymbolList = singleshot(async (): Promise<string[]> => {
  const { error, data } = await fetchApi("/dict/symbol/list", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("tradegpt-token")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: randomString(),
      serviceName: "kpi-app",
    }),
  });
  if (error) {
    throw new Error(error);
  }
  return data;
});

export const fetchTradePerfomanceMeasure = async (symbol: string): Promise<ITradePerfomance> => {
  const { error, data } = await fetchApi(`/report/trade_perfomance/${symbol}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: randomString(),
      serviceName: "kpi-app",
      symbol: String(symbol).toUpperCase(),
    }),
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

export const fetchSuccessRateMeasure = async (symbol: string): Promise<ISuccessRate> => {
  const { error, data } = await fetchApi(`/report/success_rate/${symbol}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: randomString(),
      serviceName: "kpi-app",
      symbol: String(symbol).toUpperCase(),
    }),
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

export const fetchDailyTradesMeasure = async (symbol: string): Promise<IDailyTrades[]> => {
  const { error, data } = await fetchApi(`/report/daily_trades/${symbol}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: randomString(),
      serviceName: "kpi-app",
      symbol: String(symbol).toUpperCase(),
    }),
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

export const fetchRevenueCountMeasure = async (symbol: string): Promise<IRevenueCount> => {
  const { error, data } = await fetchApi(`/report/revenue_count/${symbol}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: randomString(),
      serviceName: "kpi-app",
      symbol: String(symbol).toUpperCase(),
    }),
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

/**
 * Fetch dump logs for execution ID
 */
export const fetchDump = async (executionId: string): Promise<string | null> => {
  const { error, data } = await fetchApi(`/dump/${executionId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("tradegpt-token")}`,
    },
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

/**
 * Fetch candle data by signal ID
 */
export const fetchAllCandleBySignal = async (signalId: string): Promise<any> => {
  const { error, data } = await fetchApi(`/candle/by_signal/${signalId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("tradegpt-token")}`,
    },
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

/**
 * Fetch close decisions by signal ID
 */
export const fetchAllCloseBySignal = async (signalId: string): Promise<any[]> => {
  const { error, data } = await fetchApi(`/close/by_signal/${signalId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("tradegpt-token")}`,
    },
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

/**
 * Fetch confirm history by signal ID
 */
export const fetchAllConfirmBySignal = async (signalId: string): Promise<any[]> => {
  const { error, data } = await fetchApi(`/confirm/by_signal/${signalId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("tradegpt-token")}`,
    },
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

/**
 * Fetch risk assessments by signal ID
 */
export const fetchAllRiskBySignal = async (signalId: string): Promise<any[]> => {
  const { error, data } = await fetchApi(`/risk/by_signal/${signalId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${localStorage.getItem("tradegpt-token")}`,
    },
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};
