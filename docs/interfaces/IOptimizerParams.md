---
title: docs/api-reference/interface/IOptimizerParams
group: docs
---

# IOptimizerParams

Internal parameters for ClientOptimizer instantiation.
Extends schema with resolved dependencies (logger, complete template).

## Properties

### logger

```ts
logger: ILogger
```

Logger instance for debug and info messages.
Injected by OptimizerConnectionService.

### template

```ts
template: IOptimizerTemplate
```

Complete template implementation with all methods.
Merged from schema.template and OptimizerTemplateService defaults.
