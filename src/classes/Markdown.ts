import {
  compose,
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
import BacktestMarkdownService from "../lib/services/markdown/BacktestMarkdownService";
import BreakevenMarkdownService from "../lib/services/markdown/BreakevenMarkdownService";
import HeatMarkdownService from "../lib/services/markdown/HeatMarkdownService";
import LiveMarkdownService from "../lib/services/markdown/LiveMarkdownService";
import PartialMarkdownService from "../lib/services/markdown/PartialMarkdownService";
import PerformanceMarkdownService from "../lib/services/markdown/PerformanceMarkdownService";
import RiskMarkdownService from "../lib/services/markdown/RiskMarkdownService";
import StrategyMarkdownService from "../lib/services/markdown/StrategyMarkdownService";
import ScheduleMarkdownService from "../lib/services/markdown/ScheduleMarkdownService";
import WalkerMarkdownService from "../lib/services/markdown/WalkerMarkdownService";
import SyncMarkdownService from "../lib/services/markdown/SyncMarkdownService";
import HighestProfitMarkdownService from "../lib/services/markdown/HighestProfitMarkdownService";
import MaxDrawdownMarkdownService from "../lib/services/markdown/MaxDrawdownMarkdownService";
import { IMarkdownTarget, MarkdownWriter, TMarkdownBaseCtor } from "./Writer";

const MARKDOWN_METHOD_NAME_ENABLE = "MarkdownUtils.enable";
const MARKDOWN_METHOD_NAME_DISABLE = "MarkdownUtils.disable";
const MARKDOWN_METHOD_NAME_USE_ADAPTER = "MarkdownAdapter.useMarkdownAdapter";
const MARKDOWN_METHOD_NAME_WRITE_DATA = "MarkdownAdapter.writeData";
const MARKDOWN_METHOD_NAME_USE_MD = "MarkdownAdapter.useMd";
const MARKDOWN_METHOD_NAME_USE_JSONL = "MarkdownAdapter.useJsonl";
const MARKDOWN_METHOD_NAME_USE_DUMMY = "MarkdownAdapter.useDummy";
const MARKDOWN_METHOD_NAME_CLEAR = "MarkdownAdapter.clear";

/** Logger service injected as DI singleton */
const LOGGER_SERVICE = new LoggerService();

/** Backtest markdown service injected as DI singleton */
const BACKTEST_MARKDOWN_SERVICE = new BacktestMarkdownService();
/** Breakeven markdown service injected as DI singleton */
const BREAKEVEN_MARKDOWN_SERVICE = new BreakevenMarkdownService();
/** Heat markdown service injected as DI singleton */
const HEAT_MARKDOWN_SERVICE = new HeatMarkdownService();
/** Live markdown service injected as DI singleton */
const LIVE_MARKDOWN_SERVICE = new LiveMarkdownService();
/** Partial markdown service injected as DI singleton */
const PARTIAL_MARKDOWN_SERVICE = new PartialMarkdownService();
/** Performance markdown service injected as DI singleton */
const PERFORMANCE_MARKDOWN_SERVICE = new PerformanceMarkdownService();
/** Risk markdown service injected as DI singleton */
const RISK_MARKDOWN_SERVICE = new RiskMarkdownService();
/** Strategy markdown service injected as DI singleton */
const STRATEGY_MARKDOWN_SERVICE = new StrategyMarkdownService();
/** Schedule markdown service injected as DI singleton */
const SCHEDULE_MARKDOWN_SERVICE = new ScheduleMarkdownService();
/** Walker markdown service injected as DI singleton */
const WALKER_MARKDOWN_SERVICE = new WalkerMarkdownService();
/** Sync markdown service injected as DI singleton */
const SYNC_MARKDOWN_SERVICE = new SyncMarkdownService();
/** Highest profit markdown service injected as DI singleton */
const HIGHEST_PROFIT_MARKDOWN_SERVICE = new HighestProfitMarkdownService();
/** Max drawdown markdown service injected as DI singleton */
const MAX_DRAWDOWN_MARKDOWN_SERVICE = new MaxDrawdownMarkdownService();

/**
 * Default configuration that enables all markdown services.
 * Used when no specific configuration is provided to `enable()`.
 */
const WILDCARD_TARGET: IMarkdownTarget = {
  backtest: true,
  breakeven: true,
  heat: true,
  live: true,
  partial: true,
  performance: true,
  risk: true,
  strategy: true,
  schedule: true,
  walker: true,
  sync: true,
  highest_profit: true,
  max_drawdown: true,
};

/**
 * Utility class for managing markdown report services.
 *
 * Provides methods to enable/disable markdown report generation across
 * different service types (backtest, live, walker, performance, etc.).
 *
 * Typically extended by MarkdownAdapter for additional functionality.
 */
export class MarkdownUtils {
  /**
   * Enables markdown report services selectively.
   *
   * Subscribes to specified markdown services and returns a cleanup function
   * that unsubscribes from all enabled services at once.
   *
   * Each enabled service will:
   * - Start listening to relevant events
   * - Accumulate data for reports
   * - Generate markdown files when requested
   *
   * IMPORTANT: Always call the returned unsubscribe function to prevent memory leaks.
   *
   * @param config - Service configuration object. Defaults to enabling all services.
   * @param config.backtest - Enable backtest result reports with full trade history
   * @param config.breakeven - Enable breakeven event tracking (when stop loss moves to entry)
   * @param config.partial - Enable partial profit/loss event tracking
   * @param config.heat - Enable portfolio heatmap analysis across all symbols
   * @param config.walker - Enable walker strategy comparison and optimization reports
   * @param config.performance - Enable performance bottleneck analysis
   * @param config.risk - Enable risk rejection tracking (signals blocked by risk limits)
   * @param config.schedule - Enable scheduled signal tracking (signals waiting for trigger)
   * @param config.live - Enable live trading event reports (all tick events)
   *
   * @returns Cleanup function that unsubscribes from all enabled services
   */
  public enable = ({
    backtest: bt = false,
    breakeven = false,
    heat = false,
    live = false,
    partial = false,
    performance = false,
    strategy = false,
    risk = false,
    schedule = false,
    walker = false,
    sync = false,
    highest_profit = false,
    max_drawdown = false,
  }: Partial<IMarkdownTarget> = WILDCARD_TARGET) => {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_ENABLE, {
      backtest: bt,
      breakeven,
      heat,
      live,
      partial,
      performance,
      risk,
      strategy,
      schedule,
      walker,
      sync,
      highest_profit,
    });
    const unList: Function[] = [];
    if (bt) {
      unList.push(BACKTEST_MARKDOWN_SERVICE.subscribe());
    }
    if (breakeven) {
      unList.push(BREAKEVEN_MARKDOWN_SERVICE.subscribe());
    }
    if (heat) {
      unList.push(HEAT_MARKDOWN_SERVICE.subscribe());
    }
    if (live) {
      unList.push(LIVE_MARKDOWN_SERVICE.subscribe());
    }
    if (partial) {
      unList.push(PARTIAL_MARKDOWN_SERVICE.subscribe());
    }
    if (performance) {
      unList.push(PERFORMANCE_MARKDOWN_SERVICE.subscribe());
    }
    if (risk) {
      unList.push(RISK_MARKDOWN_SERVICE.subscribe());
    }
    if (strategy) {
      unList.push(STRATEGY_MARKDOWN_SERVICE.subscribe());
    }
    if (schedule) {
      unList.push(SCHEDULE_MARKDOWN_SERVICE.subscribe());
    }
    if (walker) {
      unList.push(WALKER_MARKDOWN_SERVICE.subscribe());
    }
    if (sync) {
      unList.push(SYNC_MARKDOWN_SERVICE.subscribe());
    }
    if (highest_profit) {
      unList.push(HIGHEST_PROFIT_MARKDOWN_SERVICE.subscribe());
    }
    if (max_drawdown) {
      unList.push(MAX_DRAWDOWN_MARKDOWN_SERVICE.subscribe());
    }
    return compose(...unList.map((un) => () => void un()));
  };

  /**
   * Disables markdown report services selectively.
   *
   * Unsubscribes from specified markdown services to stop report generation.
   * Use this method to stop markdown report generation for specific services while keeping others active.
   *
   * Each disabled service will:
   * - Stop listening to events immediately
   * - Stop accumulating data for reports
   * - Stop generating markdown files
   * - Free up event listener and memory resources
   *
   * Unlike enable(), this method does NOT return an unsubscribe function.
   * Services are unsubscribed immediately upon calling this method.
   *
   * @param config - Service configuration object specifying which services to disable. Defaults to disabling all services.
   * @param config.backtest - Disable backtest result reports with full trade history
   * @param config.breakeven - Disable breakeven event tracking
   * @param config.partial - Disable partial profit/loss event tracking
   * @param config.heat - Disable portfolio heatmap analysis
   * @param config.walker - Disable walker strategy comparison reports
   * @param config.performance - Disable performance bottleneck analysis
   * @param config.risk - Disable risk rejection tracking
   * @param config.schedule - Disable scheduled signal tracking
   * @param config.live - Disable live trading event reports
   *
   * @example
   * ```typescript
   * import { Markdown } from "backtest-kit";
   *
   * // Disable specific services
   * Markdown.disable({ backtest: true, walker: true });
   *
   * // Disable all services
   * Markdown.disable();
   * ```
   */
  public disable = ({
    backtest: bt = false,
    breakeven = false,
    heat = false,
    live = false,
    partial = false,
    performance = false,
    risk = false,
    strategy = false,
    schedule = false,
    walker = false,
    sync = false,
    highest_profit = false,
    max_drawdown = false,
  }: Partial<IMarkdownTarget> = WILDCARD_TARGET) => {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_DISABLE, {
      backtest: bt,
      breakeven,
      heat,
      live,
      partial,
      performance,
      risk,
      strategy,
      schedule,
      walker,
      sync,
      highest_profit,
    });
    if (bt) {
      BACKTEST_MARKDOWN_SERVICE.unsubscribe();
    }
    if (breakeven) {
      BREAKEVEN_MARKDOWN_SERVICE.unsubscribe();
    }
    if (heat) {
      HEAT_MARKDOWN_SERVICE.unsubscribe();
    }
    if (live) {
      LIVE_MARKDOWN_SERVICE.unsubscribe();
    }
    if (partial) {
      PARTIAL_MARKDOWN_SERVICE.unsubscribe();
    }
    if (performance) {
      PERFORMANCE_MARKDOWN_SERVICE.unsubscribe();
    }
    if (risk) {
      RISK_MARKDOWN_SERVICE.unsubscribe();
    }
    if (strategy) {
      STRATEGY_MARKDOWN_SERVICE.unsubscribe();
    }
    if (schedule) {
      SCHEDULE_MARKDOWN_SERVICE.unsubscribe();
    }
    if (walker) {
      WALKER_MARKDOWN_SERVICE.unsubscribe();
    }
    if (sync) {
      SYNC_MARKDOWN_SERVICE.unsubscribe();
    }
    if (highest_profit) {
      HIGHEST_PROFIT_MARKDOWN_SERVICE.unsubscribe();
    }
    if (max_drawdown) {
      MAX_DRAWDOWN_MARKDOWN_SERVICE.unsubscribe();
    }
  };
}

/**
 * Markdown adapter with pluggable storage backend and instance memoization.
 *
 * Features:
 * - Adapter pattern for swappable storage implementations
 * - Memoized storage instances (one per markdown type)
 * - Default adapter: MarkdownFolderBase (separate files)
 * - Alternative adapter: MarkdownFileBase (JSONL append)
 * - Lazy initialization on first write
 * - Convenience methods: useMd(), useJsonl()
 */
export class MarkdownAdapter extends MarkdownUtils {

  /**
   * Sets the markdown storage adapter constructor.
   * All future markdown instances will use this adapter.
   *
   * @param Ctor - Constructor for markdown storage adapter
   */
  public useMarkdownAdapter(Ctor: TMarkdownBaseCtor): void {
    LOGGER_SERVICE.info(MARKDOWN_METHOD_NAME_USE_ADAPTER);
    return MarkdownWriter.useMarkdownAdapter(Ctor);
  }

  /**
   * Switches to folder-based markdown storage (default).
   * Shorthand for useMarkdownAdapter(MarkdownFolderBase).
   * Each dump creates a separate .md file.
   */
  public useMd() {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_USE_MD);
    MarkdownWriter.useMd();
  }

  /**
   * Switches to JSONL-based markdown storage.
   * Shorthand for useMarkdownAdapter(MarkdownFileBase).
   * All dumps append to a single .jsonl file per markdown type.
   */
  public useJsonl() {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_USE_JSONL);
    MarkdownWriter.useJsonl();
  }

  /**
   * Clears the memoized storage cache.
   * Call this when process.cwd() changes between strategy iterations
   * so new storage instances are created with the updated base path.
   */
  public clear(): void {
    LOGGER_SERVICE.log(MARKDOWN_METHOD_NAME_CLEAR);
    MarkdownWriter.clear();
  }

  /**
   * Switches to a dummy markdown adapter that discards all writes.
   * All future markdown writes will be no-ops.
   */
  public useDummy() {
    LOGGER_SERVICE.debug(MARKDOWN_METHOD_NAME_USE_DUMMY);
    MarkdownWriter.useDummy();
  }
}

/**
 * Global singleton instance of MarkdownAdapter.
 * Provides markdown report generation with pluggable storage backends.
 */
export const Markdown = new MarkdownAdapter();

