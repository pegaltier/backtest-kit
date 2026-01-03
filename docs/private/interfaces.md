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

This interface defines a signal that's sent when a walker needs to be stopped. Think of it as an alert that a specific trading strategy, running under a particular name, needs to be halted. 

It's especially useful when you have several strategies running at the same time – the `walkerName` property lets you precisely target which one you want to pause. 

The signal includes the trading symbol, the name of the strategy being stopped, and the specific walker associated with that strategy.

## Interface WalkerStatisticsModel

The WalkerStatisticsModel helps you understand how different trading strategies performed during a backtest. It's like a combined report, building upon the basic WalkerResults to give you extra information when comparing strategies. 

Specifically, it presents a list of strategy results, allowing you to easily analyze and contrast their performance metrics side-by-side. Think of it as a structured way to see which strategies did well and why.

## Interface WalkerContract

The `WalkerContract` helps you keep track of how a backtesting comparison is progressing. It provides updates whenever a strategy finishes its test and gets ranked. 

Each update contains information like the walker's name, the exchange and frame being used, the symbol being tested, and the name of the strategy that just completed.  You’ll also see key statistics about that strategy’s performance, along with the metric value being optimized. 

The contract also tells you what the best-performing strategy is so far, how many strategies have been tested, and the total number that remain. This allows you to monitor the optimization process and see how strategies are stacking up against each other.

## Interface WalkerCompleteContract

This interface represents the culmination of a backtesting process, signaling that all strategies have been run and the final results are ready. It bundles together all the key details from a walker run, providing a complete picture of the testing.

You’ll find information like the name of the walker, the financial instrument being tested (symbol), and the exchange and timeframe used. The interface also tells you which optimization metric was employed and how many strategies were evaluated.

Crucially, it identifies the best-performing strategy – its name, the metric value it achieved, and detailed statistics about its performance are all included. This allows you to easily access and analyze the most successful approach.

## Interface ValidationErrorNotification

This notification signals that something went wrong during a risk validation check within your backtesting setup. It's triggered when a risk function encounters an error and can't proceed as planned. 

The notification itself provides several details to help you understand and debug the issue. You'll find a unique identifier (`id`) for tracking the error, a timestamp to pinpoint when it happened, and a descriptive `message` explaining the problem.  The `error` property holds the raw error object for more technical details. Finally, the `backtest` flag confirms this error occurred during a backtest run.

## Interface ValidateArgs

This interface, `ValidateArgs`, acts as a central point for ensuring that the names of different components in your backtesting setup are valid. Think of it as a checklist to prevent errors caused by typos or incorrect references.

It specifies the expected names for things like the exchange you’re using, the timeframe of your data (e.g., 1-minute, 1-hour), the strategy you’re testing, the risk profile, how you're sizing your trades, the optimizer, and the walker.

Each of these properties accepts an enum type, which means it's checking if the name you're using is one of the allowed options that your system recognizes. This helps catch potential issues early on and keeps your backtesting process running smoothly.

## Interface TickEvent

The `TickEvent` object brings together all the essential information about a trading event, making it easier to analyze and report on your backtest results.  Think of it as a single record representing what happened during a trade. Each `TickEvent` has a timestamp indicating when it occurred, and an `action` type describing the event - whether it's an initial state, a trade being opened, actively running, or being closed. 

For trades that are actively happening, you'll find details like the trading pair's symbol, the signal's ID, the position type, any notes associated with the signal, the current price, and the target prices for take profit and stop loss.  As a trade runs, you can track progress toward those targets with `percentTp` and `percentSl`. When a trade is closed, you'll see the final PnL percentage, the reason for closing, and how long the trade lasted.  Essentially, `TickEvent` provides a comprehensive view of each trading event, unified across different actions.

## Interface SignalScheduledNotification

This notification lets you know when a trading signal has been planned for execution in the future. It’s essentially a heads-up that the system is going to act on a signal at a specific time.

The notification includes a lot of useful details: a unique identifier for the signal, a timestamp, whether it’s part of a backtest, the trading symbol involved, the name of the strategy that generated the signal, the exchange being used, a signal ID, the intended position (long or short), the opening price, the exact time the signal is scheduled, and the current market price. This information is crucial if you want to monitor, debug, or react to these scheduled signals.


## Interface SignalOpenedNotification

This notification tells you when a new trading position has started. It provides a wealth of information about that new position, allowing you to track and analyze exactly what's happening. You'll find details like a unique ID for the notification, the exact time it occurred, and whether it's part of a backtest. 

The notification also lists the symbol being traded, the name of the strategy that initiated the trade, and the exchange involved. Crucially, it specifies the position type (long or short), the opening price, and the take profit and stop loss levels. Finally, there's a 'note' field that allows for additional details or context related to the trade.

## Interface SignalData$1

This `SignalData` object holds all the key details about a finished trading signal. Think of it as a record of one completed trade. It tells you which strategy created the signal, gives it a unique ID, and specifies the asset being traded (like BTC/USDT). You'll find the direction of the trade – whether it was a long or short position – along with the percentage profit or loss (PNL) achieved.  Crucially, it explains *why* the signal closed, and also provides the exact timestamps of when the trade was opened and closed. This information is essential for analyzing a backtest and understanding how the trading strategy performed.

## Interface SignalClosedNotification

This notification lets you know when a trading position, initiated by a signal, has been closed. It provides a detailed breakdown of what happened, including the signal's unique identifier, the trading symbol involved, and the name of the strategy and exchange used. You'll see key information like the opening and closing prices, the percentage profit or loss, and the reason why the position was closed – whether it was a Take Profit (TP), Stop Loss (SL), or another event. 

The notification also includes the timestamp of the closure, whether the backtest is live or historical, the direction of the position (long or short), how long it lasted, and any notes associated with the event. Having this data helps you analyze your trading decisions and understand the performance of your strategies.

## Interface SignalCancelledNotification

This notification lets you know when a previously scheduled trading signal has been canceled before it was actually executed. It provides a lot of details about the canceled signal, so you can understand why and what happened. 

You'll find information like the signal's unique ID, the time it was cancelled, and whether the backtest was running. It also includes the symbol, strategy, and exchange involved, along with the intended position (long or short).

Critically, the notification tells you *why* the signal was canceled, via the `cancelReason` property, and gives you a unique identifier for that cancellation.  Finally, the `duration` property indicates the intended time the signal was scheduled for.

## Interface ScheduleStatisticsModel

This model gives you a snapshot of how your scheduled signals are performing. It essentially tracks all the events related to your signals – when they're scheduled, when they activate, and when they get cancelled.

You'll find a complete list of all these events in the `eventList` property, providing detailed information for each one. The other properties offer summarized counts: the total number of events, how many signals were scheduled, how many were activated, and how many were cancelled. 

It also calculates key performance indicators to help you understand your scheduling strategy. The `cancellationRate` shows you the percentage of signals that are cancelled, which you'll want to keep as low as possible. The `activationRate` tells you the percentage that successfully activated. Finally, average waiting times for both cancellations and activations, expressed in minutes, offer insights into potential delays.

## Interface ScheduledEvent

This interface bundles all the key details about scheduled, opened, and cancelled trading events into a single, consistent structure, making it easier to generate reports and analyze activity. Each event record includes a timestamp marking when it occurred. You’ll find information like the type of action (scheduled, opened, or cancelled), the trading symbol involved, and a unique signal ID.

The record also captures specifics about the trade itself, such as the position type, any notes associated with the signal, the entry price, take profit levels, and stop-loss boundaries. For closed events, a close timestamp and duration are provided, while cancelled events detail the reason for cancellation and a unique ID if the cancellation was initiated by a user. Essentially, it's a comprehensive snapshot of each event's lifecycle.

## Interface RiskStatisticsModel

This model holds information about risk rejections, helping you understand where your risk management is being triggered. It includes a list of all the specific risk events that occurred, along with the total number of rejections. You can also break down those rejections to see which symbols or strategies are experiencing the most issues. This lets you pinpoint areas needing closer attention and refine your risk management strategies accordingly.


## Interface RiskRejectionNotification

This notification lets you know when a trading signal was blocked by your risk management system. It provides a lot of detail about *why* the signal wasn't executed. You'll see information like the signal's ID, the timestamp it was rejected, whether it was during a backtest, and which symbol and strategy were involved.

It includes specifics about the exchange used, a note explaining the reason for the rejection, and a unique rejection ID for tracking. You'll also find data about your current open positions, the current price of the asset, and the signal itself (in a standardized format). Essentially, it's a comprehensive report on a risk-related trade blockage.

## Interface RiskEvent

This data structure helps you understand why your trading signals might have been blocked. It holds all the important details about a rejected signal, like when it happened, which trading pair was involved, and the name of the strategy that generated it.

You'll find information about the signal itself, the current market price, and how many positions you already had open at the time. 

A unique ID is provided for each rejection, along with a note explaining why the signal was rejected. Finally, it tells you whether the rejection occurred during a backtest or in live trading conditions.

## Interface RiskContract

The RiskContract provides information about signals that were blocked due to risk checks. It's designed to help you understand why your trading strategies' signals aren't always executed, focusing specifically on situations where risk limits were breached.

Each RiskContract contains details such as the trading pair involved (symbol), the specific signal that was rejected (pendingSignal), the strategy that attempted to place the trade (strategyName), and the exchange being used (exchangeName).  You’ll also find the price at the time of rejection (currentPrice), the total number of active positions (activePositionCount), and a unique ID for tracking (rejectionId). A helpful explanation of why the signal was rejected is included (rejectionNote), along with a timestamp (timestamp) and an indication of whether it occurred during a backtest (backtest). This information is useful for generating risk reports and for custom callbacks that need to react to rejected signals.

## Interface ProgressWalkerContract

This interface describes the updates you'll receive as a backtest or other process runs within the backtest-kit framework. It lets you monitor the progress of the overall operation, giving you information like the name of the process running, the exchange and frame being used, and the trading symbol involved. You'll see the total number of strategies to be analyzed, how many have already been processed, and a percentage representing how far along the process is. This is useful for displaying a progress bar or generally understanding how long the current task might take.

## Interface ProgressOptimizerContract

This interface helps you keep an eye on how your trading strategy optimizer is doing. It reports on the optimizer's progress during execution, letting you know what's happening behind the scenes. 

You'll see the name of the optimizer being used, the trading symbol it's focused on (like BTCUSDT), and details about how many data sources it needs to analyze and how many it has already finished.  

The `progress` property gives you a percentage completion, a simple way to understand how far along the optimization process is.

## Interface ProgressBacktestNotification

This notification keeps you informed about the backtest's progress as it runs. It's sent during the backtest execution, providing updates on how far along the process is. You'll see details like the exchange and strategy being used, the specific trading symbol being analyzed, and the total number of historical data points (frames) the backtest will process.  The notification includes a percentage representing the completion progress, alongside the number of frames already analyzed and a timestamp to track when the update was sent. Essentially, it's a way to monitor the backtest’s advancement and estimate its remaining runtime.


## Interface ProgressBacktestContract

This interface helps you keep an eye on how your backtest is running. It provides updates during the background execution of a backtest, telling you what exchange and strategy are being tested, and which symbol is being analyzed. 

You'll get information about the total number of historical data points (frames) the backtest will use, and how many it’s already worked through. 

Finally, it displays a percentage representing the overall progress, letting you know how close you are to completion. This is useful for long backtests to understand the estimated time remaining.

## Interface PingContract

The `PingContract` is a way for your trading system to receive updates about scheduled signals that are being actively monitored. Think of it as a heartbeat signal confirming a signal is still alive and being watched.

These pings happen roughly every minute while a scheduled signal is running – meaning it's neither canceled nor activated. They provide valuable information about the signal itself, including the trading pair (symbol), the strategy managing it, and the exchange involved.

You'll also get the full details of the scheduled signal, like its ID, position size, and price levels, all packed into the `data` property. A `backtest` flag tells you if the ping originated from a historical simulation or a live trading environment. Finally, a `timestamp` lets you know exactly when the ping occurred – either when it happened in live mode, or based on the candle being processed in backtest mode.

You can use these pings to build custom monitoring or even cancellation logic for your signals. The system provides ways to "listen" for these pings repeatedly or just once.

## Interface PerformanceStatisticsModel

This model holds a collection of performance data gathered from your trading strategies. Think of it as a report card for your strategy’s execution. 

It tells you the strategy’s name, how many performance events were tracked, and the total time it took to run. The `metricStats` section breaks down the data further, organizing statistics by different performance metrics. Finally, the `events` property contains a full list of all the raw data points that contribute to these calculations, giving you a detailed view of what happened.

## Interface PerformanceContract

The PerformanceContract helps you understand how your trading strategies are performing over time. It captures key information like when an action happened, how long it took to complete, and which strategy, exchange, and symbol were involved. This information is invaluable for spotting slow parts of your code – maybe a particular function is taking too long, or a specific exchange is causing delays. Each event is time-stamped, allowing you to track changes in performance and compare different executions. Knowing whether the metric originates from a backtest or live environment also adds context to your analysis.

## Interface PartialStatisticsModel

This model holds key statistics about your trading backtest, specifically focusing on partial profit and loss events. Think of it as a snapshot of how your strategy performed at different milestones. 

It breaks down the information into a few important pieces:

*   **eventList:** A detailed record of each individual profit or loss occurrence during the backtest.
*   **totalEvents:** The overall count of all profit and loss events that happened.
*   **totalProfit:**  The number of times your strategy made a profit.
*   **totalLoss:**  The number of times your strategy incurred a loss.

By examining these numbers, you can gain insights into the performance and risk characteristics of your trading strategy.

## Interface PartialProfitNotification

This notification lets you know when a trading signal has hit a pre-defined profit milestone, like reaching 10% or 20% profit. It's a signal that something good is happening with your trade! 

The notification includes details about the trade, like the symbol being traded, the name of the strategy and exchange involved, and a unique identifier for the signal. You’ll also see the level of profit reached, the current price of the asset, the initial opening price, and whether the trade is a long or short position. The `backtest` property indicates if this notification is from a backtesting run rather than a live trade. You can use this information to track performance and potentially adjust your strategy.

## Interface PartialProfitContract

The PartialProfitContract represents a notification that a trading strategy has reached a pre-defined profit milestone, like 10%, 20%, or 30% profit. It's a signal that allows you to monitor how a strategy is performing and potentially take actions based on these profit levels.

Each notification includes important details like the trading symbol ("BTCUSDT" for example), the name of the strategy that generated the signal, and the exchange where the trade is happening. You'll also find all the original signal data, the current price at the time the profit level was reached, and the specific profit percentage achieved. 

To prevent duplicate notifications, events are only sent once per profit level for each signal.  The `backtest` property tells you whether the event came from a historical simulation or a live trade. Finally, a timestamp indicates precisely when this profit level was detected, either the real-time moment in live trading or the candle timestamp during backtesting.

## Interface PartialLossNotification

This notification lets you know when your trading strategy has hit a loss milestone, like losing 10% or 20% of its value. It's a signal that something's gone wrong and might require your attention.

The notification includes details about what happened, like the specific loss level reached (the `level` property), the trading symbol involved (`symbol`), and the name of the strategy that generated the signal (`strategyName`). You’ll also find a timestamp (`timestamp`) to see exactly when the loss occurred, and whether it happened during a backtest (`backtest`).

It also gives you the current price of the asset (`currentPrice`), the price when the position was opened (`priceOpen`), and whether your position is a long or short one (`position`).  The unique identifier for the signal (`signalId`) and the exchange used (`exchangeName`) are included as well. Finally, a unique `id` helps identify this specific notification.

## Interface PartialLossContract

The PartialLossContract represents when a trading strategy hits a predefined loss level, like a 10% or 20% drawdown. It's a notification that things are moving negatively for a particular trade.

This contract provides details about the event, including the trading pair (symbol), the strategy name that triggered it, the exchange where the trade is happening, and all the original signal data. You’ll also find the current price at the time of the loss, the specific loss level reached, and whether it occurred during a backtest (historical simulation) or live trading.

Essentially, it’s a way to track how strategies are performing and to be alerted when they reach specific loss thresholds, useful for monitoring risk and potential stop-loss triggers.  The timestamp indicates precisely when the loss level was detected—either when it happened in live trading or during the timeframe of a backtest candle.


## Interface PartialEvent

This describes a standardized way to track profit and loss events during a trading simulation or live trading. Each event holds details like when it happened (timestamp), whether it was a profit or loss, the trading pair involved (symbol), which strategy generated the trade, and a unique identifier for the signal that triggered it. It also includes the position type (long or short), the current market price at the time of the event, and the specific profit/loss level achieved. Finally, a flag indicates whether the event occurred during a backtest or in a live trading environment. This structured data is designed to make creating reports and analyzing trading performance much easier.


## Interface MetricStats

This object holds a collection of statistics about a particular performance metric. Think of it as a summary report for how long something took to execute. It includes the total number of times the metric was recorded, the total time it took across all those recordings, and key measurements like the average, minimum, maximum, and standard deviation. You’ll also find percentiles like the 95th and 99th, which show how the metric’s duration performs in the higher end of the spectrum. Finally, it provides insights into the timing *between* events, with average, minimum, and maximum wait times.

## Interface MessageModel

The MessageModel is how backtest-kit keeps track of conversations, especially when working with large language models. Think of it as a record of each turn in a dialogue. 

Each message has a `role` which tells you who sent it - whether it's the system providing instructions, a user asking a question, or the LLM providing a response. The `content` property simply holds the actual text of the message itself. 

This structure helps the Optimizer create the right prompts for the LLM and remember what’s already been discussed.

## Interface LiveStatisticsModel

This model holds key statistical data derived from your live trading activity, giving you insights into how your strategies are performing. It tracks everything from the individual events that occurred—like when trades were opened, closed, or idle—to overall metrics like total trades and profit/loss.

You'll find counts of winning and losing trades, and percentages like win rate and average PNL, all designed to help you understand your performance.  It also provides more sophisticated measures like standard deviation (a measure of volatility), Sharpe Ratio (which considers risk), and expected yearly returns.  If a calculation isn't reliable due to data issues, the value will be null, so you know not to rely on it. Essentially, this model provides a holistic view of your live trading results, allowing for thorough analysis and potential strategy adjustments.

## Interface LiveDoneNotification

This notification signals that a live trading session has finished. When you're running your trading strategy in a live environment, this notification will be sent to let you know the process is complete. It includes important details about the trade, like a unique identifier, the precise time of completion, and confirms it wasn't a backtest simulation. You'll also find information such as the traded symbol, the name of the strategy used, and the exchange where the trading took place. This information is useful for monitoring live executions and logging events.

## Interface IWalkerStrategyResult

This interface describes the output you get when evaluating a trading strategy within a backtest comparison. Each strategy run produces a result containing its name, a detailed set of statistics summarizing its performance, a key metric value used for ranking, and finally, its overall rank in the comparison. The `strategyName` simply tells you which strategy was being tested. `stats` provides a wealth of information about the strategy’s behavior, such as profitability, drawdown, and Sharpe ratio. The `metric` represents a single value you've chosen to optimize and compare strategies against. Lastly, `rank` indicates how well the strategy performed relative to the others in the backtest.


## Interface IWalkerSchema

The `IWalkerSchema` helps you set up A/B tests to compare different trading strategies. Think of it as a blueprint for organizing your backtesting experiments. 

Each schema needs a unique name to identify it and an optional note to help you remember what it's for. 

You'll also specify the exchange and timeframe you want to use for all the strategies being tested within that schema. 

Crucially, you'll list the names of the strategies you want to compare – these strategies need to be set up separately. 

You can define which metric, like Sharpe Ratio, you're aiming to improve. Lastly, you can optionally add callbacks to run custom code at specific points during the testing process.

## Interface IWalkerResults

This interface holds all the information gathered when a backtest walker has finished comparing different strategies. It essentially packages up the results of the entire process into one place. You'll find details like the specific trading symbol that was tested, the exchange used for the backtest, the name of the backtest walker itself, and the timeframe used for the analysis. Think of it as a complete report card for a backtest run.

## Interface IWalkerCallbacks

This interface lets you hook into the backtest process and get notified about key events. You can use these callbacks to track the progress of your strategy comparisons, log results, or handle errors that might occur during testing. 

Specifically, you’ll get notified when a strategy test begins (`onStrategyStart`), when it finishes successfully (`onStrategyComplete`), when an error happens (`onStrategyError`), and when the entire comparison is done (`onComplete`).  Each callback provides relevant information like the strategy name, the symbol being tested, performance statistics, and any errors encountered. These notifications help you monitor and understand what’s happening behind the scenes during your backtesting runs.

## Interface IStrategyTickResultScheduled

This interface represents a special kind of tick result, indicating that a trading strategy has generated a scheduled signal and is now patiently waiting for the price to reach the entry point defined in that signal. Think of it as a "pending" signal – the strategy has made a decision, but the market conditions haven’t fully aligned yet.

The result contains key details like the strategy's name, the exchange it's operating on, the trading symbol (like BTCUSDT), and the current price at the time the signal was scheduled. It also includes the scheduled signal itself, providing all the information about the intended trade, and a flag to show whether this event occurred during a backtest or in live trading. It’s a crucial piece of information for understanding the strategy's decision-making process and tracking its progress.

## Interface IStrategyTickResultOpened

This interface describes what happens when a trading signal is first created within the backtest-kit framework. It's a notification that a new signal has been generated, validated, and saved. 

You'll see this result when a strategy creates a signal – it contains all the essential information about that signal, including its ID, the strategy and exchange involved, the trading symbol, the current price at the time of creation, and whether the process is happening in backtest mode or live trading.  Think of it as a confirmation that a signal has successfully begun its lifecycle.


## Interface IStrategyTickResultIdle

This interface represents what happens in your trading strategy when it's not actively placing orders – it's in an "idle" state.  Think of it as a checkpoint showing the conditions when your strategy isn't reacting to market data. 

It contains key information like the strategy’s name, the exchange being used, the trading symbol (like BTCUSDT), and the current price at that moment.  You’ll also find a flag indicating whether this idle event is happening during a backtest or in a live trading scenario.  The `signal` property will always be null because, by definition, there's no signal present when the strategy is idle.

## Interface IStrategyTickResultClosed

This interface represents the result when a trading signal is closed, providing a complete picture of what happened. It includes all the original signal details, the final price at which the trade closed, and the reason for closing – whether it was due to a time limit, a take-profit target, or a stop-loss trigger. 

You'll find information on exactly when the signal closed and a detailed breakdown of the profit and loss, factoring in fees and slippage. It also tracks which strategy and exchange were involved, and confirms if the event occurred during a backtest or in live trading. Essentially, this interface gives you the full story of a closed trade.


## Interface IStrategyTickResultCancelled

This interface describes what happens when a planned trading signal is cancelled before a trade actually takes place. It’s used to report situations where a signal was scheduled but didn't lead to a trade, perhaps because it was stopped or never triggered. 

The information included lets you see exactly *why* the signal was cancelled, including the signal details, the final price at the time of cancellation, and the timestamp. You'll also find details like the strategy and exchange involved, whether it's a backtest or live event, and an optional ID if the cancellation was manually triggered by a user. The "reason" property is particularly helpful, providing more context about why the signal didn't result in a trade.

## Interface IStrategyTickResultActive

This interface describes a specific state in the backtest-kit framework – when a trading strategy is actively monitoring a signal, waiting for a take profit, stop loss, or time expiration. It's like the strategy is "paused" but paying close attention.

The `action` property simply confirms this "active" state, helping the system understand what kind of result it is. You’ll also find details about the signal being watched, like the current price, the strategy and exchange names, and the symbol being traded.

To track progress, there are `percentTp` and `percentSl` values, indicating how close the trade is to hitting either the take profit or stop loss levels. Finally, the `backtest` property tells you if this event happened during a simulated backtest or during a live trading session.

## Interface IStrategySchema

This schema describes how a trading strategy works within the backtest-kit framework. Each strategy gets a unique name for identification and can include a note for developers to explain its purpose.

The `interval` property controls how often the strategy can generate signals, preventing it from overwhelming the system. The core of the strategy is the `getSignal` function, which takes a symbol and a date as input and returns a signal. This function can either generate a signal immediately or schedule one to trigger when a price target is met.

Strategies can also have optional callbacks to be notified about events like when a position is opened or closed. A `riskName` and optional `riskList` allows association with a risk management profile.

## Interface IStrategyResult

This interface, `IStrategyResult`, is designed to hold all the information about a single strategy run when you're comparing different strategies. It's essentially a container for displaying results in a clear, organized way. Each `IStrategyResult` includes the strategy's name, a comprehensive set of statistics detailing its performance, and the value of the metric used to optimize it (which might be missing if the strategy run had issues). Think of it as a single row in a table that summarizes how well a trading strategy did.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the outcome of a trading strategy's performance, focusing on profit and loss. It tells you how much your strategy gained or lost, expressed as a percentage. 

You'll find the adjusted entry price (`priceOpen`) and exit price (`priceClose`) here, both taking into account typical trading costs like fees and slippage – roughly 0.1% for each.  Essentially, these prices show what you *actually* received or paid when executing trades, providing a more realistic view of your strategy’s profitability.

## Interface IStrategyCallbacks

This interface allows you to hook into different stages of your trading strategy's lifecycle. Think of them as event listeners that let your code react to what's happening in the backtest.

You'll receive notifications whenever a new signal is opened, when a signal is actively being monitored, or when the system is in an idle state with no signals. 

The framework also provides callbacks for when a signal is closed, scheduled for later entry, or cancelled altogether.  There are also events to keep you informed of partial profits and losses, and a `onPing` callback that fires every minute, useful for custom monitoring tasks like checking if a signal should be cancelled. The `onTick` event gives you information with every price update, while `onWrite` is useful for testing persistence mechanisms. Each callback provides details like the symbol being traded, relevant data, and whether the process is a backtest or live trading.

## Interface ISizingSchemaKelly

This defines a way to calculate how much to invest in each trade using the Kelly Criterion. It’s a method that aims to maximize long-term growth by dynamically adjusting bet sizes based on perceived edge. 

The `method` property confirms that this sizing scheme uses the Kelly Criterion.  The `kellyMultiplier` property controls how aggressively the Kelly Criterion is applied; a lower multiplier, like the default 0.25, represents a more conservative approach, often called "quarter Kelly," while higher values increase risk.

## Interface ISizingSchemaFixedPercentage

This schema defines a simple sizing strategy where each trade uses a fixed percentage of your available capital. 

It's straightforward to implement: you specify a `riskPercentage` – a number between 0 and 100 – and the framework automatically calculates the trade size based on that percentage. This means every trade exposes you to the same level of risk, making it a predictable and potentially useful approach for managing your portfolio. The `method` property is always set to "fixed-percentage" to identify this specific sizing strategy.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, lays out the fundamental structure for sizing strategies within the backtest-kit framework. Think of it as the blueprint for how much of your capital you'll allocate to each trade. Each sizing configuration gets a unique `sizingName` for easy identification, and you can add a `note` to explain your reasoning or any special considerations. 

You define limits on position sizes using `maxPositionPercentage`, `minPositionSize`, and `maxPositionSize`, ensuring trades remain within your risk tolerance and practical bounds. Finally, `callbacks` allow you to hook into specific points in the sizing process for more advanced customization and control.

## Interface ISizingSchemaATR

This schema defines how to size trades based on the Average True Range (ATR), a common volatility indicator. 

It ensures your positions are sized proportionally to the risk you're willing to take on each trade, expressed as a percentage. 

The ATR multiplier determines how far your stop-loss will be placed, using the ATR value to dynamically adjust based on market volatility. Essentially, higher volatility leads to wider stops and potentially smaller position sizes, and vice-versa. 

You’ll specify a risk percentage (like 1% or 2%) to control the maximum amount of your capital at risk per trade, and the atrMultiplier scales the stop distance relative to the ATR value.

## Interface ISizingParamsKelly

This interface defines how you set up the sizing parameters when using the Kelly Criterion for trade sizing within the backtest-kit framework. It's all about controlling how much capital you risk on each trade based on expected returns. 

The key piece here is the `logger`, which allows you to monitor and debug the sizing process – essentially, it provides a way to see what's happening under the hood as the framework calculates your trade sizes. This logging is incredibly helpful for understanding and fine-tuning your strategy.

## Interface ISizingParamsFixedPercentage

This interface defines the settings you use when you want your trading strategy to consistently use a fixed percentage of your available capital for each trade. It’s designed to be a simple way to manage sizing. 

The `logger` property lets you connect a logging service so you can keep track of what’s happening with your sizing calculations and potentially debug any issues. This helps you understand how much capital is being allocated to each trade.

## Interface ISizingParamsATR

This interface defines the parameters needed to control how much of your capital is used for each trade when using an Average True Range (ATR) based sizing strategy. It's all about setting up the rules for how much to trade based on the ATR value. 

You'll find a `logger` property here, which allows you to easily track what’s happening during the sizing process - helpful for debugging and understanding how your strategy is behaving. The `ILogger` service lets you send messages for troubleshooting or monitoring your trades.

## Interface ISizingCallbacks

The `ISizingCallbacks` interface provides a way to hook into the sizing process within backtest-kit. Think of it as a listener for events happening as the framework determines how much to trade.

Specifically, the `onCalculate` callback gets triggered immediately after the framework has figured out the size of a trade. This is a perfect place to check if the calculated size looks reasonable, log the size for analysis, or perform any other actions based on that calculated quantity. The callback receives the calculated `quantity` and additional `params` that provide context about the sizing calculation.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate your trade size using the Kelly Criterion. It focuses on how successful your trades have been historically. 

You'll need to provide your win rate, expressed as a number between 0 and 1, representing the percentage of winning trades. Also, specify the average win/loss ratio - essentially, how much you win on average for every dollar you lose. These values feed into the Kelly Criterion formula to help determine an optimal bet size.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate your trade size using a fixed percentage of your account balance. It's used when you want to risk a consistent percentage of your capital on each trade.

You'll specify the `method` as "fixed-percentage" to indicate you're using this sizing approach. 

Alongside that, you'll provide the `priceStopLoss` which represents the price at which your stop-loss order will be triggered. This is crucial because the sizing calculation will be based on this stop-loss level.

## Interface ISizingCalculateParamsBase

This interface, `ISizingCalculateParamsBase`, provides the foundational information needed to figure out how much of an asset to trade. It contains key details about the trade, such as the symbol of the trading pair—like "BTCUSDT"—to identify what you're buying or selling. You'll also find the current balance of your account, which is essential for determining how much capital you have available, and the intended entry price for the trade. Think of it as the basic setup for calculating your trade size.

## Interface ISizingCalculateParamsATR

This interface defines the information needed to calculate trade sizes using an ATR (Average True Range) based method. When sizing a trade, you'll provide these parameters to tell the system to use the ATR to determine how much to invest. 

Specifically, you'll need to specify that the sizing method is "atr-based" and also provide the current ATR value itself as a number. This ATR value is used to estimate volatility and adjust the trade size accordingly.

## Interface ISizing

The `ISizing` interface helps your trading strategy determine how much of an asset to buy or sell. It's a core component used behind the scenes to manage position sizes.

The `calculate` property is the key function – it takes a set of parameters related to your risk management (like account balance, risk percentage, and stop loss) and returns a number representing the calculated position size. Essentially, it’s how your strategy figures out *how much* to trade.

## Interface ISignalRow

This interface, `ISignalRow`, represents a finalized trading signal that's ready to be used within the backtest-kit framework. Think of it as the complete package of information needed to execute a trade.  Each signal gets a unique ID, automatically generated, to track it throughout the system. 

The signal includes important details like the entry price (`priceOpen`), the exchange it's intended for (`exchangeName`), and the strategy that generated it (`strategyName`).  You'll also find the timestamps indicating when the signal was initially created (`scheduledAt`) and when the order became pending (`pendingAt`).  Of course, the trading pair, or symbol, like "BTCUSDT" is included. Finally, a hidden flag `_isScheduled` is used internally to mark signals that were created on a schedule.

## Interface ISignalDto

This interface, `ISignalDto`, defines the structure of data used for trading signals within the backtest-kit framework. Think of it as a blueprint for describing a trading idea – whether it's a buy or sell recommendation.

You'll use this structure when providing signals to the system.  It includes details like the trade direction (long or short), the entry price, target profit price, stop-loss price, and an estimated duration. 

The system automatically generates a unique ID for each signal, but you can provide one yourself if needed.  A descriptive note field is also included for explaining the reasoning behind the signal. 

Important:  The take-profit and stop-loss prices need to make sense relative to your entry price – take profit should be higher for a long position and lower for a short position, and vice-versa for stop-loss.

## Interface IScheduledSignalRow

This interface describes a signal that’s scheduled to be executed when the price reaches a certain level. Think of it as a signal put on hold, waiting for the market to move in a specific direction. It builds upon a standard signal but includes a `priceOpen` – the price it needs to reach before the signal activates. Once that price is hit, it transforms into a regular, active signal. A key feature is tracking when the signal was initially scheduled versus when it actually started pending.

## Interface IScheduledSignalCancelRow

This interface, `IScheduledSignalCancelRow`, builds upon the standard `IScheduledSignalRow` to provide extra information about signals that have been cancelled by the user. It's designed to track when a signal was intentionally cancelled, identifying it with a unique `cancelId`.  The `cancelId` property simply stores this identifier, allowing systems to differentiate between signals that naturally expired and those that were actively cancelled. It’s a simple addition to the base signal row for enhanced control and tracking of user actions.


## Interface IRiskValidationPayload

This interface, `IRiskValidationPayload`, provides all the necessary information to assess the risk associated with a potential trade. Think of it as a package containing data about what's about to happen and the current state of your portfolio. 

It includes the `pendingSignal`, which represents the trade you're considering, along with details about your existing holdings.  Specifically, you'll find the number of currently open positions (`activePositionCount`) and a list describing each active position (`activePositions`).  This complete picture allows risk validation functions to make informed decisions.


## Interface IRiskValidationFn

This defines how you can create functions to check if a trading decision is safe to make. Think of it as a gatekeeper for your trades. If the function approves the trade, it does nothing and lets it proceed. However, if it finds a problem – like too much risk – it can either signal the problem with a specific rejection reason (an `IRiskRejectionResult`) or stop execution entirely by throwing an error, which the system will then handle for you.

## Interface IRiskValidation

This interface helps you set up checks to make sure your trading strategies are behaving safely. Think of it as a way to define rules and guidelines for how much risk you're willing to take. 

You provide a validation function – this is the core logic that will actually perform the risk check. 

You can also add a note, which is simply a description to help anyone understand *why* you've set up this particular validation rule. It’s a great way to document your risk management approach.

## Interface IRiskSchema

This interface, `IRiskSchema`, helps you create and manage custom risk controls for your trading portfolio within backtest-kit. Think of it as a blueprint for defining how your portfolio behaves under specific conditions.

Each `IRiskSchema` lets you give your risk control a unique name and add a note for yourself or other developers. You can also include optional callbacks to trigger specific actions when a trade is rejected or allowed.

The heart of the `IRiskSchema` lies in the `validations` array. This is where you define the actual rules and checks that will be applied to your trades to ensure they align with your risk management strategy. You can add multiple validations to create complex and layered risk controls.


## Interface IRiskRejectionResult

This interface, `IRiskRejectionResult`, helps you understand why a risk validation check failed. Think of it as a notification when something goes wrong during a risk assessment. It provides a unique identifier (`id`) to track the specific failure and a helpful explanation (`note`) so you know exactly what caused the problem and how to fix it. This makes debugging and improving your trading strategies much easier.

## Interface IRiskParams

The `IRiskParams` interface helps configure how your trading system handles risk. It’s essentially a set of instructions given when you create a `ClientRisk` object.

You can provide a `logger` to help track what's happening – useful for debugging.

A `backtest` flag tells the system whether it's running in a simulated environment (backtesting) or a live trading scenario.

Finally, the `onRejected` callback lets you respond when a trading signal is blocked because it exceeds pre-defined risk limits, giving you a chance to log the event or react to it before the system takes further action.


## Interface IRiskCheckArgs

This interface, `IRiskCheckArgs`, provides the information needed to decide whether a new trade should be allowed. Think of it as a gatekeeper before a trading signal is actually created. It carries details like the trading pair (symbol), the signal itself, the name of the strategy that wants to place the trade, the exchange being used, the current price, and the current time. All these pieces of information are passed directly from the client strategy so you can perform checks to ensure the trade is safe and appropriate.

## Interface IRiskCallbacks

This interface defines optional functions you can use to get notified about risk-related events during trading. You can register a function, `onRejected`, to be called whenever a trading signal is blocked because it violates your defined risk limits. Conversely, `onAllowed` is triggered when a signal successfully passes all risk checks and is considered safe to proceed with. Think of these callbacks as a way to keep track of which signals are being accepted and which are being denied based on your risk rules.

## Interface IRiskActivePosition

This interface describes a position that's currently open and being monitored for risk assessment. It's used by the risk management system to keep track of positions held across different trading strategies. 

Each position record contains information like the signal that triggered it, the name of the strategy responsible for opening it, the exchange where the trade happened, and the exact time the position was initiated. Having these details allows for a comprehensive view of risk exposure when combining multiple strategies.

## Interface IRisk

The `IRisk` interface is a key component for managing and controlling risk in your trading strategies. Think of it as the gatekeeper for your trades, ensuring they align with pre-defined risk parameters. 

It allows you to verify if a potential trade (a "signal") is acceptable based on your risk rules using the `checkSignal` function.

You also use this interface to keep track of your open positions.  The `addSignal` function lets you register when a new trade is initiated, and `removeSignal` handles the cleanup when a trade is closed. This helps maintain an accurate picture of your risk exposure at any given time.


## Interface IPositionSizeKellyParams

This interface defines the parameters needed to calculate position sizes using the Kelly Criterion. It essentially describes how much you expect to win compared to how much you risk.

The `winRate` property represents the probability of winning a trade, expressed as a number between 0 and 1.

The `winLossRatio` tells you the average profit you make on a winning trade compared to the average loss on a losing trade. These two values together help determine an optimal bet size to maximize long-term growth.

## Interface IPositionSizeFixedPercentageParams

This defines the parameters needed for a trading strategy that uses a fixed percentage of your capital for each trade, but also includes a stop-loss order. Specifically, you'll need to set the `priceStopLoss`, which is the price at which your stop-loss order will be triggered to limit potential losses. It's a simple way to manage risk when you’re sizing your trades based on a percentage of your total available funds.

## Interface IPositionSizeATRParams

This interface defines the settings needed to calculate your position size using the Average True Range (ATR) method. It's all about determining how much of your capital to allocate to a trade based on market volatility. The `atr` property holds the current ATR value, which is a key factor in this calculation – a higher ATR generally means more volatility, and potentially a smaller position size to manage risk. Think of it as a gauge for how much the price is likely to move.

## Interface IPersistBase

This interface defines the basic operations for managing data persistence within the backtest-kit framework. Think of it as the foundation for saving and loading your trading data. 

It provides methods to ensure your persistence directory is properly set up and ready, allowing you to check if a specific piece of data already exists, retrieve existing data, and write new data. These operations are designed to be reliable, using techniques to ensure data is written correctly and consistently. The `waitForInit` method guarantees that the initial setup happens only once, preventing potential issues with your data storage.


## Interface IPartialData

This interface, `IPartialData`, is designed to hold a snapshot of data for a trading signal, primarily for saving and loading that data later. Think of it as a simplified version of the full signal state. It takes what might be sets of data (like profit and loss levels) and transforms them into arrays so they can be easily stored as JSON.  The `profitLevels` property stores the profit levels that have been hit, and `lossLevels` stores the loss levels, both as arrays. This allows your trading system to remember its progress even when it restarts.

## Interface IPartial

This interface, `IPartial`, is responsible for keeping track of how a trading signal is performing – whether it's making a profit or a loss. It helps us know when a signal hits key milestones like 10%, 20%, or 30% profit or loss.

The `profit` method handles situations where a signal is making money. It's triggered when the strategy is monitoring a signal's performance, and it makes sure we only announce new profit levels.  Similarly, the `loss` method handles situations where a signal is losing money, again ensuring we only report new loss levels.

Finally, the `clear` method gets called when a signal finishes trading – whether that’s because it hit a take profit, stop loss, or time expiry. It cleans up the signal’s data and makes sure everything is saved properly.

## Interface IOptimizerTemplate

This interface helps create the basic building blocks for your backtesting scripts, especially when you’re using LLMs (Large Language Models) to generate strategies or configurations. Think of it as a toolkit for assembling the different parts of your backtest.

It provides methods to generate code snippets, such as helper functions for debugging (`getJsonDumpTemplate`, `getTextTemplate`, `getJsonTemplate`), and for setting up the initial environment (`getTopBanner`).  You'll find templates for configuring the core components of your backtest, including how data is handled (`getExchangeTemplate`, `getFrameTemplate`), the strategies you're using (`getStrategyTemplate`), how those strategies are run (`getWalkerTemplate`, `getLauncherTemplate`), and how you present information to and receive information from an LLM (`getUserMessage`, `getAssistantMessage`).  Essentially, it’s a way to systematically build the code that orchestrates your backtesting and integrates with LLMs.

## Interface IOptimizerStrategy

This interface describes the data structure representing a trading strategy that has been created using a Large Language Model (LLM).  Essentially, it holds all the information needed to understand how a particular strategy was developed, including the specific trading pair it's designed for (the `symbol`) and a unique identifier (`name`).  Crucially, it preserves the complete conversation between the user and the LLM – the `messages` – showing the prompts and responses that led to the final strategy. Finally, the `strategy` property itself holds the actual trading logic generated by the LLM, often in the form of a text description.


## Interface IOptimizerSourceFn

The `IOptimizerSourceFn` is designed to provide data for optimizing your trading strategies. Think of it as a function that feeds data to the optimizer, allowing it to learn and improve.  It's important that this data source handles large datasets efficiently by providing data in smaller chunks, or pages.  Each piece of data returned also needs a unique identifier to ensure the optimizer can track and process it correctly.

## Interface IOptimizerSource

This interface, `IOptimizerSource`, helps you bring your trading data into the backtest-kit framework in a structured way, especially when you're using LLMs. Think of it as a blueprint for how your data is accessed and presented.

You'll give it a unique `name` to easily identify the data source.  You can also add an optional `note` to describe what the data represents.

The crucial part is the `fetch` function, which is responsible for actually retrieving your trading data, and it should handle fetching data in chunks (pagination).

Finally, you have the flexibility to customize how the data is formatted into messages for the LLM. `user` and `assistant` properties let you tailor the message format for each role, creating a more controlled and useful conversation with the LLM. If you don't provide these, the framework will use default formatting.


## Interface IOptimizerSchema

This schema defines how your backtest strategies are optimized. Think of it as a blueprint for building and evaluating different trading approaches. 

It lets you specify a unique name for each optimization run. You can also add a descriptive note to explain what the optimization is trying to achieve.

Crucially, it allows you to define training periods – multiple sets of historical data used to generate variations of your strategy. You'll also designate a separate testing period to evaluate how well those generated strategies perform.

The schema includes data sources, which feed information into the optimization process, and a prompt function that constructs the instructions used to generate strategies. You can optionally customize certain aspects using a template, or add callbacks to monitor the optimization's progress.

## Interface IOptimizerRange

This interface, `IOptimizerRange`, helps you specify the time periods you’ll use when training or evaluating your trading strategies. Think of it as defining the boundaries of your historical data. 

You'll provide a `startDate` and `endDate` to clearly mark the beginning and end dates of that period.  A `note` field is also available – it’s optional, but it's great for adding a descriptive label like "2023 Bear Market" to keep your ranges organized.

## Interface IOptimizerParams

This interface describes the internal settings needed to create a ClientOptimizer. Think of it as a blueprint for configuring how the optimization process will run.

It includes a `logger` which is used to keep track of what's happening during optimization – useful for debugging or understanding the process. 

Also, it has a `template` that defines the specific methods and structure used for the optimization itself, combining settings from your provided template and some defaults.

## Interface IOptimizerFilterArgs

This interface, `IOptimizerFilterArgs`, helps define how to fetch data for backtesting. It's all about specifying which trading pair, like "BTCUSDT", and what timeframe you're interested in. You'll use `symbol` to pick the asset, `startDate` to mark the beginning of the data you need, and `endDate` to set the end date for your data range. Think of it as telling the system exactly which historical data you want to analyze.

## Interface IOptimizerFetchArgs

When you're pulling data for optimization, this interface defines how much data to request at a time. It lets you control the size of each chunk of data – the `limit` specifies how many records to get, and the `offset` tells you where to start from, useful for getting data page by page.  The framework provides a default limit of 25, but you can adjust these values as needed to suit your data and performance. Essentially, it's a way to manage larger datasets by breaking them into smaller, more manageable pieces for the optimizer to work with.

## Interface IOptimizerData

This interface defines the basic structure for data used in optimization processes. Think of it as the foundation for feeding information into your trading strategy's optimization engine. Every data source you use needs to adhere to this, ensuring each piece of data has a unique identifier – the `id` property – to prevent duplicates, especially when dealing with large datasets fetched in chunks. This `id` is critical for keeping your optimization process clean and accurate.

## Interface IOptimizerCallbacks

The `IOptimizerCallbacks` interface lets you tap into what's happening behind the scenes during optimization runs. Think of it as a way to observe and potentially influence the process as it unfolds.

You can use `onData` to check or record the strategies that are created during the training phase.  `onCode` allows you to see and verify the generated code for those strategies.  If you're saving the code to a file, `onDump` is triggered afterward, giving you a chance to log that event or do something else. Finally, `onSourceData` notifies you when data is retrieved from your data source, so you can keep an eye on the incoming information and confirm it’s what you expect.


## Interface IOptimizer

The IOptimizer interface provides a way to generate and export trading strategies.  You can use it to retrieve metadata about strategies for a given symbol, pulling together information from different data sources and building a history of how the strategy was developed.  It also lets you generate the full code for an executable trading strategy, including all the necessary imports and supporting components. Finally, there's a convenient way to dump that generated code directly to a file, creating the necessary directory structure if it doesn't already exist.

## Interface InfoErrorNotification

This notification lets you know about issues encountered during background tasks that aren't critical enough to halt everything. It's designed to keep you informed about potential problems so you can investigate and address them. 

The notification includes an error identifier (`id`) for tracking, a detailed error object (`error`) providing specifics about the issue, a human-readable explanation (`message`), and a timestamp (`timestamp`) for when it occurred.  A `backtest` flag indicates whether the error happened during a backtesting simulation. Essentially, it's your window into minor setbacks within the system’s operations.

## Interface IMethodContext

This interface, `IMethodContext`, acts like a little travel guide for your backtesting code. It carries essential information about which versions of your trading strategy, exchange, and framework to use during a backtest. Think of it as a way to automatically select the correct components without having to specify them manually everywhere.  It includes the names of the strategy, exchange, and framework schemas –  the `strategyName`, `exchangeName`, and `frameName` – which are automatically passed around to make sure everything works together correctly.  If you're running a live simulation, the `frameName` will be empty.


## Interface ILogger

The `ILogger` interface is a central tool for keeping track of what's happening within the backtest-kit system. It allows different parts of the framework – like agents, states, or even how data is stored – to record important information. 

Think of it as a way to create a detailed record of the backtest's lifecycle: from when things start up to when they wrap up, what tools are being used, how decisions are made, and if any errors pop up.

The `ILogger` provides several methods to do this. `log` is for important events, `debug` is for very detailed information used when troubleshooting, `info` gives you a general overview of what's going on, and `warn` flags potential issues that aren’t critical, but still worth noticing. Essentially, it’s your window into understanding and debugging the backtest process.

## Interface IHeatmapRow

This interface represents a row of data used in a portfolio heatmap, focusing on the performance of a single trading symbol like BTCUSDT. It provides a comprehensive overview of how strategies performed for that symbol, combining key metrics.

You’ll find information like the total profit or loss percentage, a Sharpe Ratio to measure risk-adjusted returns, and the maximum drawdown, which indicates the largest potential loss.

The interface also breaks down the trading activity with details such as the total number of trades, win and loss counts, win rate, and average profit/loss per trade.  Further insights are given by the standard deviation of profits, profit factor, average win and loss amounts, and the longest winning and losing streaks. Finally, expectancy provides a calculation of potential long-term profitability based on the winning and losing trade characteristics.

## Interface IFrameSchema

This interface, `IFrameschema`, describes a specific time period and frequency for your backtesting simulations. Think of it as defining a slice of historical data you want to analyze. 

Each `IFrameschema` has a unique name to identify it, and a place for developers to add notes for clarity. 

You'll specify the interval – like daily, hourly, or weekly – and the start and end dates of the data you're using. 

Finally, you can also attach optional callback functions to be triggered at different points within the frame’s lifecycle.

## Interface IFrameParams

The `IFrameParams` interface defines the information needed to set up a core component within the backtest-kit framework. Think of it as a configuration object that tells the system how to operate. It builds upon the `IFrameSchema` to provide a more complete setup, and crucially includes a `logger` property. This logger allows the system to record important events and debugging information as it runs, making it easier to understand what's happening during a backtest or simulation.

## Interface IFrameCallbacks

This section describes the functions you can use to interact with the backtest-kit framework as it's building and managing timeframes for your simulations. The `onTimeframe` callback lets you peek inside and see exactly what timeframes are being created – it receives the generated array of dates, the start and end dates of the timeframe, and the interval used (like daily, weekly, or monthly). You might use this to check if the timeframe generation is working as expected, or to record the generated timeframes for your own analysis.

## Interface IFrame

The `IFrame` interface is a core part of how backtest-kit organizes and manages time data for your trading simulations. Think of it as the engine that creates the timeline your strategies will be tested against. 

Its primary responsibility is to produce a sequence of dates, which act as the milestones for your backtest.  You provide a symbol (like 'BTCUSDT') and a frame name (like '1h' for hourly data), and it returns a promise that resolves to an array of those specific timestamps. These timestamps are evenly spaced, reflecting the interval you've defined for the timeframe. Essentially, it's the foundation for structuring the time series data used in your backtesting process.


## Interface IExecutionContext

This interface, `IExecutionContext`, represents the environment in which your trading strategies and exchange interactions operate. Think of it as a package of information passed along to your code to provide context. It includes the trading symbol, like "BTCUSDT," so your code knows which asset it’s dealing with. The `when` property tells your strategy the current time, crucial for making decisions based on timing. Finally, the `backtest` property clearly indicates whether the code is running a historical simulation (backtest mode) or live trading.

## Interface IExchangeSchema

This interface outlines the structure for defining how backtest-kit interacts with different trading exchanges. Think of it as a blueprint that tells the framework where to get historical price data (candles), and how to correctly format trade quantities and prices to match each exchange’s specific rules. You’ll use this to register each exchange you want to backtest against.

Each exchange definition needs a unique name, and optionally, a descriptive note for your own records.

The core of the definition is the `getCandles` function, which handles fetching those historical price candles – it’s responsible for communicating with the exchange’s API or database.  You also specify how to adjust trade sizes and prices to comply with each exchange's precise formatting requirements with `formatQuantity` and `formatPrice`. Finally, you can add optional callback functions (`callbacks`) to handle events related to incoming candle data.

## Interface IExchangeParams

This interface, `IExchangeParams`, helps you set up how your trading system interacts with an exchange during backtesting. Think of it as a container for essential configuration details. 

It requires you to provide a logger, which allows you to track and debug what's happening during the backtest—super helpful for understanding your strategies. 

You also need to supply an execution context, which tells the system important things like which symbol you're trading, the timeframe being used, and whether it's a backtest or live trading. These parameters ensure your backtest accurately reflects the trading environment.

## Interface IExchangeCallbacks

This interface lets you hook into events happening when your backtest kit retrieves historical price data from an exchange. Specifically, the `onCandleData` callback gets triggered whenever a batch of candlestick data is loaded. You'll receive information about the symbol being fetched, the time interval of the data (like 1 minute or 1 day), the starting date for the data, the number of candles requested, and finally, an array of candlestick data points. It’s a useful way to monitor data loading progress or perform custom processing of the fetched data.

## Interface IExchange

The `IExchange` interface defines how your backtest interacts with a simulated exchange. It allows you to retrieve historical and future price data (candles) for a given symbol and time interval.

You can use `getCandles` to grab past price action and `getNextCandles` to peek into what *might* happen next during a backtest. 

The framework also handles the complexities of order placement by providing methods to format quantities and prices to match the exchange's specific requirements.

Finally, you can easily calculate the Volume Weighted Average Price (VWAP) for a symbol, which is useful for understanding average trading prices over a specific period based on recent activity.

## Interface IEntity

This interface, `IEntity`, serves as the foundation for all data objects that are stored and managed within the backtest-kit framework. Think of it as the common blueprint. Any class representing something persistent – like a trade, a portfolio, or an event – should implement this interface. It ensures that all persistent objects share a consistent structure and behavior, making it easier to work with them across the system.

## Interface ICandleData

This interface, `ICandleData`, defines the structure of a single candlestick – a common way to represent price movements over a specific time period.  Each candlestick contains information about the open, high, low, and closing prices, alongside the trading volume during that time. Think of it as a snapshot of market activity for a particular interval. The `timestamp` property tells you exactly when that interval began, measured in milliseconds since a standard epoch. This data is crucial for things like calculating VWAP (Volume Weighted Average Price) and, importantly, running backtests to see how a trading strategy would have performed.

## Interface HeatmapStatisticsModel

This data structure neatly organizes the overall performance statistics for a portfolio, presenting a snapshot of how all the assets within it are performing. You’ll find a list of individual symbol statistics, allowing you to drill down into the performance of each asset.  It also gives you key summary numbers – the total number of symbols in the portfolio, the combined profit and loss (PNL), a Sharpe Ratio representing risk-adjusted return, and the total number of trades executed. Essentially, it offers a high-level view of portfolio health and activity.

## Interface DoneContract

This interface signals when a background process, whether it's a backtest or a live trading session, has finished running. It provides key details about what just concluded, like the name of the exchange used, the specific strategy that ran, and whether the process was a backtest or live execution. You'll find information about the trading symbol involved as well, allowing you to track which asset was being analyzed or traded. Essentially, it’s a notification package letting you know a background task is done and giving you context about it.


## Interface CriticalErrorNotification

This notification lets you know about a serious problem that has occurred within the backtest-kit framework, requiring the process to stop. It’s designed for situations where recovery isn't possible.

The notification includes a `type` to clearly identify it as a critical error, a unique `id` for tracking purposes, and the `error` object itself, giving you details about what went wrong.  You'll also receive a `message` providing a human-readable explanation of the error, a `timestamp` indicating when it happened, and a `backtest` flag to tell you if this occurred during a backtest or live trading. Use this information to understand and address the root cause of the critical error.

## Interface ColumnModel

This interface helps you define how data should be presented in a table. Think of it as a blueprint for each column you want to display. You’ll specify a unique identifier for each column using the `key` property, and a friendly `label` that will appear as the column header. 

The `format` property is where you customize how the actual data is shown – you provide a function that takes the raw data and transforms it into a string.  Finally, `isVisible` lets you control whether a column should even be displayed, perhaps based on some dynamic condition.

## Interface BacktestStatisticsModel

This model holds all the important statistical information gathered from a backtest, giving you a good overview of how your trading strategy performed. It contains a detailed list of every trade that was closed, along with key metrics like the total number of trades, how many were winners and losers, and the win rate.

You'll also find information about the average profit or loss per trade, the total profit or loss over all trades, and measures of risk like standard deviation and the Sharpe Ratio.  The Sharpe Ratio, and its annualized version, are especially helpful for comparing strategies, while the Certainty Ratio indicates the ratio of average win to average loss. Finally, you can see an estimate of what your yearly returns could be based on the backtest results. Remember, any of these numbers might be missing if the calculation wasn’t reliable due to data issues.

## Interface BacktestDoneNotification

This notification signals that a backtesting process has finished running. It provides key details about the completed backtest, allowing you to track and analyze its results. You'll find information like the unique identifier of the backtest, the precise time it concluded, and confirmation that it was indeed a backtest. It also includes essential specifics about the backtest itself, such as the trading symbol, the name of the strategy used, and the exchange on which it was based. This helps you easily identify and correlate the notification with the corresponding backtest data.

