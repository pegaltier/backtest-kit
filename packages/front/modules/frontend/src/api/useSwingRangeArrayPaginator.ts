import { useArrayPaginator } from "react-declarative";
import { ioc } from "../lib";

export const useSwingRangeArrayPaginator = () =>
  useArrayPaginator(ioc.reportViewService.paginateSwingRange, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    fallback: ioc.errorService.handleGlobalError,
  });

export default useSwingRangeArrayPaginator;
