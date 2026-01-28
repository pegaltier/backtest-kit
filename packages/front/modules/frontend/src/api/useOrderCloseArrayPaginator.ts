import { useArrayPaginator } from "react-declarative";
import { ioc } from "../lib";

export const useOrderCloseArrayPaginator = () =>
  useArrayPaginator(ioc.orderCloseViewService.paginate, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    fallback: ioc.errorService.handleGlobalError,
  });

export default useOrderCloseArrayPaginator;
