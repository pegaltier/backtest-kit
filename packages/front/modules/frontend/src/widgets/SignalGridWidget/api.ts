import { fetchApi, randomString } from "react-declarative";

export const commitCloseSignal = async (signalId: string, comment: string): Promise<void> => {
  const { error, data } = await fetchApi(`/state/signal/close`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: randomString(),
      serviceName: "kpi-app",
      signalId,
      comment,
    }),
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

export const commitRemoveSignal = async (signalId: string, comment: string): Promise<void> => {
  const { error, data } = await fetchApi(`/state/signal/remove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requestId: randomString(),
      serviceName: "kpi-app",
      signalId,
      comment,
    }),
  });
  if (error) {
    throw new Error(error);
  }
  return data;
};

