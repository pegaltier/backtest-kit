---
title: docs/class/TrailingStopPromptService
group: docs
---

# TrailingStopPromptService

Service for managing trailing stop-loss prompts for AI/LLM integrations.

Provides access to system and user prompts configured in trailing-stop.prompt.cjs.
Supports both static prompt arrays and dynamic prompt functions.

Key responsibilities:
- Lazy-loads prompt configuration from config/prompt/trailing-stop.prompt.cjs
- Resolves system prompts (static arrays or async functions)
- Provides user prompt strings
- Falls back to empty prompts if configuration is missing

Used for AI-powered analysis of trailing stop-loss adjustments.
Use cases: Suggest optimal trailing distances, analyze risk protection strategies, optimize stop placement

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
