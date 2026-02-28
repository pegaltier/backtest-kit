import { ILogger } from "../interfaces/Logger.interface";

export interface ILogEntry {
  topic: string;
  args: unknown[];
}

export interface ILog extends ILogger {
  getList(): Promise<ILogEntry[]>;
}

type TLogCtor = new () => Partial<ILog>;

export class LogPersistUtils implements ILog {
  getList(): Promise<ILogEntry[]> {
    throw new Error("Method not implemented.");
  }
  log(topic: string, ...args: any[]): void {
    throw new Error("Method not implemented.");
  }
  debug(topic: string, ...args: any[]): void {
    throw new Error("Method not implemented.");
  }
  info(topic: string, ...args: any[]): void {
    throw new Error("Method not implemented.");
  }
  warn(topic: string, ...args: any[]): void {
    throw new Error("Method not implemented.");
  }
}

export class LogMemoryUtils implements ILog {
  getList(): Promise<ILogEntry[]> {
    throw new Error("Method not implemented.");
  }
  log(topic: string, ...args: any[]): void {
    throw new Error("Method not implemented.");
  }
  debug(topic: string, ...args: any[]): void {
    throw new Error("Method not implemented.");
  }
  info(topic: string, ...args: any[]): void {
    throw new Error("Method not implemented.");
  }
  warn(topic: string, ...args: any[]): void {
    throw new Error("Method not implemented.");
  }
}

export class LogDummyUtils implements ILog {
  async getList(): Promise<ILogEntry[]> {
    return [];
  }
  log() {
    void 0;
  }
  debug() {
    void 0;
  }
  info() {
    void 0;
  }
  warn() {
    void 0;
  }
}

export class LogAdapter implements ILog {
  private _log: Partial<ILog> = new LogPersistUtils();

  public getList = async () => {
    if (this._log.getList) {
      return await this._log.getList();
    }
    return [];
  };

  public log = (topic: string, ...args: any[]) => {
    if (this._log.log) {
      this._log.log(topic, ...args);
    }
  };

  public debug = (topic: string, ...args: any[]) => {
    if (this._log.debug) {
      this._log.debug(topic, ...args);
    }
  };

  public info = (topic: string, ...args: any[]) => {
    if (this._log.info) {
      this._log.info(topic, ...args);
    }
  };

  public warn = (topic: string, ...args: any[]) => {
    if (this._log.warn) {
      this._log.warn(topic, ...args);
    }
  };

  public useLogger = (Ctor: TLogCtor) => {};

  public usePersist = () => {
    this._log = new LogPersistUtils();
  };

  public useMemory = () => {
    this._log = new LogMemoryUtils();
  };

  public useDummy = () => {
    this._log = new LogDummyUtils();
  };
}
