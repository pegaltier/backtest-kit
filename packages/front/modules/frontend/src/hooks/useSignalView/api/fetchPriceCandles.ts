import { fetchApi, randomString } from "react-declarative";

export const fetchPriceCandles = async (symbol: string, source: string) => {
  const { error, data } = await fetchApi(`/price_candles_${source}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: randomString(),
      serviceName: "kpi-app",
      symbol: String(symbol).toUpperCase(),
      source,
    }),
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};
