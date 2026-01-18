---
title: docs/class/PartialProfitPromptService
group: docs
---

# PartialProfitPromptService

Service for managing partial profit prompts for AI/LLM integrations.

Provides access to system and user prompts configured in partial-profit.prompt.cjs.
Supports both static prompt arrays and dynamic prompt functions.

Key responsibilities:
- Lazy-loads prompt configuration from config/prompt/partial-profit.prompt.cjs
- Resolves system prompts (static arrays or async functions)
- Provides user prompt strings
- Falls back to empty prompts if configuration is missing

Used for AI-powered analysis when profit milestones are reached (10%, 20%, 30%, etc).
Triggered by: partialProfitAvailable() events in ActionBase
Use cases: Suggest position adjustments, analyze profit-taking opportunities, optimize milestone actions

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
