import { useArrayPaginator } from "react-declarative";
import { ioc } from "../lib";

export const useVolumeDataArrayPaginator = () =>
  useArrayPaginator(ioc.reportViewService.paginateVolumeDataReport, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    fallback: ioc.errorService.handleGlobalError,
  });

export default useVolumeDataArrayPaginator;
