---
title: docs/type/SignalSyncContract
group: docs
---

# SignalSyncContract

```ts
type SignalSyncContract = SignalOpenContract | SignalCloseContract;
```

Discriminated union for signal sync events.

Emitted to allow external systems to synchronize with the framework's
limit order lifecycle: open (limit filled) and close (position exited).

Note: Only covers the scheduled → pending → closed lifecycle.
Signals that were never activated (cancelled scheduled signals) do NOT emit SignalOpenContract.
