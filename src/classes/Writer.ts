import {
  getErrorMessage,
  makeExtendable,
  memoize,
  singleshot,
  timeout,
  TIMEOUT_SYMBOL,
} from "functools-kit";
import { createWriteStream, WriteStream } from "fs";
import * as fs from "fs/promises";
import { join, dirname } from "path";
import { exitEmitter } from "../config/emitters";
import { getContextTimestamp } from "../helpers/getContextTimestamp";
import LoggerService from "../lib/services/base/LoggerService";

const MARKDOWN_METHOD_NAME_USE_ADAPTER = "MarkdownWriterAdapter.useMarkdownAdapter";
const MARKDOWN_METHOD_NAME_FILE_DUMP = "MarkdownFileAdapter.dump";
const MARKDOWN_METHOD_NAME_FOLDER_DUMP = "MarkdownFolderAdapter.dump";
const MARKDOWN_METHOD_NAME_WRITE_DATA = "MarkdownWriterAdapter.writeData";
const MARKDOWN_METHOD_NAME_USE_MD = "MarkdownWriterAdapter.useMd";
const MARKDOWN_METHOD_NAME_USE_JSONL = "MarkdownWriterAdapter.useJsonl";
const MARKDOWN_METHOD_NAME_USE_DUMMY = "MarkdownWriterAdapter.useDummy";
const MARKDOWN_METHOD_NAME_CLEAR = "MarkdownWriterAdapter.clear";

/** Logger service injected as DI singleton */
const LOGGER_SERVICE = new LoggerService();

/**
 * Configuration interface for selective markdown service enablement.
 * Controls which markdown report services should be activated.
 */
export interface IMarkdownTarget {
  /** Enable strategy event tracking reports (entry/exit signals) */
  strategy: boolean;
  /** Enable risk rejection tracking reports (signals blocked by risk limits) */
  risk: boolean;
  /** Enable breakeven event tracking reports (when stop loss moves to entry) */
  breakeven: boolean;
  /** Enable partial profit/loss event tracking reports */
  partial: boolean;
  /** Enable portfolio heatmap analysis reports across all symbols */
  heat: boolean;
  /** Enable walker strategy comparison and optimization reports */
  walker: boolean;
  /** Enable performance metrics and bottleneck analysis reports */
  performance: boolean;
  /** Enable scheduled signal tracking reports (signals waiting for trigger) */
  schedule: boolean;
  /** Enable live trading event reports (all tick events) */
  live: boolean;
  /** Enable backtest markdown reports (main strategy results with full trade history) */
  backtest: boolean;
  /** Enable signal sync lifecycle reports (signal-open and signal-close events) */
  sync: boolean;
  /** Enable highest profit milestone tracking reports */
  highest_profit: boolean;
  /** Enable max drawdown milestone tracking reports */
  max_drawdown: boolean;
}

/** Symbol key for the singleshot waitForInit function on MarkdownFileBase instances. */
const WAIT_FOR_INIT_SYMBOL = Symbol("wait-for-init");
/** Symbol key for the timeout-protected write function on MarkdownFileBase instances. */
const WRITE_SAFE_SYMBOL = Symbol("write-safe");

/**
 * Union type of all valid markdown report names.
 * Used for type-safe identification of markdown services.
 */
export type MarkdownName = keyof IMarkdownTarget;

/**
 * Options for markdown dump operations.
 * Contains path information and metadata for filtering.
 */
export interface IMarkdownDumpOptions {
  /** Directory path relative to process.cwd() */
  path: string;
  /** File name including extension */
  file: string;
  /** Trading pair symbol (e.g., "BTCUSDT") */
  symbol: string;
  /** Strategy name */
  strategyName: string;
  /** Exchange name */
  exchangeName: string;
  /** Frame name (timeframe identifier) */
  frameName: string;
  /** Signal unique identifier */
  signalId: string;
}

/**
 * Base interface for markdown storage adapters.
 * All markdown adapters must implement this interface.
 */
export type TMarkdownBase = {
  /**
   * Initialize markdown storage and prepare for writes.
   * Uses singleshot to ensure one-time execution.
   *
   * @param initial - Whether this is the first initialization
   * @returns Promise that resolves when initialization is complete
   */
  waitForInit(initial: boolean): Promise<void>;

  /**
   * Dump markdown content to storage.
   *
   * @param content - Markdown content to write
   * @param options - Metadata and path options for the dump
   * @returns Promise that resolves when write is complete
   * @throws Error if write fails or stream is not initialized
   */
  dump(content: string, options: IMarkdownDumpOptions): Promise<void>;
};

/**
 * Constructor type for markdown storage adapters.
 * Used for custom markdown storage implementations.
 */
export type TMarkdownBaseCtor = new (
  markdownName: MarkdownName
) => TMarkdownBase;

/**
 * JSONL-based markdown adapter with append-only writes.
 *
 * Features:
 * - Writes markdown reports as JSONL entries to a single file per markdown type
 * - Stream-based writes with backpressure handling
 * - 15-second timeout protection for write operations
 * - Automatic directory creation
 * - Error handling via exitEmitter
 * - Search metadata for filtering (symbol, strategy, exchange, frame, signalId)
 *
 * File format: ./dump/markdown/{markdownName}.jsonl
 * Each line contains: markdownName, data, symbol, strategyName, exchangeName, frameName, signalId, timestamp
 *
 * Use this adapter for centralized logging and post-processing with JSONL tools.
 */
export class MarkdownFileBase implements TMarkdownBase {
  /** Absolute path to the JSONL file for this markdown type */
  _filePath: string;

  /** WriteStream instance for append-only writes, null until initialized */
  _stream: WriteStream | null = null;

  /** Base directory for all JSONL markdown files */
  _baseDir = join(process.cwd(), "./dump/markdown");

  /**
   * Creates a new JSONL markdown adapter instance.
   *
   * @param markdownName - Type of markdown report (backtest, live, walker, etc.)
   */
  constructor(readonly markdownName: MarkdownName) {
    this._filePath = join(this._baseDir, `${markdownName}.jsonl`);
  }

  /**
   * Singleshot initialization function that creates directory and stream.
   * Protected by singleshot to ensure one-time execution.
   * Sets up error handler that emits to exitEmitter.
   */
  [WAIT_FOR_INIT_SYMBOL] = singleshot(async (): Promise<void> => {
    await fs.mkdir(this._baseDir, { recursive: true });
    this._stream = createWriteStream(this._filePath, { flags: "a" });
    this._stream.on("error", (err) => {
      exitEmitter.next(
        new Error(
          `MarkdownFileAdapter stream error for markdownName=${
            this.markdownName
          } message=${getErrorMessage(err)}`
        )
      );
    });
  });

  /**
   * Timeout-protected write function with backpressure handling.
   * Waits for drain event if write buffer is full.
   * Times out after 15 seconds and returns TIMEOUT_SYMBOL.
   */
  [WRITE_SAFE_SYMBOL] = timeout(async (line: string) => {
    if (!this._stream.write(line)) {
      await new Promise<void>((resolve) => {
        this._stream!.once("drain", resolve);
      });
    }
  }, 15_000);

  /**
   * Initializes the JSONL file and write stream.
   * Safe to call multiple times - singleshot ensures one-time execution.
   *
   * @returns Promise that resolves when initialization is complete
   */
  async waitForInit(): Promise<void> {
    await this[WAIT_FOR_INIT_SYMBOL]();
  }

  /**
   * Writes markdown content to JSONL file with metadata.
   * Appends a single line with JSON object containing:
   * - markdownName: Type of report
   * - data: Markdown content
   * - Search flags: symbol, strategyName, exchangeName, frameName, signalId
   * - timestamp: Current timestamp in milliseconds
   *
   * @param data - Markdown content to write
   * @param options - Path and metadata options
   * @throws Error if stream not initialized or write timeout exceeded
   */
  async dump(data: string, options: IMarkdownDumpOptions): Promise<void> {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_FILE_DUMP, {
      markdownName: this.markdownName,
      options,
    });

    if (!this._stream) {
      throw new Error(
        `Stream not initialized for markdown ${this.markdownName}. Call waitForInit() first.`
      );
    }

    const searchFlags: Partial<IMarkdownDumpOptions> = {};

    {
      if (options.symbol) {
        searchFlags.symbol = options.symbol;
      }

      if (options.strategyName) {
        searchFlags.strategyName = options.strategyName;
      }

      if (options.exchangeName) {
        searchFlags.exchangeName = options.exchangeName;
      }

      if (options.frameName) {
        searchFlags.frameName = options.frameName;
      }

      if (options.signalId) {
        searchFlags.signalId = options.signalId;
      }
    }

    const line =
      JSON.stringify({
        markdownName: this.markdownName,
        data,
        ...searchFlags,
        timestamp: getContextTimestamp(),
      }) + "\n";

    const status = await this[WRITE_SAFE_SYMBOL](line);
    if (status === TIMEOUT_SYMBOL) {
      throw new Error(`Timeout writing to markdown ${this.markdownName}`);
    }
  }
}

//@ts-ignore
MarkdownFileBase = makeExtendable(MarkdownFileBase);

/**
 * Folder-based markdown adapter with separate files per report.
 *
 * Features:
 * - Writes each markdown report as a separate .md file
 * - File path based on options.path and options.file
 * - Automatic directory creation
 * - No stream management (direct writeFile)
 * - Suitable for human-readable report directories
 *
 * File format: {options.path}/{options.file}
 * Example: ./dump/backtest/BTCUSDT_my-strategy_binance_2024-Q1_backtest-1736601234567.md
 *
 * Use this adapter (default) for organized report directories and manual review.
 */
export class MarkdownFolderBase implements TMarkdownBase {
  /**
   * Creates a new folder-based markdown adapter instance.
   *
   * @param markdownName - Type of markdown report (backtest, live, walker, etc.)
   */
  constructor(readonly markdownName: MarkdownName) {}

  /**
   * No-op initialization for folder adapter.
   * This adapter doesn't need initialization since it uses direct writeFile.
   *
   * @returns Promise that resolves immediately
   */
  async waitForInit(): Promise<void> {
    void 0;
  }

  /**
   * Writes markdown content to a separate file.
   * Creates directory structure automatically.
   * File path is determined by options.path and options.file.
   *
   * @param content - Markdown content to write
   * @param options - Path and file options for the dump
   * @throws Error if directory creation or file write fails
   */
  async dump(content: string, options: IMarkdownDumpOptions): Promise<void> {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_FOLDER_DUMP, {
      markdownName: this.markdownName,
      options,
    });

    // Combine into full file path
    const filePath = join(process.cwd(), options.path, options.file);

    // Extract directory from file path
    const dir = dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, "utf8");
  }
}

// @ts-ignore
MarkdownFolderBase = makeExtendable(MarkdownFolderBase);

/**
 * Dummy markdown adapter that discards all writes.
 * Used for disabling markdown report generation.
 */
export class MarkdownDummy implements TMarkdownBase {
  /**
   * No-op dump function.
   * @returns Promise that resolves immediately
   */
  async dump() {
    void 0;
  }
  /**
   * No-op initialization function.
   * @returns Promise that resolves immediately
   */
  async waitForInit() {
    void 0;
  }
}

export class MarkdownWriterAdapter {

  private MarkdownFactory: TMarkdownBaseCtor = MarkdownFolderBase;

  private getMarkdownStorage = memoize(
    ([markdownName]: [MarkdownName]): string => markdownName,
    (markdownName: MarkdownName): TMarkdownBase =>
      Reflect.construct(this.MarkdownFactory, [markdownName])
  );

  public useMarkdownAdapter(Ctor: TMarkdownBaseCtor): void {
    LOGGER_SERVICE.info(MARKDOWN_METHOD_NAME_USE_ADAPTER);
    this.MarkdownFactory = Ctor;
  }

  public async writeData(
    markdownName: MarkdownName,
    content: string,
    options: IMarkdownDumpOptions
  ): Promise<void> {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_WRITE_DATA, {
      markdownName,
      options,
    });

    const isInitial = !this.getMarkdownStorage.has(markdownName);
    const markdown = this.getMarkdownStorage(markdownName);
    await markdown.waitForInit(isInitial);

    await markdown.dump(content, options);
  }

  public useMd() {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_USE_MD);
    this.useMarkdownAdapter(MarkdownFolderBase);
  }

  public useJsonl() {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_USE_JSONL);
    this.useMarkdownAdapter(MarkdownFileBase);
  }

  public clear(): void {
    LOGGER_SERVICE.log(MARKDOWN_METHOD_NAME_CLEAR);
    this.getMarkdownStorage.clear();
  }

  public useDummy() {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_USE_DUMMY);
    this.useMarkdownAdapter(MarkdownDummy);
  }
}

export const MarkdownWriter = new MarkdownWriterAdapter();
