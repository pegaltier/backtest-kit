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

This interface defines what happens when a walker needs to be stopped within the backtest-kit framework. Think of it as a notification signal—when a walker is told to halt, this signal is emitted. It includes important details like the trading symbol involved, the specific strategy that should be stopped, and the name of the particular walker being interrupted. This lets you react to stop events and potentially filter them based on walker name if you have multiple walkers active.

## Interface WalkerStatisticsModel

The WalkerStatisticsModel helps you understand how different trading strategies performed during a backtest. It combines the standard backtest results with extra information for comparing strategies against each other. Essentially, it's a container for a list of strategy results, allowing for a clear and organized way to analyze multiple strategies in one place. You can think of it as a central place to see how each strategy did and easily compare their performance.

## Interface WalkerContract

The `WalkerContract` helps you track the progress of comparing different trading strategies. It provides updates as each strategy finishes its backtest and is ranked. 

You'll see information like the name of the strategy, the exchange and symbol being tested, and key statistics about its performance.  A crucial part of this is knowing the metric being optimized (like Sharpe Ratio or drawdown) and its value for the current strategy.

The contract also tells you what the best metric value has been so far, and which strategy currently holds that top spot.  Finally, it provides insights into the overall testing process - how many strategies have been tested and how many remain. This lets you monitor how close you are to completing the comparison.


## Interface WalkerCompleteContract

This interface represents the final notification you receive when a backtest walker has finished running all its strategies. It bundles together a lot of important information about the entire test process. You'll find details like the walker's name, the trading symbol being analyzed, the exchange and timeframe used, and the optimization metric guiding the strategy selection.

The notification also tells you how many strategies were tested, which one performed the best, and the specific metric value it achieved. Critically, it includes comprehensive statistics for that top-performing strategy, giving you a complete picture of its performance. Think of it as a final report card for your backtesting experiment.

## Interface ValidateArgs

This interface, `ValidateArgs`, helps ensure your backtest configurations are set up correctly. Think of it as a checklist for common components. 

It defines properties for things like the exchange you're using, the timeframe of your data, the strategy you're testing, and even how you're managing risk and sizing trades.

Each property expects a special enum – a set of predefined values – that the framework will use to check if your selections are valid and supported. This helps prevent errors and keeps your backtesting process reliable.



Essentially, it's a way to tell the backtest-kit exactly what it needs to know about your setup to make sure everything works together smoothly.

## Interface TickEvent

This interface, `TickEvent`, acts as a central hub for all the data you'll get during a backtest. Think of it as a standardized format for every event that occurs – from the initial idle state to when a position is opened, actively trading, or finally closed. It bundles together all the important details about each event, regardless of what's happening. 

You'll find information like the exact time of the event, the type of action that occurred (idle, opened, active, or closed), and for positions, things like the symbol being traded, the signal ID, and the position type. When a trade is active, you’ll get progress indicators for both take profit and stop loss. And when a position closes, you'll have data on the P&L, the reason for closure, and how long the position lasted. Ultimately, it makes reporting and analysis much easier.

## Interface SignalData$1

This data structure holds all the critical details about a single, finished trading signal. Think of it as a record of one trade – it tells you which strategy created it, what its unique ID is, and what symbol was traded. You'll find the position taken (long or short), the profit or loss expressed as a percentage, and a description of why the signal was closed.  It also stores the precise timestamps for when the signal was initially opened and when it was closed, allowing you to analyze trading activity over time. Essentially, it's a complete snapshot of a closed signal’s performance.


## Interface ScheduleStatisticsModel

The `ScheduleStatisticsModel` gives you a snapshot of how your scheduled trading signals are performing. It gathers data about all the signals you've scheduled, opened, and cancelled.

You'll find a detailed list of every scheduled event, along with the total count of all events – scheduled, opened, and cancelled. It also breaks down the numbers specifically for scheduled signals and the number that have been successfully activated.

To help you understand the efficiency of your scheduling, it provides key metrics like cancellation rate (how often signals are cancelled – you want this to be low) and activation rate (how often signals turn into trades – you want this to be high). Finally, you can track how long signals wait before being cancelled or activated, using the average wait times.

## Interface ScheduledEvent

The ScheduledEvent object brings together all the important details about scheduled, opened, and cancelled trading events, making it easier to analyze and report on your backtesting results. It includes the exact time of the event, what type of action was taken (scheduled, opened, or cancelled), and the symbol being traded. 

You'll find key information like the signal ID, position type, any notes associated with the signal, and the current market price at the time.  For entries, it provides the intended entry price, take profit, and stop loss levels. 

If an event was cancelled, you’ll see the cancellation timestamp, duration, and the reason behind the cancellation (like a timeout, price rejection, or user action), along with a unique cancellation ID if a user initiated the cancellation. This unified structure allows you to comprehensively understand what happened during your backtest.

## Interface RiskStatisticsModel

This model holds statistics about risk rejections, giving you insight into your trading system's risk management performance. It presents a detailed list of each rejection event, along with a count of the total rejections that occurred. You can also see a breakdown of rejections, categorized both by the trading symbol involved and by the specific trading strategy that triggered them. These groupings make it easier to pinpoint areas where risk controls might need adjustment.

## Interface RiskEvent

This data structure holds information about signals that were blocked by your risk management rules. It’s essentially a record of when the system prevented a trade from happening. 

Each `RiskEvent` includes details like the exact time the rejection occurred, which trading pair was involved, the specifics of the signal that was rejected, the name of the strategy and exchange that generated it, the current market price, and how many other positions were already open. 

You’ll also find a unique ID for each rejection, a note explaining why the signal was blocked, and a flag indicating whether the rejection happened during a backtest or in a live trading environment. This information is valuable for understanding and refining your risk controls.

## Interface RiskContract

The `RiskContract` provides information about signals that were blocked due to risk checks. It's like a notification that something the trading system wanted to do was stopped because it violated a pre-defined risk rule.

This notification includes details like the trading pair involved (`symbol`), the specifics of the signal that was rejected (`pendingSignal`), which strategy tried to execute it (`strategyName`), and the exchange it was intended for (`exchangeName`).  You'll also find the current market price at the time of the rejection (`currentPrice`), the number of existing open positions (`activePositionCount`), and a unique ID to help track the incident (`rejectionId`). A human-readable explanation of why the signal was rejected is also included (`rejectionNote`), along with a timestamp (`timestamp`) and an indication of whether it happened during a backtest or live trading (`backtest`).

Essentially, it’s a record of risk management in action, useful for understanding and improving your risk controls. Systems can use it to build reports, and developers can use it for debugging and monitoring.

## Interface ProgressWalkerContract

This contract lets you monitor the progress of a backtest kit walker as it runs. It’s like a status report providing details on what’s happening behind the scenes.

You’ll receive updates containing the walker's name, the exchange being used, the frame applied, and the trading symbol it's working on.  It also tells you the total number of strategies the walker needs to process, how many have already been handled, and a percentage representing how much work is left to go. Think of it as a way to see a live counter of your backtest’s progress.

## Interface ProgressOptimizerContract

This interface helps you keep an eye on how your optimization process is going. It's like a little report that's sent out while the optimizer is working. You'll see the name of the optimizer, the trading symbol it's focused on, and how much work is left to do.

The report tells you the total number of data sources the optimizer needs to handle, how many it's already finished, and the overall percentage of completion. This lets you know if things are on track and gives you a sense of how much longer the optimization will take.

## Interface ProgressBacktestContract

This contract provides updates on the progress of a backtest as it runs. It's like a status report, letting you know how far along the backtest is.

Each update includes the exchange and strategy names being used, the trading symbol involved (like BTCUSDT), the total number of historical data points the backtest will analyze, and how many have been processed already.

You’ll also receive a percentage representing the overall completion – a value from 0 to 100 – so you can easily monitor the backtest’s status. This helps in understanding how long the backtest might take to finish and ensures everything is running as expected.


## Interface PingContract

The `PingContract` helps you keep tabs on your active trading signals. It's a little message sent every minute while a signal is being monitored, giving you a regular heartbeat to confirm things are running smoothly.

Think of it as a notification containing key details: which trading pair (symbol) is involved, which strategy is using it, and which exchange is connected. You also get all the signal's data, like entry price and stop-loss levels.

Importantly, the `PingContract` tells you if the signal is from a backtest (historical data) or live trading. You can even use it to build your own custom monitoring or cancellation logic with the `listenPing()` and `listenPingOnce()` functions. The ping only occurs when the signal is active, so it's a reliable indicator of ongoing monitoring.

## Interface PerformanceStatisticsModel

This model holds all the performance data collected during a backtest, organized neatly to give you a clear picture of how your strategy performed.  It breaks down the results, showing you the strategy's name, the total number of events that occurred, and the total time it took to run.  The `metricStats` section lets you dive into specific performance metrics, while `events` provides a detailed list of every individual performance record. Think of it as a complete report card for your trading strategy.

## Interface PerformanceContract

This interface helps you keep track of how long different parts of your trading system take to run. It’s like a detailed log of performance, allowing you to pinpoint slow areas and improve efficiency. Each record contains a timestamp indicating when the event occurred, and another timestamp for the previous event, useful for calculating elapsed time. You’ll also find details like the type of operation, the strategy and exchange involved, the symbol being traded, and whether the event happened during a backtest or live trading. This information is valuable for understanding and optimizing your trading framework.

## Interface PartialStatisticsModel

This model holds the statistical information gathered during a backtest, specifically focusing on partial profit and loss events. It's designed to help you track how your trading strategy performs when it involves taking partial positions.

You'll find a detailed list of each individual event within the `eventList` property.  The `totalEvents` property simply tells you how many profit and loss events occurred overall.  Then, `totalProfit` and `totalLoss` break down the count of events that resulted in a profit or a loss, respectively. Using these properties lets you analyze the distribution of partial profits and losses in your backtest results.

## Interface PartialProfitContract

The PartialProfitContract represents a signal reaching a specific profit milestone during a trade. It’s how the backtest-kit framework communicates when a strategy has achieved a partial profit target, like 10%, 20%, or all the way to 100%.

This contract provides key details about the event, including the trading symbol, the name of the strategy that triggered it, and the exchange it's running on. You’ll also find complete information about the original signal, the current price at the time the profit level was hit, and the exact profit level achieved. 

It also tells you whether the event happened during a backtest (using historical data) or in a live trading environment. Finally, it includes a timestamp indicating when the profit level was detected – either at the moment of detection in live trading or based on the candle's timestamp during backtesting. This information is useful for monitoring strategy performance and generating reports.


## Interface PartialLossContract

This interface describes events that happen when a trading strategy hits a predefined loss level, like a -10%, -20%, or -30% drawdown. It's useful for keeping track of how much a strategy has lost and when it happened.

Each event includes details like the trading pair (symbol), the strategy's name, which exchange is being used, all the original signal data, the current price at the time of the loss, and the specific loss level reached. Crucially, the level is represented as a positive number, so a level of 20 signifies a -20% loss.

The events also tell you whether the event occurred during a backtest (using historical data) or during live trading, and when the event actually occurred. Different parts of the system, like reporting tools or custom callbacks, can use these events to monitor strategy performance. A single tick can trigger multiple level events if the price moves significantly.

## Interface PartialEvent

This describes the data you get when your trading strategy hits a profit or loss milestone during a backtest or live trade. It’s a way to keep track of exactly when and how your strategy is performing.

Each event includes the exact time it happened, whether it was a profit or a loss, the trading pair involved (like BTC/USD), the name of the strategy that triggered it, a unique signal identifier, and the type of position held (long or short). You’ll also get the current market price at the time and the profit/loss level reached, like 10%, 20%, or 30%. Finally, a flag tells you if this event occurred during a backtest or a real-time trade. 

It's designed to be a standardized format for reporting on your trading performance.


## Interface MetricStats

This interface helps you understand the performance of a specific aspect of your trading strategy. It gathers key statistics like how many times something happened, the total time it took, and how that time varied. You'll find details on the average, minimum, and maximum durations, plus insights into the spread of the data with statistics like standard deviation and percentiles (p95, p99). It also tracks the wait times between events, allowing you to analyze the responsiveness of your system. Think of it as a report card for a particular metric within your backtest.

## Interface MessageModel

This `MessageModel` helps keep track of the back-and-forth conversation when using an LLM, like in the Optimizer. Think of it as a way to record each message, whether it's instructions you give, a user's question, or the LLM's response. Each message has a `role` to indicate who sent it – whether it’s the system setting the scene, you as the user, or the LLM itself.  The `content` property simply holds the actual text of the message.

## Interface LiveStatisticsModel

This model keeps track of key statistics as your trading system is running live. It provides a detailed snapshot of your performance, including every event that's occurred - from idle periods to signal openings, activations, and closures.

You’ll find counts for total events, closed signals, winning trades, and losing trades.  It also calculates important metrics like your win rate, average profit per trade, and total profit. 

To help you understand the risk involved, the model offers volatility measurements like standard deviation and the Sharpe Ratio, both annualized for a clearer picture of long-term performance.  Finally, the certainty ratio and expected yearly returns give you additional insights into trade effectiveness. Remember that these numerical values will be unavailable if a calculation is unreliable.

## Interface IWalkerStrategyResult

This interface describes the result you get when running a trading strategy within the backtest-kit framework. Each strategy's performance is summarized in this result object. 

It includes the strategy's name so you know which strategy produced the result. You'll also find detailed statistics about the backtest, giving you insights into its performance.  A key metric, used for comparing strategies, is also present, and there's a ranking to easily see how the strategy performed relative to others in the comparison.

## Interface IWalkerSchema

The IWalkerSchema lets you set up comparisons between different trading strategies in a structured way. Think of it as defining an experiment to see which strategy performs best. 

You give it a unique name to identify your experiment, and optionally, a note to explain what it’s about. 

Crucially, you specify the exchange and timeframe you want to use for all the strategies being tested, making sure they’re all operating under the same conditions.

The schema lists the names of the strategies you’re comparing – these strategies need to be registered beforehand. Finally, you can choose a metric, like Sharpe Ratio, to evaluate the strategies against, and optionally provide callbacks to hook into specific stages of the testing process.

## Interface IWalkerResults

This object holds all the information gathered after a backtest comparison, essentially the final report from running a strategy walker. It tells you which asset, or "symbol," was being tested. You'll also find the name of the exchange used for the backtest and the specific name given to the strategy walker itself. Finally, it identifies the "frame," which defines the time period and data used for the analysis.

## Interface IWalkerCallbacks

This interface lets you hook into key moments during the backtesting process. Think of it as a way to get notified and potentially react to what’s happening as different trading strategies are tested.

You can be informed when a specific strategy begins its backtest, allowing you to log its start or prepare for data processing.  
Similarly, you’ll receive notifications when a strategy's backtest finishes, along with performance statistics and a metric value.  
If a backtest encounters an error and stops prematurely, you’ll be alerted to the problem, enabling you to debug or handle it gracefully.  
Finally, you’ll be notified when the entire backtesting process concludes, providing access to the aggregated results.


## Interface IStrategyTickResultScheduled

This interface describes what happens when a trading strategy generates a signal that's scheduled for later activation. Think of it as a notification that a strategy has identified a potential trading opportunity, but isn't executing it right away – it’s waiting for the price to reach a specific level. The notification includes details like the strategy's name, the exchange it’s operating on, the symbol being traded (e.g., BTCUSDT), and the current price when the signal was created. It also tells you if this event occurred during a backtest or in live trading. The “action” property confirms it’s a “scheduled” signal, and the “signal” property contains the specifics of that scheduled order.

## Interface IStrategyTickResultOpened

This interface describes what happens when a new trading signal is created within the backtest-kit framework. It's a notification that a signal has been successfully generated, validated, and saved.

The notification includes key details like the name of the strategy that created the signal, the exchange and symbol involved, and the current price used when the signal was opened. You'll also find the complete signal data itself, along with a flag indicating whether this event originated from a backtest or a live trading environment. This information is crucial for monitoring signal creation and debugging any issues that might arise.


## Interface IStrategyTickResultIdle

This interface represents what happens when a trading strategy isn't actively making decisions – it's in an "idle" state. Think of it as a notification that the strategy is just observing the market. It includes details like the strategy’s name, the exchange being used, the trading symbol (like BTCUSDT), and the current price.  You’ll also see whether this idle event is occurring during a backtest or in a live trading environment. Essentially, it provides a snapshot of the market conditions when the strategy is paused.

## Interface IStrategyTickResultClosed

This interface represents the outcome when a trading signal is closed, providing a detailed record of what happened. It tells you precisely why the signal closed – whether it was due to a time limit expiring, a take-profit target being hit, or a stop-loss being triggered. You'll find key information like the final price used to close the position, the exact timestamp of the closure, and a breakdown of the profit or loss, including any fees and slippage. The record also clearly identifies the strategy, exchange, and trading pair involved, and indicates whether this event occurred during a backtest or a live trading session. Essentially, it's a comprehensive report card for a completed trading signal.


## Interface IStrategyTickResultCancelled

This interface represents what happens when a trading signal that was scheduled doesn't actually result in a trade. It signifies that a planned signal was cancelled – perhaps it didn't trigger, or a stop-loss was hit before a position could be opened.

You'll see this result when you're reviewing the history of events within your backtest or live trading.  The data provided includes the original scheduled signal that was cancelled, the price at the time of cancellation, and details about the strategy, exchange, and symbol involved.  A crucial piece of information is the `reason` property, which explains *why* the signal was cancelled, and an optional ID if the cancellation was manually initiated. You also get information about whether the event occurred during a backtest or in live trading.

## Interface IStrategyTickResultActive

This interface describes a tick result within the backtest-kit framework, specifically when a strategy is actively monitoring a trade – waiting for a take profit, stop loss, or time expiration. It essentially signifies a paused state where the system is watching a signal.

The result includes key information like the signal being monitored, the current VWAP price, and the names of the strategy, exchange, and trading symbol involved.  You'll also find progress indicators showing how close the trade is to reaching the take profit or stop loss, expressed as percentages. Finally, it indicates whether the event originates from a backtesting simulation or a live trading environment.

## Interface IStrategySchema

This schema outlines the structure for defining a trading strategy within the backtest-kit framework. Each strategy needs a unique name for identification and can include a note for developers to add clarifying details.

The `interval` property controls how often the strategy generates signals, preventing it from overwhelming the system.

The core of the strategy is the `getSignal` function – this is where the logic for analyzing market data and deciding when to trade lives. It can generate signals immediately, or create signals that wait for a specific price level to be reached.

Strategies can also be customized with callbacks for specific events like when a trade opens or closes.  You can assign a risk profile name and even a list of risk profiles if a strategy requires multiple.


## Interface IStrategyResult

This interface, `IStrategyResult`, helps organize and display the outcomes of different trading strategies after a backtest. Think of it as a single row in a comparison table – it neatly bundles together a strategy's name, its comprehensive statistical data like total profit and drawdown, and a key metric used to rank its performance. The `strategyName` is simply the identifier of the strategy.  `stats` holds all the detailed numbers from the backtest itself, giving you a full picture of how the strategy performed. Finally, `metricValue` represents a specific value (often from optimization) that’s used to compare strategies against each other; it can be null if the strategy wasn't valid for that metric.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the outcome of a trading strategy's performance, specifically focusing on profit and loss. It provides details about how much the strategy gained or lost, expressed as a percentage. 

You'll find the `pnlPercentage` property, which tells you the profit or loss as a percentage—a positive number means profit, and a negative number indicates a loss. 

It also includes `priceOpen` and `priceClose`, which show the actual prices used for entering and exiting trades, respectively. Crucially, these prices already account for realistic trading costs like fees and slippage (a small difference between the expected price and the actual execution price), making the results more accurate.

## Interface IStrategyCallbacks

This interface defines a set of optional callbacks you can use to react to different events within your trading strategy. Think of them as hooks that let your code respond to what's happening – a new signal being opened, a signal becoming active, or even a period of inactivity.

You can listen for events like when a new signal is opened, when it's actively being monitored, or when there are no signals active at all.  There are also callbacks for when a signal is closed, scheduled for later entry, or canceled.

Beyond the basic lifecycle events, you can also get notified about partial profits or losses, and even get a regular "ping" every minute – this is useful for things like checking if a scheduled signal should be cancelled. The `onWrite` callback is primarily for testing purposes, allowing you to persist signal data. These callbacks give you a lot of flexibility to customize how your strategy interacts with the backtest environment.

## Interface ISizingSchemaKelly

This defines a way to size your trades using the Kelly Criterion, a method for determining optimal bet size based on expected return and risk.  When you use this schema, you're telling the backtest system you want to size trades according to this specific formula. The `kellyMultiplier` property controls how aggressively the Kelly Criterion is applied - a lower value (like the default 0.25) represents a more conservative approach, while a higher value takes a bigger portion of your capital for each trade. This parameter helps you manage risk because it prevents you from risking too much on any single trade.

## Interface ISizingSchemaFixedPercentage

This schema defines a trading strategy where the size of each trade is determined by a fixed percentage of your available capital.  It's straightforward: you specify a `riskPercentage`, like 1% or 2%, and the framework automatically calculates the trade size to ensure you only risk that percentage of your portfolio on each trade. This helps manage risk consistently across different trade opportunities. The `method` property simply identifies this as a "fixed-percentage" sizing approach.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, provides a foundation for defining how much of your account you'll allocate to a trade. It ensures all sizing configurations have consistent core elements. 

Each sizing configuration gets a unique `sizingName` to easily identify it, and you can add a `note` to explain its purpose. The interface lets you control position sizing with `maxPositionPercentage`, which caps the trade at a certain percentage of your account balance, and sets absolute limits with `minPositionSize` and `maxPositionSize`.  Finally, you can define optional `callbacks` to execute specific logic at different stages of the sizing process.

## Interface ISizingSchemaATR

This schema defines how your trading strategy determines the size of each trade based on the Average True Range (ATR). It's specifically designed for strategies that use ATR to manage risk.

The `method` is always set to "atr-based" to indicate the sizing approach.

`riskPercentage` tells the framework what portion of your account balance you're willing to risk on a single trade, expressed as a percentage.  For instance, a value of 1 would mean risking 1% of your account per trade.

`atrMultiplier` is a crucial factor. It dictates how much the stop-loss distance is calculated based on the ATR value. A higher multiplier results in wider stops.

## Interface ISizingParamsKelly

This interface defines the parameters needed to calculate trade sizes using the Kelly Criterion. It's used when setting up how much capital your trading strategy will risk on each trade.

The `logger` property allows you to connect a logging service, which is helpful for debugging and understanding how the sizing calculations are working. This lets you see details about the sizing process as your backtest runs.

## Interface ISizingParamsFixedPercentage

This interface defines how to set up a trading strategy that uses a fixed percentage of your available capital for each trade. It’s designed to work with the backtest-kit framework's sizing mechanisms. You’ll need to provide a logger to help with debugging and understanding how your strategy is behaving, receiving information about the trade sizing process. Essentially, this lets you control the risk you take on each trade by consistently using a predefined portion of your funds.

## Interface ISizingParamsATR

This interface defines the settings you can use when determining how much of an asset to trade based on the Average True Range (ATR). It’s particularly useful when you want your trading size to adjust dynamically to market volatility.

Essentially, it includes a `logger` property which helps you track what’s happening behind the scenes, allowing you to debug and understand your sizing strategy. The logger allows you to output debug information about your trading decisions.


## Interface ISizingCallbacks

This section describes the functions you can use to monitor and potentially influence how your trading strategy determines position sizes. Specifically, `onCalculate` is triggered immediately after the framework calculates how much to buy or sell. You can use this to check if the calculated size makes sense, log the details for review, or make minor adjustments – it’s a great place for debugging or implementing custom validation.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate your trade size using the Kelly Criterion. It’s all about figuring out how much to risk on each trade based on your historical performance. You'll need to provide your win rate, which is the proportion of trades that result in a profit, and the average win/loss ratio, representing how much you typically make compared to how much you lose on winning trades. Essentially, it's a way to let the framework estimate an optimal bet size to maximize long-term growth.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate trade sizes using a fixed percentage approach. When you’re using this method, you'll specify that the sizing method is "fixed-percentage." You'll also need to provide a `priceStopLoss` value, which represents the price at which your stop-loss order will be triggered. This allows the sizing calculation to factor in your risk management parameters.

## Interface ISizingCalculateParamsBase

This interface defines the core information needed when figuring out how much to trade. Every sizing calculation, whether it's for a simple strategy or a complex one, will use these basic parameters. You'll need to know the trading pair you're working with, like "BTCUSDT," along with your current account balance. Finally, you'll also need to specify the price at which you plan to enter the trade. These three pieces of data form the foundation for determining your trade size.


## Interface ISizingCalculateParamsATR

This interface defines the settings you'll use when determining trade size based on the Average True Range (ATR). It’s essentially a way to tell the backtest kit how to use ATR to figure out how much to trade.  You’ll specify that the sizing method is "atr-based", and then provide the current ATR value, which acts as a key input for the sizing calculation. Think of it as providing the volatility information that influences your position sizing.

## Interface ISizing

The `ISizing` interface is a core part of how backtest-kit determines how much of an asset your trading strategy should buy or sell. Think of it as the engine that figures out the right size for your trades.

It has one main method, `calculate`, which takes in a set of parameters detailing your risk preferences and market conditions.  This method then returns a promise that resolves to the calculated position size – a number representing how many units of the asset to trade.  Essentially, it’s the place where your sizing logic lives.

## Interface ISignalRow

The `ISignalRow` represents a finalized trading signal, complete with all the necessary details for execution. Think of it as the standardized format used internally after a signal has been validated and is ready to be acted upon.

Each signal gets a unique identifier (`id`) automatically generated for tracking purposes. You'll also find the opening price (`priceOpen`) at which a position should be entered, along with the specific `exchangeName` and `strategyName` responsible for the signal.

Crucially, it records the `scheduledAt` timestamp, marking when the signal was originally created, and the `pendingAt` timestamp, indicating when the position became active. The `symbol` clearly identifies the trading pair involved, such as "BTCUSDT". Finally, `_isScheduled` is an internal flag used by the system to identify signals that were scheduled.

## Interface ISignalDto

The `ISignalDto` represents a trading signal, acting as a standard way to pass signal information around within the backtest-kit framework. Think of it as a blueprint for a trading idea.

It includes key details like the direction of the trade – whether you’re going long (buying) or short (selling).  You'll also specify the entry price, your target take profit price, and where to place your stop loss to limit potential losses.  A helpful note field lets you document *why* you’re making this trade.

Importantly, the `ISignalDto` also defines an expected duration for the trade using `minuteEstimatedTime`. 

The framework handles creating a unique ID for each signal automatically, so you don't always need to provide one yourself.

## Interface IScheduledSignalRow

This interface describes a signal that's waiting for the market to reach a certain price before it's triggered. Think of it as a signal put on hold – it won’t actually execute a trade until the price hits a specific level, which is defined by `priceOpen`. 

It's built upon the standard signal row, but with an added delay.  Once that target price is reached, it transforms into a standard, active signal. A key characteristic is how the "pending" time is tracked; initially, it reflects when the signal was scheduled, but once it activates, it updates to the actual time it started waiting. The `priceOpen` property tells you exactly what price level is needed to trigger the signal.

## Interface IScheduledSignalCancelRow

This interface represents a scheduled trading signal that can be cancelled by the user. It builds upon the standard scheduled signal information by adding a unique identifier, `cancelId`, which is only present when a user has specifically requested to cancel that signal. Think of it as a way to track and manage cancellations initiated directly by you, allowing for potential adjustments or further processing related to those cancellations.  If a signal wasn't cancelled by a user, this `cancelId` property won't exist.


## Interface IRiskValidationPayload

This structure holds the information needed for risk validation checks. It combines the details of a pending trade signal with a snapshot of your portfolio's current state. You'll find information about the signal you're considering, how many positions you currently have open, and a full list of those active positions. This lets your risk validation logic make informed decisions based on the overall situation, not just the immediate trade.

## Interface IRiskValidationFn

This defines a special function that helps ensure your trading strategies are behaving responsibly. Think of it as a safety check. It takes some data related to a trade and decides whether the trade is allowed to proceed. If everything looks good, the function doesn't do much – it either returns nothing or null. However, if something seems risky, it can either return a specific result object detailing the problem or throw an error, signaling that the trade shouldn't happen. This allows for flexible and informative risk management within your backtesting environment.

## Interface IRiskValidation

This interface helps you define how to check if a trading action is safe and appropriate. Think of it as setting up rules to make sure your backtesting strategy doesn’t do anything risky.

It has two parts: a `validate` function, which is the actual logic that performs the risk check, and an optional `note` field that lets you add a description to explain what the validation is supposed to do. This note is really useful for keeping track of why you set up a specific risk validation rule.

## Interface IRiskSchema

This interface, `IRiskSchema`, helps you define and manage risk controls for your trading strategies. Think of it as a blueprint for how your portfolio will handle risk. 

You give each risk control a unique `riskName` to easily identify it. You can also add a `note` to explain the purpose of the risk control – a handy reminder for yourself or other developers.

If you want to react to when a trade is rejected or allowed, you can define `callbacks` to trigger custom actions.  The most important part is the `validations` array. This is where you put the actual rules that determine whether a trade is allowed to proceed, ensuring your portfolio stays within your defined risk boundaries. You can add multiple validations to cover different scenarios.

## Interface IRiskRejectionResult

This interface, `IRiskRejectionResult`, helps you understand why a trading strategy's risk validation failed. It's essentially a report card when something goes wrong during the risk check process.  You’ll find a unique `id` to pinpoint the specific rejection, and a helpful `note` explaining the reason for the failure in plain English.  Think of it as a way to quickly diagnose and fix issues preventing your strategy from running.

## Interface IRiskParams

This interface defines the settings you provide when setting up the risk management system. It includes things like a logger to help with debugging, a flag to indicate whether you're in a backtesting environment (simulated trading) or live trading.

Importantly, it also has a special callback function, `onRejected`, that gets triggered whenever a trading signal is blocked because it violates your risk rules. This allows you to react to these rejections, perhaps by logging the event or sending notifications. This callback runs *before* the system officially reports the rejection, giving you a chance to do something before it's finalized.

## Interface IRiskCheckArgs

The `IRiskCheckArgs` interface holds all the information needed to decide whether a new trade should be allowed. Think of it as a gatekeeper, consulted before a signal is created to make sure everything lines up. It includes details like the trading pair (`symbol`), the signal itself (`pendingSignal`), the name of the strategy requesting the trade (`strategyName`), the exchange being used (`exchangeName`), the current price (`currentPrice`), and a timestamp (`timestamp`). All these pieces of data are passed directly from the ClientStrategy context for evaluation.

## Interface IRiskCallbacks

This interface defines optional functions you can use to get notified about the results of risk checks within your trading strategies. Think of it as a way to react to whether a trade idea is considered safe to proceed with or not.

You can specify a function, `onRejected`, to be called when a trading signal fails a risk assessment—essentially, when the system flags it as too risky to execute.  

Conversely, `onAllowed` gets triggered when a signal successfully passes all the defined risk checks, indicating it’s considered acceptable for trading. These callbacks allow you to build custom logic around risk management decisions.

## Interface IRiskActivePosition

This interface represents a single, active trading position that's being monitored for risk management purposes. Think of it as a snapshot of a trade currently held. It tells you which strategy initiated the trade, which exchange it's on, and precisely when the position was opened.  Crucially, it also includes the signal data that prompted the trade – the details behind why that specific trade was executed.  ClientRisk uses these position details to analyze risk across multiple trading strategies simultaneously.


## Interface IRisk

The `IRisk` interface is your central point for managing risk within your trading strategies. It helps ensure that your trading decisions don't exceed predefined risk boundaries and keeps track of open positions.

The `checkSignal` function is the key to risk assessment; it lets you evaluate whether a potential trading signal is permissible given your existing risk limits. 

`addSignal` is used to notify the risk management system when a new trade is initiated, allowing it to monitor and factor in the new position. 

Conversely, `removeSignal` informs the system when a trade is closed, enabling it to update position tracking and available risk capacity.

## Interface IPositionSizeKellyParams

The `IPositionSizeKellyParams` interface helps you calculate position sizes based on the Kelly Criterion, a strategy for betting or investing. It defines the essential inputs needed for this calculation. You’ll provide your expected win rate, expressed as a number between 0 and 1, and the average ratio of your wins to your losses.  These two values together allow the framework to determine how much of your capital to allocate to each trade.

## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed for a trading strategy that uses a fixed percentage of your available capital to determine the size of each trade, but also includes a stop-loss price. Specifically, `priceStopLoss` tells the system at what price you want to place a stop-loss order to limit potential losses on the trade. This ensures your strategy incorporates risk management by automatically setting a stop-loss based on the trade's price.

## Interface IPositionSizeATRParams

This interface defines the settings needed to determine your trade size based on the Average True Range (ATR). Specifically, it lets you specify the current ATR value. Think of the ATR as a measure of market volatility; a higher ATR means the market is moving more, and this value helps you adjust your position size accordingly. You'll use this value within a larger calculation to figure out how much to trade.

## Interface IPersistBase

This interface defines the basic operations for saving and retrieving data within the backtest-kit framework. It allows you to manage persistent entities, ensuring they are properly initialized and stored. You can use `waitForInit` to set up the storage location and make sure it's ready, and `hasValue` to quickly check if a specific piece of data already exists. When you need to save data, `writeValue` handles the storage process reliably. Reading existing data is handled by `readValue`, which fetches the entity from storage.

## Interface IPartialData

This interface, `IPartialData`, helps us save and load trading data efficiently. Think of it as a snapshot of important information for a specific trading signal – just enough to get things going again later.  It's designed to be easily stored and retrieved, even across sessions.

The key parts are the `profitLevels` and `lossLevels` properties. These hold arrays of levels that have been hit during trading, essentially representing the signal's progress. These arrays are created from sets, ensuring they can be saved as JSON and loaded back later. The `IPartialData` object is used to store information about a signal and will be combined with other partial data to recreate the complete trading state.


## Interface IPartial

This interface, `IPartial`, is responsible for keeping track of how well (or poorly) your trading signals are performing. It handles the process of recognizing when a signal hits profit or loss milestones like 10%, 20%, or 30%.

When a signal is making money, the `profit` method calculates the current profit level and alerts you when new thresholds are met. Similarly, the `loss` method handles situations where a signal is losing money, notifying you of losses at established percentages.

Finally, when a signal finishes trading – whether it hits a target profit, a stop-loss, or simply expires – the `clear` method cleans up all the data associated with that signal, making sure things are tidy and ready for the next trade. It essentially resets the tracking for that specific signal.

## Interface IOptimizerTemplate

This interface helps create building blocks for your backtesting code, especially when you're integrating with Large Language Models (LLMs). Think of it as a set of tools to generate the necessary code snippets for different parts of your trading system.

It provides methods for generating:

*   **Initial Setup:**  `getTopBanner` creates the starting code, including imports and initial settings.
*   **LLM Communication:** `getUserMessage` and `getAssistantMessage` craft the messages that will be passed back and forth between your code and the LLM.
*   **Configuration:** Several methods (`getWalkerTemplate`, `getExchangeTemplate`, `getFrameTemplate`, `getStrategyTemplate`) generate the code that defines your core components – the Walker, Exchanges, Timeframes (Frames), and Trading Strategies.  `getStrategyTemplate` has special integration for using LLMs within your strategies.
*   **Execution:** `getLauncherTemplate` generates the code needed to actually run the Walker and listen for events.
*   **Helper Functions:**  `getTextTemplate` and `getJsonTemplate` generate simple helper functions to format outputs – one for plain text and one for JSON, which is often needed for structured responses from LLMs.
*   **Debugging:** `getJsonDumpTemplate` assists in creating debug output using `dumpJson`.

## Interface IOptimizerStrategy

This interface, `IOptimizerStrategy`, holds all the information needed to understand and work with a trading strategy created using a large language model. Think of it as a package containing everything that went into designing the strategy.  It includes the trading pair it’s intended for (the `symbol`), a unique `name` for easy tracking, and a complete record of the conversation with the language model (`messages`).  Most importantly, it has the `strategy` itself, which is the actual trading logic generated by the LLM – essentially the instructions the trading system will follow.

## Interface IOptimizerSourceFn

This function acts as your data provider for backtest-kit's optimization process. Think of it as the source that feeds data to the optimizer so it can learn and adjust strategies. It's designed to handle large datasets efficiently using pagination, breaking them down into smaller chunks. Crucially, the data you provide needs to have unique identifiers for each data point, helping the system keep track of everything.

## Interface IOptimizerSource

This interface describes where your backtesting data comes from and how it's presented to a language model. Think of it as defining a pipeline for feeding data into your optimization process. 

You'll give it a name to easily identify the data source, and a short description to explain what it contains.

The most important part is the `fetch` function; this is how you actually retrieve the historical data, and it needs to handle getting data in chunks (pagination).

You can also customize the format of the messages sent to the language model. The `user` property lets you control how the user's prompts are formatted, while the `assistant` property lets you control how the model's responses are presented. If you don't specify these, the system will use default formatting.

## Interface IOptimizerSchema

This interface describes how an optimizer works within the backtest-kit framework. Think of it as a blueprint for creating and evaluating trading strategies using AI. 

It outlines several key pieces: 

*   You can add a descriptive note to help you remember what the optimizer does.
*   Each optimizer needs a unique name for identification.
*   The `rangeTrain` property specifies different time periods to train your strategies, allowing you to compare multiple variations.
*   A `rangeTest` defines the period used to check how well your generated strategies perform.
*   `source` lists the data sources that feed information to the AI, building the context for strategy creation.
*   The `getPrompt` function is responsible for crafting the specific instructions given to the AI to generate a strategy, using the gathered information.
*   `template` lets you customize the strategy generation process, if needed, building upon default settings.
*   Finally, `callbacks` provides a way to monitor the optimizer's progress and events.

## Interface IOptimizerRange

This interface helps you specify a specific time period for your backtesting or optimization. Think of it as defining the “window” of historical data you want to use. You provide a `startDate` and an `endDate` to clearly mark the beginning and end of that period.  You can also add a `note` to give the range a descriptive label, which can be helpful when you're working with multiple ranges.

## Interface IOptimizerParams

This interface, `IOptimizerParams`, holds the information needed to set up the core optimization process. Think of it as a container for the essential pieces. 

It includes a `logger`, which is crucial for tracking what's happening during optimization and providing helpful messages. This logger is automatically provided by the system.

Also, there's a `template` property, which defines all the methods and logic used for the optimization. This template is built by combining user-defined settings with default configurations.

## Interface IOptimizerFilterArgs

This interface, `IOptimizerFilterArgs`, defines the criteria used to retrieve data for backtesting. It specifies which trading pair, like "BTCUSDT," you're interested in, along with the specific start and end dates that encompass the historical data you need. Think of it as a way to pinpoint exactly which data points your backtest should analyze, ensuring it's focused on the right symbol and time period. It helps the backtest kit efficiently grab the correct historical data for your simulations.

## Interface IOptimizerFetchArgs

When you're pulling data for optimization, `IOptimizerFetchArgs` helps you control how much data you grab at once. It lets you specify `limit`, which is the maximum number of records you want in each chunk of data, and `offset`, which tells the system how many records to skip before starting to fetch. Think of it like paging through a large dataset – `limit` controls how many items show on each page, and `offset` moves you to different pages. The default `limit` is 25, but you can adjust it to suit your needs.

## Interface IOptimizerData

This interface, `IOptimizerData`, acts as a foundation for any data source feeding information into the backtest optimization process. Think of it as a standard way for different data sources to present their data.  Crucially, every piece of data provided must have a unique `id`.  This `id` helps prevent duplicates when dealing with large datasets or when data is being fetched in chunks.

## Interface IOptimizerCallbacks

This interface lets you hook into different stages of the optimization process, giving you a chance to monitor what's happening and ensure things are running correctly. You can receive notifications when strategy data is ready, code is generated, or code is saved to a file. 

There’s also a callback that fires after data is pulled from your data sources, letting you inspect that data as it comes in. This allows for flexible logging or validation at various points during backtest kit’s operation.

Here's a breakdown of the available callbacks:

*   **onData:** Notified when the strategy data is prepared for all training periods.
*   **onCode:** Called when the strategy code has been created.
*   **onDump:** Triggered after the strategy code has been written to a file.
*   **onSourceData:**  Signals when data is fetched from a data source, providing access to the data, source name, and date range.

## Interface IOptimizer

This interface defines how to interact with an optimizer, allowing you to generate and retrieve trading strategies. You can use it to get a list of potential strategies for a specific asset, effectively pulling data and creating initial strategy outlines.  It also lets you request the complete code for a strategy, combining all the necessary components into a runnable program. Finally, you can save that complete strategy code directly to a file, creating the necessary directory structure if it doesn’t already exist and saving the strategy as a `.mjs` file.


## Interface IMethodContext

The `IMethodContext` interface acts like a little helper, carrying important information about which parts of your trading system should be used for a particular operation. Think of it as a set of instructions, telling the framework exactly which strategy, exchange, and frame configurations to load. It's passed around within the backtest-kit, ensuring that everything works together seamlessly.  Essentially, it defines the specific context for a trading operation by referencing the names of the schemas defining your strategy, exchange, and trading frame. If you’re running a live trading scenario, the frame name will be empty.

## Interface ILogger

The `ILogger` interface defines how different parts of the backtest-kit framework report information. It's a standardized way for components to record events, errors, and helpful details throughout the system’s operation.

You can use it to log messages at various levels: general messages (`log`), detailed debugging information (`debug`), informational updates (`info`), and warnings about potential issues (`warn`). These logs are invaluable for understanding what’s happening, troubleshooting problems, and monitoring the system’s overall health. It ensures consistent logging across agents, sessions, and other core pieces.

## Interface IHeatmapRow

This interface represents a single row of data for the portfolio heatmap, giving you a snapshot of how a specific trading pair performed. It bundles together key performance indicators like total profit and loss, risk metrics like the Sharpe Ratio and maximum drawdown, and trade statistics such as the number of wins and losses. You'll find metrics that help you understand not just how much money was made or lost, but also how consistently the strategies performed for that symbol, and what the average win and loss amounts were. Essentially, it provides a concise overview of a symbol's trading history within the backtest.

## Interface IFrameSchema

The `IFrameschema` is how you tell backtest-kit about the specific time periods and frequencies your strategy will be evaluated against. Think of it as defining the scope of your backtest. Each `IFrameschema` represents a distinct trading timeframe, giving it a unique name for identification. 

You can add a short note to explain why a particular timeframe was chosen. 

Crucially, you specify the `interval` – this determines how often timestamps will be generated, like every minute, hour, or day. You also set the `startDate` and `endDate` to define the beginning and end of the backtest period. Finally, you can optionally provide callbacks to hook into various points in the frame lifecycle, for custom logic.

## Interface IFrameParams

The `IFramesParams` interface defines the information needed to set up a frame within the backtest-kit framework. Think of a frame as a reusable, self-contained piece of your trading strategy. It allows you to pass in a logger, which is really helpful for debugging and understanding what your frame is doing during the backtest. This logger lets you output information and track down any issues that might arise. It builds upon `IFramesSchema`, incorporating this logging capability for more transparent and manageable backtesting.

## Interface IFrameCallbacks

This interface defines a set of functions that can be used to react to different stages in a backtest frame's lifecycle. Specifically, `onTimeframe` allows you to be notified when the timeframes for a backtest are calculated. This is a great opportunity to inspect the timeframes that were generated – perhaps to log them for debugging, or to ensure they meet your expected criteria. It provides the timeframe array, the start and end dates for the timeframe, and the interval used to generate them.

## Interface IFrame

The `IFrames` interface helps backtest-kit generate the timeline your strategies will run against. Think of it as the system's way of creating a schedule of dates and times. 

The core function, `getTimeframe`, is used to produce an array of timestamps for a specific trading symbol and timeframe (like "1m" for 1-minute intervals). It takes the symbol and frame name as input and returns a `Promise` that resolves to an array of dates, evenly spaced according to your chosen timeframe. This ensures your backtest runs at consistent intervals.

## Interface IExecutionContext

The `IExecutionContext` interface holds the necessary information for your trading strategies and exchange interactions to function correctly. Think of it as a package of details passed along to tell your code what's happening right now. It includes the trading symbol, like "BTCUSDT," which identifies the asset you're trading. It also provides the current timestamp, which is crucial for accurate time-based calculations. Finally, it indicates whether the code is running in a backtesting environment, allowing it to behave differently in simulated versus live trading scenarios.


## Interface IExchangeSchema

This interface describes how backtest-kit connects to and understands a particular cryptocurrency exchange. Think of it as a blueprint for integrating a new exchange into the framework. It includes a unique name to identify the exchange, a place for helpful notes, and most importantly, code to retrieve historical price data (candles) and correctly format trade quantities and prices to match the exchange’s rules. You can also optionally define callbacks for things like when new candle data arrives, allowing for custom reactions to incoming information.

## Interface IExchangeParams

This interface, `IExchangeParams`, is all about setting up your exchange connection within the backtest-kit framework. Think of it as the initial configuration you provide when creating your exchange object. 

It requires a `logger` – this is how your exchange will report important messages and debugging information during the backtesting process. 

You also need to supply an `execution` context. This context holds crucial information like the trading symbol, the date and time of the backtest, and whether it's a backtest or a live execution. Providing this ensures your exchange behaves correctly within the simulation.

## Interface IExchangeCallbacks

This section describes optional functions you can provide to the backtest-kit framework to receive notifications from the data source. Specifically, `onCandleData` lets you know when new candlestick data becomes available. It's triggered when the framework pulls historical or real-time price information for a particular trading symbol and timeframe. You'll receive the symbol, interval (like 1 minute or 1 day), the starting date for the data, the number of candles requested, and an array containing the actual candlestick data.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with a cryptocurrency exchange. It gives you ways to retrieve historical and future price data (candles) for specific trading symbols and time intervals. You can also use it to format order quantities and prices to match the exchange's requirements, ensuring your orders are correctly interpreted. Finally, it offers a handy function to calculate the Volume Weighted Average Price (VWAP) based on recent trading activity.

## Interface IEntity

This interface, `IEntity`, serves as the foundation for any data that’s saved and retrieved within the backtest-kit framework. Think of it as a common starting point – if your data needs to be stored, it probably needs to implement this interface. It establishes a basic structure that ensures consistency and simplifies how these entities are managed.

## Interface ICandleData

This interface defines the structure for a single candlestick, which is a standard unit of time-based price data in trading. Each candlestick represents a specific time interval and contains key information like the opening price, the highest and lowest prices reached during that time, the closing price, and the total volume of trades. The `timestamp` property tells you exactly when that period began. This data is fundamental for backtesting strategies and calculating indicators like VWAP.

## Interface HeatmapStatisticsModel

This model holds all the key data used to create a portfolio heatmap, giving you a quick snapshot of how your investments are performing. It breaks down the overall picture into details about each individual symbol you're tracking.

You’ll find an array of `IHeatmapRow` objects, each representing a specific symbol’s statistics. Alongside that, it provides overall portfolio metrics like the total number of symbols held, the combined profit and loss (Pnl), a Sharpe Ratio indicating risk-adjusted returns, and the total number of trades executed. Essentially, it's a consolidated view of your portfolio's health.

## Interface DoneContract

This interface lets you know when a background process, either a backtest or a live trade execution, has finished. It provides key information about what just completed, like the exchange used, the name of the trading strategy, whether it was a backtest or live execution, and the specific trading symbol involved. Think of it as a notification that gives you the details about a finished task. You can use this information to track progress or perform actions after a background operation concludes.

## Interface ColumnModel

This interface helps you customize how data is displayed in tables generated by backtest-kit. Think of it as a blueprint for each column you want to show. 

You define a unique identifier for each column with the `key` property.  The `label` lets you set the user-friendly name that appears in the table header.

The `format` function is the real powerhouse – it lets you transform the underlying data into a string for display, providing complete control over the presentation.  Finally, `isVisible` allows you to dynamically control whether a column is shown or hidden, perhaps based on some condition.


## Interface BacktestStatisticsModel

This model organizes the statistical results from your backtesting runs, giving you a clear picture of how your trading strategy performed. It presents a range of key metrics, all designed to help you evaluate and refine your approach.

You'll find a detailed list of every trade that was closed, along with its specific data like price and profit/loss.  The model also summarizes the overall performance with counts of winning and losing trades, and calculates important ratios like win rate and average profit per trade.

To assess risk, it provides volatility measurements like standard deviation and the Sharpe Ratio, which considers both returns and risk.  You can see the expected yearly returns and a certainty ratio, which helps gauge the robustness of winning trades versus losing ones. Keep in mind that some values might be unavailable if the calculation produces unreliable results (like dividing by zero).
