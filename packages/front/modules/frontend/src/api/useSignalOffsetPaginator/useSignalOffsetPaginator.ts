import {
  useOffsetPaginator,
  resolveDocuments,
} from "react-declarative";
import makeItemIterator from "./core/makeItemIterator";
import { ISignal } from "./model/Signal.model";

export const useSignalOffsetPaginator = () =>
  useOffsetPaginator<ISignal>({
    handler: async (limit, offset) => {
      const iterator = makeItemIterator();
      return await resolveDocuments(iterator);
    },
  });

export default useSignalOffsetPaginator;
