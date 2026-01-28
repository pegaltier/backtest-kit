import { useArrayPaginator } from "react-declarative";
import { ioc } from "../lib";

export const useStrategyReportArrayPaginator = () =>
  useArrayPaginator(ioc.reportViewService.paginateStrategyReport, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    fallback: ioc.errorService.handleGlobalError,
  });

export default useStrategyReportArrayPaginator;
