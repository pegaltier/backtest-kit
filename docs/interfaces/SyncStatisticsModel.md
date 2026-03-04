---
title: docs/interface/SyncStatisticsModel
group: docs
---

# SyncStatisticsModel

Statistical data calculated from sync events.

Provides metrics for signal sync lifecycle tracking.

## Properties

### eventList

```ts
eventList: SyncEvent[]
```

Array of all sync events with full details

### totalEvents

```ts
totalEvents: number
```

Total number of sync events

### openCount

```ts
openCount: number
```

Count of signal-open events

### closeCount

```ts
closeCount: number
```

Count of signal-close events
