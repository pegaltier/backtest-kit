<img src="https://github.com/tripolskypetr/backtest-kit/raw/refs/heads/master/assets/heraldry.svg" height="45px" align="right">

# 📊 @backtest-kit/graph

> Compose backtest-kit computations as a typed directed acyclic graph. Define source nodes that fetch market data and output nodes that compute derived values — then resolve the whole graph in topological order.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/tripolskypetr/backtest-kit)
[![npm](https://img.shields.io/npm/v/@backtest-kit/graph.svg?style=flat-square)](https://npmjs.org/package/@backtest-kit/graph)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)]()

📚 **[Backtest Kit Docs](https://backtest-kit.github.io/documents/example_02_first_backtest.html)** | 🌟 **[GitHub](https://github.com/tripolskypetr/backtest-kit)**

## 🔥 Real-world example — multi-timeframe Pine Script strategy

The graph below replicates a two-timeframe strategy: a 4h Pine Script acts as a trend filter, a 15m Pine Script generates the entry signal. `outputNode` combines them and returns `null` when the trend disagrees.

```typescript
import { extract, run, toSignalDto, File } from '@backtest-kit/pinets';
import { addStrategySchema, Cache } from 'backtest-kit';
import { randomString } from 'functools-kit';
import { sourceNode, outputNode, resolve } from '@backtest-kit/graph';

// SourceNode — 4h trend filter, cached per candle interval
const higherTimeframe = sourceNode(
    Cache.fn(
        async (symbol) => {
            const plots = await run(File.fromPath('timeframe_4h.pine'), {
                symbol,
                timeframe: '4h',
                limit: 100,
            });
            return extract(plots, {
                allowLong:  'AllowLong',
                allowShort: 'AllowShort',
                noTrades:   'NoTrades',
            });
        },
        { interval: '4h', key: ([symbol]) => symbol },
    ),
);

// SourceNode — 15m entry signal, cached per candle interval
const lowerTimeframe = sourceNode(
    Cache.fn(
        async (symbol) => {
            const plots = await run(File.fromPath('timeframe_15m.pine'), {
                symbol,
                timeframe: '15m',
                limit: 100,
            });
            return extract(plots, {
                position:            'Signal',
                priceOpen:           'Close',
                priceTakeProfit:     'TakeProfit',
                priceStopLoss:       'StopLoss',
                minuteEstimatedTime: 'EstimatedTime',
            });
        },
        { interval: '15m', key: ([symbol]) => symbol },
    ),
);

// OutputNode — applies MTF filter, returns ISignalDto or null
const mtfSignal = outputNode(
    async ([higher, lower]) => {
        if (higher.noTrades) return null;
        if (lower.position === 0) return null;
        if (higher.allowShort && lower.position === 1) return null;
        if (higher.allowLong && lower.position === -1) return null;

        return toSignalDto(randomString(), lower, null);
    },
    higherTimeframe,
    lowerTimeframe,
);

addStrategySchema({
    strategyName: 'mtf_graph_strategy',
    interval: '5m',
    getSignal: (symbol) => resolve(mtfSignal),
    actions: ['partial_profit_action', 'breakeven_action'],
});
```

The graph resolves both Pine Script nodes **in parallel** via `Promise.all`, then passes their typed results to `compute`. Replacing either timeframe script or adding a third filter node requires no changes to the strategy wiring.

## ✨ Features

- 📊 **DAG execution**: Nodes are resolved bottom-up in topological order with `Promise.all` parallelism
- 🔒 **Type-safe values**: TypeScript infers the return type of every node through the graph via generics
- 🧱 **Two APIs**: Low-level `INode` for runtime/storage, high-level `TypedNode` + builders for authoring
- 💾 **DB-ready serialization**: `serialize` / `deserialize` convert the graph to a flat `IFlatNode[]` list with `id` / `nodeIds`
- 🔌 **Context-aware fetch**: `SourceNode.fetch` receives `(symbol, when, exchangeName)` from the execution context automatically

## 📋 API Reference

| Export | Description |
|--------|-------------|
| **`sourceNode(fetch)`** | Builder — creates a typed source node |
| **`outputNode(compute, ...nodes)`** | Builder — creates a typed output node, infers `values` types from `nodes` |
| **`resolve(node)`** | Recursively resolves a node graph within backtest-kit execution context |
| **`serialize(roots)`** | Flattens a node tree into `IFlatNode[]` for DB storage |
| **`deserialize(flat)`** | Reconstructs a node tree from `IFlatNode[]`, returns root nodes |
| **`deepFlat(nodes)`** | Utility — returns all nodes in topological order (dependencies first) |
| **`INode`** | Base runtime interface (untyped, used internally and for serialization) |
| **`TypedNode`** | Discriminated union for authoring with full IntelliSense |
| **`IFlatNode`** | Serialized node shape for DB storage |
| **`Value`** | `string \| number \| boolean \| null` |

## 🚀 Installation

```bash
npm install @backtest-kit/graph backtest-kit
```

## 📖 Usage

### Quick Start — builder API

Use `sourceNode` and `outputNode` to define a typed computation graph. TypeScript infers the type of `values` in `compute` from the `nodes` passed to `outputNode`:

```typescript
import { sourceNode, outputNode, resolve } from '@backtest-kit/graph';

// SourceNode<number> — fetch receives symbol, when, exchangeName from context
const closePrice = sourceNode(async (symbol, when, exchangeName) => {
    const candles = await getCandles(symbol, '1h', 1, exchangeName);
    return candles[0].close; // number
});

// SourceNode<number>
const volume = sourceNode(async (symbol, when, exchangeName) => {
    const candles = await getCandles(symbol, '1h', 1, exchangeName);
    return candles[0].volume; // number
});

// OutputNode<[SourceNode<number>, SourceNode<number>], number>
// price and vol are automatically number
const vwap = outputNode(
    ([price, vol]) => price * vol,
    closePrice,
    volume,
);

// Resolve inside a backtest-kit strategy
const result = await resolve(vwap); // Promise<number>
```

### Mixed types

TypeScript correctly infers heterogeneous types by position in `nodes`:

```typescript
const price = sourceNode(async (symbol) => 42);        // SourceNode<number>
const name  = sourceNode(async (symbol) => 'BTCUSDT'); // SourceNode<string>
const flag  = sourceNode(async (symbol) => true);      // SourceNode<boolean>

const result = outputNode(
    ([p, n, f]) => `${n}: ${p} (active: ${f})`, // p: number, n: string, f: boolean
    price,
    name,
    flag,
);
// OutputNode<[SourceNode<number>, SourceNode<string>, SourceNode<boolean>], string>
```

### Using inside a backtest-kit strategy

```typescript
import { addStrategy } from 'backtest-kit';
import { sourceNode, outputNode, resolve } from '@backtest-kit/graph';

const rsi = sourceNode(async (symbol, when, exchangeName) => {
    // ... compute RSI
    return 55.2;
});

const signal = outputNode(
    ([rsiValue]) => rsiValue < 30 ? 1 : rsiValue > 70 ? -1 : 0,
    rsi,
);

addStrategy({
    strategyName: 'graph-rsi',
    interval: '1h',
    riskName: 'demo',
    getSignal: async (symbol) => {
        const direction = await resolve(signal); // 1 | -1 | 0
        return direction === 1
            ? { position: 'long', ... }
            : null;
    },
});
```

### Low-level INode

For manual graph construction without builders (e.g. after deserialization or in a DI container):

```typescript
import { INode, Value } from '@backtest-kit/graph';
import NodeType from '@backtest-kit/graph/enum/NodeType';

const priceNode: INode = {
    type: NodeType.SourceNode,
    description: 'Close price',
    fetch: async (symbol, when, exchangeName) => 42,
};

const outputNode: INode = {
    type: NodeType.OutputNode,
    description: 'Doubled price',
    nodes: [priceNode],
    compute: ([price]) => (price as number) * 2,
};
```

> `INode` has no generic parameters — `values` in `compute` is typed as `Value[]`. Use `TypedNode` and builders for full IntelliSense.

### TypedNode — discriminated union

`TypedNode` is a discriminated union for use in type annotations, function signatures and `satisfies`:

```typescript
import { TypedNode } from '@backtest-kit/graph';

// A function that accepts any node
function describe(node: TypedNode): string {
    if (node.type === NodeType.SourceNode) {
        return `Source: ${node.description ?? 'unnamed'}`;
    }
    return `Output with ${node.nodes.length} dependencies`;
}

// Array of heterogeneous nodes
const graph: TypedNode[] = [closePrice, volume, vwap];
```

### DB serialization

`serialize` flattens the graph into an `IFlatNode[]` array, replacing object references in `nodes` with `nodeIds`. `deserialize` reconstructs the tree:

```typescript
import { serialize, deserialize, IFlatNode } from '@backtest-kit/graph';

// Graph → flat array for DB
const flat: IFlatNode[] = serialize([vwap]);
// [
//   { id: 'abc', type: 'source_node', nodeIds: [] },            // closePrice
//   { id: 'def', type: 'source_node', nodeIds: [] },            // volume
//   { id: 'ghi', type: 'output_node', nodeIds: ['abc', 'def'] }, // vwap
// ]

// Save to DB
await db.collection('nodes').insertMany(flat);

// Load from DB and reconstruct the graph
const stored: IFlatNode[] = await db.collection('nodes').find().toArray();
const roots: INode[] = deserialize(stored); // nodes[] is wired up from nodeIds
```

> `fetch` and `compute` are not stored in the DB — they must be restored on the application side after `deserialize`.

### deepFlat — traversal utility

`deepFlat` returns all nodes in topological order (dependencies before parents), deduplicated by reference:

```typescript
import { deepFlat } from '@backtest-kit/graph';

const all = deepFlat([vwap]);
// [closePrice, volume, vwap] — dependencies first

all.forEach(node => console.log(node.description));
```

## 🏗️ Architecture

```
sourceNode(fetch)          sourceNode(fetch)
       │                          │
       └──────────┬───────────────┘
                  ▼
           outputNode(compute)
                  │
                  ▼
             resolve() → Value
```

- **SourceNode** — leaf node, fetches data via `fetch(symbol, when, exchangeName)`
- **OutputNode** — internal node, receives resolved values from child `nodes` via `compute(values)`
- **resolve()** — recursively traverses the graph bottom-up, resolving siblings in parallel via `Promise.all`

## 💡 Why two APIs?

| | `INode` | `TypedNode` + builders |
|---|---|---|
| **IntelliSense for values** | `Value[]` (no) | `[number, string, ...]` (yes) |
| **Use case** | Runtime, serialization, DI | Authoring the graph in code |
| **Generic parameters** | No | Yes |
| **Plain object literal** | Yes | Requires builders |

## 🤝 Contribute

Fork/PR on [GitHub](https://github.com/tripolskypetr/backtest-kit).

## 📜 License

MIT © [tripolskypetr](https://github.com/tripolskypetr)
