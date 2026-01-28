import { IOutletModal } from "react-declarative";
import MainView from "./view/MainView";

const hasMatch = (templates: string[], pathname: string) => {
  return templates.some((template) => template.includes(pathname));
};

export const routes: IOutletModal[] = [
  {
    id: "main",
    element: MainView,
    isActive: (pathname) => hasMatch(["/short_range/main"], pathname),
  },
];

export default routes;
