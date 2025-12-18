---
title: docs/interface/IExchangeParams
group: docs
---

# IExchangeParams

Exchange parameters passed to ClientExchange constructor.
Combines schema with runtime dependencies.

## Properties

### logger

```ts
logger: ILogger
```

Logger service for debug output

### execution

```ts
execution: { readonly context: IExecutionContext; }
```

Execution context service (symbol, when, backtest flag)
