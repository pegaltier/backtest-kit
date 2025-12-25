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

This interface describes the information shared when a walker is being stopped. Think of it as a notification that a trading process needs to be interrupted. 

It tells you specifically which trading symbol is affected, the name of the strategy that's being paused, and importantly, the name of the walker itself. This last detail is crucial because you might have several walkers running on the same symbol at once, and this lets you target the correct one for stopping. Essentially, it’s a precise signal to halt a specific trading operation.

## Interface WalkerStatisticsModel

The WalkerStatisticsModel helps organize the results you get when you run backtests and compare different trading strategies. Think of it as a container holding all the information about how various strategies performed. 

It builds upon the existing IWalkerResults, but adds extra details to make comparing strategies easier. 

Inside, you'll find `strategyResults`, which is simply a list of all the results from each strategy you tested. This list lets you directly see and analyze how each strategy did.

## Interface WalkerContract

The WalkerContract represents updates you receive as your trading strategies are being compared during a backtest. Think of it as a progress report, letting you know when a specific strategy finishes its test run. 

Each report includes details like the name of the strategy, the exchange and symbol being tested, and the overall backtest statistics.  You'll also see the value of a particular metric being optimized, along with the best value found so far and the strategy that achieved it. 

Finally, the contract provides information about how many strategies have been tested and the total number of strategies you’re planning to evaluate. This helps you track the overall progress of your strategy comparison.

## Interface WalkerCompleteContract

This interface represents the final notification when a backtesting process, or "walker," has finished evaluating all the strategies it was designed to test. It bundles together all the key information about that completed run, letting you know which symbol was being analyzed, what exchange and timeframe were used, and what metric was being optimized. You'll find details about the total number of strategies considered, as well as the name and performance score of the top-performing strategy. Finally, comprehensive statistics for that best strategy are also included.

## Interface ValidateArgs

This interface, `ValidateArgs`, acts as a blueprint for ensuring your backtest configurations are correct. Think of it as a set of rules to check that the names you've given to different parts of your trading system – like the exchange you're using, the timeframe of your data, or the strategy you're employing – are actually valid. 

Each property within `ValidateArgs` represents a different aspect of your backtest setup. For example, `ExchangeName` verifies that the exchange name you provided is recognized, while `StrategyName` confirms your strategy has been properly defined. 

Essentially, it’s a safety net to catch typos and configuration errors before you start running your backtests, saving you from potential headaches down the line. You provide a type `T` for each property, which will be an enum containing the possible valid values for that setting.

## Interface TickEvent

This interface describes the information you receive for every event happening during a backtest, like when a trade opens, is active, or closes. Think of it as a standardized message containing all the key details about what just occurred.

Each event includes a timestamp, the type of action taken (idle, opened, active, or closed), and for trades, information such as the trading pair, signal ID, position, and any notes associated with the signal.

When a trade is open or active, you'll also find properties like the open price, take profit, stop loss, and progress percentages towards those levels.  Finally, when a trade closes, data about the profit/loss percentage and the reason for closure are provided, along with the trade's duration.


## Interface SignalData$1

This data structure holds information about a single trading signal that has been closed. Think of it as a record of one completed trade, containing key details. You'll find the name of the strategy that generated the signal, a unique ID for that signal, and the trading symbol involved. It also includes whether the trade was a long or short position, the profit and loss (PNL) expressed as a percentage, and the reason the signal was closed. Finally, timestamps mark when the signal was initially opened and when it was closed.

## Interface ScheduleStatisticsModel

This model gives you a clear picture of how your scheduled signals are performing. It tracks every event—when a signal is scheduled, activated, or cancelled—and provides key statistics to help you understand their behavior. 

You can see the total number of signals scheduled, those that were activated, and those that were cancelled. The model also calculates useful metrics like cancellation rate (how often signals are cancelled), activation rate (how often they're activated), and average wait times for both cancelled and activated signals. 

The `eventList` property holds a complete record of all these events, allowing for detailed investigation if needed. This information is invaluable for optimizing your scheduling strategies and improving overall trading performance.

## Interface ScheduledEvent

This interface holds all the important details about scheduled, opened, and cancelled trading events, making it easy to create reports. Each event has a timestamp indicating when it happened, and a clear action type – whether it was scheduled, opened, or cancelled. You'll also find information like the trading symbol, a unique signal ID, and the position type (like long or short). 

Along with this, the interface provides key pricing information including the entry price, take profit level, stop loss, and current market price. If the event was cancelled or opened, you'll also see the close timestamp and the duration the position was held. Essentially, it’s a comprehensive record of a signal’s lifecycle.


## Interface RiskStatisticsModel

This data model helps you understand and track risk management performance within your backtesting framework. It consolidates information about risk rejection events, giving you insights into where and why your strategies are encountering issues. 

You'll find a detailed list of each rejection event, along with a count of the total rejections that occurred. 

The model also breaks down those rejections, showing you how many happened for each specific trading symbol and which strategies triggered them, making it easier to pinpoint areas needing attention.

## Interface RiskEvent

This data structure holds information about signals that were blocked by your risk management rules. Each time a signal is rejected because it would violate a risk limit, a `RiskEvent` is created. It includes details like the exact time of the rejection, the trading pair involved (symbol), the specifics of the signal that was blocked, the strategy that generated it, and the exchange being used. You'll also find the current market price at the time of the rejection, the number of positions already open, and a descriptive reason why the signal was rejected. Finally, it indicates whether the rejection happened during a backtest or in live trading.

## Interface RiskContract

This interface represents a record of when a trading signal was blocked because it violated risk rules. It's emitted whenever the risk system prevents a strategy from placing a trade.

The `symbol` tells you which trading pair was involved, like "BTCUSDT." The `pendingSignal` contains all the details of the trade that was attempted, including things like the order size, prices, and stop-loss levels. You'll also see the `strategyName` to know which automated trading strategy tried to make the trade, and `exchangeName` to know where it was intended to be executed.

`currentPrice` shows the market price at the moment the risk check failed. It’s useful for understanding the market context. The `activePositionCount` provides a snapshot of how many positions were already open when the signal was rejected.

A `comment` explains why the signal was rejected; this comes directly from the risk validation process. The `timestamp` lets you know exactly when the rejection occurred, and a `backtest` flag indicates if the rejection happened during a simulated backtest or in a live trading environment. This is beneficial for analyzing risk behavior in both scenarios.

## Interface ProgressWalkerContract

This interface describes updates you'll receive while a background process, like evaluating trading strategies, is running. It gives you insights into what’s happening behind the scenes, letting you monitor the progress of the operation. You'll see the name of the walker, the exchange, and the frame being used, as well as the trading symbol involved. 

The updates include the total number of strategies being assessed, how many have already been processed, and the overall percentage of completion. This allows you to understand how much longer the process might take and to track its advancement.

## Interface ProgressOptimizerContract

This interface helps you keep tabs on how your backtest optimization process is going. It provides updates during the optimization run, letting you know which optimizer is working, what symbol it’s optimizing for, and how many data sources have been processed versus the total number. You'll see a progress percentage, giving you a clear indication of how close the optimization is to finishing. This allows you to monitor the optimization and potentially adjust or stop it if needed.

## Interface ProgressBacktestContract

This contract helps you keep an eye on how your backtest is progressing. It provides updates during the backtesting process, letting you know which exchange and strategy are being used, and for what trading symbol. You’ll get information about the total number of historical data points (frames) being analyzed, how many have been processed already, and the overall percentage of completion. Essentially, it's a status report for your backtest, so you can monitor its advancement.


## Interface PerformanceStatisticsModel

This model collects and organizes performance data generated by your trading strategies. It essentially provides a comprehensive report card for how your strategy performed. 

The `strategyName` clearly identifies which strategy the data belongs to.  You'll also see the `totalEvents`, which tells you how many data points were gathered during the backtest. `totalDuration` represents the total time it took to collect all that information.

The `metricStats` property is key - it breaks down the performance data into categories based on the specific metrics being tracked. Finally, the `events` array holds the complete, detailed raw data for each performance event, allowing for a granular examination of the strategy's behavior.

## Interface PerformanceContract

This interface helps you keep an eye on how quickly different parts of your trading system are running. It records details like when an action started and finished, how long it took, and which strategy, exchange, and symbol it relates to. By tracking these performance metrics, you can pinpoint areas where your system might be slow or struggling, ultimately helping you optimize its efficiency.  The `timestamp` tells you when the event happened, `previousTimestamp` lets you calculate durations, and `metricType` categorizes the type of operation being measured. You can also see if the metric comes from a backtest or a live trading environment.

## Interface PartialStatisticsModel

This model helps you keep track of the results when your trading strategy uses partial fills – meaning you don't always buy or sell everything at once. It breaks down the performance based on each individual event, whether it's a profit or a loss.

You'll find a detailed list of each event within the `eventList` property. 

The `totalEvents` field simply tells you how many individual events were recorded.  `totalProfit` counts all the times your partial fills resulted in a profit, while `totalLoss` does the same for losses. This allows for a more granular understanding of how your strategy performs with partial fills.

## Interface PartialProfitContract

This interface describes events that occur when a trading strategy hits pre-defined profit milestones, like 10%, 20%, or 30% profit. Think of it as a notification that a strategy is performing well and reaching certain profit targets. Each event provides a lot of information, including the trading pair (e.g., BTCUSDT), the name of the strategy generating the signal, and the exchange it's running on. 

You’ll also find details about the original signal that triggered this profit event, the current market price when the milestone was reached, and the exact profit level achieved. There's a flag to tell you if this event came from a backtest (historical data) or live trading. Finally, each event includes a timestamp indicating exactly when the milestone was detected, which is crucial for tracking and analyzing performance. These events are useful for creating reports and letting users know how their strategies are doing.

## Interface PartialLossContract

The PartialLossContract represents notifications about a trading strategy hitting predefined loss levels, like a 10% or 20% drawdown.  It’s designed to help you keep track of how your strategies are performing and when they’re approaching stop-loss thresholds.  Each notification includes details like the trading symbol, the strategy’s name, the exchange being used, and the complete signal information that triggered the loss. You’ll also find the current market price and the exact loss level that was reached, alongside whether the event originated from a backtest or live trading.  Importantly, these notifications are only sent once for each loss level reached by a specific signal.

## Interface PartialEvent

This describes a standardized piece of information used to track profit and loss during trading, whether it’s a simulated backtest or a live trade.  It bundles together key details like when the event happened (timestamp), what type of event it is (profit or loss), which asset was involved (symbol), which strategy triggered it, and a unique identifier for the signal that led to the trade. You'll also find the current market price and the profit/loss level reached, like 10% or 20%. Finally, it indicates whether the trade is happening in a backtest environment or in real-time.

## Interface MetricStats

This interface, `MetricStats`, bundles together a collection of statistics related to a particular performance measurement, like order execution time or fill latency. It essentially provides a summary view of how frequently a metric was observed, how long it generally took, and its variability. You'll find details like the total time spent, the average time, the shortest and longest observed durations, and even statistical measures like the standard deviation and percentiles to understand the distribution of the data. It also tracks wait times between events, giving insight into the gaps between actions. Each `MetricStats` object represents a single type of performance metric and holds a comprehensive set of data points to analyze its behavior.

## Interface MessageModel

This `MessageModel` helps keep track of conversations when working with language models. Think of it as a way to remember what’s been said, both by you (the user) and the AI.

Each message has a `role` indicating who sent it – whether it’s instructions from the system, a question from the user, or a response from the AI assistant.  The `content` property simply holds the actual text of the message. It’s the core information being passed back and forth.  This model is particularly useful for building complex prompts and managing context in automated trading strategies.


## Interface LiveStatisticsModel

This model holds the statistical information generated from your live trading activity, giving you a good picture of how things are performing. It keeps track of every event that happens – from idle periods to opening, active, and closed trades – in the `eventList`. You'll find key numbers like the total number of events, just the closed trades, and how many were wins versus losses.

The model also calculates several important ratios to assess your trading strategy's effectiveness.  You'll see the win rate (percentage of winning trades), average profit/loss per trade, the total cumulative profit, and a measure of volatility called standard deviation.  More advanced metrics like the Sharpe Ratio, annualized Sharpe Ratio, and certainty ratio, are included to evaluate risk-adjusted performance. Finally, it estimates what your yearly returns might look like based on typical trade durations and profits. Because these calculations can sometimes be unreliable, numeric values might be missing if there's an issue.

## Interface IWalkerStrategyResult

This interface describes the outcome for a single trading strategy when you're comparing several strategies. It holds the strategy's name, along with detailed statistics from its backtest, like profit and loss or Sharpe ratio.

You'll also find a numerical metric value, which is used to determine how well the strategy performed against others – it might be null if the strategy had issues during backtesting. Finally, the `rank` property tells you where the strategy placed in the overall comparison, with 1 being the top performer.

## Interface IWalkerSchema

The `IWalkerSchema` helps you set up and run A/B tests to compare different trading strategies. Think of it as a blueprint for your experiment – it tells backtest-kit which strategies to pit against each other, on what exchange and timeframe, and what to measure to decide which one performs best. 

Each walker (your test setup) needs a unique name for identification. You can also add a note to explain what the walker is designed to do.

Crucially, you'll specify the exchange and timeframe to use for all the strategies within the walker. The `strategies` property is a list of the strategy names you want to compare; these strategies must have been registered beforehand.

You define the metric – like Sharpe Ratio – that will be used to evaluate the strategies and determine the winner. Finally, you can provide callbacks for different stages of the walker's lifecycle if you need custom control.

## Interface IWalkerResults

This interface holds all the information gathered when you run a backtest walker, which essentially compares different trading strategies. It bundles together details about what was tested, providing a complete picture of the experiment. You’ll find the trading symbol, the exchange used for the backtest, the name of the specific walker configuration, and the name of the time frame used. Think of it as a summary report of a whole backtesting process.


## Interface IWalkerCallbacks

This interface lets you hook into the backtest process and get notified about what's happening. Think of it as a way to listen for events as the framework compares different trading strategies.

You can be alerted when a new strategy's testing begins with `onStrategyStart`, and when a particular strategy finishes its backtest with `onStrategyComplete`. If a strategy encounters a problem during testing, the `onStrategyError` callback will inform you. Finally, when all strategies have been tested, `onComplete` is triggered, giving you access to the overall results. These callbacks provide valuable insights and control points during the backtesting workflow.

## Interface IStrategyTickResultScheduled

This interface, `IStrategyTickResultScheduled`, represents a special event within the backtest-kit framework. It signals that a trading strategy has generated a "scheduled" signal, meaning it's waiting for the market price to reach a specific level before executing a trade. Think of it as the strategy saying, "I want to buy when the price hits X."

The event provides key details about this scheduled signal, including the signal itself (`signal`), the strategy’s name (`strategyName`), the exchange (`exchangeName`), the trading symbol (`symbol`), and the price at which the signal was generated (`currentPrice`). It also tells you whether this event occurred during a backtest (`backtest`). Essentially, it's a notification that a trade is planned and pending price confirmation.

## Interface IStrategyTickResultOpened

This interface represents the data you receive when a new trading signal is created within the backtest-kit framework. Think of it as a notification that a signal has been generated and is ready to be acted upon.  It includes key details about the signal itself, like the newly assigned ID, as well as information about the strategy, exchange, and symbol associated with it. You'll also find the current price at the time the signal opened, which is useful for analysis. Finally, a flag indicates whether this event originated from a backtesting scenario or live trading.

## Interface IStrategyTickResultIdle

This interface represents what happens when your trading strategy is in a period of inactivity – essentially, it's "idle." It provides information about why the strategy isn't currently taking action.

You'll find details like the strategy's name, the exchange it's connected to, the trading symbol (like BTCUSDT), and the current market price at that moment. It also flags whether this idle state is happening during a backtest or in a live trading scenario. The core of this result indicates that there’s no active trading signal, and the system is simply observing the market.


## Interface IStrategyTickResultClosed

This interface represents the outcome when a trading signal is closed, providing a complete picture of what happened. It includes all the original signal details, along with the price at which the position was closed. You’ll find information about why the signal closed – was it a take-profit, stop-loss, or time expiry? 

The result also contains the precise timestamp of the closure and a detailed breakdown of the profit and loss, including any fees or slippage. Finally, it specifies the strategy, exchange, and symbol involved, and indicates whether the event occurred during a backtest or live trading. This gives you a full record for analysis and review.


## Interface IStrategyTickResultCancelled

This interface describes what happens when a pre-planned trading signal is cancelled. It's used when a signal you’ve scheduled doesn’t actually lead to a trade, perhaps because it’s expired or a stop-loss was triggered before the trade could be opened. 

The data provided includes the details of the cancelled signal itself, the final price at the time of cancellation, and the timestamp of when it happened. You'll also find information about which strategy and exchange were involved, as well as whether this cancellation happened during a backtest or a live trading session. This helps you understand why a scheduled signal didn't execute as planned.


## Interface IStrategyTickResultActive

This interface represents a tick event within the backtest-kit framework, specifically when a trade is actively being monitored – meaning it's waiting for a take profit (TP), stop loss (SL), or time expiration. It provides details about the active trade, including the signal that triggered it, the current price used for monitoring, and the names of the strategy, exchange, and trading symbol involved. The `percentTp` and `percentSl` properties track the progress towards the TP and SL levels, respectively. Finally, a flag indicates whether the event originates from a backtesting simulation or a live trading environment.

## Interface IStrategySchema

This interface describes the structure of a trading strategy you can register within the backtest-kit framework. Think of it as a blueprint for how your strategy will generate trading signals. Each strategy needs a unique name to be identified, and you can add a note for yourself or other developers to explain its purpose.

The `interval` setting controls how frequently your strategy can produce signals, preventing it from overwhelming the system. The core of the strategy is the `getSignal` function – this is where the magic happens, and it determines when to buy or sell.  This function can also be used to schedule signals, waiting for a specific price to be reached.

You can also include optional callbacks for specific events like when a position is opened or closed. For risk management, you can assign a risk profile name or a list of profiles to your strategy.

## Interface IStrategyResult

The `IStrategyResult` interface holds the information you need to compare different trading strategies. It's essentially a single row in a table showing how each strategy performed. Each result includes the strategy's name, a comprehensive set of statistics detailing its performance (like profit/loss, drawdown, etc.), and a metric value – this is the number used to rank the strategies. If a strategy’s results are invalid for some reason, the metric value will be null.

## Interface IStrategyPnL

This interface represents the profit and loss (PnL) result for a trading strategy. It provides key details about how well a trade performed, taking into account both trading fees and slippage.

The `pnlPercentage` tells you the overall percentage gain or loss on the trade, allowing for quick comparisons.  You can easily see if a trade was profitable or not, and by how much.

The `priceOpen` property shows the actual price at which the trade was entered, after factoring in the typical costs of fees and slippage. Similarly, `priceClose` reveals the price at which the trade exited, also adjusted for those costs.  These adjusted prices offer a more realistic view of the trade’s execution.

## Interface IStrategyCallbacks

This interface provides a way to listen for different events during the backtesting or live trading process. Think of these callbacks as hooks that allow your custom logic to respond to what's happening with your trading strategies. You can use them to log information, adjust parameters, or perform other actions based on signal state changes.

Each callback function gets triggered at a specific point:

*   `onTick`: Runs every time a new price tick arrives.
*   `onOpen`: Notified when a new trading signal is confirmed and a position is opened.
*   `onActive`: Called while a trading signal is actively being monitored.
*   `onIdle`: Informs you when there are no active trading signals.
*   `onClose`: Alerts you when a trading signal is closed, providing the closing price.
*   `onSchedule`: Signals the creation of a scheduled trading signal.
*   `onCancel`: Triggers when a scheduled signal is cancelled.
*   `onWrite`: Used to log signal data for persistence testing purposes.
*   `onPartialProfit`: Notifies you when a signal is in a partial profit state.
*   `onPartialLoss`: Alerts you when a signal is in a partial loss state.

By implementing these callbacks, you can build more sophisticated and responsive trading systems.

## Interface ISizingSchemaKelly

This schema defines a sizing strategy based on the Kelly Criterion, a mathematical formula used to determine optimal bet size. It’s designed for situations where you want to automatically calculate how much to invest in a trade based on expected returns and risk. 

The `method` property always specifies that this is a Kelly Criterion sizing approach. 

The `kellyMultiplier` value controls the aggressiveness of the sizing. A value of 0.25 (the default) is often considered a "quarter Kelly" strategy, which is a more conservative approach aimed at preserving capital. Higher values will lead to larger bet sizes and potentially higher returns, but also greater risk.


## Interface ISizingSchemaFixedPercentage

This schema defines a simple way to size your trades – by always risking a fixed percentage of your capital on each one. It's straightforward to implement and good for consistent risk management.

You specify this approach by setting the `method` property to "fixed-percentage." The `riskPercentage` property then tells the system what percentage of your total capital you're willing to lose on a single trade; for example, a `riskPercentage` of 2 means you’re risking 2% of your capital per trade. Remember to keep this value between 0 and 100.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, acts as the foundation for how much of your trading capital to allocate to each trade. It defines the core properties that control sizing. 

You'll find a `sizingName` to uniquely identify each sizing strategy you create. There’s also a `note` field to add your own documentation or reminders. 

The schema includes controls to limit your position sizes: `maxPositionPercentage` sets an upper limit based on your account balance, while `minPositionSize` and `maxPositionSize` define absolute boundaries. Finally, `callbacks` allows you to hook into specific points in the sizing process to customize behavior.


## Interface ISizingSchemaATR

This schema defines how your trading strategy determines the size of each trade, using the Average True Range (ATR) as a key factor. It’s particularly useful when you want to manage risk based on market volatility.

The `method` is always "atr-based" indicating this specific sizing approach.

`riskPercentage` sets the maximum percentage of your total capital you're willing to risk on a single trade – a common risk management practice.

`atrMultiplier` adjusts the stop-loss distance based on the ATR value, allowing you to scale your position size according to how much the market typically fluctuates. A higher multiplier means a wider stop-loss and potentially a smaller position size.


## Interface ISizingParamsKelly

This interface defines the parameters needed to use the Kelly Criterion for determining trade sizes. It's used when setting up how much capital your trading strategy will allocate to each trade.

You'll provide a logger to help with debugging and monitoring your strategy's performance; this allows you to see what's happening behind the scenes. Think of the logger as a tool for tracking and understanding your strategy's behavior.

## Interface ISizingParamsFixedPercentage

This interface defines how to set up your trading strategy with a fixed percentage sizing approach. It's used when creating a `ClientSizing` object. 

Essentially, it focuses on using a consistent percentage of your available capital for each trade.

The interface requires a `logger` property, which allows you to keep track of what your strategy is doing through debugging output. This helps you understand and troubleshoot your strategy's behavior.

## Interface ISizingParamsATR

This interface defines the parameters needed to control how much of your capital is used for each trade when using an Average True Range (ATR) sizing strategy. It's all about managing risk and position size based on market volatility.

You'll find a `logger` property here, allowing you to hook up a logging service to monitor and debug the sizing process – useful for understanding how your parameters affect trade sizes. This helps ensure your sizing strategy behaves as expected.

## Interface ISizingCallbacks

This interface defines functions that let you react to events happening during the sizing process, which is how your trading strategy determines how much to buy or sell. Specifically, `onCalculate` allows you to step in after the size of a trade has been figured out. You might use it to check if the size makes sense, or to record what happened for later analysis. It gives you the calculated quantity and some parameters related to the sizing calculation.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate position sizes using the Kelly Criterion. It’s all about determining how much of your capital to allocate to a trade based on its expected performance.

You'll provide a win rate, representing the percentage of trades expected to be profitable, and a win/loss ratio, which describes the average profit compared to the average loss when a trade is successful. These two values are crucial for the Kelly Criterion to estimate a safe and potentially optimal bet size. Essentially, this helps automate sizing decisions based on quantitative factors.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate the size of a trade using a fixed percentage strategy. It's designed for scenarios where you want to consistently risk a certain percentage of your capital on each trade. 

Specifically, you'll need to specify that the sizing method is "fixed-percentage," and also set a `priceStopLoss` value, which represents the price at which the stop-loss will be triggered. This stop-loss price is essential for determining the appropriate trade size based on the fixed percentage risk.

## Interface ISizingCalculateParamsBase

This interface provides the foundational information needed when calculating how much to trade. It contains essential details like the trading pair you're working with, represented by its symbol – for example, "BTCUSDT".  You’ll also find the current balance of your account and the anticipated entry price for your trade. This base information is shared across various sizing calculations within the backtest-kit framework.

## Interface ISizingCalculateParamsATR

This interface defines the settings needed when you're determining trade size using the Average True Range (ATR) method. It's pretty straightforward: you specify that you're using the "atr-based" sizing method, and you provide the current ATR value, which is a numerical representation of market volatility. This ATR value will be used in calculations to figure out how much to trade.

## Interface ISizing

The `ISizing` interface defines how a strategy determines the size of a trade. Think of it as the logic that figures out how much to buy or sell based on factors like your risk tolerance and the price of the asset. The core of this interface is the `calculate` function, which takes parameters representing your risk profile and returns a number – the calculated position size. This function is the heart of your sizing strategy, handling the math to decide how much capital to commit to each trade.

## Interface ISignalRow

The `ISignalRow` interface represents a finalized signal ready to be used within the backtest-kit framework. Think of it as a complete package of information about a trading signal. 

Each signal gets a unique ID, ensuring it can be tracked throughout the system.  You’ll find details like the entry price (`priceOpen`), the exchange and strategy being used, and timestamps indicating when the signal was created (`scheduledAt`) and when the trade became pending (`pendingAt`). 

The `symbol` property tells you which trading pair is involved, like "BTCUSDT."  Finally, an internal flag `_isScheduled` helps the system manage signals that were initially created as scheduled events.

## Interface ISignalDto

This interface, `ISignalDto`, defines the structure of signal information used within the backtest-kit framework. Think of it as a blueprint for describing a trading signal – essentially, a plan for a trade. It includes details like whether you're planning to buy ("long") or sell ("short"), the entry price, and crucial risk management elements like take profit and stop loss levels.  There’s also space for a human-readable note to explain the reasoning behind the signal.  Finally, `minuteEstimatedTime` helps estimate how long the signal is expected to remain active. The system automatically assigns a unique ID to each signal.

## Interface IScheduledSignalRow

This interface, `IScheduledSignalRow`, represents a trading signal that's designed to be executed at a specific price in the future. Think of it as a signal that's "on hold" – it's waiting for the market to reach a certain price level before it's actually triggered. It builds on the standard `ISignalRow` and has the key feature of a `priceOpen`, which is the target price the market needs to reach before the signal becomes active. 

Essentially, it’s a way to automatically enter a trade when the price hits a level you’ve specified, even if the market isn't there yet. Once the price reaches that `priceOpen`, the signal transforms into a regular, active signal. The `pendingAt` field keeps track of how long the signal has been waiting; initially, it shows the time the signal was scheduled, but it updates to the actual time the signal starts pending.


## Interface IRiskValidationPayload

This interface, `IRiskValidationPayload`, holds all the information a risk validation function needs to make a decision. Think of it as a package containing details about the trading environment. It includes the signal that's about to be executed (`pendingSignal`), the total number of positions currently open (`activePositionCount`), and a complete list of those active positions (`activePositions`), providing a full picture of the portfolio's status. These details help ensure that trades are safe and aligned with risk management rules.


## Interface IRiskValidationFn

This describes a function used to check if your trading strategy's risk settings are safe and reasonable. Think of it as a safety net – it verifies things like maximum position size or leverage to ensure you’re not taking on too much risk.  If the function detects a problem with your risk parameters, it will stop the backtesting process and signal an error, preventing potentially disastrous trades. It's designed to help you catch risky configurations before they can lead to losses.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define how to check if certain risk conditions are acceptable during your backtesting. Think of it as a way to set rules and guidelines for your trading strategies. 

It has two main parts:

*   **`validate`**: This is the core of the validation – a function you write that takes risk parameters and determines if they pass or fail.  It's where you put your specific logic.
*   **`note`**: This is an optional description to explain what the validation is doing. It's useful for keeping track of why you set up the validation in the first place, and helps others (or your future self) understand what's going on.

## Interface IRiskSchema

This interface, `IRiskSchema`, lets you define and register custom risk controls for your trading backtests. Think of it as a way to create personalized rules that govern how your portfolio behaves.

Each risk schema needs a unique `riskName` to identify it. You can also add a `note` to explain what the risk profile does – helpful for keeping track of your setups.

You have the option to provide `callbacks` for specific lifecycle events, allowing you to react to situations where a trade is rejected or allowed.

The core of the schema is the `validations` array. This is where you define the actual logic for your risk controls – a list of functions or objects that will be checked before trades are executed.

## Interface IRiskParams

This interface, `IRiskParams`, defines the settings you provide when setting up the risk management part of your backtesting or live trading system. It's like a configuration file telling the system how to handle risk checks.

You'll specify a logger to help with debugging and understand what’s happening behind the scenes.  There's a flag to clearly indicate whether you are running a backtest (historical simulation) or a live trade.

Crucially, you can also define an `onRejected` callback. This function gets called *before* any risk-related events are broadcast when a signal is blocked by your risk rules. This gives you a chance to react to a rejected signal, perhaps log the reason or take other actions before the system officially responds.

## Interface IRiskCheckArgs

The `IRiskCheckArgs` interface provides the data needed to assess whether a new trade should be allowed. Think of it as a safety check performed before a trading signal is actually generated. It bundles together essential information like the trading pair (symbol), the details of the signal being considered, the name of the strategy initiating the request, and details about the exchange and market conditions – including the current price and timestamp. This helps ensure that trading decisions align with established rules and avoid potentially problematic situations.

## Interface IRiskCallbacks

This interface defines optional functions that your backtest can use to react to risk-related events during trading. Think of them as notifications – your backtest can tell you when a trade idea was blocked by risk rules or when a trade was approved to proceed. The `onRejected` function is triggered when a trade signal fails a risk check, and `onAllowed` is called when a signal successfully passes those checks. These callbacks give you a way to monitor and understand how your risk management system is impacting your trading strategy.

## Interface IRiskActivePosition

This interface describes a single, active trading position that's being monitored for risk management purposes across different trading strategies. Think of it as a snapshot of a trade as it's happening.

Each position has information about the signal that triggered it – the details of why the trade was initiated. You'll also find the name of the strategy responsible for the trade, the exchange where it's taking place, and the exact time the position was opened. This allows for a deeper analysis of risk across all your strategies and exchanges.

## Interface IRisk

The `IRisk` interface helps manage and control the risk involved in your trading strategies. It's designed to make sure trades align with your predefined risk boundaries and to keep track of open positions.

You can use `checkSignal` to see if a potential trade is permissible, based on your established risk rules. 

The `addSignal` method lets you record when a new trade is opened, while `removeSignal` handles closing a position, ensuring your risk tracking stays accurate. This helps prevent overexposure and supports a more controlled trading environment.

## Interface IPositionSizeKellyParams

The `IPositionSizeKellyParams` interface lets you define how much of your capital to risk based on the Kelly Criterion. It's a straightforward way to calculate position sizes, helping you manage risk and potentially maximize returns.

You’ll need to specify two key pieces of information: `winRate`, which represents the probability of a successful trade expressed as a number between 0 and 1, and `winLossRatio`, which describes the average profit you make on a winning trade compared to the average loss on a losing one. These parameters are used to compute the optimal position size for each trade.

## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed when using a fixed percentage position sizing strategy. It’s essentially a way to determine how much of your capital to allocate to a trade based on a percentage, and it requires you to specify a stop-loss price. The `priceStopLoss` property tells the backtest kit the price at which you want to automatically exit the trade to limit potential losses. It's a crucial element in managing risk when using this sizing method.

## Interface IPositionSizeATRParams

This interface defines the settings needed when determining your trade size using the Average True Range (ATR). It’s used to calculate how much of your capital to allocate to a trade based on the ATR's volatility. The `atr` property simply holds the current ATR value – a key number in the calculation.

## Interface IPersistBase

This interface defines the basic operations for managing data storage within the backtest-kit framework. Think of it as a standard way to read, write, and check for the existence of data. The `waitForInit` method ensures that the storage directory is properly set up and any necessary files are validated only once. `readValue` retrieves a specific data item, while `hasValue` quickly tells you if a particular item is already stored. Finally, `writeValue` saves a data item, ensuring that the process is reliable and doesn't leave data in a corrupted state.

## Interface IPartialData

This interface, `IPartialData`, represents a small piece of information about a trading signal that can be saved and loaded later. Think of it as a snapshot of key progress points. It’s designed to be easily stored and retrieved, even if the program restarts. 

Specifically, it tracks the profit and loss levels that have been hit during trading. These levels are stored as arrays of `PartialLevel` objects, allowing them to be saved in a format that can be easily converted back into a full trading state when needed.  It’s used within the backtest-kit framework to allow for persisting progress.

## Interface IPartial

The `IPartial` interface is all about keeping tabs on how your trading signals are performing financially. It's the mechanism used to track milestones like reaching 10%, 20%, or 30% profit or loss on a trade.

When a signal is making money, the `profit` method is called to see if any of those profit thresholds have been hit, and it sends out notifications only for the new levels reached. The same thing happens with losses – the `loss` method monitors for loss milestones and alerts when they’re achieved.

Finally, when a signal finishes trading—whether it hits a target profit, a stop-loss, or simply runs out of time—the `clear` method gets called. This method cleans up the signal's financial record, ensuring the system doesn’t hold onto outdated information. It makes sure everything's tidied up and saved properly.

## Interface IOptimizerTemplate

This interface provides a set of tools for creating code snippets and messages to use with a trading framework, particularly when interacting with Large Language Models (LLMs).  Think of it as a blueprint for building different parts of your trading system.

It allows you to generate various code components, such as:

*   **Initialization and Imports:** Creates the initial setup code needed for your trading environment.
*   **LLM Conversation Messages:**  Builds the content for messages you’d send to and receive from an LLM, helping it understand and respond to trading data.
*   **Configuration Code:**  Generates the specific instructions for key components like Walkers (which orchestrate trading), Exchanges (the platforms you trade on), Frames (the time periods you analyze), and Strategies (the actual trading rules).
*   **Utility Functions:**  Provides simple helper functions for debugging (like `dumpJson`) and structuring LLM output (`json`, `text`).

Essentially, this interface is designed to make it easier to programmatically generate the code needed to set up and run a backtesting and trading system, especially when incorporating LLMs into the process. You can use it to define these code structures based on different data and names.

## Interface IOptimizerStrategy

This interface represents a trading strategy created using an AI, like a large language model. It holds all the information about how that strategy was developed, including the specific trading pair it's designed for (the `symbol`). Each strategy has a unique `name` to easily identify it in your system and track its performance. 

Crucially, it keeps a record of the `messages` – the back-and-forth conversation between you and the AI – so you can understand the reasoning behind the strategy’s logic. Finally, the `strategy` property itself contains the actual text of the AI-generated trading rules, which your backtesting system will use.

## Interface IOptimizerSourceFn

This function is your way to feed data into the backtest-kit's optimization engine. Think of it as the data pipeline – it needs to provide the historical data the optimizer will use to learn and adjust trading strategies. It’s designed to handle large datasets efficiently, using pagination to break things down into manageable chunks. Crucially, each piece of data it provides needs a unique identifier, which helps the system keep track of everything.

## Interface IOptimizerSource

This interface describes how your backtest data is brought into the system and prepared for use, especially when interacting with large language models.  It lets you give your data source a descriptive name and an optional description to help keep things organized.

The core of it is the `fetch` function, which is responsible for retrieving your backtest data, and it must be able to handle retrieving data in chunks (pagination).  You can also customize how the data appears as user and assistant messages during the LLM conversation by providing your own formatting functions; if you don't, the system will use a default format. Essentially, this lets you shape the conversation flow and data presentation for optimal results.


## Interface IOptimizerSchema

This interface describes how an optimizer is set up within the backtest-kit framework. Think of it as a blueprint for creating and testing trading strategies using AI.

It lets you define a unique name for your optimizer, add an optional description, and specify different time periods for training and testing. 

The `rangeTrain` property is key, allowing you to create multiple versions of a strategy, each trained on a slightly different historical period to see how they compare.  `rangeTest` is where you’ll evaluate how well those strategies perform.

You'll also provide data sources (`source`) – these feed information into the AI to generate the strategies. A `getPrompt` function is crucial; it crafts the prompt that's sent to the AI, incorporating the data and conversation history.

Finally, you can customize the strategy generation process with a `template` or track progress with `callbacks`.

## Interface IOptimizerRange

This interface, `IOptimizerRange`, helps you specify the time periods you want to use when testing or training trading strategies. Think of it as defining the window of historical data your backtest will analyze. 

It lets you set both a `startDate` and `endDate`, which are the beginning and end dates for that timeframe.  You can also add a helpful `note` to describe the period, like "2023 Bear Market" or "2024 Growth Period," to keep things organized. Essentially, it gives you precise control over the historical data your strategies will learn from and be evaluated against.

## Interface IOptimizerParams

This interface defines the necessary configuration when setting up a ClientOptimizer. Think of it as the blueprint for how the optimizer will operate.

It requires a logger, which allows the optimizer to provide helpful messages about what it’s doing—useful for debugging and understanding its behavior.

You also need to provide a complete template, which contains all the instructions and methods the optimizer will use to perform its calculations and adjustments. This template combines your custom settings with some default values provided by the system.

## Interface IOptimizerFilterArgs

This interface defines the information needed to request specific data from a data source. Think of it as a way to tell the system exactly which trading pair and time period you're interested in. You specify the `symbol`, like "BTCUSDT" for Bitcoin against USDT, along with a `startDate` and `endDate` to pinpoint the data range you want to examine. This helps efficiently retrieve only the data necessary for analysis or backtesting.

## Interface IOptimizerFetchArgs

When you're pulling data for optimization, this interface defines how much data to grab each time. Think of it like paging through a very long list – the `limit` property tells you how many items to show on each page, and the `offset` tells you where to start from. By default, it grabs 25 items at a time, but you can adjust those numbers to suit your needs.

## Interface IOptimizerData

This interface, `IOptimizerData`, is the foundation for how your backtest kit gets the data it needs to run optimization tests. Think of it as a standard format for data coming from various sources. Every piece of data provided must have a unique identifier – the `id` property – to prevent duplicates when dealing with large datasets or data that’s fetched in chunks. This `id` helps ensure that the optimization process doesn't get skewed by accidentally using the same data point multiple times.


## Interface IOptimizerCallbacks

This interface lets you observe what's happening during the optimization process, giving you opportunities to keep track of progress and ensure things are working correctly. You can use the `onData` callback to examine the strategies that have been created after the data collection phase. The `onCode` callback fires once the strategy code is generated, letting you inspect it. 

Similarly, `onDump` is triggered after the code gets written to a file, allowing for confirmation of that action. Finally, `onSourceData` provides insight into the data retrieval process, notifying you when data is fetched and giving you a chance to check that the data looks right. You can customize each of these callbacks with your own validation or logging logic.


## Interface IOptimizer

This interface defines how to interact with an optimizer, primarily for creating and exporting trading strategies. You can use it to retrieve metadata about potential strategies, build complete trading code based on that data, and save the generated code directly to files. Think of it as a way to automate the process of generating and deploying trading strategies. The `getData` method pulls information and builds the foundation for the strategies, `getCode` stitches everything together into a runnable program, and `dump` lets you save that program as a ready-to-use file.

## Interface IMethodContext

This interface, `IMethodContext`, acts as a little guidebook for your backtesting operations. It holds important names – the exchange, the strategy, and the frame – that the backtest-kit uses to figure out exactly which components it needs to run your tests. Think of it as a way to ensure everything is using the correct configuration and setup.  It’s passed around during the backtesting process, making it easy to access these essential details without having to constantly look them up. The 'frameName' being empty indicates that it's live trading mode, not a backtest.


## Interface ILogger

The `ILogger` interface provides a way for different parts of the backtest-kit framework to record information about what's happening. Think of it as a central place to track events, from basic messages to detailed debugging information.

It offers several logging methods with different levels of severity: `log` for general events, `debug` for detailed troubleshooting, `info` for informational updates, and `warn` for potential issues. These logs help you understand the system's behavior, find errors, and monitor its performance. You’ll see this interface used in various components, so it’s a key tool for diagnosing and auditing your backtesting processes.

## Interface IHeatmapRow

This interface represents a single row of data for a portfolio heatmap, providing a summary of performance for a specific trading pair. It gathers key metrics across all strategies applied to that symbol, giving you a quick overview of its overall health.

You’ll find essential performance indicators here, like total profit or loss, the Sharpe Ratio which gauges risk-adjusted returns, and the maximum drawdown which highlights the biggest potential losses.  The interface also includes trade-related data, such as the total number of trades, the number of winning and losing trades, and the win rate. 

Furthermore, it offers details about the average profit and loss per trade, volatility measurements like standard deviation, and streak information showing the longest winning and losing sequences. Finally, expectancy provides an estimate of average profit per trade based on win/loss characteristics.

## Interface IFrameSchema

This interface describes a reusable building block for your backtesting strategy – a "frame." Think of it as a pre-defined slice of time with specific characteristics, like a daily or weekly view of the market. Each frame has a unique name to easily identify it, and you can add a note for your own documentation. 

The `interval` property dictates how timestamps are generated within this frame (e.g., every minute, every hour).  `startDate` and `endDate` clearly define the time window this frame represents, marking the beginning and end of your backtest period. Finally, you can specify optional callbacks to react to certain events within this frame, allowing for more customized behavior.

## Interface IFrameParams

The `IFramesParams` interface defines the information needed when setting up a trading frame within backtest-kit. Think of it as the initial configuration for a simulated trading environment. It builds upon the `IFramesSchema` interface and crucially includes a `logger` – this is your tool for tracking what's happening inside the frame, helping you debug and understand the backtest's behavior. It's essential for monitoring and troubleshooting your trading strategies.

## Interface IFrameCallbacks

The `IFramesCallbacks` interface helps you hook into important moments in how backtest-kit structures your data for analysis. Specifically, you can use the `onTimeframe` callback to get notified whenever a new set of timeframes is created. This is a good place to check if the timeframes look right, perhaps ensuring they cover the entire period you expect or verifying the chosen interval is correct. It's essentially a way to observe and potentially react to the foundation of your backtesting process.

## Interface IFrame

The `IFrames` interface is a core part of backtest-kit, handling how your data is organized into time periods for testing. Think of it as the engine that creates the sequences of dates your trading strategies will analyze. 

Specifically, the `getTimeframe` function is the key method here. When you call it, you provide a symbol (like "BTCUSDT") and a frame name (like "1h" for hourly data), and it returns an array of dates. These dates represent the specific points in time your backtest will evaluate. The spacing of these dates is determined by the interval you've set up within backtest-kit, ensuring consistent data chunks for analysis.

## Interface IExecutionContext

The `IExecutionContext` interface holds the essential information needed for your trading strategies and exchange interactions to function correctly. Think of it as a little package of data passed around to tell your code what's happening right now. It includes the `symbol` being traded, like "BTCUSDT", the `when` timestamp, which represents the current point in time for the operation, and a `backtest` flag to indicate whether the code is running in a simulated backtesting environment or in a live trading setting. This context helps your strategy make informed decisions based on the current conditions.

## Interface IExchangeSchema

This schema describes how backtest-kit interacts with a specific cryptocurrency exchange. Think of it as a blueprint for connecting to a data source and understanding its specific quirks. 

Each exchange you want to use with backtest-kit needs its own schema. 

The `exchangeName` is simply a unique identifier you give the exchange within your backtest-kit setup. `note` is just for your own reference, a place to jot down helpful notes.

The most important part is `getCandles`, which tells backtest-kit how to retrieve historical price data – it’s the function that actually fetches the data from the exchange's API or database.  You'll also define `formatQuantity` and `formatPrice` functions to handle how the exchange represents trade sizes and prices, ensuring accuracy.

Finally, `callbacks` allows you to hook into certain events, such as receiving new candle data.

## Interface IExchangeParams

This interface, `IExchangeParams`, is all about setting up how your trading exchange interacts with the backtest environment. Think of it as a configuration object you pass when creating your exchange. It includes a `logger` to help you track what's happening and debug any issues—you’ll want to use this to see your trades and any errors. Crucially, it also provides an `execution` context which carries vital information like the trading symbol, the time period you’re backtesting, and whether it's a backtest or live trading scenario.  This context ensures your exchange behaves correctly based on the specific conditions of the backtest.

## Interface IExchangeCallbacks

This interface allows you to define functions that your backtest or trading system will call when new candlestick data arrives from an exchange. You can use `onCandleData` to react to changes in price data—for example, to update charts, trigger alerts, or perform calculations. The function receives the symbol being traded, the time interval of the candles (like 1 minute, 1 hour, etc.), the starting date for the data request, the number of candles requested, and an array containing the actual candlestick data.


## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with a simulated exchange during testing. It allows you to retrieve historical and future price data, crucial for recreating market conditions. You can request candle data, specifying the trading symbol, the time interval (like 1 minute or 1 hour), and how many candles you need. The framework also includes helpful functions for formatting trade quantities and prices to match the exchange's rules. Finally, a VWAP (Volume Weighted Average Price) calculation is provided to estimate average price based on recent trading activity.

## Interface IEntity

This interface, `IEntity`, acts as a foundation for all data objects that are saved and retrieved from storage within the backtest-kit framework. Think of it as a common starting point that ensures all persisted data has a consistent structure. If you're creating a custom data object to be used in your backtest, it should likely implement this interface. It establishes a baseline for how your data is handled and managed within the system.

## Interface ICandleData

This interface describes a single candlestick, which is a standard way to represent price movements over a specific time period. Each candlestick contains key information like the time it started (timestamp), the opening price, the highest and lowest prices reached during that time, the closing price, and the volume of trades that occurred. This data is essential for analyzing price trends and for backtesting trading strategies, especially when calculating things like VWAP. Think of it as a snapshot of market activity for a particular moment.


## Interface HeatmapStatisticsModel

This data structure holds the overall performance statistics for your entire portfolio, visualized as a heatmap. It breaks down the aggregated results across all the assets you're tracking. 

You’ll find a list of individual symbol statistics within the `symbols` property, giving you a detailed view of each asset’s contribution. 

Beyond that, it provides key summary metrics like the total number of symbols, total profit and loss (PNL), Sharpe Ratio – a measure of risk-adjusted return – and the total number of trades executed across the whole portfolio. Essentially, it's a quick snapshot of your portfolio's health and activity.


## Interface DoneContract

The `DoneContract` interface signals when a background task finishes, whether it's a backtest or a live trading session. Think of it as a notification letting you know a process is complete.  It provides details about what just happened, including the exchange used, the name of the trading strategy involved, whether it was a backtest or live execution, and the symbol being traded.  This information helps you track and understand the outcomes of your automated trading processes.

## Interface ColumnModel

This interface, `ColumnModel`, helps you customize how data is displayed in tables generated by backtest-kit. Think of it as a blueprint for defining a single column. 

Each column needs a unique identifier, represented by the `key` property. You also give it a user-friendly `label` that will appear as the column header. 

The `format` property is where you control how the actual data in the column is presented – it’s a function that transforms your data into a string. Finally, `isVisible` lets you conditionally hide or show a column based on certain conditions.

## Interface BacktestStatisticsModel

This model holds all the important statistical information calculated during a backtest. It’s like a report card for your trading strategy, giving you a complete picture of how it performed. 

You’ll find details about every closed trade, the total number of trades, and how many were winners versus losers.  Key performance indicators like win rate, average profit per trade, and total profit are included, all expressed as percentages. 

To help you understand the risk involved, it also provides volatility measures like standard deviation and the Sharpe Ratio, which considers both return and risk. Finally, there's a metric called the Certainty Ratio that shows how much better your winning trades were compared to your losing ones, along with an estimate of yearly returns. If any of these calculations encounter unusual data, the value will be marked as null.
