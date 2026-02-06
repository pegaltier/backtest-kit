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

This interface defines what happens when a walker needs to be stopped within the backtest-kit framework. It's like a notification that a particular trading strategy, running under a specific walker's name, needs to be paused or halted. This is especially useful when you have multiple strategies operating on the same market, allowing you to target just the one you want to interrupt. The notification includes the trading symbol, the strategy's name, and the walker's name so you know exactly what's being stopped.

## Interface WalkerStatisticsModel

This interface, WalkerStatisticsModel, helps organize the data you get when analyzing backtest results. Think of it as a container for all the information needed to compare different trading strategies. 

It builds upon the existing IWalkerResults interface and adds details specifically for comparing how your strategies performed against each other. 

The core of this data is the `strategyResults` property, which is simply a list containing the results for each strategy you tested. This allows you to easily see and compare metrics like profit, drawdown, and other performance indicators across your different approaches.

## Interface WalkerContract

The WalkerContract represents updates as your trading strategies are being compared during a backtest run. It's like a progress report showing how each strategy performs relative to others. 

Each time a strategy finishes its test, this contract sends out information including the strategy’s name, the exchange and frame it’s running on, the symbol being traded, and its key statistics.  You’ll also see the metric value the strategy achieved, which metric is being optimized, and what the best result has been so far across all strategies. 

Finally, it tracks the overall progress of the comparison – how many strategies have been tested and how many are left. This allows you to monitor the backtest and understand where the best performing strategies currently stand.

## Interface WalkerCompleteContract

This interface describes what's emitted when a backtesting process, called a "walker," finishes running. Think of a walker as a system that tries out many different trading strategies on historical data.

When a walker is done, it sends out this notification, giving you a complete picture of what happened.  

The notification includes details like the name of the walker itself, the trading symbol being tested (like AAPL or BTC), the exchange used (like Coinbase or Binance), and the timeframe of the data (like 1 hour or 1 day). 

You’ll also find information about the optimization metric – the thing the walker was trying to improve – and how many strategies were tested. Most importantly, it tells you which strategy performed the best, its resulting metric value, and detailed statistics about that top-performing strategy.

## Interface ValidationErrorNotification

This notification lets you know when a validation check fails during a trading simulation or live execution. It's triggered when risk validation functions encounter problems, helping you identify and fix issues proactively. Each notification has a unique ID, a clear error message explaining what went wrong, and detailed error information including a stack trace. Importantly, these notifications always indicate that the error originated from the environment, not a backtest.

## Interface ValidateArgs

This interface, `ValidateArgs`, helps ensure that all the key names you're using in your backtesting setup are correct and recognized. Think of it as a checklist to prevent errors caused by typos or incorrect names.

It defines properties for things like the exchange you're using, the timeframe of your data, the name of your trading strategy, and even the sizing method you've chosen.

Each property expects a type `T` which will hold an enum of possible values – essentially, a list of allowed names for that particular setting. This allows the system to check if the names you provide actually exist and are valid within the backtest kit. 




By using this interface in your validation processes, you can catch potential issues early on and avoid unexpected behavior during backtesting.

## Interface TrailingTakeCommitNotification

This notification lets you know when a trailing take profit order has been executed. It’s triggered when your trading strategy adjusts and commits a take profit price, typically as the market moves favorably. 

The notification includes details like a unique identifier, the exact time it happened, and whether it occurred during a backtest or live trading. You'll find information about the symbol being traded, the strategy that generated the signal, and the exchange used. 

It provides the original and adjusted take profit and stop loss prices, along with the entry price and the current market price at the time of execution. You also get timestamps for when the signal was created, when the position went pending, and when the notification itself was generated, giving you a complete timeline of the event.

## Interface TrailingTakeCommit

This describes what happens when a trailing take profit order is triggered within the backtest-kit framework. Essentially, it represents an event where your take profit price is adjusted automatically based on market movements. 

The `action` property confirms this is a trailing take event.  You'll see the `percentShift` which dictates how much the take profit is moved. The `currentPrice` indicates the market price at the moment the trailing adjustment occurred.  

The `position` tells you if it's a long (buy) or short (sell) trade. You'll also find the `priceOpen` - the original entry price - alongside the `priceTakeProfit` which is now the updated take profit target.  The `priceStopLoss` is also provided, as trailing can also affect your stop-loss price.  For reference, the `originalPriceTakeProfit` and `originalPriceStopLoss` show you the prices before any trailing modifications.  Finally, `scheduledAt` indicates when the trailing signal was initially created and `pendingAt` shows when the position was activated.

## Interface TrailingStopCommitNotification

This notification lets you know when a trailing stop order has been triggered and executed. It provides detailed information about the event, including a unique identifier, the timestamp of the action, and whether it occurred during a backtest or in live trading. You’ll find specifics about the trading pair, the strategy that initiated the stop, and the exchange used.

The notification also gives you a snapshot of the trade at the time of execution: the current market price, the trade direction (long or short), the original entry price, and the adjusted take profit and stop loss prices. It even includes information on when the signal was initially created and when the position became active. This comprehensive data allows you to analyze the performance of your trailing stop strategies and understand how they react to market movements.

## Interface TrailingStopCommit

This describes what happens when a trailing stop order is executed. It's essentially a notification about a change to your stop-loss price, triggered by market movement.

The `action` property confirms this is a trailing stop event. You’ll find details about how much the stop-loss price has moved using `percentShift`.

It also provides key information about the trade itself, like the `currentPrice` when the adjustment was made, whether it’s a `position` that was bought (long) or sold (short), and the `priceOpen` which is the initial entry price.

You’ll see both the `priceTakeProfit` and `priceStopLoss`, representing the *current* effective prices for those orders, along with their `originalPriceTakeProfit` and `originalPriceStopLoss` which show what they were initially set to. Finally, `scheduledAt` and `pendingAt` offer timestamps to understand when the signal was created and the position was activated.

## Interface TickEvent

This interface, `TickEvent`, acts as a central container for all the data you receive about a trade's lifecycle. Think of it as a standardized report card for each event, whether it’s a trade being opened, scheduled, closed, or cancelled. It bundles together information like the timestamp, the type of action that occurred (like 'opened' or 'closed'), the trading symbol involved, and important details specific to that action.

For trades that are scheduled, you’ll find the time it was initially created.  When a trade is open or active, you’ll see things like the current price, take profit and stop loss levels, and how far along the trade is toward those targets.  For closed or cancelled trades, you get details like the reason for the closure or cancellation, the duration of the trade, and how much profit or loss was realized. The structure provides a consistent format, making it much easier to analyze and build reports across different trading activities.

## Interface StrategyStatisticsModel

This model holds a collection of statistics gathered from your trading strategy's activity. It's a way to understand how your strategy is behaving over time.

You'll find a detailed list of every event your strategy generated in the `eventList` property, providing a complete record. 

Beyond that, it offers counts for various event types like cancellations, pending order closures, partial profit/loss adjustments, and trailing stop/take actions.  This helps you quickly see the frequency of each type of event occurring during backtesting. You can also check the total number of events and the number of scheduled activations.

## Interface StrategyEvent

This interface holds all the important details about what’s happening with your trading strategy. Think of it as a record of every action taken, whether it’s opening a position, adjusting a stop-loss, or closing a trade. 

Each event includes things like the exact time it occurred, which trading pair was involved, the name of the strategy, and the exchange being used. You'll also find details about the signal that triggered the action, like a unique ID, and whether the trade is part of a backtest or live trading.

It provides key pricing data, including the current market price, entry price, take profit levels, and stop-loss levels – both the original amounts and any adjusted values due to trailing.  For scheduled actions, you can also see timestamps related to when those actions were created and when they started pending. This comprehensive information is particularly useful for generating reports and analyzing your strategy's performance.

## Interface SignalScheduledNotification

This notification tells you when a trading signal has been set to execute in the future. It's like a heads-up that a trade is about to happen, but not right away. Each notification has a unique ID and timestamp indicating when the signal was scheduled.

You’ll find details like the trading symbol (e.g., BTCUSDT), the name of the strategy that created the signal, and the exchange it will execute on. Crucially, it provides the planned entry price, as well as the take profit and stop-loss levels that were set.

The notification also includes original take profit and stop-loss prices before any adjustments were made, the current market price at the time of scheduling, and the time the notification itself was generated. A flag indicates whether the signal originated from a backtest simulation or a live trading environment.

## Interface SignalOpenedNotification

This notification lets you know when a new trade has been initiated. It provides a wealth of information about the trade, including a unique ID, when it happened, and whether it’s from a backtest or live trading environment.  You'll find details like the trading pair (e.g., BTCUSDT), the strategy that triggered it, and the exchange it was executed on.

The notification also breaks down the specifics of the trade itself – whether it's a long (buy) or short (sell) position, the entry price, and any take profit and stop-loss levels that were set.  It even keeps track of the original take profit and stop loss prices before any adjustments were made, and gives you an optional note explaining why the signal was generated. Finally, there's data about when the signal was initially created, when it entered a pending state, and when the overall result was created.

## Interface SignalData$1

This data structure holds all the key details about a single trading signal after it’s been closed. It's designed to be used when calculating and displaying performance metrics, like profit and loss.  Each piece of information tells you where the signal came from (the strategy name), a unique ID for tracking purposes, what asset was traded, whether it was a long or short position, and the percentage profit or loss achieved. You'll also find the reasons for closing the trade, and the exact timestamps of when the trade opened and closed. Essentially, it's a complete record of a completed signal’s lifecycle.


## Interface SignalCommitBase

This defines the fundamental information shared by all signal commitment events within the backtest-kit framework. Every time a trading signal is generated, it will include details like the trading pair's symbol – for example, "BTCUSDT" – and the name of the strategy that created it. You'll also find the exchange used, the timeframe involved (important for backtesting, and blank when trading live), and a unique ID for tracking the signal. Finally, a timestamp records exactly when the signal occurred, based on the tick or candle data.

## Interface SignalClosedNotification

This notification tells you when a trading position, triggered by a signal, has been closed, whether it was from a backtest or a live trade. It provides a lot of detail about the trade, including a unique identifier for the notification itself, the exact time it closed, and whether it was a long or short position. You'll find information like the entry and exit prices, the original take profit and stop loss levels, and the profit or loss percentage achieved. The notification also explains *why* the position closed – was it a take profit, a stop loss, or something else? Finally, it gives you details on the position’s lifetime, creation timestamps, and how long it was pending before execution.

## Interface SignalCancelledNotification

This notification tells you when a scheduled trading signal was cancelled before it could be executed. It provides detailed information about the cancelled signal, helping you understand why it didn’t run. 

You'll find details like the signal's unique identifier, the strategy that created it, and the trading pair involved. The notification also includes specifics about the intended trade, such as the take profit and stop loss prices, and explains the reason for the cancellation - whether it was due to a timeout, price rejection, or a user action. Importantly, it also reveals when the signal was initially created and when it was scheduled, which can be valuable for analyzing your strategy’s timing and behavior.  If a user manually cancelled the signal, you’ll see a cancellation identifier associated with it.

## Interface ScheduleStatisticsModel

The `ScheduleStatisticsModel` gives you a clear picture of how your scheduled signals are performing. It breaks down the total number of signals you've scheduled, opened (activated), and cancelled. 

You’ll find a detailed list of all events, allowing you to examine each one individually. 

It also calculates key performance indicators like the cancellation rate (how often signals are cancelled) and the activation rate (how often scheduled signals become active).  

Finally, you can see the average time signals spend waiting before being cancelled or activated, offering insights into potential delays or inefficiencies in your system.

## Interface SchedulePingContract

This defines how the backtest-kit framework communicates about scheduled signals that are actively being monitored. Think of it as a heartbeat signal, sent every minute while a signal is running. It provides details about the trading pair, the strategy using the signal, the exchange involved, and the full data associated with that signal – including things like entry price, take profit levels, and stop loss levels.

A key piece is the `backtest` flag, which tells you whether this signal ping is happening during a historical backtest or live trading. The `timestamp` also changes meaning based on this mode – it's the current time in live mode, and the candle timestamp in backtest mode. You can use this information to build custom monitoring or even implement your own cancellation logic for signals. The framework allows you to "listen" for these pings to keep track of the signal's status.

## Interface ScheduledEvent

This interface bundles together all the important details about trading signals – whether they were scheduled, opened, or cancelled. Think of it as a single record containing everything you need to understand what happened with a particular signal. 

You'll find information like the exact time each event occurred, the type of action taken (scheduled, opened, or cancelled), the trading pair involved, and a unique ID for the signal. It includes pricing details like entry price, take profit, and stop loss, along with the original values before any adjustments were made. 

For closed positions, you can see how much was executed through partial closes. If a signal was cancelled, you’ll find details about why and who initiated the cancellation. It also tracks when a position became active and the original creation time of the signal.

## Interface RiskStatisticsModel

This model helps you understand and monitor risk management performance within your backtesting framework. It collects and organizes information about risk rejections, giving you a clear picture of where and why risks are being triggered.

You'll find a detailed list of individual risk events, including all the relevant data for each one. 

It also provides summarized counts of total rejections, and breakdowns grouped by trading symbol and the strategy involved. This allows you to quickly identify trends and potential areas for improvement in your risk controls.

## Interface RiskRejectionNotification

This notification lets you know when a trading signal was blocked by your risk management rules. It provides a lot of detail about why the signal was rejected, including the strategy that generated it, the exchange involved, and a human-readable explanation. You'll find information like the trading symbol, the current price at the time of rejection, the intended trade direction (long or short), and details like take profit and stop-loss levels. Identifying information such as a unique ID, timestamp, and whether the rejection occurred during a backtest or live trading are also included. If a pending signal was involved, you can find its ID here too.

## Interface RiskEvent

This data structure holds information about when a trading signal was blocked due to risk management rules. It’s like a record of a "no-go" moment in your backtesting or live trading. 

Each `RiskEvent` captures details such as the exact time it happened, the trading pair involved, the specific signal that was rejected, and the name of the strategy and exchange that generated it. You'll also find the current market price at the time, how many positions were already open, and a unique ID along with a reason explaining why the signal was rejected. It also indicates whether the event occurred during a backtest or in live trading. This helps in understanding and fine-tuning your risk parameters.

## Interface RiskContract

This interface, `RiskContract`, provides details about situations where a trading signal was blocked due to a risk check. Think of it as a log entry when the system says "no" to a potential trade.

It tells you exactly *why* a signal wasn't executed, including the trading pair involved (`symbol`), the details of the signal itself (`currentSignal`), and which strategy (`strategyName`) tried to place it. You'll also see the timeframe (`frameName`) and exchange (`exchangeName`) that were being used.

Along with the “who” and “what,” it includes important context, like the price at the time of the rejection (`currentPrice`), the number of existing open positions (`activePositionCount`), and a unique ID (`rejectionId`) to help track the incident. A human-readable explanation (`rejectionNote`) is provided to explain *why* the signal was rejected, and the timestamp (`timestamp`) notes when the event occurred. Finally, the `backtest` flag indicates whether the rejection happened during a backtest simulation or in live trading. This information is useful for monitoring risk management effectiveness and investigating rejected trades.

## Interface ProgressWalkerContract

The `ProgressWalkerContract` helps you monitor the progress of long-running tasks within backtest-kit, specifically when running a background process like evaluating multiple trading strategies. It provides updates on how many strategies are being analyzed, how many have already been processed, and the overall percentage of completion. You'll see this information when a Walker is running, giving you insight into the workload and an estimated time to finish. Each update includes details like the walker's name, the exchange and frame being used, and the trading symbol involved, allowing you to track the progress of specific tests.


## Interface ProgressBacktestContract

This interface describes how the backtest kit reports its progress while running. It provides updates during the background execution of a backtest, letting you know how far along the process is.

Each update includes details like the exchange being used, the name of the strategy, and the trading symbol being backtested. You'll also get the total number of historical data points being processed, how many have already been handled, and a percentage representing the overall completion. This allows you to monitor the backtest's progress and estimate how much time is left.


## Interface PerformanceStatisticsModel

This model holds all the performance data collected during a backtest, organized by the strategy that ran it. You'll find the strategy's name here, along with the total number of events recorded and the overall execution time. 

A key part of this model is `metricStats`, which breaks down the data into groups based on different performance metrics. Finally, you can access the raw, individual performance events through the `events` array, providing the most detailed view of what happened during the backtest.

## Interface PerformanceContract

The PerformanceContract helps you understand how your trading strategies are performing under the hood. It’s like a detailed log of what’s happening during a backtest or live trade. Each entry in this log, or PerformanceContract, records things like when an action happened (timestamp), how long it took (duration), and which strategy, exchange, and symbol were involved. 

You’ll find information about the previous event's timestamp as well, allowing you to track changes over time. Knowing whether the event occurred during a backtest or in live mode is also included. Ultimately, this data allows you to pinpoint areas where your strategies might be slow or inefficient, helping you optimize them for better performance.


## Interface PartialStatisticsModel

This model keeps track of the statistics generated when you're using partial profit and loss calculations in your backtesting. It essentially gives you a breakdown of how many times your trading strategy has resulted in a profit versus a loss, and provides a detailed record of each individual event. You’ll find a list of all the events, the total number of events, and separate counts for profitable and losing trades all compiled within this structure. It helps you analyze how well your strategy is performing with partial profit/loss milestones.

## Interface PartialProfitContract

This describes events triggered when a trading strategy hits a partial profit milestone, like 10%, 20%, or 30% profit. These events, called `PartialProfitContract` objects, provide detailed information about the trade's progress. You’ll find the trading symbol, the name of the strategy that generated the signal, and the exchange it’s running on.

Each event includes the complete data of the original signal, the current market price at the time of the milestone, and the specific profit level achieved. A flag indicates whether the event came from a backtest (historical data) or live trading. Finally, a timestamp records when the event happened – either at the moment of detection in live mode or based on the candle data during a backtest. This information is used by services to create reports and allows users to track performance.

## Interface PartialProfitCommitNotification

This notification lets you know when a partial profit has been taken during a trade. It’s triggered when a strategy decides to close a portion of a position to secure some gains. 

Each notification includes a unique identifier and a timestamp indicating when the action occurred. You'll find details about the trade itself, such as the symbol being traded (like BTCUSDT), the strategy that generated the signal, and whether the trade happened during a backtest or in live mode.

The notification also provides key pricing information: the entry price, take profit price, stop loss price (both original and adjusted for trailing), and the current market price at the time of the partial profit. You'll see the percentage of the position that was closed, along with timestamps related to the signal's creation and when the position became active.

## Interface PartialProfitCommit

This describes what happens when a backtest system takes a partial profit on a trade. It’s essentially a notification that a portion of your position is being closed out early to secure some gains.

The `action` property clearly indicates that this is a partial profit event. You’ll find details like the percentage of the position being closed (`percentToClose`), the current market price at the time (`currentPrice`), and whether you’re in a long (buying) or short (selling) position. 

The system also provides insight into how the trade was initially set up, including the original entry price (`priceOpen`), the intended take profit and stop loss prices (`priceTakeProfit`, `priceStopLoss`), and their values before any trailing adjustments were applied (`originalPriceTakeProfit`, `originalPriceStopLoss`). Finally, timestamps (`scheduledAt`, `pendingAt`) give you information about when the signal was created and when the position was initially activated.

## Interface PartialProfitAvailableNotification

This notification lets you know when your trading strategy has hit a predefined profit milestone, like reaching 10%, 20%, or 30% profit. It's a way to track your strategy's performance during backtesting or live trading. Each notification includes a unique ID and timestamp, plus details like the trading symbol, strategy name, and the exchange where the trade happened.

You'll find information about the signal that triggered the profit, including its ID, direction (long or short), and the original take profit and stop-loss prices before any trailing adjustments were applied. It also provides the current market price and timestamps that mark significant events like signal creation and when the position became active. Knowing these details will help you analyze your strategy’s behavior and how it responds to different market conditions.

## Interface PartialLossContract

This describes a special event that happens when a trading strategy experiences a loss, but not a complete one – think of it as hitting a partial stop-loss level. It's used to keep track of how much a strategy is losing, step by step.

Each event tells you precisely which market ("BTCUSDT", for example), strategy, and exchange it relates to. You’ll also see details like the original signal data, the current price at the time of the loss, and importantly, the specific loss level reached (like -10%, -20%, etc.).  

The event also indicates whether it's happening during a backtest (using historical data) or live trading, and provides a timestamp for when it occurred. It’s a way for systems to monitor strategy performance and for users to get notified about significant drawdowns.


## Interface PartialLossCommitNotification

This notification lets you know when a partial loss action has taken place. It provides detailed information about the specific trade that was affected, including a unique ID for the notification and the exact time it occurred. You'll see details like the trading symbol (e.g., BTCUSDT), the strategy that triggered the action, and whether it happened during a backtest or live trading.

The notification includes key price points like the entry price, take profit levels (both original and adjusted), and stop loss levels, alongside timestamps for when the signal was created, went pending, and when the partial loss was executed.  It also tells you the percentage of the position that was closed and the current price at the time of the action, giving you a full picture of what happened during this trade event.

## Interface PartialLossCommit

This describes a partial loss event, which happens when a trading strategy decides to close a portion of an existing position. It includes details about what triggered the action – specifically, a "partial-loss" – and how much of the position is being closed, represented as a percentage. You’ll find the current market price at the time the decision was made, along with whether the position was initially a long (buy) or short (sell) trade.

The information also provides insight into the original trade setup, including the entry price, the initially set take profit and stop loss prices, and their values *before* any adjustments like trailing stops were applied. Finally, the timestamps of when the signal was created and when the position was activated are recorded, offering a complete picture of the event's timeline.

## Interface PartialLossAvailableNotification

This notification alerts you when a trading strategy hits a pre-defined loss level, like a 10% or 20% drop. It’s a way to track how a strategy is performing and identify potential issues. Each notification gets a unique ID and timestamp, so you can easily reference it.

You'll find details like the trading symbol, the strategy’s name, and where the trade was executed. It tells you whether this is happening in a simulated backtest or live trading. Crucially, it provides the entry price, current price, trade direction (long or short), and the original and adjusted take profit and stop loss prices, giving you a complete picture of the position’s state at the moment the loss level was triggered. The notification also includes timestamps related to when the signal was created and when the position became active.

## Interface PartialEvent

This interface, `PartialEvent`, holds all the important details about profit and loss milestones during a trade. Think of it as a snapshot of key data points – when a trade hits a profit or loss level, this structure captures the time, the type of event (profit or loss), what asset was traded, the strategy used, and more.  It includes information like the current price, the original take profit and stop loss levels, and whether the trade is part of a backtest or a live trade.  The `note` field provides a human-readable explanation of the signal's reasoning, and timestamps track when the position became active and when the signal was initially created. Ultimately, `PartialEvent` is designed to streamline the creation of reports and provide a clear picture of trade performance.


## Interface MetricStats

This interface helps you understand how performance metrics are tracked during backtesting. It gathers a collection of statistics for a particular metric, like order execution time or data retrieval speed. You'll find key details such as the total number of times a metric was recorded, the overall time spent, and calculated values like average, minimum, and maximum durations. 

It also includes measurements of data spread, like standard deviation, and percentile values (p95, p99) to give a clearer picture of performance distribution. Finally, it captures wait time information, representing the intervals between events related to the metric.

## Interface LiveStatisticsModel

The LiveStatisticsModel provides a snapshot of how your live trading is performing. It keeps track of every event – from idle periods to when you open, actively manage, and close trades – giving you a detailed history. You’ll find key numbers like the total number of trades, the number of winning and losing trades, and the overall profit or loss.

The model also calculates vital performance metrics to understand the quality of your trading. This includes the win rate (the percentage of profitable trades), average profit per trade, total cumulative profit, and volatility measures like standard deviation.  More advanced ratios like the Sharpe Ratio and Annualized Sharpe Ratio help assess risk-adjusted performance. Finally, the Certainty Ratio and Expected Yearly Returns offer insights into trade consistency and potential yearly earnings. All numeric values are carefully monitored and will display as null if the calculation is unreliable.

## Interface IWalkerStrategyResult

This interface represents the outcome of running a single trading strategy within a backtesting comparison. It bundles together key information about that strategy’s performance. 

You'll find the strategy’s name clearly listed, along with detailed statistics generated from the backtest itself. 

A specific metric value is also included, which is used to determine how well the strategy performed relative to others, and it's marked as potentially null if the calculation was not possible. Finally, a rank indicates the strategy's position in the overall comparison, with 1 signifying the top performer.

## Interface IWalkerSchema

The Walker schema lets you set up A/B testing scenarios within backtest-kit, comparing different trading strategies against each other. You give it a unique name to identify it, and can add a note for your own reference. It specifies which exchange and timeframe should be used for all strategies involved in the test. 

The core of the schema is the list of strategy names you want to compare—these strategies need to have been previously registered. You also define the metric, like Sharpe Ratio, that you want to optimize during the backtesting process. Finally, you can include optional callback functions to be notified at different points in the walker’s lifecycle.

## Interface IWalkerResults

After running a backtest kit walker, the `IWalkerResults` object holds all the information about what happened. It tells you which asset, or symbol, was tested, and which exchange was used for the backtesting. You’ll also find the name of the specific walker that ran the tests, and the name of the time frame (like 1 minute or 1 day) used during the backtest. Think of it as a summary report of the entire walker process.

## Interface IWalkerCallbacks

This interface lets you hook into different stages of the backtest process. Think of it as a way to listen in on what's happening as your strategies are being tested. 

You can get notified when a specific strategy begins testing, allowing you to log it or perform any pre-test actions. Similarly, you'll be alerted when a strategy finishes, giving you access to key statistics and performance metrics. 

If an error occurs during a strategy's backtest, you'll receive a notification with details about the problem. Finally, when all the testing is complete, you'll be informed with a summary of the overall results. These callbacks provide valuable insights and control during the entire backtesting journey.

## Interface ITrailingTakeCommitRow

This interface represents a single step in a trading plan related to trailing take profit and commitment actions. Think of it as a record of a specific adjustment being made – whether it's setting a new take profit level or confirming a commitment based on a percentage shift from the current price. The `action` property clearly identifies this as a "trailing-take" action. You’ll find the `percentShift` defines how much the price needs to move to trigger the action, and `currentPrice` tells you the price at the moment the trailing was originally established. Essentially, it's a snapshot of a trailing take profit or commitment order’s calculation.

## Interface ITrailingStopCommitRow

This interface represents a single action queued for a trailing stop order. Think of it as a snapshot of what needs to happen regarding a trailing stop – it tells the system to adjust a trailing stop, and provides the details for that adjustment. It includes the type of action being performed, which is specifically a "trailing-stop" adjustment. You'll also find the percentage shift that needs to be applied to the stop price, and the price at which the trailing stop was originally established. This information is used to precisely update the stop-loss level.

## Interface IStrategyTickResultWaiting

This data structure represents a tick result when a trading signal is scheduled and waiting for the price to reach a specific entry point. Think of it as a "holding pattern" for a trade. It’s different from the initial signal creation, which only happens once.

The information provided includes the signal itself, the current price being monitored, details about the strategy and exchange being used (like the strategy name, exchange, time frame, and symbol), and progress indicators for take profit and stop loss (though these will always be zero in the waiting state). It also tracks unrealized profit and loss for the theoretical position and indicates whether the data comes from a backtest or a live trading environment, and when the result was generated. This allows you to track the status of your pending trades and understand the conditions they are waiting for.

## Interface IStrategyTickResultScheduled

This interface represents a tick result that happens when a trading strategy generates a signal but is waiting for the price to reach a specific entry point. It's used to track when a strategy schedules a signal, essentially putting an order on hold until conditions are met.

The result includes important details like the strategy's name, the exchange being used, the timeframe involved, and the trading symbol. You’ll also find the current price at the time the signal was scheduled and whether the event occurred during a backtest or live trading. The `signal` property holds all the information about the signal itself, which will be used to place the order once the price target is hit. This whole structure helps monitor and understand how strategies are behaving when they’re placing scheduled orders.

## Interface IStrategyTickResultOpened

This interface describes what happens when a new trading signal is created within your backtesting or live trading system. It's a notification that a signal has been successfully generated, validated, and saved. 

You'll receive this notification whenever a new signal appears. 

It provides a wealth of information with the notification:

*   The signal itself, including a unique ID.
*   The name of the strategy that created it.
*   The exchange and timeframe used.
*   The trading symbol involved (like BTCUSDT).
*   The current price at the time the signal was opened.
*   Whether the signal originates from a backtest or a live trading environment.
*   The timestamp when the signal was created.

Essentially, it's a detailed record of a new signal’s birth, giving you all the context you need to understand and react to it.

## Interface IStrategyTickResultIdle

This interface describes what happens when your trading strategy is in a resting state, meaning it's not currently making any trades. It provides details about the context of that idle period, like the strategy's name, the exchange it’s using, the timeframe being analyzed (like 1-minute or 5-minute intervals), and the trading pair involved.  You'll find the current price at the time of the idle state, whether the data is from a backtest or live trading, and a timestamp indicating when the event occurred. It essentially records the situation when the strategy isn't actively signaling a trade.

## Interface IStrategyTickResultClosed

This interface, `IStrategyTickResultClosed`, describes what happens when a trading signal is closed. It contains all the information about the closure, including why it was closed – whether it was due to a time limit, a take-profit or stop-loss trigger, or a manual closure.

You’ll find details like the final price used for the trade, a record of the profit or loss (including fees and slippage), and identifying information such as the strategy and exchange names, the timeframe, and the trading symbol. 

It also keeps track of whether the closure occurred during a backtest or in a live trading environment, and provides a unique ID if the signal was closed manually. Finally, it includes a timestamp for when the result was created.


## Interface IStrategyTickResultCancelled

This interface describes what happens when a signal you've scheduled doesn't actually lead to a trade – maybe it was cancelled before a position opened, or it was stopped out early. It gives you details about why the signal didn't activate, including the signal itself, the price at the time of cancellation, and when it happened. 

You'll find information here about the strategy and exchange involved, the trading pair (like BTCUSDT), and whether this is a backtest or live trade. A cancellation ID is also included if you explicitly cancelled the signal yourself. 

The `reason` property specifically tells you *why* the signal was cancelled, while `createdAt` provides a timestamp indicating when the result was generated. This is helpful for debugging and understanding your strategy’s behavior.

## Interface IStrategyTickResultActive

This interface represents a tick result within the backtest-kit framework, specifically when a strategy is actively monitoring a signal and waiting for a take profit, stop loss, or time expiration. It tells you the strategy is "active" and holding a position.

You'll find details about the signal being monitored, its current price, and the names of the strategy, exchange, and timeframe used. It also provides the trading symbol, like "BTCUSDT".

Crucially, this result includes information about the progress towards the take profit and stop loss, expressed as percentages. You also get the unrealized profit and loss (PNL) for the active position, accounting for fees, slippage, and any partial closes.

The interface indicates whether the data comes from a backtest or live trading session and includes a timestamp for when the tick result was generated.

## Interface IStrategySchema

This schema outlines how you define a trading strategy within the backtest-kit framework. Think of it as a blueprint for how your strategy makes decisions. Each strategy needs a unique name to be recognized.

You can add a note to describe your strategy – a helpful reminder for yourself or anyone else using it.

The `interval` setting controls how often your strategy is checked for signals, preventing it from overwhelming the system.

The core of the strategy is the `getSignal` function. This function takes a symbol (like AAPL) and a date/time, and then calculates whether to generate a buy or sell signal.  It can even be configured to delay execution until a specific price is reached.

You have the option to define callbacks for important events like when a trade is opened or closed.

For more sophisticated risk management, you can associate risk profiles with your strategy.  You can even specify multiple risk profiles if your strategy requires it.

Finally, you can assign action identifiers to your strategy, helping to categorize and track its behavior.

## Interface IStrategyResult

This interface represents the output of a trading strategy after it's been tested. Think of it as a single row in a comparison table showing how different strategies performed. Each result entry includes the name of the strategy, a detailed breakdown of its performance statistics—like profit, drawdown, and win rate—and a numerical score representing how well it optimized against a chosen metric. This metric value helps you rank and compare strategies to see which ones are performing the best.

## Interface IStrategyPnL

This interface represents the profit and loss (PnL) outcome for a trading strategy. It gives you a clear picture of how your strategy performed, taking into account typical trading costs. 

The `pnlPercentage` tells you the overall profit or loss as a percentage of your initial investment – a positive number means you made money, and a negative one means you lost.

You’ll also find the `priceOpen` and `priceClose` values, which are the actual prices at which your trades were entered and exited, respectively. Importantly, these prices have already been adjusted to factor in both fees (set at 0.1%) and slippage (also 0.1%). This gives you a more realistic view of your strategy's performance by showing you the prices you effectively paid and received.

## Interface IStrategyCallbacks

This interface provides a way to hook into key moments within your trading strategy’s lifecycle. Think of them as notification points that let you react to what's happening with your signals.

You can respond to every market tick with the `onTick` callback, receiving the tick result.  `onOpen` is triggered when a new signal is successfully validated and initiated. `onActive` signals that a signal is being monitored, while `onIdle` lets you know when there are no active signals.  When a signal finally closes, `onClose` provides the closing price.

For signals that aren't entered immediately, `onSchedule` occurs when a scheduled signal is created, and `onCancel` happens if a scheduled signal is cancelled.  `onWrite` is used for persisting data, particularly helpful in testing scenarios.

The callbacks `onPartialProfit`, `onPartialLoss`, and `onBreakeven` notify you about intermediate states – when a signal is showing a partial gain or loss, or when the stop-loss has been adjusted to breakeven. Finally, `onSchedulePing` and `onActivePing` offer minute-by-minute updates on scheduled and active signals, respectively, giving you the opportunity for dynamic monitoring and adjustments.

## Interface IStrategy

This interface defines the core actions a trading strategy must perform within the backtest-kit framework.

The `tick` method represents a single execution step for the strategy, handling signal generation and price target (TP)/stop-loss (SL) checks.  `getPendingSignal` and `getScheduledSignal` allow you to retrieve currently active signals – handy for monitoring TP/SL or time expiration.  `getBreakeven` determines if the price has moved enough to cover transaction costs.

`getStopped` indicates if the strategy is paused.  `backtest` is for quickly evaluating the strategy’s performance on past data.

`stopStrategy` halts signal generation, while `cancelScheduled` and `activateScheduled` manipulate scheduled orders without affecting existing positions. `closePending` allows you to manually close an active trade.

`partialProfit` and `partialLoss` let you close portions of a trade at profit or loss levels.  `trailingStop` adjusts the stop-loss to protect profits. `trailingTake` is similar but manages the take-profit level.  `breakeven` moves the stop-loss to the entry price once a certain profit threshold is reached. Finally, `dispose` cleans up resources when the strategy is no longer needed.  Each method often includes validations to prevent errors and ensures the strategy functions reliably.

## Interface IStorageUtils

This interface defines the basic functions any storage system used with backtest-kit needs to provide. Think of it as the contract for how backtest-kit interacts with different databases or storage solutions. 

It outlines methods for reacting to signal events like when a trade is opened, closed, scheduled, or cancelled, allowing the storage to record these actions. You’ll also find methods to retrieve individual signals by their ID, or to fetch a complete list of all signals currently stored. Essentially, it provides a standard way to manage and access signal data regardless of the underlying storage technology.


## Interface IStorageSignalRowScheduled

This interface describes a signal record that's been scheduled for execution. It's used to track signals that aren't immediately actionable but are planned for a future time. 

The key piece of information is the `status` property, which is always set to "scheduled" for these types of signal records. This clearly identifies them as signals awaiting a specific time to be processed.

## Interface IStorageSignalRowOpened

This interface represents a signal row specifically when a trade is open. It's a simple way to track that a signal has been acted upon and a position is currently held. The `status` property will always be set to "opened", clearly indicating the trade's current state. This is useful for monitoring active positions and managing risk.

## Interface IStorageSignalRowClosed

This interface represents a signal that has been closed, meaning a trade related to that signal has finished. 

When a signal reaches a closed state, it means it has a recorded profit and loss (PNL) value, which is tracked in the `pnl` property. 

The `status` property is always set to "closed" to clearly indicate the signal’s current state. 

Essentially, it's a record of how a signal performed after a trade was executed.


## Interface IStorageSignalRowCancelled

This interface represents a signal row that has been cancelled. It's a simple way to mark a signal as no longer active or valid within your backtesting system. The `status` property will always be set to "cancelled" to clearly indicate the signal's state. Think of it as a flag to say "this signal is done – don't use it anymore."

## Interface IStorageSignalRowBase

This interface, `IStorageSignalRowBase`, provides the foundational structure for how signals are stored within the backtest-kit framework. It ensures that every signal, regardless of its specific status, includes key information about when it was created and last updated.  The `createdAt` and `updatedAt` properties store timestamps, crucial for accurate signal history and analysis. Finally, `priority` helps manage the order in which signals are processed, assigning a timestamped value to ensure consistent handling during both live trading and backtesting.

## Interface ISizingSchemaKelly

This interface defines a sizing strategy based on the Kelly Criterion, a method for determining optimal bet size. It specifies that the sizing method is "kelly-criterion".  You'll also provide a `kellyMultiplier` which controls the aggressiveness of the sizing – think of it as a fraction of the Kelly amount to actually bet.  A smaller multiplier, like the default of 0.25, represents a more conservative approach known as "quarter Kelly," which reduces risk. A higher multiplier will result in larger bet sizes, potentially increasing both profits and losses.

## Interface ISizingSchemaFixedPercentage

This schema defines a simple way to determine your trade size – by consistently risking a fixed percentage of your capital on each trade. The `method` property is always set to "fixed-percentage" to identify this specific sizing approach.  You'll also specify the `riskPercentage`, which represents the portion of your capital you’re comfortable losing on a single trade, expressed as a number between 0 and 100. For example, a `riskPercentage` of 10 means you'll risk 10% of your account on each trade.

## Interface ISizingSchemaBase

This interface defines a foundational structure for sizing strategies within the backtest-kit framework. Every sizing schema will inherit these common properties. 

You'll find a `sizingName` to uniquely identify each sizing configuration, and a `note` field for developers to add clarifying comments.  The `maxPositionPercentage` limits the overall account exposure for a single trade, expressed as a percentage.  Then, `minPositionSize` and `maxPositionSize` set absolute boundaries on the trade size. Finally, `callbacks` allow you to hook into specific points in the sizing process, letting you customize its behavior if needed.

## Interface ISizingSchemaATR

This schema defines how to size your trades using the Average True Range (ATR). It's designed for strategies where you want your position size to be influenced by market volatility.

The `method` is always set to "atr-based" to indicate this specific sizing approach.

`riskPercentage` dictates what portion of your capital you're willing to risk on each trade, expressed as a percentage.  A value of 10 would mean risking 10% of your equity per trade.

`atrMultiplier` controls how the ATR value is used to determine your stop-loss distance, and therefore, your position size. A higher multiplier leads to wider stops and smaller position sizes, while a lower multiplier results in tighter stops and potentially larger positions.

## Interface ISizingParamsKelly

This interface, `ISizingParamsKelly`, helps you configure how much of your capital your trading strategy will use on each trade when you're using the Kelly Criterion sizing method. It focuses on providing a way to log debugging information during the sizing process, which is useful for understanding how your strategy is making decisions about position sizes. The `logger` property allows you to specify a logging service that will record messages about the sizing calculations, helping you troubleshoot and optimize your strategy.

## Interface ISizingParamsFixedPercentage

This interface defines the parameters you'll use when you want your trading strategy to consistently use a fixed percentage of your available capital for each trade. It's designed to be simple: you just need a logger to help you keep track of what's happening. The `logger` property allows you to receive debugging messages from the sizing calculations, which is useful for understanding and troubleshooting your strategy’s behavior. Essentially, it's a basic building block for controlling how much capital you allocate to each individual trade.

## Interface ISizingParamsATR

This interface defines the parameters needed for determining trade sizes using the Average True Range (ATR) method. It's part of the backtest-kit framework and helps you control how much of your capital is allocated to each trade based on ATR volatility. 

You'll find a `logger` property here, which allows you to log debug information related to the sizing calculations. This is useful for monitoring and understanding how your ATR sizing strategy is behaving.

## Interface ISizingCallbacks

The `ISizingCallbacks` interface provides a way to hook into different stages of the position sizing process. Specifically, the `onCalculate` callback allows you to observe and potentially influence the size calculation itself. Think of it as a place to record what sizes are being determined or to double-check that the calculated size makes sense within your trading strategy. You can use this callback to log information or perform validations after the size has been calculated but before the order placement.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate your trade size using the Kelly Criterion. To use it, you’ll need to specify the method as "kelly-criterion", along with your win rate - essentially, the percentage of your trades that are profitable - and your average win/loss ratio, which tells us how much you make on a winning trade compared to how much you lose on a losing one.  These values are key inputs for determining a sizing strategy that aims to maximize long-term growth.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate trade size using a fixed percentage of your portfolio. It tells the backtest-kit how much of your capital to risk on each trade based on a predetermined percentage.

You'll provide a `method` which will always be "fixed-percentage" to indicate you're using this sizing strategy.  Crucially, you also need to define a `priceStopLoss` – this is the price at which your stop-loss order will be triggered, and it's used to determine the appropriate trade size based on your chosen risk percentage.

## Interface ISizingCalculateParamsBase

This interface defines the basic information needed when figuring out how much to trade. It includes the symbol of the asset you're trading, like "BTCUSDT," along with your current account balance and the price at which you plan to enter the trade. Think of it as the foundational data for deciding your position size. Every sizing calculation will use these core values.

## Interface ISizingCalculateParamsATR

This interface defines the information needed to calculate trade sizes using an ATR (Average True Range) based approach.  It requires you to specify that you’re using the "atr-based" method for sizing.  You also need to provide the current ATR value, which represents the average price volatility over a specific period. This value is crucial for determining an appropriate trade size that accounts for market risk.

## Interface ISizing

The `ISizing` interface is all about figuring out how much of an asset to buy or sell. It's a core part of how backtest-kit executes trading strategies, determining the size of each position. The `calculate` property is the heart of this – it's a function that takes some parameters related to risk and returns a number representing the calculated position size. Think of it as the brain deciding how much to invest given certain risk tolerances and market conditions.

## Interface ISignalRow

The `ISignalRow` represents a complete trading signal, automatically assigned a unique ID for tracking throughout the backtesting process. It bundles all the essential information needed to execute a trade, including the entry price, the exchange to use, the strategy that generated it, and the timeframe it applies to.

Each signal includes a timestamp indicating when it was initially created and when the position became pending.  You'll find details about the trading pair (like "BTCUSDT"), and flags to indicate if the signal was scheduled in advance.

The `_partial` property is particularly useful for tracking partial profit or loss events during a trade’s lifecycle, which helps accurately calculate performance metrics. It details how much of the position was closed at what price and for what gain or loss.

Finally, `_trailingPriceStopLoss` and `_trailingPriceTakeProfit` are advanced features that dynamically adjust stop-loss and take-profit levels, respectively, based on price action. These replace the originally set stop-loss and take-profit prices for execution purposes.


## Interface ISignalDto

This describes the data structure used to represent a trading signal within the backtest-kit framework. Think of it as a standardized way to communicate what a signal should do – whether to buy or sell, at what price, and with what goals in mind. Each signal includes a unique identifier, the direction of the trade (long or short), a description of why the signal was generated, the entry price, and target prices for taking profit and limiting losses. It also allows you to estimate how long the signal is expected to be active before needing reassessment. If you don't provide an ID when creating a signal, the system will automatically assign one.

## Interface IScheduledSignalRow

This interface, `IScheduledSignalRow`, describes a signal that’s waiting for a specific price to be reached before a trade is executed. Think of it as a signal on hold – it's not active yet. It builds upon the basic `ISignalRow` and adds the concept of a target price. 

The `priceOpen` property defines that target price; the trade won’t happen until the market price hits this level.  Until the trade is actually triggered, a timestamp called `scheduledAt` records when the signal was initially scheduled. Once the market price reaches `priceOpen`, this `scheduledAt` value acts as a placeholder for the actual "pending" time.

## Interface IScheduledSignalCancelRow

This interface represents a scheduled trading signal that can be cancelled by the user. It builds upon the standard scheduled signal information, but adds a unique identifier, `cancelId`, which is only present when a user has specifically requested that the signal be cancelled. Think of it as a way to track user-driven cancellations within the scheduling system. This `cancelId` allows the system to differentiate between signals that expire naturally and those that are cancelled by a user action.

## Interface IRiskValidationPayload

This interface, `IRiskValidationPayload`, provides all the information needed when you’re performing risk checks within backtest-kit. Think of it as a package containing the current trading signal and a snapshot of your portfolio's situation. It includes the `currentSignal` which represents the signal you're currently evaluating, alongside details about your active positions.  You'll also find the `activePositionCount`, a simple number of open positions, and `activePositions`, a detailed list describing each active trade. This comprehensive data allows for informed risk assessments at each step of your trading process.

## Interface IRiskValidationFn

This defines the structure for functions that check if a trade is safe to execute, based on your risk management rules. Think of it as a gatekeeper for your trades. If the function approves the trade, it simply does nothing or returns nothing. If it finds a problem, it either throws an error or returns a specific result object explaining why the trade is being rejected. This allows you to clearly communicate validation failures to the backtest system.

## Interface IRiskValidation

This interface helps you define how to check if your risk parameters are valid. Think of it as setting up rules to make sure your trading strategy is safe and sound. 

You specify the actual validation logic using the `validate` property, which is a function that performs the checks.  The `note` property is a place to add a friendly explanation of what the validation is doing – it's like a little comment for yourself or others to understand the rule.

## Interface IRiskSignalRow

This interface, `IRiskSignalRow`, helps manage risk during trading by providing key information about a trade. It builds upon the `ISignalDto` to include the entry price (`priceOpen`) and the initially set stop-loss (`originalPriceStopLoss`) and take-profit (`originalPriceTakeProfit`) levels.  Essentially, it allows the system to double-check risk parameters against the initial signal data, ensuring things like stop-loss and take-profit levels haven't drifted too far from their original values. You'll find it used primarily in the risk validation processes within the backtest kit.


## Interface IRiskSchema

This interface, `IRiskSchema`, lets you create and manage custom risk controls for your trading portfolio. Think of it as a blueprint for defining how your portfolio will react to certain conditions – like maximum position size or drawdown limits. 

Each risk schema has a unique identifier, `riskName`, which helps you keep track of it. You can also add a `note` to explain what the risk schema does. 

It also allows you to define callbacks – `callbacks` – that trigger specific actions when a trade is rejected or allowed. 

The heart of the schema is the `validations` array, where you specify the actual rules that your portfolio will follow. These validations are functions or objects that check trade conditions and determine whether a trade should be executed.


## Interface IRiskRejectionResult

This interface, `IRiskRejectionResult`, pops up when your trading strategy's risk checks fail. Think of it as a detailed explanation of *why* something didn't pass the validation. It includes a unique `id` to help you pinpoint the specific rejection event and a helpful `note` that describes the reason in plain language, making it easier to understand and fix the problem. This allows for clear debugging and troubleshooting of your backtesting setup.

## Interface IRiskParams

The `IRiskParams` object helps configure how your trading system manages risk. Think of it as a set of instructions passed when you start up the risk management part of your system.

It includes essential details like the name of the exchange you’re working with, a logger to help you track what’s happening, and whether you're in a testing (backtest) environment or live trading mode. 

Crucially, it defines an `onRejected` callback. This function gets triggered when a trading signal is blocked because it hits a risk limit – giving you a chance to understand why and potentially react before the system takes further action.

## Interface IRiskCheckArgs

This interface, `IRiskCheckArgs`, provides the data needed to assess whether a new trade should be allowed. Think of it as a gatekeeper, consulted *before* a trading signal is actually generated. It bundles together information from your trading strategy's environment, like the trading pair (symbol), the signal being considered, the strategy's name, the exchange being used, a risk identifier, the timeframe being analyzed, the current price, and the current time. Essentially, it’s a snapshot of the conditions surrounding a potential trade, enabling risk checks to ensure trading rules are followed.

## Interface IRiskCallbacks

This interface defines optional functions that your trading strategies can use to react to risk assessments. Think of it as a way to be notified when a trade is blocked due to risk limits, or conversely, when a trade is approved to proceed.

The `onRejected` function is triggered when a trade is prevented because it hits a defined risk threshold.  You can use it to log these rejections, adjust strategy behavior, or alert someone.

The `onAllowed` function is called when a trade successfully passes all risk checks and is clear to execute. This can be useful for tracking approved trades or triggering specific actions based on their allowance.


## Interface IRiskActivePosition

This interface describes a single trading position that's being actively managed, and is used by the risk management system to keep track of what's happening across different trading strategies. It holds key details about the position, including the name of the strategy that opened it, the exchange used, the trading symbol (like BTCUSDT), and whether it’s a long or short position. 

You’ll also find information like the entry price, stop-loss levels, and take-profit targets, along with an estimated holding time and a timestamp marking when the position was initiated. Essentially, this interface gives you a snapshot of a position's critical details for risk assessment and cross-strategy analysis.


## Interface IRisk

This interface helps manage and enforce risk rules when trading. It’s designed to make sure your trading strategies don't take on more risk than you're comfortable with.

You'll use `checkSignal` to see if a potential trade aligns with your defined risk parameters.  Think of it as a gatekeeper for your signals.

`addSignal` lets you register a new position you've taken, which allows the system to track it and monitor its risk profile. 

Finally, `removeSignal` is used when a position is closed, updating the system's records and freeing up resources.

## Interface IReportTarget

This interface lets you fine-tune what information gets logged during your backtesting sessions. Think of it as a checklist to control the level of detail you want to see. You can turn on or off logging for specific areas like strategy execution, risk management, breakeven points, partial trades, performance metrics, and even live trading events. This allows you to focus on the data most relevant to your analysis and keep your logs manageable. Each property, like 'strategy' or 'risk', is a simple boolean – either true to enable logging or false to disable it.

## Interface IReportDumpOptions

This interface defines the information used when exporting report data. Think of it as a container for labels and identifiers that help you organize and search through your backtesting results. It includes details like the trading pair (symbol), the name of the strategy you ran, the exchange used, the timeframe, a unique signal ID, and the name of the optimization walker.  By providing these values, you can easily filter and pinpoint specific backtest runs within your reports.

## Interface IPublicSignalRow

The `IPublicSignalRow` interface is designed to provide external access to important signal details, particularly the initial stop-loss and take-profit prices. It builds upon the existing `ISignalRow` to display the original values users set when a trade signal was created. 

Even if your trading strategy uses trailing stop-loss or take-profit adjustments, these original values are preserved and shown, giving users a clear view of the initial trade parameters. 

You'll find the `originalPriceStopLoss` and `originalPriceTakeProfit` properties, which represent those initial stop-loss and take-profit levels respectively.

Finally, the `partialExecuted` property lets you track the percentage of a position that's been closed out through partial closing operations, useful for understanding how much of a trade has already been realized.

## Interface IPublicAction

The `IPublicAction` interface defines how custom action handlers work within the backtest-kit framework. Think of it as a blueprint for components that react to events during a trading simulation.

When you create a custom action handler, it gets a chance to set itself up using the `init` method. This is where you'd do things like connect to a database, set up a notification system, or load any resources the handler needs.  

After initialization, the action handler will receive different event signals like when a trade hits its breakeven point or when a partial profit is taken.  You can build logic to respond to these signals. 

Finally, when the simulation is complete, the `dispose` method is automatically called to clean everything up – closing connections, flushing buffers, ensuring a tidy shutdown. The framework guarantees this cleanup happens just once. 

This interface allows you to extend the backtest-kit framework with features like managing state, sending notifications, tracking custom events, collecting analytics, or integrating with external systems.

## Interface IPositionSizeKellyParams

The `IPositionSizeKellyParams` interface helps you calculate position sizes using the Kelly Criterion, a method for determining how much of your capital to risk on each trade. 

It defines the essential information needed for this calculation.  You'll provide two key values: `winRate`, representing the percentage of your trades that are successful, and `winLossRatio`, which describes the average profit compared to the average loss on your winning trades.  These parameters allow the framework to automatically adjust your position size based on your historical performance.

## Interface IPositionSizeFixedPercentageParams

This defines how to calculate your position size when using a fixed percentage sizing strategy. You'll specify a `priceStopLoss` which acts as the level where you'll place your stop-loss order. This value helps determine the initial size of your trade based on a percentage of your available capital, ensuring your risk is managed appropriately.

## Interface IPositionSizeATRParams

This interface defines the parameters needed to calculate position sizes using the Average True Range (ATR) method. Specifically, it contains a single property, `atr`, which represents the current ATR value. This value is crucial for determining how much capital to allocate to a trade based on the asset's volatility. Think of it as a key input for scaling your trade size proportionally to how much the price typically fluctuates.

## Interface IPersistBase

This interface lays out the basic building blocks for how your custom storage solutions interact with the backtest-kit framework. Think of it as a contract – if you want to plug in your own database or file system, you'll need to implement these methods. 

It provides functions for initializing your persistence layer, reading data, checking if data exists, writing data, and listing all the identifiers of the data you're storing. The `waitForInit` method makes sure initialization and validation happen only once. The `keys` method gives you a way to go through all of your data identifiers, sorted in a predictable order, which is useful for things like verifying consistency.

## Interface IPartialProfitCommitRow

This interface describes a specific instruction to take a partial profit on a trade. Think of it as a single step in a plan to close out a portion of your position. 

It tells the backtesting system to close a certain percentage of your holding. 

The `action` property confirms that this is a partial profit instruction. You'll specify the `percentToClose` - the amount of your position you want to close, represented as a percentage. Finally, `currentPrice` records the price at which this partial profit was actually executed during the backtest.


## Interface IPartialLossCommitRow

This interface describes a request to partially close a position, essentially telling the system to sell a portion of your holdings. 

It includes the action type, which is always "partial-loss" to identify it as a partial closing request.

You'll also specify the `percentToClose`, representing what percentage of the position you want to sell. Finally, `currentPrice` records the price at which the partial loss was executed.

## Interface IPartialData

This interface, `IPartialData`, represents a small piece of information about a trading signal, designed to be saved and restored later. Think of it as a snapshot of the most important details, specifically the profit and loss levels that have been hit.  It transforms sets of levels into arrays so they can be easily saved as JSON. When the system loads data, this partial information is used to rebuild the complete signal state. Essentially, it's a simplified way to persist the progress of a trading signal.


## Interface IPartial

The `IPartial` interface is responsible for keeping track of how a trading signal is performing, specifically focusing on profit and loss milestones. It's used internally by the framework to monitor signals and notify interested parties when certain levels of profit (like 10%, 20%, 30%) or loss are hit. 

When a signal is making money, the `profit` method is called, which determines if any new profit levels have been reached and sends out notifications. Similarly, when a signal is losing money, the `loss` method works in the same way, tracking loss levels. 

Finally, when a trading signal finishes – whether it hits a target profit, a stop-loss, or simply expires – the `clear` method is invoked. This method cleans up the tracking data, saves any necessary information, and releases resources.

## Interface IParseArgsResult

This interface describes the output you get when you process command-line arguments to configure your trading environment. It bundles together flags that tell the system whether you're running a backtest against historical data, a paper trading simulation using live market data, or actually trading with real money. Think of it as a way to easily see at a glance which mode your trading framework is operating in. The properties `backtest`, `paper`, and `live` are boolean values, simply indicating whether each respective mode is enabled.

## Interface IParseArgsParams

The `IParseArgsParams` interface helps you define the basic settings when running a trading strategy. Think of it as a way to pre-set things like which cryptocurrency pair you're trading (like BTCUSDT), the name of the specific trading strategy you want to use, the exchange you’re connected to (Binance, Bybit, etc.), and the timeframe for the price data (like hourly or daily charts).  It provides a structure for all the key pieces of information needed to get a backtest started. Essentially, you use this to tell the system exactly *what* to trade, *where* to trade it, and *how* frequently to look at the data.

## Interface IOrderBookData

This interface describes the data you receive representing an order book. It tells you the trading symbol the data applies to. You'll also find arrays of bid orders – essentially, the prices buyers are willing to pay – and ask orders, which are the prices sellers are offering. Think of it as a snapshot of what's currently happening in the market for a particular trading pair.

## Interface INotificationUtils

This interface, `INotificationUtils`, serves as a foundation for how your backtest kit interacts with notification systems—like sending alerts or logging events. Any component that wants to send notifications to an external service, such as email, Slack, or a database, will need to implement this interface. 

It defines a set of methods for handling different types of events that occur during a backtest, including when a trade is opened or closed, partial profits or losses become available, or when there are errors.  You’ll find functions for dealing with strategy commitments, risk rejections, and various error scenarios. 

The `getData` method allows you to retrieve all the notifications that have been stored, and `clear` will erase them, essentially cleaning the notification history. Essentially, it's a blueprint for any system that needs to communicate updates and alerts from your backtesting process.

## Interface InfoErrorNotification

This notification lets you know about errors that happened while background tasks were running, but aren't critical enough to stop everything. Each notification has a unique ID so you can track it, plus a detailed error object containing the stack trace and extra information to help you understand what went wrong. You'll also get a clear, human-readable message describing the problem, and the `backtest` flag will always be false because these errors originate from the live trading environment, not a test run.

## Interface IMethodContext

The `IMethodContext` interface is a key piece that helps backtest-kit know which specific configurations to use when running a trading strategy. Think of it as a set of instructions, telling the system exactly which strategy, exchange, and frame definitions apply to the current operation. It carries the names of these configurations – the `exchangeName`, `strategyName`, and `frameName` – allowing the framework to automatically find and use the right components. In live trading, the `frameName` will be empty, indicating that standard live trading configurations should be used.

## Interface IMarkdownTarget

This interface lets you fine-tune what information gets reported during your backtesting process. Think of it as a way to control the level of detail you see in your markdown reports.

You can selectively turn on or off different types of reports, such as tracking strategy signals, risk rejections, breakeven events, partial profits, portfolio heatmaps, strategy comparisons, performance metrics, scheduled signals, live trading events, or comprehensive backtest results. This allows you to focus on the data that's most relevant to your analysis and keep the reports manageable. If you only want to see the core trade signals, you can disable everything else. If you're troubleshooting performance issues, you can enable performance reports.

## Interface IMarkdownDumpOptions

This interface, `IMarkdownDumpOptions`, acts like a container for all the details needed when generating markdown reports. Think of it as a way to specify exactly what information you want included in your reports.  It holds things like the directory where the report should be saved, the filename itself, and crucial details about the trade – like the trading pair (e.g., BTCUSDT), the strategy used, the exchange involved, the timeframe, and even a unique identifier for the signal that triggered a trade.  By providing values for these properties, you can precisely control the content and organization of your backtesting reports.


## Interface ILogger

The `ILogger` interface is your way to keep track of what's happening inside the backtest-kit system. It's like a central record for various components, helping you understand their behavior and troubleshoot any problems.

You can use it to record different types of messages: general events, detailed debug information for development, informational updates about successful actions, and warnings about potential issues. Think of `log` for important events, `debug` for digging into how things work, `info` for confirming things are running smoothly, and `warn` for highlighting something that might need a closer look. These logs are invaluable for debugging, monitoring, and auditing your trading strategies.

## Interface IHeatmapRow

This interface describes the performance data for a specific trading pair, like BTCUSDT, across all strategies being evaluated. It provides a detailed snapshot of how that symbol performed, including overall profit and loss as a percentage.

You’ll find key metrics like the Sharpe Ratio, which measures risk-adjusted return, and the maximum drawdown, indicating the biggest potential loss. The interface also breaks down trade statistics: total trades, win/loss counts, win rate, and average profit/loss per trade. 

For a deeper analysis, it includes information like standard deviation, profit factor, average win and loss amounts, and the longest win and loss streaks. Finally, expectancy is provided which gives an idea of the expected return per trade. Essentially, this interface presents a comprehensive performance profile for each trading pair in your backtest.

## Interface IFrameSchema

This interface, `IFrameschema`, helps you set up the building blocks of your backtesting environment. Think of it as defining a specific time window and frequency for your historical data. Each `IFrameschema` represents a particular frame, uniquely identified by its `frameName`, and allows you to add a helpful `note` for yourself to remember what it's for. 

You'll specify the data `interval` – like daily, hourly, or minute-by-minute – and clearly mark the `startDate` and `endDate` to cover the period you’re interested in backtesting.  Finally, you can add `callbacks` to hook into the frame's lifecycle for custom logic, though this is optional.

## Interface IFrameParams

The `IFramesParams` interface is what you provide when you’re setting up a new testing environment, essentially telling the system how to behave and where to log information. Think of it as the initial configuration.

It builds upon `IFramesSchema`, which defines the core settings, and adds a `logger` property.

The `logger` is crucial because it allows you to track what’s happening during your backtesting process – useful for debugging and understanding your strategy's performance. It’s your window into the inner workings of the simulation.


## Interface IFrameCallbacks

The `IFrameCallbacks` interface lets you hook into important moments in the backtest framework's timeline creation process. Specifically, you can define a function that's executed after the framework generates a set of timeframes for your backtest. This function, `onTimeframe`, receives details about the generated timeframe array, including the start and end dates and the chosen interval. You can use this to check if the timeframes were generated correctly, record information for auditing, or perform other actions based on the created timeframe data.

## Interface IFrame

The `IFrames` interface is a core part of how backtest-kit organizes and manages time data for your trading simulations. Think of it as the engine that provides the sequence of dates and times your backtest will run against.

Its primary function is to create these time sequences.  You tell it which asset (like a stock ticker) and timeframe (like "daily" or "hourly") you're interested in, and it returns an array of dates representing those points in time.  This array is then used by other parts of the backtest framework to simulate trading actions at each point in time. Essentially, it delivers the timeline for your backtesting experiments.

## Interface IExecutionContext

The `IExecutionContext` object is like a little package of information passed around during your trading strategy's execution. It holds key details needed for things like fetching historical data, handling incoming ticks, or running a backtest.  Essentially, it provides context for your code.

You'll find the trading symbol, like "BTCUSDT," within it, letting your strategy know which asset it's working with. It also includes the current timestamp, which is critical for ordering events and making time-sensitive decisions. Finally, it indicates whether the strategy is running a backtest on historical data or operating in a live trading environment.


## Interface IExchangeSchema

This interface, `IExchangeSchema`, is how you tell backtest-kit about a specific cryptocurrency exchange you want to use. It's essentially a blueprint that defines where to get the historical trading data (candles), how to correctly format quantities and prices according to the exchange’s rules, and optionally, how to retrieve the order book.  You provide a unique name to identify the exchange, and can add a note for your own reference.

The core of the schema is the `getCandles` function, which is responsible for fetching historical price data.  You might also specify functions to format trade quantities and prices to match the exchange's requirements. If you don't provide a way to get the order book, the system won't let you use it.  Finally, there's a place to hook in custom functions that respond to certain events related to data.


## Interface IExchangeParams

This interface defines the necessary configurations for setting up an exchange within the backtest-kit framework. Think of it as a blueprint for how your exchange interacts with the testing environment. It requires you to provide functions that handle fetching historical data (candles), formatting trade quantities and prices to match the exchange’s rules, and retrieving order book information. A logger is also crucial for debugging and understanding what’s happening during backtesting. The system needs to know the current symbol, date and time, and whether it's running in backtest mode to operate correctly.

## Interface IExchangeCallbacks

This interface lets you listen for updates about candlestick data coming from an exchange. If you want to react to new candle data being received – maybe to update a visualization or trigger some logic – you can provide a function here. The function will be called with details like the symbol (e.g., "BTCUSDT"), the time interval (like 1 minute or 1 hour), the time range of the data, the number of candles received, and an array of actual candlestick data points. You can either use a standard function or a function that returns a promise.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with different cryptocurrency exchanges. It allows you to retrieve historical and future candlestick data, essential for simulating trading strategies. You can fetch candles going back in time, look ahead to get future candles (useful for backtesting), and format order quantities and prices to match the exchange’s requirements. 

The framework also provides a convenient way to calculate the Volume Weighted Average Price (VWAP) based on recent trades.  You can also request the order book to see current buy and sell orders.  

Retrieving raw candle data is flexible, letting you specify date ranges and limits to customize your historical data requests, always ensuring the data respects the execution context’s timeline to prevent inaccurate simulations.

## Interface IEntity

This interface, `IEntity`, serves as the foundation for any data that gets saved and retrieved within the backtest-kit framework. Think of it as a common starting point that ensures all persistent objects have a consistent structure. It’s a promise that anything implementing this interface will be something you can reliably store and load.

## Interface ICommitRowBase

This interface, `ICommitRowBase`, provides a foundational structure for events that need to be processed later, like when a trade is executed. Think of it as a way to hold information about a trade—specifically, which asset pair (`symbol`) it involves and whether the process is a simulation (a `backtest`). It’s designed to ensure that this trade information isn't immediately acted upon, but rather waits for the right moment within the trading system.


## Interface ICandleData

This interface defines the structure of a single candlestick, which is a fundamental building block for analyzing price data. Each candlestick represents a specific time period and contains key information about the trading activity during that time. You’ll find the exact time the candle began, the opening price, the highest and lowest prices reached, the closing price, and the total trading volume for that period all neatly organized here. This structure is essential for calculations like VWAP and running backtests to evaluate trading strategies.

## Interface IBreakevenData

This interface, `IBreakevenData`, is designed to make it easy to save and load breakeven information. Think of it as a simplified snapshot of whether a breakeven point has been hit for a particular trading signal. It's used to store this data persistently, like in a file or database, and later reconstruct the full breakeven state when your backtesting system starts up.  The `reached` property is the main piece of information – a simple true/false value indicating if the breakeven condition was met.

## Interface IBreakevenCommitRow

This interface represents a record of a breakeven commitment that's been added to a queue. It contains information about the action taken, which is always "breakeven" in this context. Crucially, it also stores the price at which the breakeven point was calculated, giving you a snapshot of the market conditions at that time. Think of it as a log entry showing when and at what price a breakeven goal was established.

## Interface IBreakeven

This interface helps track when a trade's stop-loss should be moved to breakeven, essentially protecting your investment. It's used by systems that manage trading signals and keep track of their performance.

The `check` method is the core of the process – it evaluates if the price has moved favorably enough to justify moving the stop-loss to the entry price, considering transaction costs.  This happens during the trading process, as the strategy monitors the signal.

The `clear` method handles the cleanup when a trade is finished, whether it hits a profit target, a stop-loss, or its time expires. It resets the breakeven tracking for that specific trade and saves that change.

## Interface IBidData

This describes a single bid or ask price found within an order book. Each bid or ask is represented by an `IBidData` object. 

It contains two key pieces of information: the `price` at which the order is placed, and the `quantity` of the asset available at that price. Both price and quantity are stored as strings.

## Interface IActivateScheduledCommitRow

This interface represents a queued request to activate a scheduled commit within the backtest-kit framework. Think of it as a message telling the system to trigger a pre-planned action. 

It includes the action type, always "activate-scheduled", along with the unique identifier of the signal involved.  Sometimes, there’s also an activation ID provided, which can be useful when activations are explicitly requested by a user. Essentially, it’s a way to programmatically kick off a scheduled process.

## Interface IActionSchema

This describes how you can extend and customize the backtest-kit trading framework's behavior. Actions are a powerful way to hook into the core execution loop of a strategy, letting you add your own logic for things like logging, managing state, or triggering external notifications.

Think of actions as little helpers that listen for events happening within your trading strategy. You can register these helpers using a unique name, add notes for your own documentation, and provide either a constructor function to create the helper, or directly provide the helper itself. 

Furthermore, you have the option to set up specific callbacks that run at different points in the action’s lifecycle, allowing for fine-grained control and responsiveness. Multiple actions can work together within a single strategy, offering a flexible way to build sophisticated trading systems.

## Interface IActionParams

The `IActionParams` interface holds all the information an action needs when it's being executed. Think of it as a package deal – it includes not only the action's basic setup (like what it's supposed to do), but also details about where and when it’s running.  You'll find a logger here to help you track what’s happening during the action, the name of the strategy and timeframe it's part of, and whether it’s running in a backtesting environment. It's like giving the action a complete context to work within. The exchange name, like "binance," is also included to specify where trades will be executed.

## Interface IActionCallbacks

This interface provides a way to hook into different stages of an action handler's lifecycle within the backtest-kit framework. Think of it as a set of customizable event listeners that allow you to react to specific events happening during trading, whether it’s a backtest or live trading. You can use these callbacks to manage resources, log events, or persist data.

Here's a breakdown of what each callback does:

*   **onInit:**  Called when the action handler starts up, giving you a chance to initialize things like database connections or load any necessary data.
*   **onDispose:** Called when the action handler is shut down, allowing you to clean up resources, save data, or unsubscribe from any subscriptions.
*   **onSignal:** This is a general event fired whenever a signal is generated – it’s useful for tracking signals regardless of whether you're backtesting or trading live.
*   **onSignalLive:** Specifically triggered for live trading signals.
*   **onSignalBacktest:** Specifically triggered during backtesting.
*   **onBreakevenAvailable:** Notified when a breakeven trigger is met – when your stop-loss is automatically moved to your entry price.
*   **onPartialProfitAvailable:**  Signals when a partial profit level is reached (e.g., 10%, 20% profit).
*   **onPartialLossAvailable:** Signals when a partial loss level is reached (e.g., -10%, -20% loss).
*   **onPingScheduled:**  Informs you when a scheduled signal is being monitored, typically while waiting for activation.
*   **onPingActive:** Informs you when an active pending signal is being monitored, during a live position.
*   **onRiskRejection:**  Alerts you when a signal has been rejected by the risk management system.

## Interface IAction

This interface, `IAction`, is your central hub for managing what happens when your trading strategy generates signals or encounters specific events. Think of it as a place to plug in your own custom logic.

It provides a set of methods, each responding to a different type of event – like a signal being generated, a breakeven point being reached, or a partial profit level being triggered. These methods allow you to connect your backtest-kit framework to external systems.

You can use these methods to do things like dispatch actions to a Redux store, log events, build dashboards, or gather data for analysis.  There are separate methods for handling signals during live trading versus backtesting, giving you granular control.  Importantly, a `dispose` method is included to properly clean up and unsubscribe when you're finished with the action handler.

## Interface HeatmapStatisticsModel

This model holds all the key data for displaying a portfolio heatmap, giving you a snapshot of how your investments are performing. It organizes information about each individual symbol you're tracking, along with overall portfolio metrics. You'll find details like the total number of symbols in your portfolio, the overall profit and loss (P&L), and the Sharpe Ratio, which indicates risk-adjusted return. It also includes a count of the total number of trades executed across your entire portfolio.

## Interface DoneContract

This interface lets you know when a background task, either in a backtest or live trading environment, has finished running. It provides details about the completed task, including the exchange used, the name of the trading strategy, and whether it was a backtest or live execution. You’ll find key information like the trading symbol, ensuring you can track which asset was involved. The `frameName` property will be empty when running in live mode, which is useful for distinguishing between backtest and live scenarios.

## Interface CriticalErrorNotification

This notification signals a really serious problem within the backtest kit – something so critical that the process needs to stop immediately. It's designed to help you understand exactly what went wrong. 

Each notification has a unique ID to help track issues, and includes a detailed error object containing a stack trace and other helpful information for debugging. You'll also find a clear, human-readable message explaining the problem. 

Importantly, this type of error always indicates a problem outside of the backtesting environment itself, so the `backtest` property will always be false.

## Interface ColumnModel

This interface helps you define how data will be presented in a table, like when generating reports. Think of it as a blueprint for each column you want to display. 

You'll specify a unique `key` for each column, a `label` that users will see in the header, and a `format` function to transform the raw data into a readable string.

Finally, you can control visibility with an `isVisible` function, allowing you to conditionally show or hide columns based on certain conditions. This gives you fine-grained control over what's displayed.

## Interface ClosePendingCommit

This event signals that a previously submitted order or action needs to be cancelled or closed. It’s used to finalize or reverse a pending operation within the backtest. 

The `action` property confirms this is a "close-pending" request.

You can also include a `closeId` to provide a custom identifier, useful for tracking why the pending action was closed, like a user-provided reason or a specific system code. This identifier is optional but helps with debugging and auditing.

## Interface CancelScheduledCommit

This interface lets you cancel a previously scheduled signal event within the backtest-kit framework. Think of it as a way to undo a planned action. The `action` property is fixed and identifies this as a cancellation request.  You can also include a `cancelId`, which is essentially a note or identifier you provide to explain why you're canceling—helpful for tracking purposes.

## Interface BreakevenStatisticsModel

This model helps you understand how often breakeven points are occurring during your backtesting. It keeps track of each individual breakeven event, giving you a detailed list to examine. You'll also find a simple count of the total number of breakeven events that happened, providing a quick overview of their frequency. This information is useful for assessing the risk and potential reward of your trading strategies.

## Interface BreakevenEvent

This data structure helps you understand when a trade has reached its breakeven point, which is the price where you're neither making nor losing money. It gathers all the relevant details about that moment, like the exact time, the trading symbol involved, the strategy that generated the signal, and the signal's unique identifier. 

You’ll find information like the entry price, take profit target, stop loss levels, and even the original prices set when the trade was initially planned.  It also tracks things like partial executions and a descriptive note explaining the reasoning behind the signal. Plus, it tells you when the position became active, when the signal was created, and whether the trade is part of a backtesting simulation or a live trade.

## Interface BreakevenContract

This interface represents a breakeven event, which occurs when a trading signal's stop-loss is moved back to the original entry price. It's a way to track when a trade has reduced its risk – essentially, the price has moved favorably enough to cover transaction costs. These events are unique to each signal and aren’t repeated.

The event includes key details like the trading symbol (e.g., BTCUSDT), the name of the strategy that generated the signal, the exchange and frame being used, and all the original signal data. You’ll also find the current price at which breakeven was achieved and whether the event came from a backtest or a live trade. Finally, it records the exact time the breakeven occurred, which differs slightly between live and backtest scenarios. This information is helpful for generating reports and providing feedback to users.

## Interface BreakevenCommitNotification

This notification tells you when a breakeven action has been taken, essentially confirming that a trade has reached a point where it's no longer at a loss. It includes a unique ID and timestamp to track when this event occurred, and lets you know if it's happening during a backtest or in a live trading environment.

The notification also provides details about the trade itself, like the symbol being traded, the name of the strategy responsible, and the exchange where the action took place. You'll find key pricing information, including the entry price, original and adjusted take profit/stop loss levels, and the current market price at the time of the breakeven. Finally, timestamps related to the signal’s lifecycle – when it was created, when it went pending – help you understand the trade’s history.

## Interface BreakevenCommit

This interface describes what happens when a trade reaches a breakeven point. It tells you the specific details about the trade at that moment, including whether it was a long (buy) or short (sell) position. You’ll find the current market price, the original entry price, and the prices for both the take profit and stop loss orders – both their original values and how they've changed if trailing was used. The data also includes timestamps to track when the breakeven event was scheduled and when the position was initially activated.

## Interface BreakevenAvailableNotification

This notification lets you know when a trading signal’s stop-loss order can be adjusted to break even – that's the price you initially entered the trade at. It's a helpful signal for managing risk and protecting profits.

The notification provides a wealth of detail, including a unique ID, the exact time it occurred, and whether it's happening in a backtest simulation or a live trading environment. You’ll also find information about the trading pair (like BTCUSDT), the name of the strategy that generated the signal, and details about the current market price, your entry price, and the trade’s direction (long or short).

Furthermore, it includes the original and adjusted take profit and stop-loss prices, allowing you to understand how trailing stop-loss functionality might be affecting your trade, alongside timestamps for signal creation, pending status, and notification creation, offering a complete timeline of the trade's lifecycle.

## Interface BacktestStatisticsModel

This model holds all the key statistical information gathered from a backtest. You'll find a detailed list of every trade that was closed, including its price, profit and loss, and timestamps. It also provides essential summary numbers, like the total number of trades, how many were winners versus losers, and the win rate.

Beyond the basics, you get metrics to assess how well your strategy performs relative to its risk.  Average profit per trade, total cumulative profit, and volatility (standard deviation) are included.  More advanced calculations like the Sharpe Ratio and annualized Sharpe Ratio give a sense of risk-adjusted returns.  Certainty Ratio helps you understand the reliability of winning versus losing trades, and expected yearly returns estimate potential annual gains. Keep in mind that if calculations lead to unreliable or undefined results (like division by zero), those values will be marked as null.

## Interface ActivePingContract

The `ActivePingContract` helps you keep track of what’s happening with your pending trading signals while they're still active. It’s like a heartbeat signal sent every minute for each pending signal being monitored.

This signal provides key details like the trading pair (`symbol`), the strategy name (`strategyName`), and the exchange (`exchangeName`) involved. You'll also receive the full signal data (`data`) including all the important information like entry price, take profit, and stop loss levels.

Knowing if the signal originated from a backtest (`backtest`) or live trading environment is also included, along with a precise timestamp (`timestamp`).

You can use this information to build custom logic and management systems around your active pending signals, reacting to their status in real-time or during historical analysis. You listen to these events using `listenActivePing()` or `listenActivePingOnce()`.

## Interface ActivateScheduledCommitNotification

This notification tells you when a scheduled trading signal has been activated by the user, letting them execute the trade without waiting for a specific price. It provides a lot of details about the trade, including a unique identifier for the notification itself, when the activation was committed, and whether it's happening in backtest or live mode. You'll also find key information like the trading symbol, the strategy that generated the signal, the exchange involved, and the direction of the trade (long or short).

The notification also includes the entry price, take profit and stop loss prices (both the original values and any adjusted trailing versions), the time the signal was initially created, when it went pending, and the current market price at the time of activation.  The `activateId` is useful if you manually triggered the activation; otherwise, it's optional. It's a comprehensive record of a user-initiated activation of a scheduled trade.

## Interface ActivateScheduledCommit

This interface describes the data needed to activate a trading signal that was previously scheduled. Think of it as telling the system to actually execute a trade based on a plan that was made earlier. You'll provide details like the direction of the trade (buying or selling), the prices at which the trade should be entered, and the take profit and stop loss levels. There's also an optional identifier to help you track why the activation happened, along with the original take profit and stop loss prices before any adjustments. Crucially, you specify the time the signal was initially created and the time the position will now be activated.
