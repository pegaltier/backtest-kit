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
import { BreakevenAvailableNotification, BreakevenCommitNotification } from "backtest-kit";

type BreakevenNotification = BreakevenAvailableNotification | BreakevenCommitNotification;

const DEFAULT_PATH = "/breakeven";

const history = createMemoryHistory();

const fetchData = async (id: string) => {

  const breakevenData = await ioc.notificationViewService.getOne(id) as BreakevenNotification;

  if (!breakevenData) {
    throw new Error("Breakeven data not found");
  }

  if (breakevenData.type !== "breakeven.available" && breakevenData.type !== "breakeven.commit") {
    throw new Error(`Invalid notification data type: expected 'breakeven.available' or 'breakeven.commit', got ${breakevenData.type}`);
  }

  return {
    breakeven: breakevenData,
    candle_1m: await ioc.exchangeViewService.getPointCandles({
      currentTime: breakevenData.timestamp,
      exchangeName: breakevenData.exchangeName,
      interval: "1m",
      symbol: breakevenData.symbol,
    }),
    candle_15m: await ioc.exchangeViewService.getPointCandles({
      currentTime: breakevenData.timestamp,
      exchangeName: breakevenData.exchangeName,
      interval: "15m",
      symbol: breakevenData.symbol,
    }),
    candle_1h: await ioc.exchangeViewService.getPointCandles({
      currentTime: breakevenData.timestamp,
      exchangeName: breakevenData.exchangeName,
      interval: "1h",
      symbol: breakevenData.symbol,
    }),
  };
};

const handleDownload = async (pathname: string, id: string) => {

  const { candle_15m, candle_1h, candle_1m, breakeven } = await fetchData(id);

  const signalId = breakeven.type === "breakeven.available"
    ? (breakeven as BreakevenAvailableNotification).signalId
    : "unknown";

  if (pathname.includes("/breakeven")) {
    const blob = new Blob([JSON.stringify(breakeven, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    ioc.layoutService.downloadFile(url, `breakeven_${signalId}.json`);
    return;
  }

  if (pathname.includes("/candle_1m")) {
    const blob = new Blob([JSON.stringify(candle_1m, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    ioc.layoutService.downloadFile(url, `candles_1m_${signalId}.json`);
    return;
  }

  if (pathname.includes("/candle_15m")) {
    const blob = new Blob([JSON.stringify(candle_15m, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    ioc.layoutService.downloadFile(url, `candles_15m_${signalId}.json`);
    return;
  }

  if (pathname.includes("/candle_1h")) {
    const blob = new Blob([JSON.stringify(candle_1h, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    ioc.layoutService.downloadFile(url, `candles_1h_${signalId}.json`);
    return;
  }
};

export const useBreakevenView = () => {

  const [id$, setId] = useActualState("");
  const ctx = useModalManager();
  const { push, pop } = ctx;

  const [pathname$, setPathname] = useActualRef(history.location.pathname);

  const handleTabChange = (id: string, history: History) => {
    if (id === "breakeven") {
      history.replace(`/breakeven`);
      setPathname(`/breakeven`);
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
    title: "Breakeven details",
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
    mapInitialData: ([{ breakeven, ...other }]) => ({
      main: breakeven,
      breakeven,
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
      id: "breakeven_modal",
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

export default useBreakevenView;
