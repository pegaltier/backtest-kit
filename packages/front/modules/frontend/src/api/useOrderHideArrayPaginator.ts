import { useArrayPaginator } from "react-declarative";
import { ioc } from "../lib";

export const useOrderHideArrayPaginator = () =>
  useArrayPaginator(ioc.orderHideViewService.paginate, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    fallback: ioc.errorService.handleGlobalError,
  });

export default useOrderHideArrayPaginator;
