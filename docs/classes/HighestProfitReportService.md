---
title: docs/class/HighestProfitReportService
group: docs
---

# HighestProfitReportService

Service for logging highest profit events to the JSONL report database.

Listens to highestProfitSubject and writes each new price record to
Report.writeData() for persistence and analytics.

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### tick

```ts
tick: any
```

### subscribe

```ts
subscribe: (() => () => void) & ISingleshotClearable
```

### unsubscribe

```ts
unsubscribe: () => Promise<void>
```
