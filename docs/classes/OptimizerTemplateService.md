---
title: docs/api-reference/class/OptimizerTemplateService
group: docs
---

# OptimizerTemplateService

Implements `IOptimizerTemplate`

Default template service for generating optimizer code snippets.
Implements all IOptimizerTemplate methods with Ollama LLM integration.

Features:
- Multi-timeframe analysis (1m, 5m, 15m, 1h)
- JSON structured output for signals
- Debug logging to ./dump/strategy
- CCXT exchange integration
- Walker-based strategy comparison

Can be partially overridden in optimizer schema configuration.

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### getTopBanner

```ts
getTopBanner: (symbol: string) => Promise<string>
```

Generates the top banner with imports and constants.

### getUserMessage

```ts
getUserMessage: (symbol: string, data: IOptimizerData[], name: string) => Promise<string>
```

Generates default user message for LLM conversation.
Simple prompt to read and acknowledge data.

### getAssistantMessage

```ts
getAssistantMessage: (symbol: string, data: IOptimizerData[], name: string) => Promise<string>
```

Generates default assistant message for LLM conversation.
Simple acknowledgment response.

### getWalkerTemplate

```ts
getWalkerTemplate: (walkerName: string, exchangeName: string, frameName: string, strategies: string[]) => Promise<string>
```

Generates Walker configuration code.
Compares multiple strategies on test frame.

### getStrategyTemplate

```ts
getStrategyTemplate: (strategyName: string, interval: string, prompt: string) => Promise<string>
```

Generates Strategy configuration with LLM integration.
Includes multi-timeframe analysis and signal generation.

### getExchangeTemplate

```ts
getExchangeTemplate: (symbol: string, exchangeName: string) => Promise<string>
```

Generates Exchange configuration code.
Uses CCXT Binance with standard formatters.

### getFrameTemplate

```ts
getFrameTemplate: (symbol: string, frameName: string, interval: CandleInterval, startDate: Date, endDate: Date) => Promise<string>
```

Generates Frame (timeframe) configuration code.

### getLauncherTemplate

```ts
getLauncherTemplate: (symbol: string, walkerName: string) => Promise<string>
```

Generates launcher code to run Walker with event listeners.
Includes progress tracking and completion handlers.

### getJsonDumpTemplate

```ts
getJsonDumpTemplate: (symbol: string) => Promise<string>
```

Generates dumpJson() helper function for debug output.
Saves LLM conversations and results to ./dump/strategy/{resultId}/

### getTextTemplate

```ts
getTextTemplate: (symbol: string) => Promise<string>
```

Generates text() helper for LLM text generation.
Uses Ollama deepseek-v3.1:671b model for market analysis.

### getJsonTemplate

```ts
getJsonTemplate: (symbol: string) => Promise<string>
```

Generates json() helper for structured LLM output.
Uses Ollama with JSON schema for trading signals.

Signal schema:
- position: "wait" &vert; "long" | "short"
- note: strategy explanation
- priceOpen: entry price
- priceTakeProfit: target price
- priceStopLoss: stop price
- minuteEstimatedTime: expected duration (max 360 min)
