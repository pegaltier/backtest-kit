---
title: docs/interface/IParseArgsParams
group: docs
---

# IParseArgsParams

Input parameters for parseArgs function.
Defines the default values for command-line argument parsing.

## Properties

### symbol

```ts
symbol: string
```

Trading pair symbol (e.g., "BTCUSDT", "ETHUSDT")

### strategyName

```ts
strategyName: StrategyName$1
```

Name of the trading strategy to execute

### exchangeName

```ts
exchangeName: ExchangeName$1
```

Name of the exchange to connect to (e.g., "binance", "bybit")

### frameName

```ts
frameName: FrameName$1
```

Timeframe for candle data (e.g., "1h", "15m", "1d")
