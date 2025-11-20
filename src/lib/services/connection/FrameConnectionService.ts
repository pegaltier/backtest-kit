import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import { FrameName, IFrame } from "../../../interfaces/Frame.interface";
import { memoize } from "functools-kit";
import ClientFrame from "../../../client/ClientFrame";
import FrameSchemaService from "../schema/FrameSchemaService";
import { TMethodContextService } from "../context/MethodContextService";

export class FrameConnectionService implements IFrame {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly frameSchemaService = inject<FrameSchemaService>(
    TYPES.frameSchemaService
  );
  private readonly methodContextService = inject<TMethodContextService>(
    TYPES.methodContextService
  );

  public getFrame = memoize(
    (frameName) => `${frameName}`,
    (frameName: FrameName) => {
      const { endDate, interval, startDate, callbacks } =
        this.frameSchemaService.get(frameName);
      return new ClientFrame({
        frameName,
        logger: this.loggerService,
        startDate,
        endDate,
        interval,
        callbacks,
      });
    }
  );

  public getTimeframe = async (symbol: string) => {
    this.loggerService.log("frameConnectionService getTimeframe", {
      symbol,
    });
    return await this.getFrame(
      this.methodContextService.context.frameName
    ).getTimeframe(symbol);
  };
}

export default FrameConnectionService;
