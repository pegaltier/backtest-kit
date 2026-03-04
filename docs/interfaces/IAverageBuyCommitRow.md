---
title: docs/interface/IAverageBuyCommitRow
group: docs
---

# IAverageBuyCommitRow

Queued average-buy (DCA) commit.

## Properties

### action

```ts
action: "average-buy"
```

Discriminator

### currentPrice

```ts
currentPrice: number
```

Price at which the new averaging entry was executed

### cost

```ts
cost: number
```

Cost of this averaging entry in USD

### totalEntries

```ts
totalEntries: number
```

Total number of entries in _entry after this addition
