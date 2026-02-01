import {
  useActualState,
  useModalManager,
  useTabsModal,
  History,
  useActualRef,
  ActionIcon,
} from "react-declarative";
import { ArrowBack, Close, Download } from "@mui/icons-material";
import { createMemoryHistory } from "history";
import routes from "./routes";
import { CC_FULLSCREEN_SIZE_REQUEST } from "../../config/params";
import tabs from "./tabs";
import { Box, Stack } from "@mui/material";
import ioc from "../../lib";
import {
  SignalOpenedNotification,
  SignalClosedNotification,
  SignalScheduledNotification,
  SignalCancelledNotification,
} from "backtest-kit";

type SignalNotification =
  | SignalOpenedNotification
  | SignalClosedNotification
  | SignalScheduledNotification
  | SignalCancelledNotification;

const VALID_SIGNAL_NOTIFICATION_TYPES = [
  "signal.opened",
  "signal.closed",
  "signal.scheduled",
  "signal.cancelled",
] as const;

const DEFAULT_PATH = "/signal_notification";

const history = createMemoryHistory();

const fetchData = async (id: string) => {
  const notificationData = await ioc.notificationViewService.getOne(id) as SignalNotification;

  if (!notificationData) {
    throw new Error("Signal notification data not found");
  }

  if (!VALID_SIGNAL_NOTIFICATION_TYPES.includes(notificationData.type as any)) {
    throw new Error(
      `Invalid notification data type: expected one of ${VALID_SIGNAL_NOTIFICATION_TYPES.join(", ")}, got ${notificationData.type}`
    );
  }

  return {
    notification: notificationData,
    candle_1m: await ioc.exchangeViewService.getPointCandles({
      currentTime: notificationData.timestamp,
      exchangeName: notificationData.exchangeName,
      interval: "1m",
      symbol: notificationData.symbol,
    }),
    candle_15m: await ioc.exchangeViewService.getPointCandles({
      currentTime: notificationData.timestamp,
      exchangeName: notificationData.exchangeName,
      interval: "15m",
      symbol: notificationData.symbol,
    }),
    candle_1h: await ioc.exchangeViewService.getPointCandles({
      currentTime: notificationData.timestamp,
      exchangeName: notificationData.exchangeName,
      interval: "1h",
      symbol: notificationData.symbol,
    }),
  };
};

const handleDownload = async (pathname: string, id: string) => {
  const { candle_15m, candle_1h, candle_1m, notification } = await fetchData(id);

  if (pathname.includes("/signal_notification")) {
    const blob = new Blob([JSON.stringify(notification, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    ioc.layoutService.downloadFile(url, `signal_notification_${notification.signalId || "unknown"}.json`);
    return;
  }

  if (pathname.includes("/candle_1m")) {
    const blob = new Blob([JSON.stringify(candle_1m, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    ioc.layoutService.downloadFile(url, `candles_1m_${notification.signalId || "unknown"}.json`);
    return;
  }

  if (pathname.includes("/candle_15m")) {
    const blob = new Blob([JSON.stringify(candle_15m, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    ioc.layoutService.downloadFile(url, `candles_15m_${notification.signalId || "unknown"}.json`);
    return;
  }

  if (pathname.includes("/candle_1h")) {
    const blob = new Blob([JSON.stringify(candle_1h, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    ioc.layoutService.downloadFile(url, `candles_1h_${notification.signalId || "unknown"}.json`);
    return;
  }
};

export const useSignalNotificationView = () => {
  const [id$, setId] = useActualState("");
  const ctx = useModalManager();
  const { push, pop } = ctx;

  const [pathname$, setPathname] = useActualRef(history.location.pathname);

  const handleTabChange = (id: string, history: History) => {
    if (id === "signal_notification") {
      history.replace(`/signal_notification`);
      setPathname(`/signal_notification`);
    }
    if (id === "candle_1m") {
      history.replace(`/candle_1m`);
      setPathname(`/candle_1m`);
    }
    if (id === "candle_15m") {
      history.replace(`/candle_15m`);
      setPathname(`/candle_15m`);
    }
    if (id === "candle_1h") {
      history.replace(`/candle_1h`);
      setPathname(`/candle_1h`);
    }
  };

  const { pickData, render } = useTabsModal({
    tabs,
    withStaticAction: true,
    onTabChange: handleTabChange,
    animation: "none",
    title: "Signal Notification Details",
    sizeRequest: CC_FULLSCREEN_SIZE_REQUEST,
    history,
    routes,
    BeforeTitle: ({ onClose }) => {
      const { total } = useModalManager();
      return (
        <Box
          sx={{
            mr: 1,
            display: total === 1 ? "none" : "flex",
          }}
        >
          <ActionIcon onClick={onClose}>
            <ArrowBack />
          </ActionIcon>
        </Box>
      );
    },
    AfterTitle: ({ onClose }) => (
      <Stack direction="row" gap={1}>
        <ActionIcon onClick={() => handleDownload(pathname$.current, id$.current)}>
          <Download />
        </ActionIcon>
        <ActionIcon onClick={onClose}>
          <Close />
        </ActionIcon>
      </Stack>
    ),
    fetchState: async () => await fetchData(id$.current),
    mapInitialData: ([{ notification, ...other }]) => ({
      main: notification,
      notification,
      ...other,
    }),
    mapPayload: ([{ candle_1m = [], candle_15m = [], candle_1h = [] }]) => {
      return {
        candle_1m,
        candle_15m,
        candle_1h,
      };
    },
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    onClose: () => {
      pop();
    },
  });

  return (id: string, route = DEFAULT_PATH) => {
    push({
      id: "signal_notification_modal",
      render,
      onInit: () => {
        history.push(route);
        setPathname(route);
      },
      onMount: () => {
        setId(id);
        pickData();
      },
    });
  };
};

export default useSignalNotificationView;
