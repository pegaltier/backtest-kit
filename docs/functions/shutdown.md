---
title: docs/function/shutdown
group: docs
---

# shutdown

```ts
declare function shutdown(): void;
```

Gracefully shuts down the backtest execution by emitting a shutdown event.
This allows all components that subscribe to the shutdownEmitter to perform necessary cleanup before the process exits.
The shutdown method is typically called in response to a termination signal (e.g., SIGINT) to ensure a clean exit.
