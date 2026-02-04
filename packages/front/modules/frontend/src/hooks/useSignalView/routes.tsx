import { IOutletModal } from "react-declarative";
import SignalView from "./view/SignalView";
import Candle1mView from "./view/Candle1mView";
import Candle15mView from "./view/Candle15mView";
import Candle1hView from "./view/Candle1hView";
import NotificationView from "./view/NotificationView";

const hasMatch = (templates: string[], pathname: string) => {
  return templates.some((template) => template.includes(pathname));
};

export const routes: IOutletModal[] = [
  {
    id: "signal",
    element: SignalView,
    isActive: (pathname) => hasMatch(["/signal"], pathname),
  },
  {
    id: "notification",
    element: NotificationView,
    isActive: (pathname) => hasMatch(["/notification"], pathname),
  },
  {
    id: "candle_1m",
    element: Candle1mView,
    isActive: (pathname) => hasMatch(["/candle_1m"], pathname),
  },
  {
    id: "candle_15m",
    element: Candle15mView,
    isActive: (pathname) => hasMatch(["/candle_15m"], pathname),
  },
  {
    id: "candle_1h",
    element: Candle1hView,
    isActive: (pathname) => hasMatch(["/candle_1h"], pathname),
  },
];

export default routes;
