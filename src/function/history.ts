import { MessageModel } from "../model/Message.model";
import backtest, {
  ExecutionContextService,
  MethodContextService,
} from "../lib/index";

const METHOD_NAME_SIGNAL = "history.commitSignalPromptHistory";
const METHOD_NAME_RISK = "history.commitRiskPromptHistory";
const METHOD_NAME_TRAILING_TAKE = "history.commitTrailingTakePromptHistory";
const METHOD_NAME_TRAILING_STOP = "history.commitTrailingStopPromptHistory";
const METHOD_NAME_PARTIAL_PROFIT = "history.commitPartialProfitPromptHistory";
const METHOD_NAME_PARTIAL_LOSS = "history.commitPartialLossPromptHistory";
const METHOD_NAME_BREAKEVEN = "history.commitBreakevenPromptHistory";
const METHOD_NAME_SCHEDULE_CANCEL = "history.commitScheduleCancelPromptHistory";

/**
 * Commits signal prompt history to the message array.
 *
 * Extracts symbol from ExecutionContext and strategyName from MethodContext,
 * validates strategy existence and adds system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitSignalPromptHistory(messages);
 * // messages now contains system prompts at start and user prompt at end
 * ```
 */
export async function commitSignalPromptHistory(
  history: MessageModel[]
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_SIGNAL);

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitSignalPromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitSignalPromptHistory requires a method context");
  }

  const { symbol, backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } = backtest.methodContextService.context;

  const systemPrompts = await backtest.signalPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );
  const userPrompt = await backtest.signalPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );

  if (systemPrompts.length > 0) {
    for (const content of systemPrompts) {
      history.unshift({
        role: "system",
        content,
      });
    }
  }

  if (userPrompt && userPrompt.trim() !== "") {
    history.push({
      role: "user",
      content: userPrompt,
    });
  }
}

/**
 * Commits risk rejection prompt history to the message array.
 *
 * Extracts symbol from ExecutionContext and strategyName from MethodContext,
 * validates strategy existence and adds system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitRiskPromptHistory(messages);
 * ```
 */
export async function commitRiskPromptHistory(
  history: MessageModel[]
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_RISK);

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitRiskPromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitRiskPromptHistory requires a method context");
  }

  const { symbol, backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } = backtest.methodContextService.context;

  const systemPrompts = await backtest.riskPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );
  const userPrompt = await backtest.riskPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );

  if (systemPrompts.length > 0) {
    for (const content of systemPrompts) {
      history.unshift({
        role: "system",
        content,
      });
    }
  }

  if (userPrompt && userPrompt.trim() !== "") {
    history.push({
      role: "user",
      content: userPrompt,
    });
  }
}

/**
 * Commits trailing take-profit prompt history to the message array.
 *
 * Extracts symbol from ExecutionContext and strategyName from MethodContext,
 * validates strategy existence and adds system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitTrailingTakePromptHistory(messages);
 * ```
 */
export async function commitTrailingTakePromptHistory(
  history: MessageModel[]
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_TRAILING_TAKE);

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitTrailingTakePromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitTrailingTakePromptHistory requires a method context");
  }

  const { symbol, backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } = backtest.methodContextService.context;

  const systemPrompts = await backtest.trailingTakePromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );
  const userPrompt = await backtest.trailingTakePromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );

  if (systemPrompts.length > 0) {
    for (const content of systemPrompts) {
      history.unshift({
        role: "system",
        content,
      });
    }
  }

  if (userPrompt && userPrompt.trim() !== "") {
    history.push({
      role: "user",
      content: userPrompt,
    });
  }
}

/**
 * Commits trailing stop-loss prompt history to the message array.
 *
 * Extracts symbol from ExecutionContext and strategyName from MethodContext,
 * validates strategy existence and adds system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitTrailingStopPromptHistory(messages);
 * ```
 */
export async function commitTrailingStopPromptHistory(
  history: MessageModel[]
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_TRAILING_STOP);

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitTrailingStopPromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitTrailingStopPromptHistory requires a method context");
  }

  const { symbol, backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } = backtest.methodContextService.context;

  const systemPrompts = await backtest.trailingStopPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );
  const userPrompt = await backtest.trailingStopPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );

  if (systemPrompts.length > 0) {
    for (const content of systemPrompts) {
      history.unshift({
        role: "system",
        content,
      });
    }
  }

  if (userPrompt && userPrompt.trim() !== "") {
    history.push({
      role: "user",
      content: userPrompt,
    });
  }
}

/**
 * Commits partial profit prompt history to the message array.
 *
 * Extracts symbol from ExecutionContext and strategyName from MethodContext,
 * validates strategy existence and adds system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitPartialProfitPromptHistory(messages);
 * ```
 */
export async function commitPartialProfitPromptHistory(
  history: MessageModel[]
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_PARTIAL_PROFIT);

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitPartialProfitPromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitPartialProfitPromptHistory requires a method context");
  }

  const { symbol, backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } = backtest.methodContextService.context;

  const systemPrompts = await backtest.partialProfitPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );
  const userPrompt = await backtest.partialProfitPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );

  if (systemPrompts.length > 0) {
    for (const content of systemPrompts) {
      history.unshift({
        role: "system",
        content,
      });
    }
  }

  if (userPrompt && userPrompt.trim() !== "") {
    history.push({
      role: "user",
      content: userPrompt,
    });
  }
}

/**
 * Commits partial loss prompt history to the message array.
 *
 * Extracts symbol from ExecutionContext and strategyName from MethodContext,
 * validates strategy existence and adds system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitPartialLossPromptHistory(messages);
 * ```
 */
export async function commitPartialLossPromptHistory(
  history: MessageModel[]
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_PARTIAL_LOSS);

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitPartialLossPromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitPartialLossPromptHistory requires a method context");
  }

  const { symbol, backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } = backtest.methodContextService.context;

  const systemPrompts = await backtest.partialLossPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );
  const userPrompt = await backtest.partialLossPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );

  if (systemPrompts.length > 0) {
    for (const content of systemPrompts) {
      history.unshift({
        role: "system",
        content,
      });
    }
  }

  if (userPrompt && userPrompt.trim() !== "") {
    history.push({
      role: "user",
      content: userPrompt,
    });
  }
}

/**
 * Commits breakeven prompt history to the message array.
 *
 * Extracts symbol from ExecutionContext and strategyName from MethodContext,
 * validates strategy existence and adds system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitBreakevenPromptHistory(messages);
 * ```
 */
export async function commitBreakevenPromptHistory(
  history: MessageModel[]
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_BREAKEVEN);

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitBreakevenPromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitBreakevenPromptHistory requires a method context");
  }

  const { symbol, backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } = backtest.methodContextService.context;

  const systemPrompts = await backtest.breakevenPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );
  const userPrompt = await backtest.breakevenPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );

  if (systemPrompts.length > 0) {
    for (const content of systemPrompts) {
      history.unshift({
        role: "system",
        content,
      });
    }
  }

  if (userPrompt && userPrompt.trim() !== "") {
    history.push({
      role: "user",
      content: userPrompt,
    });
  }
}

/**
 * Commits schedule cancellation prompt history to the message array.
 *
 * Extracts symbol from ExecutionContext and strategyName from MethodContext,
 * validates strategy existence and adds system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitScheduleCancelPromptHistory(messages);
 * ```
 */
export async function commitScheduleCancelPromptHistory(
  history: MessageModel[]
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_SCHEDULE_CANCEL);

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitScheduleCancelPromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitScheduleCancelPromptHistory requires a method context");
  }

  const { symbol, backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } = backtest.methodContextService.context;

  const systemPrompts = await backtest.scheduleCancelPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );
  const userPrompt = await backtest.scheduleCancelPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest
  );

  if (systemPrompts.length > 0) {
    for (const content of systemPrompts) {
      history.unshift({
        role: "system",
        content,
      });
    }
  }

  if (userPrompt && userPrompt.trim() !== "") {
    history.push({
      role: "user",
      content: userPrompt,
    });
  }
}
