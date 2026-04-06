---
title: docs/interface/IRunContext
group: docs
---

# IRunContext

Full context required to run a function inside both method and execution scopes.

Combines `IMethodContext` (schema routing: exchange, strategy, frame names) with
`IExecutionContext` (runtime state: symbol, timestamp, backtest flag).

Passed as a single object to `runInContextInternal`, which splits and distributes
the fields between `MethodContextService` and `ExecutionContextService`.
