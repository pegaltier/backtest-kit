import { IOutletModal } from "react-declarative";
import MainView from "./view/MainView";
import LongView from "./view/LongView";
import SwingView from "./view/SwingView";
import ShortView from "./view/ShortView";
import BraveView from "./view/BraveView";
import MastodonView from "./view/MastodonView";
import VolumeView from "./view/VolumeView";
import PriceView from "./view/PriceView";

const hasMatch = (templates: string[], pathname: string) => {
    return templates.some((template) => template.includes(pathname));
};

export const routes: IOutletModal[] = [
    {
        id: "main",
        element: MainView,
        isActive: (pathname) => hasMatch(["/order_info/main"], pathname),
    },
    {
        id: "strategy",
        element: LongView,
        isActive: (pathname) => hasMatch(["/order_info/strategy"], pathname),
    },
    {
        id: "long",
        element: LongView,
        isActive: (pathname) => hasMatch(["/order_info/long"], pathname),
    },
    {
        id: "swing",
        element: SwingView,
        isActive: (pathname) => hasMatch(["/order_info/swing"], pathname),
    },
    {
        id: "short",
        element: ShortView,
        isActive: (pathname) => hasMatch(["/order_info/short"], pathname),
    },
    {
        id: "brave",
        element: BraveView,
        isActive: (pathname) => hasMatch(["/order_info/brave"], pathname),
    },
    {
        id: "mastodon",
        element: MastodonView,
        isActive: (pathname) => hasMatch(["/order_info/mastodon"], pathname),
    },
    {
        id: "volume",
        element: VolumeView,
        isActive: (pathname) => hasMatch(["/order_info/volume"], pathname),
    },
    {
        id: "price",
        element: PriceView,
        isActive: (pathname) => hasMatch(["/order_info/price"], pathname),
    },
];

export default routes;
