import { useArrayPaginator } from "react-declarative";
import { ioc } from "../lib";

export const useLongRangeArrayPaginator = () =>
  useArrayPaginator(ioc.reportViewService.paginateLongRange, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    fallback: ioc.errorService.handleGlobalError,
  });

export default useLongRangeArrayPaginator;
