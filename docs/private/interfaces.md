---
title: private/interfaces
group: private
---

# backtest-kit api reference

![schema](../../assets/uml.svg)

**Overview:**

Backtest-kit is a production-ready TypeScript framework for backtesting and live trading strategies with crash-safe state persistence, signal validation, and memory-optimized architecture. The framework follows clean architecture principles with dependency injection, separation of concerns, and type-safe discriminated unions.

**Core Concepts:**

* **Signal Lifecycle:** Type-safe state machine (idle → opened → active → closed) with discriminated unions
* **Execution Modes:** Backtest mode (historical data) and Live mode (real-time with crash recovery)
* **VWAP Pricing:** Volume Weighted Average Price from last 5 1-minute candles for all entry/exit decisions
* **Signal Validation:** Comprehensive validation ensures TP/SL logic, positive prices, and valid timestamps
* **Interval Throttling:** Prevents signal spam with configurable intervals (1m, 3m, 5m, 15m, 30m, 1h)
* **Crash-Safe Persistence:** Atomic file writes with automatic state recovery for live trading
* **Async Generators:** Memory-efficient streaming for backtest and live execution
* **Accurate PNL:** Calculation with fees (0.1%) and slippage (0.1%) for realistic simulations
* **Event System:** Signal emitters for backtest/live/global signals, errors, and completion events
* **Graceful Shutdown:** Live.background() waits for open positions to close before stopping
* **Pluggable Persistence:** Custom adapters for Redis, MongoDB, or any storage backend

**Architecture Layers:**

* **Client Layer:** Pure business logic without DI (ClientStrategy, ClientExchange, ClientFrame) using prototype methods for memory efficiency
* **Service Layer:** DI-based services organized by responsibility:
  * **Schema Services:** Registry pattern for configuration with shallow validation (StrategySchemaService, ExchangeSchemaService, FrameSchemaService)
  * **Validation Services:** Runtime existence validation with memoization (StrategyValidationService, ExchangeValidationService, FrameValidationService)
  * **Connection Services:** Memoized client instance creators (StrategyConnectionService, ExchangeConnectionService, FrameConnectionService)
  * **Global Services:** Context wrappers for public API (StrategyGlobalService, ExchangeGlobalService, FrameGlobalService)
  * **Logic Services:** Async generator orchestration (BacktestLogicPrivateService, LiveLogicPrivateService)
  * **Markdown Services:** Auto-generated reports with tick-based event log (BacktestMarkdownService, LiveMarkdownService)
* **Persistence Layer:** Crash-safe atomic file writes with PersistSignalAdaper, extensible via PersistBase
* **Event Layer:** Subject-based emitters (signalEmitter, errorEmitter, doneEmitter) with queued async processing

**Key Design Patterns:**

* **Discriminated Unions:** Type-safe state machines without optional fields
* **Async Generators:** Stream results without memory accumulation, enable early termination
* **Dependency Injection:** Custom DI container with Symbol-based tokens
* **Memoization:** Client instances cached by schema name using functools-kit
* **Context Propagation:** Nested contexts using di-scoped (ExecutionContext + MethodContext)
* **Registry Pattern:** Schema services use ToolRegistry for configuration management
* **Singleshot Initialization:** One-time operations with cached promise results
* **Persist-and-Restart:** Stateless process design with disk-based state recovery
* **Pluggable Adapters:** PersistBase as base class for custom storage backends
* **Queued Processing:** Sequential event handling with functools-kit queued wrapper

**Data Flow (Backtest):**

1. User calls Backtest.background(symbol, context) or Backtest.run(symbol, context)
2. Validation services check strategyName, exchangeName, frameName existence
3. BacktestLogicPrivateService.run(symbol) creates async generator with yield
4. MethodContextService.runInContext sets strategyName, exchangeName, frameName
5. Loop through timeframes, call StrategyGlobalService.tick()
6. ExecutionContextService.runInContext sets symbol, when, backtest=true
7. ClientStrategy.tick() checks VWAP against TP/SL conditions
8. If opened: fetch candles and call ClientStrategy.backtest(candles)
9. Yield closed result and skip timeframes until closeTimestamp
10. Emit signals via signalEmitter, signalBacktestEmitter
11. On completion emit doneEmitter with { backtest: true, symbol, strategyName, exchangeName }

**Data Flow (Live):**

1. User calls Live.background(symbol, context) or Live.run(symbol, context)
2. Validation services check strategyName, exchangeName existence
3. LiveLogicPrivateService.run(symbol) creates infinite async generator with while(true)
4. MethodContextService.runInContext sets schema names
5. Loop: create when = new Date(), call StrategyGlobalService.tick()
6. ClientStrategy.waitForInit() loads persisted signal state from PersistSignalAdaper
7. ClientStrategy.tick() with interval throttling and validation
8. setPendingSignal() persists state via PersistSignalAdaper.writeSignalData()
9. Yield opened and closed results, sleep(TICK_TTL) between ticks
10. Emit signals via signalEmitter, signalLiveEmitter
11. On stop() call: wait for lastValue?.action === 'closed' before breaking loop (graceful shutdown)
12. On completion emit doneEmitter with { backtest: false, symbol, strategyName, exchangeName }

**Event System:**

* **Signal Events:** listenSignal, listenSignalBacktest, listenSignalLive for tick results (idle/opened/active/closed)
* **Error Events:** listenError for background execution errors (Live.background, Backtest.background)
* **Completion Events:** listenDone, listenDoneOnce for background execution completion with DoneContract
* **Queued Processing:** All listeners use queued wrapper from functools-kit for sequential async execution
* **Filter Predicates:** Once listeners (listenSignalOnce, listenDoneOnce) accept filter function for conditional triggering

**Performance Optimizations:**

* Memoization of client instances by schema name
* Prototype methods (not arrow functions) for memory efficiency
* Fast backtest method skips individual ticks
* Timeframe skipping after signal closes
* VWAP caching per tick/candle
* Async generators stream without array accumulation
* Interval throttling prevents excessive signal generation
* Singleshot initialization runs exactly once per instance
* LiveMarkdownService bounded queue (MAX_EVENTS = 25) prevents memory leaks
* Smart idle event replacement (only replaces if no open/active signals after last idle)

**Use Cases:**

* Algorithmic trading with backtest validation and live deployment
* Strategy research and hypothesis testing on historical data
* Signal generation with ML models or technical indicators
* Portfolio management tracking multiple strategies across symbols
* Educational projects for learning trading system architecture
* Event-driven trading bots with real-time notifications (Telegram, Discord, email)
* Multi-exchange trading with pluggable exchange adapters

**Test Coverage:**

The framework includes comprehensive unit tests using worker-testbed (tape-based testing):

* **exchange.test.mjs:** Tests exchange helper functions (getCandles, getAveragePrice, getDate, getMode, formatPrice, formatQuantity) with mock candle data and VWAP calculations
* **event.test.mjs:** Tests Live.background() execution and event listener system (listenSignalLive, listenSignalLiveOnce, listenDone, listenDoneOnce) for async coordination
* **validation.test.mjs:** Tests signal validation logic (valid long/short positions, invalid TP/SL relationships, negative price detection, timestamp validation) using listenError for error handling
* **pnl.test.mjs:** Tests PNL calculation accuracy with realistic fees (0.1%) and slippage (0.1%) simulation
* **backtest.test.mjs:** Tests Backtest.run() and Backtest.background() with signal lifecycle verification (idle → opened → active → closed), listenDone events, early termination, and all close reasons (take_profit, stop_loss, time_expired)
* **callbacks.test.mjs:** Tests strategy lifecycle callbacks (onOpen, onClose, onTimeframe) with correct parameter passing, backtest flag verification, and signal object integrity
* **report.test.mjs:** Tests markdown report generation (Backtest.getReport, Live.getReport) with statistics validation (win rate, average PNL, total PNL, closed signals count) and table formatting

All tests follow consistent patterns:
* Unique exchange/strategy/frame names per test to prevent cross-contamination
* Mock candle generator (getMockCandles.mjs) with forward timestamp progression
* createAwaiter from functools-kit for async coordination
* Background execution with Backtest.background() and event-driven completion detection


# backtest-kit interfaces

## Interface WalkerStopContract

This interface defines the information shared when a trading walker needs to be stopped. It's like a notification that a specific walker, running a particular strategy on a certain trading symbol, is being halted.  The inclusion of 'walkerName' allows for scenarios where multiple walkers might be active on the same symbol – you can target a specific one for stopping. It provides the symbol, the strategy’s name, and the walker's name to identify exactly what’s being stopped.

## Interface WalkerStatisticsModel

This interface, WalkerStatisticsModel, is designed to hold all the information you need when analyzing how different trading strategies performed during a backtest. Think of it as a central place to see the outcomes of multiple strategies side-by-side. 

It builds upon the existing IWalkerResults interface, adding extra data to make comparisons easier. Specifically, it includes an array called strategyResults, which is a list of results – one for each strategy you tested. This allows you to quickly see and compare performance metrics like profit, drawdown, and other key indicators for each strategy.

## Interface WalkerContract

The WalkerContract helps you track the progress of comparing different trading strategies. It provides updates as each strategy finishes its backtest, letting you know what's being tested and how it performed.

Each update includes details like the strategy’s name, the exchange and symbol used for the test, and a set of statistics summarizing its results. You’ll also see a metric value – a key indicator being optimized – along with the current best metric value found and the name of the strategy currently holding that top spot. Finally, it keeps you informed about how many strategies have been tested and the total number yet to go. This gives you a clear picture of the overall comparison process.

## Interface WalkerCompleteContract

This interface describes what's emitted when a backtesting process, or "walker," finishes running all its tests and is ready to report the final outcome. It bundles together all the key information about the completed backtest. 

You'll find details like the name of the backtest itself (walkerName), the financial instrument being tested (symbol), and the exchange and timeframe used. 

The interface also tells you which performance metric was used to judge the strategies, how many strategies were tested, and importantly, identifies the top-performing strategy along with its best metric score and detailed statistics. Essentially, it's a complete report card for the backtest.

## Interface ValidationErrorNotification

This notification signals that a validation error occurred during your backtesting or live trading process. It's a way for the system to tell you something went wrong with the rules or constraints you've set up. Each notification has a unique ID to help track it, and provides a detailed error object including a stack trace and additional information. A human-readable message explains the problem, and you'll find a flag indicating whether the error originated from a backtest, which will always be false in this case because validation errors are triggered in the live environment.

## Interface ValidateArgs

This interface, `ValidateArgs`, helps ensure that the names you’re using for different parts of your backtesting setup are valid. Think of it as a way to double-check that you haven't misspelled or used a non-existent name for your exchange, timeframe, strategy, risk profile, action handler, sizing strategy, or parameter sweep. 

Each property within `ValidateArgs` represents one of these components (like "ExchangeName" or "StrategyName").  You provide an enum for each property, and the system uses that to verify the name you're using is actually recognized. This prevents errors and makes sure everything connects correctly. Essentially, it's a guardrail against typos and misconfigurations in your backtest setup.


## Interface TrailingTakeCommitNotification

This notification tells you when a trailing take profit order has been executed. It provides a wealth of information about the trade, including a unique identifier, the exact time it happened, and whether it occurred during a backtest or live trading. You'll find details like the trading symbol, the strategy that triggered it, and the exchange used.

The notification includes key price points like the original and adjusted take profit and stop-loss prices, as well as the entry price. It also gives you insight into any DCA (dollar-cost averaging) involved, indicating the number of entries and partial closes.

Furthermore, it gives a complete picture of the trade's financial performance, offering detailed P&L data, including percentages, costs, and the prices used for calculation. Lastly, timestamps show when the signal was created and when the position went pending.

## Interface TrailingTakeCommit

This interface describes a trailing take profit event within the backtest-kit framework. It represents a situation where the take profit level has been adjusted based on a trailing stop mechanism. 

The `action` property confirms this is a trailing take event.  You’ll find details about the price shift that triggered the adjustment in `percentShift`. 

The event also provides crucial context like the `currentPrice` at the time of the adjustment, the current `pnl` of the trade, and the `position` (long or short). 

You can see the original take profit and stop loss prices using `originalPriceTakeProfit` and `originalPriceStopLoss`, and how they've evolved to their current values `priceTakeProfit` and `priceStopLoss`. 

Finally, `scheduledAt` and `pendingAt` provide timestamps useful for understanding the timing of the signal and trade activation.

## Interface TrailingStopCommitNotification

This notification lets you know when a trailing stop order has been triggered and executed. It provides a detailed snapshot of what happened, including a unique ID for tracking purposes and a timestamp for when the action occurred. You'll see details about whether this event happened during a backtest or in live trading, and information about the specific trade, like the trading pair, the strategy that generated the signal, and the exchange used.

The notification also includes key pricing data – the current price, entry price, take profit price, and stop loss prices – both as they are currently and as they were originally set before any trailing adjustments. If your strategy uses DCA (Dollar Cost Averaging), you'll find details about the number of entries and partial closes. Furthermore, the notification provides comprehensive profit and loss (PNL) information, including the entry and exit prices used in the calculation, the total cost, and the overall percentage profit or loss. Lastly, there are timestamps relating to when the signal was initially created and when the position went pending.

## Interface TrailingStopCommit

This describes an event that happens when a trailing stop order is triggered. It essentially tells you that the stop loss price has been adjusted based on the trailing stop strategy.

You'll find details about the action taken, which will always be "trailing-stop" in this case. The `percentShift` reveals how much the stop loss was moved—it's expressed as a percentage.

The event also includes the current market price at the time of the adjustment, the unrealized profit and loss (PNL) of the position, and whether it’s a long or short trade. Crucially, it provides the original entry price, along with both the current and original take profit and stop loss prices, so you can see how the trailing stop has affected the trade. Finally, timestamps indicate when the signal was created and when the position was activated.

## Interface TickEvent

This interface, `TickEvent`, provides a standardized format for all types of trading events, making it easier to analyze and report on your backtest results. Think of it as a central hub for all the important information related to a trade, regardless of whether it’s being opened, closed, scheduled, or cancelled. 

Each `TickEvent` contains details like the exact timestamp of the event, the action that occurred (like "opened" or "closed"), the trading symbol involved, and a unique signal ID.  For trades that involve take profit or stop loss orders, you’ll find the original and current price levels, along with progress percentages towards those targets.

If the trade utilized DCA (Dollar Cost Averaging), information about the number of entries and partial closes is also included.  Profit and loss data, both unrealized and realized, are available, alongside reasons for closures or cancellations.  Finally, timestamps for when events were scheduled or became active are recorded, providing a complete timeline of the trade's lifecycle.

## Interface SyncStatisticsModel

This model holds statistical information related to how signals are synchronized within your trading system. Think of it as a way to track the lifecycle of signals, from when they're initiated to when they're closed. 

It provides a list of individual synchronization events, giving you detailed information about each one. You can also get a simple count of all events processed, as well as the number of times signals were opened and closed. This data is incredibly useful for monitoring the health and efficiency of your signal synchronization processes.


## Interface SyncEvent

This `SyncEvent` object bundles all the important details about a signal's activity, making it easy to create reports and understand what's happening during a backtest or live trading. It captures information like when the event occurred (`timestamp`), what trading pair was involved (`symbol`), the name of the strategy used (`strategyName`), and the exchange where the trades took place (`exchangeName`). 

You'll find the signal’s unique ID (`signalId`) and the specific action taken (`action`), such as opening a position or closing it. Crucially, it includes price data like the current market price (`currentPrice`), the entry price (`priceOpen`), and any take profit or stop loss levels used (`priceTakeProfit`, `priceStopLoss`). 

The object also provides insights into the signal's lifecycle, tracking when it was initially created (`scheduledAt`), when the position became active (`pendingAt`), and details about any DCA averaging or partial closes (`totalEntries`, `totalPartials`).  If a signal is closed, the `closeReason` explains why. Finally, the object specifies whether the event is related to a backtest (`backtest`) and provides a precise creation timestamp (`createdAt`). It also keeps track of profit and loss (`pnl`).

## Interface StrategyStatisticsModel

This model gathers all the statistical information related to your trading strategy's actions. It’s like a detailed logbook of everything your strategy has done.

You'll find a complete list of all strategy events, along with the total number of events recorded. The model also breaks down the counts of specific actions, such as canceling scheduled orders, closing pending orders, taking partial profits, and implementing trailing stop or take orders. It even tracks breakeven events and the use of average buy (DCA) strategies. Essentially, it provides a comprehensive picture of how your strategy behaves.

## Interface StrategyEvent

The `StrategyEvent` object is designed to hold all the important details about what’s happening in your trading strategy – whether it's a backtest or a live trade. Think of it as a comprehensive log entry for every action your strategy takes. It captures things like the exact time of the event, the trading pair involved, the strategy's name, and the exchange being used. 

You’ll also find information about the signal that triggered the action, along with the specific action taken (like opening a position or closing one).  Key price data like the current market price, take profit levels, and stop-loss orders are included, along with information about trailing stops and original pricing before any adjustments.

For strategies using dollar-cost averaging (DCA), you’ll see details like the cumulative entry price and number of entries.  Finally, the event includes profit and loss information (PNL) and the cost of entries, all neatly packaged together for reporting and analysis. This gives you a complete picture of the event for generating reports and understanding how your strategy is performing.

## Interface SignalSyncOpenNotification

This notification lets you know when a scheduled trade, like a limit order, has been triggered and a position has been opened. It provides a wealth of information about the trade, including a unique identifier, the exact time it happened, and whether it occurred during a backtest or live trading. You'll find details like the trading pair (e.g., BTCUSDT), the strategy that generated the signal, and the exchange where the trade took place.

It also includes key pricing information, such as the current market price at the time of opening, along with initial profit and loss calculations, entry and exit prices, and costs associated with the trade.  You'll see the trade direction (long or short) and the prices for take profit and stop loss, both as originally set and after any trailing adjustments.

Finally, the notification provides details about DCA averaging (if used) and partial closes, as well as timestamps for signal creation, pending, and notification creation, allowing for comprehensive tracking of the trade lifecycle.

## Interface SignalSyncCloseNotification

This notification tells you when a trading signal has been closed, whether it was due to a take profit or stop loss being hit, time expiring, or a manual closure. It provides a wealth of detail about the closed signal, like a unique ID, the exact time it closed, and whether it occurred during a backtest or in live trading.

You'll find information about the symbol traded, the strategy that generated the signal, and the exchange used. It includes key pricing data like the entry and exit prices, and the current price at the time of closure. 

A breakdown of the Profit and Loss (P&L) is provided, including the total cost, the invested capital, and the percentage gain or loss. You can also see the original take profit and stop-loss prices, along with details about any averaging (DCA) or partial closes that might have occurred.  Finally, timestamps related to the signal's lifecycle – creation, pending, and closing – are included, along with the reason for the closure.

## Interface SignalSyncBase

This describes the fundamental information you'll find in any signal synchronization event within the backtest-kit framework. Every signal, whether it's generated during a backtest or in a live trading environment, will include details like the trading pair (symbol), the name of the strategy that produced it, and the exchange it's associated with. 

You'll also see the timeframe used, a clear indicator of whether the signal originated from a backtest, a unique ID for tracking the signal, the precise time it occurred, and the full data row representing the signal itself. Think of it as a standardized package containing all the essential details about a signal's origin and context.

## Interface SignalScheduledNotification

This notification tells you when a trading signal has been set to execute in the future. It's like a heads-up that a trade is about to happen, whether you're running a backtest or live trading. Each notification has a unique ID and timestamp indicating when the signal was scheduled.

The signal is linked to a specific strategy and exchange, and provides details like the trade direction (long or short), target entry price, take profit levels, and stop-loss orders. You’ll also find information about the original prices before any adjustments like trailing stops, the number of DCA entries planned, and details about partial position closures.

It also includes financial data related to the signal, like the cost of the position, unrealized profit and loss (PNL), and the prices used for the PNL calculation. You’ll find the current market price at the time of scheduling and a timestamp for when the notification was created. This information helps you understand the context of the upcoming trade.

## Interface SignalOpenedNotification

This notification tells you when a new trade has been opened. It's emitted whenever a trading position is initiated, whether it's part of a backtest or a live trade. The notification contains a wealth of details about the trade, like a unique identifier, the exact time it was opened, and whether it was a backtest or live execution.

You'll find information about the trade itself, including the trading pair (e.g., BTCUSDT), the strategy that generated the signal, and the exchange it was placed on. It also provides specifics about the position's direction (long or short), entry price, take profit, stop loss levels, and details related to any DCA averaging or partial closes that may have occurred. 

Furthermore, it includes crucial financial information like the cost of the entry, profit and loss details (both absolute and as a percentage), and timestamps representing various stages of the signal's lifecycle - from its initial creation to when the position became active. A descriptive note might also be present, explaining the reason behind the signal.

## Interface SignalOpenContract

This event lets you know when a trading signal has been executed – specifically when a limit order you set up has been filled by the exchange. It's like getting confirmation that your order went through.

Think of it as a notification that a buy or sell order, initially placed at a specific price, has now been successfully matched on the market. This is helpful for keeping external systems, like order management tools or audit logs, in sync with what's happening in your trading framework.

The event includes a lot of detail about the trade, such as the actual price the order was filled at, the direction of the trade (long or short), any profit or loss so far, and the original prices you set for take profit and stop loss. You'll also find information about how the position was built, including whether it was a single entry or involved averaging through multiple smaller orders (DCA), and if any portions of the position were closed out early. The timestamps for when the signal was created and when the position officially started are also available.

## Interface SignalData$1

This data structure holds all the key details about a closed trading signal, perfect for building reports and analyzing performance. Each signal is identified by a unique ID and linked to the strategy that created it. You'll find information like the trading symbol, whether it was a long or short position, and the percentage profit or loss (PNL) achieved.  The reason for closing the signal is also recorded, alongside the exact times the position was opened and closed. It's essentially a complete snapshot of a signal's lifecycle.

## Interface SignalCommitBase

This interface defines the fundamental information shared by all signal commit events within the backtest-kit framework. Every signal commit, whether from a backtest or live trading, will include details like the trading symbol (e.g., BTCUSDT), the name of the strategy that generated the signal, and the exchange used. 

You'll also find information specific to backtesting, such as the timeframe used and whether the signal originates from a backtest or live environment. Each signal is assigned a unique identifier, a timestamp reflecting when it occurred, and information on the number of entries and partial closes executed, as well as the original entry price. This base structure provides a consistent foundation for understanding and analyzing signal commit events.

## Interface SignalClosedNotification

This notification lets you know when a trading position, generated by a strategy, has been closed – whether it hit a take profit or stop loss target, or was closed for another reason. It provides a wealth of information about the closed position, including when it was opened and closed, the prices involved, and the strategy that generated it. You'll find details like the trade direction (long or short), the original entry price, and how many entries were involved if it was a DCA strategy. 

The notification also includes the profit and loss information, both as a percentage and in absolute USD value, along with the effective prices used for the PNL calculation considering slippage and fees. You can see how long the position was open, and even a human-readable note explaining why the position was closed. Lastly, it includes timestamps for key events like when the signal was created, when it went pending, and when the notification itself was generated.

## Interface SignalCloseContract

This event lets other systems know when a trading signal has been closed, whether it was because a profit target was hit, a stop loss triggered, time ran out, or the user manually closed it. Think of it as a notification for external systems like order management or auditing tools.

The event includes details about the closing price, the profit and loss (PNL) of the trade, whether it was a long or short position, and the original entry and stop-loss/take-profit prices before any adjustments like trailing or averaging. It also tells you when the signal was created and when the position was activated.

You'll find information about how many times the position was averaged (through DCA) and how many partial closes were executed, providing a complete picture of the trading activity. Finally, the `closeReason` property explains specifically why the signal was closed.

## Interface SignalCancelledNotification

This notification lets you know when a signal that was planned for execution has been canceled before it actually happened. It provides a detailed breakdown of why the signal was stopped, offering insights into potential issues or user interventions.

You'll find information like the signal's unique ID, the strategy that generated it, and the exchange it was destined for. Crucially, it includes the original order details – the intended take profit, stop loss, and entry prices – along with the actual prices used when the position was created. 

The notification also reveals details about any DCA averaging that was in place, the number of partial closes previously executed, and importantly, the reason for the cancellation, whether it was due to a timeout, price rejection, or a manual user action. Timestamp data helps pinpoint the exact timing of events, from initial scheduling to eventual cancellation.

## Interface Signal

This section describes the `Signal` object, which represents a trading signal generated by your strategies. It holds key information about a position, like the initial entry price (`priceOpen`).

The `_entry` property stores a history of all entry points for this signal, recording the price, cost, and timestamp of each entry. This helps you understand how the position was built up over time.

Similarly, `_partial` tracks any partial exits taken on the position, noting whether they were profit-taking or loss-limiting actions, the percentage of the position exited, the price at which they occurred, the cost basis at the time of the partial exit, and the number of shares held at that point. This gives you a detailed view of how the position has been adjusted along the way.

## Interface Signal$2

This `Signal$2` object keeps track of important details related to a trading position. It includes the initial `priceOpen` at which the trade was started. 

You’ll also find lists of `_entry` events, which detail each individual entry into the position, noting the price, cost, and timestamp of the entry.

Finally, `_partial` records any partial exits from the position, specifying the type (profit or loss), percentage, current price, cost basis at the time of the partial exit, number of shares/contracts at that time, and the timestamp.

## Interface Signal$1

This section describes the `Signal` interface within the backtest-kit framework. It represents a trading signal, holding crucial information about a trade.

The `priceOpen` property tells you the initial price at which the position was opened, allowing you to understand the entry point.

The `_entry` property is an array detailing the specifics of each entry made into the position; you’ll find the price, the total cost, and the exact time of each entry recorded here.

Similarly, `_partial` tracks partial exits from the position, noting whether they were for profit or loss, the percentage of the position exited, the price at the time, the cost basis at the close of the partial exit, the number of shares/contracts at the time, and the timestamp.

## Interface ScheduledEvent

This interface holds all the key details about trading events – whether they were scheduled, opened, or cancelled. It’s designed to give you a complete picture for reporting and analysis.

Each event includes a timestamp to indicate when it happened, the specific action taken (like opening a position or cancelling a signal), and the trading symbol involved. You'll also find the signal ID, position type, and any notes associated with the signal. 

Crucially, it provides price information like the entry price, take profit, and stop loss levels, along with their original values before any adjustments. If a DCA strategy was used, it tracks the number of entries and partial closes. 

For cancelled events, you’ll see the reason for cancellation and a unique ID if it was user-initiated, along with the duration the position was held. Opened positions have a timestamp marking when they became active, and all events note the original scheduling time. Finally, unrealized profit and loss (PNL) is included at the time of the event.

## Interface ScheduleStatisticsModel

This model gives you a complete picture of how your scheduled signals are performing. It tracks all the events – when signals are scheduled, activated, or cancelled – and provides key statistics to help you understand their behavior. 

You'll find a detailed list of every scheduled event, along with overall counts of scheduled, opened, and cancelled signals. The model also calculates important rates, such as the cancellation rate (how often signals are cancelled) and the activation rate (how often scheduled signals become active). Finally, it provides averages for wait times – how long cancelled signals remained scheduled and how long signals waited to be activated. This helps you identify areas for improvement in your scheduling strategy.

## Interface SchedulePingContract

This contract defines what happens when a scheduled signal is actively being monitored – that's a signal that isn't cancelled or activated yet. Every minute, while a signal is in this active state, a `SchedulePingContract` event is sent out. Think of it as a heartbeat, letting you know the signal is still running.

You can subscribe to these events using `listenSchedulePing()` or `listenSchedulePingOnce()`. Each event includes a bunch of useful information like the trading symbol (e.g., BTCUSDT), the name of the strategy managing it, the exchange it's on, and the full data related to the signal itself, including things like entry price, take profit, and stop-loss levels.

Crucially, you’ll also get the current market price at the time of the ping and whether the event originates from a backtest (historical data) or live trading.  This allows you to build custom monitoring – perhaps you want to automatically cancel a signal if the price drifts too far from where it was originally opened. The timestamp tells you precisely when the ping occurred, either when it happened in live trading or when the candle was processed during a backtest.

## Interface RiskStatisticsModel

This model helps you understand and monitor risk within your trading system. It collects data about instances where risk controls were triggered, giving you a clear picture of where and why those rejections happened. You'll find a complete list of the events that caused the rejections, along with the total count. 

The model also breaks down the rejections by trading symbol and strategy, so you can easily identify which areas are experiencing the most risk. This allows you to focus your efforts on improving those specific aspects of your system.


## Interface RiskRejectionNotification

This notification lets you know when a trading signal was blocked by your risk management rules. It's a way for the system to tell you why a potential trade didn't happen. Each notification has a unique ID and a timestamp marking precisely when the rejection occurred. 

You'll find details about the trade that was rejected, like the symbol being traded (e.g., BTCUSDT), the name of the strategy that generated the signal, and the exchange involved. Crucially, the `rejectionNote` provides a clear explanation of *why* the signal was rejected – consider this your primary point of reference for understanding the risk rule that triggered. 

Additional information like the number of active positions you had at the time, the current market price, and details about the proposed trade itself (entry price, take profit, stop loss) are also included. The notification also keeps track of details about the original signal, if available, as well as when the notification itself was generated. It also indicates if the rejection happened during a backtest or live trading.

## Interface RiskEvent

This data structure holds information about signals that were blocked due to risk management rules. It's designed to help you understand why a trade didn't happen, especially during backtesting or live trading.

Each `RiskEvent` gives you details like when it occurred (timestamp), which trading pair was involved (symbol), the specifics of the signal that was rejected (currentSignal), the strategy and exchange that generated it, and the timeframe being used.

You'll also find the current market price at the time of rejection, the number of positions already open, and a unique ID and note explaining why the signal was blocked. Finally, it indicates whether this event originated from a backtest or live trading environment.

## Interface RiskContract

This interface, RiskContract, represents a signal that was blocked by the risk management system. It's designed to help you understand why a trade didn't happen, allowing you to monitor and improve your risk controls.

Think of it as a notification when the system says "no" to a trading signal because it violates your pre-defined risk limits. It will only be sent when a signal is rejected, not when one is allowed.

The information included helps pinpoint exactly what happened: which market (symbol) was involved, the details of the signal itself (currentSignal), which strategy tried to execute it (strategyName), the timeframe used (frameName), the exchange (exchangeName), the price at the time (currentPrice), how many other positions were already open (activePositionCount), and why it was rejected (rejectionNote). A unique ID (rejectionId) and timestamp are also provided for tracking and analysis. Finally, you can tell whether this rejection happened during a backtest or in live trading (backtest). This is valuable data for understanding risk violations and generating reports.

## Interface ProgressWalkerContract

This interface helps you monitor the progress of background tasks within the backtest-kit framework. It provides updates during long-running operations, like processing many trading strategies. 

You'll see events containing details like the name of the task being performed, the exchange and frame used, the trading symbol involved, and how many strategies have been handled versus the total number. The `progress` property gives you a percentage indicating how far along the process is, ranging from 0% to 100%. This allows you to track and potentially display the status of these processes to the user.


## Interface ProgressBacktestContract

This interface helps you keep an eye on how your backtest is running. It provides updates as your backtesting process moves along, letting you know the exchange and strategy being used, the trading symbol, and how much of the data has been processed. You’ll get information like the total number of data points being analyzed, the number already analyzed, and a percentage representing the overall completion. Essentially, it's a progress report for your backtest, giving you insight into its status.


## Interface PerformanceStatisticsModel

This model holds the performance data collected during a backtest, organized by the strategy that was run. It provides a breakdown of how the strategy performed, including the overall number of events recorded and the total time it took to execute. 

You'll find key statistics grouped by metric type within the `metricStats` property, allowing you to analyze specific aspects of performance.  If you need the raw details, the `events` property contains a list of all the performance events that were tracked. The `strategyName` tells you which strategy generated these results, and `totalEvents` represents the total count of performance events recorded. Finally, `totalDuration` reflects the overall time spent collecting these metrics.

## Interface PerformanceContract

The `PerformanceContract` helps you understand how quickly different parts of your trading system are running. Think of it as a detailed log of performance, showing how long operations take and where they happen. Each entry records when something happened, how long it took, and details like the strategy, exchange, and trading symbol involved. It's especially helpful when testing strategies—you can pinpoint slow areas and optimize your code. The `timestamp` tells you *when* something occurred, `previousTimestamp` lets you see the time difference compared to the prior event, `metricType` describes what kind of operation took place, `duration` gives the time it took in milliseconds, and `strategyName`, `exchangeName`, `frameName`, `symbol`, and `backtest` provide context for where and how that operation was executed.

## Interface PartialStatisticsModel

This data model helps you understand the results of your backtesting, specifically focusing on partial profits and losses. It keeps track of every event that occurred during the backtest, giving you a detailed list of each one. You can also see the overall count of events, how many resulted in a profit, and how many were losses. This information lets you analyze how well your trading strategy is performing with partial exits.

## Interface PartialProfitContract

The `PartialProfitContract` represents when a trading strategy hits a predetermined profit milestone, like 10%, 20%, or 30% gain. It’s a notification that a portion of the trade’s profit has been realized.

Think of it as a way to keep track of how your strategy is performing and when it’s achieving those profit targets.

The contract includes important details such as the trading pair’s symbol, the name of the strategy that generated the signal, the exchange being used, and the current market price at the time the profit level was reached.

You’ll also find information about the original signal parameters, like the initial stop-loss and take-profit prices, and whether the event occurred during a backtest or live trading. It will also tell you the exact moment in time when this profit level was observed.

These notifications are useful for generating reports, monitoring strategy performance, and letting users know about progress. Each profit level will only trigger one notification per signal.

## Interface PartialProfitCommitNotification

This notification tells you when a portion of a trade's profits has been secured, a feature useful for managing risk and locking in gains. It provides a wealth of information about the trade that triggered the partial profit commit.

You'll find details like a unique identifier for the notification, the exact time it occurred, and whether it happened during a backtest or a live trade. The notification also specifies the trading pair, the strategy responsible, and the exchange used.

It includes the signal's ID, the percentage of the position that was closed, and the current price at the time of the action. You’ll also see the original entry price, the take profit and stop loss prices (both original and adjusted for trailing), and key details related to any dollar-cost averaging (DCA) strategy that might have been in place, like the total number of entries and partials.

Profit and loss data is also provided, including the total PNL, PNL percentage, and associated costs and prices, and timestamps for various stages of the trade—from initial scheduling to when the position became pending. This comprehensive information helps you analyze and understand exactly how and why the partial profit commit was executed.

## Interface PartialProfitCommit

This event signifies a partial profit-taking action within your trading strategy. It tells you that a portion of your existing position – whether you're long (buying) or short (selling) – is being closed out. The `percentToClose` property indicates precisely what percentage of the position is being affected. 

You'll also find important pricing details, including the current market price (`currentPrice`), the entry price (`priceOpen`), and the original and adjusted take profit and stop-loss prices (`priceTakeProfit`, `originalPriceTakeProfit`, `priceStopLoss`, `originalPriceStopLoss`).  The `pnl` property provides the unrealized profit and loss at the time the action was triggered.

Finally, the `scheduledAt` property tracks when the signal for this action was initially generated, and `pendingAt` indicates when the position was initially activated. This information is helpful for understanding the timing and context of your trading decisions.

## Interface PartialProfitAvailableNotification

This notification lets you know when a trading strategy hits a pre-defined profit milestone, like 10%, 20%, or 30% gain. It's triggered during both backtesting and live trading.

The notification includes a lot of useful information: a unique ID, the exact time it happened, and whether it's a backtest or live trade. You’ll see details like the trading pair, the strategy’s name, and the exchange used. It also provides the signal’s unique identifier and the profit level reached.

You get the current market price at that milestone, along with the original entry price, the direction of the trade (long or short), and the take profit and stop loss prices—both the original amounts and those adjusted for trailing. Crucially, it gives you a snapshot of the strategy’s performance, including P&L, percentage gain/loss, and the total capital invested. Other timestamps show when the signal was initially created and when the position went pending.

## Interface PartialLossContract

The `PartialLossContract` represents a notification when a trading strategy hits a predefined loss level, like -10%, -20%, or -30% drawdown. Think of it as a signal that your strategy is experiencing a loss, and it's letting you know how much.

This contract contains key details about the loss event, including the trading symbol (like BTCUSDT), the name of the strategy that triggered it, the exchange and frame being used, and the price at which the loss level was reached.

You'll also find information about the original signal data, the specific percentage loss level triggered, and whether the event occurred during a backtest (historical simulation) or live trading. 

The timestamp provides information about precisely when the loss level was detected – whether it's the real-time time in live trading or the candle timestamp during a backtest.  This is used by systems that track strategy performance and by users who want to monitor how their strategies are performing against stop-loss levels.

## Interface PartialLossCommitNotification

This notification tells you when a partial closing of a position has happened, whether it's during a backtest or live trading. It provides a ton of detail about the trade, including a unique ID and timestamp so you can track it precisely. You'll see information like the strategy and exchange involved, the symbol being traded (like BTCUSDT), and the percentage of the position that was closed.

The notification also includes crucial pricing data, like the entry price, take profit, and stop loss levels, both as initially set and after any trailing adjustments.  You'll get details about how the position was built up through DCA averaging, showing the total number of entries. It also reports the current P&L and associated pricing used for the calculation, giving you a comprehensive view of the trade's profitability. Finally, timestamps pinpoint when the signal was created, became pending, and when this particular notification was generated.

## Interface PartialLossCommit

This describes a situation where a trading strategy is partially closing a position due to a loss. 

The `action` property confirms this is a partial loss event.

You'll find details like the percentage of the position being closed (`percentToClose`), the current market price when the action occurred (`currentPrice`), and the unrealized profit and loss (`pnl`) at that time. 

It also includes information about the trade itself: whether it was a long or short position, the original entry price (`priceOpen`), and the take profit and stop loss prices, both as they were originally set and as they've been adjusted.

Finally, timestamps (`scheduledAt` and `pendingAt`) record when the signal was generated and when the position initially started.

## Interface PartialLossAvailableNotification

This notification alerts you when a trading strategy hits a predefined loss level, like a 10% or 20% drawdown. It’s a signal that things might be going south, allowing you to react accordingly.

Each notification contains a wealth of information about the situation. You’ll see the unique ID of the notification, the exact time it occurred, and whether it's happening during a backtest or a live trade. It details which symbol and strategy triggered the alert, and the specifics of the trade itself including the entry price, take profit, stop loss (both original and adjusted for trailing), and the trade direction (long or short).

The notification also provides details about the trade’s history: how many entries were made (useful for strategies using dollar-cost averaging) and how many partial closes have already occurred.  Crucially, it includes profit and loss data—both in absolute terms (USD) and as a percentage—calculated using the effective price considering fees and slippage. Finally, it provides timestamps related to the signal's lifecycle: when it was originally created, and when the position became active.

## Interface PartialEvent

This interface, `PartialEvent`, bundles together all the key details about profit and loss milestones during a trade. It's designed to simplify generating reports on your backtest results or live trading performance. You'll find information like the exact time the event occurred, whether it was a profit or loss, the trading pair involved, and the name of the strategy that triggered it.

It also includes crucial pricing information, such as the entry price, take profit target, and stop loss levels, along with their original values when the signal was initially created. If you're using dollar-cost averaging (DCA), you'll see details about the total entries and the original entry price. 

You can also see how much of a partial close has been executed, the unrealized profit and loss at that point, and a human-readable explanation of the signal's reasoning. The `pendingAt` and `scheduledAt` timestamps provide a timeline for the trade’s lifecycle. Finally, a flag indicates whether the event occurred during a backtest or in live trading.

## Interface MetricStats

This interface, `MetricStats`, holds a collection of performance statistics for a specific type of metric. Think of it as a summary report for how a particular measurement is performing over time. You'll find information like the total number of times the metric was recorded, the total time it took across all those recordings, and calculated values such as the average, minimum, maximum, and standard deviation. It also includes percentile information, like the 95th and 99th percentiles, giving you a sense of the distribution of the metric's values.  Finally, the stats cover wait times between events to provide further insight into the metric’s behavior.

## Interface Message

This describes a message, the fundamental building block of a conversation or chat history. Each message tells you who sent it – whether it's the system providing instructions, a user asking a question, or the AI responding.  The "role" property clearly identifies the sender, while the "content" property holds the actual text of the message itself. Essentially, it’s a way to structure and represent each turn in a dialogue.

## Interface LiveStatisticsModel

This model provides a detailed snapshot of your live trading performance. It tracks everything from the total number of trades to key profitability and risk metrics. You’ll find a complete record of each trade event, allowing you to dig into specific situations.

It calculates essential figures like your win rate, average profit per trade, and overall cumulative profit. Risk metrics like standard deviation, Sharpe Ratio, and annualized Sharpe Ratio help you understand the volatility and risk-adjusted returns of your strategy. A certainty ratio highlights the relative performance of winning versus losing trades, and expected yearly returns offer a projection of annual earnings. Remember, values can be null if the calculation isn't reliable due to factors like unusual market conditions or insufficient data.

## Interface InfoErrorNotification

This component handles notifications about errors that occur during background processes, but aren't critical enough to stop everything. Think of it as a way to be alerted to minor issues that might need attention. Each notification has a unique ID so you can track it, and a descriptive error message to help understand what went wrong. You'll also find details about the error itself, including its stack trace and any related data. Importantly, these notifications indicate issues within a live trading context, not during a backtest simulation.

## Interface IWalkerStrategyResult

This interface represents the outcome of running a trading strategy within a backtest comparison. It holds key details about a single strategy's performance. 

You'll find the strategy's name clearly listed, along with a comprehensive set of statistics summarizing how it performed. A key metric, used to evaluate and compare strategies, is also included, and might be null if the strategy's results were unusable. Finally, the interface assigns a rank to the strategy based on its metric value, making it easy to see how it stacks up against other strategies.

## Interface IWalkerSchema

The IWalkerSchema helps you set up A/B tests to compare different trading strategies against each other. Think of it as a blueprint for your experiment, defining which strategies you're testing, what exchange and timeframe they'll use, and what you're trying to optimize – like Sharpe Ratio, which measures risk-adjusted return.  You give each walker a unique name and can even add a note for yourself.  The schema also lets you specify custom lifecycle event callbacks, giving you more control over how the testing process unfolds. Essentially, it’s the key to easily comparing and refining your trading strategies.

## Interface IWalkerResults

This interface holds all the information gathered when you run a backtest walker, which helps you compare different trading strategies. It tells you which asset (symbol) was tested, the exchange used for the tests, the name of the specific walker configuration that ran, and the timeframe (frameName) the strategies were evaluated on. Think of it as a single container for a complete set of results from a backtesting comparison process. It provides a clear summary of the testing environment.

## Interface IWalkerCallbacks

This interface lets you hook into the backtest process, allowing your code to react to different stages of testing strategies. Think of it as a way to listen in on what's happening as backtest-kit runs its comparisons. 

You can be notified when a specific strategy starts testing, giving you a chance to log the start or prepare for data. Similarly, you’ll get a notification when a strategy's testing is complete, alongside statistics and a key performance metric.  If a strategy encounters an error during its test, you'll be informed of that too, with details about the error. Finally, once all strategies have been tested, a final notification lets you know the entire process is done and provides a summary of the results.


## Interface ITrailingTakeCommitRow

This interface describes a single step in a trading plan involving a trailing take commit order. Think of it as a record of what needs to happen – specifically, a "trailing-take" action. It tells you the percentage shift that should be applied to the trailing stop, and the price at which the trailing stop was initially set. This information is used to execute the trading strategy and manage risk.

## Interface ITrailingStopCommitRow

This interface describes a queued action related to a trailing stop order. Think of it as a record of what needs to happen – specifically, adjusting a trailing stop. It tells the system to apply a percentage shift to the trailing stop, based on the price when the stop was initially set. Essentially, it’s a notification to move the trailing stop price, providing the necessary details like the action type, the percentage adjustment, and the original price used for the trailing stop calculation.


## Interface IStrategyTickResultWaiting

This interface describes what happens when a trading strategy is waiting for a signal to activate. It's used when a signal has been scheduled, and the system is actively monitoring the price to see if it hits the entry point. You'll receive these "waiting" results repeatedly as the price fluctuates.

The result includes important details like the signal itself, the current price being watched, the strategy and exchange names, the trading symbol, and the timeframe being used. It also contains information about potential profit and loss, whether it's a backtest or live trade, and the creation timestamp. 

Importantly, the progress towards take profit and stop loss will always be zero in this "waiting" state, as the position hasn't been opened yet.

## Interface IStrategyTickResultScheduled

This interface represents a special tick event in backtest-kit, signaling that a trading strategy has generated a scheduled signal – an order that will execute when a specific price is reached.  Essentially, the strategy has decided to place an order but is waiting for the market to move to the desired price level.

The data included with this event tells you *why* the signal was scheduled: it gives you the strategy's name, the exchange it's operating on, the timeframe used, the trading symbol, the current price at the time the signal was generated, and whether it's a backtest or live trade.  You’ll also find the details of the signal itself (IPublicSignalRow), which contains all the information about the order being scheduled. Finally, a timestamp records exactly when the signal was created.

## Interface IStrategyTickResultOpened

This interface describes what happens when a new trading signal is generated within the backtest-kit framework. It's a notification you receive when a signal is successfully created, validated, and saved.

You'll find details about the signal itself – its ID, the strategy that generated it, the exchange and timeframe involved, and the symbol being traded. The `currentPrice` represents the price at the moment the signal was opened. 

It also tells you if the signal came from a backtesting simulation or a live trading environment. The `createdAt` timestamp gives you a precise record of when the signal was created, tying it to either the backtest candle or the live execution time. It's all about providing clear information about new signal generation.


## Interface IStrategyTickResultIdle

This interface describes what happens when your trading strategy is in a resting or inactive state. It's essentially a notification that nothing is currently being traded. 

The `action` property clearly indicates this is an "idle" state. You'll also see information about the specific strategy, exchange, timeframe, and trading symbol involved in the idle period. 

Along with that, it includes the current price at the time of the idle state, whether the event came from a backtest or live trading, and when the event occurred. It's a useful record for monitoring and analysis, even when there's no active trading happening.

## Interface IStrategyTickResultClosed

This interface, `IStrategyTickResultClosed`, represents what happens when a trading signal is closed – whether that’s because a take profit or stop loss was triggered, time expired, or the user manually closed it. It bundles together a lot of essential information about the closure, including the original signal details, the price at which it closed, and the reason why it closed. 

You’ll find details like the strategy and exchange names, the trading symbol, and a flag indicating whether this is a backtest or live trade. The crucial piece is the profit/loss (`pnl`) calculation, which factors in fees and slippage.  A unique close ID is available if the signal was closed manually. Finally, the `createdAt` field provides a timestamp for when this closure event was recorded.

## Interface IStrategyTickResultCancelled

This interface represents a tick result indicating that a previously scheduled trading signal was cancelled. It happens when a signal doesn’t trigger an order or gets stopped before an order can be placed.

The `action` property simply confirms that this is indeed a cancellation.  You’ll also find the details of the cancelled signal itself under the `signal` property.  Key information about the circumstances of the cancellation, such as the final price (`currentPrice`), the exact time it happened (`closeTimestamp`), and the names of the strategy, exchange, and time frame (`strategyName`, `exchangeName`, `frameName`), are all included.

Furthermore, the `symbol` lets you know which trading pair was involved, and the `backtest` flag clarifies whether this cancellation occurred during a backtest or a live trading session. The `reason` property gives more context as to *why* the signal was cancelled, while `cancelId` is available if the user manually cancelled the signal. Lastly, `createdAt` helps in understanding the timeline of events.

## Interface IStrategyTickResultActive

This interface represents a tick result within the backtest-kit framework when a trading strategy is actively monitoring a signal, typically waiting for a take profit (TP), stop loss (SL), or time expiration. It provides detailed information about the active position, including the signal being monitored, the current price being tracked, and the names of the strategy, exchange, and time frame involved. You’ll also find key data like the trading symbol, progress towards TP and SL as percentages, and the unrealized profit and loss (PNL) calculation that considers fees and slippage. Whether the position was created during a backtest or a live trade is indicated, along with the timestamp of the tick's creation. This result is crucial for understanding the state of an active trade and evaluating its performance.

## Interface IStrategySchema

This schema helps you define and register your trading strategies within the backtest-kit framework. Think of it as a blueprint for how your strategy generates trading signals. Each strategy gets a unique name for identification, and you can add a note to explain its purpose.

The `interval` property controls how often your strategy can produce signals, preventing it from overwhelming the system.

The heart of the schema is the `getSignal` function. This is where your strategy’s logic lives—it takes a symbol (asset) and a timestamp, and returns a trading signal (or nothing if no signal is found).  You can even build strategies that wait for prices to hit specific levels before triggering.

You can also specify callbacks for important events like when a trade opens or closes. 

The `riskName` and `riskList` properties are for connecting your strategy to risk management systems, while `actions` allows you to tag your strategy with identifiers for further processing.

## Interface IStrategyResult

The `IStrategyResult` represents a single entry when you're comparing different trading strategies. Think of it as a row in a table showing how each strategy performed. Each result includes the strategy's name, a detailed set of statistics about its backtest performance (like total profit, drawdown, etc.), and a numerical value representing how well it did based on a chosen metric, which might be null if the strategy had issues. Essentially, it's a container for all the key data needed to evaluate and rank your strategies.


## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the profit and loss results for a trading strategy. It breaks down how much money your strategy made or lost, taking into account realistic factors like trading fees and slippage. You’ll find the profit/loss expressed as a percentage, along with the adjusted entry and exit prices – these prices already factor in those fees and slippage.  The interface also gives you the absolute dollar amount of profit or loss, and the total amount of capital invested to calculate that profit.

## Interface IStrategyCallbacks

This interface provides a way to hook into the different stages of a trading signal's lifecycle. Think of it as a set of event listeners that your strategy can react to. 

You can define functions to be called when a signal is first opened, when it's actively being monitored, when there’s no active signal, when it’s closed, or when it's scheduled for later entry. There are also callbacks for specific situations like partial profits or losses, reaching breakeven, or when a scheduled signal is cancelled. 

A `onTick` function is executed for every market tick, allowing constant updates. Several "Ping" callbacks (`onSchedulePing`, `onActivePing`) offer opportunities for custom monitoring and management of scheduled or active signals on a minute-by-minute basis, independent of your strategy's main interval. Finally, `onWrite` allows you to interact with how signal data is stored for testing.

## Interface IStrategy

The `IStrategy` interface outlines the core functions a trading strategy needs to execute. It's like a blueprint for how a strategy reacts to market changes.

The `tick` method is the heart of it – it's what runs on each price update, checking for signals, and potential take profit/stop loss triggers.  `getPendingSignal` and `getScheduledSignal` retrieve information about active orders, essential for monitoring.

There are helper functions for things like checking breakeven points (`getBreakeven`) or if the strategy is stopped (`getStopped`). It also allows you to track how much of your position has been closed (`getTotalPercentClosed`, `getTotalCostClosed`) and get details on the average entry price (`getPositionAveragePrice`).

You can get detailed insights into your position, including how much is invested, the average entry price, and how much profit or loss you’re making (`getPositionInvestedCount`, `getPositionInvestedCost`, `getPositionPnlPercent`, `getPositionPnlCost`). `getPositionEntries` and `getPositionPartials` provides a complete history of trades.

`backtest` lets you test your strategy on historical data.  The `stopStrategy`, `cancelScheduled`, `activateScheduled`, and `closePending` methods offer ways to control the strategy's behavior.

Finally, functions like `partialProfit`, `validatePartialProfit`, `trailingStop`, `trailingTake`, `breakeven`, `averageBuy` let you fine-tune your strategy's actions, with validation functions (`validate...`) to ensure conditions are met before executing. `dispose` is used for cleaning up resources when the strategy is no longer needed.


## Interface IStorageUtils

This interface defines the basic functions any storage system needs to work with backtest-kit. Think of it as a contract – if your storage system (like a database or file system) wants to be used by backtest-kit, it has to provide these methods. 

The methods handle different types of signals: when a signal is opened, closed, scheduled, or cancelled. There are also functions to find a specific signal by its unique ID and to retrieve a complete list of all signals that have been stored. This allows backtest-kit to keep track of what's happening and efficiently manage trading signals.


## Interface IStorageSignalRowScheduled

This interface represents a signal row that's been scheduled for execution. It's a simple way to track signals that are waiting to be processed at a later time. The key piece of information is the `status` property, which is always set to "scheduled" to clearly indicate the signal’s current state. Think of it as a flag indicating a signal is in the queue, ready for its turn.

## Interface IStorageSignalRowOpened

This interface represents a signal that has been opened, essentially meaning a trade has been initiated based on that signal. It's a straightforward way to track the state of a signal within the backtest-kit framework. The only information it provides is the `status`, which is always "opened" for rows of this type, clearly indicating the signal's active trading state. Think of it as a marker confirming a trade is live based on the signal's instructions.

## Interface IStorageSignalRowClosed

This interface describes a signal that has been closed, meaning a trade associated with it has finished. Crucially, closed signals are the only ones that contain profitability (PNL) data. 

Each closed signal record will have a `status` property, which will always be set to "closed," confirming its finalized state. It also includes a `pnl` property, which holds the details of the profit and loss generated by that signal when the trade was closed.

## Interface IStorageSignalRowCancelled

This interface represents a signal row that has been cancelled. It's a simple way to mark a signal as no longer active or relevant. The only information it holds is the `status` property, which will always be set to "cancelled" to clearly indicate its state. Think of it as a flag to indicate that a signal is not to be acted upon.

## Interface IStorageSignalRowBase

This interface, `IStorageSignalRowBase`, defines the essential information needed to store a signal consistently, whether it's a live or backtested one. It ensures signals are saved with precise timestamps, recording when they were created and last updated.  The `priority` field helps manage the order in which signals are processed, essentially acting like a timestamp to ensure proper sequencing. Think of it as a foundation for all signal storage, guaranteeing a common structure and accurate timing information.


## Interface ISizingSchemaKelly

This interface defines a sizing strategy based on the Kelly Criterion, a formula designed to maximize long-term growth. When implementing this strategy, you'll specify that the sizing method is "kelly-criterion."  The `kellyMultiplier` property controls how aggressively the strategy invests; a value of 0.25, for instance, represents a "quarter Kelly" approach, which is a more conservative and common implementation to avoid potentially ruinous bets. You'll need to provide a numeric value for `kellyMultiplier`, representing the proportion of your capital to allocate based on the Kelly Criterion's calculated amount.

## Interface ISizingSchemaFixedPercentage

This schema defines a simple way to determine trade size: a fixed percentage of your capital is risked on each trade. The `method` property is always set to "fixed-percentage" to identify this sizing strategy. The core of the sizing is controlled by `riskPercentage`, which represents the percentage of your capital you're willing to lose on a single trade – for example, a value of 1 would risk 1% of your capital.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, serves as the foundation for defining how much of your account to allocate to each trade. Think of it as a blueprint for your sizing strategy. It includes essential details like a unique name to identify your sizing method, a place for developer notes, and limits on position size – both as a percentage of your account and as specific amounts. You can also add optional callback functions to customize the sizing process further.

## Interface ISizingSchemaATR

This schema defines how to size your trades using the Average True Range (ATR). It’s designed for strategies that want to dynamically adjust trade size based on market volatility.

You’ll specify a `riskPercentage`, representing the portion of your capital you're comfortable risking on each trade, expressed as a percentage. The `atrMultiplier` determines how the ATR value is used to calculate the stop-loss distance, essentially scaling the risk based on current market volatility – a higher multiplier means wider stops in more volatile conditions.  Essentially, this method allows your trade size to automatically adjust based on the ATR, helping to manage risk.

## Interface ISizingParamsKelly

The `ISizingParamsKelly` interface defines how to configure sizing strategies based on the Kelly Criterion. It primarily focuses on providing a way to log information related to the sizing process for debugging and analysis. You'll use this interface when setting up how your trading strategies determine position sizes. The `logger` property is essential for tracking what's happening under the hood, allowing you to diagnose any sizing-related issues that might arise during backtesting.

## Interface ISizingParamsFixedPercentage

This interface defines the parameters needed to control how much of your capital is used for each trade when using a fixed percentage sizing strategy.  It primarily includes a logger, which helps you keep track of what's happening during your backtesting or live trading.  Think of the logger as a way to get helpful messages and debug any issues that might arise. Using this interface ensures a consistent way to configure your sizing behavior.

## Interface ISizingParamsATR

This interface defines the parameters needed to control how much of your capital is used for each trade when employing an Average True Range (ATR) based sizing strategy. It's primarily used when setting up the sizing behavior within the backtest-kit framework. 

You'll find a `logger` property here, which allows you to easily output debugging information and track the sizing process as your backtest runs. Think of it as a way to monitor and troubleshoot how your sizing parameters are affecting your trades.

## Interface ISizingCallbacks

This section describes functions that get called during the sizing process in your trading strategy. Specifically, `onCalculate` is triggered immediately after the framework figures out how much to buy or sell. You can use it to check if the calculated size makes sense or to record details about the sizing decision for later review. It provides the planned quantity and relevant parameters used in the calculation.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate a trade size using the Kelly Criterion. To use it, you'll specify the method as "kelly-criterion" along with your win rate – a number between 0 and 1 representing the percentage of winning trades – and the average win/loss ratio, which tells you how much you typically make on a winning trade compared to how much you lose on a losing one. These parameters help determine an optimal bet size based on your historical performance.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed when you're calculating trade sizes using a fixed percentage approach. It’s simple: you specify that the sizing method is "fixed-percentage," and then you provide the price level where you want to place a stop-loss order.  Essentially, it tells the backtest kit how to determine your position size based on a percentage of your capital and the stop-loss price you've selected.

## Interface ISizingCalculateParamsBase

This interface defines the basic information needed to figure out how much of an asset to buy or sell. It ensures that all sizing calculations have access to the same core data. You'll find properties like the trading symbol – like "BTCUSDT" – to identify the asset.  It also includes the current balance in your account and the price at which you're planning to enter the trade. These three pieces of information form the foundation for calculating appropriate trade sizes.

## Interface ISizingCalculateParamsATR

This interface defines the information needed when calculating trade sizes using an ATR (Average True Range) based approach.  It includes the `method` which explicitly states that the sizing method is ATR-based.  You'll also provide the current ATR value, represented by the `atr` property, which will be used to determine the size of your trades.  Essentially, it’s the key data for ATR sizing calculations within the backtest-kit framework.


## Interface ISizing

The `ISizing` interface defines how a trading strategy determines how much of an asset to buy or sell. Think of it as the engine that decides your position size. It has one key method, `calculate`, which takes information about the trade – like your risk tolerance and the price of the asset – and figures out the appropriate size for the order. This calculation happens as part of the strategy's execution process.

## Interface ISignalRow

This interface, `ISignalRow`, represents a complete signal within the backtest-kit framework. Think of it as a finalized signal, ready for execution after it's been checked and prepared.

Each signal gets a unique ID, generated automatically, to easily identify it throughout the system.  You’ll also find information about the cost of the position, the initial entry price, which exchange and strategy were involved, and the timeframe it was generated on.  A timestamp records when the signal was initially created and when it went pending.

The `symbol` property tells you exactly what trading pair is involved, like “BTCUSDT”.  A flag, `_isScheduled`, indicates if the signal was planned in advance.

To help with profit and loss calculations, the `_partial` array tracks any partial closes that have occurred – essentially how much of the position has been closed at different prices and times.  Related properties, `_tpClosed`, `_slClosed`, and `_totalClosed`, summarize these partials.

For more sophisticated risk management, `_trailingPriceStopLoss` and `_trailingPriceTakeProfit` manage dynamic stop-loss and take-profit levels, adjusting them based on the current price movement.  The original stop-loss and take-profit values are still kept for record-keeping purposes.

Finally, `_entry` keeps a history of the price at which you bought into a position, useful for dollar-cost averaging strategies. The `timestamp` field again marks when the signal came to be.

## Interface ISignalDto

This describes the data structure used to represent a trading signal within the backtest-kit framework. When you request a signal, this is the information you'll receive. Each signal includes details like whether it's a long (buy) or short (sell) position, a description of why the signal was generated, and the intended entry price. 

You'll also find the target take profit price, the stop-loss price to limit potential losses, and an estimated duration for the trade. Finally, it specifies the cost associated with entering this trade, which defaults to a system-wide setting if not provided. An ID will automatically be assigned to each signal if you don't provide one yourself. The take profit and stop loss prices must be logically consistent with the position (higher for long, lower for short).

## Interface IScheduledSignalRow

This interface, `IScheduledSignalRow`, represents a trading signal that’s intentionally delayed until a specific price is reached. Think of it as a signal that’s waiting for the market to move in a certain direction. 

It builds upon the `ISignalRow` interface, adding the concept of a delayed activation.  The signal remains in a "pending" state until the market price hits the specified `priceOpen`.

Once that price is achieved, the signal transforms into a standard pending signal and triggers the trade.  The `priceOpen` property defines that target price.  The system tracks when the signal was initially scheduled and when it actually started pending, keeping a record of that delay.

## Interface IScheduledSignalCancelRow

This interface describes a scheduled trading signal that can be cancelled by the user. It builds upon the existing `IScheduledSignalRow` by adding a `cancelId` property. This `cancelId` acts as a unique identifier specifically for cancellations that were triggered by the user, allowing for tracking and management of those actions. Essentially, it lets you know which user request led to a particular cancellation of a scheduled signal.

## Interface IRiskValidationPayload

This data structure holds all the information needed when you're checking if a trade is safe to execute. Think of it as a snapshot of your trading activity. 

It includes the details of the signal you’re considering, like the price, and also gives you a view of how many positions you currently hold and a list of those active positions. This helps risk validation logic understand the overall portfolio state before allowing a trade to go through. Having this data together allows for more informed and robust risk checks.

## Interface IRiskValidationFn

This defines the structure for functions that check if a trading decision is safe to make. Think of it as a gatekeeper – it examines a proposed trade and decides whether to allow it to proceed. If everything looks good, the function simply does nothing or returns nothing. If there's a problem, like the trade exceeding risk limits, the function provides a clear explanation of why it's being rejected, allowing the system to adjust or halt the trade. It can also directly signal a rejection by throwing an error, which the system will then interpret as a rejection reason.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define how to check if your trading risks are acceptable. It's all about setting up rules to make sure your trades stay within safe boundaries. 

You specify the rules with a `validate` function, which is the core of the validation logic.  This function will examine the risk parameters and determine if they pass. 

Optionally, you can add a `note` to explain what the validation is intended to do – a little explanation to make it clearer what the rule is for.

## Interface IRiskSignalRow

This interface, `IRiskSignalRow`, is designed to hold extra information needed for managing risk during trading. It builds upon the `ISignalDto` and adds details like the entry price (`priceOpen`), the initially set stop-loss price (`originalPriceStopLoss`), and the original take-profit price (`originalPriceTakeProfit`). Think of it as a container specifically for risk validation processes, providing access to those crucial entry and original protection level details.

## Interface IRiskSchema

This defines a blueprint for risk profiles you can create within the backtest-kit framework. Think of it as a way to set up rules that control your portfolio's behavior and prevent unwanted actions.

Each risk profile has a unique name to identify it, and you can add a note to explain its purpose to other developers.

You can also define optional callback functions that get triggered at specific points, like when a trade is rejected or allowed.

The heart of the risk profile is the validations – these are custom checks you write to enforce your portfolio's risk management strategy. This array holds the individual validation functions or objects that will be executed.


## Interface IRiskRejectionResult

This interface, `IRiskRejectionResult`, helps you understand why a risk check failed during your backtesting. It provides a unique identifier (`id`) so you can track specific rejections and a helpful explanation (`note`) describing the reason for the failure in plain language. Think of it as a way to easily diagnose and fix problems identified by your risk validation rules. Essentially, it gives you the details you need to understand and address why a trade wasn't allowed.

## Interface IRiskParams

The `IRiskParams` object sets up how your trading system manages risk. Think of it as the initial configuration for the risk management component. 

It includes important details like the name of the exchange you're using (like "binance"), a way to log debugging information, and a flag to indicate whether you're in backtesting mode (simulated trading) or live trading.

You can also provide a callback function, `onRejected`, which gets triggered when a trading signal is blocked because it violates your risk rules. This callback lets you log events or communicate with other parts of your system before the rejection is officially recorded.


## Interface IRiskCheckArgs

This interface, `IRiskCheckArgs`, provides the information needed to decide whether a new trade should be allowed. Think of it as a gatekeeper – it’s checked before a trading signal is actually created. It bundles together crucial data about the potential trade, including the symbol being traded (like "BTCUSDT"), the signal itself, and details about the strategy and exchange involved. You'll also find the current price and timestamp, plus information identifying the risk profile and timeframe being used. Essentially, it's a package of context to ensure any new trade aligns with predefined risk management rules.


## Interface IRiskCallbacks

This interface allows you to receive notifications about the results of risk checks during your backtesting process. You can implement callbacks to be notified when a trading signal is blocked due to risk limits, via the `onRejected` callback. Alternatively, the `onAllowed` callback will let you know when a signal successfully passes all the defined risk checks and is cleared for potential execution.  These callbacks give you flexibility in how you want to react to risk-related events within your backtest.

## Interface IRiskActivePosition

This interface represents a single trading position that's being actively managed and tracked. Think of it as a snapshot of a trade – it holds all the key details about it. You’ll find information like the strategy that initiated the trade, the exchange it’s on, the trading pair (like BTCUSDT), and whether it's a long or short position. 

Crucially, it also stores important risk management details, including the entry price, stop-loss, and take-profit levels. Finally, it provides information about how long the position has been open and when it was initially started. This data is really useful for analyzing how different strategies interact with each other and for understanding overall portfolio risk.

## Interface IRisk

This interface, `IRisk`, is all about keeping your trading strategies safe and controlled. Think of it as a gatekeeper that makes sure your signals and positions are within acceptable risk boundaries.

It has three key functions:

*   `checkSignal` lets you see if a potential trading signal is okay to execute, based on your defined risk rules. It checks things like how much you're risking and ensures you're not exceeding limits.
*   `addSignal` is how you tell the system about a new trade you've just entered. It records the details of the position, which helps track your overall exposure.
*   `removeSignal` lets you inform the system when a trade has closed, so it can adjust its calculations and risk assessments. 

Essentially, `IRisk` helps you manage and monitor the risks involved in your automated trading.

## Interface IReportTarget

This interface lets you fine-tune what information gets logged during your backtesting process. Think of it as a way to pick and choose which aspects of your trading strategy and execution you want to see in detail. 

You can enable logging for things like strategy decisions, risk management events, breakeven calculations, partial order closures, performance metrics, scheduled signals, and even live trading data. 

Each property, like `strategy` or `risk`, is a simple on/off switch (true or false) to control the generation of specific event logs, allowing you to focus on the most important parts of your backtest.

## Interface IReportDumpOptions

This interface, `IReportDumpOptions`, helps you control what information gets saved when generating reports from your backtesting runs. Think of it as a set of labels you can apply to your data to organize and filter it later. You'll find properties here like the trading pair (symbol), the name of the trading strategy you used, the exchange it ran on, the timeframe (frameName) it was using, a unique identifier for any signals generated, and the name of any optimization walker involved.  Using these properties allows for precise organization and searching of your backtest results.

## Interface IPublicSignalRow

This interface, `IPublicSignalRow`, is designed to give you a complete picture of a trading signal, especially when trailing stop-loss or take-profit orders are in use. It builds upon the standard signal information by adding the original stop-loss and take-profit prices, which remain constant even if those values change due to trailing. This allows you to see the initial risk management parameters alongside the currently active ones.

You'll also find details about the signal's cost, how much of the position has been partially closed, the number of entries and partials, the original entry price, and the current unrealized profit and loss. Essentially, it’s a comprehensive snapshot of a signal's journey.

Here’s a breakdown of the information provided:

*   **Cost:** The initial investment needed to enter the position.
*   **Original Stop-Loss & Take-Profit:** The initial stop-loss and take-profit levels set when the signal was created.
*   **Partial Executed:** The percentage of the position that has been closed out through partial trades.
*   **Total Entries:**  The number of times the position has been added to (useful for understanding dollar-cost averaging).
*   **Total Partials:** The number of partial closing trades executed.
*   **Original Entry Price:** The price at which the position was initially opened, unaffected by averaging.
*   **Unrealized P&L:**  The current profit or loss based on the current market price.

## Interface IPublicCandleData

This interface describes a single candlestick, providing a snapshot of price action and volume over a specific time interval. Each candlestick contains essential data points like the time it started (timestamp), the price when it opened (open), the highest price reached (high), the lowest price observed (low), the price when it closed (close), and the total trading volume during that period (volume).  Think of it as a standardized way to represent a bar of data on a price chart. These pieces of information are crucial for analyzing market trends and developing trading strategies.

## Interface IPositionSizeKellyParams

This interface defines the parameters needed to calculate position sizes using the Kelly Criterion. It lets you specify how often your trading strategy wins (the win rate, a number between 0 and 1) and the average amount you win compared to how much you lose (the win/loss ratio). These two values are essential for determining the optimal amount of capital to allocate to each trade based on the Kelly Criterion's principles. You’ll use these parameters to help manage risk and maximize long-term growth.

## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed to calculate position sizes using a fixed percentage of your available capital. It’s designed to ensure consistent risk management by always sizing your trades based on a predetermined percentage.

The `priceStopLoss` property specifies the price at which a stop-loss order should be placed for the trade; this is crucial for controlling potential losses. Think of it as the price level where you'll automatically exit the trade to limit downside risk.

## Interface IPositionSizeATRParams

This interface defines the parameters needed when calculating position size using an Average True Range (ATR) approach. It focuses specifically on the ATR value itself. The `atr` property holds the numerical value of the ATR, which is a key input for determining how much capital to allocate to a trade based on volatility. Essentially, it tells you how much the asset typically fluctuates.

## Interface IPositionOverlapLadder

This interface defines how to control the detection of overlapping positions when using dollar-cost averaging (DCA). It lets you specify zones around each DCA level where positions are considered to be overlapping. 

You can adjust the `upperPercent` to define how much above each DCA level triggers an overlap warning, and `lowerPercent` to define how much below each DCA level does the same. Think of these percentages as creating a buffer zone around each DCA – if a new position falls within this zone, it's flagged as a potential overlap. These values are expressed as percentages, with 5 representing 5%.

## Interface IPersistBase

This interface provides a standard way for your custom storage solutions to work with the backtest-kit trading framework. Think of it as the core set of actions—reading, writing, checking for existence, and listing all stored items—that any persistent storage system needs to support. 

The `waitForInit` method handles initial setup and verification of your storage, ensuring things are ready to go. `readValue` retrieves an item, `hasValue` simply confirms an item exists, and `writeValue` saves a new or updated item. Finally, `keys` gives you a way to iterate through all the identifiers of items stored. This allows for validation and processing of all your data.

## Interface IPartialProfitCommitRow

This object represents a single instruction to take a partial profit on a trade. It’s used to tell the backtest engine how much of a position to close and at what price. 

Essentially, it tells the system to sell a certain percentage of your holdings (specified by `percentToClose`) at the prevailing market price (`currentPrice`) – which is labeled as "partial-profit" action.  This helps you lock in some gains along the way.

## Interface IPartialLossCommitRow

This interface represents a single instruction to partially close a position within a backtest. Think of it as one step in a series of actions telling the backtest engine to sell a certain percentage of your holdings at a given price. Each instruction specifies the percentage of the position to close (`percentToClose`) and the price at which that closure occurred (`currentPrice`), alongside an identifier (`action`) confirming the action is a partial loss. These instructions are queued up and processed during the backtest simulation to accurately reflect trading decisions.

## Interface IPartialData

This interface, `IPartialData`, is all about saving bits and pieces of your trading signal's progress. Think of it as a snapshot – a way to store key information like the profit and loss levels that have been hit. Because some data types don't play nicely with saving to files, we convert things like sets of levels into simple arrays to make the process easier. This partial data is stored and later rebuilt into a complete trading state when you need it.

It mainly holds two pieces of information:

*   `profitLevels`: A list of the profit levels achieved.
*   `lossLevels`: A list of the loss levels reached.

## Interface IPartial

This interface, `IPartial`, manages how your trading signals track profit and loss. It's used internally by the backtest-kit framework to keep tabs on milestones like reaching 10%, 20%, or 30% profit or loss for each active signal.

The `profit` method handles situations where a signal is making money; it figures out which milestones have been hit and sends out notifications accordingly.  Similarly, the `loss` method does the same for signals experiencing losses.  Both methods avoid sending duplicate notifications by keeping track of what’s already been reported.

Finally, the `clear` method is used when a signal is finished – whether it hits a take profit, stop loss, or simply expires – to clean up the recorded data and free up resources.

## Interface IParseArgsResult

This interface, `IParseArgsResult`, holds the outcome when you parse command-line arguments for your trading setup. It essentially combines your initial parameters with flags that determine the trading environment. You'll find boolean values indicating whether the system should run in backtest mode – simulating trades on historical data – paper trading mode – practicing with live data but virtual money – or live trading mode – actual trading with real funds. It helps you easily control the environment your trading strategy operates in.


## Interface IParseArgsParams

The `IParseArgsParams` interface acts as a blueprint for the information needed to run a trading strategy. Think of it as a structured way to tell the backtest-kit exactly what you want it to do. It defines the essential pieces of information like which trading pair (symbol) you're interested in, the name of the strategy you’re using, the exchange you’re connecting to, and the timeframe of the price data.  This provides default settings, making sure everything’s configured correctly before the backtesting process begins.


## Interface IOrderBookData

This interface, `IOrderBookData`, represents a snapshot of an order book for a particular trading pair. It holds the current bids and asks, giving you a view of the prices buyers are willing to pay and sellers are willing to accept. The `symbol` property tells you which trading pair this data refers to, like "BTCUSDT."  The `bids` array contains information about buy orders, and the `asks` array contains information about sell orders. Each element in these arrays follows the `IBidData` structure, which you'll need to look up separately.

## Interface INotificationUtils

This interface defines the common methods that any system responsible for sending notifications – like email, SMS, or webhooks – needs to implement within the backtest-kit trading framework. Think of it as a contract; any notification adapter *must* provide these functions. 

The `handleSignal` method is called whenever a trading signal occurs, whether it’s a trade opening, closing, being scheduled, or canceled. Similar methods exist for partial profit, partial loss, and breakeven events, providing updates on those specific scenarios. `handleStrategyCommit` lets the adapter respond to changes like setting up trailing stops or profit targets. The `handleSync` method deals with synchronization updates of signals, while `handleRisk` reports on rejected risk requests.  

For unexpected problems, `handleError` and `handleCriticalError` provide ways to report and manage errors, and `handleValidationError` deals with data validation issues. Finally, the `getData` method allows you to retrieve all notifications that have been stored, and `clear` will erase all of them.

## Interface IMethodContext

This interface, `IMethodContext`, acts like a little roadmap for your trading logic. It tells backtest-kit which specific configurations to use when running a strategy, exchange, or frame. Think of it as a way to pass along important identifiers – the names of your strategy, exchange, and frame – so the system knows exactly what components to load and use.  It’s automatically passed around, so you usually don't need to handle it directly, but understanding its role helps clarify how backtest-kit organizes its operations. The `frameName` being empty indicates that it's operating in live trading mode, not a backtest.

## Interface IMarkdownTarget

This interface lets you fine-tune which detailed reports are generated during your backtesting. Think of it as a way to pick and choose what insights you want to see. You can selectively enable reports for things like strategy signals, risk management rejections, breakeven events, partial fills, portfolio heatmaps, walker optimization, performance bottlenecks, scheduled signals, live trading activity, or even a full history of backtest results. This gives you precise control over the level of detail in your backtest analysis.

## Interface IMarkdownDumpOptions

This interface, `IMarkdownDumpOptions`, helps organize and filter information when generating documentation or reports about your trading strategies. Think of it as a container holding key details like the file path, trading symbol (like BTCUSDT), the name of your strategy, the exchange you're using, and the timeframe it operates on.  It's especially useful for creating organized markdown dumps, allowing you to focus on specific aspects of your backtesting results. Each property represents a piece of context – for instance, `symbol` identifies the trading pair being analyzed, while `strategyName` lets you pinpoint a particular strategy's performance.

## Interface ILogger

The `ILogger` interface defines how different parts of the backtest-kit framework communicate about what's happening. Think of it as a standardized way to record events and information throughout the system.

It offers several logging methods, each for a different level of detail. `log` is for general messages about important events. `debug` is for very detailed information useful for developers. `info` is for conveying regular updates about successful actions. Finally, `warn` flags potential problems that aren’t critical errors but warrant investigation.

These logging methods – `log`, `debug`, `info`, and `warn` – are used across various components to track everything from agent activity and policy checks to storage updates and error conditions, which helps with understanding and fixing issues.

## Interface ILogEntry

Each log entry in the backtest-kit framework contains a unique identifier, a level indicating its severity (like "log", "debug", "info", or "warn"), and a timestamp marking when it was created.  You'll also find a creation date, a precise Unix timestamp, and optional contextual information like method and execution details to help you understand where the log originated.  The entry includes a topic or method name and can also carry additional arguments passed during the logging call.  This detailed information is designed to make debugging and analyzing your backtesting results much easier.

## Interface ILog

The `ILog` interface provides a way to manage and retrieve trading activity logs within the backtest-kit framework. Think of it as a record-keeping system for your backtesting runs. The key feature here is `getList`, which allows you to fetch a complete history of all log entries generated during a backtest. This is useful for debugging, analyzing performance, or simply understanding the sequence of events that occurred.

## Interface IHeatmapRow

This interface represents a single row of data displayed in a portfolio heatmap, giving you a quick overview of how a specific trading pair performed. It bundles together key performance indicators for all strategies used with that pair, like total profit or loss, risk-adjusted returns (Sharpe Ratio), and maximum drawdown. 

You'll find important metrics like the total number of trades, win/loss counts, and win rate, allowing you to easily gauge the trading activity and success rate. It also details information about typical trade sizes and streaks, such as average winning and losing trade amounts, and the longest sequences of wins or losses. Finally, expectancy, a calculation combining win rate and average win/loss sizes, offers a more comprehensive view of the pair’s potential profitability.

## Interface IFrameSchema

This defines a blueprint for how your backtesting data is organized into frames – think of them as discrete chunks of time you'll be analyzing. Each frame schema has a unique name so you can easily identify it, and you can add a note for your own reference. 

It specifies the time interval used to create these frames, along with the beginning and end dates for your backtest period. 

You can also add optional callbacks to be triggered at specific points in the frame lifecycle, letting you customize how data is processed. This is all about setting up the foundation for structured backtesting.


## Interface IFrameParams

The `IFrameParams` interface defines the information needed to set up a core processing unit, or "frame," within the backtest-kit system. It builds upon the `IFrameSchema` and crucially includes a `logger`.  Think of the `logger` as a way to keep track of what's happening inside the frame, providing helpful debug messages as your backtest runs. This ensures you can monitor its behavior and troubleshoot any issues that might arise.

## Interface IFrameCallbacks

This function gets called whenever the backtest-kit creates a new set of timeframes for your analysis. Think of it as a notification that the framework has prepared the dates it will be using.  You can use it to check if the timeframe generation looks right, maybe to log the start and end dates, or to ensure the intervals are as expected. It receives the array of dates, the overall start and end dates, and the chosen interval as parameters.

## Interface IFrame

The `IFrame` interface is a core piece of backtest-kit, handling how your data is organized across different timeframes. Think of it as the engine that creates the list of specific dates and times your trading strategy will be tested against.

Specifically, the `getTimeframe` function is crucial. You give it a symbol (like "BTCUSDT") and a frame name (like "1h" for 1-hour intervals), and it returns an array of dates representing the points in time your backtest will run. This function ensures that your data is evenly spaced according to the timeframe you've chosen.


## Interface IExecutionContext

This interface defines the information available during a trading simulation or live execution. Think of it as a package of essential details passed around to different parts of the system.

It includes the trading symbol, like "BTCUSDT," so everything knows which asset is being worked with. 

It also keeps track of the current time, which is vital for placing orders and analyzing data. 

Finally, it indicates whether the code is running a backtest (analyzing historical data) or a live trade.

## Interface IExchangeSchema

The `IExchangeSchema` acts as a blueprint for connecting your backtest-kit framework to different cryptocurrency exchanges. It outlines how the framework will retrieve and process data from each exchange.

You’ll use this schema to register each exchange you want to use, providing a unique identifier for it.  A helpful note field is available for your own documentation purposes.

The core functionality is defined by `getCandles`, which is responsible for fetching historical price data (candles) for a given trading pair and time period.  You also define how trade quantities and prices should be formatted to match the specific rules of each exchange using `formatQuantity` and `formatPrice`. These formatting functions are optional, with Binance’s Bitcoin precision used as the default if not provided.

Additionally, you can implement `getOrderBook` and `getAggregatedTrades` to retrieve order book data and trade history, although these are optional – the framework will let you know if you’re missing them.  Finally, `callbacks` allows you to hook into specific events, like when new candle data arrives.


## Interface IExchangeParams

This interface defines the essential configuration needed to connect to an exchange within the backtest-kit framework. It outlines the services and functions your exchange implementation must provide.

You’ll need to supply a logger for debugging and an execution context that holds information like the trading symbol and timeframe.

Critically, the interface requires methods for retrieving historical candle data, formatting order quantities and prices to match the exchange's rules, fetching order book data, and obtaining aggregated trade history. These are all core functions for simulating trading activity and require accurate implementations. Default values are applied if not provided, but you should override them with exchange-specific details for accurate backtesting.

## Interface IExchangeCallbacks

This interface lets you hook into events happening when the backtest kit pulls data from an exchange. Specifically, `onCandleData` is a function you can provide to be notified whenever new candlestick data arrives for a particular trading symbol and time interval. The data includes the symbol, the interval (like 1 minute or 1 day), the start date and time for the data, how many data points were requested, and an array of the actual candle data received. You can use this to react to new data as it comes in, perhaps for real-time monitoring or adjustments to your strategy.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with cryptocurrency exchanges. It allows you to retrieve historical and future price data (candles) for a specific trading pair and time interval. You can also request the order book and aggregated trade data for a pair. 

The framework helps you format order quantities and prices to match the exchange's requirements. It provides a way to calculate the VWAP (Volume Weighted Average Price) based on recent trades.

A particularly useful feature is the flexible `getRawCandles` method, which lets you fetch historical data with customized date ranges and limits while avoiding look-ahead bias and respecting the backtest context. This provides a lot of control over retrieving the specific historical data needed for your backtesting scenarios.

## Interface IEntity

This interface, IEntity, serves as the foundation for all data objects that are stored and managed within the backtest-kit framework. Think of it as a common blueprint ensuring consistency across different types of persistent data, like historical prices or trade records. Any class that needs to be saved or loaded from a data store should implement this interface. Essentially, it provides a standardized way to interact with and manipulate your data.

## Interface ICommitRowBase

This interface, `ICommitRowBase`, acts as a foundation for events that need to be committed later, ensuring everything happens at the right time during the trading process. It holds essential information about each event. Specifically, it tells you the trading pair involved – identified by its `symbol` – and whether the action is happening within a backtesting simulation with the `backtest` flag. Think of it as a basic building block for tracking what happened and when, especially when things need to be processed in a specific order.

## Interface ICheckCandlesParams

This interface defines the information needed to check if your cached candle data is valid. It's used to verify that the timestamps of your historical price data match what you'd expect. You'll need to provide the trading pair symbol, the exchange you're using, the time interval of the candles (like 1-minute or 4-hour), and the start and end dates for the validation period.  You can also specify the directory where your candle data is stored, although there’s a default location if you don't.

## Interface ICandleData

This interface represents a single candlestick, the fundamental building block for analyzing price action and running backtests. Each candlestick holds information about a specific time period, including when it began (timestamp), the opening price, the highest and lowest prices reached, the closing price, and the volume of trades that occurred. Think of it as a snapshot of market activity over a defined interval – useful for strategies that react to price movements and volume changes.  The timestamp is recorded in milliseconds since the Unix epoch, allowing for precise time-based calculations.

## Interface ICacheCandlesParams

This interface defines the settings you'll use to download historical price data and save it for later use in your backtests. Think of it as a recipe for getting the data you need. You'll specify the trading pair (like BTCUSDT), the exchange where that pair is traded, the timeframe for the candles (like 1-minute or 4-hour intervals), and the start and end dates you want to cover.  Essentially, you're telling the system which specific historical data to retrieve and store.

## Interface IBroker

This interface defines the core functions a broker implementation needs to provide within the backtest-kit framework. The `waitForInit` method is essential for ensuring the broker is fully ready before any trading actions begin.  Several `on...Commit` methods handle different trade management events; these functions are triggered when the system wants to execute actions like opening a new position (`onSignalOpenCommit`), closing an existing one (`onSignalCloseCommit`), or adjusting stops and take profits. You’ll find methods for handling partial profit taking (`onPartialProfitCommit`), partial loss management (`onPartialLossCommit`), trailing stops (`onTrailingStopCommit`), trailing take profits (`onTrailingTakeCommit`), setting breakeven prices (`onBreakevenCommit`), and managing average buy orders (`onAverageBuyCommit`). Each of these commit methods receives a payload containing the specific details of the action to be performed.

## Interface IBreakevenData

This interface, `IBreakevenData`, is designed to help save and load information about whether a trade has reached its breakeven point. It's a simplified version of the full breakeven state, focusing only on whether breakeven has been achieved. This simplified data is easy to store in a database or file, as it’s just a single boolean value. When the data is loaded back, it’s transformed into the more detailed `IBreakevenState` to be used in the trading system. Essentially, it's a bridge for persisting breakeven status.


## Interface IBreakevenCommitRow

This interface represents a record of a breakeven commitment that's been queued for processing. It essentially tracks when a breakeven point was established and at what price. The `action` property confirms this record pertains specifically to a breakeven calculation.  The `currentPrice` provides the price level at the time the breakeven was determined, offering context for later analysis.


## Interface IBreakeven

This interface manages when a trading signal's stop-loss is adjusted to the entry price, essentially hitting a breakeven point. It's used by components that handle signal execution and tracking.

The `check` method is what determines if breakeven has been reached. It looks at the current price and decides if it has moved sufficiently to cover any trading fees or commissions, and if the stop-loss can then be moved back to the original entry price. When this happens, it records the event and notifies interested parties.

The `clear` method is used to reset this tracking when a signal is finished – either by hitting a take-profit or stop-loss target, or expiring. It cleans up the internal state and saves this change so it's remembered for later.

## Interface IBidData

This interface, `IBidData`, represents a single bid or ask price point within an order book.  It's essentially a snapshot of the best available price and how much is being offered at that price. Each bid or ask will have a `price` – a string representing the price level – and a `quantity` – another string indicating the number of assets available at that price. Think of it as a simple record showing what someone is willing to buy or sell and at what cost.

## Interface IAverageBuyCommitRow

This interface represents a single step in a recurring average-buy (or DCA) strategy. Think of it as a record of one purchase made as part of your automated buying plan.

It tells you the price at which the buy was executed, how much that single buy cost in dollars, and the total number of buys that will have happened in your average-buy strategy up to that point. The `action` property confirms that this record is specifically related to an average-buy operation.

## Interface IAggregatedTradeData

This interface describes a single trade that happened, giving you the details needed for analyzing and backtesting. Each trade is identified by a unique ID, and you'll find the price, the quantity that was traded, and the exact time it took place.  A key piece of information is whether the buyer was acting as the market maker, which helps understand the direction of the trade. This data point is designed for a deeper look into trading activity.

## Interface IActivateScheduledCommitRow

This interface represents a queued request to activate a scheduled commit within the backtest-kit framework. Think of it as a message telling the system to trigger a previously planned action. 

It includes the type of action, which is always "activate-scheduled," along with a unique identifier for the signal being activated. An optional activation ID is also provided, useful when an activation is started directly by the user rather than automatically. These elements work together to precisely target and execute the intended scheduled commitment.

## Interface IActionSchema

This interface, `IActionSchema`, describes how you can add custom actions to your backtesting strategies. Think of actions as hooks that allow you to inject your own logic into the trading process – they're a flexible way to extend the framework's capabilities. 

You can use these actions to manage state, log events, send notifications, collect data, or trigger other custom operations.  Each action is created specifically for each strategy and the timeframe you're using, so it has access to all the events generated during execution.  You can add multiple actions to a single strategy to perform various tasks. 

The `actionName` is a unique identifier so the framework knows which action you’re registering. You can also add a `note` for your own documentation. The core of the action is the `handler`, which is either a constructor function that will be used to create the action instance or a portion of the `IPublicAction` interface itself. Finally, you can define `callbacks` to control when and how your action interacts with the trading process.


## Interface IActionParams

This interface defines the information provided when an action is created within the backtest-kit framework. Think of it as a package of details that tells the action *what* it's doing and *where* it's happening. It includes a logging tool for tracking what's going on, identifies the strategy and timeframe it's associated with, and specifies whether it's being run as a backtest. You’ll find the exchange the action is operating on, along with flags indicating if the test is a backtest or live execution. This gives actions the context they need to function properly within the larger trading system.

## Interface IActionCallbacks

This interface, `IActionCallbacks`, provides a way to hook into different stages of an action handler's lifecycle and receive notifications about key events. Think of it as a set of customizable event listeners that let you extend and monitor what’s happening within your trading strategies.

You can use `onInit` to perform setup tasks like connecting to a database or initializing external services when an action handler starts. Conversely, `onDispose` allows you to clean up resources, like closing database connections or saving state, when the handler is finished.

Several callbacks relate to signal generation. `onSignal` is a general-purpose listener for signals, while `onSignalLive` and `onSignalBacktest` specifically handle live and backtesting environments respectively. There are also callbacks to monitor breakeven, partial profit, and partial loss triggers, along with those for scheduled and active signal monitoring.

Finally, `onRiskRejection` notifies you when a signal is blocked by risk management, and `onSignalSync` provides a critical opportunity to intercept and control synchronous signal execution—returning a rejection will cause the framework to retry the action. These callbacks give you fine-grained control and visibility into your trading processes.

## Interface IAction

This interface, `IAction`, is your central hub for managing events within the backtest-kit framework. Think of it as a way to hook into what's happening during a backtest or live trading session and react accordingly.

It provides several methods, each responding to a different type of event – signals, breakeven notifications, partial profit/loss updates, scheduled pings, and risk rejections. You can use these methods to build custom logic like dispatching actions to a state management library (like Redux or Zustand), logging events, or creating real-time monitoring dashboards.

For instance, `signal` handles general signal events, while `signalLive` and `signalBacktest` specifically target live or backtest modes.  There are also methods to respond to when a stop loss moves to entry price (`breakevenAvailable`), or when partial profit/loss levels are reached.

The `signalSync` method is special - if something goes wrong during a limit order attempt, you can throw an error to have the framework retry. Finally, `dispose` is crucial for cleaning up resources when you're finished – think unsubscribing from any subscriptions you've set up.

## Interface HeatmapStatisticsModel

This model provides a snapshot of how your entire portfolio is performing, visualized in a heatmap. It gathers key data points for each symbol you're tracking and presents them in a consolidated view. You'll find an array detailing the statistics for each individual symbol, alongside overall portfolio metrics like total profit/loss (PNL), Sharpe Ratio, the total number of trades executed, and the total count of symbols included. This helps you quickly assess the overall health and performance of your portfolio.


## Interface DoneContract

This interface helps you track when background tasks finish, whether they’re running a backtest or live trading. When a background process, like a backtest or live execution, concludes, this object provides important details about what just happened. You'll find information like the exchange used, the name of the trading strategy that ran, and whether it was a backtest or live execution. It also includes the trading symbol, so you know precisely which asset was involved. Think of it as a notification letting you know when a task is done and giving you a summary of the context.

## Interface CriticalErrorNotification

This notification signals a critical error within the backtest-kit framework that demands the process be stopped immediately. It's a serious event, indicating something has gone wrong that can't be recovered from. 

Each critical error notification has a unique identifier (`id`) to help track it down. You'll also get a human-friendly explanation of the error in the `message` field. The `error` property contains detailed technical information about the problem, including a stack trace and other useful data for debugging. Notably, these errors originate outside of the backtest simulation itself—the `backtest` property will always be `false`.


## Interface ColumnModel

This interface helps you control how data appears in tables generated by backtest-kit. Think of it as a blueprint for defining a single column. Each column needs a unique `key` to identify it, and a human-readable `label` for the header.  The `format` property is a function that transforms your data into a string suitable for display, allowing for custom formatting.  Finally, `isVisible` lets you conditionally hide or show a column based on certain conditions, giving you more flexibility in how you present your data.

## Interface ClosePendingCommitNotification

This notification tells you when a pending trade signal has been closed before it actually became a live position. It's a way to track what happens to signals that don't make it through to execution, especially useful when testing strategies.

The notification includes a unique ID and timestamp, letting you pinpoint exactly when the closure occurred. You’ll find information about the trade itself: the symbol being traded, the strategy that generated the signal, the exchange involved, and a unique identifier for both the original signal and the closing action.

It provides details about how the trade was constructed, like the number of entries and partial closes, and the original entry price before any averaging took place.  You also get a snapshot of the potential profit and loss (PNL) data, including percentages, calculated prices, and the total cost and capital involved. Finally, it records when this notification was created for tracking purposes.

## Interface ClosePendingCommit

This event signals that a pending order has been closed. It's used to communicate the details of that closure to the backtest system. 

You'll find information about the action taken, specifically that it's a "close-pending" event. Optionally, you can provide a `closeId` to help identify the reason for the closure, such as a specific user action.  Finally, the `pnl` property contains the Profit and Loss data associated with this closed order, giving you a snapshot of its financial impact at the time of closure.

## Interface CancelScheduledCommitNotification

This notification tells you when a previously scheduled trading signal has been cancelled before it actually executed. It's like a heads-up that something you planned didn't happen.

The notification includes a unique ID for tracking, a timestamp indicating when the cancellation took place, and information about whether it happened during a backtest or live trading. 

You’ll also find details about the trade itself, like the symbol being traded, the strategy that created the signal, and a unique ID for the signal itself.  The notification also provides details about the cancellation reason with a `cancelId`, the number of entries and partials, original entry price and current profit/loss (PNL) information, including percentages and absolute values. Finally, the creation timestamp is provided for comprehensive record-keeping.

## Interface CancelScheduledCommit

This interface allows you to cancel a previously scheduled signal event within your backtesting strategy. It's useful when you need to interrupt a future action, perhaps due to changing market conditions or a strategic reassessment. 

When cancelling, you can provide a `cancelId` to give a reason for the cancellation, which is helpful for tracking and debugging.  You'll also include the unrealized Profit and Loss (`pnl`) that existed at the time the scheduled event was originally planned. This provides important context for understanding the impact of the cancellation. The `action` property is fixed and identifies this as a cancellation request.


## Interface BreakevenStatisticsModel

This model holds information about breakeven points encountered during a backtest. It gives you a detailed view of how often your strategy reached breakeven and what those events looked like. 

You'll find a complete list of all the identified breakeven events, each with its specific details, stored within the `eventList` property.  The `totalEvents` property simply tells you the total count of these breakeven occurrences.

## Interface BreakevenEvent

This data structure holds all the key information about when a trade reaches its breakeven point. Think of it as a snapshot of what happened at that specific moment. It includes details like the exact time, the trading pair involved, the strategy and signal that triggered the trade, and the position type (long or short).

You'll find the entry price, take profit and stop-loss levels, along with their originally set values, providing a clear picture of the trade's initial plan. It also tracks information about any DCA (Dollar Cost Averaging) or partial closes that occurred, including the total number of entries, partials executed and the original entry price before averaging. 

Furthermore, the data includes the current price at breakeven, the unrealized profit and loss (PNL) at that time, and any notes explaining the reason behind the signal.  Finally, it notes when the position became active and when the signal was initially created, plus whether the trade is part of a backtest or live trading scenario.

## Interface BreakevenContract

The `BreakevenContract` represents a significant event in your trading strategy – when a signal's stop-loss has been moved back to the entry price, essentially meaning the trade has covered its costs and is now risk-free. This happens when the price moves favorably enough to offset transaction fees.

You'll see these events emitted for each signal, but only once to avoid duplicates. They provide valuable data for understanding how your strategies are managing risk and achieving milestones.

Each `BreakevenContract` includes details like the trading pair (`symbol`), the strategy's name (`strategyName`), the exchange (`exchangeName`), the timeframe (`frameName`), the original signal data (`data`), the price that triggered the breakeven (`currentPrice`), whether it's a backtest or live trade (`backtest`), and the precise time of the event (`timestamp`). This information helps in generating reports, tracking strategy performance, and providing updates to users who are monitoring their trades.


## Interface BreakevenCommitNotification

This notification tells you when a breakeven action has been triggered within your trading system. It's like a confirmation that your strategy has reached a point where it's automatically adjusting your trade to protect profits or minimize losses.

The notification includes a lot of details about the trade: the unique identifier for the action, when it happened, whether it was a backtest or live trade, and the specific trading pair involved. You’ll also find the strategy name, exchange, and a unique ID for the signal that prompted this action.

It provides the current price at the time of the breakeven, along with details about the original entry price, take profit, and stop loss levels—both as they were initially set and as they've been adjusted. If you’re using DCA (Dollar Cost Averaging), you'll see the number of entries and partial closes.

Finally, the notification gives you a full picture of the position's profitability, including PNL (profit and loss) figures in both absolute (USD) and percentage terms, as well as key timestamps related to the signal’s lifecycle. This allows you to thoroughly analyze the conditions leading up to the breakeven action.

## Interface BreakevenCommit

The `BreakevenCommit` represents when a trading strategy adjusts a position to breakeven. It signals that the strategy is essentially resetting the stop-loss to the current price, aiming to protect any profits made so far.

This event includes important details like the current market price, the unrealized profit and loss (PNL) at the time of the adjustment, and whether the position is a long (buy) or short (sell) trade.

You'll also find the original entry price, and the initially set take profit and stop loss prices, along with their values after any trailing adjustments have been applied. Timestamps indicate when the breakeven signal was generated and when the position was initially activated.

## Interface BreakevenAvailableNotification

This notification lets you know when a trading signal's stop-loss has reached the point where it can be moved to breakeven – essentially, the original entry price. It's a helpful signal indicating the trade has potentially recovered any initial losses.

The notification includes a lot of detail about the trade, such as the symbol being traded (like BTCUSDT), the name of the strategy that generated the signal, and the exchange used. You'll find information about the signal's ID, the current market price, and the original entry price.

It also provides details about any averaging (DCA) or partial closes that occurred, along with the current profit and loss figures, both in absolute USD and as a percentage.  The timestamps show when the signal was created, when the position went pending, and when the breakeven condition was met. Knowing whether the notification is from a backtest or a live trade is also included.

## Interface BacktestStatisticsModel

This model holds all the key statistical information calculated after a backtest. You’ll find a detailed list of every closed trade, complete with prices, profits, and timestamps, within the `signalList` property.  It also provides crucial summary numbers like the total trades executed, the number of winning and losing trades, and the overall win rate. 

Beyond the basics, you'll get performance metrics to assess risk and reward. This includes the average profit per trade (`avgPnl`), the total profit (`totalPnl`), and measures of volatility like standard deviation (`stdDev`) and Sharpe Ratio. The Sharpe Ratio, and its annualized version, help you understand how well your strategy performs relative to the risk it takes. You’ll also find the Certainty Ratio to gauge the consistency of winning trades compared to losses and an estimate of expected yearly returns.  Keep in mind that any of these numerical values that are unreliable due to potential errors will be represented as null.

## Interface AverageBuyCommitNotification

This notification tells you when a new average-buy (DCA) entry has been added to an open trading position. It’s emitted during both backtesting and live trading, letting you track the progress of your DCA strategy. You'll find details like the unique identifier of the notification, the exact time it occurred, and whether it happened during a backtest or live trade.

The notification includes key information about the trade, such as the symbol being traded, the strategy that generated the signal, the exchange used, and the price at which the new DCA entry was executed.  It also provides the cost of that entry, and the updated average entry price based on all the entries made so far.

You can see the overall performance too, with details on the current profit and loss, both in USD and as a percentage, and the effective prices used for PNL calculations.  Finally, timestamps related to signal creation and pending status are included for more comprehensive tracking.

## Interface AverageBuyCommit

This event, called AverageBuyCommit, signals that a new buy or sell order has been executed as part of a dollar-cost averaging (DCA) strategy. It's triggered whenever a new entry is added to a position that’s already being averaged. The event provides details about this particular averaging purchase, including the price it was executed at (currentPrice) and the total cost of that transaction. You'll also find the updated average entry price (effectivePriceOpen), the unrealized profit and loss (pnl), and the original entry price set by the initial signal (priceOpen). Crucially, it includes both the original and adjusted take profit and stop loss prices, helping you track how trailing might have affected your risk management. Finally, timestamps (scheduledAt and pendingAt) provide a timeline of when the signal was created and the position became active.

## Interface ActivePingContract

This interface, `ActivePingContract`, provides information about ongoing monitoring of pending signals. It’s a way for the system to let you know about active pending signals—those that haven’t been closed yet—and gives you a chance to react. Every minute while a pending signal is active, you'll receive these ping events.

The events contain details like the trading symbol ("BTCUSDT"), the name of the strategy involved, the exchange being used, and all the data related to the pending signal itself. You’ll also get the current price at the time of the ping and a flag indicating whether it’s from a backtest or live trading environment. Finally, a timestamp tells you exactly when the ping event occurred.

You can use this information to build custom logic, like adjusting a signal based on price movements or managing the signal lifecycle in a specific way. The `listenActivePing` and `listenActivePingOnce` functions allow you to set up callbacks to respond to these events.

## Interface ActivateScheduledCommitNotification

This notification signals that a scheduled trading signal has been manually activated, letting you know a trade is starting. It contains a wealth of information about the trade, including a unique identifier and the timestamp of when it was activated. 

You'll find details about the strategy that generated the signal, the exchange it's running on, and the specific trade direction (long or short). The notification also breaks down key pricing information like the entry price, take profit levels, and stop-loss orders, both as they currently stand and as they were originally set. 

For strategies employing dollar-cost averaging (DCA) or partial closes, you'll see the number of entries and partials executed. It also includes profit and loss data, the creation timestamps, and the current market price at the time of activation, allowing you to track the trade’s performance from the very beginning. Knowing whether the signal came from a backtest or live environment is also included.


## Interface ActivateScheduledCommit

This interface describes the data sent when a previously scheduled trading signal is activated. It's used to communicate all the key details about the trade that's now being executed. 

You'll find information like the trade direction (long or short), the entry price, and the take profit/stop loss levels, both as they currently are and as they were originally set. There's also a timestamp to mark when the signal was initially created and when the trade is actually being activated. 

The `activateId` allows you to add a custom identifier to track why a specific activation happened. Finally, the P&L is provided to give you an immediate snapshot of the trade's profitability at the moment of activation.
