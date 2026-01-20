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

This interface defines a signal that's sent when a walker needs to be stopped. Think of a walker as a process that’s running a trading strategy – sometimes you need to halt it.

The signal contains details about *which* walker and strategy needs to be stopped, and importantly, includes the walker's name. This allows you to handle stop signals specifically for certain walkers, even if you're running multiple walkers on the same trading symbol.

You'll see this signal when using the `Walker.stop()` function to interrupt a trading process. It’s helpful for building systems that react to these interruptions and potentially adjust their behavior.


## Interface WalkerStatisticsModel

This interface, `WalkerStatisticsModel`, helps organize and present the results of backtesting different trading strategies. Think of it as a container holding all the information needed to compare how various strategies performed. It builds upon the `IWalkerResults` interface and includes extra data specifically for comparing strategies against each other. Inside, you'll find `strategyResults`, which is a list of all the results generated from each strategy you tested – allowing you to easily analyze and contrast their performance.

## Interface WalkerContract

The WalkerContract provides updates on the progress of your backtesting comparisons. Think of it as a notification system that keeps you informed as different trading strategies are tested against each other. Each time a strategy finishes its backtest, a WalkerContract event is triggered, giving you details like the strategy’s name, the exchange and frame used, the symbol being tested, and its performance statistics.

You’ll receive information about the specific metric being optimized and its current value, along with the best-performing strategy seen so far. The event also tells you how many strategies have been tested and the total number planned, giving you a clear picture of how far along the comparison process is. Essentially, this contract lets you follow along with your strategy optimization in real time.

## Interface WalkerCompleteContract

This interface represents the final notification you receive when a backtesting process, known as a "walker," is finished. It tells you that all the strategies have been tested and the overall comparison is complete. 

The notification includes important details such as the name of the walker, the trading symbol being analyzed, the exchange and timeframe used for the tests, and the optimization metric employed. 

You'll also find information about the total number of strategies tested, which one performed best, its resulting metric score, and the detailed statistics for that top-performing strategy. Essentially, it’s a summary package of the entire backtesting run.


## Interface ValidationErrorNotification

This notification lets you know when a problem occurred during risk validation while your backtest is running. It’s a signal that something went wrong with the rules or checks you’ve set up to ensure your trading strategy is safe. 

The notification includes a unique identifier (`id`) for tracking, a timestamp (`timestamp`) to pinpoint when the error happened, and a descriptive `message` explaining the issue. You'll also find the original `error` object itself, providing more details for debugging. A `backtest` flag indicates whether the error arose during a backtest simulation.

## Interface ValidateArgs

This interface, `ValidateArgs`, acts as a blueprint for ensuring the names you use when setting up your backtesting environment are correct. Think of it as a way to double-check that everything is spelled right and refers to a valid component. 

It defines properties like `ExchangeName`, `FrameName`, `StrategyName`, and more – each representing a core part of your trading setup. For each of these, you'll provide an enumeration (a list of possible values), and the framework will verify that your chosen name is actually one of the options it recognizes. 

Essentially, it’s a safety net to prevent errors caused by typos or incorrect references to your exchanges, strategies, risk profiles, or other components. This helps guarantee your backtest is running against what you intend.


## Interface TickEvent

This describes a unified way to represent different events happening during a trade, making it easier to analyze and report on trading activity. Each event, whether it's a trade being scheduled, opened, or closed, is packaged into this `TickEvent` object. 

The event contains key details like when it happened (`timestamp`), what type of action occurred (`action`), and important information about the trade itself like the symbol, signal ID, position type, and any notes associated with the signal. You'll also find pricing information such as the current price, open price, take profit, and stop loss levels.

For trades that are actively running or have been closed, the `TickEvent` provides further insights like the percentage progress towards take profit and stop loss, unrealized or realized profit and loss, and the reason for closure or cancellation. Duration is available for closed events. Essentially, it's a single source of truth for understanding the lifecycle of a trade.

## Interface SignalScheduledNotification

This notification tells you when a trading signal is planned to happen in the future. It's like a heads-up that something's going to execute at a specific time.

The notification includes key details such as a unique ID for the signal, the exact timestamp it's scheduled for, and whether it's part of a backtest. You’ll also find information about the asset being traded (symbol), the strategy and exchange involved, the signal's own ID, whether you're planning to buy (long) or sell (short), the intended entry price, when it’s actually supposed to execute, and the current price at the time of scheduling. All of these pieces of data can help you understand and monitor your automated trading plans.


## Interface SignalOpenedNotification

This notification lets you know when a new trade has been initiated within the backtest framework. It provides all the essential details about the opening of that trade, including a unique identifier for the signal, the symbol being traded, the name of the strategy that triggered the trade, and the exchange being used. You’ll also find information about the trade's direction (long or short), the opening price, and any take profit or stop loss levels that were set. A timestamp shows precisely when the trade began, and a flag indicates whether this is a backtest scenario. Finally, a note field allows for any additional context or explanation regarding the trade.

## Interface SignalData$1

This `SignalData` object holds all the important details about a finished trading signal. Think of it as a record of a single trade made by your strategy. You'll find information like which strategy created the signal, a unique ID for that signal, and the trading symbol involved (like BTC/USD). 

It also includes key data about the trade itself: whether it was a long or short position, the profit or loss as a percentage, and why the signal was closed. Finally, timestamps indicate exactly when the signal was opened and closed, providing a complete timeline for the trade. This information is useful for analyzing performance and understanding how your strategies are working.

## Interface SignalClosedNotification

This notification lets you know when a trading position has been closed, whether it was because a take profit or stop loss was triggered. It provides a lot of details about the closed position, including a unique identifier, the timestamp of the event, and whether it happened during a backtest.

You'll find information like the symbol traded, the name of the strategy and exchange involved, and the original signal's ID. The notification also tells you if the position was a long or short trade, the opening and closing prices, the percentage profit or loss, and the reason why the position was closed. Finally, it includes the duration the position was open and an optional note for any additional information.

## Interface SignalCancelledNotification

This notification lets you know when a scheduled trading signal has been cancelled before it was actually executed. It’s a way to track why a signal didn't happen, which can be useful for debugging or understanding strategy behavior.

The notification includes details like the signal’s ID, the timestamp of the cancellation, whether it occurred during a backtest, and the symbol involved. You’ll also find information about the strategy and exchange that generated the signal, the direction (long or short) of the intended trade, and most importantly, the reason for the cancellation and its associated ID. Finally, it also includes the original planned duration of the signal.

## Interface ScheduleStatisticsModel

This model holds statistics about signals that have been scheduled within the backtest. It gives you a breakdown of how many signals were scheduled, how many were opened (meaning activated), and how many were cancelled.

You can access a detailed list of each scheduled event through the `eventList` property. The `totalEvents`, `totalScheduled`, `totalOpened`, and `totalCancelled` properties provide simple counts. 

To assess the effectiveness of your scheduling, the `cancellationRate` and `activationRate` tell you how often signals are cancelled versus activated, expressed as percentages. Finally, `avgWaitTime` and `avgActivationTime` provide insights into how long signals typically wait before being cancelled or opened, respectively.

## Interface SchedulePingContract

This contract, `SchedulePingContract`, represents a regular check-in signal while a scheduled trading signal is active. Think of it as a heartbeat confirming that the system is still monitoring a specific trade. 

It's sent out every minute while the signal is running, providing vital information about the trade being monitored, including the symbol (like BTCUSDT), the strategy name, and the exchange. 

You'll find details about the signal itself within the `data` property, such as the entry price, take profit, and stop loss levels. Importantly, the `backtest` flag tells you whether this ping originates from a historical simulation or live trading. 

The `timestamp` tells you exactly when the ping occurred – either the real-time time during live trading or the timestamp of the candle being used in a backtest. You can use this information to build custom logic for monitoring and potentially even canceling scheduled signals.


## Interface ScheduledEvent

This interface holds all the important details about scheduled, opened, and cancelled trading events, making it easier to create reports and analyze performance. Each event has a timestamp, indicating when it occurred. You'll find information like the type of action taken (scheduled, opened, or cancelled), the trading symbol involved, and a unique identifier for the signal. 

It also includes key pricing data like the entry price, take profit levels, and stop loss levels, along with their original values before any adjustments. For closed events, you'll see the timestamp and duration of the trade. If an event was cancelled, you'll get the reason for cancellation and a unique ID if the user initiated it. This comprehensive collection of data provides a full picture of each trading event.

## Interface RiskStatisticsModel

This data model holds information about risk rejections, helping you understand where and why your trading system is encountering problems. It keeps track of individual risk events in detail through the `eventList` property, giving you a complete record of each rejection.  You'll also find the total number of rejections recorded, and breakdowns of these rejections organized by the trading symbol and by the strategy involved. This allows for targeted analysis and improvement of your risk management processes.

## Interface RiskRejectionNotification

This notification lets you know when a trading signal was blocked by the risk management system. It happens when the rules you've set in place prevent a trade from happening.

The notification provides lots of details about why the signal was rejected, including a unique ID, when it occurred, and whether it's part of a backtest. You’ll find information about the symbol being traded, the strategy and exchange involved, and a specific explanation for the rejection.

It also shows you the number of active positions at the time, the current price of the asset, and the signal that was rejected. This information is valuable for understanding and refining your risk management rules to avoid unnecessary rejections while maintaining a safe trading environment.

## Interface RiskEvent

This data structure holds information about signals that were blocked by risk management rules. Think of it as a record of why a trade didn’t happen. Each `RiskEvent` contains details like when the event occurred, the trading pair involved, the specifics of the signal that was rejected, the strategy and exchange that generated it, and the current market price at the time. You’ll also find information about how many positions were already open, a unique ID for the rejection, the reason for the rejection, and whether the event happened during a backtest or live trading. This information is really useful for understanding and debugging your risk rules.

## Interface RiskContract

This describes what happens when a trading signal gets blocked because it violates risk rules. Think of it as a notification that something was flagged as too risky.

When a signal is rejected due to risk validation, this structure provides all the details about that rejection. You'll see information like the trading pair involved (symbol), the specifics of the signal itself (pendingSignal), the strategy that tried to execute it (strategyName), and the timeframe it was intended for (frameName).

It also includes crucial data for understanding the context of the rejection: the exchange involved (exchangeName), the market price at that moment (currentPrice), how many positions were already open (activePositionCount), and a unique ID to track the event (rejectionId). A human-readable explanation for the rejection is also available (rejectionNote). 

The timestamp (timestamp) tells you exactly when the rejection occurred, and a flag (backtest) indicates whether this happened during a backtest simulation or in live trading.  This information is useful for monitoring risk events, generating reports, and debugging any issues.

## Interface ProgressWalkerContract

The `ProgressWalkerContract` helps you keep an eye on the progress of long-running background tasks within the backtest-kit framework. When a walker, which is a process for evaluating trading strategies, is running, it periodically sends updates describing where it's at.

Each update contains key details like the name of the walker, the exchange being used, the frame employed, and the trading symbol involved. You’ll also get the total number of strategies the walker needs to process, how many it's already finished, and the overall completion percentage. This lets you monitor and understand how much work is left to be done.


## Interface ProgressOptimizerContract

This contract helps you keep an eye on how your trading strategy optimizer is doing. It sends updates as the optimizer runs, letting you know what's happening behind the scenes. You’ll see the name of the optimizer, the trading symbol it's working with, and how much data it has left to process. 

The updates include the total amount of data being used, how much has already been processed, and a percentage representing the overall completion. This lets you monitor the optimization process and get an idea of how long it will take to finish.

## Interface ProgressBacktestNotification

This notification keeps you informed about the progress of your backtest. It's sent while the backtest is running, providing updates on how far along it is. Each notification includes details like the exchange and strategy being used, the specific trading symbol being analyzed, and the total number of historical data points (frames) being processed. You'll see the number of frames already processed, along with a percentage indicating overall completion. The `id` and `timestamp` provide a unique identifier and the time the update was sent, useful for tracking and debugging.

## Interface ProgressBacktestContract

This interface helps you keep an eye on how your backtest is going. It provides updates as the backtest runs, so you can see exactly which exchange, strategy, and symbol are being tested. 

You’ll receive information about the total number of historical data points (frames) the backtest needs to analyze, and how many have already been processed. 

Finally, a progress percentage lets you know how close the backtest is to finishing. This is particularly useful for long backtests to ensure everything is running correctly.

## Interface PerformanceStatisticsModel

This model gathers performance data for a specific trading strategy, giving you a clear picture of how it's performing. It holds the strategy's name so you know which strategy the data belongs to. You'll also find the total number of performance events recorded and the total time the strategy took to run. 

The core of the model is the `metricStats` property, which organizes statistics by the type of metric being tracked. Finally, a complete list of all raw performance events is available for detailed examination.

## Interface PerformanceContract

The PerformanceContract helps you understand how your trading strategies are performing by recording key metrics during execution. It essentially tracks the time taken for different operations, allowing you to identify slowdowns or inefficiencies. Each recorded event includes a timestamp, and a reference to the previous event's timestamp, so you can see how performance changes over time.

You'll find details like the type of operation being measured (like order placement or market data updates), the name of the strategy and exchange involved, and the trading symbol being used.  A crucial distinction is whether the event occurred during a backtest or in live trading.  This contract is particularly helpful when profiling and pinpointing bottlenecks within your trading system.


## Interface PartialStatisticsModel

This data structure helps you understand the results of strategies that use partial fills or cancellations. It breaks down the performance into individual profit and loss events, giving you a detailed look at how often each outcome happened. You'll find a list of all the events, along with the total count of profit and loss events, making it easier to analyze a strategy's behavior. Essentially, it gives you the building blocks to assess partial fill strategies.

## Interface PartialProfitNotification

This notification lets you know when a trading signal has reached a specific profit milestone during a backtest or live trade. It's triggered when the signal hits levels like 10%, 20%, or any other defined level.

The notification includes key details like the signal's ID, the time it was triggered, whether it's part of a backtest, the traded symbol, the name of the strategy used, and the exchange involved. You'll also find information about the current price, the price at the start of the trade, and whether the position is a long or short one. The `level` property specifies the exact profit percentage reached. This information can be used to analyze the performance of your trading strategies and optimize your profit-taking rules.


## Interface PartialProfitContract

This interface describes what happens when a trading strategy hits a profit milestone, like reaching 10%, 20%, or 30% profit. It's used to keep track of how a strategy is performing and when it's taking partial profits. Each time a profit level is reached, this information gets packaged up, including details like the trading pair, the strategy’s name, which exchange is involved, and the current price. 

The data also includes the original signal information, allowing you to see how the current price compares to the initial entry price and total executed amount. You'll find the specific profit level (e.g., 10%, 50%) and whether the event occurred during a backtest or live trading.  Finally, a timestamp indicates precisely when the level was reached, providing a timeline for performance tracking. Events are only emitted once per level, even if the price jumps quickly.

## Interface PartialLossNotification

This notification lets you know when a trading signal has hit a predefined loss level, like a 10% or 20% drawdown. It's a heads-up that things aren't going as planned, and it provides a bunch of important details to help you understand what's happening. 

You'll get information like the specific loss level triggered, the trading symbol involved, the name of the strategy and exchange used, and the current price.  It also includes a timestamp, an ID for tracking, and whether it happened during a backtest or live trading.  The "position" property tells you if you're long or short on the asset.

## Interface PartialLossContract

This describes a `PartialLossContract`, which is a way for the backtest-kit framework to tell you when a trading strategy hits a predefined loss level, like a 10% or 20% drawdown. Think of it as a notification that things are going a bit sideways.

Each notification includes details like the trading pair involved (e.g., BTCUSDT), the name of the strategy that generated the signal, and the exchange and frame being used. You'll also get the price at the time the loss level was triggered, along with the complete signal data, and the specific loss level reached (like -10%, -20%, etc.).

These notifications are emitted just once for each loss level and strategy, even if there are significant price drops.  You can use them to track how your strategies are performing and to build reports on drawdown events.  The notification also indicates whether the event occurred during a backtest (using historical data) or in live trading. Finally, a timestamp indicates precisely when the loss level was detected, either at the moment in live mode, or at the candle close during a backtest.

## Interface PartialEvent

This interface, `PartialEvent`, acts as a central hub for all the key data points related to profit and loss milestones during a trade. Think of it as a snapshot of what happened at significant moments in a trade's lifecycle, like when a profit target or stop-loss level is hit. 

It includes details such as the exact time of the event, whether it was a profit or loss, the trading symbol involved, the name of the strategy used, and a unique identifier for the trading signal. You'll also find information about the current price, the position type (long or short), and the entry, take profit, and stop-loss prices.

Furthermore, it tracks original take profit and stop-loss prices set when the signal was created, the total percentage executed in partial closes, a human-readable explanation of the signal, and an indicator whether this data comes from a backtest or a live trading environment. This data is crucial for generating reports and analyzing trading performance.

## Interface MetricStats

This interface, `MetricStats`, holds a collection of performance statistics for a particular metric. Think of it as a summary report for how a specific thing is performing, like order execution time or message processing duration.

It includes details like how many times the metric was recorded (`count`), the total time spent across all recordings (`totalDuration`), and key duration measurements like average, minimum, maximum, and standard deviation. You'll also find percentiles (`p95`, `p99`) to understand how durations spread out, and wait time statistics to evaluate the delays between events. Each `MetricStats` object provides a comprehensive snapshot of performance for a specific metric type.

## Interface MessageModel

This defines a basic building block for managing conversations with large language models. Think of it as a single turn in a dialogue. Each "MessageModel" represents either instructions you give the LLM (the "system" role), a question or input from you (the "user" role), or a response generated by the LLM (the "assistant" role).  It has two key parts: the `role` which tells you who sent the message, and the `content` which is the actual text of the message.  The Optimizer uses these message models to keep track of the conversation flow and create prompts for the LLM.


## Interface LiveStatisticsModel

This model holds key statistics about your live trading performance, giving you a detailed view of how your strategies are doing. It tracks everything from the total number of trades and closed signals to the win rate and overall profit. You'll find information about individual trade details in the event list, and important metrics like average profit per trade, total profit, volatility (standard deviation), and risk-adjusted return (Sharpe Ratio). All numerical values are carefully managed to ensure accuracy, displaying as null when calculations aren't reliable. Ultimately, this model helps you understand and improve your trading strategies.

## Interface LiveDoneNotification

This notification signals the successful completion of a live trading session. When a live trade finishes running, you’ll receive this notification. 

It includes important details about the trade, like a unique ID, the exact timestamp of completion, and confirmation that it wasn’t a backtest (it was a live trade). You’ll also find the traded symbol, the name of the strategy that executed the trade, and the name of the exchange used. This information helps you track and analyze your live trading performance.

## Interface IWalkerStrategyResult

This interface, `IWalkerStrategyResult`, represents the outcome of running a single trading strategy within a comparison test. Each result holds the strategy's name so you know which strategy produced it.  It also includes a set of statistics describing the strategy's performance, calculated using the `BacktestStatisticsModel`.  A key value, `metric`, quantifies the strategy's performance based on a chosen comparison metric; this can be null if the metric isn't applicable. Finally, `rank` shows how the strategy stacked up against others in the comparison, with a lower rank indicating better performance.

## Interface IWalkerSchema

The IWalkerSchema defines how to set up A/B tests within the backtest-kit framework. Think of it as a blueprint for comparing different trading strategies against each other. 

You'll give it a unique name to identify your test, and optionally add a note to help yourself or others understand what the test is for.  It specifies which exchange and timeframe you want to use for all the strategies being compared.

The most important part is the `strategies` list, which tells the framework which strategies you want to pit against each other in the test – these strategies must have been registered beforehand.  You can also choose what metric you want to optimize, like Sharpe Ratio, and provide optional callbacks to hook into different stages of the testing process.

## Interface IWalkerResults

After running a backtest kit walker, the `IWalkerResults` object neatly packages up all the information about the test. It tells you exactly which asset, or "symbol," was being backtested. You'll also find the name of the exchange used for data and the specific "walker" that ran the tests. Finally, it identifies the "frame" - essentially the overall setup and configuration – employed for the backtesting process, giving you a full picture of the execution environment.

## Interface IWalkerCallbacks

This interface lets you hook into the backtest process, receiving notifications at key moments. You can use it to monitor the progress of your strategy comparisons and react to events as they happen. 

Specifically, you'll get a notification when a strategy test begins (`onStrategyStart`), when it finishes successfully (`onStrategyComplete`), or when an error occurs during the test (`onStrategyError`). Finally, `onComplete` will be called once all the strategies have been tested, providing you with the overall results. 

These callbacks give you more control and visibility into the backtesting workflow.

## Interface IStrategyTickResultWaiting

This interface describes what happens when a trading strategy is waiting for a signal to become active. It's a specific type of result you'll get when the strategy is monitoring a signal that's been scheduled but hasn't triggered yet. 

Essentially, it tells you the strategy is patiently watching the price, waiting for it to hit the entry point defined by the signal. 

You'll find key information included, like the name of the strategy, the exchange and symbol it's trading, the current price being monitored, and the signal details themselves. Because the position isn’t yet active, progress indicators like take profit and stop loss will always show as zero. There's also data on unrealized profit and loss, as well as confirmation of whether this is a backtest or live trade.

## Interface IStrategyTickResultScheduled

This interface represents a tick result, specifically when a trading strategy has generated a signal that’s been scheduled – meaning it's waiting for the market price to reach a certain point before being executed. It's used to track what’s happening behind the scenes when a strategy decides to place an order but isn't quite ready to do so yet.

The information provided includes details like the strategy's name, the exchange being used, the timeframe of the data, the trading symbol, and the current price at the time the signal was scheduled. You’ll also find a flag indicating whether this event happened during a backtest or in a live trading environment. This allows you to monitor and debug scheduled signals to ensure everything is working as expected.


## Interface IStrategyTickResultOpened

This interface describes what happens when a new trading signal is created within the backtest-kit framework. It's essentially a notification that a signal has been successfully generated, validated, and saved.

You'll see this result when a strategy generates a signal, and it's crucial for understanding the context of that signal. 

The information included details like the name of the strategy that created the signal, the exchange it’s associated with, the timeframe being used (like 1-minute or 5-minute candles), the symbol being traded (e.g., BTCUSDT), the price at the time the signal was opened, and whether the event occurred during a backtest or live trading. The newly created signal itself, including its unique ID, is also included.

## Interface IStrategyTickResultIdle

This interface describes what happens when your trading strategy is in a state of inactivity, often called "idle." It's a way to keep track of when your strategy isn't actively making trading decisions. The `action` property clearly indicates this idle state. 

You'll also find details like the strategy's name, the exchange it's connected to, the timeframe being used (like 1-minute or 5-minute charts), and the trading symbol (e.g., BTCUSDT).  It also includes the current price at that moment, and whether the data is coming from a backtest or live trading environment. Think of it as a record showing that everything is quiet for your strategy for a brief period.

## Interface IStrategyTickResultClosed

This interface represents the outcome when a trading signal is closed, providing a complete picture of what happened and the resulting profit or loss. It includes details like the reason for closing – whether it was due to a time limit, a take-profit target, or a stop-loss trigger – along with the price at which the position was closed.

You'll find all the original parameters of the signal, alongside calculations of profit and loss, considering fees and slippage. The information also includes tracking details such as the strategy name, exchange, timeframe, and the trading symbol involved, to allow for detailed analysis and performance monitoring. A flag indicates whether the event occurred during a backtest or in a live trading environment.


## Interface IStrategyTickResultCancelled

This interface, `IStrategyTickResultCancelled`, describes what happens when a trading signal that was scheduled to execute doesn't actually trigger – perhaps because it was cancelled or because a stop-loss was hit before a position could be opened. It gives you information about why the signal didn't activate, like the signal itself, the price at the time of cancellation, and the exact time it happened. You'll also find details about the strategy, exchange, timeframe, and trading symbol involved, along with whether the event occurred during a backtest or live trading. A cancellation ID is included if the signal was manually cancelled through a `cancel()` function. The `action` property is always "cancelled" to clearly indicate the type of event.

## Interface IStrategyTickResultActive

This type represents a tick result when a strategy is actively monitoring a signal, waiting for a take profit (TP), stop loss (SL), or a time expiration. It's used to track the progress of a trade and provides key information about its state.

The `action` property clearly indicates that the strategy is in an 'active' state. You'll find details about the `signal` being monitored, along with the `currentPrice` used for calculations. 

Important context like the `strategyName`, `exchangeName`, and `frameName` are included to help with tracking and analysis.  The `symbol` specifies the trading pair being used.

You can also monitor the progress toward TP and SL using `percentTp` and `percentSl`, respectively. The `pnl` property gives you the unrealized profit and loss, considering fees and slippage. Finally, `backtest` flags whether the data originates from a backtesting simulation or a live trading environment.

## Interface IStrategySchema

This schema defines how you register a trading strategy within the backtest-kit framework. Each strategy gets a unique name, and you can add a note to help document its purpose.

The `interval` property controls how often your strategy can generate trading signals, preventing it from overwhelming the system.  The core of the strategy is the `getSignal` function, which is responsible for calculating signals based on market data and the current date. This function can either generate a signal immediately or schedule it to wait for a specific price level.

You can also define lifecycle callbacks like `onOpen` and `onClose` to execute custom logic at specific points in the strategy's operation.  Finally, the `riskName` and `riskList` properties enable integration with a risk management system, allowing you to assign risk profiles to your strategies and even specify multiple profiles. The `actions` property allows you to associate specific actions with your strategy.

## Interface IStrategyResult

This interface represents a single result from running a trading strategy backtest. Think of it as a row in a comparison table showing how different strategies performed. Each result tells you the name of the strategy that was tested, provides a comprehensive set of statistics about its performance, and gives you a numerical value representing its ranking based on a specific metric. This metric value helps you easily compare and sort strategies to see which ones did the best.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, holds the results of how a trading strategy performed in a backtest. It lets you see the profit and loss, not just in raw numbers, but as a percentage change.  Crucially, the prices used in this calculation – both the entry price (`priceOpen`) and the exit price (`priceClose`) – have been adjusted to account for realistic trading costs, specifically a 0.1% fee and 0.1% slippage. This gives you a more accurate picture of the strategy's true profitability.

## Interface IStrategyCallbacks

This interface lets you hook into different stages of a trading signal's lifecycle within your backtesting strategy. Think of them as event listeners that you can use to react to what's happening with your trades.

You'll get notified on every tick of market data with `onTick`.  `onOpen` signals when a new position is taken, `onActive` when the strategy is actively monitoring a trade, and `onIdle` when there are no active trades. When a trade closes, `onClose` will fire, providing the final closing price.

For delayed entries, `onSchedule` is triggered when a signal is created and scheduled to open later, while `onCancel` handles when a scheduled signal is canceled.  `onWrite` is for persisting data during testing. 

There are also callbacks to manage profit and loss scenarios. `onPartialProfit` lets you react to signals that are making money but haven't reached the target price. `onPartialLoss` triggers when a trade is experiencing a small loss. `onBreakeven` is called when a trade hits its break-even point.

Finally, `onSchedulePing` and `onActivePing` allow for minute-by-minute monitoring of scheduled and active signals respectively, enabling custom checks and actions like cancellation logic.

## Interface IStrategy

This interface outlines the core functionalities of a trading strategy within the backtest-kit framework. Think of it as the blueprint for how a strategy interacts with the system.

The `tick` method is the engine of the strategy—it's called for each price update to check for signals, stop-loss triggers, and profit targets.  `getPendingSignal` and `getScheduledSignal` are for retrieving existing orders—helpful for monitoring and managing them.

`getBreakeven` determines if enough profit has been made to cover transaction costs, allowing a move to a break-even position. `getStopped` tells you if the strategy is paused.

`backtest` lets you quickly test your strategy against historical data.  The `stop` method pauses new signal generation, while `cancel` lets you discard a scheduled signal without affecting the rest of the strategy.

You can also manage partial profits and losses with `partialProfit` and `partialLoss`, and adjust trailing stop-loss and take-profit levels using `trailingStop` and `trailingTake`.  The `breakeven` method automatically moves your stop-loss to your entry price once you've made enough profit.  Finally, `dispose` cleans everything up when you're finished with the strategy.

## Interface ISizingSchemaKelly

This schema defines a sizing strategy based on the Kelly Criterion, a mathematical formula used to determine optimal bet size. It essentially tells the backtest-kit how to calculate how much of your capital to allocate to each trade.  The `method` property confirms you're using the Kelly Criterion. The `kellyMultiplier` allows you to control the aggressiveness of the sizing; a lower value like 0.25 (the default) represents a more conservative "quarter Kelly" approach, while higher values increase risk and potential reward.

## Interface ISizingSchemaFixedPercentage

This schema defines a simple way to size your trades, using a fixed percentage of your capital for each trade.  It's straightforward: you specify a `riskPercentage`, which represents the portion of your total capital you're willing to risk on a single trade, expressed as a number between 0 and 100.  The `method` property is always set to "fixed-percentage" to identify this specific sizing strategy. This allows for consistent, predictable risk management.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, acts as a blueprint for defining how much of your account to use for each trade. It’s all about controlling your position sizes. You’ll find essential details here, like a unique name to identify the sizing strategy and a place for notes to explain how it works. 

You can specify limits using percentages of your total account balance (`maxPositionPercentage`), and absolute values for minimum (`minPositionSize`) and maximum (`maxPositionSize`) position sizes.  Finally, there’s a section for optional callbacks, which let you add extra logic to the sizing process at different points.


## Interface ISizingSchemaATR

This schema defines how to size your trades using the Average True Range (ATR) as a guide. It's designed to help manage risk by dynamically adjusting trade sizes based on market volatility.

The `method` property is fixed and always set to "atr-based," confirming you're using this specific sizing approach.

You’ll specify a `riskPercentage`, which represents the portion of your capital you're willing to risk on each individual trade. This is usually a percentage between 0 and 100.

Finally, the `atrMultiplier` determines how the ATR value is used to calculate your stop-loss distance, influencing the overall size of your position. A higher multiplier leads to wider stops and smaller trade sizes.

## Interface ISizingParamsKelly

This interface defines the parameters needed to use the Kelly Criterion for determining position sizes within a trading strategy. It primarily focuses on providing a way to log debugging information. 

Specifically, you'll need to supply a `logger` object, which is used to output debugging messages – helpful for understanding how your sizing calculations are working. This ensures you can monitor and troubleshoot your sizing strategy effectively.


## Interface ISizingParamsFixedPercentage

This interface defines how to set up your trading strategy's position sizing when you want to use a fixed percentage of your capital for each trade. It requires a logger to help you keep track of what's happening in your backtest. Essentially, you'll specify the percentage of your portfolio you want to risk on each trade, and this framework will handle calculating the exact position size based on that percentage. The logger lets you see details about the sizing process, useful for debugging and understanding your strategy’s behavior.

## Interface ISizingParamsATR

This interface defines the settings you'll use when determining how much of an asset to trade, specifically when using an Average True Range (ATR) based sizing strategy. It’s designed for use when setting up your trading client.

The most important part is the `logger`, which allows you to see what's happening under the hood – helpful for debugging and understanding how your sizing is calculated. Think of it as a way to get feedback on your trading system's decisions.

## Interface ISizingCallbacks

The `ISizingCallbacks` interface helps you hook into the sizing process of your backtest. It lets you observe and potentially influence how position sizes are determined.

Specifically, the `onCalculate` callback is triggered right after the framework calculates a potential position size. This is your chance to log the details of the calculation, perform checks to ensure the size makes sense, or even make adjustments based on custom logic. You can use this to ensure your sizing strategy is behaving as expected.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate trade sizes using the Kelly Criterion. To use this, you'll need to specify the method, which is always "kelly-criterion" in this context.  You also have to provide the win rate of your strategy, represented as a number between 0 and 1, and the average win/loss ratio, which describes how much you typically win compared to how much you lose on a trade.  These values feed into the Kelly Criterion formula to suggest an optimal position size.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the settings you’ll use when calculating your trade size based on a fixed percentage of your capital. You specify that the sizing method is "fixed-percentage" to tell the system how to approach the calculation.  You’ll also need to provide a `priceStopLoss`, which represents the price at which you’ll set your stop-loss order. This value is crucial for determining the appropriate position size.

## Interface ISizingCalculateParamsBase

This interface lays out the basic information needed when figuring out how much to trade. It includes the trading pair you're working with, like "BTCUSDT," the total amount of money you have in your account, and the price at which you intend to buy or sell. Think of it as the foundation for making sizing decisions – it provides the essential context for calculating trade sizes. Every sizing calculation will require knowing these core values.

## Interface ISizingCalculateParamsATR

This interface defines the information needed when calculating trade sizes using an ATR-based approach. It contains two key pieces of data: a `method` property that confirms we're using the ATR method, and the `atr` value itself, which represents the current Average True Range. Essentially, it's a simple container for the ATR value that's used in determining how much to trade.

## Interface ISizing

The `ISizing` interface is the core of how backtest-kit determines how much of an asset your strategy will buy or sell. Think of it as the engine for position sizing.

It has a single, crucial method called `calculate`.  This method takes a set of parameters – essentially, information about your risk tolerance and the current market conditions – and returns a number representing the calculated position size. It uses this calculation during strategy execution.


## Interface ISignalRow

The `ISignalRow` represents a finalized trading signal within the backtest-kit system. It's the standard format used after a signal has been validated and is ready to be executed.

Each signal gets a unique ID, a timestamp for when it was initially created (`scheduledAt`), and another for when the trade went pending (`pendingAt`).  You’ll also find key details like the entry price (`priceOpen`), the exchange and strategy used, the timeframe being analyzed, and the trading pair (`symbol`). 

A crucial piece is the `_partial` property, which tracks any partial closing of the position. This is essential for calculating accurate profit and loss (PNL) by considering how much of the position was closed at different prices. The framework automatically computes related values like `_tpClosed` and `_slClosed` for you.

Finally, signals can also use trailing stop-loss and take-profit prices (`_trailingPriceStopLoss` and `_trailingPriceTakeProfit`), which dynamically adjust the stop-loss and take-profit levels based on the current price movement, offering more flexible risk and reward management. These trailing prices supersede the originally set stop-loss and take-profit values during execution.

## Interface ISignalDto

This interface defines the structure of a signal used within the backtest-kit framework. Think of a signal as an instruction to buy or sell an asset.

It contains details such as the trade direction (long or short), a description explaining the reasoning behind the signal, and key price levels. These price levels include the entry price, the target price for taking profit, and the price for implementing a stop-loss.  There's also an estimate of how long the position is expected to last.  If you don't provide an ID when creating a signal, one will be automatically generated for you.

## Interface IScheduledSignalRow

This interface describes a signal that’s scheduled to be executed when the price hits a certain level. Think of it as a signal that’s waiting for a specific price to be reached before it actually triggers a trade. It builds upon a standard signal, but adds the concept of a delayed entry. 

Initially, the "pendingAt" time will reflect when the signal was scheduled, but once the price reaches the specified entry price, it updates to the actual time the signal started waiting.  The key piece of information here is `priceOpen`, which is the price level that, once reached, will transform this scheduled signal into a regular pending signal, ready to execute a trade.


## Interface IScheduledSignalCancelRow

This interface represents a scheduled trading signal that can be cancelled by the user. It builds upon the existing `IScheduledSignalRow` by adding a `cancelId`. Think of it as a way to track and identify signals that a user has specifically requested to be stopped. The `cancelId` property holds the unique identifier assigned when a user triggers a cancellation request.

## Interface IRiskValidationPayload

This interface, `IRiskValidationPayload`, is what's passed around when you're doing risk checks within your backtesting setup. Think of it as a package containing all the key information a risk validation function needs to make a decision.

It builds upon `IRiskCheckArgs`, adding details about your portfolio’s current state. 

Inside you’ll find:

*   `pendingSignal`:  This is the signal that's being considered for a trade – it includes all the data you need like the opening price.
*   `activePositionCount`:  A simple count of how many positions are already open.
*   `activePositions`: A detailed list of all currently active positions, giving you full insight into what's already in your portfolio.

## Interface IRiskValidationFn

This defines how you can check if a trade request is safe to execute. Think of it as a gatekeeper – it examines a potential trade and decides whether it should proceed. If everything looks good, it lets the trade through. If something’s amiss, it either explains *why* the trade is rejected with a detailed reason, or stops the trade and provides an error message. This helps ensure your trading system operates within defined risk boundaries.


## Interface IRiskValidation

This interface, `IRiskValidation`, helps you set up checks to ensure your trading strategies are safe and sound. Think of it as a way to define rules your strategies must follow before they can execute trades.

You provide a `validate` function – this is the actual code that performs the risk assessment, looking at things like account balance or position sizes. 

Optionally, you can add a `note` which acts like a comment, explaining *why* you’ve implemented this particular validation rule; this is useful for making your code easier to understand and maintain.

## Interface IRiskSignalRow

This interface, `IRiskSignalRow`, is designed to help with managing risk during trading. It builds upon the `ISignalDto` to provide crucial information needed for risk validation. Specifically, it includes the entry price of a position (`priceOpen`), and the initially set stop-loss and take-profit prices (`originalPriceStopLoss`, `originalPriceTakeProfit`) when the signal was created. This allows for accurate checks and calculations related to potential risk exposure.

## Interface IRiskSchema

This interface, `IRiskSchema`, lets you define and register your own custom risk controls for a trading portfolio. Think of it as a way to build rules that automatically check if a trade is safe to execute. 

You’ll give each risk control a unique `riskName` to identify it, and you can add a `note` to explain what it does. 

You can also include `callbacks` to react to when a risk check is rejected or allowed. The most important part is the `validations` array, where you'll put your actual risk-checking logic—functions or objects—that get applied to potential trades. This allows you to enforce your specific trading rules.


## Interface IRiskRejectionResult

This interface, `IRiskRejectionResult`, helps you understand why a trading strategy or portfolio didn't pass a risk validation check. When a validation fails, you’ll get an object like this back. It includes a unique `id` to track the specific rejection and a `note` field – a helpful explanation in plain English describing what went wrong. Think of it as a friendly message pinpointing the issue during your risk assessment.

## Interface IRiskParams

The `IRiskParams` object sets up the core environment for managing risk within the trading system. It essentially tells the risk management component *where* it's operating (the `exchangeName`), how to report issues (`logger`), and whether it's in a simulated backtesting environment (`backtest`).

Crucially, it includes an `onRejected` callback. This function is called when a trading signal is blocked because it would violate established risk limits. It's your chance to log details, potentially emit an event to a separate risk management system, and generally respond to the rejection before any further actions are taken.

## Interface IRiskCheckArgs

This interface, `IRiskCheckArgs`, holds all the information needed to decide if a new trade should be allowed. Think of it as a safety check run *before* a trading signal is actually created. It's packed with details like the trading pair (symbol), the pending signal itself, and information about the strategy requesting the trade, including its name, the exchange being used, and the designated risk profile. You'll also find the current price and timestamp, which are crucial for risk assessment. It effectively passes along key data from the ClientStrategy context for evaluation.

## Interface IRiskCallbacks

This interface defines optional functions you can use to get notified about risk-related events during trading.  Specifically, you can register a function to be called when a trading signal is blocked because it violates risk limits – this is the `onRejected` callback.  Alternatively, if a signal passes all the defined risk checks, the `onAllowed` function will be triggered. These callbacks allow you to react to risk assessments programmatically.

## Interface IRiskActivePosition

This interface describes a single, active trade being tracked by the risk management system. It holds all the key details about a position, like which strategy opened it, on which exchange, and what the entry price and stop-loss levels are. You'll see fields for the trade symbol, direction (long or short), and timestamps to help understand when the trade started. Think of it as a snapshot of a trade's important information for risk monitoring purposes.

## Interface IRisk

This interface, `IRisk`, is like a gatekeeper for your trading strategies, ensuring they stay within acceptable risk boundaries. It helps you keep track of your positions and prevent potentially dangerous trades. 

You'll use the `checkSignal` function to see if a new trading signal is safe to execute, given your risk rules.  

The `addSignal` function lets you register when a position is opened, providing details like the asset, strategy used, price levels, and estimated time.  

Finally, `removeSignal` allows you to notify the system when a position has been closed, cleaning up your tracking data.


## Interface IReportTarget

This interface lets you control exactly what kinds of events are logged during your backtesting process. Think of it as a checklist for the data you want to capture.

You can choose to log events related to risk management, when trades hit breakeven, partial order fills, heatmap data, walker iterations, performance, scheduled signals, live trading activity, or signals closed during backtesting.

By setting each property to `true` or `false`, you can tailor the logging output to focus on the specific areas you're investigating. This helps keep your logs manageable and focused on the insights you need.

## Interface IReportDumpOptions

This interface, `IReportDumpOptions`, helps you control how backtest data is saved and organized. Think of it as a set of labels you attach to your backtesting runs. You can use it to specify things like the trading pair being tested ("BTCUSDT"), the name of the strategy you're employing, the exchange involved, the timeframe being used (like 1-minute or 1-hour), a unique ID for the signal generated, and a name for the walker used in optimization.  Essentially, it lets you tag your backtest results with relevant information so you can easily filter, search, and understand them later.

## Interface IPublicSignalRow

The `IPublicSignalRow` interface helps you understand trading signals by providing extra information, especially about stop-loss and take-profit levels. It builds upon the existing `ISignalRow` to expose the original stop-loss and take-profit prices that were initially set when the signal was created.

Think of it as a way to see the initial plan alongside any adjustments that might have happened later, like if you’re using trailing stop-loss or take-profit. This is particularly helpful for keeping things clear and transparent in reports or user interfaces.

The `originalPriceStopLoss` and `originalPriceTakeProfit` properties always show those starting values, even if the actual stop-loss and take-profit levels change during trading.  You’ll also find `totalExecuted`, which tracks the total percentage of the position that has been closed through partial closing orders, useful for understanding how much of the trade has already been realized.

## Interface IPublicAction

This interface, `IPublicAction`, defines how you build custom action handlers that interact with the backtest-kit trading framework. Think of it as a blueprint for components that respond to events within a strategy.

Your action handler will be initialized with information like the strategy's name, the frame's name, and its own action name. It then goes through a lifecycle: first, an `init` method gives you a chance to perform any necessary setup – connecting to databases, setting up API clients, or loading configurations – all asynchronously. After that, various event methods are triggered as the strategy runs, allowing you to respond to signals, breakeven points, or partial profits. Finally, a `dispose` method is guaranteed to run once at the end, ensuring a clean shutdown and resource release.

This approach allows you to extend the framework’s capabilities. For example, you could use it to manage application state, send notifications through messaging platforms, keep detailed logs, or integrate with external systems for tasks like data analysis or writing to databases. The framework ensures the `init` and `dispose` methods run exactly once, providing a reliable setup and cleanup process.

## Interface IPositionSizeKellyParams

The `IPositionSizeKellyParams` interface helps you calculate position sizes using the Kelly Criterion, a popular method for determining optimal bet or trade size. It's designed to be straightforward, focusing on the core parameters needed for this calculation. You’ll specify your expected win rate, expressed as a number between 0 and 1, and also your average win-loss ratio – essentially, how much you typically win on a winning trade compared to how much you lose on a losing one. These two values are the key inputs for the Kelly Criterion's position sizing formula.


## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed for a trading strategy that uses a fixed percentage of your capital to size each trade, but incorporates a stop-loss order. Specifically, you’ll use this to tell the backtest system the price at which to place a stop-loss order for your trades. Think of it as setting the level where you'll cut your losses if the trade doesn't go as planned.

## Interface IPositionSizeATRParams

This section describes the parameters used when calculating position size based on the Average True Range (ATR). Essentially, you'll find details about the data needed for this calculation. The most important piece of information is the current ATR value, represented as a number. This value directly influences how much capital you'll allocate to a trade.

## Interface IPersistBase

This interface helps you build custom ways to save and load your trading data. Think of it as a standard set of actions – initialize, read, check if something exists, and write – that any persistence system (like a database or file storage) needs to support. It makes sure your custom storage solutions work smoothly with the backtest-kit framework.

Specifically, `waitForInit` sets up the storage and makes sure it’s ready, only happening once. `readValue` retrieves data, `hasValue` quickly verifies if data is present, and `writeValue` securely saves your data. These methods provide the fundamental building blocks for any persistence adapter.


## Interface IPartialData

This interface, `IPartialData`, represents a snapshot of data needed to resume a trading signal's progress. Think of it as a way to save a signal's state – specifically, where it’s reached in terms of profit and loss.  It focuses on the key levels achieved, turning sets of levels into simple arrays so they can be easily saved and restored. These saved pieces of information are then used to rebuild the full signal state when you restart. The `profitLevels` and `lossLevels` properties hold these level arrays, which are essentially records of the signal’s performance.


## Interface IPartial

This interface, `IPartial`, is all about keeping track of how a trading signal is performing – whether it's making money (profit) or losing money (loss). It's designed to notify you when a signal hits important milestones, like reaching 10%, 20%, or 30% profit or loss.

The `profit` method handles situations where a signal is generating a return; it figures out which milestones have been achieved and alerts you to any new ones.  A similar process happens with the `loss` method when a signal is experiencing losses.

Finally, when a trading signal closes – perhaps it hit a take profit or stop loss – the `clear` method is used. This cleans up all the information related to that signal, ensuring things are tidy and ready for the next trade.

## Interface IParseArgsResult

This interface describes what you get back when you use the `parseArgs` function to process command-line arguments. It essentially tells you whether the system should be running in backtest, paper trading, or live trading mode.  You’ll find boolean flags like `backtest`, `paper`, and `live` that indicate which type of environment is active, based on how you launched the application. This helps the framework configure itself appropriately for the chosen trading scenario.

## Interface IParseArgsParams

This interface describes the settings you can provide when running a trading strategy. Think of it as a blueprint for what information the backtest-kit needs to know to get started. It specifies things like which cryptocurrency pair you want to trade (the 'symbol'), the name of the strategy you're using, which exchange the strategy will connect to, and the timeframe for the price data it will analyze. Essentially, it's a set of default values to configure a backtest.

## Interface IOrderBookData

This interface, `IOrderBookData`, represents the information you get from an order book, which is essentially a snapshot of all the buy and sell orders waiting to be executed.  It includes the `symbol` being traded, like "BTCUSDT".  You’ll also find arrays of `bids`, which are orders to *buy* the asset, and `asks`, which are orders to *sell* the asset. Each element within the `bids` and `asks` arrays contains details about individual orders.

## Interface IOptimizerTemplate

This interface provides building blocks for creating code and messages used within the backtest-kit trading framework. Think of it as a set of tools to automate the generation of different components needed for your trading strategies and backtesting processes.

It allows you to create initial setup code, like import statements and basic configurations, using methods like `getTopBanner`. You can also generate customized messages designed for communication with Large Language Models (LLMs), separating content for the user (`getUserMessage`) and the assistant (`getAssistantMessage`).

The framework uses templates to generate configurations for core parts of your backtesting environment, including `Walker` (the main execution engine), `Exchange` (connecting to the market), `Frame` (defining the timeframe), `Strategy` (your trading logic), and `Launcher` (starting the backtest).  Finally, there are helper functions, `getTextTemplate` and `getJsonTemplate`, that help you structure your LLM interactions for more predictable results.  `getJsonDumpTemplate` produces code for debugging purposes.

## Interface IOptimizerStrategy

This interface, `IOptimizerStrategy`, holds all the information about a trading strategy created using an LLM. Think of it as a complete record of how the strategy was born. It includes the trading symbol it’s designed for, a unique name to identify it, and a detailed history of the conversation with the LLM that shaped it.  You’ll find the prompts and responses from both the user and the assistant, offering full transparency into the strategy's reasoning. Finally, the `strategy` property contains the actual strategy logic—the instructions the system will follow.


## Interface IOptimizerSourceFn

The `IOptimizerSourceFn` defines how your backtest data is fed to the optimization engine. Think of it as a function that provides the historical data needed to test different trading strategies.  It's designed to handle large datasets efficiently using pagination, meaning it doesn't load everything at once, but rather in chunks. Crucially, each piece of data it provides must have a unique identifier so the optimizer can track it. This ensures that your optimization process has a reliable and structured flow of information.

## Interface IOptimizerSource

This interface describes where your backtest data comes from and how it’s prepared for use, especially for things like large language models. 

Each data source needs a unique name to help identify it during the backtesting process. You can also add a description to give context about the data.

The most important part is the `fetch` function, which is responsible for retrieving the backtest data itself. It needs to handle fetching data in chunks, using concepts like limits and offsets to manage large datasets.

Finally, you have the flexibility to customize how the data is presented as messages for the LLM. `user` formats what the LLM "sees" as the user's input, and `assistant` controls how the LLM's responses are formatted. If you don’t define these, the framework will use default formatting methods.


## Interface IOptimizerSchema

This schema defines the blueprint for how your backtesting optimizer will work. Think of it as a configuration file that tells backtest-kit how to gather data, create strategies, and ultimately test their performance.

You’ll give your optimizer a unique name so the system can easily identify it. It also lets you describe the optimizer with an optional note.

The `rangeTrain` property lets you specify multiple training periods – essentially, creating several versions of your strategy trained on slightly different data for comparison. `rangeTest` designates the time period used to validate the effectiveness of the generated strategies.

`source` defines the data sources – like historical price data or alternative indicators – that will be used to inform the strategy generation process.  The `getPrompt` function is crucial; it crafts the instructions (prompt) given to the language model to generate trading strategies, using the collected data and conversation history. 

You can customize the strategy generation with the `template` property, although default settings are provided if you don't. Finally, `callbacks` give you a way to hook into the optimization process to monitor its progress.

## Interface IOptimizerRange

This interface helps you define specific time periods for your backtesting and optimization work. Think of it as setting the boundaries for when your trading strategies will be evaluated. You specify a `startDate` and `endDate` representing the beginning and end dates of that period, making sure you're only looking at the data you want.  It’s a great way to isolate particular market conditions, like a bull market or a specific quarter. You can also add an optional `note` to describe the range, which is handy for keeping track of what each period represents.

## Interface IOptimizerParams

This interface defines the essential configuration needed to set up a ClientOptimizer. It essentially packages together two key components: a logger to help you track what's happening during optimization, and a complete template that provides all the methods for performing the optimization process itself. The logger allows you to see debugging information and progress updates, while the template dictates the specific optimization strategy being used. Think of it as providing the optimizer with its tools and a way to communicate what it’s doing.

## Interface IOptimizerFilterArgs

This interface defines the information needed to request specific data from a data source. Think of it as a way to tell the system precisely what data you’re looking for. You'll use it to specify the trading pair, like "BTCUSDT," along with a defined start and end date for the data you need. Essentially, it's a focused request for data within a certain timeframe and for a particular asset.

## Interface IOptimizerFetchArgs

When fetching data for optimization, this interface defines how much data to grab at a time. You can think of it as telling the system how many records you want in each chunk and where to start looking. The `limit` property controls the maximum number of records fetched per request, defaulting to 25, and the `offset` property allows you to skip over a portion of the data, useful for navigating through large datasets. This lets you efficiently load data for optimization without overwhelming the system.


## Interface IOptimizerData

This interface, `IOptimizerData`, is the foundation for how data is fed into the backtest-kit optimizer. Think of it as a blueprint for all the data sources that will be used to test different trading strategies. Crucially, every data source needs to provide a unique `id` for each piece of information it delivers. This `id` acts as a way to prevent duplicates, which is super important when you're dealing with potentially massive datasets and working through them in chunks. It ensures you're only evaluating each data point once.


## Interface IOptimizerCallbacks

This interface lets you tap into different moments during the optimization process to keep an eye on things or make sure everything's working as expected. You can be notified when strategy data is ready, when the strategy code is generated, or after it's written to a file. There's also a callback for when data is initially fetched from a data source, giving you a chance to inspect that data too. Essentially, it’s a way to add your own custom checks and logging throughout the backtest-kit workflow.


## Interface IOptimizer

This interface defines how you interact with the optimization process in backtest-kit. Think of it as a way to get information and code related to your trading strategies. The `getData` method retrieves strategy information, essentially gathering the raw data and preparing it for further processing.  `getCode` then takes that prepared data and produces a complete, runnable code file for your strategy. Finally, `dump` combines those actions—it generates the code and saves it directly to a file on your system, so you don't have to do it manually.


## Interface InfoErrorNotification

This notification lets you know about issues that pop up during background processes, but aren't critical enough to stop everything. Think of it as a heads-up about something needing attention. 

Each notification carries a few key details: a unique identifier (`id`) to track it, a timestamp marking when it occurred, and a boolean (`backtest`) to specify if it happened during backtesting. There's also a description of the problem (`message`) and the actual error object itself (`error`), giving you specifics to investigate. It's a straightforward way to monitor what's happening under the hood and address any problems that arise.

## Interface IMethodContext

The `IMethodContext` interface acts as a little helper, carrying important information about which parts of your trading system should be used for a specific operation. Think of it as a set of labels – `exchangeName`, `strategyName`, and `frameName` – that tell the system exactly which exchange, strategy, and historical data frame it should be working with. This context is automatically passed around within the backtest-kit framework, so you don't have to manually manage it, making it easier to keep everything organized and consistent. When running a live trade, the `frameName` will be empty, indicating that no historical data frame is needed.

## Interface IMarkdownTarget

This interface lets you pick and choose which detailed reports your backtest generates. Think of it as a way to filter the information you receive, so you only see what's most important for your analysis.

You can turn on reports for things like risk rejections (when your strategy would have been blocked), breakeven events (when your stop loss hits your entry price), or partial profit/loss tracking. 

There are also reports for portfolio heatmaps, strategy comparisons, performance bottlenecks, scheduled signals, and live trading events.

Finally, you can enable a full backtest report which includes your main strategy results alongside all the trade history. Essentially, it gives you fine-grained control over the level of detail in your backtest reports.

## Interface IMarkdownDumpOptions

This interface, `IMarkdownDumpOptions`, helps organize the information needed when creating documentation reports, especially in Markdown format. Think of it as a container for details about a specific backtest run, like the trading pair involved (symbol), the strategy used, the exchange it ran on, and the timeframe of the data.  You’ll find properties like `path` which specifies where the report should be saved relative to your project, and `file` which dictates the report's filename. The `symbol`, `strategyName`, `exchangeName`, `frameName` and `signalId` fields allow you to filter and pinpoint particular backtest results for documentation purposes, making it easy to keep your documentation focused.

## Interface ILogger

The `ILogger` interface defines how different parts of the backtest-kit framework can record information about what’s happening. Think of it as a way to keep a detailed journal of the system's activities. 

It provides several logging methods – `log`, `debug`, `info`, and `warn` – each representing a different level of importance. The `log` method is for general notes about significant events, while `debug` is for more granular details helpful during development and troubleshooting.  `info` covers regular, successful operations, and `warn` flags potential issues that need a closer look. These logs are useful for tracking what the system is doing, spotting errors, and generally understanding its behavior.

## Interface IHeatmapRow

This interface represents a row of data for a portfolio heatmap, providing a snapshot of performance for a specific trading symbol like BTCUSDT. It bundles together key metrics calculated across all strategies applied to that symbol, giving you a quick view of how it's performing.

You'll find information like the total profit or loss, how the risk-adjusted return compares to the drawdown, and the number of trades won versus lost. It also includes details on average trade sizes, win rate, and streaks of wins or losses. Ultimately, this interface helps you easily compare the performance of different symbols at a glance, identifying which ones are contributing the most (or least) to your overall portfolio.

## Interface IFrameSchema

This defines a blueprint for how your backtesting data is structured, essentially setting the stage for how your trading simulations will unfold. Think of it as specifying the time period and frequency of data you'll be using – for example, a frame might cover daily data from January 1st, 2023, to December 31st, 2023. 

Each frame gets a unique name so you can easily identify it, and you can add notes for yourself to remember what that frame represents. The `interval` property dictates how often timestamps will be generated within that frame. You'll specify a start and end date, clearly marking the boundaries of your backtest. Finally, you can include optional callbacks to execute specific actions at certain points in the frame’s lifecycle.

## Interface IFrameParams

The `IFrameParams` interface defines the information needed to set up a trading frame within the backtest-kit framework. Think of it as the initial configuration for a simulated trading environment. 

It builds upon the `IFrameSchema`, providing additional details for setup. 

Crucially, it includes a `logger` property; this is a tool to help you monitor what's happening inside the trading frame, allowing for debugging and understanding the simulation’s behavior. It’s like having a digital notepad that records key events during the backtest.


## Interface IFrameCallbacks

This section describes the `IFramesCallbacks` interface, which lets you hook into important moments in the backtest-kit's timeline creation process. Think of it as a way to be notified and potentially react to how the framework is setting up the trading periods for your backtest. 

Specifically, the `onTimeframe` property lets you receive a notification whenever the framework finishes creating the array of dates it will use for trading. This is really handy if you want to check if the timeframe data looks correct, or just want to log details about the timeframe creation for debugging purposes. You’ll get the dates themselves, the start and end dates of the entire period, and the interval used to generate those dates.

## Interface IFrame

The `IFrame` interface is a core part of backtest-kit, handling how your backtesting data is organized and accessed over time. Think of it as the engine that creates the timeline for your trades.  The primary function, `getTimeframe`, is responsible for generating a sequence of dates – essentially, the timestamps – that your backtesting strategy will iterate through. You give it a symbol (like 'AAPL') and a frame name (like '1h' for hourly data), and it returns an array of dates representing those points in time, spaced out according to how the timeframe is defined. This helps ensure your strategy is tested against a consistent and accurate historical sequence.

## Interface IExecutionContext

The `IExecutionContext` acts as a container for important information your trading strategies and exchanges need to function. Think of it as a shared set of parameters that's passed around to give your code the context it requires. 

It holds details like the trading symbol you're working with (like "BTCUSDT"), the current date and time, and whether the code is running in a backtesting environment or live trading. This context helps your strategies know what they’re dealing with and makes operations such as fetching historical data or processing trades much simpler.


## Interface IExchangeSchema

This schema describes how backtest-kit connects to different cryptocurrency exchanges or data sources. Think of it as a blueprint for telling the framework where to get historical price data and how to handle order quantities and prices according to each exchange’s specific rules.

You'll give it a unique name to identify the exchange you’re using.  You can also add a note for your own reference.

The `getCandles` function is the most important part; it’s what the framework uses to actually retrieve historical price data (candlesticks) for a trading pair.

`formatQuantity` and `formatPrice` are optional, but highly recommended. They ensure orders are placed with the correct precision as required by the exchange; otherwise, the framework will use default values which may not be suitable.

If you need order book data, you can provide a `getOrderBook` function; otherwise, it won’t be available.

Finally, `callbacks` let you add custom actions that trigger at specific moments, like when new candle data arrives.

## Interface IExchangeParams

This interface defines the necessary configuration your exchange connection needs to function within backtest-kit. Think of it as providing the core tools and instructions for the framework to interact with a specific exchange. 

It includes things like a logger for tracking activity, an execution context to manage test conditions, and crucially, functions to retrieve candle data (historical price information), format order quantities and prices to match the exchange's rules, and fetch order book data. 

You'll need to provide implementations for all of these functions when setting up your exchange integration; default values are available but you’ll likely need to customize them for accurate simulation.  The `getCandles`, `formatQuantity`, `formatPrice`, and `getOrderBook` functions are all essential to make the backtesting process work correctly.

## Interface IExchangeCallbacks

This interface lets you listen in on what's happening with your exchange data. Specifically, the `onCandleData` property allows you to define a function that gets triggered whenever new candlestick data becomes available. You'll receive details about the symbol, the time interval (like 1 minute or 1 day), the starting date, the number of data points fetched, and an array containing the actual candlestick data. This is helpful if you want to react to new data arriving, potentially updating visualizations or triggering other processes.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with an exchange to get data and prepare orders. It essentially provides a standardized way to access historical and future candle data, crucial for recreating trading scenarios.

You can use it to request past candles for a specific trading pair and time interval, or to look ahead and grab future candles for backtesting purposes. It also includes handy functions to ensure your order quantities and prices are formatted correctly for the exchange's specific requirements.

Need to know the recent average price? There's a method to calculate the VWAP (Volume Weighted Average Price) based on recent trading activity. And if you want to see the current market depth, you can fetch the order book data.

## Interface IEntity

This interface, `IEntity`, serves as a foundation for anything you want to store persistently within the backtest-kit framework. Think of it as a common blueprint—if you’re creating something that needs to be saved or loaded later, it should probably implement this interface. It provides a standard structure that the framework can use to manage and work with those saved objects.

## Interface ICandleData

This interface, `ICandleData`, represents a single candlestick in your trading data. Think of it as a snapshot of price action and volume over a specific time interval. Each candlestick holds information about when it started (`timestamp`), the opening price (`open`), the highest price (`high`), the lowest price (`low`), the closing price (`close`), and the total trading volume (`volume`) during that period. It's a fundamental building block for backtesting strategies and calculating indicators like VWAP.

## Interface IBreakevenData

This interface, `IBreakevenData`, is designed to make it easy to save and load information about when a breakeven point has been achieved in your trading strategy. Think of it as a simple snapshot of that data, specifically for storing it in a way that can be easily converted to JSON. It holds just one piece of information: whether or not the breakeven has been reached. This allows the system to remember the breakeven status even after it's shut down and restarted.

## Interface IBreakeven

This interface helps track when a trading signal's stop-loss order should be adjusted to the entry price, essentially achieving a breakeven point. It's used by different parts of the backtest-kit system to monitor signals and manage this breakeven state.

The `check` method is responsible for determining if breakeven has been reached – it verifies that the price has moved favorably enough to cover transaction costs and that breakeven hasn't already been achieved. If the conditions are met, it marks the signal as at breakeven, triggers a notification, and saves the information.

The `clear` method handles resetting the breakeven state when a signal is closed, whether by hitting a take profit or stop-loss level, or simply expiring. This cleans up the system's memory and ensures that the state is properly saved.

## Interface IBidData

This interface describes a single bid or ask price within an order book. It’s essentially a snapshot of what someone is willing to buy or sell at a specific price and volume. Each bid or ask is represented by its `price`, which is stored as a string, and the `quantity` available at that price, also stored as a string. Think of it as one line from a market depth chart.

## Interface IActionSchema

This defines how you can add custom functionality to your trading strategies. Think of it as a way to plug in extra logic that responds to events happening during a trade.

You can use these actions to do things like keep track of what's happening in your strategy – sending updates to a monitoring system, logging important events, or even triggering actions based on the strategy's state.

Each action gets its own instance for every strategy and timeframe you’re using, and it receives all the data generated during that strategy's run. You can have several actions working together on a single strategy.

To create one, you'll give it a unique name, an optional note for your own records, and then provide either a constructor function that builds the action or provide the actual action methods directly. You can also specify callbacks for specific points in the action's lifecycle.

## Interface IActionParams

`IActionParams` bundles all the information an action needs to run effectively, acting as a central container for context and tools. Think of it as a package delivered to each action, telling it *where* it's running (strategy and timeframe), *who* it's working for (the logger), and whether it’s a simulation (backtest mode). It provides a way to log your actions’ behavior for troubleshooting and tracking, and importantly, identifies which strategy and timeframe the action belongs to.  The `exchangeName` property lets the action know which exchange it’s interacting with.

## Interface IActionCallbacks

This interface, `IActionCallbacks`, provides a way to hook into different stages of an action handler’s lifecycle, whether it's running a backtest or live trading. Think of it as a set of customizable event listeners you can use to manage resources or track activity.

You can use `onInit` to prepare your action handler when it starts up – like setting up database connections or loading any saved data. Conversely, `onDispose` lets you clean up when the handler shuts down, closing connections and saving any changes.

For monitoring and tracking, there are several signal-related callbacks. `onSignal` is a general catch-all for signals from both live and backtest modes. If you need to react specifically to live or backtest signals, `onSignalLive` and `onSignalBacktest` provide more targeted notifications.

Beyond core signals, there are callbacks for specific events, such as `onBreakevenAvailable` (when the stop-loss hits the entry price), `onPartialProfitAvailable` and `onPartialLossAvailable` (when profit/loss targets are reached), and `onPingScheduled`/`onPingActive` (related to signal monitoring). Finally, `onRiskRejection` alerts you when a signal fails risk management validation.  All these callbacks are optional, and you can handle them synchronously or asynchronously.

## Interface IAction

The `IAction` interface provides a way to connect your custom logic to the trading framework, letting you respond to various events as the strategy runs, whether it’s in backtest or live mode. Think of it as a central hub for handling important notifications.

You can use this interface to do things like send data to a dashboard, log events for debugging, or integrate with a state management library like Redux.  The `signal` method is the most common – it receives information from every tick or candle processed by the strategy.  Specific methods like `signalLive` and `signalBacktest` allow you to react differently depending on whether you’re in live or backtest mode.

Beyond just signals, you'll also get notified about breakeven events, partial profit/loss levels, scheduled ping activity, risk rejections, and more. Finally, `dispose` is crucial for cleaning up when the action handler is no longer needed, ensuring you don’t leave any lingering connections or subscriptions.

## Interface HeatmapStatisticsModel

This model neatly organizes the overall performance data for your trading portfolio, presenting a comprehensive view across all the assets you're tracking. It breaks down key metrics like the total profit and loss (PNL) and the Sharpe Ratio, which measures risk-adjusted return, across the entire portfolio. You'll also find the total number of trades executed and a list of individual symbol statistics, allowing you to pinpoint which assets are contributing the most to your portfolio’s results. Think of it as a high-level dashboard for your trading activity.

## Interface DoneContract

This interface, `DoneContract`, is all about letting you know when a background task – whether it's a backtest or a live trading run – has finished.  It provides key details about what just completed. You’ll find the name of the exchange used, the specific strategy that ran, and a frame name if you were in backtest mode (it'll be blank for live trading).  It also tells you if the process was a backtest or a live execution, and importantly, identifies the trading symbol involved. Think of it as a notification package with all the important identifying information.

## Interface CriticalErrorNotification

This notification signals a severe problem within the backtest-kit framework that demands immediate attention and typically requires the process to stop. It's triggered when something goes wrong at a level that prevents the backtest from continuing safely. 

The notification includes several pieces of information to help diagnose the issue. You’ll find a unique ID for tracking, the actual error object itself, a descriptive error message, a timestamp indicating when the error occurred, and a flag confirming that this error arose during a backtest run. Think of it as an alert that something critical has happened and needs investigation.

## Interface ColumnModel

This interface, `ColumnModel`, helps you define how data should be presented in a table. Think of it as a blueprint for each column you want to display. 

It lets you specify a unique `key` for each column, a user-friendly `label` to show in the header, and a `format` function. This `format` function is really powerful - it lets you transform your data into exactly the string representation you need for display. 

You can also control the visibility of a column using the `isVisible` function, allowing you to dynamically show or hide columns based on certain conditions. Essentially, it provides a flexible way to structure and present your data in a tabular format.

## Interface BreakevenStatisticsModel

This model holds information about breakeven events encountered during a backtest. It essentially keeps track of when a trade reaches a breakeven point. You'll find a complete list of these events, each with detailed information, stored in the `eventList` property. The `totalEvents` property simply tells you how many breakeven events were recorded overall.

## Interface BreakevenEvent

The BreakevenEvent provides a standardized way to track when a trading signal has reached its breakeven point. It bundles together key data points, making it easier to generate reports and analyze trading performance.

You'll find information like the exact time the breakeven was hit, the symbol being traded, the name of the strategy that generated the signal, and a unique identifier for that signal. 

The event also includes the entry price (breakeven level), take profit, stop loss prices—both the initially set values and the current market price— along with details about any partial closes that have occurred. A human-readable note can be added to explain the reasoning behind the signal, and a flag indicates whether the event occurred during a backtest or live trading session.

## Interface BreakevenContract

The `BreakevenContract` represents a significant moment in a trading strategy – when the stop-loss for a trade is moved to the entry price, effectively recouping the initial risk. This happens when the price moves favorably enough to cover any transaction costs.

It provides key details about this event, including the trading pair's symbol, the name of the strategy that generated the signal, and the exchange and frame it's running on. You'll also find comprehensive signal data, the current price that triggered the breakeven, and whether the event occurred during a backtest or live trading.

Think of it as a notification that a trade is performing well enough to eliminate the initial risk, useful for tracking progress and ensuring the strategy remains safe. It’s designed to be reliable, meaning you’ll only receive this notification once per signal. This data is consumed by reporting services and allows users to monitor their trading activity.

## Interface BootstrapNotification

This notification signals the start of the notification tracking system within the backtest-kit framework. It's like a "ready" signal, letting you know that the system is prepared to begin recording events. Each notification session has a unique identifier, represented by the `id` property. The `timestamp` tells you exactly when this initialization happened, providing a clear reference point for all subsequent notifications.

## Interface BacktestStatisticsModel

This model holds all the key statistical information calculated after running a backtest. Think of it as a report card for your trading strategy.

It includes a detailed list of every trade that was closed, along with how much profit or loss it generated. 

You'll find basic counts like the total number of trades, and how many were winners versus losers. 

More importantly, it provides performance metrics like the win rate (percentage of profitable trades), average profit per trade, total profit across all trades, and a measure of risk (standard deviation).

The Sharpe Ratio and its annualized version help you understand your strategy’s return relative to the risk taken, while the Certainty Ratio indicates how much more profitable your winning trades are compared to your losing ones. Finally, there's an estimate of your yearly returns based on trade duration and profits. Keep in mind that any of these numerical values might be missing if the backtest resulted in unstable calculations.

## Interface BacktestDoneNotification

This notification signals that a backtest has finished running. It’s sent when the backtest process is complete and provides key information about the test. You’ll find details like a unique identifier for the backtest, the precise timestamp of its completion, and confirmation that it was indeed a backtest. It also includes specifics about the asset being tested (the symbol), the strategy employed, and the exchange used for the backtest.

## Interface ActivePingContract

The ActivePingContract helps you keep tabs on what's happening with your active trading signals. It sends out a notification, roughly every minute, while a signal is still open and being monitored. This notification includes important details like the trading pair (symbol), the strategy name, and the exchange involved. 

You'll also receive all the signal's data, such as its ID, position size, and take profit/stop loss prices. A flag tells you whether this ping is from a backtest (historical data) or a live trade. Finally, a timestamp indicates exactly when the ping occurred - either the live trade time or the candle time during a backtest. You can use this information to create custom logic and respond to changes in your signals as they develop.
