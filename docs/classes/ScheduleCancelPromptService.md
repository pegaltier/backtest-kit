---
title: docs/class/ScheduleCancelPromptService
group: docs
---

# ScheduleCancelPromptService

Service for managing schedule cancellation prompts for AI/LLM integrations.

Provides access to system and user prompts configured in schedule-cancel.prompt.cjs.
Supports both static prompt arrays and dynamic prompt functions.

Key responsibilities:
- Lazy-loads prompt configuration from config/prompt/schedule-cancel.prompt.cjs
- Resolves system prompts (static arrays or async functions)
- Provides user prompt strings
- Falls back to empty prompts if configuration is missing

Used for AI-powered analysis when scheduled signals are cancelled before activation.
Triggered by: signal() events with action='cancelled' in ActionBase
Use cases: Analyze cancellation reasons, track signal invalidation patterns, optimize scheduling logic

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
