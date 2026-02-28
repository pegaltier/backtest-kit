import { randomString, singleshot } from "functools-kit";
import { ILogEntry, ILogger } from "../interfaces/Logger.interface";
import { PersistLogAdapter } from "./Persist";
import backtest from "../lib";
import { GLOBAL_CONFIG } from "../config/params";

const LOG_PERSIST_METHOD_NAME_WAIT_FOR_INIT = "LogPersistUtils.waitForInit";
const LOG_PERSIST_METHOD_NAME_LOG = "LogPersistUtils.log";
const LOG_PERSIST_METHOD_NAME_DEBUG = "LogPersistUtils.debug";
const LOG_PERSIST_METHOD_NAME_INFO = "LogPersistUtils.info";
const LOG_PERSIST_METHOD_NAME_WARN = "LogPersistUtils.warn";
const LOG_PERSIST_METHOD_NAME_GET_LIST = "LogPersistUtils.getList";

const LOG_MEMORY_METHOD_NAME_LOG = "LogMemoryUtils.log";
const LOG_MEMORY_METHOD_NAME_DEBUG = "LogMemoryUtils.debug";
const LOG_MEMORY_METHOD_NAME_INFO = "LogMemoryUtils.info";
const LOG_MEMORY_METHOD_NAME_WARN = "LogMemoryUtils.warn";
const LOG_MEMORY_METHOD_NAME_GET_LIST = "LogMemoryUtils.getList";

const LOG_ADAPTER_METHOD_NAME_USE_LOGGER = "LogAdapter.useLogger";
const LOG_ADAPTER_METHOD_NAME_USE_PERSIST = "LogAdapter.usePersist";
const LOG_ADAPTER_METHOD_NAME_USE_MEMORY = "LogAdapter.useMemory";
const LOG_ADAPTER_METHOD_NAME_USE_DUMMY = "LogAdapter.useDummy";

export interface ILog extends ILogger {
  getList(): Promise<ILogEntry[]>;
}

export type TLogCtor = new () => Partial<ILog>;

/**
 * Persistent log adapter.
 *
 * Features:
 * - Persists log entries to disk using PersistLogAdapter
 * - Lazy initialization with singleshot pattern
 * - Maintains up to CC_MAX_LOG_LINES most recent entries
 * - Each entry stored individually keyed by its id
 *
 * Use this adapter (default) for log persistence across sessions.
 */
export class LogPersistUtils implements ILog {
  private _entries: ILogEntry[] = [];

  private waitForInit = singleshot(async () => {
    backtest.loggerService.info(LOG_PERSIST_METHOD_NAME_WAIT_FOR_INIT);
    const list = await PersistLogAdapter.readLogData();
    this._entries = list.slice(-GLOBAL_CONFIG.CC_MAX_LOG_LINES);
  });

  private _enforceLimit(): void {
    if (this._entries.length > GLOBAL_CONFIG.CC_MAX_LOG_LINES) {
      this._entries.splice(
        0,
        this._entries.length - GLOBAL_CONFIG.CC_MAX_LOG_LINES,
      );
    }
  }

  public log = async (topic: string, ...args: any[]): Promise<void> => {
    backtest.loggerService.info(LOG_PERSIST_METHOD_NAME_LOG, { topic });
    await this.waitForInit();
    this._entries.push({ id: randomString(), type: "log", topic, args });
    this._enforceLimit();
    await PersistLogAdapter.writeLogData(this._entries);
  };

  public debug = async (topic: string, ...args: any[]): Promise<void> => {
    backtest.loggerService.info(LOG_PERSIST_METHOD_NAME_DEBUG, { topic });
    await this.waitForInit();
    this._entries.push({ id: randomString(), type: "debug", topic, args });
    this._enforceLimit();
    await PersistLogAdapter.writeLogData(this._entries);
  };

  public info = async (topic: string, ...args: any[]): Promise<void> => {
    backtest.loggerService.info(LOG_PERSIST_METHOD_NAME_INFO, { topic });
    await this.waitForInit();
    this._entries.push({ id: randomString(), type: "info", topic, args });
    this._enforceLimit();
    await PersistLogAdapter.writeLogData(this._entries);
  };

  public warn = async (topic: string, ...args: any[]): Promise<void> => {
    backtest.loggerService.info(LOG_PERSIST_METHOD_NAME_WARN, { topic });
    await this.waitForInit();
    this._entries.push({ id: randomString(), type: "warn", topic, args });
    this._enforceLimit();
    await PersistLogAdapter.writeLogData(this._entries);
  };

  public getList = async (): Promise<ILogEntry[]> => {
    backtest.loggerService.info(LOG_PERSIST_METHOD_NAME_GET_LIST);
    await this.waitForInit();
    return [...this._entries];
  };
}

/**
 * In-memory log adapter.
 *
 * Features:
 * - Stores log entries in memory only (no persistence)
 * - Maintains up to CC_MAX_LOG_LINES most recent entries
 * - Data is lost when application restarts
 *
 * Use this adapter for testing or when persistence is not required.
 */
export class LogMemoryUtils implements ILog {
  private _entries: ILogEntry[] = [];

  private _enforceLimit(): void {
    if (this._entries.length > GLOBAL_CONFIG.CC_MAX_LOG_LINES) {
      this._entries.splice(
        0,
        this._entries.length - GLOBAL_CONFIG.CC_MAX_LOG_LINES,
      );
    }
  }

  public log = (topic: string, ...args: any[]): void => {
    backtest.loggerService.info(LOG_MEMORY_METHOD_NAME_LOG, { topic });
    this._entries.push({ id: randomString(), type: "log", topic, args });
    this._enforceLimit();
  };

  public debug = (topic: string, ...args: any[]): void => {
    backtest.loggerService.info(LOG_MEMORY_METHOD_NAME_DEBUG, { topic });
    this._entries.push({ id: randomString(), type: "debug", topic, args });
    this._enforceLimit();
  };

  public info = (topic: string, ...args: any[]): void => {
    backtest.loggerService.info(LOG_MEMORY_METHOD_NAME_INFO, { topic });
    this._entries.push({ id: randomString(), type: "info", topic, args });
    this._enforceLimit();
  };

  public warn = (topic: string, ...args: any[]): void => {
    backtest.loggerService.info(LOG_MEMORY_METHOD_NAME_WARN, { topic });
    this._entries.push({ id: randomString(), type: "warn", topic, args });
    this._enforceLimit();
  };

  public getList = async (): Promise<ILogEntry[]> => {
    backtest.loggerService.info(LOG_MEMORY_METHOD_NAME_GET_LIST);
    return [...this._entries];
  };
}

/**
 * Dummy log adapter that discards all writes.
 *
 * Features:
 * - No-op implementation for all methods
 * - getList always returns empty array
 *
 * Use this adapter to disable log storage completely.
 */
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

/**
 * Log adapter with pluggable storage backend.
 *
 * Features:
 * - Adapter pattern for swappable log implementations
 * - Default adapter: LogPersistUtils (persistent storage)
 * - Alternative adapters: LogMemoryUtils, LogDummyUtils
 * - Convenience methods: usePersist(), useMemory(), useDummy()
 */
export class LogAdapter implements ILog {
  private _log: Partial<ILog> = new LogMemoryUtils();

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

  public useLogger = (Ctor: TLogCtor) => {
    backtest.loggerService.info(LOG_ADAPTER_METHOD_NAME_USE_LOGGER);
    this._log = Reflect.construct(Ctor, []);
  };

  public usePersist = () => {
    backtest.loggerService.info(LOG_ADAPTER_METHOD_NAME_USE_PERSIST);
    this._log = new LogPersistUtils();
  };

  public useMemory = () => {
    backtest.loggerService.info(LOG_ADAPTER_METHOD_NAME_USE_MEMORY);
    this._log = new LogMemoryUtils();
  };

  public useDummy = () => {
    backtest.loggerService.info(LOG_ADAPTER_METHOD_NAME_USE_DUMMY);
    this._log = new LogDummyUtils();
  };
}

export const Log = new LogAdapter();
