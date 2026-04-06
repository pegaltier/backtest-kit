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

This interface defines what information is shared when a walker is instructed to stop. 

It's essentially a notification that a walker, which is a process executing a trading strategy, needs to be halted.

The message includes the trading symbol involved, the name of the specific strategy being stopped, and the name of the walker itself. 

This is important because you might have several walkers running different strategies on the same asset at once, and this lets you pinpoint exactly which one is being stopped.

## Interface WalkerStatisticsModel

The WalkerStatisticsModel helps organize and understand the results of your backtesting experiments. It builds upon the standard WalkerResults, adding the ability to compare different strategies against each other. 

Think of it as a central hub holding all the performance data for your strategies, presented in an easy-to-analyze format. Specifically, it includes an array of strategy results, making it simple to see how each strategy performed relative to the others.

## Interface WalkerContract

The WalkerContract represents updates you receive as backtest-kit runs comparisons between different strategies. Think of it as a notification that a particular strategy has finished being tested and its results are available.

Each notification contains key details:

*   The name of the walker performing the test.
*   The exchange and frame being used.
*   The trading symbol being backtested.
*   The name of the strategy that just finished.
*   The backtest statistics for that strategy.
*   The actual metric value being optimized for the strategy (it might be null if the test wasn't valid).
*   The metric the system is trying to improve.
*   The best metric achieved so far among all strategies tested.
*   The name of the strategy currently holding that best metric.
*   How many strategies have been tested so far.
*   The total number of strategies the comparison will involve.

This allows you to track the progress of the backtest comparison and see which strategies are performing well and how they compare to others.

## Interface WalkerCompleteContract

The WalkerCompleteContract represents the event triggered when a backtesting process, involving multiple strategies, is finished and all results are ready. It holds a comprehensive set of information about the completed backtest. 

This includes the name of the backtesting process (walkerName), the financial instrument being tested (symbol), the exchange used for data, and the timeframe (frame) considered. You’ll also find the metric used to evaluate the strategies, the total number of strategies tested, and importantly, details about the top-performing strategy. 

Specifically, the contract provides the name of the best strategy (bestStrategy), its metric value (bestMetric), and a full set of statistics describing its performance (bestStats). This allows you to easily access all key results from a completed walker run.

## Interface ValidationErrorNotification

This notification lets you know when a validation check fails during your trading strategy's testing process. 

It's like a little alert that something went wrong with the rules you've set up to make sure your trading decisions are safe.

Each notification has a unique ID and a detailed error message that explains what happened, often including a trace of where the error originated. 

You'll also find a serialized error object, which gives you more technical information about the problem.

Importantly, this notification always indicates that the error occurred in a live context, not a backtest simulation.

## Interface ValidateArgs

This interface, ValidateArgs, is like a checklist for making sure everything is named correctly within the backtest-kit framework. It defines a set of properties – like ExchangeName, FrameName, StrategyName, and more – and expects each to be a specific type of enumeration. Think of it as a way to ensure consistent naming conventions across your exchanges, trading strategies, risk profiles, and other key components. Each property uses the same generic type 'T', meaning that the specific validation logic for each name will be handled elsewhere within the system, making sure that the names you use are valid and recognized.

## Interface TrailingTakeCommitNotification

This notification signals that a trailing take profit order has been executed. It provides detailed information about the trade, including a unique identifier and the exact time it happened. You’ll find specifics about the trading pair, the strategy that triggered the action, and the exchange used.

The notification also includes critical price data: the original and adjusted take profit and stop-loss prices, along with the entry price and current market price at the time of execution. It details whether the trade was a long or short position.

Furthermore, it reveals details related to DCA averaging, such as the total number of entries and partial closes. You’ll also receive a comprehensive profit and loss (PNL) report, including the absolute profit/loss, percentage, and the prices used in those calculations, alongside key timestamps marking the signal's creation, pending status, and the notification's creation. This allows for thorough post-trade analysis and verification of strategy performance.

## Interface TrailingTakeCommit

This describes a "trailing take" event within the backtest-kit trading framework. Think of it as a notification that a trailing stop-loss order has triggered a take-profit action. 

The event provides detailed information about the adjustment, including the percentage shift used to move the take-profit level. You'll find the current market price at the time of the adjustment, along with the unrealized profit and loss (pnl) of the position. 

The information also specifies the trade direction (long or short) and the original entry price. Crucially, it provides the updated take-profit price, as well as the original take-profit and stop-loss prices that were set initially, and the timestamps of when the signal and position were activated. This information is useful for analyzing how trailing stops and take-profits affect trading performance.

## Interface TrailingStopCommitNotification

This notification details when a trailing stop order is triggered, providing a comprehensive snapshot of the trade's status at that moment. It’s a record of actions taken during backtesting or live trading involving a trailing stop.

The notification includes key information like a unique ID, the exact timestamp of the event, and whether it occurred during backtest or live mode. You’ll find details about the trading pair, the strategy that initiated the trade, and the exchange used.

It breaks down the specifics of the trailing stop itself: the percentage shift applied, the current market price at the time of execution, and the position’s direction (long or short). You also get the original entry price and the adjusted take profit and stop loss prices, allowing you to see how trailing modified them.

Furthermore, the notification gives a full picture of the trade’s financial performance. It contains the total number of entries and partial closes, profit/loss data, including absolute profit/loss and percentage gains, as well as the entry and exit prices used for the PNL calculation. Finally, you have timestamps related to signal creation and pending states, which help in reconstructing the order's timeline.

## Interface TrailingStopCommit

This describes a trailing stop event within the backtest-kit framework. It represents an action taken to adjust a stop-loss order based on a trailing strategy.

The event indicates a "trailing-stop" action has occurred.

It includes key details like the percentage shift used to adjust the stop-loss, the current market price at the time of adjustment, and the unrealized profit and loss (PNL) of the position.

You'll also find information about the trade direction (long or short), the original entry price, and the current take profit and stop loss prices. 

Importantly, it stores the original take profit and stop loss values before any trailing adjustments were made.  Finally, timestamps are provided indicating when the signal was created and when the position was activated.

## Interface TickEvent

This interface, `TickEvent`, provides a standardized way to represent all the data associated with different actions within the trading framework. Think of it as a central container holding all the relevant information about a trade, regardless of whether it's being scheduled, opened, closed, or cancelled. 

It includes details like the exact time of the event, the action that occurred (like "opened," "closed," or "scheduled"), and key financial information. You'll find specifics about the trading symbol, the signal that triggered the action, and position details.

For trades that are actively running, you can track progress towards take profit and stop loss targets. Closed trades provide a complete history, including reasons for closure and performance metrics like profit/loss and duration. It also offers insight into DCA averaging with `totalEntries` and partial closes with `totalPartials`. Finally, it captures peak and fall performance during a position's lifetime.

## Interface SyncStatisticsModel

This model holds data about signal synchronization events, allowing you to understand how your signals are being processed and tracked. It provides a structured way to monitor the lifecycle of your signals. 

You'll find a detailed list of individual sync events, captured within the `eventList` property.  `totalEvents` simply tells you the total number of sync events that occurred.  To track signal activity, `openCount` shows how many times signals were opened, and `closeCount` indicates how many times signals were closed.

## Interface SyncEvent

This data structure holds all the important details about what's happening during a trading signal's lifecycle, designed to be easily used when creating reports. It bundles information like when an event occurred (timestamp), which asset was traded (symbol), which strategy and exchange were involved, and whether it's a backtest or live trade.

Each event includes specifics about the trade itself, such as its direction (long or short), entry price, take profit and stop-loss levels, and details about any averaging or partial closing strategies used. You'll also find crucial data like the current market price and the profit and loss (PNL) at the time of the event, along with the reason a signal was closed if applicable. Essentially, it's a comprehensive record of a signal’s journey from creation to completion.

## Interface StrategyStatisticsModel

This model holds statistical information about your trading strategy's performance. It gives you a detailed look at what's happening during backtesting.

You'll find a list of every event that occurred, like buying, selling, or modifying orders, along with a total count of all events.

It breaks down the number of specific event types, such as canceled orders, close pending orders, partial profits, partial losses, trailing stops, trailing take profits, breakeven actions, and even average buy (DCA) events. This allows you to analyze your strategy's behavior and identify potential areas for optimization.

## Interface StrategyEvent

This data structure holds all the important information about events happening within your trading strategy, whether it's a backtest or a live trade. It’s designed to give you a complete picture of what's happening, so you can create clear and informative reports.

Each event includes details like the exact time it occurred, the trading pair involved, the strategy's name, and the exchange being used. You'll also find information about the signal that triggered the action, the type of action taken (like buying, selling, or adjusting stops), and the current market price at the time.

For actions involving partial closes or adjustments to stop-loss and take-profit levels, you'll see percentages and values related to those adjustments. It also keeps track of IDs related to scheduled, pending, or activation actions.

Crucially, it includes the price information for your positions, like the entry price, take profit, and stop loss, along with the original prices before any trailing adjustments. For strategies using dollar-cost averaging, the data also records the total entries and the cost of those entries. Finally, it includes the profit and loss (PNL) information associated with the event.

## Interface SignalSyncOpenNotification

This notification tells you when a scheduled order (like a limit order) based on a signal has been executed and a position has been opened. It’s essentially a confirmation that the signal triggered a trade.

The notification includes a lot of details about the trade, such as a unique identifier, the exact time it happened, and whether it occurred during a backtest or in live trading. You’ll also find information about the trading pair, the strategy that generated the signal, and the exchange where the trade took place.

It provides key data points like the entry price, take profit and stop loss levels, and details about any profit and loss (PNL) calculations, including the original and adjusted prices. You can also see how many times the entry price was averaged using DCA (dollar-cost averaging) and any partial position closures that occurred. Finally, it includes timestamps marking when the signal was created, when the position started, and when the notification itself was generated.


## Interface SignalSyncCloseNotification

This notification is triggered whenever a pending trading signal is closed, whether it's due to a take profit or stop loss being hit, time expiration, or a manual closure. It provides a detailed record of what happened to the signal, including a unique identifier and the precise time of the closure. 

You'll find essential information like the trading symbol (e.g., BTCUSDT), the strategy that generated the signal, and the exchange where the trade occurred. The notification also includes crucial pricing data, like the entry and exit prices, and how much profit or loss was made, both in absolute and percentage terms.

Furthermore, it outlines the specifics of the trade, such as whether it was a long or short position, the initial take profit and stop loss levels, and details about any DCA (Dollar Cost Averaging) or partial closing strategies that were used. The notification also clarifies *why* the signal was closed, be it a TP/SL hit, time expiration or user intervention. Finally, it keeps track of timestamps related to signal creation and activation.

## Interface SignalSyncBase

This interface describes the common information found in all signal synchronization events within the backtest-kit framework. It provides details about the signal's origin, including the trading pair's symbol, the name of the strategy that generated it, and the exchange where the signal was executed. 

You’ll also find information about the timeframe used – relevant during backtesting – and whether the signal originates from a backtest or live trading environment.  Each signal is assigned a unique ID for tracking and has a timestamp marking when it occurred, referencing the tick or candle time. Finally, a complete signal row provides all the detailed data associated with the signal itself.

## Interface SignalScheduledNotification

This notification informs you when a trading signal is set to execute in the future. It's triggered whenever a signal is scheduled, whether you're running a backtest or live trading.

Each notification includes a unique identifier and timestamp indicating exactly when the signal was scheduled. You'll find details about the trade itself, including the symbol being traded (like BTCUSDT), the strategy that generated the signal, the exchange it's going through, and whether the signal is part of a backtest.

The notification also provides all the specifics of the intended trade: whether it’s a long (buy) or short (sell) position, the planned entry price, take-profit target, and stop-loss levels. Original prices are also present, showing the initial values before any adjustments like trailing stop losses.

For strategies using dollar-cost averaging (DCA), you can see the total number of entries and partial closes planned. Crucially, it gives you financial details including the cost of the position, unrealized profit and loss information, and the effective entry and exit prices used for PNL calculation. A current market price at the time of scheduling is also provided to give context to the signal.

## Interface SignalOpenedNotification

This notification is fired whenever a new trading position is established. It provides detailed information about the trade that just began, helping you understand exactly what happened and monitor its performance. 

You'll find a unique identifier for this specific notification, along with a timestamp indicating when the position was opened. The notification also tells you if the trade occurred during a backtest or a live trading session, and provides key details like the trading symbol (e.g., BTCUSDT), the name of the strategy that triggered the trade, and the exchange used.

The notification includes essential trade parameters: the position direction (long or short), the entry price, take profit and stop-loss levels, and their original values before any adjustments. You’ll also find information about any dollar-cost averaging (DCA) strategy used, and the total cost of the position. 

Furthermore, the notification provides profit and loss (PNL) data, including percentages and price levels used in PNL calculations. A note field allows for adding custom explanations about the signal, and there are timestamps related to the signal's creation and pending state. Finally, there's a timestamp indicating when the underlying tick result was created.

## Interface SignalOpenContract

This event lets you know when a pre-planned trading signal has been executed. It's triggered when the framework successfully fills a limit order, either buying or selling, based on a previously scheduled signal. 

Think of it as confirmation that your order was filled on the exchange, especially useful if you're tracking orders outside of the backtest-kit itself.

The event provides a lot of details about the trade, including the entry price, take profit and stop loss levels (both original and adjusted), current market price, profit and loss, and how many entries or partials were involved. You’ll see information about when the signal was initially scheduled and when the position actually started. This information is valuable for external order synchronization and logging purposes.

## Interface SignalData$1

This data structure holds all the key details of a completed trade, perfect for analyzing performance. It tells you which strategy created the trade, provides a unique ID for tracking, and specifies the symbol being traded. You'll also find the position taken (long or short), the percentage profit or loss, and the reason the trade was closed. Finally, timestamps for when the trade was opened and closed allow for precise timeline analysis.

## Interface SignalCommitBase

This defines the core information shared by all signal commitment events within the backtest-kit framework. Each signal commit includes details about the trading pair, the name of the strategy generating the signal, and the exchange where the signal originated. You'll also find the timeframe used – this is relevant during backtesting and empty during live trading.

It clearly indicates whether the signal comes from a backtest or a live environment, providing a unique identifier for each signal. The information also tracks the number of entries and partials made in relation to the signal. 

Finally, it records the original entry price, which remains constant even if the position is later adjusted through DCA averaging. Essentially, it's a standardized way to communicate the key parameters of a signal commitment event.

## Interface SignalClosedNotification

This notification details when a trading position, triggered by a signal, has been closed – whether that's due to hitting a take profit or stop loss target. It provides a wealth of information about the closed trade, including a unique identifier, the exact time it closed, and whether it occurred during backtesting or live trading.

You’ll find key details like the symbol traded, the strategy that generated the signal, and the direction of the trade (long or short). The notification includes the entry and exit prices, as well as the original take profit and stop loss levels, useful for analyzing performance.

It also contains granular data about the position's lifecycle, such as the number of DCA entries (if averaging was used) and the number of partial closes executed. Crucially, it reports the profit or loss (both as a percentage and in USD), along with a breakdown of the P&L calculation. A reason is provided to explain why the position was closed – whether due to time expiry, a take profit, a stop loss, or manual closure. Finally, timing information like when the signal was scheduled and when it started pending are also present.

## Interface SignalCloseContract

This event, `SignalCloseContract`, tells you when a pending trading signal has been closed, whether that's due to hitting a take profit or stop loss, time expiring, or a manual closure. It's designed for systems that need to stay in sync with the trading process, like external order management or audit logging tools.

The event provides key details about the closed position, including the market price at closing, the overall profit and loss, and the trade direction (long or short). You'll also find the entry and target prices (both the original values and the final, potentially adjusted ones due to trailing stops), alongside information about when the signal was created and when the position was activated.

Crucially, it also specifies *why* the signal was closed, and provides a breakdown of any averaging or partial closures that occurred during the trade. This information is especially valuable for tracking how positions were built and managed over time.

## Interface SignalCancelledNotification

This notification provides information when a scheduled trading signal is cancelled before it’s activated. It’s like a confirmation that something prevented the trade from happening.

The notification includes a lot of details to help you understand why and when the cancellation occurred. You’ll find identifiers for the signal, the strategy that created it, and the exchange involved. 

It also contains specifics about the planned trade, such as the intended entry price, take profit and stop loss levels, and whether it was a long or short position. You can see how these prices may have changed from the original levels.

Importantly, it tells you *why* the signal was cancelled, such as due to a timeout, price rejection, or a manual cancellation. You can also track the signal's lifecycle with timestamps for creation, scheduling, and cancellation.

## Interface Signal

The `Signal` object represents a single trading signal or order execution within the backtest. 

It keeps track of the entry price for a position, which is the price at which you initially bought or sold an asset.

To help you analyze your trades, it also stores a record of all entries made for this signal. 

This includes the price, the total cost, and the timestamp of each entry.

Finally, the `Signal` holds information regarding any partial exits taken during the position's lifecycle. 

For each partial exit, you'll find details like the type of exit (profit or loss), the percentage of the position taken, the price at which it exited, and the cost basis at the time of that closure.


## Interface Signal$2

This section describes the `Signal$2` object, which represents a trading signal within the backtest-kit framework. 

It keeps track of key details about a trade, starting with `priceOpen`, the price at which the position was initially entered.

You’ll also find the `_entry` array, which stores a history of entry events for the signal, including price, cost, and timestamp.

Finally, `_partial` holds information regarding any partial exits taken during the trade, noting the type of exit (profit or loss), percentage, current price, cost basis, number of shares closed, and timestamp. 


## Interface Signal$1

This section describes the `Signal$1` object, which represents a trading signal within the backtest-kit framework. 

It holds key information about a trade. The `priceOpen` property tells you the price at which the position was initially entered. 

The `_entry` array meticulously records each entry into the position, noting the price, the total cost (including fees), and the exact timestamp of the entry.  Similarly, `_partial` tracks any partial exits from the position, detailing whether the exit was for profit or loss, the percentage of the position taken, the current price at the time of the partial exit, the cost basis at the time of closure and the number of entries still open at that time, along with a timestamp.


## Interface ScheduledEvent

This data structure, `ScheduledEvent`, brings together all the important details about trading events – when they were scheduled, when they opened, and when they were cancelled. It’s designed to make report generation much easier by providing a single place to find all the relevant information.

Each event carries a timestamp marking when it occurred, and identifies the specific action taken, whether it was an opening, scheduling, or cancellation. Key details like the trading symbol, a unique signal ID, the position type, and any notes attached to the signal are all included.

Beyond the basics, you'll also find the current market price, the planned entry price, and the target prices for take profit and stop loss.  If the strategy involves averaging buys, the number of entries and the original open price before averaging are also included. Information regarding partial closes, executed percentages, and unrealized profit and loss (PNL) are present.

For cancelled events, the reason for cancellation is provided, along with a cancellation ID if the cancellation was user-initiated.  Other time-related details like how long a position was open and when it became active are also tracked. Finally, the `scheduledAt` provides a record of when the initial signal was created.

## Interface ScheduleStatisticsModel

This model provides a comprehensive view of how your scheduled signals are performing. It breaks down all events – scheduled, activated, and cancelled – into separate counts.

You can track the total number of signals scheduled, those that were successfully activated, and those that were cancelled.

To help you understand the efficiency of your scheduling, it also includes key rates: the cancellation rate (how often signals are cancelled, aiming for a lower percentage) and the activation rate (how often signals are activated, wanting a higher percentage).

Finally, it gives you averages – the average time it took for cancelled signals to be cancelled, and the average time it took for signals to activate, which can help identify bottlenecks and areas for improvement. It offers detailed event information through the `eventList` property.

## Interface SchedulePingContract

This describes a way to receive updates about scheduled signals as they're being monitored. These updates, called "schedule pings," happen every minute while a signal is active, meaning it hasn't been canceled or activated yet. 

Think of it as a heartbeat to confirm the signal is still being watched.

Each ping provides details like the trading pair (symbol), the name of the strategy using it, the exchange involved, all the data related to the signal itself, and the current market price.  You’ll also know if this ping is coming from a backtest (historical data) or live trading.  The timestamp tells you precisely when the ping occurred – either the moment of the ping in live mode or the timestamp of the candle being processed in backtest mode. This lets you create custom logic to, for example, automatically cancel signals if the price moves beyond certain limits. You can set up listeners to receive these pings as they happen.

## Interface RiskStatisticsModel

This model holds data about risk events, helping you understand and monitor your risk management processes. It includes a list of individual risk rejection events, giving you access to all the details of each occurrence.

You'll find the total number of rejections recorded, which provides a simple overall count. 

To analyze where the risks are arising, the data is also broken down by trading symbol and by the strategy used. This allows you to pinpoint specific areas needing attention or adjustments.

## Interface RiskRejectionNotification

This notification tells you when a trading signal was blocked because of your risk management rules. It’s triggered when the system decides a trade isn't safe to execute.

Each notification includes a unique ID and timestamp, so you can track specific rejections. You'll also see if the rejection happened during a backtest or live trading.

The notification clearly states the symbol being traded, the strategy that tried to place the order, and the exchange involved. It gives you a detailed explanation (rejectionNote) for why the signal was rejected, and a unique rejection ID for further investigation.

You'll also find information about your current position count, the price at the time of rejection, and details about the signal itself, including the signal ID, trade direction (long or short), entry price, take profit, stop loss, estimated time to expiration, and a signal description. This comprehensive data helps you understand and refine your risk management strategies.

## Interface RiskEvent

This data structure holds information when a trading signal is blocked due to risk limits. It's primarily used for creating reports and understanding why a signal wasn't executed.

You’ll find details such as the exact time of the rejection, the trading pair involved, and the specific signal that was blocked. It also includes the name of the strategy and exchange, the timeframe used, and the current market price at that moment.

The `activePositionCount` tells you how many positions were already open when the rejection happened, and `rejectionNote` explains the reason for the rejection. A unique `rejectionId` is assigned to each rejection, although this may be null if an error occurred during validation. Finally, the `backtest` flag indicates whether the rejection happened during a backtest or a live trading session.

## Interface RiskContract

The RiskContract represents a signal that was blocked because it broke your risk management rules. 

It’s designed to help you understand exactly why and when your trading strategies are being prevented from executing trades.

This contract provides details like the trading pair (symbol), the signal itself (position size, prices), the name of the strategy that tried to execute it, and the timeframe it was for.

You’ll also find information about the current market price, how many other positions you have open, a unique ID for this specific rejection, and a human-readable explanation of why it was rejected. 

Finally, it tells you when the event occurred and whether it happened during a backtest or in live trading. You can use this data to monitor your risk controls, generate reports, or get notified when these rejections happen.

## Interface ProgressWalkerContract

The `ProgressWalkerContract` lets you monitor the progress of long-running background tasks within the backtest-kit framework. It provides updates during operations like strategy processing, allowing you to see how far along things are. 

Each update includes details like the name of the walker being used, the exchange involved, the frame name, the trading symbol, the total number of strategies it will process, and how many have already been handled.  You'll also get a percentage indicating the overall completion status, ranging from 0.0 (beginning) to 1.0 (finished). This is helpful for providing feedback to users or for logging progress.

## Interface ProgressBacktestContract

This contract lets you monitor the progress of a backtest as it's running. It provides details about the specific exchange, strategy, and trading symbol being used. You'll see the total number of historical data points (frames) the backtest will analyze, along with how many have already been processed. A percentage value indicates how far along the backtest is, making it easy to track its overall completion.

## Interface PerformanceStatisticsModel

This model holds performance statistics gathered from a trading strategy. It lets you see how a strategy performed overall, tracking things like the strategy's name, the total number of events recorded, and the total time it took to run. 

You can also break down the statistics by different metrics, allowing you to analyze performance in more detail. Finally, it stores all the individual performance events, giving you access to the raw data behind the aggregated statistics. This provides a complete picture of your strategy's performance history.


## Interface PerformanceContract

The PerformanceContract allows you to monitor how your trading strategies are performing. Think of it as a way to keep track of how long different parts of your strategy take to execute. 

It records key details like the time the metric was captured, the time of the previous metric, and the type of activity being measured. You’ll also find information about which strategy, exchange, and trading symbol are involved, and whether it's a backtest or live run. 

This information is incredibly valuable for spotting slow or inefficient parts of your strategy and improving its overall performance. Essentially, it's your window into the inner workings and speed of your trading system.

## Interface PartialStatisticsModel

This object holds a snapshot of your trading performance based on partial profit and loss milestones. It’s designed to give you insights into how often you're experiencing gains versus losses.

You'll find a detailed list of each profit or loss event stored in the `eventList` property. 

The `totalEvents` property simply tells you the total number of profit and loss occurrences recorded.

`totalProfit` shows the count of all profitable events, while `totalLoss` shows the count of all losing events. These two properties alone allow quick comparison of your win/loss ratio.

## Interface PartialProfitContract

This describes events related to reaching profit milestones during trading. It's used to track how a strategy is performing as it makes progress towards a take-profit target.

Think of it as a notification that a strategy has achieved a certain percentage profit, like 10%, 20%, or 30% gain.

Each notification contains a lot of information, including:

*   The trading symbol (like BTCUSDT)
*   The name of the strategy being used
*   The exchange and frame (a specific trading environment)
*   All the original details of the trade signal
*   The current price at the time of the milestone
*   The exact percentage profit level reached
*   Whether this is from a backtest or live trading
*   A timestamp indicating when the milestone was achieved.

These notifications help services like report generators and user callbacks monitor and analyze the strategy's performance. They happen each time a partial profit level is reached, but the system makes sure you don’t receive duplicate notifications for the same signal.

## Interface PartialProfitCommitNotification

This notification tells you when a partial profit has been taken during a trade. It's a signal emitted when a strategy decides to close off a portion of a position to secure some gains.

Each notification includes a lot of detailed information about the trade that triggered it. You'll find a unique ID for the notification, a timestamp of when it occurred, and whether it happened during a backtest or a live trade.

The notification specifies the symbol being traded, the strategy responsible, and the exchange used. It also provides the unique identifier of the signal itself.

You’ll receive the percentage of the position that was closed, the current market price at the time, and details about the position's entry price, take profit, and stop-loss levels – both the original and any adjusted values due to trailing.

It also gives details of the DCA entries if averaging was used, and how many partial closes have been executed so far.

Finally, you'll see a complete snapshot of the position's profit and loss (both in absolute and percentage terms), along with the entry and exit prices used for the P&L calculation, the total cost, the amount invested and timestamps related to the signal's lifecycle.

## Interface PartialProfitCommit

This describes a partial profit-taking event within a trading strategy. It essentially signals that a portion of an existing position, either a long (buy) or short (sell) trade, should be closed. 

The `action` property clearly identifies it as a partial profit action.

You'll find details about how much of the position to close (`percentToClose`), the current market price at the time (`currentPrice`), and the current unrealized profit and loss (`pnl`). 

It also includes the original entry price (`priceOpen`), the take profit and stop loss prices (both the effective, potentially trailing adjusted values and the original, pre-adjustment values), and timestamps marking when the signal was created (`scheduledAt`) and the position was activated (`pendingAt`). This information allows for a thorough understanding of the circumstances surrounding the partial profit decision.

## Interface PartialProfitAvailableNotification

This notification lets you know when a trading strategy reaches a predefined profit milestone, like 10%, 20%, or 30% gain. It's a signal that something significant has happened with a trade, whether it's running in a backtest or a live trading environment. The notification provides a wealth of information about the trade, including a unique ID, the exact time the milestone was hit, and whether it's from a simulation or a real trade.

You’ll get details about the specific trading pair involved (like BTCUSDT), the strategy that generated the signal, and the exchange used. Crucially, it includes the signal’s unique ID, the profit level reached, and the current market price at that moment. 

The notification also contains key pricing information: the original entry price, the intended take profit and stop-loss prices (both original and adjusted for trailing), and details about any dollar-cost averaging (DCA) strategies employed. You can see the overall profit or loss in both percentage and absolute terms, along with the prices used to calculate the P&L. Finally, it tells you when the signal was initially created and when the position became active.


## Interface PartialLossContract

The PartialLossContract represents events triggered when a trading strategy experiences a loss, specifically when it hits predefined loss levels like -10%, -20%, or -30%. These events are useful for tracking how a strategy is performing and monitoring potential drawdowns.

Each event provides detailed information about the loss, including the trading symbol, the name of the strategy that generated the signal, and the exchange being used.  You'll also find information related to the trading frame, the original signal data, the current price at the time of the loss, the percentage of loss (e.g., a 'level' of 20 means a -20% loss), whether the event came from a backtest or live trading, and the exact timestamp of when the loss was detected. 

The system avoids sending duplicate loss level notifications for the same signal. You can use these events to generate reports or trigger custom actions based on your strategy’s performance.

## Interface PartialLossCommitNotification

This notification is sent whenever a partial position closure happens, whether it’s during backtesting or live trading. It provides a wealth of information about the trade that was closed. 

You'll find details like a unique identifier for the notification, the exact time it occurred, and whether it’s a backtest or live trade. The notification specifies which trading pair was involved, the strategy that generated the signal, and the exchange used.

It also includes key pricing information: the entry price, the take profit and stop loss prices (both original and adjusted for trailing), and the current market price at the time of the partial closure. The direction of the trade (long or short) is clearly indicated.

Furthermore, the notification provides comprehensive performance data, including P&L (both absolute and as a percentage), the entry and exit prices used for P&L calculations, and details about the total invested capital and the number of DCA entries and partial closures. Lastly, it gives timestamps for when the signal was created, when the position became pending, and when the notification itself was created.

## Interface PartialLossCommit

This data represents a partial loss event happening within a trading strategy. It tells you that a portion of a position, determined by the `percentToClose`, is being closed. You'll find information about the current market price (`currentPrice`), how much profit or loss has been made so far (`pnl`), and the direction of the trade – whether it was a `long` (buy) or a `short` (sell). 

Crucially, it includes details about the original entry price (`priceOpen`), and the prices originally set for taking profit (`priceTakeProfit`, `originalPriceTakeProfit`) and stopping losses (`priceStopLoss`, `originalPriceStopLoss`), along with any trailing adjustments that have been applied.  The `scheduledAt` and `pendingAt` timestamps provide a timeline of when the signal was created and the position was actually triggered.


## Interface PartialLossAvailableNotification

This notification alerts you when a trading strategy has reached a predefined loss level milestone, like -10%, -20%, or -30% of its initial investment. It's a way to track how a strategy is performing and potentially adjust settings if losses are exceeding expectations.

The notification includes a unique ID, a timestamp indicating when the loss level was hit, and whether it originates from a backtest or live trading environment. You'll also find details about the trading pair, the strategy used, the exchange where the trade occurred, and the signal’s unique identifier.

Crucially, it provides the loss level reached, the current market price at the time, the original entry price, and the trade direction (long or short).  You can also access information about the take profit and stop loss prices, both original and adjusted for trailing.

Further details offer insight into the trade's construction, including the number of DCA entries, partial closes executed, and a comprehensive breakdown of the Profit and Loss (Pnl) - including unrealized PNL, percentage change, and the actual entry and exit prices used for calculation.  Timestamps track the signal's creation, pending status, and the notification’s generation, offering a complete timeline of the trade's progress.

## Interface PartialEvent

This data structure, called `PartialEvent`, collects key information whenever a profit or loss milestone is hit during a trade. Think of it as a snapshot of what happened at specific points during a trade, like reaching 10%, 20%, or 30% profit or loss.

It includes details like the exact time, whether it's a profit or loss event, the trading pair involved, and the name of the trading strategy used. You'll also find information about the signal that triggered the trade, the position size, the current market price, and the original take profit and stop loss levels.

For strategies using dollar-cost averaging (DCA), you’ll see details about the total number of entries and the original entry price before averaging. It also tracks partial closing operations, the total unrealized profit and loss at that point, and a human-readable note explaining the reason behind the signal. Finally, it will indicate if the trade is happening in backtest mode or in live trading.

## Interface MetricStats

This data structure holds a collection of statistics related to a particular performance measurement, like order execution time or message processing duration. It provides a comprehensive picture of how that measurement behaved during a backtest.

You'll find details like the total number of times a specific metric was recorded, the total time it took across all instances, and the average duration.

It also includes information about the extremes – the minimum and maximum durations – as well as statistical measures like standard deviation and percentiles (95th and 99th) to understand the distribution of the metric.

For metrics that involve waiting or delays, the structure also tracks average, minimum, and maximum wait times. Essentially, this provides a detailed statistical summary of a given performance aspect within your trading simulation.

## Interface MessageModel

This framework defines a `MessageModel` to represent individual messages within a chat history, whether it’s from a large language model or another source. Each message has a `role`, which specifies whether it’s a system instruction, a user's input, the model's response, or a tool's output. The core of the message is its `content`, the actual text being conveyed.

For some models, you might find `reasoning_content` that provides the underlying thought process. If the assistant is using tools, `tool_calls` will list the tool interactions associated with that message, and each message can also include `images` for richer communication. Finally, a `tool_call_id` identifies the specific tool call that a message is responding to.

## Interface MaxDrawdownStatisticsModel

This model helps you understand the maximum drawdown experienced during a trading period. 

It keeps track of individual drawdown events, storing them in a list ordered from most recent to oldest.  You can find the total number of drawdown events recorded within the model. The `eventList` property contains all the detailed information about each drawdown occurrence.

## Interface MaxDrawdownEvent

This object represents a single instance of a maximum drawdown event that occurred during trading. Each event tells you when a specific trading position reached its lowest point, and provides details about that moment.

You'll find information like the exact time (timestamp), the trading pair involved (symbol), which strategy made the decision, and a unique ID for the signal that triggered the trade (signalId). 

It also includes information about the position itself (long or short), the unrealized profit/loss (pnl), the price at which the drawdown occurred (currentPrice), the entry price (priceOpen), and any stop-loss or take-profit levels that were set. Finally, it indicates whether the event happened during a backtest or a live trade.


## Interface MaxDrawdownContract

This interface provides information when a new maximum drawdown is detected for a trading position. It's designed to give you the details of what happened – the symbol involved, the current price, when it occurred, and which strategy, exchange, and timeframe it relates to. You'll also receive the signal data that led to the drawdown. Importantly, it tells you whether this is from a backtest or live trading, letting you adjust your response accordingly. Tracking these drawdown events helps in managing risk and optimizing your trading strategies, as it gives you real-time insights into the largest losses experienced by a position.


## Interface LiveStatisticsModel

The `LiveStatisticsModel` gives you a detailed snapshot of how your live trading is performing. It tracks a wide range of metrics, all calculated from the events happening in your live trading sessions.

You'll find a complete record of every event – from idle periods to open, active, and closed trades – within the `eventList`.  The `totalEvents` simply tells you the total number of events observed.  More specifically, `totalClosed` shows you how many trades have been closed.

To assess profitability, the model provides `winCount` (number of winning trades), `lossCount` (number of losing trades), and a `winRate` showing your overall success rate. You can also view the `avgPnl` (average profit per trade), `totalPnl` (total cumulative profit), and a range of risk metrics.

The `stdDev` reveals the volatility of your trading, while the `sharpeRatio` and `annualizedSharpeRatio` demonstrate risk-adjusted performance. The `certaintyRatio` gives you an idea of the relationship between winning and losing trades, while `expectedYearlyReturns` estimates potential annual profits. Finally, it tracks `avgPeakPnl` which measures the highest PNL reached during trades and `avgFallPnl` which measures how much a trade's PNL fell below the initial value.

Keep in mind that many of these values are `null` if the calculations aren't possible due to unreliable data.

## Interface InfoErrorNotification

This component handles notifications about errors that occur during background tasks, but aren't critical enough to stop everything. 

It uses a specific "error.info" type to clearly identify these notifications.

Each notification has a unique identifier (`id`) so you can track and manage them. 

You'll also find a detailed error object (`error`) including the stack trace and any extra information. A straightforward human-readable message (`message`) explains the problem. 

Finally, the `backtest` property always indicates that the error originated in a live environment, not a backtest scenario.

## Interface IWalkerStrategyResult

This interface describes the result you get when testing a single trading strategy. It contains the strategy's name so you know which strategy the data refers to. You’ll also find detailed statistics about that strategy’s backtest performance, including key metrics.  A metric value is included, which is used to compare the strategy against others, and a rank shows its position relative to all the strategies tested.


## Interface IWalkerSchema

The IWalkerSchema defines how to set up and run A/B tests comparing different trading strategies. Think of it as a blueprint for your experiment.

You'll give it a unique name to identify your test, and optionally add a note to explain what the test is for.

It specifies which exchange and timeframe you want to use for all strategies involved. Crucially, you tell it which strategies you want to compare by listing their names – these strategies need to be registered separately.

You can also choose which metric, like the Sharpe Ratio, you want to optimize for during the backtest. Finally, it allows you to register callback functions to trigger specific actions at various stages of the backtest process.

## Interface IWalkerResults

This object holds all the information gathered after a complete backtest run, acting like a final report card for your strategies. It tells you exactly which asset, exchange, and walker (the specific testing process) were used to generate the results. You'll also find the name of the timeframe used for the backtest, providing a complete picture of the testing environment.

## Interface IWalkerCallbacks

The `IWalkerCallbacks` interface lets you hook into key events during the backtesting process. Think of it as a way to get notified and potentially react to what's happening as your strategies are being tested.

You'll receive a notification when each strategy begins (`onStrategyStart`), when a strategy finishes running (`onStrategyComplete`), and if any errors occur during a strategy’s backtest (`onStrategyError`). 

Finally, `onComplete` is called when all your strategies have been evaluated, providing a summary of the overall results. This interface provides control points to monitor and log progress, or even adjust the backtesting process dynamically.

## Interface ITrailingTakeCommitRow

This interface represents a single instruction queued for a trailing take commit order. Think of it as a step in the process of automatically adjusting a take profit order as the price moves favorably. 

It tells the system to execute a "trailing-take" action.

The `percentShift` property specifies the percentage change in price that triggers the take profit adjustment.  

`currentPrice` stores the price level at which the trailing initially started.

## Interface ITrailingStopCommitRow

This describes a queued action related to a trailing stop order. It represents a request to adjust a trailing stop, likely as part of a larger backtesting or trading system. 

The `action` property confirms this is specifically a trailing stop action. The `percentShift` tells you the amount (as a percentage) the trailing stop needs to be moved. Finally, `currentPrice` records the price at which the trailing stop was initially established, providing context for the shift.

## Interface IStrategyTickResultWaiting

This data structure represents a tick result specifically when a scheduled trading signal is waiting for the price to reach its activation point. It's sent repeatedly as the price fluctuates while the system is monitoring for the signal to trigger.

It differs from the initial "scheduled" result, which only occurs when the signal is first created.

Here's what's included:

*   A simple indicator confirming this is a "waiting" state.
*   The details of the signal being monitored.
*   The current price being used for the comparison.
*   Information for tracking purposes like the strategy, exchange, timeframe, and trading symbol.
*   Progress indicators for take profit and stop loss – these are always zero while waiting.
*   Unrealized profit and loss (PnL) information related to the planned trade, calculated as a theory.
*   A flag to indicate whether the data comes from a backtest or live trading.
*   A timestamp representing when the result was created.

## Interface IStrategyTickResultScheduled

This interface describes a specific event that happens in a trading strategy when a signal is generated but needs to wait for the price to reach a certain level before being executed. It’s like setting a conditional order – the strategy is saying, "I want to trade this, but only when the price hits this point."

The `action` property simply identifies this type of event as "scheduled." You'll find the details of the signal that triggered this wait in the `signal` property.

The `strategyName`, `exchangeName`, `frameName`, and `symbol` properties are all there for bookkeeping – to help you track which strategy, exchange, timeframe, and asset generated the signal.

`currentPrice` tells you what the price was when the signal was initially scheduled.  You'll also find whether it's a backtest (`backtest: true`) or a live trading situation (`backtest: false`). Lastly, `createdAt` provides a timestamp to precisely pinpoint when this scheduled event occurred.

## Interface IStrategyTickResultOpened

This object represents a notification that a new trading signal has been created. It’s sent when a signal is validated and saved. 

You'll find key details about the signal itself, including the newly assigned ID and the strategy, exchange, and timeframe associated with it. The `symbol` tells you what asset is being traded (like BTCUSDT). 

The `currentPrice` provides the price at the moment the signal was opened. The `backtest` flag indicates whether this event happened during a backtesting simulation or in a live trading environment. Finally, `createdAt` records the precise time of the signal’s creation.


## Interface IStrategyTickResultIdle

This interface describes what happens when a trading strategy isn't actively giving signals—it's in an "idle" state. 

It provides information about the context of that idle period, such as the strategy's name, the exchange being used, and the timeframe being analyzed. 

You'll also find details about the trading symbol, the current price at that moment, whether it’s a backtest or live event, and a timestamp for when the information was recorded. Essentially, it's a snapshot of the market conditions during a period of inactivity for your trading strategy.


## Interface IStrategyTickResultClosed

This interface describes what happens when a trading signal is closed, providing a complete picture of the event. 

It tells you exactly why the signal closed, whether it was due to reaching a profit target, a stop-loss, or simply expiring. You’ll also see the final price at which the trade closed, along with a detailed breakdown of the profit or loss, including any fees or slippage. 

The information includes details like the strategy name, exchange, time frame, and trading symbol used – making it easy to track and analyze specific trades. A timestamp indicates precisely when the signal was closed, and a unique ID identifies user-initiated closures. Finally, it identifies if it was from a backtest or live trading environment.

## Interface IStrategyTickResultCancelled

This interface describes a special type of result that happens when a pre-planned trading signal doesn't go through – it gets cancelled. This might be because the signal didn’t trigger or a stop-loss was hit before a trade could be opened. 

It provides all the details about why and when the cancellation occurred, including:

*   The specific signal that was cancelled.
*   The final price at the time of cancellation.
*   Timestamps for when the cancellation happened and when the result was created.
*   Information about the strategy, exchange, timeframe, and trading pair involved.
*   Whether the event occurred during a backtest or live trading.
*   A reason explaining why the signal was cancelled.
*   An optional ID if the cancellation was initiated by a user action to cancel a signal.


## Interface IStrategyTickResultActive

This data represents a situation where a trading strategy is actively monitoring a signal and awaiting either a take profit (TP), stop loss (SL), or time expiration. It contains a lot of details about the ongoing trade, including the name of the strategy and the exchange and symbol being traded.

You'll find information like the current VWAP price used for monitoring, the percentage progress toward the take profit and stop loss targets, and the unrealized profit and loss (PNL) calculations, which accounts for fees and slippage. 

It also tells you whether the trade occurred in backtest or live mode, and records timestamps for tracking purposes, including when the event happened and the last candle processed. The `percentTp` and `percentSl` properties show how close the position is to its profit or loss targets.

## Interface IStrategySchema

This defines the blueprint for how your trading strategies are registered and function within the backtest-kit framework. 

Think of it as a description of your strategy – its unique name, any helpful notes for yourself, and how frequently it should generate trading signals.

The core of the schema is the `getSignal` function. This function is what actually decides whether a trade should be made, based on the current market conditions.  It can either execute immediately or wait for a specific price level to be reached.

You can also customize your strategies further by adding lifecycle event callbacks, defining risk profiles for managing potential losses, and associating action identifiers. Essentially, this structure provides a way to organize and manage your strategies in a consistent and repeatable way.

## Interface IStrategyResult

This interface represents a single row in the comparison table you'll see when evaluating different trading strategies. It bundles together the strategy's name, a comprehensive set of backtesting statistics, and the value of the metric used to rank strategies. 

It also includes the timestamps of the first and last signals generated by the strategy, which can be useful for understanding its activity throughout the backtest period. If a strategy didn’t produce any signals, these timestamps will be null.


## Interface IStrategyPnL

This interface describes the profit and loss (PNL) results for a trading strategy. It provides a detailed breakdown of how much money was made or lost, taking into account realistic factors like trading fees and slippage.

The `pnlPercentage` tells you the profit or loss as a percentage, allowing for easy comparison across different trades. 

You’ll also find the `priceOpen` and `priceClose`, which are the entry and exit prices respectively, but adjusted for those fees and slippage to give a more accurate picture of the trade's performance.

The `pnlCost` represents the actual dollar amount of profit or loss, calculated based on your total investment. Finally, `pnlEntries` represents the total amount of money invested initially.

## Interface IStrategyCallbacks

This interface lets you hook into different lifecycle events of your trading strategy within the backtest framework. Think of it as a way to listen in on what's happening during a simulated trade. You can define functions to be executed when a signal is opened, actively monitored, goes idle, is closed, or is scheduled for later.

It also provides callbacks for specific situations like partial profits, losses, or when the signal reaches its breakeven point.  You can even get notifications for scheduled or active signals on a minute-by-minute basis for advanced monitoring or to make adjustments during the backtest. There's a function to handle writing signal data for testing and persistence. Each callback gives you access to relevant data like the symbol, signal information, current price, and whether you’re in a backtest environment.

## Interface IStrategy

This interface defines the core methods a trading strategy uses to operate. It's like the blueprint for how a strategy reacts to market ticks and executes trades.

Here’s what it offers:

*   **Tick Handling:** This method is triggered for each new price update, checking for signals, stop-loss conditions, and potential profit-taking actions.
*   **Signal Retrieval:**  It allows you to get the pending or scheduled signals for a specific symbol. Think of it as checking if a buy or sell order is waiting to be triggered.
*   **Breakeven Checks:** Determines if the price has moved enough to cover transaction costs and allow the position to reach breakeven.
*   **Strategy Status:**  Provides ways to check if the strategy is stopped or to monitor how much of the position is still open.
*   **Position Metrics:** Returns key data about the position, such as how much has been closed, cost basis, entry prices, and unrealized profit/loss.
*   **Backtesting:**  Simulates the strategy's performance using historical price data.
*   **Control Functions:**  Methods for stopping, cancelling, or forcing actions on a strategy, such as closing a position or activating a scheduled trade.
*   **Position Details:**  Retrieves details about the position's history, including partial closes, DCA entries, and performance metrics like highest profit and drawdown.
*   **Validation:** Methods to check if an action (like averaging in or moving breakeven) *could* be performed without actually executing it.



This API provides a robust set of tools for managing and understanding your trading strategies.

## Interface IStorageUtils

This interface defines the basic functions needed for any storage adapter used within the backtest-kit framework. Think of it as a contract – any storage system you want to use needs to provide these methods.

The `handleOpened`, `handleClosed`, `handleScheduled`, and `handleCancelled` methods are triggered when a strategy emits corresponding signals, allowing the storage to react to changes in the trading state.

`findById` lets you retrieve a specific signal based on its unique identifier, while `list` provides a way to access all signals currently stored.

`handleActivePing` and `handleSchedulePing` specifically deal with periodic "ping" events, ensuring that active and scheduled signals remain marked as up-to-date in the storage. These updates are critical for tracking the duration and health of positions.


## Interface IStorageSignalRowScheduled

This interface represents a signal record that has been scheduled for future execution. It indicates that the signal is awaiting a specific time or condition to be triggered. The `status` property confirms that the signal's current state is "scheduled," meaning it's not yet active but is planned for future use.

## Interface IStorageSignalRowOpened

This interface represents a signal that has been opened, essentially meaning it's active and potentially generating trading signals. It’s a simple way to track the state of a signal, confirming it's in an "opened" condition. The `status` property explicitly indicates that the signal is currently open and being used.

## Interface IStorageSignalRowClosed

This interface represents a signal that has been closed, meaning a trade related to that signal has finished. 

It includes information specific to closed signals, namely, the `status` is clearly marked as "closed" and importantly, it provides the `pnl`, which stands for Profit and Loss, detailing the financial outcome of that closed trade. Essentially, if you’re seeing this interface, it means you have data on how much money was made or lost during that particular trade.

## Interface IStorageSignalRowCancelled

This interface represents a storage signal row that has been cancelled. It’s a simple way to track when a signal’s execution has been stopped or invalidated. The only property it has is `status`, which is always set to "cancelled". Think of it as a marker to indicate a signal is no longer active or valid for further processing.

## Interface IStorageSignalRowBase

This defines the basic structure for how signal data is stored, regardless of its specific status. 

Each signal record includes a `createdAt` timestamp, marking precisely when it was generated from a strategy's analysis. 

There's also an `updatedAt` timestamp to track any subsequent modifications.

Finally, a `priority` field ensures that signals are processed in a consistent order, using the current time as a guide.

## Interface ISizingSchemaKelly

This schema defines a sizing strategy based on the Kelly Criterion. It's a way to determine how much of your capital to risk on each trade, aiming to maximize long-term growth.

The `method` property simply confirms you're using the Kelly Criterion.

The `kellyMultiplier` controls the aggressiveness of the sizing. A value of 0.25 represents a "quarter Kelly" approach, which is generally considered more conservative and less likely to wipe out your account with a few bad trades. You can increase this value to risk more per trade, potentially for higher gains but also higher risk.


## Interface ISizingSchemaFixedPercentage

This schema ensures your trades always involve a fixed percentage of your capital. 

You define this percentage with the `riskPercentage` property, which represents the maximum amount of your capital you're willing to risk on a single trade. 

The `method` property is always set to "fixed-percentage" to identify this specific sizing strategy. Essentially, it provides a simple and consistent way to manage trade sizes based on a percentage of your total available funds.

## Interface ISizingSchemaBase

This interface defines the fundamental structure for sizing strategies within the backtest-kit framework. Each sizing strategy you build will inherit from this base. 

It includes essential properties like a unique sizing name for identification, a note for developer documentation, and controls for position sizing. 

You'll find settings for the maximum percentage of your account to use for any one trade, as well as minimum and maximum absolute position sizes. Finally, it allows you to attach optional callbacks for specific lifecycle events within the sizing process.

## Interface ISizingSchemaATR

This schema defines how to size your trades using Average True Range (ATR) as a key factor. 

It's designed for strategies that want to adjust position size based on market volatility.

The `method` is always "atr-based" to indicate the sizing approach. 

`riskPercentage` determines the maximum percentage of your capital you're willing to risk on a single trade – a standard risk management practice.

`atrMultiplier` controls how far your stop-loss is placed from the entry price, using the ATR value; a higher multiplier means a wider stop.


## Interface ISizingParamsKelly

This interface defines the parameters needed to calculate position sizes using the Kelly Criterion when setting up a trading strategy. It primarily focuses on providing a way to log any relevant debugging information during the sizing process. You'll supply a logger service to help monitor and understand how your position sizes are being determined.

## Interface ISizingParamsFixedPercentage

This interface defines the parameters needed when you want to size your trades based on a fixed percentage of your capital. It's used within the backtest-kit framework to determine how much of your portfolio to allocate to each trade.  You'll provide a logger to help monitor and debug the sizing process – it’s useful for keeping track of what's happening behind the scenes. Essentially, it's a straightforward way to ensure your trade sizes are consistently proportional to your available funds.

## Interface ISizingParamsATR

This interface defines the settings you use when determining how much to trade based on the Average True Range (ATR). It's all about controlling your position size in relation to market volatility.

The `logger` property lets you connect a logging service, which is helpful for seeing what the sizing calculations are doing behind the scenes, particularly when you’re testing or debugging your strategy. It allows you to understand how the ATR impacts your trade size.

## Interface ISizingCallbacks

The `ISizingCallbacks` interface provides a way to hook into the sizing process of your trading strategy. 

You can use the `onCalculate` callback to observe and potentially validate the size that has been determined for a trade. This is helpful for debugging, tracking how your sizing logic is working, or ensuring the calculated size meets specific criteria. The callback receives the calculated quantity and parameters used in the sizing calculation, allowing you to inspect the details.

## Interface ISizingCalculateParamsKelly

This defines the information needed to calculate your trade size using the Kelly Criterion. 

To use this, you'll need to provide your win rate, expressed as a number between 0 and 1. 

You also need to specify the average ratio of your winning trades compared to your losing trades. These values help determine how much of your capital to allocate to each trade to optimize for long-term growth.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed when you're calculating your trade size based on a fixed percentage of your available capital. It's straightforward: you'll specify that you're using the "fixed-percentage" sizing method.  Crucially, you'll also provide the `priceStopLoss` value, which represents the price at which your stop-loss order will be triggered. This is a key component for managing risk and defining the boundaries of your trade.

## Interface ISizingCalculateParamsBase

This interface provides the foundational information needed for calculating trade sizes. It holds the essential data like the trading pair you’re working with (the symbol, for example, BTCUSDT), your current account balance, and the price at which you intend to enter the trade. Think of it as the starting point for figuring out how much to buy or sell. All sizing calculations build upon this basic set of parameters.

## Interface ISizingCalculateParamsATR

This section describes how to configure sizing calculations using an ATR (Average True Range) based method. When using this approach, you'll need to specify that the sizing method is "atr-based". You'll also provide a numerical value representing the current ATR, which is used in determining the size of your trades. This ATR value reflects the volatility of the asset you're trading.

## Interface ISizing

The `ISizing` interface is a core part of how backtest-kit determines how much of an asset to trade. It’s responsible for calculating the position size – essentially, how many shares or contracts you’ll buy or sell.

Think of it as the engine that translates your risk tolerance and account balance into concrete trade sizes.

The `calculate` method is the key here. It takes some input parameters describing the current market situation and your desired risk profile and then figures out the appropriate position size, returning a promise that resolves to that size.

## Interface ISignalRow

This describes the structure of a signal used within the backtest-kit trading framework. Each signal represents a trading opportunity and contains a lot of detailed information about it. Every signal gets a unique ID and a cost associated with opening the position. You'll also find details about the entry price, how long the position is expected to last, and which exchange and strategy generated it.

Signals are categorized by the trading frame and have timestamps marking when they were created and when they became active.  The signal also keeps track of partial profit or loss closures, allows for trailing stop-loss and take-profit prices, and records DCA entry history to calculate the average entry price. A record of the best and worst prices seen (peak and fall) is also maintained, along with the corresponding profit/loss percentages and costs. Finally, a timestamp indicates when the signal was initially created, useful for historical context and auditing.

## Interface ISignalDto

The ISignalDto represents a trading signal, providing all the necessary information to execute a trade. It includes an optional ID that will be automatically assigned if you don't provide one. You’ll specify the trade direction – whether you’re going long (buying) or short (selling) – along with a note to explain the reasoning behind the signal.

The data also needs entry and exit prices: a price at which the trade will be started, a target price for taking profit, and a stop-loss price to limit potential losses. 

You can set a time limit (in minutes) for the signal's duration, or choose to keep the position open until a take profit or stop loss is triggered. Finally, a cost element specifies the dollar amount related to the entry.

## Interface IScheduledSignalRow

This interface, `IScheduledSignalRow`, represents a signal that's waiting for a specific price level to be reached before it's activated. Think of it as a signal put on hold until the market moves in a certain direction.

It’s closely tied to `ISignalRow` and essentially describes a pending signal that’s waiting for the price to hit a target, `priceOpen`. Once that price is reached, the signal transforms into a regular, active signal.

A key characteristic of this type of signal is the `pendingAt` property; it initially reflects the time when the signal was scheduled but gets updated to the precise moment it starts waiting.


## Interface IScheduledSignalCancelRow

This interface represents a scheduled signal that might have been cancelled by the user. 

It builds upon the standard scheduled signal information by adding a `cancelId`. 

This `cancelId` is specifically used to identify signals that were cancelled directly by the user, providing a way to track and manage these cancellations. If a signal wasn’t cancelled by the user, this property will not be present.

## Interface IRunContext

This interface provides everything a function needs to operate within the backtest-kit framework. Think of it as a complete package of information.

It brings together details about where the code is running – like which exchange, strategy, and frame it belongs to – and runtime state, such as the symbol being analyzed and the exact time.

Essentially, it's a single container holding all the pieces needed, which are then separated and used by different parts of the backtest engine.


## Interface IRiskValidationPayload

This interface holds the information needed to assess risk during the backtesting process. 

It combines the arguments provided to the risk validation function with details about the current portfolio state. 

Specifically, you'll find the `currentSignal` – the signal the system is currently evaluating – along with the total number of open positions (`activePositionCount`) and a list of those active positions (`activePositions`). This data lets your risk checks react to the specifics of the current trading scenario.

## Interface IRiskValidationFn

This interface defines what a trading strategy looks like within the framework. Essentially, it’s a blueprint for how your trading logic will operate. Any strategy you create must provide an `execute` method. This method is the heart of your strategy; it’s called repeatedly as new market data becomes available, allowing your strategy to analyze the situation and make decisions about what to do.


## Interface IRiskValidation

This interface helps you set up checks to ensure your risk parameters are behaving as expected. 

Think of it as defining rules and explanations for how you want to validate things.

You provide a `validate` function – this is the core logic that does the actual checking.

Alongside that, you can add a `note` – a simple explanation describing what this particular validation is intended to do, which makes it easier to understand later on.

## Interface IRiskSignalRow

This interface, `IRiskSignalRow`, provides key pricing information used for managing risk during trading. It builds upon the existing `ISignalDto` to incorporate the entry price (`priceOpen`), the initially set stop-loss price (`originalPriceStopLoss`), and the original take-profit price (`originalPriceTakeProfit`).  Essentially, it's a container for essential price data needed for risk validation processes, allowing you to access the original intended risk parameters for a trade. This helps ensure that risk management strategies accurately reflect the initial trade setup.

## Interface IRiskSchema

This defines a way to create custom risk controls for your trading strategies. Think of it as setting up rules to keep your portfolio safe. 

You give each risk control a unique name and can add a note to explain what it does.

You can also specify optional callbacks that let you react to specific events related to the risk control, like when a trade is rejected or allowed. 

The core of this is a list of validations – these are the custom functions or configurations that actually enforce your risk rules.

## Interface IRiskRejectionResult

This describes the result you get when a risk validation check fails. It's like a little report explaining why something wasn't approved. Each rejection has a unique ID, so you can track it if needed. More importantly, it includes a note – a clear explanation in plain language – of why the validation failed, which helps in understanding and correcting the issue.

## Interface IRiskParams

This interface, `IRiskParams`, defines the essential settings used when setting up the risk management system. It's all about controlling how the system behaves, whether it's running a test or live trading. 

You'll provide the name of the exchange you're connecting to, like "binance".  A logger is also included to help you see what's happening and debug any issues.

The `backtest` flag tells the system whether it’s a simulation or a real-time trading scenario.  Finally, there's a special callback, `onRejected`, which gets triggered when a trade is blocked because it violates defined risk rules – giving you a chance to react and potentially report this event.

## Interface IRiskCheckArgs

This interface, `IRiskCheckArgs`, bundles all the necessary data needed to perform a risk check before a trading signal is executed. Think of it as a package of information passed to your risk management logic. It contains details about the trading symbol, the signal itself, the strategy initiating the trade, and the environment it's operating in – like the exchange, risk name, frame, current price, and a timestamp. This allows you to validate if it's safe to proceed with the trade based on conditions you define.


## Interface IRiskCallbacks

This interface defines optional functions that can be used to respond to risk-related events during trading. Specifically, it allows you to specify what should happen when a trading signal is blocked because it violates risk limits – that's the `onRejected` callback. It also provides a way to react when a signal successfully passes all your risk checks, using the `onAllowed` callback. Both callbacks receive information about the symbol involved and details of the risk check that triggered the event.

## Interface IRiskActivePosition

This interface represents a single trading position that's being actively monitored for risk assessment across different trading strategies. It holds all the key details about a position, like the name of the strategy that created it, the exchange it's on, and the specific trading pair involved (e.g., BTCUSDT). 

You’ll find information like whether the position is a long or short trade, the entry price, and any stop-loss or take-profit levels that were set. 

It also includes an estimated duration and a timestamp indicating when the position was initially opened, useful for tracking its lifecycle. This structured data allows for comprehensive risk analysis and comparison across various trading approaches.

## Interface IRisk

This interface, `IRisk`, helps manage and monitor the risk associated with your trading strategies. It allows you to ensure that new signals align with predefined risk parameters before they are executed. 

Think of it as a gatekeeper for your trades, checking if a potential signal is safe to proceed with. 

You can also use it to keep track of open positions, registering when a signal is entered and then removing it when it’s closed. This tracking provides a detailed view of your strategy's risk exposure over time. 

The `checkSignal` method is the primary tool for evaluating potential trades against your risk rules. 

The `addSignal` method records new positions, while `removeSignal` cleans up the record when a position is closed.


## Interface IReportTarget

This interface lets you fine-tune what data gets logged during your trading tests. Think of it as a way to control the level of detail in your reports.

Each property, like `strategy` or `risk`, acts like a switch.

Turning a property to `true` means that specific type of event – like strategy commits or risk rejections – will be recorded.

Conversely, setting a property to `false` silences that particular event log.

This gives you precise control over the information captured, helping you focus on the areas most relevant to your analysis. You can enable logging for things like performance metrics, scheduled signals, or even the highest profit and maximum drawdown milestones your strategy reaches.

## Interface IReportDumpOptions

This interface lets you specify exactly what data you want to include when exporting reports from your backtesting runs. Think of it as a way to customize your report to focus on specific strategies, exchanges, or even individual trading signals. You can use these options to filter the report data, perhaps to analyze a particular trading pair like BTCUSDT or examine the performance of a specific strategy. It's also useful for tracking experiments with different optimization configurations identified by a 'walker name'.

## Interface IPublicSignalRow

This interface, `IPublicSignalRow`, helps you understand a trading signal's details, especially its original stop-loss and take-profit levels. It builds upon the existing `ISignalRow` to provide extra information for external use, like displaying data to users.

You’ll find the original stop-loss and take-profit prices here – these are the values initially set when the signal was created. They don’t change even if the stop-loss or take-profit is adjusted later (like with trailing stops).

Alongside these original prices, you also get information about how the position has been managed: the initial cost, how much has been partially closed, the total number of entries (for averaging), and the total number of partial closes. It includes the original entry price, which is the same as the initial entry price recorded in the signal itself. Finally, you can see the unrealized profit and loss (PNL) calculated at the time the public signal was created.


## Interface IPublicCandleData

This interface describes the data structure for a single candlestick, which is a common way to represent price movements over time in financial markets. Each candlestick contains information about when it began (`timestamp`), its opening price (`open`), the highest price reached (`high`), the lowest price seen (`low`), its closing price (`close`), and the total trading volume (`volume`) during that time.  Essentially, it's a snapshot of market activity for a specific period.

## Interface IPositionSizeKellyParams

When calculating position sizes using the Kelly Criterion, you'll use these parameters to define your expectations. The `winRate` represents the probability of a successful trade, expressed as a number between 0 and 1.  `winLossRatio` describes the average profit you expect from a winning trade compared to the average loss from a losing trade – for example, a ratio of 2 means you win twice as much as you lose. These values help determine how much of your capital to allocate to each trade.


## Interface IPositionSizeFixedPercentageParams

This interface defines the settings you'll use when your trading strategy uses a fixed percentage to determine position size, and you want to include a stop-loss price. Essentially, `priceStopLoss` tells the backtest framework at what price you want to place your stop-loss order to limit potential losses.  It’s a simple number representing the price level.

## Interface IPositionSizeATRParams

This interface defines the parameters needed to calculate position size using Average True Range (ATR). It’s all about specifying how much volatility you're considering when determining how much capital to allocate to a trade.  Specifically, you’ll need to provide the current ATR value. Think of this as a measure of the market's recent price fluctuations – the higher the ATR, the more erratic the price movement has been.

## Interface IPositionOverlapLadder

This interface lets you define a zone around each dollar-cost averaging (DCA) level to detect overlaps. Think of it as setting a buffer.

The `upperPercent` property determines how much above each DCA level is considered an overlap – for example, if you set it to 5%, anything 5% higher than a DCA level will be flagged. 

Similarly, `lowerPercent` defines how much below each DCA level is considered an overlap. A value of 5% here means anything 5% lower than a DCA level will also be flagged. 

Essentially, these percentages help you customize the sensitivity of overlap detection in your trading strategies.


## Interface IPersistBase

This interface outlines the fundamental operations needed for any custom storage system used within the backtest-kit framework. Think of it as the blueprint for how your storage interacts – it ensures the system can read, write, and keep track of data. 

It defines five essential methods: `waitForInit` initializes and verifies the storage location, `readValue` retrieves data, `hasValue` checks if data exists, `writeValue` saves data securely, and `keys` provides a way to list all stored data identifiers. Implementing this interface allows you to connect backtest-kit to various data stores like files, databases, or even in-memory solutions. The `keys` method provides a sorted list of identifiers, useful for managing and verifying the integrity of the stored data. 






## Interface IPartialProfitCommitRow

This object represents a specific instruction to take a partial profit on a trade. 

Think of it as a single step in a plan to gradually close out a position.

It tells the system to close a certain percentage of the current holdings. 

The `action` property always indicates this is a "partial-profit" action. The `percentToClose` field specifies what portion of the position should be closed, while `currentPrice` records the price at which this partial profit was achieved.

## Interface IPartialLossCommitRow

This represents a request to partially close a trading position. 

Think of it as a message saying, "I want to sell a portion of my holdings."

It specifies that the action being taken is a "partial-loss."

You’ll also define how much of the position should be closed, expressed as a percentage. 

Finally, it records the price at which that partial sale actually occurred, allowing for verification and analysis.

## Interface IPartialData

This data structure represents a snapshot of key information about a trading signal, designed to be easily saved and restored. Think of it as a simplified version of the full signal state, focusing on the profit and loss levels that have been hit. Because some data types aren’t easily saved, sets of levels are converted into arrays for storage. This allows the system to remember where a trade has progressed, even after restarting or reloading. 

It's stored in a way that links each signal to its corresponding partial data.


## Interface IPartial

The `IPartial` interface manages how trading signals track their profit or loss. It’s used internally by components like `ClientPartial` and `PartialConnectionService`.

When a signal is generating profit, the `profit` method calculates if key milestones like 10%, 20%, or 30% profit have been reached, and if so, it sends out notifications. Similarly, the `loss` method does the same for loss levels.

Finally, when a signal finishes – whether it hits a target profit, a stop-loss, or its time limit – the `clear` method is used to remove all related tracking information and clean up resources.

## Interface IParseArgsResult

The `IParseArgsResult` interface holds the outcome of parsing command-line arguments. It essentially combines your initial input parameters with extra flags that determine the trading environment. This includes whether the system should run in backtest mode, simulating past market conditions, paper trading mode, which uses live data but virtual funds, or live trading mode, where actual trades occur with real money. Think of it as a container for confirming how the trading system should operate.

## Interface IParseArgsParams

This interface, `IParseArgsParams`, is how you define the starting points for running a backtest. It's essentially a blueprint for what information the backtest needs to know right from the beginning. Think of it as setting up the basics – what trading pair are we looking at (like "BTCUSDT")? Which strategy will we be testing? Which exchange are we using, and what timeframe should we be analyzing the data in (like a 15-minute interval)? It's a neat way to standardize how you provide these essential details to the backtesting system.



You'll specify these properties – `symbol`, `strategyName`, `exchangeName`, and `frameName` – to tell the system exactly what it needs to run your backtest.

## Interface IOrderBookData

This interface defines the structure of order book data, which represents the bids and asks for a specific trading pair.  Each order book contains a `symbol` identifying the trading pair, like "BTCUSDT".  The `bids` property holds an array of `IBidData` objects, detailing the buy orders currently present, while the `asks` property similarly stores an array of `IBidData` objects representing the sell orders. Think of it as a snapshot of what buyers and sellers are offering at a given moment.


## Interface INotificationUtils

This interface, `INotificationUtils`, serves as the foundation for how your backtest-kit framework communicates important events and information. Think of it as the central point for notifications related to trading strategies. 

If you're building a custom notification system – for example, sending alerts to a messaging service or logging events – you’ll need to implement this interface.

The `handleSignal` method lets you react to fundamental trading actions like opening, closing, or scheduling positions. Other specific methods like `handlePartialProfit`, `handlePartialLoss`, and `handleBreakeven` give you dedicated hooks for those profit-taking and loss-limiting scenarios. `handleStrategyCommit` is a more general event for strategy-related configurations.  `handleSync` deals with actions like opening or closing signals. 

You’ll also find methods for dealing with different error conditions: `handleRisk` for rejected risk parameters, and `handleError`, `handleCriticalError`, and `handleValidationError` for various error scenarios.  Finally, `getData` lets you retrieve all stored notifications, while `dispose` clears them out when you’re done.

## Interface IMethodContext

The `IMethodContext` interface acts as a little package of information that's passed around within the backtest-kit framework. Think of it as a set of breadcrumbs, guiding the system to the right components it needs. 

It holds the names of three critical schemas: the exchange, the strategy, and the frame. 

These names tell the system *exactly* which versions of those components to use when performing an operation. The frame name is left blank when running in live mode. Essentially, this interface provides implicit context allowing for easier access to the specific strategy, exchange and frame instances you're working with.


## Interface IMemoryInstance

The `IMemoryInstance` interface outlines how different memory storage systems—whether they’re temporary, saved to a file, or just for testing—should behave. 

It provides a set of common functions for interacting with memory.

You can use `waitForInit` to make sure the memory is ready to use.

The `writeMemory` function lets you store new information, associating it with a unique ID and a brief description.

If you need to find something specific, `searchMemory` allows you to perform full-text searches to rank the results by relevance.

`listMemory` gives you a way to see everything that's currently stored.

To remove something, you'd use `removeMemory`, specifying the ID of the entry to delete.

If you just want to retrieve a specific piece of information, `readMemory` retrieves it by its ID.

Finally, `dispose` provides a way to release any resources held by the memory instance when it's no longer needed.

## Interface IMarkdownTarget

This interface lets you choose which detailed reports to generate during your trading backtests. Think of it as controlling the level of granularity in your analysis.

You can turn on reports to track things like when your strategy sends buy or sell signals, when signals are blocked by risk management, or when stop-loss orders adjust. 

There are also options for reporting on portfolio performance, comparing strategies, identifying bottlenecks, and tracking signals that are waiting to be triggered.

You can enable reports that focus on live trading data, detailed backtest results with a full trade history, and milestones like achieving the highest profit or experiencing maximum drawdown. Finally, you can control reports about how signals are managed. 


## Interface IMarkdownDumpOptions

This interface defines the settings you can use to generate markdown reports. Think of it as a way to specify exactly which data you want to see in your reports, like focusing on a specific trading pair or timeframe.  It includes details such as the directory where the report should be saved, the name of the file, and the trading symbol being analyzed. You can also filter the reports by strategy name, the exchange used, and even the specific timeframe (like 1-minute or 1-hour). Finally, it allows you to target reports based on a unique identifier for each trading signal.

## Interface ILogger

The `ILogger` interface defines how different parts of the backtest-kit framework communicate about what’s happening. It's a central way to record events and information, helping you understand and fix problems.

You can use it to write down general messages about important events, or more specific details for debugging purposes. It also allows for recording informational messages that give a high-level view of what's going on, as well as warnings that highlight potential issues.

The `log` method is for regular updates, `debug` for detailed insights during development, `info` for confirming normal operations, and `warn` for highlighting things that might need attention. This logging system is used across many areas of the framework, like agents, sessions, and data storage.

## Interface ILogEntry

This interface defines what a single entry in the trading framework's log looks like. Each log entry has a unique identifier and a level, ranging from general logs to warnings. 

It also includes timestamps to help with log management and sorting, reflecting when the event occurred. 

To help understand the context of each log, it can contain extra information about where the log came from, like the specific method or the broader execution environment.  Finally, you can pass along additional arguments alongside the log message itself.

## Interface ILog

The `ILog` interface provides a way to keep track of what's happening during your trading backtests and analyses. It's like having a detailed record of events.

You can retrieve a complete list of all the log entries that have been recorded using the `getList` method. This is useful for debugging, reviewing performance, or auditing your strategies.

## Interface IHeatmapRow

This interface represents a single row in a heatmap, summarizing the trading performance for a specific trading pair like BTCUSDT. It bundles together key statistics calculated across all strategies used for that symbol.

You'll find information like the total profit or loss percentage, how well the strategy managed risk (Sharpe Ratio), and the largest drawdown experienced. 

It also breaks down trade-level data: total trade count, win/loss counts, win rate, average profit and loss per trade, and volatility (standard deviation). 

Further details include profitability metrics like profit factor, average win/loss amounts, streaks of wins/losses, and expectancy – all contributing to a complete picture of the symbol's trading behavior. Finally, it highlights average peak and fall PNL percentages offering additional insights into trade performance.

## Interface IFrameSchema

The `IFrameSchema` helps you define specific periods and frequencies for your backtesting simulations. Think of it as a blueprint for creating a distinct "frame" of data within your backtest. Each frame has a unique name to identify it, along with an optional note for your own reference.

It dictates how timestamps are generated, defining the interval (like daily, weekly, or hourly). You also specify the start and end dates for the data covered within this frame, establishing the boundaries of the backtest period.

Finally, you can include optional callbacks to handle specific events within the frame’s lifecycle.


## Interface IFrameParams

The `IFramesParams` object is used when you're setting up the core structure of your backtesting environment. Think of it as a container for essential configuration details.

It includes a logger, which is super useful for keeping track of what’s happening behind the scenes during your backtests—essentially, it’s your way to see debugging information. 


## Interface IFrameCallbacks

The `IFrameCallbacks` interface lets you hook into key moments in how your timeframe data is being built. Specifically, the `onTimeframe` function gets called right after the timeframe array is generated. This is your chance to peek at the resulting timeframes, perhaps to log them for review or ensure they are what you expect based on your start and end dates and the chosen timeframe interval. It’s a handy spot to add some extra checks and quality control to your backtesting process.

## Interface IFrame

The `IFrames` interface helps manage how data is organized for backtesting. It’s responsible for creating the sequence of time periods – essentially a list of dates – that your backtest will run through.

The `getTimeframe` function is the core of this. It takes a trading symbol and a frame name (like "1h" for one-hour intervals) and returns an array of dates that represent those time periods. Think of it as building the timeline for your trading simulation. This timeline dictates when your strategy will be tested.

The `IStrategy` interface defines the blueprint for your trading strategies. The `next` method is where you put the core logic: it receives a frame of data and any extra information, and then tells the system whether to execute a trade and what that trade should be.  `onNewData` gives your strategy a chance to react to incoming data *before* making a decision about a trade.

## Interface IExecutionContext

The `IExecutionContext` object is like a little package of information that's passed around during trading activity. It holds details relevant to what's happening at a particular moment, such as the trading pair involved, like "BTCUSDT", and the precise date and time.  Most importantly, it tells the system whether it's running a test against historical data (backtest mode) or operating in a live trading environment. This context is automatically provided to functions like those used to retrieve historical data, process trades, or run simulations.


## Interface IExchangeSchema

This interface describes how a data source for a cryptocurrency exchange is structured within the backtest-kit framework. Think of it as a blueprint for connecting to an exchange's API or database and providing the necessary trading data.

Each exchange schema needs a unique identifier, `exchangeName`, for registration. You can also add a `note` for internal documentation.

The core of the schema lies in `getCandles`, which defines how to retrieve historical price data (candles) for a specific trading pair and timeframe.  It also includes methods to `formatQuantity` and `formatPrice` to ensure proper precision based on the exchange’s rules – if you don't specify these, it defaults to Bitcoin’s precision.

Beyond candles, you can optionally provide functions to get the order book (`getOrderBook`) and aggregated trades (`getAggregatedTrades`). If these are missing, the framework will notify you. Finally, `callbacks` allow you to register functions that are triggered during various events, like when new candle data arrives.

## Interface IExchangeParams

This interface, `IExchangeParams`, defines the necessary configuration when setting up a connection to an exchange within the backtest-kit framework. It essentially acts as a blueprint for how the framework interacts with the exchange's data.

You'll need to provide a logger to help track debugging information and an execution context which includes details like the trading symbol, timestamp and whether the test is a backtest.

Crucially, you must implement functions to retrieve historical data: candles (price and volume data), order books, and aggregated trades, as well as functions to properly format quantities and prices to align with the specific exchange's requirements. These functions are essential for accurate backtesting and trading simulations. Default implementations are available if you want to use them, but overriding them allows for precise customization.

## Interface IExchangeCallbacks

The `IExchangeCallbacks` interface lets you set up functions that get called when the backtest kit receives candlestick data from an exchange. Think of it as a way to react to new price information as it arrives. Specifically, the `onCandleData` property lets you define a function that runs whenever a batch of candles is retrieved, providing details like the symbol, time interval, the starting date of the data, how many candles to fetch, and the actual candle data itself. This is useful for monitoring incoming data or performing real-time analysis during a backtest.

## Interface IExchange

The `IExchange` interface is the core of how backtest-kit interacts with trading venues. It provides the necessary tools to retrieve historical and future price data, format order quantities and prices, and calculate key indicators. 

You can use this interface to pull historical candle data (past prices and volumes) or simulate future candles during a backtest. It also handles the tricky process of formatting order sizes and prices to match the specific rules of the exchange you're using. 

Need to know the current average price?  The interface provides a way to calculate that using recent trade data. You can also retrieve the order book to see current buy and sell orders, or aggregated trade information.

The `getRawCandles` function gives you the most flexibility to grab candle data, allowing you to specify date ranges or limits for your historical data, always ensuring that you’re not looking into the future and skewing your results. All these methods are designed to prevent "look-ahead bias," ensuring a fair and accurate backtest.

## Interface IEntity

This interface defines the core engine used for backtesting your trading strategies. It lays out the essential functions needed to run a backtest, such as initializing the environment, executing trades based on strategy signals, and providing access to historical data. Implementing this interface lets you create custom backtesting environments with specific rules and data sources.
---
title: docs/interface/IBar
group: docs
---

# IBar

Interface representing a single bar of data (e.g., candlestick).


## Interface IDumpInstance

The `IDumpInstance` interface defines how components save data during a backtest or simulation. Think of it as a standardized way to record important information about what's happening. 

Each instance is tied to a specific signal and bucket, meaning it's focused on a particular area of the process. When you need to save something – a series of messages, a simple record, a table of data, a raw text string, an error message, or even a complex JSON object – you use one of the provided methods like `dumpAgentAnswer`, `dumpRecord`, or `dumpTable`.  Each method takes the data itself, a unique identifier (`dumpId`), and a brief description to help you understand what you're saving.

Finally, the `dispose` method provides a way to clean up any resources used by the dumping instance when it's no longer needed.

## Interface IDumpContext

The `IDumpContext` helps track where your trading data came from. 

Think of it as a way to tag and organize your dumps. It includes the `signalId`, which identifies the specific trade the data relates to, and the `bucketName`, which categorizes the dumps, often by the strategy or agent that generated them.  Each dump also gets a unique `dumpId` for easy reference.  Finally, the `description` provides a human-readable explanation of what's in the dump, allowing for easy searching and understanding.

## Interface ICommitRowBase

This interface, `ICommitRowBase`, provides a foundation for handling events related to commits, particularly when you need to delay those commits until the environment is ready. It’s designed to make sure things happen in the right order.

Each commit event includes information about the trading symbol, like 'BTC-USDT', and a flag to indicate whether the process is running in backtest mode, which is useful for testing and simulations. Think of it as a basic building block for more complex commit operations.

## Interface ICheckCandlesParams

This interface defines the settings you'll use to check the timestamps of your cached candle data. It's designed to help you ensure your data is consistent and accurate.

You’ll specify the trading symbol, the exchange you're working with, and the timeframe (like 1-minute or 4-hour candles).

The `from` and `to` dates tell the system which period to examine. Finally, you can set the `baseDir` which tells the system where to find the cached candle files; if you don't set it, it defaults to a standard location. 

Essentially, it's your blueprint for verifying your historical candle data.


## Interface ICandleData

The `ICandleData` interface represents a single candlestick, a common way to visualize and analyze price movements in financial markets. It holds key information about a specific time interval, including when the candle began (`timestamp`), the price when it opened (`open`), the highest and lowest prices reached (`high`, `low`), the price when it closed (`close`), and the total trading volume during that period (`volume`). This data is crucial for things like calculating Volume Weighted Average Price (VWAP) and for running backtests to evaluate trading strategies.


## Interface ICacheCandlesParams

This interface defines the information needed to pre-load historical candle data. Think of it as a blueprint for requesting a chunk of historical price data. You'll specify the trading pair, the exchange providing the data, the time interval for the candles (like 1-minute or 4-hour candles), and the start and end dates for the data you want to retrieve. Pre-caching this data is useful for speeding up backtests, avoiding delays during the test itself.

## Interface IBroker

The `IBroker` interface defines how the backtest-kit framework interacts with a live trading broker. Think of it as the bridge between the simulation and the real market.

It’s designed to ensure that if something goes wrong during order execution – like a connection problem – the internal state of the backtest remains consistent and unaffected.

This interface contains methods that are called before any changes are made to the trading system’s state, such as opening or closing positions.

During backtesting, these calls are ignored, so the adapter isn't actually used.

The `waitForInit` method is called initially to establish the connection to the broker and load any necessary credentials.

The `onSignalCloseCommit`, `onSignalOpenCommit`, `onPartialProfitCommit`, `onPartialLossCommit`, `onTrailingStopCommit`, `onTrailingTakeCommit`, `onBreakevenCommit`, and `onAverageBuyCommit` methods are all invoked when specific trading actions are triggered, like taking profits, placing stop-loss orders, or executing average-buy strategies. Each method delivers specific information related to the action being performed.


## Interface IBreakevenData

This interface, `IBreakevenData`, holds the information needed to save and load breakeven status. It’s designed to be easily stored and retrieved, especially when dealing with persistence like saving data to a file or database.  Think of it as a simplified snapshot of the breakeven state. 

It contains just one piece of information: `reached`. This boolean value indicates whether the breakeven point has been achieved for a particular signal. It’s essentially a condensed version of a more complex breakeven state and gets converted back to a full state when loaded.  The framework uses this to efficiently keep track of breakeven progress.

## Interface IBreakevenCommitRow

This object represents a commitment related to breakeven calculations during a backtest. It's essentially a record of an action taken – specifically, a breakeven adjustment.  The `currentPrice` property tells you the price level that was in effect when this breakeven commitment was created. Think of it as the price used to determine the break-even point.

## Interface IBreakeven

The `IBreakeven` interface manages tracking when a trade's stop-loss should be moved to the original entry price, essentially achieving a breakeven point. This feature helps ensure trades aren’t losing money due to minor price fluctuations or transaction costs.

It works by periodically checking if the price has moved sufficiently to cover these costs, and if it has, it triggers an event.

The `check` method is used to perform these checks during the monitoring of a trade signal, verifying that the breakeven hasn't already been triggered and that the price has moved favorably. If the conditions are met, the breakeven is marked, an event is sent, and the state is saved.

The `clear` method resets the breakeven state when a trade is closed, whether by hitting a target profit, a stop-loss, or due to time expiration. This ensures that breakeven tracking is cleanly handled for each individual trade.

## Interface IBidData

The `IBidData` interface describes a single bid or ask price point found within an order book. It’s essentially a snapshot of one level of the book, telling you both the price and how many shares or contracts are being offered at that price.  You’ll find the price represented as a string, and the quantity available at that price is also a string. This data allows you to understand the depth and potential direction of market movements.

## Interface IAverageBuyCommitRow

This interface represents a single step in a DCA (Dollar-Cost Averaging) strategy. It details a specific buy order within a series of buys designed to average out the purchase price of an asset. Each `IAverageBuyCommitRow` object tells you the cost of that individual buy, the price at which it was executed, and how many total DCA entries have been made up to that point. Essentially, it's a record of one piece of a larger strategy of buying over time.

## Interface IAggregatedTradeData

This data structure holds information about a single trade that happened. Think of it as a record of one transaction.

It provides key details such as the price at which the trade occurred and how much was traded.  You'll also find the exact time of the trade, recorded as a timestamp.

Crucially, it tells you whether the buyer or seller was the one initiating the trade – this is useful for understanding trade direction and market dynamics. Each trade has a unique ID for easy tracking and reference.

## Interface IActivateScheduledCommitRow

This interface represents a queued action to activate a scheduled commit within the backtest-kit framework. Think of it as a message indicating that a pre-defined commitment needs to be put into action. 

The `action` property always specifies that this is an activation of a scheduled commitment.  You'll also find a `signalId` which uniquely identifies the signal associated with this activation. Finally, there's an optional `activateId`, useful when the activation is triggered directly by a user or specific process rather than automatic scheduling.

## Interface IActionSchema

The `IActionSchema` lets you extend your trading strategy with custom actions – think of them as hooks that trigger specific behaviors based on events happening during a trade. 

You can use these actions to manage state for tools like Redux or MobX, log important events, send out-of-the-box notifications to channels like Discord or email, track key metrics, or even build custom logic to react to market changes.

Each time your strategy runs, a fresh action instance is created, ensuring it has all the necessary data for the current moment. It’s possible to attach multiple actions to a strategy, allowing for layered functionality.

The `actionName` provides a unique identifier for each custom action. 

The `note` property is a place for developers to add documentation.

The `handler` defines the code that runs when the action is triggered, essentially defining what the action *does*. 

Finally, `callbacks` allows you to fine-tune the action’s lifecycle, reacting to events at specific points in its execution.


## Interface IActionParams

This interface defines the information available to an action within the backtest-kit framework. It bundles together essential details like a logger for tracking what's happening, the names of the strategy and timeframe the action belongs to, and information about the environment it's running in. You'll find details on the exchange being used, and a flag to indicate whether the action is part of a backtesting simulation. Essentially, it's a package of context that allows actions to function properly and be monitored effectively.

## Interface IActionCallbacks

This interface, `IActionCallbacks`, provides a set of hooks you can use to customize the behavior of your trading action handlers. Think of them as lifecycle events and notifications that allow you to react to different stages of a strategy's execution. 

You can use the `onInit` callback to perform setup tasks like connecting to databases or initializing external services when a handler starts. Conversely, `onDispose` lets you clean up resources when the handler is finished, such as closing connections or saving data.

The `onSignal` family of callbacks – including `onSignalLive` and `onSignalBacktest` – are triggered whenever a signal is generated, allowing you to log events, monitor performance, or integrate with other systems. Separate callbacks exist for live and backtest modes, allowing tailored behavior.

Beyond signals, you'll find callbacks like `onBreakevenAvailable`, `onPartialProfitAvailable`, and `onPartialLossAvailable` that notify you when specific profit or loss targets are reached.  `onPingScheduled` and `onPingActive` let you respond to monitoring events while a signal is waiting or active. 

Finally, `onRiskRejection` alerts you when a signal is blocked by risk management, and `onSignalSync` lets you intercept and potentially modify actions taken by the framework, like opening or closing positions using limit orders. Remember that errors in `onSignalSync` are passed up, so handle them carefully.

## Interface IAction

This interface, `IAction`, is your central point for connecting your own custom logic to the trading framework. Think of it as a way to "tap into" the framework's events and react to them in your own unique way.

It provides several methods, each corresponding to a different type of event that the framework generates. These events can range from basic signal updates (whether in live or backtest mode) to notifications about breakeven points, partial profits or losses, scheduled pings, or even risk rejections.  You can use this to build things like logging systems, real-time dashboards, or even integrate with your existing Redux or Zustand state management.

The `signal` method is the most general, handling all signal events.  If you only need live or backtest signals specifically, `signalLive` and `signalBacktest` provide targeted handling. Other methods like `breakevenAvailable`, `partialProfitAvailable`, and `partialLossAvailable` offer fine-grained reactions to specific profit and loss milestones. `pingScheduled` and `pingActive` deal with scheduled monitoring events. If a trade is rejected due to risk, the `riskRejection` method will be triggered.

The `signalSync` method gives you a chance to influence the framework's attempts to open or close positions using limit orders, and `dispose` is essential for cleaning up when your logic is no longer needed, ensuring you release resources properly. Essentially, `IAction` offers a flexible hook to customize how the trading framework interacts with your applications.

## Interface HighestProfitStatisticsModel

This model helps you keep track of the moments when your trading strategy achieved the highest profit. It provides a list of individual events that contributed to these peaks, ordered from most recent to oldest. You can also see the total number of times your strategy has reached a highest profit level. Think of it as a record of your best performance highlights.

## Interface HighestProfitEvent

This event represents the moment when a trading position achieved its highest profit. It captures key details like the exact time (timestamp) and the symbol being traded. You'll find the name of the strategy used, a unique identifier for the signal that triggered the trade, and whether the position was a long or short. 

The event also records the unrealized profit and loss (pnl) at that peak, as well as the prices at which the position was opened, and the take profit and stop loss levels. Finally, a flag indicates if this record occurred during a backtesting simulation.

## Interface HighestProfitContract

The HighestProfitContract provides information when a trading strategy reaches a new peak profit level. It bundles details about the trade, including the symbol being traded, the current price, and when the event occurred. You'll also find context like the strategy's name, the exchange used, and the timeframe of the data.  The signal data associated with the trade is also included, and a flag specifies whether this profit milestone happened during a backtest or live trading. This contract allows you to react to significant profit milestones—perhaps to set a trailing stop or take partial profits—and adjust your strategy’s behavior accordingly.

## Interface HeatmapStatisticsModel

This structure organizes key statistics about your entire portfolio, presenting a consolidated view of how your investments are performing. It includes an array of individual symbol statistics, allowing you to drill down into specific assets if needed. 

You'll also find summary figures for the whole portfolio, such as total profit and loss (PNL), Sharpe Ratio (a measure of risk-adjusted return), and total number of trades executed. To get a broader picture, there are also averages representing peak and fall PNL, weighted by the number of trades for each symbol.

## Interface DoneContract

This interface defines the information you receive when a background task, like a backtest or live execution, finishes. It provides details about what just completed, such as the exchange used, the name of the trading strategy, and whether it was a backtest or a live trade. You’ll find the trading symbol, like BTCUSDT, along with an identifier for the frame used. This lets you track and understand the results of your automated trading processes.


## Interface CriticalErrorNotification

This notification signals a critical error within the trading system, demanding immediate attention and likely requiring the process to be stopped. It's designed to help you understand and respond to severe problems.

Each critical error notification carries a unique identifier (`id`) to track it specifically. You'll also get a straightforward explanation of what went wrong in the `message` field.

The `error` property provides detailed information about the error, including a stack trace and other relevant data—essentially all the information needed to diagnose the problem. Finally, the `backtest` flag is always false because these errors originate from live trading environments, not simulations.

## Interface ColumnModel

This describes how to define columns for tables generated by the backtest-kit framework. Each column is described by a few key properties, ensuring your data is presented clearly. 

You'll need to provide a unique `key` to identify each column.  A `label` is used for the column header that users will see.

The `format` property is a function that takes the data for a particular row and transforms it into a user-friendly string – think of it as customizing how each data point is displayed. Finally, `isVisible` allows you to dynamically control whether a column is shown based on certain conditions.

## Interface ClosePendingCommitNotification

This notification tells you when a pending signal has been closed before a trade actually starts. It's important for understanding situations where signals are canceled or adjusted before activation.

The notification includes a unique ID, a timestamp indicating when the closure happened, and whether it occurred during a backtest or live trading. You'll also find details about the trading pair involved, the strategy that generated the signal, and the exchange used.

It provides key information about the signal itself, like its unique identifier and the reason for the closure. You can see how many entries were involved in the signal, and importantly, details about the potential profit or loss at the time of the closure. This includes the entry price, exit price, and the actual amount of profit or loss in USD, as well as a percentage representation. The notification also tells you the original entry price and when it was created.

## Interface ClosePendingCommit

This event signals that a previously opened position has been closed. It's used to communicate the details of that closure within the backtesting system. You'll find information like the reason for the closure (identified by a `closeId`, which you can provide), and the profit and loss (`pnl`) associated with that closed position at the time it happened. The event explicitly indicates this is a “close-pending” action.

## Interface CancelScheduledCommitNotification

This notification informs you that a previously scheduled trading signal has been cancelled before it was actually executed. It’s like a heads-up that something you planned didn't happen as expected.

The notification includes a unique identifier for tracking purposes, the time of cancellation, and whether it occurred during a backtest (simulated trading) or live trading. You'll also find details like the trading pair (e.g., BTCUSDT), the name of the strategy that generated the signal, and the exchange involved.

It provides a lot of context about the signal itself – its unique ID, the reason for cancellation (if provided), and details about potential DCA entries, partial closes, and original entry prices. You can also see the profit and loss (PNL) information associated with the signal, including costs, capital invested, and prices used in the PNL calculation. Finally, it includes the creation timestamp for audit trails.

## Interface CancelScheduledCommit

This interface lets you signal that a previously scheduled action needs to be cancelled. Think of it as a way to retract a plan. 

You'll specify that the action is a "cancel-scheduled" event.  You can also provide a `cancelId` – a short explanation or identifier – to explain *why* you're cancelling it. Finally, you include the `pnl` at the time of cancellation, reflecting the strategy's performance up to that point.

## Interface BreakevenStatisticsModel

This model holds the results of analyzing breakeven events, which are points where a trade's costs are recouped. It's essentially a collection of data points that help you understand how frequently and where your trades are hitting breakeven.

The `eventList` property contains an array, giving you all the individual details about each breakeven event that occurred.  You can dive into this list to examine each one closely.

The `totalEvents` property simply tells you the overall number of breakeven events that were recorded.

## Interface BreakevenEvent

This data structure holds all the details about when a trading signal reached its breakeven point – that’s the point where it's neither in profit nor loss. It includes things like the exact time, the symbol being traded (e.g., BTC/USDT), the name of the strategy used, and a unique ID for the signal itself.

You'll also find information about the position taken (long or short), the current market price, and the original entry and exit prices (take profit and stop loss). The data keeps track of details like the number of times you might have bought in stages (DCA) and any partial exits performed. 

Finally, it includes the unrealized profit and loss (PNL) at the time of breakeven, a human-readable explanation for the signal, when the position first became active, when the signal was scheduled, and whether the trade was part of a backtest or a live trade.

## Interface BreakevenContract

This describes a breakeven event – a moment when a trading signal's stop-loss is moved back to the original entry price. It's a signal that the trade has progressed enough to cover its costs and potentially reduce risk. These events are tracked to monitor a strategy's safety and show milestones in risk reduction.

Each breakeven event provides details about the trade: the symbol (like BTCUSDT), the strategy that created the signal, the exchange being used, the timeframe of the trade, the full details of the original signal, the current price that triggered the breakeven, whether it's a backtest or live trade, and the exact time the event occurred. This data can be used to create reports or to trigger actions based on how trades are performing. The system ensures that a breakeven event isn't repeated for the same signal.

## Interface BreakevenCommitNotification

This notification informs you when a breakeven action has been executed within the trading system. It provides a detailed snapshot of the trade's state at the moment of the breakeven. You'll see key information like a unique identifier for the notification, a timestamp, and whether the action occurred during a backtest or in live trading.

The notification includes specifics about the trade itself: the trading symbol, the strategy that triggered it, the exchange used, and a unique signal ID. Crucially, you’ll get the current market price, the direction of the trade (long or short), and the entry price.

Detailed pricing information is available including take profit, stop loss, and their original values before any trailing adjustments.  You'll also see details about any DCA averaging (total entries) and partial closes that occurred.

Finally, the notification provides a comprehensive P&L picture, including percentage, cost, and entry/exit prices adjusted for slippage and fees, alongside when the signal was initially scheduled and when the position became pending.

## Interface BreakevenCommit

This object represents an event triggered when a trading position reaches its breakeven point. It provides a snapshot of the position's state at that moment. 

The `action` property confirms this is a breakeven event.

You’ll find details such as the current market price, your unrealized profit and loss (PNL), and whether the position is a long (buy) or short (sell) trade. It also includes the original entry price, the take profit and stop loss prices (both as they currently exist and as they were initially set), the timestamp when the signal was created and when the position became active. This information allows you to understand the circumstances surrounding the breakeven event and analyze the position's performance.

## Interface BreakevenAvailableNotification

This notification alerts you when a trading signal's stop-loss can be moved to the entry price, essentially allowing you to break even on your trade. It provides detailed information about the signal that triggered this event, including a unique identifier, the timestamp of the event, and whether it occurred during a backtest or live trading.

You'll also find details about the trade itself, like the symbol being traded, the strategy used, the exchange involved, the signal ID, and the current market price. The notification includes the entry price, the trade direction (long or short), and the current take profit and stop-loss levels.

Furthermore, it provides a complete snapshot of the position’s history, including original prices, the number of DCA entries and partial closes, and P&L information. This allows for a thorough understanding of the trade's performance and the factors contributing to reaching the breakeven point. The notification also contains timestamps for signal creation and pending status.

## Interface BacktestStatisticsModel

This model gives you a detailed breakdown of how your trading strategy performed during a backtest. It collects a wide range of statistics, helping you understand its strengths and weaknesses.

You'll find a list of every trade that was closed, along with individual details for each. The model also tallies the total number of trades, and separates them into winning and losing trades.

Key performance indicators like win rate, average PNL, and total PNL provide a clear picture of profitability. To assess risk, you can look at the standard deviation, which indicates volatility, and the Sharpe Ratio, which combines return and risk. 

Additional metrics, like certainty ratio and expected yearly returns, offer further insights into the strategy’s reliability and potential. You’ll also find metrics focused on drawdown, like average peak PNL and average fall PNL, which reveal the severity of potential losses. Remember that many of these values can be null if the calculations were unsafe (resulted in NaN or Infinity).

## Interface AverageBuyCommitNotification

This notification is triggered whenever a new purchase is made as part of a Dollar-Cost Averaging (DCA) strategy. It provides detailed information about that specific averaging step within an ongoing position. You’ll find the unique identifier of the notification, the timestamp of the purchase, and whether it occurred during a backtest or live trading.

The notification also includes specifics about the trade itself, like the symbol, strategy name, exchange used, and signal ID. Key details like the execution price, cost of the averaging step, and the new effective average price are all provided. You can track the total number of DCA entries and partial closes made.

Further details include the original entry price, effective take profit/stop loss prices (and their original values before any trailing adjustments), and profit/loss information at the time of the averaging purchase, along with the timestamps for signal creation and pending status. It gives a full picture of how the DCA process is impacting the position’s performance.

## Interface AverageBuyCommit

This event signifies a new step in a dollar-cost averaging (DCA) strategy, where additional positions are added to an existing trade. It provides a snapshot of the state after this averaging buy or sell.

The `action` property confirms it’s an average-buy event.

You’ll find the `currentPrice` used for the recent averaging entry, along with its `cost` in USD.

The `effectivePriceOpen` reflects the new, averaged-out entry price.  It’s a crucial value showing how the original entry price has shifted.

The event also includes the current unrealized profit and loss (`pnl`), along with trade direction (`position`), and original entry price (`priceOpen`).

Other key details include the `priceTakeProfit`, `priceStopLoss`, their original values before any trailing adjustments (`originalPriceTakeProfit`, `originalPriceStopLoss`), and timestamps of when the signal was generated (`scheduledAt`) and when the position started (`pendingAt`).

## Interface ActivePingContract

This defines how the backtest-kit framework communicates about active pending signals. It's like a heartbeat, sending out information every minute while a pending signal is still open. 

The `ActivePingContract` contains several pieces of information: the trading symbol, the name of the strategy managing it, the exchange being used, and all the details of the pending signal itself. You'll also find the current price and whether the ping is coming from a backtest or a live trading environment.

Finally, it includes a timestamp to tell you precisely when this event occurred, which is crucial for real-time or historical analysis. This allows you to build custom logic to react to changes in your pending signals.


## Interface ActivateScheduledCommitNotification

This notification lets you know when a scheduled trade has been activated, meaning it's moving forward even before the price reaches a specific level. It provides a detailed snapshot of the trade's setup and current status. 

You'll find key information like a unique identifier for the notification and the exact time the activation happened. It also tells you if the activation occurred during a backtest or live trading session.

The notification includes all the essential trade parameters: the trading pair, the strategy that generated the signal, the exchange used, and the direction of the trade (long or short). You’ll also see the entry price, take profit, and stop-loss levels, along with their original values before any adjustments.

Detailed information about any DCA (Dollar-Cost Averaging) strategies applied is present, showing the number of entries and partial closes. Furthermore, you'll see a breakdown of the trade's potential profitability, including P&L figures, percentages, and associated prices. Finally, it includes timestamps for when the signal was initially created, when it started pending, and when it was actually executed.

## Interface ActivateScheduledCommit

This interface represents an event triggered when a previously scheduled trade is activated. It contains all the necessary information about the trade being initiated, including details like the trade direction (long or short), entry price, take profit levels (both original and adjusted), and stop-loss levels (also original and adjusted). You'll find the original timestamps associated with the signal's creation and the activation itself. A user-provided identifier can be included to explain why the activation is happening. Finally, it also includes the current market price and the profit and loss (PNL) calculated at the entry price.
