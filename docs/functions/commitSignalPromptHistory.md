---
title: docs/function/commitSignalPromptHistory
group: docs
---

# commitSignalPromptHistory

```ts
declare function commitSignalPromptHistory(symbol: string, history: MessageModel[]): Promise<void>;
```

Commits signal prompt history to the message array.

Extracts trading context from ExecutionContext and MethodContext,
then adds signal-specific system prompts at the beginning and user prompt
at the end of the history array if they are not empty.

Context extraction:
- symbol: Provided as parameter for debugging convenience
- backtest mode: From ExecutionContext
- strategyName, exchangeName, frameName: From MethodContext

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading symbol (e.g., "BTCUSDT") for debugging convenience |
| `history` | Message array to append prompts to |
