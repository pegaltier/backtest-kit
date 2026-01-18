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
 * Extracts trading context from ExecutionContext and MethodContext,
 * then adds signal-specific system prompts at the beginning and user prompt
 * at the end of the history array if they are not empty.
 *
 * Context extraction:
 * - symbol: Provided as parameter for debugging convenience
 * - backtest mode: From ExecutionContext
 * - strategyName, exchangeName, frameName: From MethodContext
 *
 * @param symbol - Trading symbol (e.g., "BTCUSDT") for debugging convenience
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitSignalPromptHistory("BTCUSDT", messages);
 * // messages now contains system prompts at start and user prompt at end
 * ```
 */
export async function commitSignalPromptHistory(
  symbol: string,
  history: MessageModel[],
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_SIGNAL, {
    symbol,
  });

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitSignalPromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitSignalPromptHistory requires a method context");
  }

  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } =
    backtest.methodContextService.context;

  const systemPrompts = await backtest.signalPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
  );
  const userPrompt = await backtest.signalPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
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
 * Extracts trading context from ExecutionContext and MethodContext,
 * then adds risk-specific system prompts at the beginning and user prompt
 * at the end of the history array if they are not empty.
 *
 * Context extraction:
 * - symbol: Provided as parameter for debugging convenience
 * - backtest mode: From ExecutionContext
 * - strategyName, exchangeName, frameName: From MethodContext
 *
 * Used for AI-powered analysis when signals fail risk validation.
 *
 * @param symbol - Trading symbol (e.g., "BTCUSDT") for debugging convenience
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitRiskPromptHistory("BTCUSDT", messages);
 * ```
 */
export async function commitRiskPromptHistory(
  symbol: string,
  history: MessageModel[],
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_RISK, {
    symbol,
  });

  if (!ExecutionContextService.hasContext()) {
    throw new Error("commitRiskPromptHistory requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitRiskPromptHistory requires a method context");
  }

  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } =
    backtest.methodContextService.context;

  const systemPrompts = await backtest.riskPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
  );
  const userPrompt = await backtest.riskPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
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
 * Extracts trading context from ExecutionContext and MethodContext,
 * then adds trailing take-profit specific system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * Context extraction:
 * - symbol: Provided as parameter for debugging convenience
 * - backtest mode: From ExecutionContext
 * - strategyName, exchangeName, frameName: From MethodContext
 *
 * Used for AI-powered analysis of trailing take-profit adjustments.
 *
 * @param symbol - Trading symbol (e.g., "BTCUSDT") for debugging convenience
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitTrailingTakePromptHistory("BTCUSDT", messages);
 * ```
 */
export async function commitTrailingTakePromptHistory(
  symbol: string,
  history: MessageModel[],
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_TRAILING_TAKE, {
    symbol,
  });

  if (!ExecutionContextService.hasContext()) {
    throw new Error(
      "commitTrailingTakePromptHistory requires an execution context",
    );
  }
  if (!MethodContextService.hasContext()) {
    throw new Error(
      "commitTrailingTakePromptHistory requires a method context",
    );
  }

  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } =
    backtest.methodContextService.context;

  const systemPrompts =
    await backtest.trailingTakePromptService.getSystemPrompt(
      symbol,
      strategyName,
      exchangeName,
      frameName,
      isBacktest,
    );
  const userPrompt = await backtest.trailingTakePromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
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
 * Extracts trading context from ExecutionContext and MethodContext,
 * then adds trailing stop-loss specific system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * Context extraction:
 * - symbol: Provided as parameter for debugging convenience
 * - backtest mode: From ExecutionContext
 * - strategyName, exchangeName, frameName: From MethodContext
 *
 * Used for AI-powered analysis of trailing stop-loss adjustments.
 *
 * @param symbol - Trading symbol (e.g., "BTCUSDT") for debugging convenience
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitTrailingStopPromptHistory("BTCUSDT", messages);
 * ```
 */
export async function commitTrailingStopPromptHistory(
  symbol: string,
  history: MessageModel[],
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_TRAILING_STOP, {
    symbol,
  });

  if (!ExecutionContextService.hasContext()) {
    throw new Error(
      "commitTrailingStopPromptHistory requires an execution context",
    );
  }
  if (!MethodContextService.hasContext()) {
    throw new Error(
      "commitTrailingStopPromptHistory requires a method context",
    );
  }

  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } =
    backtest.methodContextService.context;

  const systemPrompts =
    await backtest.trailingStopPromptService.getSystemPrompt(
      symbol,
      strategyName,
      exchangeName,
      frameName,
      isBacktest,
    );
  const userPrompt = await backtest.trailingStopPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
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
 * Extracts trading context from ExecutionContext and MethodContext,
 * then adds partial profit specific system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * Context extraction:
 * - symbol: Provided as parameter for debugging convenience
 * - backtest mode: From ExecutionContext
 * - strategyName, exchangeName, frameName: From MethodContext
 *
 * Used for AI-powered analysis of partial profit milestones.
 *
 * @param symbol - Trading symbol (e.g., "BTCUSDT") for debugging convenience
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitPartialProfitPromptHistory("BTCUSDT", messages);
 * ```
 */
export async function commitPartialProfitPromptHistory(
  symbol: string,
  history: MessageModel[],
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_PARTIAL_PROFIT, {
    symbol,
  });

  if (!ExecutionContextService.hasContext()) {
    throw new Error(
      "commitPartialProfitPromptHistory requires an execution context",
    );
  }
  if (!MethodContextService.hasContext()) {
    throw new Error(
      "commitPartialProfitPromptHistory requires a method context",
    );
  }

  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } =
    backtest.methodContextService.context;

  const systemPrompts =
    await backtest.partialProfitPromptService.getSystemPrompt(
      symbol,
      strategyName,
      exchangeName,
      frameName,
      isBacktest,
    );
  const userPrompt = await backtest.partialProfitPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
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
 * Extracts trading context from ExecutionContext and MethodContext,
 * then adds partial loss specific system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * Context extraction:
 * - symbol: Provided as parameter for debugging convenience
 * - backtest mode: From ExecutionContext
 * - strategyName, exchangeName, frameName: From MethodContext
 *
 * Used for AI-powered analysis of partial loss milestones.
 *
 * @param symbol - Trading symbol (e.g., "BTCUSDT") for debugging convenience
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitPartialLossPromptHistory("BTCUSDT", messages);
 * ```
 */
export async function commitPartialLossPromptHistory(
  symbol: string,
  history: MessageModel[],
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_PARTIAL_LOSS, {
    symbol,
  });

  if (!ExecutionContextService.hasContext()) {
    throw new Error(
      "commitPartialLossPromptHistory requires an execution context",
    );
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitPartialLossPromptHistory requires a method context");
  }

  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } =
    backtest.methodContextService.context;

  const systemPrompts = await backtest.partialLossPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
  );
  const userPrompt = await backtest.partialLossPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
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
 * Extracts trading context from ExecutionContext and MethodContext,
 * then adds breakeven specific system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * Context extraction:
 * - symbol: Provided as parameter for debugging convenience
 * - backtest mode: From ExecutionContext
 * - strategyName, exchangeName, frameName: From MethodContext
 *
 * Used for AI-powered analysis of breakeven events.
 *
 * @param symbol - Trading symbol (e.g., "BTCUSDT") for debugging convenience
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitBreakevenPromptHistory("BTCUSDT", messages);
 * ```
 */
export async function commitBreakevenPromptHistory(
  symbol: string,
  history: MessageModel[],
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_BREAKEVEN, {
    symbol,
  });

  if (!ExecutionContextService.hasContext()) {
    throw new Error(
      "commitBreakevenPromptHistory requires an execution context",
    );
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("commitBreakevenPromptHistory requires a method context");
  }

  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } =
    backtest.methodContextService.context;

  const systemPrompts = await backtest.breakevenPromptService.getSystemPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
  );
  const userPrompt = await backtest.breakevenPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
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
 * Extracts trading context from ExecutionContext and MethodContext,
 * then adds schedule cancellation specific system prompts at the beginning
 * and user prompt at the end of the history array if they are not empty.
 *
 * Context extraction:
 * - symbol: Provided as parameter for debugging convenience
 * - backtest mode: From ExecutionContext
 * - strategyName, exchangeName, frameName: From MethodContext
 *
 * Used for AI-powered analysis of schedule cancellation events.
 *
 * @param symbol - Trading symbol (e.g., "BTCUSDT") for debugging convenience
 * @param history - Message array to append prompts to
 * @returns Promise that resolves when prompts are added
 * @throws Error if ExecutionContext or MethodContext is not active
 *
 * @example
 * ```typescript
 * const messages: MessageModel[] = [];
 * await commitScheduleCancelPromptHistory("BTCUSDT", messages);
 * ```
 */
export async function commitScheduleCancelPromptHistory(
  symbol: string,
  history: MessageModel[],
): Promise<void> {
  backtest.loggerService.log(METHOD_NAME_SCHEDULE_CANCEL, {
    symbol,
  });

  if (!ExecutionContextService.hasContext()) {
    throw new Error(
      "commitScheduleCancelPromptHistory requires an execution context",
    );
  }
  if (!MethodContextService.hasContext()) {
    throw new Error(
      "commitScheduleCancelPromptHistory requires a method context",
    );
  }

  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { strategyName, exchangeName, frameName } =
    backtest.methodContextService.context;

  const systemPrompts =
    await backtest.scheduleCancelPromptService.getSystemPrompt(
      symbol,
      strategyName,
      exchangeName,
      frameName,
      isBacktest,
    );
  const userPrompt = await backtest.scheduleCancelPromptService.getUserPrompt(
    symbol,
    strategyName,
    exchangeName,
    frameName,
    isBacktest,
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
