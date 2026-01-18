---
title: docs/class/SignalPromptService
group: docs
---

# SignalPromptService

Service for managing signal prompts for AI/LLM integrations.

Provides access to system and user prompts configured in signal.prompt.cjs.
Supports both static prompt arrays and dynamic prompt functions.

Key responsibilities:
- Lazy-loads prompt configuration from config/prompt/signal.prompt.cjs
- Resolves system prompts (static arrays or async functions)
- Provides user prompt strings
- Falls back to empty prompts if configuration is missing

Used for AI-powered signal analysis and strategy recommendations.

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### getSystemPrompt

```ts
getSystemPrompt: (symbol: string, strategyName: string, exchangeName: string, frameName: string, backtest: boolean) => Promise<string[]>
```

Retrieves system prompts for AI context.

System prompts can be:
- Static array of strings (returned directly)
- Async/sync function returning string array (executed and awaited)
- Undefined (returns empty array)

### getUserPrompt

```ts
getUserPrompt: (symbol: string, strategyName: string, exchangeName: string, frameName: string, backtest: boolean) => Promise<string>
```

Retrieves user prompt string for AI input.
