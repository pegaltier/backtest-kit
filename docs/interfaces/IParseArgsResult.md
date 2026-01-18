---
title: docs/interface/IParseArgsResult
group: docs
---

# IParseArgsResult

Result of parseArgs function.
Extends input parameters with trading mode flags parsed from command-line arguments.

## Properties

### backtest

```ts
backtest: boolean
```

Whether to run in backtest mode (historical data simulation)

### paper

```ts
paper: boolean
```

Whether to run in paper trading mode (simulated trading with live data)

### live

```ts
live: boolean
```

Whether to run in live trading mode (real trading with real money)
