---
title: docs/class/BreakevenPromptService
group: docs
---

# BreakevenPromptService

Service for managing breakeven prompts for AI/LLM integrations.

Provides access to system and user prompts configured in breakeven.prompt.cjs.
Supports both static prompt arrays and dynamic prompt functions.

Key responsibilities:
- Lazy-loads prompt configuration from config/prompt/breakeven.prompt.cjs
- Resolves system prompts (static arrays or async functions)
- Provides user prompt strings
- Falls back to empty prompts if configuration is missing

Used for AI-powered analysis when stop-loss is moved to entry price (risk-free position).
Triggered by: breakevenAvailable() events in ActionBase
Use cases: Suggest position management after breakeven, analyze profit potential, optimize trailing strategies

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
