import { useOffsetPaginator } from "react-declarative";
import makeItemIterator from "./core/makeItemIterator";
import { ISignal } from "./model/Signal.model";

export const useSignalOffsetPaginator = (mode: "live" | "backtest") =>
  useOffsetPaginator<ISignal>({
    handler: async (limit, offset) => {
      const fetchItems = makeItemIterator(mode);
      const all = await fetchItems();
      return all.slice(offset, offset + limit);
    },
  });

export default useSignalOffsetPaginator;
