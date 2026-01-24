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

This interface defines the structure of notifications sent when a walker needs to be stopped. Think of it as a signal that a specific trading strategy, running under a particular name, needs to be paused or halted. The signal includes the trading symbol involved, the name of the strategy to stop, and the name of the walker that triggered the stop request. This allows for precise targeting of strategies when multiple are active on the same market.

## Interface WalkerStatisticsModel

The WalkerStatisticsModel helps you understand how different trading strategies performed during a backtest. It's like a report card for your strategies, built on top of the basic WalkerResults. 

Essentially, it gives you a list of strategy results – think of it as a collection of scores and metrics – that you can compare and analyze to see which strategies did the best. This model is particularly useful when you want to present these results in a clear and readable way, especially when using Markdown to create reports.

## Interface WalkerContract

The `WalkerContract` provides updates as your trading strategies are being compared during a backtesting process. Think of it as a progress report, telling you when a strategy finishes its test and how it ranks against the others. Each update includes details like the strategy's name, the exchange and symbol being tested, and key statistics about its performance.

You’ll also see the metric value – a number representing how well the strategy did – along with the metric being optimized, the current best value seen so far, and the name of the strategy currently holding that top spot. Finally, the updates also track how many strategies have been tested and how many are left to go, so you have a good sense of how much longer the comparison will take.

## Interface WalkerCompleteContract

This interface represents the conclusion of a backtesting process within the framework. It's triggered when all the strategies have run and the final analysis is ready.

Think of it as a report card – it tells you which walker (a collection of strategies) was tested, what asset and exchange were used, and the timeframe analyzed. 

You’ll find key details here like the metric used for judging performance (e.g., Sharpe Ratio), the total number of strategies compared, and importantly, which strategy emerged as the best.

The report also includes the specific metric score of the winning strategy and comprehensive statistical details about its performance. It’s a complete package of information about the walker’s results.

## Interface ValidationErrorNotification

This notification lets you know when a validation check during your backtesting or trading strategy execution fails. It's triggered when the risk validation functions encounter a problem and raise an error. 

The notification includes a unique identifier (`id`) to track the specific error, along with a detailed error object (`error`) and a human-readable message (`message`) explaining what went wrong. You'll also find a timestamp (`timestamp`) indicating when the error occurred, and a flag (`backtest`) confirming that the error happened during a backtest. This information is crucial for debugging and understanding why your strategy isn't performing as expected.

## Interface ValidateArgs

This interface, `ValidateArgs`, provides a standard way to check if names you're using are valid within the backtest-kit system. Think of it as a checklist to ensure your configurations are correct.

It defines properties like `ExchangeName`, `FrameName`, `StrategyName`, `RiskName`, `ActionName`, `SizingName`, and `WalkerName`. Each of these properties expects a type `T` that represents an enum – a predefined set of valid values. 

Essentially, when you’re setting up a backtest or other process, you can use this interface to make sure the names you're assigning to exchanges, timeframes, strategies, and other components are recognized by the system, helping to avoid errors and ensure smooth operation.

## Interface TrailingTakeCommit

This describes an event that happens when a trailing take-profit order is triggered. It signals that the price has moved enough to activate the take-profit, and tells you what happened. 

Specifically, the `action` property always confirms this is a "trailing-take" event. The `percentShift` indicates the percentage change from the initial price that caused the order to be executed. Finally, `currentPrice` provides the price at which the take-profit was triggered.


## Interface TrailingStopCommit

This describes the information included when a trailing stop order is triggered. Whenever a trailing stop is activated, an event containing these details is generated. 

The `action` property confirms that the event represents a trailing stop execution. `percentShift` specifies the percentage amount used to calculate the stop price.  Finally, `currentPrice` indicates the price of the asset at the time the trailing stop was executed.

## Interface TickEvent

This interface, `TickEvent`, provides a standardized way to represent all kinds of events that happen during a trading backtest. It's a central data structure for generating reports and analyzing performance.

Each `TickEvent` includes a timestamp to indicate when it occurred, and an `action` field clarifies what kind of event it is – whether it’s an initial setup, a trade in progress, or a completed order.  You’ll find details like the trading symbol, a unique signal ID, and the position type (long or short).

For trades that are active or have been closed, there's additional information such as entry prices, take profit and stop loss levels (including their original values before any adjustments), and metrics like percentage progress towards take profit and stop loss.  If a trade is closed or cancelled, the reason is also recorded. Finally, the duration of a closed trade is tracked in minutes. This unified structure makes it easier to track and understand the sequence of events within your backtest.

## Interface StrategyStatisticsModel

This model holds a collection of statistics gathered while running a trading strategy. Think of it as a scorecard for your strategy's actions. 

It keeps track of how many times your strategy triggered different events, like canceling scheduled orders, closing pending orders, or taking partial profits or losses. 

You'll find a detailed list of every event in the `eventList` property, alongside the total number of events recorded. 

Specifically, it breaks down the counts for actions like setting trailing stops, trailing take profits, and setting breakeven orders, offering a comprehensive view of your strategy's behavior.

## Interface StrategyEvent

This data structure, `StrategyEvent`, holds all the key information about what's happening with your trading strategy. Think of it as a record of every significant action taken, whether it's a buy, sell, or modification of a trade. 

Each event includes details like the exact time it occurred, the trading pair involved (symbol), the name of the strategy, and the exchange being used.  For backtesting, it also specifies the frame being analyzed and indicates whether the action happened during a live trade or a historical backtest. 

The `action` property specifies precisely what took place - like opening, closing, or canceling a position - and related information, such as price, percentages for profit taking or trailing stops, and unique IDs for scheduled or pending actions.  A `createdAt` field provides a timestamp of when the action was initially created within the strategy.

## Interface SignalScheduledNotification

This notification tells you when a trading signal is planned for execution in the future. It's like a heads-up that a trade is going to happen, but not right away.

You'll receive this notification when backtest-kit schedules a signal. It provides a lot of important details:

*   A unique identifier (`id`) for the scheduled signal.
*   The exact `timestamp` when the signal was originally generated.
*   Indicates whether this notification relates to a backtest (`backtest`).
*   The `symbol` being traded (e.g., AAPL, BTCUSD).
*   The name of the `strategyName` that generated the signal.
*   The `exchangeName` where the trade will take place.
*   The `signalId` to reference the original signal.
*   Whether the signal represents a `position` to go long or short.
*   The `priceOpen` at which the signal was triggered.
*   The `scheduledAt` timestamp, which is the precise time the trade will be executed.
*   The `currentPrice` at the time the signal was scheduled.

Essentially, this notification provides a comprehensive snapshot of a future trade event.

## Interface SignalOpenedNotification

This notification lets you know when a new trading position has been initiated within the backtest kit. It provides all the essential details about this new position, like a unique identifier and timestamp, confirming whether it’s part of a backtest run. You'll find information about the symbol being traded, the name of the strategy that triggered the trade, and the exchange being used. The notification also specifies if the position is a long or short, along with the opening price, take profit price, stop loss price, and any notes associated with the trade. Having this data allows you to monitor and analyze your trading strategies in real-time.

## Interface SignalData$1

This `SignalData` object holds all the key details about a completed trading signal. Think of it as a record of a single trade – it tells you which strategy created the signal, assigns it a unique ID, and specifies what was traded (the symbol and whether it was a long or short position). You'll find important performance metrics here too, like the percentage profit or loss (`pnl`) and a note explaining why the signal was closed. Finally, it tracks the exact times when the signal was opened and closed, allowing for a complete timeline of the trade.

## Interface SignalCommitBase

This describes the fundamental information shared by all signal commitment events within the backtest-kit framework. Every time a trading strategy generates a signal, this base structure ensures consistent tracking of key details.  You’ll find the trading symbol involved, the name of the strategy that produced the signal, and the exchange it's operating on.  The `frameName` indicates the timeframe the signal is based on (like 1-minute, 1-hour, or daily). Finally, `backtest` confirms whether the signal was generated during a backtesting simulation or live trading.

## Interface SignalClosedNotification

This notification is sent when a trading position, triggered by a signal, has been closed, whether that's because a take profit or stop loss was hit. It provides detailed information about the closure, including the signal's ID, the symbol traded, the name of the strategy used, and the exchange involved. You'll find the time of the event, whether it occurred during a backtest, the opening and closing prices, and the percentage profit or loss realized.  The notification also specifies the position type (long or short), the reason for closing the position, how long the position lasted, and any associated notes. Essentially, it’s a comprehensive log entry for when a trade is finished.

## Interface SignalCancelledNotification

This notification lets you know when a signal that was planned to trigger has been cancelled before it actually happened. It provides details about the cancellation, including a unique ID for the signal, the timestamp of the cancellation, and whether it occurred during a backtest. 

You'll also find information about the symbol and strategy involved, the exchange used, the intended position (long or short), and a reason why the signal was cancelled. A cancel ID and duration are included for further tracking and analysis. Essentially, this notification gives you a clear picture of why a signal didn’t execute as originally scheduled.

## Interface ScheduleStatisticsModel

The `ScheduleStatisticsModel` gives you a clear picture of how your scheduled signals are performing. It keeps track of every event – when signals are scheduled, activated, or cancelled – providing detailed information in the `eventList`. You'll see the total number of signals at each stage, plus key metrics like the cancellation rate (how often signals are cancelled) and the activation rate (how often they’re activated).  It also calculates average waiting times for both cancelled and opened signals, helping you identify potential bottlenecks or inefficiencies in your scheduling process. By analyzing these stats, you can fine-tune your strategies and improve their overall effectiveness.

## Interface SchedulePingContract

This interface defines what information is shared when a scheduled signal is actively being monitored. Think of it as a regular "heartbeat" sent every minute while a signal is running, letting you know it's still active. 

Each heartbeat contains details like the trading pair (symbol), the name of the strategy using the signal, and the exchange involved.  You’ll also get the full data associated with the signal, including things like entry price and stop-loss levels.

A key piece of information is whether the signal is being monitored in a backtest (historical data) or live trading mode. Finally, a timestamp shows exactly when the heartbeat was generated, useful for precise timing and tracking. You can use this information to build custom logic for monitoring or potentially even automatic cancellation of signals.

## Interface ScheduledEvent

This interface bundles all the details about scheduled, opened, and canceled trading signals into one convenient place, primarily for creating reports. Each scheduled event, whether it’s initially planned, actively trading, or ultimately cancelled, will have this data structure associated with it. 

You’ll find core information like when the event occurred (`timestamp`), what action was taken (`action`), and what asset was traded (`symbol`).  It also includes identifiers like `signalId` and `position` type. 

For signals, you'll see pricing details – the planned entry price (`priceOpen`), take profit (`priceTakeProfit`), and stop loss (`priceStopLoss`) levels, plus their original values before any adjustments.  If a signal is closed, a `closeTimestamp` and `duration` will be present.

Canceled signals have additional fields to explain why they were cancelled, such as a `cancelReason` (timeout, price rejection, or user action), and a unique `cancelId` for user-initiated cancellations. A `totalExecuted` property tracks how much of the signal was closed out. Lastly, a `note` field provides an opportunity for additional context about the signal.

## Interface RiskStatisticsModel

This model holds data about risk events, helping you understand and monitor your risk management system. It keeps track of every risk rejection, providing a detailed list of each event. You can easily see the total number of rejections that occurred, and break them down further to understand which symbols or strategies are triggering the most rejections. This breakdown lets you pinpoint areas where adjustments to your risk controls might be necessary.

## Interface RiskRejectionNotification

This notification pops up whenever a trading signal gets blocked by your risk management settings. It’s a way for backtest-kit to tell you, in plain language, why a potential trade didn't happen. 

You’ll see details like the signal's unique ID, a timestamp, and whether it occurred during a backtest. Crucially, it identifies the symbol being traded, the strategy and exchange involved. The notification also includes a descriptive note explaining the reason for the rejection, along with a rejection ID for tracking purposes. 

Furthermore, you get insight into your current position count, the current market price, and a snapshot of the signal that was rejected—all to help you understand and refine your risk controls.

## Interface RiskEvent

This data structure holds information about when a trading signal was blocked by a risk management rule. Each time a signal is rejected, a `RiskEvent` is created to record the details. 

You'll find information like when the rejection happened (`timestamp`), which trading pair was involved (`symbol`), and the specifics of the signal that was rejected (`pendingSignal`).  It also includes the strategy and exchange names, the timeframe used, the current market price, and how many positions were already open. 

A unique ID (`rejectionId`) helps track specific rejections, along with a note explaining the reason for the rejection (`rejectionNote`).  Finally, the `backtest` flag indicates whether the rejection occurred during a backtest or a live trading session.

## Interface RiskContract

The `RiskContract` represents a signal that was blocked because it violated a risk rule. Think of it as a notification that a trading opportunity wasn't allowed to proceed due to a risk check.

This notification includes important details about the rejected trade, such as the trading pair involved (`symbol`), the specific signal that was rejected (`pendingSignal`), and the name of the strategy that tried to execute it (`strategyName`). It also tells you which timeframe the signal was for (`frameName`), the exchange it was intended for (`exchangeName`), and the current market price at the time of rejection (`currentPrice`).

You'll find information about how many positions were already open when the signal was rejected (`activePositionCount`), a unique ID for tracking this specific rejection (`rejectionId`), a description explaining why the signal was blocked (`rejectionNote`), and a timestamp indicating when the rejection occurred (`timestamp`).  Finally, it specifies whether the rejection happened during a backtest simulation or in live trading (`backtest`). This is useful for monitoring risk management effectiveness during testing and in real-world trading environments.

## Interface ProgressWalkerContract

The `ProgressWalkerContract` helps you keep an eye on how a backtesting process is going. It’s a notification that’s sent as a walker – a piece of your backtesting setup – runs in the background. 

You’ll get information about which walker is running, the exchange it’s using, and the frame associated with it. Crucially, it tells you the trading symbol it's focused on.

It also gives you a count of how many trading strategies are involved, how many have been processed, and a percentage showing how close the process is to being finished. This allows you to monitor progress and get a sense of how long the backtest might take.

## Interface ProgressBacktestNotification

This notification keeps you informed about how a backtest is progressing. It's sent during the backtesting process, giving you updates on the current status. You'll receive details like the exchange and strategy being used, the symbol being backtested, and the total number of historical data points (frames) being analyzed. The notification includes the number of frames already processed, along with a percentage representing the overall progress of the backtest. This allows you to monitor the backtest’s duration and get a sense of how much longer it will take to complete.

## Interface ProgressBacktestContract

This contract lets you keep an eye on how your backtest is progressing. It provides updates during the background execution of a backtest, giving you details like the exchange and strategy being used, the trading symbol involved, and how much of the backtest has been completed. You'll see the total number of historical data points (frames) being analyzed, how many have already been processed, and the overall percentage of completion. This information helps you understand the status and estimated time remaining for your backtest.


## Interface PerformanceStatisticsModel

This model holds the performance data collected during a backtest or live trading session, organized by strategy. It provides a summary of how a strategy performed, including the strategy's name, the total number of performance events tracked, and the overall execution time. You’ll find detailed statistics broken down by different performance metrics, allowing you to analyze specific areas of strength or weakness. Finally, the model also includes a complete list of all individual performance events, giving you access to the raw data for deeper investigation.

## Interface PerformanceContract

The PerformanceContract helps you understand how your trading strategies are performing during backtesting and live trading. It's like a detailed log that records key moments and how long they take. You'll find information like when each action happened, how long it took to complete (the duration), and which strategy, exchange, and symbol were involved. It even tells you whether the data is coming from a backtest or live trading session. This data is great for spotting areas where your strategy might be slow or inefficient.

## Interface PartialStatisticsModel

This model helps you understand the results of partial trades, breaking down the performance of your strategies. It keeps track of every partial profit or loss event, storing them in a detailed list. You’ll find the overall count of all events – both profitable and losing – as well as the total number of times your strategy achieved a profit versus a loss. This information allows you to analyze how your strategy handles partial exits and adjust accordingly.

## Interface PartialProfitNotification

This notification lets you know when a trading signal has reached a pre-defined profit milestone, like 10%, 20%, or another level you've set. It's a way to track progress and potentially adjust your strategy based on how well a trade is performing.

The notification includes details like the signal's ID, the timeframe it occurred (timestamp), whether it’s part of a backtest, the trading symbol involved, the name of the strategy used, and the exchange where the trade is happening. You’ll also see the specific profit level reached, the current price of the asset, the opening price at the trade’s start, and whether the position is long or short. It's like getting a progress report on each of your trades as they become profitable.

## Interface PartialProfitContract

The `PartialProfitContract` helps you keep track of when a trading strategy hits profit milestones during its execution. It's like a notification that a strategy has reached, for example, a 10% or 20% profit level.

This contract provides key details about the event, including the trading symbol (like BTCUSDT), the strategy's name, the exchange and frame being used, and the original signal data. You'll also find the current price at the time the milestone was hit, the exact profit level reached (10%, 20%, etc.), and whether the event is from a backtest or live trading session.

The timestamp tells you precisely when this profit level was detected – either the real-time moment for live trades or the candle's timestamp during backtesting. This is valuable for performance monitoring and report generation. Importantly, you’ll only receive a notification once for each profit level achieved by a signal.

## Interface PartialProfitCommit

This event signals a partial profit taking action within your backtest. It's triggered when your trading strategy decides to close a portion of a position to secure some gains.

The `action` property confirms that this is a partial profit event.  `percentToClose` tells you what percentage of the position the strategy intends to close. Finally, `currentPrice` represents the price of the asset at the moment the strategy requested this partial profit taking action. This information helps you understand the context of the profit-taking decision.

## Interface PartialLossNotification

This notification lets you know when a trading signal has reached a specific loss level, like a 10% or 20% drawdown. It provides detailed information about what triggered the notification, including the signal's ID, the time it occurred, and whether it's part of a backtest. You'll also find details about the asset being traded (symbol, exchange), the strategy being used, and the current price compared to the price when the position was opened. It also specifies whether the position is a long or short one, and what level of loss was reached.

## Interface PartialLossContract

The PartialLossContract represents notifications about a trading strategy hitting predefined loss levels, like -10%, -20%, or -30% of its initial investment. It's used to keep track of how much a strategy has lost and when those losses occur.

These notifications, or events, are sent out when a signal reaches a loss milestone and only happen once for each level. If the market moves rapidly, you might receive several loss level notifications within a single moment.

Each notification includes important details: the trading symbol, the strategy’s name, the exchange and frame it’s running on, the original signal data, the current market price, the specific loss level reached (e.g., -20%), whether the event came from a backtest or live trading, and the exact time it occurred. This information helps in analyzing strategy performance and managing risk. Different parts of the system, like reporting tools and user callbacks, can use this information.

## Interface PartialLossCommit

This describes what happens when a partial loss is committed during a backtest. It's a signal that a portion of your position is being closed due to a loss condition. The `action` property confirms it's a partial loss event.  `percentToClose` tells you the percentage of the total position that's being reduced. Finally, `currentPrice` provides the price at which this partial loss is occurring.

## Interface PartialEvent

This interface represents a snapshot of a profit or loss event during a trade, providing key details for creating reports and analyzing performance. Each event contains information like when it occurred (timestamp), what kind of event it is (profit or loss), the trading pair involved (symbol), and the name of the strategy that generated the trade. You'll also find details like the current market price, the specific profit/loss level reached, and the initial entry, take profit, and stop-loss prices that were set. 

The event also tracks the total percentage of the position that's been closed through partial executions and includes a human-readable note explaining the reason behind the signal. Finally, a flag indicates whether the trade occurred during a backtest or in live trading conditions.

## Interface MetricStats

This interface, `MetricStats`, bundles together key statistics calculated for a specific performance metric. Think of it as a report card for how well a certain operation is performing. It includes things like the total number of times the metric was recorded, how long those operations generally took, and the range of durations from the quickest to the slowest. You’ll find average, minimum, maximum, and median durations here, as well as the standard deviation to understand the spread of the data. Percentiles like the 95th and 99th are also provided to highlight performance at the extreme ends of the distribution. Finally, it tracks wait times between events, indicating how long the system spends between actions.

## Interface LiveStatisticsModel

The LiveStatisticsModel gives you a detailed breakdown of your live trading performance. It tracks every event – from idle periods to opened, active, and closed signals – and provides a wealth of metrics to analyze your results. You'll find the total number of events, and specifically the count of closed trades, broken down into winning and losing signals. 

Key performance indicators like win rate, average PNL, and total PNL are calculated and presented as percentages.  Volatility is assessed with the standard deviation, and the Sharpe Ratio, both regular and annualized, helps gauge risk-adjusted returns. A certainty ratio highlights the ratio of average wins to average losses. Finally, it estimates expected yearly returns based on trade durations and profitability. Keep in mind that any metric marked as "null" isn't reliable due to calculation issues.

## Interface LiveDoneNotification

This notification lets you know when a live trading session has finished. It’s sent after the execution of a live trade is complete. You’ll receive this notification along with details like a unique identifier for the event, the exact time it happened, and confirmation that it was indeed a live trade, not a backtest. It also provides key information about the trade, including the symbol traded, the name of the strategy used, and the exchange where the trade occurred.

## Interface IWalkerStrategyResult

This interface represents the outcome of running a single trading strategy within the backtest comparison process. It bundles together key information about that strategy's performance. 

You’ll find the strategy’s name listed here, along with a comprehensive set of statistical data providing detailed performance metrics. A single numerical metric value is also included, which is used to compare the strategy against others. Finally, a ranking is assigned to the strategy, indicating its relative position in the overall comparison – with a lower number signifying a better rank.

## Interface IWalkerSchema

The IWalkerSchema lets you set up A/B tests to compare different trading strategies against each other within backtest-kit. Think of it as defining a controlled experiment for your strategies. You give it a unique name, an optional note for your own understanding, and specify which exchange and timeframe to use for all the strategies involved.

Most importantly, you list the names of the strategies you want to compare – these strategies must already be registered within the system.  You can also choose what metric you’ll use to evaluate performance, such as Sharpe Ratio, although a default is provided. Finally, you have the option to add callbacks that allow you to hook into different stages of the testing process.

## Interface IWalkerResults

The `IWalkerResults` interface holds all the information gathered after running a backtest comparison – essentially, it's the final report card for your strategies. It tells you which financial instrument, or `symbol`, was being tested, and what `exchangeName` was used to access the data. You’ll also find the `walkerName`, which identifies the specific testing process or algorithm that was employed, and the `frameName`, describing the timeframe used for the backtesting. This interface gives you a clear overview of the entire backtesting setup.

## Interface IWalkerCallbacks

The `IWalkerCallbacks` interface lets you hook into the backtest process for your trading strategies. Think of it as a way to listen in on what's happening behind the scenes as the system runs tests. 

You can use `onStrategyStart` to know when a particular strategy is beginning its backtest.  `onStrategyComplete` lets you react to a strategy finishing its run and provides stats and a metric. If a strategy encounters a problem during testing, `onStrategyError` will be triggered to alert you. Finally, `onComplete` is called when all the strategies have been tested and the whole process is finished, giving you the overall results. This gives you more control and insight into the backtesting workflow.

## Interface IStrategyTickResultWaiting

This interface describes what happens when a trading strategy has a signal that's scheduled and waiting to be activated – it’s a notification you receive as the price moves. It tells you the strategy is patiently watching for the price to hit the right entry point.

You’ll get this notification repeatedly as the price fluctuates, giving you information like the current price, the strategy’s name, the exchange and timeframe being used, and the symbol being traded.

Importantly, the progress towards your take profit and stop loss will always show as zero at this stage, as the trade hasn't been executed yet. It also includes theoretical, unrealized profit and loss calculations for the potential position, and indicates whether the data originates from a backtest or live trading environment. It identifies the signal and gives context to the waiting state.

## Interface IStrategyTickResultScheduled

This interface describes what happens when a trading strategy generates a signal that’s waiting for a specific price to be reached before it executes. Think of it as a signal that's been "scheduled" – it’s ready to go, but needs to wait for the market conditions to be just right.

The result includes details about the signal itself, the strategy and exchange that generated it, and the timeframe being used. It also records the current price at the moment the signal was scheduled, and whether the event is part of a backtest or happening in a live trading environment. This allows for thorough tracking and analysis of how your strategies perform, even when they're operating on a delayed schedule.

## Interface IStrategyTickResultOpened

This interface describes what happens when a new trading signal is generated within the backtest-kit framework. It's essentially a notification that a signal has been successfully created and is ready to be acted upon.

You’ll find key details included, like the name of the strategy that generated the signal, the exchange and timeframe it applies to, and the trading symbol involved. The interface also provides the newly generated signal’s ID, along with the current price at the moment the signal opened. Finally, it indicates whether the signal came from a backtesting simulation or a live trading environment.


## Interface IStrategyTickResultIdle

This interface describes what happens when your trading strategy is in an "idle" state – meaning it’s not currently executing any trades. It provides details about the context of that idle period, like the strategy's name, the exchange being used, the time frame being analyzed, and the trading symbol involved. You'll also find the current price at the time of the idle state, and a flag to indicate whether this data is coming from a backtest or a live trading environment. Essentially, it’s a record of when your strategy pauses and why.

## Interface IStrategyTickResultClosed

This interface, `IStrategyTickResultClosed`, represents what happens when a trading signal is closed. It gives you a complete picture of the signal's final state, including why it was closed – whether it hit a take-profit or stop-loss, expired, or was manually closed.

You'll find details like the final price used for calculations, the exact time of the closure, and a breakdown of the profit and loss, accounting for fees and slippage.  It also tracks important information about the strategy, exchange, timeframe, and the trading symbol involved, making it easy to monitor and analyze your backtest or live trading results. A unique close ID is provided for manually closed signals, and a flag indicates if the event originates from a backtest.

## Interface IStrategyTickResultCancelled

This interface represents a situation where a planned trading signal was cancelled before a trade actually happened. This could occur if the signal was scheduled but didn't trigger, or if a stop-loss was hit before an entry position could be opened.

The data includes details about the cancelled signal itself (through the `signal` property), along with the price and timestamp of the cancellation. You’ll also find identifying information like the strategy name, exchange, timeframe, and trading symbol involved.

A crucial piece of information is the `reason` property, which explains why the signal was cancelled. There's also an optional `cancelId` that helps track specific cancellation requests made through the `cancel()` function. The `backtest` flag tells you if this cancellation occurred during a backtest or in live trading.

## Interface IStrategyTickResultActive

This interface describes what happens when a trading strategy is actively monitoring a signal, waiting for a take profit (TP), stop loss (SL), or time expiration. It essentially represents a position that's "in play." 

You'll find key information about the trade included, such as the strategy's name, the exchange it’s on, the timeframe used, and the symbol being traded. The `signal` property holds the data about the signal currently being tracked. 

Crucially, it also tracks progress toward both the take profit and stop loss using percentages – letting you know how close the trade is to hitting either target.  The unrealized profit and loss (`pnl`) is also provided, considering fees, slippage, and potential partial closes. Finally, it indicates whether the trade is part of a backtest or a live trade.


## Interface IStrategySchema

This interface, `IStrategySchema`, describes how you define a trading strategy within the backtest-kit framework. Think of it as a blueprint for your strategy's behavior.  It lets you give your strategy a unique name and add a helpful note for yourself or others using it.

You'll specify the minimum time between signal generation calls to control how often your strategy makes decisions. The core of the schema is the `getSignal` function, which is where you put the logic to determine when to buy or sell.  This function receives the symbol and a timestamp, and should return a signal object, or `null` if no action is needed.  You can even use this function to schedule signals, waiting for a specific price to be hit.

Finally, you can define callbacks for events like when a trade opens or closes, assign risk profiles to your strategy, or associate it with specific actions.

## Interface IStrategyResult

This interface, `IStrategyResult`, represents a single row in the comparison table you see when evaluating different trading strategies. Each result entry holds the name of the strategy being tested, along with a detailed set of statistics summarizing its performance. You'll also find a numeric value associated with the strategy – this is the result of the optimization metric, helping you rank strategies against one another. If a strategy isn't valid for evaluation, this metric value will be null.

## Interface IStrategyPnL

This interface represents the profit and loss (PnL) outcome of a trading strategy. It gives you a clear picture of how a trade performed, taking into account both fees and slippage – those small price differences that can impact your results.  You'll find the overall profit or loss expressed as a percentage, which makes it easy to compare different strategies.  The `priceOpen` and `priceClose` properties show you the actual entry and exit prices used for the PnL calculation, respectively, after fees and slippage have been factored in.

## Interface IStrategyCallbacks

This interface defines a set of optional callbacks that your trading strategy can use to react to different signal lifecycle events. Think of these as hooks that let your strategy respond to changes in the trading environment. 

You'll receive notifications when a signal is first opened, becomes active, transitions to an idle state, or is closed. There are also callbacks triggered by scheduled signals, letting you monitor or cancel them. Furthermore, the framework provides callbacks for partial profit, partial loss, breakeven, and ping events, allowing you to implement custom logic for these specific scenarios. Each callback provides relevant data like the symbol, signal information, current price, and a flag indicating whether it's a backtest. The `onTick` callback is a general one fired on every tick.

## Interface IStrategy

The `IStrategy` interface defines the core functions a trading strategy needs to execute within the backtest-kit framework. Essentially, it’s a blueprint for how strategies interact with the system.

The `tick` function is the heart of the strategy—it's called for each new price update, checking for signals, take profit (TP), and stop-loss (SL) conditions.  `getPendingSignal` and `getScheduledSignal` allow the strategy to retrieve its current active signals, useful for monitoring and adjusting TP/SL.  `getBreakeven` checks if the price has moved enough to cover transaction costs, allowing the strategy to potentially move the stop-loss to breakeven.

`getStopped` simply indicates whether the strategy is still active and processing data.  `backtest` provides a quick way to test a strategy against historical data.

Several functions (`stopStrategy`, `cancelScheduled`, `closePending`) offer ways to control a strategy's actions – stopping signal generation, cancelling pending signals, or manually closing positions—all without necessarily shutting down the entire strategy. This is useful for graceful shutdowns or intervening in a trade.

The `partialProfit` and `partialLoss` methods allow for executing partial position closures based on user-defined percentages, and `trailingStop` and `trailingTake` dynamically adjust stop-loss and take-profit levels to protect profits. Finally, `breakeven` automatically moves the stop-loss to the entry price once a certain profit threshold is reached, and `dispose` is for cleaning up the strategy when it's no longer needed.

## Interface ISizingSchemaKelly

This defines a way to calculate how much to invest in each trade using the Kelly Criterion. It's a specific sizing strategy aimed at maximizing long-term growth.

The `method` property confirms that you're using the Kelly Criterion.

`kellyMultiplier` is the core of the strategy, representing how aggressively you want to apply the formula. A smaller multiplier, like 0.25 (the default), is a more conservative approach, while a larger multiplier might risk bigger losses for potentially greater gains.

## Interface ISizingSchemaFixedPercentage

This schema defines a simple sizing strategy where each trade's risk is a fixed percentage of your total capital. The `method` property explicitly states that this is a "fixed-percentage" sizing approach. The `riskPercentage` property is the key setting; it dictates what percentage of your capital you're willing to risk on each individual trade, expressed as a number between 0 and 100. For example, a `riskPercentage` of 20 means you risk 20% of your total capital per trade.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, provides a foundation for defining how much of your trading account to allocate to each trade. Think of it as a blueprint for sizing strategies. 

It includes key properties like `sizingName`, which acts as a unique label for your sizing configuration, and a `note` field for adding helpful reminders or documentation. You also specify limits with `maxPositionPercentage` (the maximum percentage of your account to use), and `minPositionSize` and `maxPositionSize` to set absolute minimum and maximum trade sizes. Finally, `callbacks` let you add custom logic to your sizing strategy, triggered at different points in its lifecycle.


## Interface ISizingSchemaATR

This schema defines how much of your capital to risk on each trade, using the Average True Range (ATR) to determine the stop-loss distance. 

The `method` is always "atr-based" because it specifically uses this technique.

`riskPercentage` lets you set the maximum percentage of your account you're willing to lose on a single trade – a typical value might be between 1 and 5.

`atrMultiplier` adjusts the stop-loss distance based on the ATR value; a higher number means a wider stop-loss. Essentially, it helps adapt your stop-loss to the volatility of the asset you’re trading.

## Interface ISizingParamsKelly

This interface defines the parameters needed to use the Kelly Criterion for determining trade sizes within the backtest-kit framework. It focuses on providing a way to log debugging information, ensuring you can track the sizing decisions made during your backtesting process.  Specifically, it requires an `ILogger` object to record any useful debug messages related to the sizing calculations.

## Interface ISizingParamsFixedPercentage

This interface defines the parameters needed to specify a fixed percentage sizing strategy for your trades. It's used when setting up how much capital you want to risk on each trade.  The `logger` property is there so you can easily keep track of what’s happening during your backtesting or live trading, helping you debug any issues. You’ll use this to control the consistent risk exposure across your trades.

## Interface ISizingParamsATR

This interface defines the settings you can use when determining how much of an asset to trade based on the Average True Range (ATR). It lets you control the sizing logic using ATR values. 

You'll find a property for a logger, which is helpful for tracking what's happening and debugging your trading strategies. This logger allows you to output debug information, making it easier to understand how the sizing is being calculated.

## Interface ISizingCallbacks

The `ISizingCallbacks` interface provides a way to hook into the sizing process within the backtest-kit trading framework.  You can use it to observe and potentially influence how position sizes are determined. The `onCalculate` callback is triggered right after the framework calculates a position size; this is a great place to log the calculated size, perform checks to make sure it aligns with your expectations, or even apply slight adjustments if needed.  Think of it as a notification that a size has been decided, offering you a chance to react.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate trade sizes using the Kelly Criterion. It essentially tells the backtest-kit how you want to determine how much to bet on each trade.

You’ll need to provide a win rate, which represents the percentage of trades that are profitable, and a win/loss ratio that describes how much you typically make on a winning trade compared to how much you lose on a losing one.  These two values are then used to determine an optimal bet size. The `method` property confirms you're specifically using the Kelly Criterion approach.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the settings needed for a sizing calculation that uses a fixed percentage approach. When using this method, you’ll specify a `method` that's explicitly set to "fixed-percentage".  You’ll also need to provide a `priceStopLoss`, which represents the price level at which your stop-loss order will be triggered. This value is crucial for determining the size of your position based on the fixed percentage sizing strategy.

## Interface ISizingCalculateParamsBase

This interface defines the basic information needed when figuring out how much to trade. It includes the trading symbol, like "BTCUSDT," the current balance of your account, and the price at which you're planning to enter a trade. Think of it as the foundation for calculating your trade size – every sizing calculation needs to know these three things to start.

## Interface ISizingCalculateParamsATR

This interface defines the configuration needed for determining position sizes using the Average True Range (ATR). When you're using ATR to size your trades, you'll provide these parameters. The `method` property must be set to "atr-based" to indicate you're using this sizing approach.  Then, you'll specify the current ATR value as a number, which will be used in the sizing calculations.

## Interface ISizing

The `ISizing` interface is a core part of how backtest-kit determines how much of an asset your strategy should buy or sell. Think of it as the engine that figures out the size of each trade.

It has a single, crucial method called `calculate`.  This method takes a set of parameters describing the current market conditions and your strategy's risk preferences, and it returns a number representing the calculated position size – basically, how many shares or contracts to trade.  It's the place where you can implement your custom sizing logic, considering things like account balance, risk tolerance, and volatility.


## Interface ISignalRow

An `ISignalRow` represents a complete trading signal that has been validated and is ready to be used within the backtest framework. Each signal gets a unique ID automatically, making it easy to track throughout the system. It contains all the crucial details for executing a trade, including the entry price (`priceOpen`), the exchange and strategy used, the timeframe considered, and when the signal was initially created and when the position became active. 

You'll find information about the trading pair symbol (`symbol`) and a flag indicating whether the signal was scheduled in advance (`_isScheduled`).  The signal also keeps a history of any partial position closures (`_partial`), allowing for accurate Profit and Loss (PNL) calculations that factor in those partial exits.  Finally, there's support for trailing stop-loss and take-profit mechanisms (`_trailingPriceStopLoss`, `_trailingPriceTakeProfit`), where these dynamically adjust based on price movement and strategy settings, overriding the original stop-loss and take-profit values for execution purposes.

## Interface ISignalDto

The `ISignalDto` represents a trading signal, acting as a standardized way to pass signal information within the backtest-kit framework.  It bundles all the key details needed to execute a trade, including whether it’s a "long" (buy) or "short" (sell) position.  You’ll provide details like the entry price, take profit target, and stop-loss levels to define your trading strategy. A unique ID will be automatically generated for each signal, though you can provide one if needed.  Finally, you can specify an estimated duration, in minutes, for how long you anticipate the position to be held.

## Interface IScheduledSignalRow

This interface describes a signal that's scheduled to be executed when the market price reaches a certain level. Think of it as a signal that's waiting for a specific price to be hit before it's actually triggered. 

It builds upon the basic signal representation, but adds the concept of a target price – `priceOpen` – that the market needs to reach before the signal becomes active. 

When the price finally does reach `priceOpen`, this scheduled signal transforms into a regular, pending signal. A key detail is how long it's been waiting; the `pendingAt` time will initially reflect the scheduled time, and then update to the actual time it started pending.



The `priceOpen` property simply defines that target price.

## Interface IScheduledSignalCancelRow

This interface, `IScheduledSignalCancelRow`, builds upon the `IScheduledSignalRow` to provide a way to track user-initiated cancellations of scheduled signals. It introduces a `cancelId` property, which is a string identifier specifically used when a user manually cancels a signal that was previously scheduled. This allows for clearer tracking and management of signals, distinguishing between automatic expirations and deliberate user actions. Essentially, it adds a way to identify *why* a signal was removed from the schedule.

## Interface IRiskValidationPayload

This interface, `IRiskValidationPayload`, provides the data needed for risk validation checks within the backtest-kit framework. Think of it as a container holding all the crucial information about your portfolio's current state and a pending trade.  It includes the details of the signal you're about to execute (`pendingSignal`), the total number of positions you currently hold (`activePositionCount`), and a list describing each of those active positions (`activePositions`). This allows your risk validation functions to make informed decisions based on the full context of your trading activity.

## Interface IRiskValidationFn

This defines a function that helps ensure your trading strategies are behaving responsibly. Think of it as a safety check. It takes some data related to a trade and determines if it's acceptable to proceed. If everything looks good, the function does nothing. However, if it detects a potential issue—perhaps the trade is too risky—it either returns a specific result object detailing the problem, or throws an error that gets transformed into that same problem-reporting object.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define checks to ensure your trading strategies are behaving safely. It's all about setting up rules to prevent potential problems.

You provide a `validate` function, which is the core of the check - this is where you put the actual logic to examine your risk parameters.  You can also add a `note` to explain what the validation is doing; this is really helpful for making sure you and others understand why the check exists and how it works. Think of the `note` as a comment explaining the purpose of the validation.

## Interface IRiskSignalRow

This interface, `IRiskSignalRow`, provides extra information needed for managing risk during trading. It builds upon the `ISignalDto` interface by adding the entry price (`priceOpen`), the initial stop-loss price (`originalPriceStopLoss`), and the initial take-profit price (`originalPriceTakeProfit`) that were set when the signal was first created.  This extra data is particularly helpful when validating risk to ensure proper safeguards are in place based on the original trade parameters. Think of it as a way to remember the original plan for a trade.

## Interface IRiskSchema

This interface, `IRiskSchema`, lets you define custom risk profiles for your trading strategies. Think of it as a way to create rules that govern how much risk your portfolio can take.

You'll give each risk profile a unique `riskName` to identify it, and can optionally add a `note` for your own reference. 

`IRiskSchema` also allows you to specify callbacks (`callbacks`) that trigger when a trade is either rejected or allowed based on your risk rules.  The core of the risk profile is the `validations` array; this is where you'll put your custom logic to check and enforce your desired risk controls. Each item in this array represents a specific validation check.


## Interface IRiskRejectionResult

This interface, `IRiskRejectionResult`, helps you understand why a risk validation check failed during your backtesting process. When a validation doesn't pass, this object provides details about the specific issue. It includes a unique `id` to track the rejection and a `note` which is a friendly explanation of why the validation failed – making it easier to debug and improve your trading strategies.

## Interface IRiskParams

The `IRiskParams` object helps configure how your trading system manages risk. It's essentially a set of settings passed when you create a risk management component.

You'll specify the `exchangeName`, like "binance," to tell the system which exchange it's dealing with.

A `logger` allows you to see debugging information and track what’s happening.

The `backtest` flag tells the system whether it's operating in a simulated environment (for testing) or in live trading mode.

Finally, the `onRejected` callback is triggered when a trading signal is blocked by risk controls, letting you perform additional actions or emit events before the rejection is finalized.

## Interface IRiskCheckArgs

The `IRiskCheckArgs` interface bundles all the information needed to perform a risk assessment before a trading signal is generated. Think of it as a data package passed to a risk management system. It includes details like the trading symbol, the signal being considered, the name of the strategy making the request, and the exchange involved.  You'll also find essential data points such as the current price and timestamp, along with the specific risk profile and timeframe associated with the trade. Essentially, it’s a snapshot of the context surrounding a potential trade, allowing for a comprehensive risk evaluation.

## Interface IRiskCallbacks

This interface defines functions that can be used to respond to risk assessments during trading. Think of it as a way to get notified when a trade idea is either blocked or approved based on your risk rules. 

Specifically, `onRejected` is triggered when a trade signal fails a risk check – it’s your chance to react to a potentially problematic opportunity. Conversely, `onAllowed` fires when a signal successfully clears all risk checks, signaling a trade that’s deemed safe to proceed with. These callbacks allow for custom logic to be executed based on the risk assessment outcome.


## Interface IRiskActivePosition

This interface describes a single trading position that's being actively managed and tracked for risk assessment across different trading strategies. It holds key details about each position, like the name of the strategy that opened it, the exchange being used, and the specific trading symbol involved (like BTCUSDT). 

You'll find information about the direction of the trade – whether it's a long or short position – as well as the entry price, stop-loss level, and take-profit target. The interface also includes details like the estimated time the position is expected to be held, and the exact timestamp when it was first opened. Essentially, it provides a complete snapshot of a position’s characteristics for comprehensive risk monitoring.

## Interface IRisk

The `IRisk` interface helps manage and control the risk associated with your trading strategies. It acts as a gatekeeper, ensuring that new trades align with pre-defined risk limits.

You’ll use `checkSignal` to see if a potential trade is safe to execute, based on your risk parameters.

`addSignal` lets you register when a new trade is opened, keeping track of its details like entry price, stop-loss, and take-profit levels.

Finally, `removeSignal` allows you to notify the system when a trade is closed, so that position tracking remains accurate. This interface is designed to keep your trading within acceptable risk boundaries.

## Interface IReportTarget

This interface lets you pick and choose which parts of your backtesting process you want to see detailed reports on. Think of it as a way to filter the information you receive during a backtest. You can turn on logging for things like how your strategy is performing, risk management events, breakeven calculations, partial order executions, heatmap data, how your order placement algorithms are working, scheduled signals, live trading data, and closed backtest signals. By setting these properties to `true` or `false`, you can customize the level of detail in your JSONL event logs, helping you focus on the specific areas you're investigating.

## Interface IReportDumpOptions

This interface, `IReportDumpOptions`, helps organize the information when you're saving or analyzing backtest results. Think of it as a container for key details about a particular trading simulation. It includes things like the trading pair being used (the symbol, like "BTCUSDT"), the name of the trading strategy, the exchange where the trades took place, the timeframe used for analysis, a unique ID for any signals generated, and the name of the walker used for optimization. By providing these details, you can easily filter and search through your backtest reports to find exactly what you're looking for.

## Interface IPublicSignalRow

The `IPublicSignalRow` interface helps you understand the details of a trading signal, especially when using trailing stop-loss and take-profit orders. It builds upon the standard signal information to provide extra transparency for users. 

Essentially, it keeps track of the initial stop-loss and take-profit prices you set when the signal was created. These "original" prices don’t change, even if the actual stop-loss and take-profit levels adjust due to trailing mechanisms. This ensures users can always see what the starting parameters were.

You'll also find the `totalExecuted` property, which tells you what percentage of the position has been closed through partial executions, allowing you to track the progress of your trading strategy.

## Interface IPublicAction

The `IPublicAction` interface provides a framework for creating custom action handlers within the backtest-kit trading system. Think of it as a standardized way to plug in your own logic to react to events happening during a trading simulation.

It's built around a lifecycle – the handler is created, initialized, receives events like signals or profit-taking notifications, and then cleaned up. The `init` method is particularly important; it’s where you set up anything that requires asynchronous operations, such as connecting to a database, initializing external APIs, or loading configuration data.  This initialization happens only once.

The `dispose` method is equally crucial for cleanup - it's guaranteed to run exactly once to release resources and close connections.  You can use these handlers for things like managing application state, sending notifications (like alerts to a messaging service), custom logging, collecting analytics data, or even writing data to external databases. Essentially, it's your way to extend the backtest-kit with custom behavior.

## Interface IPositionSizeKellyParams

This interface defines the parameters needed to calculate position sizes using the Kelly Criterion. It lets you specify how often your strategy wins (the win rate) and the average profit you make on winning trades compared to the average loss on losing trades (the win/loss ratio). Think of it as providing the essential data about your strategy's performance to determine how much capital to allocate to each trade. You’ll use these values to ensure your sizing is aligned with your strategy's characteristics.

## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed for a trading strategy that uses a fixed percentage of your capital to size each trade, and includes a stop-loss price. You'll use this when you want to automatically calculate how much to invest in a trade based on a percentage of your total funds, while also setting a stop-loss to limit potential losses. The `priceStopLoss` property tells the system at what price to place your stop-loss order.

## Interface IPositionSizeATRParams

The `IPositionSizeATRParams` interface defines the information needed to calculate a position size based on the Average True Range (ATR).  It focuses solely on the parameters needed for that calculation. The most important piece of information it holds is the current ATR value, which is a measure of volatility. This value is essential for determining how much capital to risk in a trade, adjusting it based on how much the asset is currently fluctuating.

## Interface IPersistBase

This interface, `IPersistBase`, outlines the fundamental operations needed for any custom persistence adapter used within the backtest-kit trading framework. Think of it as a contract: if you're building a way to store and retrieve data, this is what you need to provide.

It specifies five core methods: `waitForInit` handles initial setup and validation, `readValue` retrieves an entity, `hasValue` checks for its existence, `writeValue` saves an entity, and `keys` lists all available entity IDs in a sorted order.  `waitForInit` ensures a one-time initialization process. The `keys` method is particularly important for iterating through all persisted data and performing validation checks. Essentially, it provides the essential building blocks for any custom data storage solution.

## Interface IPartialData

This interface, `IPartialData`, is designed to store a snapshot of trading data – think of it as a simplified version of the full trading state. It's specifically created so that this data can be easily saved and loaded, even when dealing with systems that need to convert data into a format like JSON. The key here is that it takes complex data structures like sets of profit and loss levels and transforms them into arrays, making them compatible with those serialization processes.  When the data is restored, these arrays are then turned back into the original sets.

The `profitLevels` property holds an array representing the profit levels that have been hit, and `lossLevels` does the same for loss levels. These arrays represent the information saved during a session, allowing for a more resilient and recoverable trading experience.


## Interface IPartial

The `IPartial` interface helps keep track of how well (or poorly) your trading signals are performing. It's designed to let you know when a signal hits important profit or loss milestones, like 10%, 20%, or 30%.

When a signal is making money, the `profit` method is used to calculate progress and send out notifications for each new profit level achieved. Conversely, the `loss` method does the same for losses. To prevent duplicate notifications, it only reports new levels.

Finally, when a signal closes—whether it hits a target profit, a stop-loss, or simply expires—the `clear` method cleans up the record, removing it from active tracking and saving any changes.

## Interface IParseArgsResult

This interface, `IParseArgsResult`, neatly packages the results of parsing command-line arguments for your trading bot. It essentially tells you what mode your bot is operating in. 

You'll find three key properties: `backtest` indicates whether you're running a historical simulation, `paper` signals a simulated trading environment using live data, and `live` confirms you’re engaged in actual trading with real funds. This helps your application understand how to behave based on the flags you provided when starting it.

## Interface IParseArgsParams

This interface, `IParseArgsParams`, helps define the information needed to run a trading strategy from the command line. Think of it as a blueprint for the arguments you'll pass to a function that sets up your backtest. It specifies what pieces of data are essential, such as the trading pair (like BTCUSDT), the name of the strategy you want to run, the exchange you’re connecting to (Binance, Bybit, etc.), and the timeframe for your data (hourly, 15-minute intervals, daily). By providing these details upfront, you can easily configure and start your backtesting process.


## Interface IOrderBookData

This interface, `IOrderBookData`, represents the raw data you get from an exchange's order book. Think of it as a snapshot of what buyers and sellers are offering right now. It holds the trading symbol – like "BTCUSDT" – along with two arrays: `bids` and `asks`. The `bids` array contains details of all the buy orders currently waiting, while the `asks` array holds the details of all the sell orders. Each element in these arrays follows the `IBidData` interface, which describes the price and quantity of each order.

## Interface InfoErrorNotification

This interface represents notifications about errors that have occurred during background processes within the backtest-kit framework. These are errors that the system can recover from, so they don't halt the entire backtest. Each notification contains details about the error, including a unique identifier, a timestamp, and a message describing the issue.  The `backtest` property simply indicates whether the error occurred during a backtesting operation. You’ll find information about the specific error itself within the `error` property, which is structured as an object.

## Interface IMethodContext

This interface, `IMethodContext`, acts like a little package of information that helps the backtest-kit framework figure out which specific components it needs to use. Think of it as a set of instructions for finding the right strategy, exchange, and testing environment. It carries the names of these components – the `exchangeName`, `strategyName`, and `frameName` – so the framework doesn't have to guess. When you're running a live test, the `frameName` will be empty, indicating that it's not operating within a defined testing framework. It's a crucial piece for ensuring everything connects correctly during backtesting.

## Interface IMarkdownTarget

This interface lets you fine-tune which reports are generated during your backtesting process. Think of it as a way to control the level of detail you see in your analysis. You can choose to track things like entry and exit signals, risk rejections, or even detailed performance metrics and bottlenecks. There are options to enable reports for scheduled signals, live trading events, and a comprehensive overview of backtest results including the entire trade history. By selectively enabling these reports, you can focus on the most important aspects of your strategy's performance.

## Interface IMarkdownDumpOptions

This interface, `IMarkdownDumpOptions`, helps organize information when creating markdown reports within the backtest-kit framework. Think of it as a container for details about what data is being reported. It includes things like the file path where the report should be saved, the name of the trading strategy being analyzed, and specifics about the trading pair (like "BTCUSDT") and the timeframe used. You can use these options to easily filter and target specific data for different reports, making it simpler to understand your backtesting results. Essentially, it provides context for generating clear and focused markdown documentation.

## Interface ILogger

The `ILogger` interface defines how different parts of the backtest-kit framework can report information about what’s happening. It gives you ways to record messages, categorized by severity – from simple notes to detailed debugging information to warnings about potential issues. This logging is essential for tracking the lifecycle of agents, recording tool usage, checking policy adherence, and identifying errors, ultimately making it easier to understand, monitor, and fix any problems that might arise.

The `log` method is for general updates, while `debug` is for very detailed information useful during development.  `info` lets you track important events and confirmations, and `warn` highlights situations that need a closer look.

## Interface IHeatmapRow

This interface describes the performance data for a single trading symbol, like BTCUSDT, when looking at a portfolio's heatmap. It gives you a quick snapshot of how a symbol has performed across all the strategies you're using with it. 

You’ll find key metrics here like the total profit or loss percentage, the Sharpe Ratio which assesses risk-adjusted returns, and the maximum drawdown which shows the largest loss experienced. 

It also breaks down the trading activity with details on the number of trades, win/loss counts, win rate, and average profit/loss per trade. Other helpful indicators include the profit factor, average win/loss amounts, streak information (longest win/loss sequences), and expectancy, which provides a more detailed view of potential profitability.

## Interface IFrameSchema

This interface, `IFrameschema`, helps define the structure of a backtesting period within the backtest-kit framework. Think of it as setting up the rules for how your historical data will be organized and processed. 

You'll use it to specify a unique name for your frame, a helpful note for yourself, and crucially, the time interval – like daily, weekly, or hourly – that you want to use for generating timestamps. 

It also lets you clearly define the start and end dates of your backtest period, ensuring you're analyzing the correct timeframe. Finally, you can optionally add lifecycle callbacks to customize certain actions that happen during the backtesting process.

## Interface IFrameParams

The `IFramesParams` interface helps you set up the environment for your trading backtests. Think of it as a container for important settings that the `ClientFrame` uses to run. It builds upon `IFramesSchema`, adding a crucial piece – a `logger`.

The `logger` property is your friend for debugging. It lets you track what's happening during your backtest and pinpoint any issues that might arise. It's a dedicated tool for internal logging within the frame.

## Interface IFrameCallbacks

This interface defines functions that can be called during the lifecycle of a backtest frame, allowing you to react to specific events. The `onTimeframe` property lets you run code whenever a new set of timeframes is created.  This is a handy place to log information about those timeframes, or even verify that they've been generated correctly for your strategy. Think of it as a notification system for when the timeframe data is ready.

## Interface IFrame

The `IFrame` interface is a core part of backtest-kit, handling how your backtesting process moves through time. Think of it as the engine that decides when your trading strategies are evaluated. 

Its main job is to create a sequence of dates, or "timeframes," for your backtest to work with.  You tell it which asset you're testing (like "BTC/USD") and a specific timeframe name (like "1 hour"), and it will generate a list of timestamps appropriate for that combination. This list dictates the exact moments in time your strategy will be tested. It's a behind-the-scenes element, designed to be used by the framework to manage the backtesting flow.

## Interface IExecutionContext

The `IExecutionContext` acts as a shared container of information during your trading strategy’s execution. Think of it as a set of parameters passed along to different parts of your code, like when fetching historical data or reacting to new trades. It tells your strategy what trading pair it's dealing with, what the current time is, and crucially, whether it’s running a backtest (simulated trading) or live trading.  This context is automatically provided by the backtest-kit framework, so you don't need to manually create it.


## Interface IExchangeSchema

This interface describes how backtest-kit interacts with different cryptocurrency exchanges. Think of it as a blueprint for connecting to a specific exchange and getting the data needed to run trading simulations.

Each exchange you want to use needs to be registered with backtest-kit using this schema. 

It defines how to retrieve historical candle data (like open, high, low, and close prices), format trade quantities and prices to match the exchange’s rules, and optionally fetch order book information.  If a particular function like fetching order books isn't provided, backtest-kit will let you know.

You can also add notes to the schema for your own documentation and configure optional callbacks for certain events like receiving new candle data. Basically, it provides a way to standardize how backtest-kit talks to various exchanges, ensuring data consistency during backtesting.

## Interface IExchangeParams

This interface defines the essential configuration needed for connecting to an exchange within the backtest-kit framework. Think of it as a blueprint for setting up how your backtesting system interacts with exchange data. You’ll need to provide functions for retrieving historical candle data, formatting order quantities and prices to match the exchange's rules, and fetching order book information.  A logger is also needed to help track and debug your backtesting process.  Importantly, all the listed functions are considered mandatory, although reasonable defaults are provided to simplify the initial setup.

## Interface IExchangeCallbacks

This interface provides a way to listen for incoming candle data from an exchange. If your backtest setup needs to react to new candlestick information as it becomes available – for example, to update a visualization or perform real-time analysis – you can implement these callbacks. The `onCandleData` function will be triggered whenever new candle data is retrieved, giving you the symbol, time interval, start date, data limit, and an array of candlestick data points. You can define this function as a regular function or as an asynchronous function that returns a promise.

## Interface IExchange

This interface defines how backtest-kit interacts with different cryptocurrency exchanges. It allows you to retrieve historical and future candlestick data, which is essential for building and testing trading strategies. You can also use it to format trade quantities and prices to match the exchange's specific requirements.

The `getCandles` method gets historical data, `getNextCandles` looks ahead (specifically designed for backtesting), and `formatQuantity` and `formatPrice` handle exchange-specific precision.  A helpful function, `getAveragePrice`, calculates the VWAP (volume-weighted average price) based on recent trades.  You can also pull order book information with `getOrderBook` and grab raw candlestick data with `getRawCandles`, offering a lot of flexibility in specifying the date range and number of candles you need. Importantly, all of these functions are designed to prevent look-ahead bias, ensuring your backtests are accurate and realistic.

## Interface IEntity

This interface, IEntity, serves as the foundation for any data that's saved and retrieved within the backtest-kit framework. Think of it as the common starting point for all your stored information. It ensures consistency and provides a standardized way to interact with different types of data. If a class represents something you need to persist, it should implement this interface.

## Interface ICandleData

The `ICandleData` interface represents a single candlestick, providing a snapshot of price action and volume over a specific time interval. It's a fundamental building block for backtesting and calculations like VWAP.  Each candlestick includes the exact timestamp when it began, the opening price, the highest and lowest prices reached during that period, the closing price, and the total volume of trades executed.  Essentially, it bundles all the key information about a particular moment in time for a financial instrument.

## Interface IBreakevenData

This interface, `IBreakevenData`, helps manage whether a trading signal has reached its breakeven point. Think of it as a simplified record of breakeven status, designed to be easily saved and loaded. It primarily contains a `reached` flag, which indicates if the breakeven has been achieved. This data is used by the backtest-kit to store and retrieve breakeven information, ensuring your trading simulations maintain their state even when restarting.

## Interface IBreakeven

This interface helps track when a trade’s stop-loss can be moved to breakeven – essentially, when the price has moved favorably enough to cover any transaction costs. It's used by systems to monitor signals and automatically adjust stop-loss orders once that breakeven point is reached.

The `check` method determines if the breakeven condition has been met, taking into account things like whether breakeven has already been triggered, the current price compared to the entry price, and backtest mode. It then marks breakeven as reached, sends a notification, and saves the new state. 

The `clear` method is used to reset the breakeven state when a trade is finished, cleaning up the system and saving the final state.

## Interface IBidData

This interface, `IBidData`, represents a single bid or ask within an order book. It contains two key pieces of information: the `price` at which the bid or ask is offered, and the `quantity` of assets available at that price. Both the price and quantity are stored as strings, allowing for potentially high precision or specific formatting requirements. Think of it as a snapshot of one specific level in the market's order book.

## Interface IActionSchema

This defines how you can create custom actions within the backtest-kit framework, allowing you to extend its functionality. Think of actions as hooks that let you plug in your own logic to respond to events happening during a backtest.

You can use them for things like managing state – connecting to tools like Redux – or for sending notifications, logging data, and even triggering custom business logic.  Each action is specific to a strategy and the timeframe you're testing.

When creating an action, you'll give it a unique name, and an optional note for documentation. Most importantly, you'll provide a handler, which is a function that will be called when an event occurs. You can also define callbacks to control the action’s lifecycle, giving you even more control over its behavior.

## Interface IActionParams

The `IActionParams` interface holds all the important information an action needs to do its job within the backtest-kit framework. Think of it as a package delivered to each action, containing tools and context. It includes a `logger` to help you track what's happening and debug any issues.  You'll also find the names of the strategy and timeframe it's working with, as well as the name of the exchange being used. Finally, it tells the action whether it's running a backtest or live trading.

## Interface IActionCallbacks

This interface, `IActionCallbacks`, lets you hook into different stages of your trading actions, providing flexibility for things like resource management and monitoring. Think of it as a set of optional event listeners you can attach to your actions.

You can use `onInit` to set things up when an action starts, like connecting to a database or loading saved data. `onDispose` is its counterpart, used for cleanup – closing connections, saving state, or unsubscribing from updates.

Several `onSignal` callbacks alert you to incoming signals. `onSignalLive` handles signals during live trading, while `onSignalBacktest` is specific to backtesting scenarios. You also get notifications for breakeven, partial profit/loss, and scheduled/active ping events, allowing you to react to those specific conditions.  Finally, `onRiskRejection` informs you when a signal is blocked by risk management. All these callbacks can be implemented synchronously or asynchronously, giving you control over how they execute.

## Interface IAction

This interface, `IAction`, is your central hub for managing what happens when your trading strategy generates signals or other events. Think of it as a way to plug in your own custom logic to react to what's going on – whether it’s a live trade or a backtest.

You can use it to connect your strategy to things like Redux stores, log events, build real-time dashboards, or gather analytics data.

It provides specific methods for different types of events:

*   `signal`: A general signal event that fires during both live and backtesting.
*   `signalLive`: Specifically for live trading signals.
*   `signalBacktest`: Just for signals generated during backtesting.
*   `breakevenAvailable`: Notifies you when a breakeven point is reached.
*   `partialProfitAvailable`: Signals the achievement of partial profit targets.
*   `partialLossAvailable`: Alerts you to partial loss levels.
*   `pingScheduled`: A notification about scheduled signal monitoring.
*   `pingActive`: Indicates that an active pending signal is being monitored.
*   `riskRejection`:  Fires when a signal is rejected due to risk validation.
*   `dispose`:  A crucial method for cleaning up and releasing resources when you no longer need the connection. This ensures you don’t leave subscriptions running or connections open.

## Interface HeatmapStatisticsModel

This model helps visualize and understand the performance of your entire trading portfolio using a heatmap. It organizes data for each individual symbol you're tracking, letting you see how they contribute to the overall portfolio health. 

You'll find key metrics like the total number of symbols you’re managing, the overall profit and loss (PNL) of the portfolio, and a Sharpe Ratio indicating risk-adjusted returns. The model also keeps track of the total number of trades executed across your entire portfolio, offering a comprehensive view of your trading activity. Each symbol's statistics are presented in an array, allowing for easy analysis and comparison.

## Interface DoneContract

This `DoneContract` lets you know when a background task, like a backtest or a live execution, has finished running. It's like a notification that pops up once the process is complete. The notification provides key details, including the exchange used, the name of the strategy that ran, and whether it was a backtest or a live trade. You'll also find the trading symbol involved, such as "BTCUSDT," and the name of the frame, which is empty when running in live mode. Essentially, it gives you a summary of what just concluded.

## Interface CriticalErrorNotification

This notification signals a critical error has occurred within the backtest framework, a problem so severe it necessitates stopping the current process. It provides essential details about the error to aid in debugging. You'll find a unique identifier (`id`) for the error, a descriptive `message`, and a timestamp (`timestamp`) indicating when it happened. The `error` property itself holds the error object, offering more specific information. Finally, the `backtest` flag simply confirms whether the error occurred during a backtesting simulation.

## Interface ColumnModel

This interface, `ColumnModel`, helps you customize how your data appears in tables generated by the backtest-kit framework. Think of it as a blueprint for each column you want to display. 

You define each column using this model, giving it a unique `key` for internal tracking, a user-friendly `label` to show in the table header, and a `format` function that takes the raw data and transforms it into a readable string. You can even control column visibility with the `isVisible` function, allowing you to show or hide columns based on certain conditions. Essentially, `ColumnModel` gives you precise control over the presentation of your data in tabular form.

## Interface ClosePendingCommit

This event signals that a previously submitted "close" action for a trade needs to be finalized. It's used to confirm that a pending close order has been processed and to provide a unique identifier (`closeId`) that links the confirmation back to the original request. Think of it as a notification saying, "Okay, we’ve handled that close order; here's a reference number for it." The `action` property always indicates this is a close-pending event.

## Interface CancelScheduledCommit

This interface lets you tell the backtest kit to cancel a previously scheduled signal event. Think of it as a way to undo a plan to execute a trade at a later time. To use it, you'll need to specify the `action` as "cancel-scheduled" and provide the unique `cancelId` that was assigned when the signal was initially scheduled. This ID is essential for the backtest kit to identify which event needs to be removed from the schedule.

## Interface BreakevenStatisticsModel

This model holds information about breakeven points reached during a trading backtest. It allows you to understand how often breakeven levels were hit and track the details of each event. You'll find a list of all recorded breakeven events, each with its own specifics, alongside a simple count of how many breakeven events occurred in total. Essentially, it's a way to monitor and analyze your trading strategy's performance regarding break-even milestones.

## Interface BreakevenEvent

The BreakevenEvent provides a standardized way to track when trading signals hit their breakeven point, which is crucial for analyzing performance. Each event contains a detailed snapshot of the trade at that moment, including when it happened (timestamp), the asset being traded (symbol), the strategy used, and a unique identifier for the signal.

You'll find key information like the entry price (breakeven level), the intended take profit and stop loss levels, as well as the original prices set when the signal was first generated.  It also includes details about partial closes (totalExecuted) and a descriptive note explaining the signal’s logic.  Finally, the event indicates whether the trade occurred in a backtest or live trading environment.

## Interface BreakevenContract

This interface represents a breakeven event, which happens when a trading signal's stop-loss is moved back to the original entry price. It's a way to track when a strategy has reduced its risk, as the price has moved favorably enough to cover transaction costs.  You’ll see these events emitted just once for each signal to avoid duplicates.

Each event provides detailed information about the trade, including the trading pair’s symbol, the name of the strategy that created the signal, and the exchange and frame it’s running on.  You'll also find all the original signal details, the current market price at the time of the breakeven, and whether the event came from a backtest or a live trade. Finally, a timestamp indicates precisely when the breakeven occurred, aligned with either the real-time moment or the candle that triggered it. These events are useful for creating reports and allowing users to monitor their trading strategies.

## Interface BreakevenCommit

This represents a breakeven event that occurs during a backtest. It tells you that the strategy has reached a point where the trade could be considered breakeven. 

The `action` property simply confirms that this is indeed a breakeven event. 

The `currentPrice` property provides the price at which the breakeven was calculated – it's the price at which the trade would neither make nor lose money.

## Interface BacktestStatisticsModel

This model holds all the key statistical data generated after running a backtest of your trading strategy. You'll find details about individual trades, like their price and profit/loss, neatly organized within the `signalList`. It also provides a summary of how your strategy performed, giving you counts of winning and losing trades, and overall profit.

Several key performance indicators are calculated and presented here, like your win rate, average profit per trade, and total profit across all trades. It also includes metrics to help you understand the risk involved, such as standard deviation (volatility) and the Sharpe Ratio, which measures risk-adjusted return.  The annualized Sharpe Ratio further clarifies profitability by considering yearly returns, and the certainty ratio highlights the balance between average winning and losing trades. Finally, you'll see an estimated yearly return based on the duration and profitability of your trades. Remember that if any of these calculations result in an unsafe value (like infinity or NaN), they'll be represented as null.

## Interface BacktestDoneNotification

This notification signals that a backtest has finished running. It's sent when the backtest process is complete.

You'll receive this notification along with key details about the backtest, including a unique identifier, the time it concluded, and confirmation that it was indeed a backtest.

It also provides information about the specific symbol being tested, the name of the trading strategy used, and the exchange involved. This allows you to track and analyze the results of your backtest runs easily.


## Interface ActivePingContract

The ActivePingContract provides a way to keep track of active, pending signals as your trading strategies run. It sends out a notification, essentially a "ping," every minute while a signal is still open and being monitored. This ping includes key information like the trading symbol, the strategy's name, the exchange being used, and all the details about the signal itself – like its ID, entry price, and stop-loss levels. You’ll also know if the signal originates from a backtest (using historical data) or a live trade. This lets you build custom logic to react to these active signals as they evolve, using the provided `listenActivePing` and `listenActivePingOnce` functions.
