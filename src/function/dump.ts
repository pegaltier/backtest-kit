import backtest, {
  ExecutionContextService,
  MethodContextService,
} from "../lib";
import { Dump } from "../classes/Dump";
import MessageModel from "../model/Message.model";

const DUMP_AGENT_ANSWER_METHOD_NAME = "dump.dumpAgentAnswer";
const DUMP_RECORD_METHOD_NAME = "dump.dumpRecord";
const DUMP_TABLE_METHOD_NAME = "dump.dumpTable";

/**
 * Dumps the full agent message history scoped to the current signal.
 *
 * Reads signalId from the active pending signal via execution and method context.
 * If no pending signal exists, logs a warning and returns without writing.
 *
 * @param dto.bucketName - Bucket name grouping dumps by strategy or agent name
 * @param dto.dumpId - Unique identifier for this agent invocation
 * @param dto.messages - Full chat history (system, user, assistant, tool)
 * @returns Promise that resolves when the dump is complete
 *
 * @deprecated Better use Dump.dumpAgentAnswer with manual signalId argument
 *
 * @example
 * ```typescript
 * import { dumpAgentAnswer } from "backtest-kit";
 *
 * await dumpAgentAnswer({ bucketName: "my-strategy", dumpId: "reasoning-1", messages });
 * ```
 */
export async function dumpAgentAnswer(dto: {
  bucketName: string;
  dumpId: string;
  messages: MessageModel[];
}): Promise<void> {
  const { bucketName, dumpId, messages } = dto;
  backtest.loggerService.info(DUMP_AGENT_ANSWER_METHOD_NAME, {
    bucketName,
    dumpId,
    messagesLen: messages.length,
  });
  if (!ExecutionContextService.hasContext()) {
    throw new Error("dumpAgentAnswer requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("dumpAgentAnswer requires a method context");
  }
  const { backtest: isBacktest, symbol } = backtest.executionContextService.context;
  const { exchangeName, frameName, strategyName } =
    backtest.methodContextService.context;
  const currentPrice =
    await backtest.exchangeConnectionService.getAveragePrice(symbol);
  const signal = await backtest.strategyCoreService.getPendingSignal(
    isBacktest,
    symbol,
    currentPrice,
    { exchangeName, frameName, strategyName },
  );
  if (!signal) {
    console.warn(`backtest-kit dumpAgentAnswer no pending signal for symbol=${symbol} dumpId=${dumpId}`);
    return;
  }
  await Dump.dumpAgentAnswer(messages, {
    dumpId,
    bucketName,
    signalId: signal.id,
  });
}

/**
 * Dumps a flat key-value record scoped to the current signal.
 *
 * Reads signalId from the active pending signal via execution and method context.
 * If no pending signal exists, logs a warning and returns without writing.
 *
 * @param dto.bucketName - Bucket name grouping dumps by strategy or agent name
 * @param dto.dumpId - Unique identifier for this dump entry
 * @param dto.record - Arbitrary flat object to persist
 * @returns Promise that resolves when the dump is complete
 *
 * @deprecated Better use Dump.dumpRecord with manual signalId argument
 *
 * @example
 * ```typescript
 * import { dumpRecord } from "backtest-kit";
 *
 * await dumpRecord({ bucketName: "my-strategy", dumpId: "context", record: { price: 42000, signal: "long" } });
 * ```
 */
export async function dumpRecord(dto: {
  bucketName: string;
  dumpId: string;
  record: Record<string, unknown>;
}): Promise<void> {
  const { bucketName, dumpId, record } = dto;
  backtest.loggerService.info(DUMP_RECORD_METHOD_NAME, {
    bucketName,
    dumpId,
  });
  if (!ExecutionContextService.hasContext()) {
    throw new Error("dumpRecord requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("dumpRecord requires a method context");
  }
  const { backtest: isBacktest, symbol } = backtest.executionContextService.context;
  const { exchangeName, frameName, strategyName } =
    backtest.methodContextService.context;
  const currentPrice =
    await backtest.exchangeConnectionService.getAveragePrice(symbol);
  const signal = await backtest.strategyCoreService.getPendingSignal(
    isBacktest,
    symbol,
    currentPrice,
    { exchangeName, frameName, strategyName },
  );
  if (!signal) {
    console.warn(`backtest-kit dumpRecord no pending signal for symbol=${symbol} dumpId=${dumpId}`);
    return;
  }
  await Dump.dumpRecord(record, {
    dumpId,
    bucketName,
    signalId: signal.id,
  });
}

/**
 * Dumps an array of objects as a table scoped to the current signal.
 *
 * Reads signalId from the active pending signal via execution and method context.
 * If no pending signal exists, logs a warning and returns without writing.
 *
 * Column headers are derived from the union of all keys across all rows.
 *
 * @param dto.bucketName - Bucket name grouping dumps by strategy or agent name
 * @param dto.dumpId - Unique identifier for this dump entry
 * @param dto.rows - Array of arbitrary objects to render as a table
 * @returns Promise that resolves when the dump is complete
 *
 * @deprecated Better use Dump.dumpTable with manual signalId argument
 *
 * @example
 * ```typescript
 * import { dumpTable } from "backtest-kit";
 *
 * await dumpTable({ bucketName: "my-strategy", dumpId: "candles", rows: [{ time: 1234, close: 42000 }] });
 * ```
 */
export async function dumpTable(dto: {
  bucketName: string;
  dumpId: string;
  rows: Record<string, unknown>[];
}): Promise<void> {
  const { bucketName, dumpId, rows } = dto;
  backtest.loggerService.info(DUMP_TABLE_METHOD_NAME, {
    bucketName,
    dumpId,
    rowsLen: rows.length,
  });
  if (!ExecutionContextService.hasContext()) {
    throw new Error("dumpTable requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("dumpTable requires a method context");
  }
  const { backtest: isBacktest, symbol } = backtest.executionContextService.context;
  const { exchangeName, frameName, strategyName } =
    backtest.methodContextService.context;
  const currentPrice =
    await backtest.exchangeConnectionService.getAveragePrice(symbol);
  const signal = await backtest.strategyCoreService.getPendingSignal(
    isBacktest,
    symbol,
    currentPrice,
    { exchangeName, frameName, strategyName },
  );
  if (!signal) {
    console.warn(`backtest-kit dumpTable no pending signal for symbol=${symbol} dumpId=${dumpId}`);
    return;
  }
  await Dump.dumpTable(rows, {
    dumpId,
    bucketName,
    signalId: signal.id,
  });
}
