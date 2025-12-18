---
title: docs/interface/IOptimizerFetchArgs
group: docs
---

# IOptimizerFetchArgs

Fetch arguments for paginated data source queries.
Extends filter arguments with pagination parameters.

## Properties

### limit

```ts
limit: number
```

Maximum number of records to fetch per request.
Default: 25 (ITERATION_LIMIT)

### offset

```ts
offset: number
```

Number of records to skip from the beginning.
Used for pagination (offset = page * limit).
