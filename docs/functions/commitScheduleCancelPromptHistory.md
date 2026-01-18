---
title: docs/function/commitScheduleCancelPromptHistory
group: docs
---

# commitScheduleCancelPromptHistory

```ts
declare function commitScheduleCancelPromptHistory(symbol: string, history: MessageModel[]): Promise<void>;
```

Commits schedule cancellation prompt history to the message array.

Extracts trading context from ExecutionContext and MethodContext,
then adds schedule cancellation specific system prompts at the beginning
and user prompt at the end of the history array if they are not empty.

Context extraction:
- symbol: Provided as parameter for debugging convenience
- backtest mode: From ExecutionContext
- strategyName, exchangeName, frameName: From MethodContext

Used for AI-powered analysis of schedule cancellation events.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading symbol (e.g., "BTCUSDT") for debugging convenience |
| `history` | Message array to append prompts to |
