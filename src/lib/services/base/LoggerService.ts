import { inject } from "../../../lib/core/di";
import { ILogger } from "../../../interfaces/Logger.interface";
import MethodContextService, {
  TMethodContextService,
} from "../context/MethodContextService";
import TYPES from "../../../lib/core/types";
import ExecutionContextService, {
  TExecutionContextService,
} from "../context/ExecutionContextService";

const NOOP_LOGGER: ILogger = {
  log() {
    void 0;
  },
  debug() {
    void 0;
  },
  info() {
    void 0;
  },
};

export class LoggerService implements ILogger {
  private readonly methodContextService = inject<TMethodContextService>(
    TYPES.methodContextService
  );
  private readonly executionContextService = inject<TExecutionContextService>(
    TYPES.executionContextService
  );

  private _commonLogger: ILogger = NOOP_LOGGER;

  private get methodContext() {
    if (MethodContextService.hasContext()) {
      return this.methodContextService.context;
    }
    return {};
  }

  private get executionContext() {
    if (ExecutionContextService.hasContext()) {
      return this.executionContextService.context;
    }
    return {};
  }

  public log = async (topic: string, ...args: any[]) => {
    await this._commonLogger.log(
      topic,
      ...args,
      this.methodContext,
      this.executionContext
    );
  };

  public debug = async (topic: string, ...args: any[]) => {
    await this._commonLogger.debug(
      topic,
      ...args,
      this.methodContext,
      this.executionContext
    );
  };

  public info = async (topic: string, ...args: any[]) => {
    await this._commonLogger.info(
      topic,
      ...args,
      this.methodContext,
      this.executionContext
    );
  };

  public setLogger = (logger: ILogger) => {
    this._commonLogger = logger;
  };
}

export default LoggerService;
