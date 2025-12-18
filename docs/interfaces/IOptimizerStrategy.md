---
title: docs/interface/IOptimizerStrategy
group: docs
---

# IOptimizerStrategy

Generated strategy data with LLM conversation history.
Contains the full context used to generate a trading strategy.

## Properties

### symbol

```ts
symbol: string
```

Trading pair symbol this strategy was generated for.

### name

```ts
name: string
```

Unique name taken from data source.
Used in callbacks and logging.

### messages

```ts
messages: MessageModel[]
```

LLM conversation history used to generate the strategy.
Contains user prompts and assistant responses for each data source.

### strategy

```ts
strategy: string
```

Generated strategy prompt/description.
Output from getPrompt() function, used as strategy logic.
