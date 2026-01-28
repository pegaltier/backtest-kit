import { useArrayPaginator } from "react-declarative";
import { ioc } from "../lib";

export const useBraveArrayPaginator = () =>
  useArrayPaginator(ioc.reportViewService.paginateBrave, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    fallback: ioc.errorService.handleGlobalError,
  });

export default useBraveArrayPaginator;
