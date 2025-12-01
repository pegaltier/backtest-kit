---
title: docs/api-reference/interface/IOptimizerTemplate
group: docs
---

# IOptimizerTemplate

Template interface for generating code snippets and LLM messages.
Each method returns TypeScript/JavaScript code as a string.

## Properties

### getJsonDumpTemplate

```ts
getJsonDumpTemplate: (symbol: string) => string | Promise<string>
```

Generates dumpJson() helper function for debug output.

## Methods

### getTopBanner

```ts
getTopBanner: (symbol: string) => string | Promise<string>
```

Generates the top banner with imports and initialization.

### getUserMessage

```ts
getUserMessage: <Data extends IOptimizerData = any>(symbol: string, data: Data[], name: string) => string | Promise<string>
```

Generates default user message content for LLM conversation.

### getAssistantMessage

```ts
getAssistantMessage: <Data extends IOptimizerData = any>(symbol: string, data: Data[], name: string) => string | Promise<string>
```

Generates default assistant message content for LLM conversation.

### getWalkerTemplate

```ts
getWalkerTemplate: (walkerName: string, exchangeName: string, frameName: string, strategies: string[]) => string | Promise<string>
```

Generates Walker configuration code.

### getExchangeTemplate

```ts
getExchangeTemplate: (symbol: string, exchangeName: string) => string | Promise<string>
```

Generates Exchange configuration code.

### getFrameTemplate

```ts
getFrameTemplate: (symbol: string, frameName: string, interval: CandleInterval, startDate: Date, endDate: Date) => string | Promise<string>
```

Generates Frame (timeframe) configuration code.

### getStrategyTemplate

```ts
getStrategyTemplate: (strategyName: string, interval: string, prompt: string) => string | Promise<string>
```

Generates Strategy configuration code with LLM integration.

### getLauncherTemplate

```ts
getLauncherTemplate: (symbol: string, walkerName: string) => string | Promise<string>
```

Generates launcher code to run Walker and listen to events.

### getTextTemplate

```ts
getTextTemplate: (symbol: string) => string | Promise<string>
```

Generates text() helper function for LLM text generation.

### getJsonTemplate

```ts
getJsonTemplate: (symbol: string) => string | Promise<string>
```

Generates json() helper function for structured LLM output.
