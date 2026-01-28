import { useArrayPaginator } from "react-declarative";
import { ioc } from "../lib";

export const useShortRangeArrayPaginator = () =>
  useArrayPaginator(ioc.reportViewService.paginateShortRange, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    fallback: ioc.errorService.handleGlobalError,
  });

export default useShortRangeArrayPaginator;
