import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import { memoize, singleshot } from "functools-kit";
import ExecutionContextService, {
  TExecutionContextService,
} from "../context/ExecutionContextService";
import StrategyCoreService from "../core/StrategyCoreService";
import { StrategyName } from "../../../interfaces/Strategy.interface";
import { ExchangeName } from "../../../interfaces/Exchange.interface";
import { FrameName } from "../../../interfaces/Frame.interface";
import { Markdown } from "../../../classes/Markdown";
import {
  StrategyStatisticsModel,
  StrategyEvent,
} from "../../../model/StrategyStatistics.model";
import { ColumnModel } from "../../../model/Column.model";
import { COLUMN_CONFIG } from "../../../config/columns";

/**
 * Type alias for column configuration used in strategy markdown reports.
 *
 * @see ColumnModel for the base interface
 * @see StrategyEvent for the event data structure
 */
export type Columns = ColumnModel<StrategyEvent>;

const GET_EXECUTION_CONTEXT_FN = (self: StrategyMarkdownService) => {
  if (ExecutionContextService.hasContext()) {
    const { when } = self.executionContextService.context;
    return { when: when.toISOString() };
  }
  return {
    when: "",
  };
};

/**
 * Creates a unique key for memoizing ReportStorage instances.
 */
const CREATE_KEY_FN = (
  symbol: string,
  strategyName: StrategyName,
  exchangeName: ExchangeName,
  frameName: FrameName,
  backtest: boolean
): string => {
  const parts = [symbol, strategyName, exchangeName];
  if (frameName) parts.push(frameName);
  parts.push(backtest ? "backtest" : "live");
  return parts.join(":");
};

/**
 * Creates a filename for markdown report.
 */
const CREATE_FILE_NAME_FN = (
  symbol: string,
  strategyName: StrategyName,
  exchangeName: ExchangeName,
  frameName: FrameName,
  timestamp: number
): string => {
  const parts = [symbol, strategyName, exchangeName];
  if (frameName) { parts.push(frameName); parts.push("backtest"); }
  else parts.push("live");
  return `${parts.join("_")}-${timestamp}.md`;
};

/** Maximum number of events to store */
const MAX_EVENTS = 250;

/**
 * Storage class for accumulating strategy events per symbol-strategy pair.
 */
class ReportStorage {
  private _eventList: StrategyEvent[] = [];

  constructor(
    readonly symbol: string,
    readonly strategyName: StrategyName,
    readonly exchangeName: ExchangeName,
    readonly frameName: FrameName
  ) {}

  public addEvent(event: StrategyEvent) {
    this._eventList.unshift(event);
    if (this._eventList.length > MAX_EVENTS) {
      this._eventList.pop();
    }
  }

  public async getData(): Promise<StrategyStatisticsModel> {
    if (this._eventList.length === 0) {
      return {
        eventList: [],
        totalEvents: 0,
        cancelScheduledCount: 0,
        closePendingCount: 0,
        partialProfitCount: 0,
        partialLossCount: 0,
        trailingStopCount: 0,
        trailingTakeCount: 0,
        breakevenCount: 0,
      };
    }

    return {
      eventList: this._eventList,
      totalEvents: this._eventList.length,
      cancelScheduledCount: this._eventList.filter(e => e.action === "cancel-scheduled").length,
      closePendingCount: this._eventList.filter(e => e.action === "close-pending").length,
      partialProfitCount: this._eventList.filter(e => e.action === "partial-profit").length,
      partialLossCount: this._eventList.filter(e => e.action === "partial-loss").length,
      trailingStopCount: this._eventList.filter(e => e.action === "trailing-stop").length,
      trailingTakeCount: this._eventList.filter(e => e.action === "trailing-take").length,
      breakevenCount: this._eventList.filter(e => e.action === "breakeven").length,
    };
  }

  public async getReport(
    symbol: string,
    strategyName: StrategyName,
    columns: Columns[] = COLUMN_CONFIG.strategy_columns
  ): Promise<string> {
    const stats = await this.getData();

    if (stats.totalEvents === 0) {
      return [
        `# Strategy Report: ${symbol}:${strategyName}`,
        "",
        "No strategy events recorded yet."
      ].join("\n");
    }

    const visibleColumns = [];
    for (const col of columns) {
      if (await col.isVisible()) {
        visibleColumns.push(col);
      }
    }
    const header = visibleColumns.map((col) => col.label);
    const separator = visibleColumns.map(() => "---");
    const rows = await Promise.all(
      this._eventList.map(async (event, index) =>
        Promise.all(visibleColumns.map((col) => col.format(event, index)))
      )
    );

    const tableData = [header, separator, ...rows];
    const table = tableData.map((row) => `| ${row.join(" | ")} |`).join("\n");

    return [
      `# Strategy Report: ${symbol}:${strategyName}`,
      "",
      table,
      "",
      `**Total events:** ${stats.totalEvents}`,
      `- Cancel scheduled: ${stats.cancelScheduledCount}`,
      `- Close pending: ${stats.closePendingCount}`,
      `- Partial profit: ${stats.partialProfitCount}`,
      `- Partial loss: ${stats.partialLossCount}`,
      `- Trailing stop: ${stats.trailingStopCount}`,
      `- Trailing take: ${stats.trailingTakeCount}`,
      `- Breakeven: ${stats.breakevenCount}`,
    ].join("\n");
  }

  public async dump(
    symbol: string,
    strategyName: StrategyName,
    path = "./dump/strategy",
    columns: Columns[] = COLUMN_CONFIG.strategy_columns
  ): Promise<void> {
    const markdown = await this.getReport(symbol, strategyName, columns);
    const timestamp = Date.now();
    const filename = CREATE_FILE_NAME_FN(this.symbol, strategyName, this.exchangeName, this.frameName, timestamp);
    await Markdown.writeData("strategy", markdown, {
      path,
      file: filename,
      symbol: this.symbol,
      strategyName: this.strategyName,
      exchangeName: this.exchangeName,
      signalId: "",
      frameName: this.frameName
    });
  }
}

export class StrategyMarkdownService {
  readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  readonly executionContextService = inject<TExecutionContextService>(
    TYPES.executionContextService,
  );
  readonly strategyCoreService = inject<StrategyCoreService>(
    TYPES.strategyCoreService,
  );

  private getStorage = memoize<(symbol: string, strategyName: StrategyName, exchangeName: ExchangeName, frameName: FrameName, backtest: boolean) => ReportStorage>(
    ([symbol, strategyName, exchangeName, frameName, backtest]) => CREATE_KEY_FN(symbol, strategyName, exchangeName, frameName, backtest),
    (symbol, strategyName, exchangeName, frameName) => new ReportStorage(symbol, strategyName, exchangeName, frameName)
  );

  public cancelScheduled = async (
    symbol: string,
    isBacktest: boolean,
    context: { strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName },
    cancelId?: string,
  ) => {
    this.loggerService.log("strategyMarkdownService cancelScheduled", {
      symbol,
      isBacktest,
      cancelId,
    });
    if (!this.subscribe.hasValue()) {
      return;
    }
    const { when: createdAt } = GET_EXECUTION_CONTEXT_FN(this);
    const scheduledRow = await this.strategyCoreService.getScheduledSignal(
      isBacktest,
      symbol,
      {
        exchangeName: context.exchangeName,
        strategyName: context.strategyName,
        frameName: context.frameName,
      },
    );
    if (!scheduledRow) {
      return;
    }
    const storage = this.getStorage(symbol, context.strategyName, context.exchangeName, context.frameName, isBacktest);
    storage.addEvent({
      timestamp: Date.now(),
      symbol,
      strategyName: context.strategyName,
      exchangeName: context.exchangeName,
      frameName: context.frameName,
      signalId: scheduledRow.id,
      action: "cancel-scheduled",
      cancelId,
      createdAt,
      backtest: isBacktest,
    });
  };

  public closePending = async (
    symbol: string,
    isBacktest: boolean,
    context: { strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName },
    closeId?: string,
  ) => {
    this.loggerService.log("strategyMarkdownService closePending", {
      symbol,
      isBacktest,
      closeId,
    });
    if (!this.subscribe.hasValue()) {
      return;
    }
    const { when: createdAt } = GET_EXECUTION_CONTEXT_FN(this);
    const pendingRow = await this.strategyCoreService.getPendingSignal(
      isBacktest,
      symbol,
      {
        exchangeName: context.exchangeName,
        strategyName: context.strategyName,
        frameName: context.frameName,
      },
    );
    if (!pendingRow) {
      return;
    }
    const storage = this.getStorage(symbol, context.strategyName, context.exchangeName, context.frameName, isBacktest);
    storage.addEvent({
      timestamp: Date.now(),
      symbol,
      strategyName: context.strategyName,
      exchangeName: context.exchangeName,
      frameName: context.frameName,
      signalId: pendingRow.id,
      action: "close-pending",
      closeId,
      createdAt,
      backtest: isBacktest,
    });
  };

  public partialProfit = async (
    symbol: string,
    percentToClose: number,
    currentPrice: number,
    isBacktest: boolean,
    context: { strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName },
  ) => {
    this.loggerService.log("strategyMarkdownService partialProfit", {
      symbol,
      percentToClose,
      currentPrice,
      isBacktest,
    });
    if (!this.subscribe.hasValue()) {
      return;
    }
    const { when: createdAt } = GET_EXECUTION_CONTEXT_FN(this);
    const pendingRow = await this.strategyCoreService.getPendingSignal(
      isBacktest,
      symbol,
      {
        exchangeName: context.exchangeName,
        strategyName: context.strategyName,
        frameName: context.frameName,
      },
    );
    if (!pendingRow) {
      return;
    }
    const storage = this.getStorage(symbol, context.strategyName, context.exchangeName, context.frameName, isBacktest);
    storage.addEvent({
      timestamp: Date.now(),
      symbol,
      strategyName: context.strategyName,
      exchangeName: context.exchangeName,
      frameName: context.frameName,
      signalId: pendingRow.id,
      action: "partial-profit",
      percentToClose,
      currentPrice,
      createdAt,
      backtest: isBacktest,
    });
  };

  public partialLoss = async (
    symbol: string,
    percentToClose: number,
    currentPrice: number,
    isBacktest: boolean,
    context: { strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName },
  ) => {
    this.loggerService.log("strategyMarkdownService partialLoss", {
      symbol,
      percentToClose,
      currentPrice,
      isBacktest,
    });
    if (!this.subscribe.hasValue()) {
      return;
    }
    const { when: createdAt } = GET_EXECUTION_CONTEXT_FN(this);
    const pendingRow = await this.strategyCoreService.getPendingSignal(
      isBacktest,
      symbol,
      {
        exchangeName: context.exchangeName,
        strategyName: context.strategyName,
        frameName: context.frameName,
      },
    );
    if (!pendingRow) {
      return;
    }
    const storage = this.getStorage(symbol, context.strategyName, context.exchangeName, context.frameName, isBacktest);
    storage.addEvent({
      timestamp: Date.now(),
      symbol,
      strategyName: context.strategyName,
      exchangeName: context.exchangeName,
      frameName: context.frameName,
      signalId: pendingRow.id,
      action: "partial-loss",
      percentToClose,
      currentPrice,
      createdAt,
      backtest: isBacktest,
    });
  };

  public trailingStop = async (
    symbol: string,
    percentShift: number,
    currentPrice: number,
    isBacktest: boolean,
    context: { strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName },
  ) => {
    this.loggerService.log("strategyMarkdownService trailingStop", {
      symbol,
      percentShift,
      currentPrice,
      isBacktest,
    });
    if (!this.subscribe.hasValue()) {
      return;
    }
    const { when: createdAt } = GET_EXECUTION_CONTEXT_FN(this);
    const pendingRow = await this.strategyCoreService.getPendingSignal(
      isBacktest,
      symbol,
      {
        exchangeName: context.exchangeName,
        strategyName: context.strategyName,
        frameName: context.frameName,
      },
    );
    if (!pendingRow) {
      return;
    }
    const storage = this.getStorage(symbol, context.strategyName, context.exchangeName, context.frameName, isBacktest);
    storage.addEvent({
      timestamp: Date.now(),
      symbol,
      strategyName: context.strategyName,
      exchangeName: context.exchangeName,
      frameName: context.frameName,
      signalId: pendingRow.id,
      action: "trailing-stop",
      percentShift,
      currentPrice,
      createdAt,
      backtest: isBacktest,
    });
  };

  public trailingTake = async (
    symbol: string,
    percentShift: number,
    currentPrice: number,
    isBacktest: boolean,
    context: { strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName },
  ) => {
    this.loggerService.log("strategyMarkdownService trailingTake", {
      symbol,
      percentShift,
      currentPrice,
      isBacktest,
    });
    if (!this.subscribe.hasValue()) {
      return;
    }
    const { when: createdAt } = GET_EXECUTION_CONTEXT_FN(this);
    const pendingRow = await this.strategyCoreService.getPendingSignal(
      isBacktest,
      symbol,
      {
        exchangeName: context.exchangeName,
        strategyName: context.strategyName,
        frameName: context.frameName,
      },
    );
    if (!pendingRow) {
      return;
    }
    const storage = this.getStorage(symbol, context.strategyName, context.exchangeName, context.frameName, isBacktest);
    storage.addEvent({
      timestamp: Date.now(),
      symbol,
      strategyName: context.strategyName,
      exchangeName: context.exchangeName,
      frameName: context.frameName,
      signalId: pendingRow.id,
      action: "trailing-take",
      percentShift,
      currentPrice,
      createdAt,
      backtest: isBacktest,
    });
  };

  public breakeven = async (
    symbol: string,
    currentPrice: number,
    isBacktest: boolean,
    context: { strategyName: StrategyName; exchangeName: ExchangeName; frameName: FrameName },
  ) => {
    this.loggerService.log("strategyMarkdownService breakeven", {
      symbol,
      currentPrice,
      isBacktest,
    });
    if (!this.subscribe.hasValue()) {
      return;
    }
    const { when: createdAt } = GET_EXECUTION_CONTEXT_FN(this);
    const pendingRow = await this.strategyCoreService.getPendingSignal(
      isBacktest,
      symbol,
      {
        exchangeName: context.exchangeName,
        strategyName: context.strategyName,
        frameName: context.frameName,
      },
    );
    if (!pendingRow) {
      return;
    }
    const storage = this.getStorage(symbol, context.strategyName, context.exchangeName, context.frameName, isBacktest);
    storage.addEvent({
      timestamp: Date.now(),
      symbol,
      strategyName: context.strategyName,
      exchangeName: context.exchangeName,
      frameName: context.frameName,
      signalId: pendingRow.id,
      action: "breakeven",
      currentPrice,
      createdAt,
      backtest: isBacktest,
    });
  };

  public getData = async (
    symbol: string,
    strategyName: StrategyName,
    exchangeName: ExchangeName,
    frameName: FrameName,
    backtest: boolean
  ): Promise<StrategyStatisticsModel> => {
    this.loggerService.log("strategyMarkdownService getData", {
      symbol,
      strategyName,
      exchangeName,
      frameName,
      backtest,
    });
    if (!this.subscribe.hasValue()) {
      throw new Error("StrategyMarkdownService not initialized. Call subscribe() before getting data.");
    }
    const storage = this.getStorage(symbol, strategyName, exchangeName, frameName, backtest);
    return storage.getData();
  };

  public getReport = async (
    symbol: string,
    strategyName: StrategyName,
    exchangeName: ExchangeName,
    frameName: FrameName,
    backtest: boolean,
    columns: Columns[] = COLUMN_CONFIG.strategy_columns
  ): Promise<string> => {
    this.loggerService.log("strategyMarkdownService getReport", {
      symbol,
      strategyName,
      exchangeName,
      frameName,
      backtest,
    });
    if (!this.subscribe.hasValue()) {
      throw new Error("StrategyMarkdownService not initialized. Call subscribe() before generating reports.");
    }
    const storage = this.getStorage(symbol, strategyName, exchangeName, frameName, backtest);
    return storage.getReport(symbol, strategyName, columns);
  };

  public dump = async (
    symbol: string,
    strategyName: StrategyName,
    exchangeName: ExchangeName,
    frameName: FrameName,
    backtest: boolean,
    path = "./dump/strategy",
    columns: Columns[] = COLUMN_CONFIG.strategy_columns
  ): Promise<void> => {
    this.loggerService.log("strategyMarkdownService dump", {
      symbol,
      strategyName,
      exchangeName,
      frameName,
      backtest,
      path,
    });
    if (!this.subscribe.hasValue()) {
      throw new Error("StrategyMarkdownService not initialized. Call subscribe() before dumping reports.");
    }
    const storage = this.getStorage(symbol, strategyName, exchangeName, frameName, backtest);
    await storage.dump(symbol, strategyName, path, columns);
  };

  public clear = async (payload?: {
    symbol: string;
    strategyName: StrategyName;
    exchangeName: ExchangeName;
    frameName: FrameName;
    backtest: boolean;
  }) => {
    this.loggerService.log("strategyMarkdownService clear", { payload });
    if (payload) {
      const key = CREATE_KEY_FN(payload.symbol, payload.strategyName, payload.exchangeName, payload.frameName, payload.backtest);
      this.getStorage.clear(key);
    } else {
      this.getStorage.clear();
    }
  };

  public subscribe = singleshot(() => {
    this.loggerService.log("strategyMarkdownService subscribe");
    return () => {
      this.subscribe.clear();
      this.clear();
    };
  });

  public unsubscribe = async () => {
    this.loggerService.log("strategyMarkdownService unsubscribe");
    if (this.subscribe.hasValue()) {
      const lastSubscription = this.subscribe();
      lastSubscription();
    }
  };
}

export default StrategyMarkdownService;
