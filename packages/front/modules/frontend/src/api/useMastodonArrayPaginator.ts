import { useArrayPaginator } from "react-declarative";
import { ioc } from "../lib";

export const useMastodonArrayPaginator = () =>
  useArrayPaginator(ioc.reportViewService.paginateMastodon, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    fallback: ioc.errorService.handleGlobalError,
  });

export default useMastodonArrayPaginator;
