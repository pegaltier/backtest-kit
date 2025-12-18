---
title: docs/interface/IOptimizerSource
group: docs
---

# IOptimizerSource

Data source configuration with custom message formatters.
Defines how to fetch data and format it for LLM conversation.

## Properties

### note

```ts
note: string
```

Optional description of this data source.
Example: "Historical backtest results for training"

### name

```ts
name: string
```

Unique name identifying this data source.
Used in callbacks and logging.

### fetch

```ts
fetch: IOptimizerSourceFn<Data>
```

Function to fetch data from this source.
Must support pagination via limit/offset.

### user

```ts
user: (symbol: string, data: Data[], name: string) => string | Promise<string>
```

Optional custom formatter for user messages.
If not provided, uses default template from OptimizerTemplateService.

### assistant

```ts
assistant: (symbol: string, data: Data[], name: string) => string | Promise<string>
```

Optional custom formatter for assistant messages.
If not provided, uses default template from OptimizerTemplateService.
