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

This interface defines what information is sent when a walker needs to be stopped. Think of it as a notification that a particular trading strategy, running under a specific name, needs to be paused within a larger system. It’s particularly useful when multiple strategies are active at once, as it identifies exactly which walker and strategy should be halted. The notification includes the trading symbol, the name of the strategy, and the name of the walker, allowing for targeted interruption of trading processes.

## Interface WalkerStatisticsModel

The WalkerStatisticsModel helps organize and present the results of backtesting strategies. It's essentially a refined version of the standard WalkerResults, providing extra information to compare different strategies against each other. Think of it as a way to easily see how various trading approaches performed.

The core of this model is the `strategyResults` property, which is simply a list containing the performance data for each strategy you've tested. This allows you to quickly compare metrics like profitability, drawdown, and other key indicators across all your strategies at once.

## Interface WalkerContract

The `WalkerContract` helps you follow along with how backtest-kit is comparing different trading strategies. It provides updates as each strategy finishes its test run and is ranked.

You'll see information like the name of the strategy that just completed, the exchange and symbol being tested, and the specific metric the system is trying to improve. 

The data includes key performance statistics, the current metric value for that strategy, and how it compares to the best-performing strategy found so far. It also tells you how many strategies have been tested and how many are left to go, giving you a clear picture of the progress.

## Interface WalkerCompleteContract

This interface represents the culmination of a backtesting process within the backtest-kit framework. It's fired when a "walker" – a process that tests multiple trading strategies – has finished running and all the results are ready. 

Think of it as a final report card. 

It bundles together key information like the name of the walker, the asset being traded (symbol), the exchange and timeframe used, and the optimization metric guiding the tests. You'll also find details about how many strategies were tested, which one performed the best, and its corresponding metric score. Finally, a comprehensive set of statistics is included to provide a deep dive into the best-performing strategy.

## Interface TickEvent

This data structure represents a single event in your backtesting process, giving you a consistent way to understand what happened during a trade, no matter what action was taken. Each event has a timestamp indicating when it occurred. 

You'll find information like the type of action that took place (idle, opening a trade, the trade running, or the trade closing), the trading pair involved, the signal ID that triggered the trade, and details about the trade's position, note and pricing. 

For active trades, it also includes information about how close the trade is to hitting its take profit or stop loss targets.  Finally, when a trade closes, you'll see data such as the profit/loss percentage and the reason for its closure, along with the total duration of the trade.

## Interface SignalData$1

This interface, `SignalData`, is designed to hold the key details about a completed trading signal, specifically for use in calculating and displaying performance metrics like profit and loss. Each `SignalData` object represents a single trade that has finished.  You'll find information like the name of the strategy that created the signal, a unique ID for tracking purposes, and the symbol being traded. It also includes the position taken (long or short), the percentage profit or loss, why the signal was closed, and the exact timestamps when the trade was opened and closed. Essentially, it’s a container for everything you need to understand the outcome of a single trading signal.

## Interface ScheduleStatisticsModel

The `ScheduleStatisticsModel` gives you a clear picture of how your scheduled signals are performing. It collects data about every signal that’s been scheduled, opened, or cancelled, allowing you to monitor their behavior.

You can see the complete history of events through the `eventList`, and get quick counts for the total number of signals, those scheduled, opened, and cancelled.  The model also calculates key rates – the `cancellationRate` shows how often signals are cancelled (you want this to be low), and the `activationRate` indicates how often scheduled signals turn into opened signals (you want this to be high). Finally, it provides average wait times for both cancelled and activated signals, helping you understand signal timing and potential inefficiencies.

## Interface ScheduledEvent

This interface holds all the key details about scheduled, active, and closed trading signals, making it easier to generate reports and analyze performance.  Each `ScheduledEvent` represents a specific action taken on a signal, such as scheduling, opening a position, or cancelling it.  You'll find the exact time the event occurred, the type of action that happened (scheduled, opened, or cancelled), and the trading symbol involved.  Crucially, it also includes details like the signal ID, position type, a note about the signal, the current price at the time, and the entry, take profit, and stop-loss prices. For closed signals, the closing timestamp and duration of the trade are also recorded.

## Interface RiskStatisticsModel

This model holds statistics about risk rejections, helping you monitor and understand your risk management system's performance. It contains a list of individual rejection events, each with detailed information. You'll also find the total count of rejections, and breakdowns of those rejections categorized by the trading symbol and by the strategy that triggered them. Essentially, it gives you a clear picture of where your risks are arising from.

## Interface RiskEvent

This data structure holds information about situations where a trading signal was blocked due to risk limits. Think of it as a record of why a trade didn't happen.

Each RiskEvent tells you when the rejection occurred (timestamp), which asset was involved (symbol), and the specifics of the signal that was rejected (pendingSignal). 

You’ll also find details like the name of the strategy that generated the signal, the exchange being used, the market price at the time, and how many positions were already open. 

Finally, a comment explains why the signal was rejected, and a flag indicates whether this event occurred during a backtest or live trading.

## Interface RiskContract

The RiskContract helps you understand why your trading strategies are being prevented from executing. It's a notification that a signal was rejected because it violated risk rules. This notification includes important details like the trading pair involved (symbol), the specifics of the signal that was blocked (pendingSignal), which strategy tried to execute it (strategyName), and the exchange it was intended for (exchangeName).

You'll also see the market price at the time of rejection (currentPrice), your current active position count (activePositionCount), and a reason for the rejection (comment). A timestamp (timestamp) marks exactly when the rejection happened, and a flag (backtest) indicates whether this is happening in a simulated backtest environment or live trading. Think of it as a detailed log of every time your risk controls step in.

## Interface ProgressWalkerContract

The ProgressWalkerContract lets you keep an eye on how a background process, like evaluating trading strategies, is going. It provides updates during the execution, so you can see the walker's name, the exchange and frame it's using, and the trading symbol it's focused on.

You'll get information about how many strategies the walker needs to analyze overall, and how many it has already completed.  Finally, a progress percentage tells you exactly how far along the process is, represented as a number from 0 to 100. This helps you monitor and understand the status of your strategy evaluations.


## Interface ProgressOptimizerContract

This interface, `ProgressOptimizerContract`, lets you follow along with how an optimizer is doing its work. Think of it as a progress report. It tells you what optimizer is running, which trading symbol it's focused on, how many data sources it needs to look at in total, and how many it’s already examined.  You'll also get a percentage representing how much of the work is complete, giving you a clear sense of how much longer the optimizer will take.

## Interface ProgressBacktestContract

This interface describes the updates you'll receive while a backtest is running in the background. It provides key information to monitor the progress of your trading strategy's historical simulation. You'll see the name of the exchange and strategy being used, along with the symbol being traded. The updates tell you the total number of historical data points (frames) the backtest will process, how many have already been analyzed, and the overall percentage of completion. This lets you keep an eye on how long the backtest will take and ensure everything is proceeding as expected.

## Interface PerformanceStatisticsModel

This model holds all the performance data collected during a backtest, organized by the strategy that generated it. You'll find the strategy's name clearly listed, along with the total number of performance events recorded and the overall time it took to run the metrics. The core of the data is broken down further into `metricStats`, providing a detailed view of performance grouped by the type of metric being measured. Finally, a complete list of all the individual performance events – the raw data – is available in the `events` array, allowing for deep dives into specific moments of the backtest.


## Interface PerformanceContract

This interface helps you keep an eye on how your trading strategies are performing. It records key information about different operations, like how long they take to complete.  You'll see details such as when an event happened, what type of operation it was (like order placement or market data retrieval), and how long it took.  Each record also links the metric to a specific strategy, exchange, and trading symbol, making it easy to pinpoint performance bottlenecks. Knowing whether the data comes from a backtest or live trading environment is also included, providing clarity for analysis.

## Interface PartialStatisticsModel

This object helps you understand the results of your trading strategy when it makes partial adjustments to positions. It breaks down the performance into key components, letting you see how many times your strategy resulted in a profit versus a loss. You'll find a detailed list of all the events that triggered these partial adjustments, alongside the total count of all events, and the cumulative profit and loss figures. This allows for a granular analysis of how partial adjustments are impacting overall strategy performance.

## Interface PartialProfitContract

This describes a `PartialProfitContract`, which is a notification sent whenever a trading strategy hits a predefined profit milestone, like 10%, 20%, or 30% gain.  It’s designed to help you keep track of how your strategy is performing and when it’s taking partial profits. 

You'll find important information included in this notification, like the trading symbol (e.g., BTCUSDT), the name of the strategy that generated the signal, and the exchange being used.  It also provides the complete details of the signal itself, the current market price when the milestone was reached, the specific profit level achieved (10%, 20%, etc.), and whether the event came from a backtest or live trading. The timestamp indicates precisely when the profit level was detected, either during live trading or within a historical backtest candle. These notifications are deduplicated to prevent duplicates, even if the price jumps suddenly, triggering multiple levels at once.

## Interface PartialLossContract

The PartialLossContract represents when a trading strategy hits a predefined loss level, like a 10% or 20% drawdown. It's a signal that something is going wrong, and it's useful for keeping track of how much a strategy has lost.

Think of it as an alert that goes off when a strategy’s losses reach specific milestones. These alerts include important details like the trading pair (e.g., BTCUSDT), the name of the strategy generating the signal, the exchange being used, and all the original signal data. You'll also see the current market price and the exact loss level reached, expressed as a positive number even though it indicates a negative loss.

This contract is emitted during both backtesting (simulated historical trading) and live trading, and the timestamp indicates when that loss level was detected - either at the moment of a live tick or at the end of the backtest candle. It's designed to be used by services that generate reports or by users who want to monitor their strategies’ performance and react to significant drawdowns.

## Interface PartialEvent

This `PartialEvent` object is designed to hold key information about profit and loss milestones during a trading backtest or live execution.  It provides a consistent way to track when your strategy hits specific profit or loss levels. Each event includes the exact time it happened, whether it was a profit or a loss, the symbol being traded, the name of the strategy being used, a unique identifier for the signal that triggered the trade, the type of position (long or short), the current market price at the time, the level of profit or loss reached (like 10%, 20%, etc.), and whether it’s a backtest or a live trade. This makes it much easier to generate reports and analyze your trading performance.

## Interface MetricStats

This interface, `MetricStats`, neatly organizes performance data for a specific metric. Think of it as a summary sheet for how long something took to execute. 

It provides a comprehensive view, including the number of times the metric was recorded, the total time spent, and calculated statistics like average, minimum, maximum, standard deviation, and percentiles (like the 95th and 99th). 

You’ll also find information about wait times, capturing the gaps between events associated with the metric.  Essentially, it's a complete package for understanding the performance characteristics of a given operation.

## Interface MessageModel

This describes the basic structure of a message used within the backtest-kit framework, particularly for interactions with Large Language Models. Think of it as a single turn in a conversation.

Each message has a `role` indicating who sent it – whether it's a system instruction, something the user typed, or a response from the LLM itself.

The `content` property holds the actual text of the message, the words being exchanged. 

This model helps keep track of the conversation flow, which is essential for tasks like building prompts for the LLM or understanding how decisions were made during a backtest.

## Interface LiveStatisticsModel

This model gives you a detailed look at how your live trading is performing. It tracks everything from the total number of trades and signals to specific metrics like win rate and average profit per trade. You'll find a comprehensive list of every event that happened during trading, allowing you to dig into the specifics. 

Key statistics like total profit, standard deviation (a measure of volatility), and the Sharpe Ratio (which considers risk when evaluating returns) are provided. Several values will be null if the calculation isn’t reliable, indicating potential issues with the data. The certainty ratio helps you understand the ratio of average wins to losses, and expected yearly returns give you an idea of potential annual gains based on trade performance. Overall, this model helps you assess and refine your trading strategies.

## Interface IWalkerStrategyResult

This interface describes the result you get when running a trading strategy through backtest-kit's comparison system.  It holds information about a single strategy's performance. You’ll find the strategy’s name listed, alongside detailed statistics about its backtest performance – things like total return, Sharpe ratio, and drawdown.  A key value, called the 'metric', represents the score used to compare this strategy against others, and will be null if the strategy's performance couldn't be meaningfully assessed.  Finally, the 'rank' property tells you where this strategy stands in the overall comparison – the higher the rank, the better it performed.

## Interface IWalkerSchema

The `IWalkerSchema` defines how to set up A/B tests for different trading strategies within the backtest-kit framework. Think of it as a blueprint for comparing strategies against each other. 

Each walker, or test setup, needs a unique name to identify it, and you can add a note for your own documentation.  You'll also specify the exchange and timeframe to use for all the strategies being tested within that walker. 

Crucially, the schema lists the names of the strategies you want to compare—these strategies must have been previously registered in the system.  You can choose a metric like "sharpeRatio" to guide the optimization process, and optionally provide callbacks for custom actions during the walker's lifecycle.

## Interface IWalkerResults

This interface holds all the information gathered after running a comparison of different trading strategies. It acts like a report card, summarizing the results of the test. You'll find details like the specific financial instrument (symbol) that was tested, the exchange where the data came from, the name of the automated testing process (walker) that ran the tests, and the timeframe (frame) used for the analysis. Essentially, it bundles everything you need to understand the context of the backtest results.

## Interface IWalkerCallbacks

This interface lets you hook into different stages of the backtesting process. Think of it as a way to get notified about what's happening as your strategies are being tested. 

You can be alerted when a particular strategy begins testing, receive details when a strategy finishes (including key statistics and a performance metric), and also be informed if a strategy encounters an error during its backtest. Finally, you'll get a notification once all of the strategies have been run and the results are ready. This allows you to monitor progress, log events, or perform custom actions during the backtest.

## Interface IStrategyTickResultScheduled

This interface represents a tick result within the backtest-kit framework, specifically when a trading strategy has generated a "scheduled" signal. Think of it as a notification that the strategy has identified a potential trade opportunity but is currently waiting for the market price to reach a specific level.

The result includes key details about that opportunity: the signal itself (containing the planned trade parameters), the strategy and exchange involved, the symbol being traded (like BTCUSDT), the current price at the time the signal was generated, and whether the signal came from a backtest or a live trading environment.  Essentially, it's a snapshot of the conditions leading up to a potential trade activation. The `action` property clearly indicates that this is a "scheduled" signal, distinguishing it from other types of tick results.

## Interface IStrategyTickResultOpened

This interface describes what happens when a new trading signal is created within the backtest-kit framework. It's essentially a notification that a signal has been successfully generated, validated, and saved. 

You'll see key details included in this notification, such as the name of the strategy that created the signal, the exchange and symbol involved (like BTCUSDT), and the current price at the time the signal was opened.  It also tells you whether this signal creation is part of a backtesting simulation or a live trading scenario. The most important piece of information is the `signal` itself, which contains all the data for that newly created signal, including a unique ID that was generated.


## Interface IStrategyTickResultIdle

This interface describes what happens when a trading strategy is in an idle state, meaning it's not currently giving any trading signals. It provides information about the context of this idle period, like the name of the strategy, the exchange it’s running on, and the specific trading pair involved. You'll see the current price at the time of the idle state, and whether this event is occurring during a backtest simulation or a live trading session.  Essentially, it’s a record of the system being quiet, but still keeping track of important details.

## Interface IStrategyTickResultClosed

This interface represents the data you receive when a trading signal is closed, providing a complete picture of what happened. It tells you exactly why the signal closed – whether it was due to a time limit expiring, hitting a take-profit target, or triggering a stop-loss. 

You’ll find the original signal details, the price at which the trade closed, and a breakdown of the profit and loss, including fees and slippage.  The information also includes details about the strategy used, the exchange, and the trading symbol, making it easy to track and analyze your trades. Finally, it indicates whether the event occurred during a backtest or a live trading session.

## Interface IStrategyTickResultCancelled

This interface describes what happens when a trading signal that was planned doesn't actually lead to a trade. It's used when a signal is scheduled but either doesn't trigger or gets stopped before a position is opened.

The `action` property clearly indicates that the signal was cancelled. You'll also find details about the signal itself, the price at the time of cancellation, and timestamps for when the cancellation occurred. 

The information also includes the strategy's name, the exchange used, the symbol being traded, and whether the event happened during a backtest or in live trading. This comprehensive data helps in understanding why the signal didn't execute as expected and provides context for analysis.


## Interface IStrategyTickResultActive

This interface represents a tick event within the backtest-kit framework, specifically when a strategy is actively monitoring a signal and waiting for a take profit (TP), stop loss (SL), or time expiration. It indicates the strategy is "active" and keeps track of important details such as the signal being monitored, the current price used for evaluation, and the strategy and exchange involved. You’ll also find information about the trading symbol and the progress towards the TP or SL targets, expressed as percentages. Finally, it specifies whether the event originates from a backtesting simulation or a live trading environment.

## Interface IStrategySchema

This schema defines how a trading strategy works within the backtest-kit framework. Think of it as a blueprint – it tells the system how your strategy calculates buy and sell signals.

Each strategy needs a unique name so the system can recognize it. You can also add a note to describe the strategy, which is helpful for documentation.

The `interval` property controls how often your strategy can generate signals, preventing it from overwhelming the system.  The core of the strategy is the `getSignal` function, which takes a symbol and a date as input and returns a signal (or null if no action is needed).  It can also wait for a specific price to be reached before executing a trade.

You can also set up callbacks to handle specific events like when a position is opened or closed.  Finally, you can assign risk profiles to your strategy for better risk management, allowing you to categorize it based on its risk level. You can even specify multiple risk profiles if needed.

## Interface IStrategyResult

This interface, `IStrategyResult`, represents a single entry in the comparison table you'll see when evaluating different trading strategies. Think of it as a container holding all the important information about one strategy's performance. It includes the strategy's name so you know what you're looking at, a comprehensive set of statistics detailing how the strategy performed during the backtest – things like total profit, drawdown, and win rate – and a numerical value representing the metric used to rank the strategies. This metric helps you quickly compare strategies and identify the best performers based on your chosen optimization goal.


## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the results of a trading strategy's profit and loss. It tells you how well your strategy performed, considering the impact of both trading fees and slippage, which is the difference between the expected price and the actual execution price. The `pnlPercentage` value shows the profit or loss as a percentage, allowing for easy comparison between strategies. You'll also find the `priceOpen` and `priceClose`, which are the adjusted entry and exit prices respectively, reflecting the costs associated with the trade.

## Interface IStrategyCallbacks

This interface lets you hook into key moments in your trading strategy's lifecycle. Think of it as a way to listen in and react to what's happening during a backtest or live trade.

You can define functions to be triggered on every tick of data, whenever a new signal is opened, when a signal becomes active, or when the system is in an idle state without any active signals.  It also provides callbacks for when a signal closes, gets scheduled for later entry, or is canceled altogether.

There are also events to notify you about partial profit or loss situations, giving you insights into how your strategy is performing before it hits its take profit or stop loss levels. The `onWrite` callback is specifically for persisting data during testing.  Each callback receives relevant information like the symbol, data related to the signal, and the current price, giving you plenty of context to work with.

## Interface ISizingSchemaKelly

This defines a way to size your trades based on the Kelly Criterion, a strategy aiming for optimal growth. The `method` property confirms you're using the Kelly Criterion.  The `kellyMultiplier` dictates how aggressively you’ll size your trades – a smaller number like 0.25 (the default) represents a more conservative approach, while larger numbers risk bigger swings. Essentially, it controls how much of your capital you allocate to each trade based on your expected win rate and payout.

## Interface ISizingSchemaFixedPercentage

This schema defines a simple way to size your trades, always using a fixed percentage of your available capital. It's perfect when you want consistent risk exposure on each trade. 

The `method` property is set to "fixed-percentage" to identify this sizing strategy. 

The `riskPercentage` determines what portion of your capital you're willing to risk—it's a number between 0 and 100, representing the percentage.

## Interface ISizingSchemaBase

This interface, ISizingSchemaBase, acts as a foundation for defining how much of your account to risk on each trade. It holds essential configuration details, giving you control over position sizing.

Each sizing configuration needs a unique name (sizingName) for easy identification. 

You can add a note (note) to document why you chose a specific sizing approach.

It also allows you to set limits – a maximum percentage of your account to use (maxPositionPercentage), and absolute minimum and maximum position sizes (minPositionSize, maxPositionSize).

Finally, you have the flexibility to add optional callbacks (callbacks) to customize sizing behavior further at different stages.

## Interface ISizingSchemaATR

This schema defines how to size your trades using the Average True Range (ATR) as a guide. 

Essentially, it lets you tell the backtest-kit framework to calculate your position size based on how volatile the market is, as measured by the ATR. 

You'll specify a risk percentage – the portion of your capital you're willing to risk on each trade, typically a small percentage like 1% or 2%. 

Then, you'll set an ATR multiplier, which determines how much the ATR influences the stop-loss distance and, consequently, the position size. A higher multiplier means wider stops and smaller position sizes when the ATR is high, and vice versa.

## Interface ISizingParamsKelly

This interface defines the parameters needed to use the Kelly Criterion for determining position sizes within the backtest-kit framework. It's all about how much of your capital you'll risk on each trade based on your expected win rate and profit/loss.  You'll use this when setting up how your trading strategy sizes its positions.

The `logger` property allows you to connect a logging service to help debug and monitor the sizing calculations – it's handy for understanding how the Kelly Criterion is influencing your trades.

## Interface ISizingParamsFixedPercentage

This interface defines the parameters needed for setting up how much of your capital you'll use for each trade when using a fixed percentage sizing strategy.  It's a simple way to control your risk by always allocating a specific percentage of your available funds to a new position.  The `logger` property is essential – it lets you track what's happening behind the scenes, helping you troubleshoot and understand how your sizing is working. This allows for easy debugging and insights into sizing behavior.

## Interface ISizingParamsATR

This interface defines the parameters you can use when determining how much to trade based on the Average True Range (ATR). It’s all about controlling your position sizes dynamically, reacting to market volatility as measured by the ATR.

The `logger` property lets you hook in a logging service, which is useful for debugging and understanding how the sizing calculations are working. You can use this to track the ATR values and the resulting trade sizes to make sure everything behaves as expected.

## Interface ISizingCallbacks

This section outlines the callbacks you can use to monitor and potentially influence how your trading strategy determines the size of its positions. Specifically, `onCalculate` is triggered immediately after the framework computes the position size. Think of it as a notification – you can use it to record the size that was determined, check if it makes sense according to your strategy's rules, or perform any other actions related to the sizing calculation. It gives you visibility into the sizing process and allows for custom adjustments if needed.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate your trade size using the Kelly Criterion, a method for determining optimal bet size. To use it, you'll need to specify the calculation method as "kelly-criterion". You’ll also provide your win rate, expressed as a decimal between 0 and 1 (like 0.6 for a 60% win rate), and your average win/loss ratio – essentially, how much you typically win compared to how much you lose on a trade. These values help the framework determine a suggested position size.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate trade sizes using a fixed percentage approach. Essentially, it tells the backtest kit how much of your capital to allocate to a trade based on a pre-determined percentage and a specified stop-loss price. You'll provide a `method` value indicating you're using the "fixed-percentage" sizing strategy, and then define the `priceStopLoss` – the price at which your stop-loss will be triggered. This stop-loss price is crucial for determining the size of the position.

## Interface ISizingCalculateParamsBase

This interface defines the basic information needed when calculating how much of an asset to trade. It includes the trading symbol, like "BTCUSDT", so the framework knows which asset is involved. You’ll also find the current account balance, essential for determining affordable trade sizes, and the planned entry price for the trade. These shared parameters ensure consistent sizing across different trading strategies.

## Interface ISizingCalculateParamsATR

This interface defines the information needed when you're calculating trade sizes based on the Average True Range (ATR). Essentially, it tells the backtest-kit how to approach sizing your trades using ATR. You’ll specify that you want to use an "atr-based" method, and then provide the current ATR value itself, which is a key factor in determining your position size. Think of it as setting the parameters for a sizing strategy that adapts to market volatility as measured by the ATR.

## Interface ISizing

The `ISizing` interface is all about figuring out how much of an asset your trading strategy should buy or sell. Think of it as the mechanism that determines your position size. It's used behind the scenes to make sure your trades align with your risk management rules.

The core of this interface is the `calculate` function.  When it's called, it receives information about the current trading conditions – things like your risk tolerance and the asset's price – and then it returns a number representing the size of the position to take. Essentially, it’s the brains behind determining how much to trade.

## Interface ISignalRow

This interface, `ISignalRow`, represents a complete trading signal within the backtest-kit framework. Think of it as the finalized version of a signal, ready for use after it has been checked and prepared. Each signal has a unique ID, a price at which the trade should open (`priceOpen`), and identifies which exchange and strategy generated it. You'll also find information about when the signal was originally created (`scheduledAt`) and when it became active (`pendingAt`), along with the trading symbol, like "BTCUSDT". Finally, an internal flag (`_isScheduled`) helps the system track the signal's status.

## Interface ISignalDto

This describes the data format used when requesting a trading signal. Think of it as a blueprint for what a signal looks like.

Each signal includes details like whether it's a long (buy) or short (sell) trade, a brief explanation of why the signal was generated, and the intended entry price. 

It also specifies the take profit price (where you'd aim to sell for a gain) and the stop-loss price (where you'd exit to limit potential losses). A suggested duration is included as well. 

If you're providing a signal, it will automatically receive a unique identifier.

## Interface IScheduledSignalRow

This interface describes a signal that's scheduled to activate when the price reaches a certain level. Think of it as a signal that's waiting patiently for the market to move in the right direction. It builds upon the basic signal representation and includes information about the target price.

When the market price hits the `priceOpen` value, this scheduled signal transforms into a regular, active signal. 

Initially, the time the signal was scheduled (`scheduledAt`) is used to track how long it's been pending. Once it activates, this pending time is updated to reflect the actual time it waited. The `priceOpen` property defines the price level that triggers the signal’s activation.

## Interface IRiskValidationPayload

This structure holds the information a risk validation function needs to make a decision. Think of it as a package of data about the current trading situation. 

It includes the signal that's about to be acted upon (`pendingSignal`), a count of how many positions are already open (`activePositionCount`), and a detailed list of those open positions (`activePositions`). This comprehensive view helps ensure that new trades align with your risk management rules.

## Interface IRiskValidationFn

This defines a function that's used to check if your risk settings are okay. Think of it as a safety net for your trading strategies. It takes your risk parameters – like how much you’re willing to lose – and makes sure they meet certain rules. If something doesn't look right, this function will stop the process and let you know with an error message, preventing potentially harmful trades. It’s designed to help you build robust and controlled backtesting systems.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define how to check if your trading risks are acceptable. Think of it as setting up rules to make sure your trading strategy doesn't take on too much risk. 

It has two main parts:

*   `validate`: This is the core of the validation. It’s a function that you write to perform the actual risk check, determining whether parameters are within safe limits.
*   `note`: This is a helpful description. It's like a short explanation of what the validation rule is trying to achieve; it makes your code easier to understand and maintain.

## Interface IRiskSchema

This interface, `IRiskSchema`, is how you define and register risk controls within the backtest-kit framework. Think of it as a blueprint for how your portfolio will manage risk. 

It lets you give each risk control a unique identifier with `riskName`, and include a descriptive note with `note` for your own understanding. You can also attach functions to be called during specific risk control phases using `callbacks`, like when a trade is rejected or allowed.

The heart of the schema is `validations`, which is an array of rules you create to enforce your portfolio’s risk management logic. This is where you put the actual checks and limits that prevent undesired trading behavior.

## Interface IRiskParams

This interface, `IRiskParams`, defines the core configuration for managing risk within the backtest-kit framework. Think of it as a set of instructions that tells the system how to handle potential risk issues.

It includes a `logger` to help you understand what’s happening behind the scenes, and a `backtest` flag which indicates whether the system is running a simulated test or a live trading session. 

Crucially, it also features an `onRejected` callback. This is your opportunity to respond when a trading signal is blocked because it would violate a predefined risk limit.  You can use this callback to log the rejection, send notifications, or take other corrective actions before the event is officially recorded.

## Interface IRiskCheckArgs

This interface, `IRiskCheckArgs`, provides the necessary information to determine if a new trade should be allowed. It's used by your trading strategy before a signal is generated, acting as a safety check. Think of it as a way to ensure conditions are right before committing to a trade.

The arguments included are the trading symbol (like "BTCUSDT"), the details of the pending trade signal, the name of the strategy requesting the trade, the exchange being used, the current price, and a timestamp for when this check is happening. Essentially, it’s a snapshot of the context surrounding the potential trade, allowing you to validate its appropriateness.

## Interface IRiskCallbacks

This interface defines optional functions that your trading strategy can use to react to risk assessments. Think of it as a way to be notified when a trade idea is flagged as too risky or, conversely, when it’s approved to proceed. The `onRejected` function gets triggered when a signal fails a risk check, letting you know a trade won't happen. Conversely, `onAllowed` is called when a signal passes all the risk checks, signaling it's clear to execute. You can use these callbacks to log events, adjust your strategy, or take other actions based on the risk assessment outcome.

## Interface IRiskActivePosition

This interface describes a single, active trading position that's being monitored for risk assessment across multiple trading strategies. Think of it as a snapshot of a trade that’s currently open. 

Each position record includes information like the original signal that triggered the trade, the name of the strategy that initiated it, and the exchange where the trade is happening. You’ll also find the exact time the position was opened, allowing you to track how long a trade has been active. This data helps to understand and manage risk across your entire trading system.

## Interface IRisk

This interface, `IRisk`, is designed to help manage and control risk when your trading strategies are running. Think of it as a gatekeeper for your trades, making sure they align with predefined risk boundaries. 

It provides three key methods:

*   `checkSignal`: This function evaluates whether a potential trade signal is acceptable based on your configured risk rules. It tells you if you should even consider executing the trade.
*   `addSignal`:  When a trade is opened (a signal is triggered and executed), you need to let the system know. This function registers that new position so the risk tracking remains accurate.
*   `removeSignal`:  Conversely, when a trade is closed, this function updates the system, indicating that a position is no longer active, preventing inaccurate risk assessments.



Essentially, `IRisk` helps you keep tabs on your exposure and ensures your strategies operate within safe limits.

## Interface IPositionSizeKellyParams

This interface, `IPositionSizeKellyParams`, helps you define the parameters needed to calculate position sizes using the Kelly Criterion. It's all about determining how much of your capital to risk based on your trading strategy's expected performance. You’ll provide two key pieces of information: `winRate`, which represents the percentage of times your strategy is expected to be profitable, and `winLossRatio`, which describes the average amount you win compared to the amount you lose on a winning trade. Essentially, these parameters tell the backtest how aggressively to size positions based on historical performance.


## Interface IPositionSizeFixedPercentageParams

This interface defines the settings you'll use when your trading strategy calculates position sizes based on a fixed percentage of your available capital. It primarily focuses on setting a stop-loss price. The `priceStopLoss` property lets you specify the price level where you want to place a stop-loss order to limit potential losses. This value is crucial for managing risk when using fixed percentage position sizing.

## Interface IPositionSizeATRParams

This interface defines the settings needed for calculating your position size based on the Average True Range (ATR). It’s used when you want to dynamically adjust how much capital you allocate to a trade, using ATR as a measure of volatility. The `atr` property simply holds the current ATR value you're using for the calculation – think of it as the key input that influences your position size.

## Interface IPersistBase

This interface defines the basic actions needed to manage data storage within the backtest-kit framework. It allows you to read, write, and check for the existence of data entries. The `waitForInit` method ensures that the storage area is properly set up and any necessary checks are performed when things start.  You can use `readValue` to retrieve a specific data entry, `hasValue` to quickly determine if a data entry exists, and `writeValue` to save or update data entries safely.

## Interface IPartialData

This interface, `IPartialData`, helps store information about a trading signal so it can be saved and loaded later. Think of it as a snapshot of key data points. It specifically focuses on the profit and loss levels that have been hit during trading.  Instead of storing complex data structures that might be difficult to save, the `profitLevels` and `lossLevels` are converted into simple arrays. This allows the data to be easily saved, retrieved, and then rebuilt into the full trading state when needed.

## Interface IPartial

The `IPartial` interface helps track how much profit or loss a trading signal is generating. It's used by components that manage trading signals and their performance.

When a signal is making money, the `profit` method calculates if it's reached significant profit milestones like 10%, 20%, or 30%, and reports those new milestones.  A similar process happens with the `loss` method, identifying and reporting new loss levels.

Finally, the `clear` method is used to reset the profit/loss tracking when a signal is finished, cleaning up the related data and preparing for the next signal.

## Interface IOptimizerTemplate

This interface provides a way to create building blocks for your backtesting code, especially when working with Large Language Models (LLMs). Think of it as a toolkit for crafting reusable snippets of TypeScript code.

The `getTopBanner` method helps you set up the initial environment for your tests, including necessary imports.  To help with debugging, `getJsonDumpTemplate` creates a function for easily displaying data. 

For LLM interactions, `getUserMessage` and `getAssistantMessage` generate the initial prompts and responses to kickstart a conversation.  You'll use `getWalkerTemplate` to define how your strategies will interact with the market, and `getExchangeTemplate` to configure the exchange connection.  `getFrameTemplate` sets up the specific timeframe you're analyzing.

If you're incorporating LLMs into your trading strategies, `getStrategyTemplate` generates the configuration needed to integrate those models. To actually run your backtest, `getLauncherTemplate` creates the code that starts the process and handles events. Finally, `getTextTemplate` and `getJsonTemplate` provide helpful functions for formatting output from the LLM, allowing you to work with text or structured JSON data.

## Interface IOptimizerStrategy

This interface, `IOptimizerStrategy`, holds all the information needed to understand and use a trading strategy created with the help of an LLM. Think of it as a package containing the complete history and instructions for a particular strategy. 

It includes the trading symbol the strategy applies to, a unique name for easy identification, and the entire conversation with the LLM that led to the strategy's creation.  Crucially, it also stores the actual strategy logic, which is the text output from the LLM's "getPrompt()" function – this is the core set of rules the trading system will follow.

## Interface IOptimizerSourceFn

This function is your way to feed data into the backtest-kit's optimization process. Think of it as a data pipeline—it provides the historical data the optimizer uses to learn and refine trading strategies. It's designed to handle large datasets efficiently by using pagination, fetching data in manageable chunks.  Crucially, each piece of data you provide needs a unique identifier so the system can keep track of everything correctly.

## Interface IOptimizerSource

This interface, `IOptimizerSource`, helps you bring data into your backtesting framework so it can be used, perhaps with a large language model. Think of it as defining where your data lives and how to present it.

You'll give it a `name` to easily identify the data source and an optional `note` to provide context.

The crucial part is the `fetch` function - this tells the framework how to retrieve your data, and it needs to handle requests for data in chunks (pagination).

You can also customize how the messages are formatted – the `user` property lets you shape the messages the "user" (likely the backtest system) sends, and `assistant` controls the messages from the "assistant" (perhaps an LLM). If you don’t provide these, the framework uses default formatting.

## Interface IOptimizerSchema

This schema defines how your optimization process works within the backtest-kit framework. Think of it as a blueprint for creating and evaluating different trading strategies. 

You'll specify a unique name for your optimizer so you can easily identify it later. 

It lets you define multiple training periods – each one will result in a slightly different version of your strategy for comparison.  There's also a designated testing period to see how well each generated strategy actually performs.

The `source` property lists the data inputs that will inform the strategy creation process. These data sources provide context to an AI model that generates the trading strategies. 

A key part of the schema is `getPrompt`, which is a function you provide to craft the specific instructions given to the AI model, leveraging the conversation history. 

You can optionally customize certain aspects using the `template` property, or rely on default settings.  Finally, the `callbacks` section allows you to monitor the optimizer's progress and gain insights into its operation.


## Interface IOptimizerRange

This interface lets you specify a timeframe for your backtesting or optimization. Think of it as drawing a box around a specific period of historical data. You define the beginning and end dates with the `startDate` and `endDate` properties, which are simply dates. Optionally, you can add a descriptive note to the range, like "2023 Market Correction" or "Post-Pandemic Recovery," to help you remember what that period represents.

## Interface IOptimizerParams

This interface defines the essential configuration needed to create an Optimizer within the backtest-kit framework. It primarily focuses on providing the tools for logging and executing a complete trading strategy template. 

Think of it as a blueprint for setting up the Optimizer; you’ll need to supply a logger for tracking what’s happening and a fully functional trading template to actually run the backtest. The logger helps you understand the optimizer's progress and any issues it encounters, while the template contains all the logic and methods required for the trading strategy itself. These pieces are combined to create a functional optimizer.

## Interface IOptimizerFilterArgs

This interface, `IOptimizerFilterArgs`, defines how to specify which data to retrieve when backtesting. Think of it as a way to tell the system exactly which trading pairs and time periods you're interested in analyzing. You'll use it to pinpoint the specific historical data your backtest needs, by providing the trading symbol – like "BTCUSDT" – and defining a start and end date for the data range.  It ensures the backtest focuses on relevant data without needing to deal with complicated page-by-page data retrieval.


## Interface IOptimizerFetchArgs

When you're retrieving data for optimization, `IOptimizerFetchArgs` helps manage how much data is fetched at a time. Think of it like paging through a large list – you don’t want to load everything at once. The `limit` property sets the maximum number of items you get with each request, and `offset` tells you how many items to skip before starting to retrieve data. This is especially useful when dealing with lots of historical data.

## Interface IOptimizerData

This interface, `IOptimizerData`, is the foundation for how backtest-kit gets data to optimize trading strategies. Every data source you connect needs to provide data that follows this structure. The most important part is the `id` property – it’s a unique code for each piece of data, which helps prevent duplicates when you're dealing with large datasets or pulling data in chunks. Think of it like a serial number ensuring each data point is accounted for.

## Interface IOptimizerCallbacks

This interface lets you tap into key moments during the optimization process, giving you opportunities to monitor what's happening and ensure everything is behaving as expected. You can use these callbacks to log information, validate generated data or code, or even trigger other actions. 

Here's a breakdown of what each callback does:

*   `onData`:  This one fires when strategy data is ready for all of the training ranges. It's a good place to check the generated data for accuracy or write logs.
*   `onCode`:  Called after the strategy code has been created. Use this to inspect the generated code or add extra processing steps.
*   `onDump`:  This callback gets triggered when the code is saved to a file. It’s handy for tracking file creation or performing any post-write operations.
*   `onSourceData`: This one lets you observe the raw data being pulled from your data sources. It’s helpful for validating that the data is being fetched correctly and that dates are within the expected range.

## Interface IOptimizer

The IOptimizer interface lets you work with a system that creates and exports trading strategies. Think of it as a tool to automatically generate code for your trading ideas.

The `getData` function pulls information from various sources to create a basic understanding of how a strategy might perform.  It essentially builds a foundation for the code generation process.

`getCode` takes this foundation and builds a full, runnable trading strategy, combining everything you need, from imports to the actual trading logic.

Finally, `dump` takes that generated code and saves it to a file, organizing the files in the proper directory structure so it's ready to use.

## Interface IMethodContext

This interface, `IMethodContext`, acts as a little guide for your backtesting process. It holds the names of the key components – the exchange, strategy, and frame – that are being used in a particular operation. Think of it as a way to ensure the right pieces of your trading system are selected and working together correctly during backtesting. It’s automatically passed around by the backtest-kit framework, so you don't usually need to create it directly, but knowing what it contains can be helpful when understanding how your backtests are configured. The `frameName` property is particularly useful as it's empty when running live, signifying that a historical backtest is being performed.


## Interface ILogger

The `ILogger` interface provides a way for different parts of the backtest-kit framework to record what's happening. Think of it as a central place to keep track of events, errors, and important details. 

You can use it to log general messages about important events, detailed debugging information during development, informational updates on successful processes, or warnings about potential issues. This logging helps with understanding how the system works, finding and fixing problems, and keeping track of what's going on. The `log`, `debug`, `info`, and `warn` methods allow you to categorize messages by their importance.

## Interface IHeatmapRow

This interface represents a single row of data for a portfolio heatmap, giving you a quick overview of how a specific trading pair performed. It bundles together key performance indicators, like total profit or loss, risk metrics like maximum drawdown and Sharpe Ratio, and trade statistics. You'll find information on the total number of trades, how many were wins versus losses, and calculated values such as average profit per trade and win rate. This allows you to easily compare the performance of different trading pairs within your backtest results.

## Interface IFrameSchema

The `IFrameschema` defines a specific time window and frequency for your backtesting simulations. Think of it as setting the stage for your trading strategy – you tell backtest-kit *when* and *how often* to generate data points. Each schema has a unique name to identify it, and you can add a note for yourself or other developers to explain its purpose.

Crucially, you specify the `interval` (like daily, hourly, or minute-by-minute), a `startDate`, and an `endDate` to determine the range of data being used.  You can also add optional lifecycle callbacks to customize how frames are created and managed.  Essentially, this schema controls the chronological foundation of your backtest.

## Interface IFrameParams

The `IFramesParams` interface defines the information needed when creating a ClientFrame, which is a core component for running trading simulations. It builds upon the `IFramesSchema` and crucially includes a `logger` property. This `logger` allows you to monitor what's happening inside the frame for debugging purposes, providing valuable insights into your backtesting process. Essentially, it’s a way to keep an eye on things as your trading strategies are put to the test.


## Interface IFrameCallbacks

The `IFrameCallbacks` interface lets you hook into what’s happening as your backtest prepares its data. Specifically, it provides a way to be notified when the timeframes – the specific periods your strategy will be tested on – are created.  This `onTimeframe` function gets called with details about those timeframes, including the start and end dates, and the chosen interval (like daily, weekly, or monthly).  You can use this to check if the timeframes look right for your analysis or to simply keep a record of what's being used.

## Interface IFrame

The `IFrames` interface helps manage the different time periods your trading strategy will be tested against. Think of it as a way to define when your backtest will run – for example, you could specify daily, hourly, or even minute-by-minute data.  The core function, `getTimeframe`, is responsible for creating these time series; you give it a symbol (like 'AAPL') and a frame name (like 'daily'), and it returns an array of dates that your backtest will use as its timeline. This is how backtest-kit organizes the data and steps for your testing process.

## Interface IExecutionContext

The `IExecutionContext` object holds important information about the current trading environment. Think of it as a package of details that's passed around to tell your strategy and the exchange what's happening right now. It includes the trading symbol, like "BTCUSDT," and a timestamp indicating the current point in time. Most importantly, it tells you whether the code is running a backtest (historical simulation) or a live trade. This helps your strategy behave differently depending on the environment.

## Interface IExchangeSchema

This interface describes how backtest-kit interacts with different cryptocurrency exchanges. Think of it as a blueprint for connecting to a data source and understanding its specific quirks. 

Each exchange you want to use needs to be registered with backtest-kit using this schema.  It provides a way to tell the framework where to get historical price data (candles), and how to correctly format trade quantities and prices to match the exchange's rules.

The `exchangeName` is simply a unique identifier so the framework knows which exchange it's dealing with. The `getCandles` function is the most important part - it's what fetches the actual price data. You also have the flexibility to add optional notes and lifecycle callbacks for more customized behavior.

## Interface IExchangeParams

This interface, `IExchangeParams`, is all about setting up the environment for your trading exchange within the backtest-kit framework. Think of it as a configuration object you pass when creating an exchange. It lets you provide a logger to help track what's happening during your backtesting and importantly, it includes an execution context.  This context holds crucial information like the trading symbol, the specific time period you're testing, and whether you’re running a backtest or live trading. Essentially, it's how you tell the exchange *what* and *when* it's trading.

## Interface IExchangeCallbacks

This interface defines optional functions your trading system can use to react to incoming candlestick data from an exchange. Specifically, the `onCandleData` function is triggered whenever the backtest kit retrieves candlestick data. This allows your system to process that data – for example, updating charts, recalculating indicators, or triggering trading signals – as it arrives. You provide this interface to the exchange to customize how your system interacts with market data.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with a trading exchange. It allows you to retrieve historical and future candle data, essential for simulating trades. 

You can request candles for a specific trading pair and time interval, going back in time or looking ahead for backtesting purposes.

The interface also helps with preparing trade orders by formatting quantities and prices to match the exchange’s requirements. 

Finally, it provides a way to calculate the Volume Weighted Average Price (VWAP), which is a common indicator based on the average price of a security traded over a period, using the typical price (average of high, low, and close) and volume.

## Interface IEntity

This interface, IEntity, serves as the foundation for anything the backtest-kit framework stores persistently. Think of it as the common ground for all your data objects – it ensures they all share a basic structure. Any object you want to save or load will likely implement this interface, guaranteeing consistency across your data. Essentially, it's the starting point for defining your core data models within the backtest-kit.

## Interface ICandleData

This interface defines the structure for a single candlestick, which is a standard way to represent price action over a specific time interval. Each candlestick holds information about the open, high, low, and close prices, as well as the volume traded during that period. The `timestamp` property tells you exactly when the candle began, measured in milliseconds since the Unix epoch.  Essentially, this data structure is fundamental for analyzing past price movements and is used within the backtest-kit framework for calculations like VWAP and running backtesting simulations.


## Interface HeatmapStatisticsModel

This structure holds all the key performance indicators for your portfolio's heatmap visualization. It breaks down the overall performance across all the assets you're tracking.

You'll find a list of individual symbol statistics within the `symbols` property, each representing a row in the heatmap.  The `totalSymbols` property simply tells you how many assets are included in this calculation.

Beyond the individual symbol data, it also provides aggregated portfolio-level metrics like total profit and loss (`portfolioTotalPnl`), the Sharpe Ratio (`portfolioSharpeRatio` - a measure of risk-adjusted return), and the total number of trades executed (`portfolioTotalTrades`). This gives you a quick snapshot of your portfolio’s overall health.

## Interface DoneContract

This interface helps you track when a background task, either a backtest or a live trade execution, has finished running. It provides key information about what just completed, letting you know which exchange was used, the name of the strategy involved, and whether it was a backtest or a live execution. You'll also find the trading symbol – like BTCUSDT – so you can easily identify the specific asset that was traded. Think of it as a notification package confirming a process is done and giving you the details.


## Interface ColumnModel

This interface, `ColumnModel`, helps you customize how data is displayed in tables generated by backtest-kit. Think of it as a blueprint for defining a single column. Each column you want to show has a unique `key` to identify it, a user-friendly `label` that appears in the table header, and a `format` function that transforms the raw data into something readable. You can also control column visibility with the `isVisible` function, allowing you to dynamically show or hide columns based on certain conditions.

## Interface BacktestStatisticsModel

This model holds all the key performance statistics calculated during a backtest. It gives you a detailed view of how your trading strategy performed.

You'll find a list of every trade that was closed, including important details like price and profit/loss.  The model also provides counts of winning and losing trades, along with calculations like win rate and average profit per trade. 

Several risk-adjusted performance metrics are included, like the Sharpe Ratio and annualized Sharpe Ratio, to assess returns relative to risk.  You can also see volatility measures (standard deviation) and a certainty ratio that indicates the consistency of win/loss sizes. Finally, an estimate of expected yearly returns is provided, giving you an idea of potential long-term performance. Note that any calculations resulting in unreliable numbers (like division by zero) will show up as null.
