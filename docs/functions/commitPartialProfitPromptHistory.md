---
title: docs/function/commitPartialProfitPromptHistory
group: docs
---

# commitPartialProfitPromptHistory

```ts
declare function commitPartialProfitPromptHistory(symbol: string, history: MessageModel[]): Promise<void>;
```

Commits partial profit prompt history to the message array.

Extracts trading context from ExecutionContext and MethodContext,
then adds partial profit specific system prompts at the beginning
and user prompt at the end of the history array if they are not empty.

Context extraction:
- symbol: Provided as parameter for debugging convenience
- backtest mode: From ExecutionContext
- strategyName, exchangeName, frameName: From MethodContext

Used for AI-powered analysis of partial profit milestones.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading symbol (e.g., "BTCUSDT") for debugging convenience |
| `history` | Message array to append prompts to |
