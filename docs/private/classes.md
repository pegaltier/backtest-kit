---
title: private/classes
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


# backtest-kit classes

## Class WalkerValidationService

This service helps you keep track of and ensure the validity of your "walkers," which are essentially configurations used for parameter sweeps and hyperparameter tuning. Think of it as a central place to register your different optimization setups.

You can add new walker configurations using `addWalker`, and then use `validate` to confirm a specific walker exists before you try to use it in your backtesting process.  This prevents errors and makes sure everything runs smoothly. The service also remembers its validation results to speed things up, and `list` lets you see all the walkers you've registered. It’s designed to make managing your parameter exploration efforts easier and more reliable.

## Class WalkerUtils

WalkerUtils is a helper class designed to simplify working with walkers – essentially, automated trading strategy comparisons – within the backtest-kit framework. It acts as a central point for running walkers, managing their state, and getting their results. Think of it as a convenient way to launch, monitor, and retrieve information about your trading strategy comparisons.

You can easily start a walker comparison for a specific symbol and context, or run one in the background without needing to deal with the raw data stream—useful when you just want to log progress or trigger other actions. If you need to halt a walker’s signal generation, a stop function is available to safely interrupt its operation, allowing current signals to complete before preventing new ones.

Want a summary of the comparison results? You can get the complete data or generate a nicely formatted markdown report that you can save to a file. Finally, there's a handy command to list all the walkers currently in progress and their status. It's implemented as a singleton, making it readily available throughout your application.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of different schema definitions for your trading strategies, ensuring they're structured correctly and consistently. It acts like a central repository where you can register, update, and retrieve these schemas.

Think of it as a place to store blueprints for your trading algorithms – the service makes sure these blueprints have all the necessary pieces in place. 

You add new schemas using `addWalker()`, and get them back later by their name. If you need to adjust an existing schema, you can use `override()` to make targeted changes. The service also includes checks (`validateShallow`) to ensure your schemas are well-formed before they’re added. This whole system uses a special type-safe storage mechanism to prevent errors.

## Class WalkerReportService

The WalkerReportService helps you keep track of how your trading strategies are performing during optimization. It essentially monitors the optimization process and records the results – things like metrics and statistics – in a database. This lets you see how different strategy parameter combinations are doing and compare their performance over time.

You can think of it as a listener that’s always watching for updates from the optimization process. It ensures that you're not accidentally recording the same data multiple times and provides a simple way to stop the recording when you’re finished. This service provides tools to analyze your optimization experiments and pinpoint the best-performing strategies.

## Class WalkerMarkdownService

This service helps you create easy-to-read reports about your backtesting strategies. It listens for updates as your strategies run and gathers information about their performance.

It keeps track of results for each strategy individually, ensuring that each one has its own dedicated space for data. The service then compiles this information into nicely formatted markdown tables, making it simple to compare different strategies side-by-side.

You can specify which data points to include in these reports, and the service automatically saves them as markdown files in a designated folder, so you have a record of your backtesting runs.

You can subscribe to receive updates as the backtest progresses, and unsubscribe when you no longer need them. It also offers a way to clear out old data to keep things tidy, either for a specific strategy or all of them at once.

## Class WalkerLogicPublicService

This service helps manage and run your trading "walkers," which are essentially automated trading strategies. It builds upon a private service, automatically passing along important details like the strategy name, exchange being used, the timeframe, and the walker’s name with each run. 

Think of it as a convenient layer that simplifies how you execute your strategies. 

It’s designed to make sure all the relevant information is available during the trading process, without you having to manually provide it each time.

The `run` method is the main way to use this service; you give it a stock symbol and some context, and it will start the backtesting process for all of your strategies.


## Class WalkerLogicPrivateService

This service helps you compare different trading strategies against each other, essentially orchestrating a "walker" process. It takes a symbol, a list of strategies you want to test, a metric to measure their performance (like profit or Sharpe ratio), and some context information about the exchange and data frame being used.

As each strategy runs, you'll receive updates on its progress. The service keeps track of the best-performing strategy in real-time. Once all strategies are finished, it gives you a complete report, ranking them based on the chosen metric.

Under the hood, it relies on other services to actually perform the backtesting of each individual strategy. Think of it as the conductor of an orchestra, bringing together different components to produce a final, ranked comparison.

## Class WalkerCommandService

WalkerCommandService acts as a central point to interact with the walker functionality within the backtest-kit framework. Think of it as a helper, streamlining how you access and use the walker's features.

It's designed to be easily used within your application’s dependency injection system.  It manages several other services under the hood, including those responsible for logging, managing walker data, validating strategies, exchanges, frames, and risks, and providing schema information.

The core function, `run`, is how you actually kick off a walker comparison.  You provide it with a symbol (like a stock ticker), and context information including the names of the walker, exchange, and frame you want to use.  The `run` method then generates a sequence of results from the walker comparison.

## Class TimeMetaService

TimeMetaService helps you keep track of the most recent candle timestamp for a specific trading setup – think a particular symbol, strategy, exchange, and timeframe. It's designed to give you that timestamp even when you're not actively in a trading "tick" execution, like when you need to run a command between trades.

It works by storing the timestamp for each unique combination of symbol, strategy, exchange, frame, and whether it’s a backtest in a special memory cache. If you ask for the timestamp and it's already there, you get it immediately. If not, it waits briefly for the first timestamp to arrive – typically no more than a few seconds.

The service is managed automatically; it gets updated after each trading tick by another part of the system and gets cleared when a strategy starts up to ensure you're always using fresh data.

You can clear the cache yourself if you need to, either for a single trading setup or for everything at once. This is useful for resetting things when you start a new backtest or trading session. It's also designed to work seamlessly within the normal trading flow, pulling timestamps directly from the execution context when it's needed.

## Class SyncUtils

SyncUtils helps you understand and analyze the lifecycle of your trading signals. It gathers data about signal openings and closings, allowing you to examine how your strategies are performing.

You can use SyncUtils to get overall statistics like the total number of signals opened and closed, or to generate detailed markdown reports. These reports present the signal events in a nicely formatted table, including key information like entry and exit prices, profit/loss, and timestamps.

Furthermore, SyncUtils makes it easy to save these reports directly to files on your computer, ensuring you have a record of your trading activity for later review. It organizes these files using the symbol, strategy name, exchange, and whether it’s a backtest or live run, making them easy to find and understand.

## Class SyncReportService

This service is designed to keep track of what's happening with your trading signals, specifically when they're opened and closed. It listens for these “sync” events and writes them down in a special report file format (JSONL) for record-keeping and audits. Think of it as a detailed log of your signal activity.

It records when a signal is first created, including all the details about it, and also when a position based on that signal is closed, noting the profit/loss and why it was closed. To prevent accidental duplicate tracking, it uses a mechanism to ensure it only subscribes to the signal events once.

You can start listening for these signal events using the `subscribe` function, which will give you a way to stop listening later. Conversely, `unsubscribe` allows you to stop tracking signal events if you no longer need it. A `loggerService` helps with debugging and the `tick` property handles the processing and logging of these signal events.

## Class SyncMarkdownService

This service helps you create easy-to-read reports about your signal synchronization activity. It keeps track of signal open and close events, organizing them by symbol, strategy, exchange, frame, and whether it's a backtest. You’ll get nicely formatted markdown tables detailing the lifecycle of each signal, along with helpful statistics like total events, opens, and closes.

The service automatically saves these reports to a `dump/sync/` directory on your system, so you don’t have to worry about manually creating them.

You can subscribe to receive updates as synchronization events occur, or unsubscribe when you no longer need those updates. To retrieve data or reports, you can specify the symbol, strategy, exchange, frame and whether it's a backtest. You also have the option to clear accumulated data when it's no longer needed.


## Class StrategyValidationService

This service helps you keep track of and confirm your trading strategies are set up correctly. Think of it as a central place to register your strategies and make sure everything related to them – like risk settings and actions – is valid. 

It’s designed to be efficient because it remembers the results of previous checks, so it doesn't have to re-validate things repeatedly. 

You can use it to:

*   Add new strategies to your system.
*   Check if a strategy exists and if its settings are correct.
*   Get a complete list of all the strategies you’ve registered.

It relies on other services to handle the specifics of risk and action validation.

## Class StrategyUtils

StrategyUtils helps you analyze and understand how your trading strategies are performing. It's a handy tool for gathering information about strategy events like taking profits, setting trailing stops, and canceling orders.

Think of it as a central place to collect and organize data about your strategies. It pulls information from the system, calculates statistics, and presents it in easy-to-read reports.

You can ask it for overall statistical summaries, like how often each type of action occurs.  It can also create detailed markdown reports, which are essentially tables showing you each event with relevant details like price, percentage values, and timestamps.

Finally, you can use it to export these reports to files on your computer, making it easy to review performance and share insights. The filenames are organized to identify the symbol, strategy, exchange and frame.

## Class StrategySchemaService

This service helps you keep track of your trading strategy blueprints – think of it as a central place to store and organize them. It uses a special system to ensure your strategy definitions are consistent and type-safe.

You can add new strategy blueprints using `addStrategy()`, and then easily find them later by their name using `get()`. 

Before a new strategy blueprint is added, it's checked to make sure it has all the necessary parts with `validateShallow()`.

If you need to update an existing strategy blueprint, you can use `override()` to make partial changes without replacing the whole thing. This keeps things neat and manageable. Essentially, this service is your central hub for defining and managing your strategies.


## Class StrategyReportService

This service is designed to keep a detailed record of what your trading strategies are doing, writing each action to a separate JSON file. Think of it as an audit trail for your backtesting or live trading.

To start logging, you need to call `subscribe()`. Once subscribed, events like canceling scheduled orders, closing pending orders, taking partial profits or losses, adjusting trailing stops and take profits, and moving to breakeven will automatically be recorded. Each of these actions has its own dedicated logging function (like `cancelScheduled`, `closePending`, `partialProfit`, etc.) that provides a snapshot of the details at the time of the event.

When you're done logging, call `unsubscribe()` to stop the process. This ensures you don't continue writing unnecessary files. It's also designed to be safe to call multiple times, ensuring cleanup even if it’s called redundantly. The `loggerService` property lets you interact with the underlying logging system.

## Class StrategyMarkdownService

This service helps you track and report on what your trading strategies are doing. It’s designed to collect details about actions like canceling orders, closing positions, and adjusting stop-loss levels. Instead of writing each action to a file immediately, it temporarily stores these events, allowing for more efficient batch reporting.

Think of it as a temporary notepad for your strategy's activity. You tell it to start listening for events, and it quietly records them. Then, when you're ready, you can ask for a summary report in a readable Markdown format, or even save that report to a file.

You can customize what information gets included in the reports, and you can clear the notepad at any time. It’s a useful tool for understanding how your strategies behave during backtesting and live trading, giving you valuable insights into their performance and potential areas for improvement. Remember to start listening with `subscribe()` and stop when you are done with `unsubscribe()`.

## Class StrategyCoreService

This service acts as a central hub for managing strategy operations within the backtesting framework. It handles tasks like validating strategies, retrieving position data, and executing actions like partial profits or stops. Think of it as a helper that provides access to various strategy-related information and functions, always ensuring that the operations are performed within a defined context (symbol, timeframe, and backtest mode).

Here’s a breakdown of what it does:

*   **Validation & Checks:** It verifies the validity of strategies and risk configurations, avoiding repetitive checks by caching results. It also provides functions to check if actions like partial profits or breakeven movements would be successful.
*   **Position Data:** It can retrieve data related to your open positions, such as pending signals, total costs, average entry prices, and partial close history. This helps in monitoring and understanding the position's state.
*   **Signal Management:** It handles the retrieval and cancellation of scheduled signals, allowing for early activation or adjustments.
*   **Strategy Control:** It enables actions like stopping the strategy from generating new signals or closing pending positions without a full exit.
*   **Disposal & Clearing:**  It manages the cleanup of strategy instances, ensuring efficient resource usage.
*   **Context Awareness:**  Many functions operate within a specific context (symbol, timeframe, backtest flag) to provide accurate and relevant results. This ensures that the strategy behaves as expected within the given environment.



Essentially, it streamlines the process of interacting with and controlling strategies during backtesting or live trading.

## Class StrategyConnectionService

The `StrategyConnectionService` acts as a central hub for managing trading strategies within the backtest-kit framework. It intelligently routes requests to the correct strategy implementation based on the trading symbol and strategy name, ensuring that each strategy operates in its own isolated environment.

Think of it as a smart router: When the system needs to execute a trading action, it doesn’t know which specific strategy to use. The `StrategyConnectionService` figures that out and directs the action to the right place.

To improve performance, it caches these strategy implementations, so it doesn’t need to recreate them every time. The service also handles important tasks like ensuring strategies are initialized properly before they start trading, and providing convenient methods for checking signals, calculating position details (like cost, P&L, and average price), and managing partial closes and trailing stops.  It provides various utility functions to fetch and manipulate the current signal's state without directly modifying the strategy, which is useful for monitoring and validation. Finally, it allows for safely stopping and disposing of strategies as needed.

## Class StorageLiveAdapter

The StorageLiveAdapter is designed to manage how your trading signals are stored, offering flexibility by letting you easily swap out the storage method. It acts as a middleman, providing a consistent interface regardless of whether you're using persistent storage on disk, keeping data in memory, or using a dummy adapter for testing.

You can change the storage backend dynamically using methods like `usePersist`, `useMemory`, and `useDummy`, allowing you to switch between persistent and temporary storage as needed. The adapter also provides methods for finding signals by ID, listing all signals, and handling various signal events like opening, closing, scheduling, and cancellation. Essentially, it provides a pluggable system for managing your signal data.


## Class StorageBacktestAdapter

The `StorageBacktestAdapter` provides a flexible way to manage data during backtesting, allowing you to choose where and how your signals are stored. It acts as a middleman, letting you plug in different storage solutions without changing the core backtesting logic. You can easily switch between persistent storage (saving data to disk), in-memory storage (data lost when the backtest ends), or a dummy adapter (for testing where no storage occurs).

The adapter handles events like signal openings, closings, and cancellations, forwarding these actions to the currently selected storage mechanism. You can retrieve signals by their ID or list all stored signals. 

To control which storage method is used, you can set the storage adapter directly or use convenient shortcuts like `useDummy`, `usePersist`, or `useMemory` to quickly switch between them. The default configuration uses persistent storage to keep your signal data safe.

## Class StorageAdapter

The `StorageAdapter` is the central piece for handling your trading signals, keeping track of both historical backtest data and current live data. It automatically updates when new signals are generated, ensuring everything stays synchronized. 

To get it running, you’ll need to enable it to start listening for signals, and you can safely disable it as many times as you need to stop listening. 

Need to find a specific signal?  `findSignalById` helps you locate signals by their unique ID, searching through both backtest and live records.  If you want to see all the signals from your backtesting or live trading, `listSignalBacktest` and `listSignalLive` will retrieve those lists for you.

## Class SizingValidationService

The SizingValidationService helps you keep track of and verify your position sizing strategies, ensuring you're using valid setups. Think of it as a central manager for all your sizing rules. You can register new sizing strategies using `addSizing`, and before you use a strategy, you can validate it with `validate` to make sure it’s properly registered. This service remembers past validations to speed things up, and if you need a quick overview, `list` gives you a rundown of all the sizing strategies currently registered. The service relies on a logger to report any issues and uses an internal map to efficiently store and manage the sizing configurations.

## Class SizingSchemaService

This service helps you keep track of your sizing schemas – think of them as blueprints for how much to trade. It uses a system to safely store these blueprints and makes sure they're structured correctly.

You can add new sizing schemas using the `register` method, or update existing ones with `override`.  Need to use a sizing schema? Just ask for it by name using `get`, and it'll be retrieved for you. 

The service also includes a validation step to ensure your sizing schemas are set up properly before they're saved, making sure everything's in place as it should be. It’s like a quick check to prevent errors down the line.

## Class SizingGlobalService

The SizingGlobalService helps determine how much to trade, acting as a central hub for position sizing calculations. Think of it as a dedicated engine responsible for figuring out the right size for your trades, considering various factors. It relies on other services – a connection service to retrieve sizing data and a validation service to ensure things are correct – to do its job.  You'll find it working behind the scenes within the backtest-kit framework, ensuring strategies execute with consistent and validated sizing logic.  The `calculate` method is the core function, taking parameters about the trade and context into account to produce a position size.


## Class SizingConnectionService

The SizingConnectionService acts as a central hub for handling position sizing calculations within the backtest kit. It intelligently directs sizing requests to the correct sizing method implementation, allowing for flexibility in how positions are determined. 

To improve efficiency, the service remembers (caches) which sizing methods have already been loaded, so it doesn't need to recreate them every time you need to calculate a size. 

You specify which sizing method to use by providing a "sizingName," and if no sizing configuration is present, you'll use an empty string. The `calculate` function is what actually performs the sizing calculation, considering risk parameters and employing various methods like fixed percentage or Kelly Criterion. Essentially, it's your go-to place for getting the right position size based on your strategy’s needs.


## Class ScheduleUtils

This class, ScheduleUtils, is designed to help you understand and monitor how your trading signals are being scheduled and processed. Think of it as a central place to peek behind the curtain and see what's happening with your automated trading.

It simplifies accessing detailed information about signals that are waiting to be executed, those that have been cancelled, and key performance metrics like cancellation rates and average wait times. 

You can use it to generate easy-to-read reports in Markdown format, which will give you a clear overview of your signal scheduling. It’s set up as a single, readily available instance, so you can easily use it throughout your backtesting or live trading environment. 

Specifically, you can ask it for statistics on a particular trading symbol and strategy, generate a Markdown report summarizing the signal schedule, or even save that report directly to a file.

## Class ScheduleReportService

This service helps you keep track of how your scheduled signals are performing. It listens for events like when a signal is scheduled, when it starts running, and when it's cancelled.

The service carefully records the time it takes from scheduling to when the signal actually runs or is stopped, which is really useful for spotting potential delays or issues in your trading system.

You can easily subscribe to receive these signal events, and the system makes sure you don't accidentally subscribe multiple times. When you're done, just unsubscribe to stop receiving updates. The service also uses a logger to help you debug any problems you might encounter.

## Class ScheduleMarkdownService

The ScheduleMarkdownService helps you keep track of your automated trading signals by creating reports. It monitors when signals are scheduled and cancelled, then neatly organizes this information into markdown tables, making it easy to understand what's happening with your strategies. These reports include useful statistics like cancellation rates and average wait times.

The service accumulates data for each strategy and saves detailed reports to your logs directory, allowing you to review performance and identify any potential issues. It's designed to work with a specific data storage system, ensuring each strategy's information is kept separate. You can subscribe to receive these updates, unsubscribe when you no longer need them, and even clear the accumulated data when necessary. It also offers functions to get the data and reports programmatically, and allows you to specify what columns to include in reports.

## Class RiskValidationService

This service helps you keep track of your risk management setups and make sure they're all valid before your trading strategies run. Think of it as a central place to register and check your risk profiles.

You can add new risk profiles using `addRisk`, and then use `validate` to confirm that a specific profile exists when you need it. To speed things up, the service remembers the results of previous validations, so it doesn’t have to repeat checks unnecessarily. If you ever need to see all the risk profiles you've registered, the `list` function provides a handy overview. The service relies on a logging service and internally uses a map to store and manage your risk profiles.

## Class RiskUtils

RiskUtils helps you understand and analyze risk rejections in your trading system. It’s like having a tool that collects and summarizes all the times your risk controls kicked in.

This utility gathers information about rejected trades, including when they happened, which asset was involved, the strategy used, the position size, and why they were rejected.

You can use it to:

*   Get statistics like the total number of rejections, broken down by asset and strategy, allowing you to spot patterns and potential issues.
*   Generate detailed reports in Markdown format. These reports provide a clear overview of each rejection event with key details.
*   Save those reports to files so you can easily share them or keep a record of your risk management activity.

Essentially, RiskUtils provides a way to track and understand your risk control performance, making it easier to improve your trading strategies and risk management rules.

## Class RiskSchemaService

The RiskSchemaService helps you keep track of your risk schemas in a safe and organized way. It uses a special type-safe system to store these schemas, ensuring they are consistent and reliable.

You can add new risk profiles using the `addRisk()` function (represented as `register` in the code), and easily find them later by their names using the `get()` method. 

Before adding a new risk schema, the `validateShallow()` function quickly checks if it has all the necessary components in the right format. If you need to make changes to an existing risk schema, the `override()` function lets you update specific parts of it without replacing the whole thing. This service essentially acts as a central hub for managing and retrieving your risk schemas.

## Class RiskReportService

This service is designed to keep a record of when risk management prevents a trade from happening. It acts like a watchful observer, catching every instance where a signal is rejected by the risk system. 

Think of it as a logbook for risk events, recording not just that a trade was blocked, but also *why* it was blocked, along with details about the signal that was rejected. This information is then stored for later review and analysis, allowing you to understand and improve your risk management process.

To get it running, you subscribe to the risk rejection signals. This automatically prevents you from accidentally subscribing multiple times. When you're finished, you can unsubscribe to stop receiving those signals, ensuring clean operation.

## Class RiskMarkdownService

The RiskMarkdownService helps you automatically create reports detailing risk rejections in your trading system. It listens for risk rejection events and organizes them by symbol and strategy, allowing you to see exactly which trades were rejected and why.

This service generates nicely formatted Markdown reports, making it easy to review and understand rejection patterns. You'll get statistics like the total number of rejections, broken down by symbol and strategy, providing a quick overview of potential issues.

The reports are saved to disk, making them readily available for analysis and record-keeping. You can also clear the accumulated data when it’s no longer needed, or selectively clear data for specific trading setups. The service keeps data separate for each symbol, strategy, exchange, frame and backtest configuration, ensuring that your reports are organized and accurate.

## Class RiskGlobalService

This service acts as a central point for managing and enforcing risk limits within the trading framework. It's essentially a gatekeeper, ensuring that trades adhere to predefined rules before they're executed.

It works closely with a connection service to validate risk configurations, and it caches these validations to speed things up.  You'll find it’s used behind the scenes by both the trading strategies and the public-facing API.

The `checkSignal` function is the key piece - it’s what decides whether a trading signal is permitted based on the current risk limits.  There are also methods for registering new signals (`addSignal`) and cleaning up closed ones (`removeSignal`), keeping the risk system up-to-date. Finally, there’s a `clear` function that allows you to reset the entire risk system or just parts of it, which is useful for testing or resetting conditions.

## Class RiskConnectionService

The RiskConnectionService acts as a central hub for managing risk checks within the trading system. It intelligently routes risk-related operations to the specific risk implementation that's responsible for a particular trading scenario. To make things efficient, it remembers previously used risk implementations, so it doesn't have to recreate them every time – this is called memoization.

Think of it like this: whenever a trading signal needs to be validated against risk limits, this service figures out which set of rules applies (based on factors like the exchange and timeframe) and handles the check.

Here's a breakdown of what it does:

*   **Routes risk checks:** It directs requests to the correct risk implementation, identified by a `riskName`.
*   **Optimizes performance:** It stores frequently used risk implementations in a cache to avoid unnecessary re-creation.
*   **Validates signals:** It performs checks on things like portfolio drawdown, symbol exposure, and position limits to make sure signals are safe to execute.
*   **Manages signals:**  It keeps track of opened and closed trading signals within the risk management system.
*   **Provides cleanup:** You can clear the cached risk implementations when they're no longer needed.

If a strategy doesn’t have specific risk settings, the `riskName` will be blank.

## Class ReportUtils

ReportUtils helps you control which parts of your backtesting or trading system generate detailed logs. Think of it as a way to turn on and off specific data collection for things like backtest runs, live trading, or performance analysis.

The `enable` function lets you choose which logging features to activate – perhaps you only want logs for backtests and performance metrics. When you use `enable`, it sets up the logging for those areas and gives you a special function to turn everything off later. It's really important to use that "unsubscribe" function to avoid problems with your program’s memory.

On the other hand, `disable` lets you stop logging for certain areas without affecting others. This can be useful if you want to temporarily reduce the amount of data being logged.  It doesn’t require a cleanup function because it stops the logging immediately.

## Class ReportBase

The `ReportBase` class provides a simple way to log events and data as JSONL files, which are useful for analyzing trading strategies and backtests. Think of it as a system for neatly organizing your backtesting results into files.

It creates a single file for each report type, writing data as individual lines in a JSON format.  It’s designed to handle large amounts of data efficiently and includes built-in protections like timeouts to prevent issues during the writing process.

The class automatically sets up the necessary directories and handles errors safely. You can also easily search through these reports later, using things like the trading symbol, strategy name, or exchange.

You start by giving it a name for the report (like "trades" or "orders") and a base directory where the files will be saved. Then, you simply call the `write` method to add your data, and it takes care of the rest. It’s meant to be easy to use for both logging data and performing post-processing analytics.

## Class ReportAdapter

The ReportAdapter helps you manage and store your trading data, like backtest results or live trade information, in a structured way. Think of it as a central hub for sending your data to different storage locations. It's designed to be flexible, allowing you to easily swap out how your data is stored without changing your core trading logic.

It keeps track of your storage configurations, ensuring you're only creating one storage instance for each type of report (backtest, live trades, etc.) to keep things efficient. By default, it uses a simple JSONL format for saving data, but you can easily switch to other storage methods if you need to. The system initializes storage only when data is first written, making it lazy and efficient. Plus, it provides a “dummy” adapter which is useful for testing, as it effectively discards any data you try to write. Finally, you can change the storage adapter used at any time to adapt to different needs.

## Class PriceMetaService

PriceMetaService helps you reliably get the current market price for a trading strategy, even outside of the normal tick processing flow. It keeps track of prices for each symbol, strategy, exchange, and timeframe combination, ensuring you always have the most up-to-date information. Think of it as a handy price lookup service that avoids stale data by automatically refreshing prices as the strategy runs.

It remembers the latest price for each combination in a special cache, updating it after every tick. If you need the price while the strategy isn't actively processing a tick, you can ask PriceMetaService directly. If a price hasn't been received yet, it will wait a short time to ensure you get a valid value. 

You can also clear the price cache if you want to free up memory or make sure you’re starting with fresh data, for instance, at the beginning of a new backtest or trading session. The service is designed to be easy to use and handles the details of keeping track of prices automatically, so you don't have to worry about it.

## Class PositionSizeUtils

This class is designed to help you figure out how much of an asset to trade, using different strategies. It offers several built-in methods for calculating position sizes, like using a fixed percentage of your account, applying the Kelly Criterion (a more advanced method for maximizing growth), or basing the size on Average True Range (ATR) to account for volatility.

Each of these methods takes into account factors such as your account balance, the price of the asset, and other relevant data. The class automatically checks to make sure the information you provide is appropriate for the sizing method you've chosen.

Essentially, it's a toolbox for determining the right position size to manage risk and potentially optimize your trading results.


## Class PersistStorageUtils

This class provides tools for saving and loading signal data, ensuring your trading strategies retain their state even if things go wrong. It handles the complexities of storing signal information reliably, abstracting away the details of file management.

It intelligently manages storage instances and can be customized to use different storage methods. You can even plug in your own adapters to tailor the persistence behavior.

The `readStorageData` function loads previously saved signal data, bringing a paused backtest or live strategy back to where it left off. Conversely, `writeStorageData` makes sure changes to your signals are safely stored to disk, using a method that minimizes the risk of data loss. Each signal gets its own file, making organization and recovery easier.

For development and testing, you can use a dummy adapter to temporarily disable persistence. The `useJson` function provides a simple way to switch to the default JSON storage format.

## Class PersistSignalUtils

The PersistSignalUtils class helps manage how signal data is saved and loaded, especially for trading strategies. It ensures that signal states are reliably stored, even if there are unexpected interruptions. 

Think of it as a system for remembering a strategy's decisions.

It uses a clever way to keep track of storage instances, allowing for flexibility in how that storage is handled, including custom methods.  You can even swap in different storage methods, like using JSON files or a dummy adapter that doesn’t actually save anything (useful for testing!). 

The `readSignalData` function retrieves saved signal information, while `writeSignalData` carefully saves new signal data, preventing data loss with special atomic write operations. This is critical for preventing corruption. ClientStrategy relies on these functions to initialize and update signal state.

## Class PersistScheduleUtils

PersistScheduleUtils helps manage how scheduled signals are saved and restored, particularly for trading strategies. It keeps track of storage for each strategy, allowing for different ways to store the data if needed. 

The system makes sure that saving and loading scheduled signals is done reliably, even if there are interruptions. It's a critical part of how ClientStrategy handles live trading and ensures that signals aren't lost.

You can customize how data is stored by registering your own persistence adapter, or you can easily switch back to the default JSON storage. For testing or debugging, a dummy adapter is also available that simply ignores any attempts to save data.

The `readScheduleData` method retrieves saved signal information, while `writeScheduleData` saves the current signal state to disk safely.

## Class PersistRiskUtils

The PersistRiskUtils class helps manage and save your trading positions, particularly when dealing with risk profiles. Think of it as a reliable way to keep track of your active positions so you don’t lose progress, even if something unexpected happens.

It uses a clever system to store this information efficiently, remembering the storage settings for each risk profile. You can even customize how this information is stored by using different adapters, or switch back to the standard JSON format.

This class is crucial for ensuring your positions are restored correctly when your system restarts and provides a safety net with its crash-safe mechanisms. It's primarily used by ClientRisk to maintain a consistent trading state.

You can use it to switch between different persistence methods, including a "dummy" adapter that’s useful for testing purposes, as it simply ignores any write operations.

## Class PersistPartialUtils

This class, PersistPartialUtils, helps manage and save partial profit and loss information, which is crucial for keeping track of your trading progress. It ensures that this data is stored reliably, even if something unexpected happens. 

The system cleverly uses a unique identifier for each combination of trading symbol, strategy name, and signal ID to organize the stored data. You can also customize how this data is stored by using different adapters.

To retrieve stored partial data, the `readPartialData` method fetches it, returning an empty object if no data is found. The `writePartialData` method saves changes to this data, employing atomic operations to safeguard against data corruption during crashes.

If you want to experiment or bypass data persistence, you can switch to a dummy adapter using `useDummy`, which effectively ignores any save attempts. Alternatively, you can use `useJson` to default to standard JSON storage, or provide your own persistence adapter using `usePersistPartialAdapter`.

## Class PersistNotificationUtils

This class helps manage how notification information is saved and loaded, making sure it’s reliable even if things go wrong. It's the behind-the-scenes engine used by other parts of the system to handle persistent notifications.

The system cleverly keeps track of storage instances and lets you customize how the data is stored. Notifications are stored individually as separate files, each identified by a unique ID. To ensure data safety, writing and reading operations are done in a special way that prevents data corruption if the system crashes. 

You can even swap in different storage methods – like using a custom adapter or switching back to the standard JSON format.  A dummy adapter is also available to simulate persistence without actually saving any data, which is helpful for testing. The `readNotificationData` function retrieves all saved notifications, while `writeNotificationData` ensures the data is safely written back to disk.

## Class PersistMeasureUtils

This class helps manage how cached data from external APIs is stored and retrieved persistently. It's like having a smart system that remembers API responses to avoid repeatedly fetching the same information. 

The system uses a unique identifier for each cached response, combining a timestamp and a symbol. You can even customize how the data is stored by plugging in different adapters. 

It makes sure that reads and writes to the cache are reliable, and it's designed to handle unexpected interruptions without losing data.

The `readMeasureData` method retrieves data based on a key and bucket, while `writeMeasureData` safely stores information to disk. 

You can swap out the storage mechanism with `usePersistMeasureAdapter` to use a custom solution, or easily revert to the built-in JSON adapter with `useJson`. If you just want to test things without actually saving data, `useDummy` acts as a "discard" adapter.

## Class PersistLogUtils

This class provides tools to reliably save and retrieve log data. It handles the persistence details behind the scenes, so you don't have to worry about low-level file operations. 

It keeps track of log entries, storing each one as a separate file identified by its unique ID. The system is designed to be crash-safe, protecting your log data even if unexpected errors occur.

You can customize how the logs are stored by registering different persistence adapters, or easily switch back to the default JSON format. There's even a "dummy" adapter available for testing, which simply ignores any write attempts. The `readLogData` function retrieves all saved logs, while `writeLogData` ensures changes are safely written to disk.

## Class PersistCandleUtils

This class helps manage and store candle data, which are essentially snapshots of market activity over a specific time period. It works by saving each candle as a separate JSON file, organized by the exchange, the traded asset (symbol), the time interval (like 1 minute or 1 hour), and the candle's timestamp.

To ensure data consistency, it checks if all the expected candles are present before returning cached data. If even one candle is missing, the entire cache is considered invalid and a fresh request is made.

The `writeCandlesData` method is responsible for saving the validated candles to the cache, ensuring that each write is atomic for data integrity. You can also customize how the data is persisted by using different adapters, like JSON or even a dummy adapter for testing purposes. The dummy adapter simply ignores all write attempts.

## Class PersistBreakevenUtils

This class helps manage and save the breakeven state of your trading strategies, ensuring your progress isn't lost. Think of it as a reliable memory for your trading setup. It automatically saves and loads data for each symbol and strategy you’re using, organizing it in a structured directory.

It's designed to be easy to use and customize, letting you plug in your own methods for storing data if you prefer something other than the standard JSON format. You can also temporarily disable saving altogether, useful for testing or development. The system makes sure data is saved safely, using a technique that prevents corruption. This ensures that your saved data is always consistent and recoverable. It handles creating the necessary directories and files as needed, so you don’t have to worry about that.

## Class PersistBase

PersistBase provides a foundational structure for saving and retrieving data to files, ensuring a reliable and consistent process. It’s designed to work with file-based storage, automatically handling potential issues like corrupted files and ensuring that writes are completed safely. This base class keeps track of where your data is stored and offers helpful functions for managing that data.

It automatically manages the directory where your data is stored and includes built-in checks to keep everything working correctly. You can use it to check if a particular piece of data exists, read data from storage, and write data back—all while benefitting from built-in error handling and retry mechanisms. It provides a way to list all the identifiers of the data you’re storing, sorted in a predictable order.

## Class PerformanceReportService

This service helps you keep an eye on how your trading strategies are performing by recording how long different parts take to run. It acts like a detective, listening for timing signals during your strategy's execution. 

These signals are then carefully logged into a database, which allows you to spot slowdowns and areas for improvement.  You can think of it as a way to fine-tune your strategies for maximum efficiency.

To get started, you’ll subscribe to these timing signals. When you're done, you can easily unsubscribe.  The system makes sure you don't accidentally subscribe multiple times, which could cause problems. It uses a dedicated logger to provide debugging output and tracks timing events to the database.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing by collecting and analyzing data. It listens for performance events, organizes them by strategy, and calculates important statistics like averages, minimums, maximums, and percentiles.

You can request the overall performance statistics for a specific trading setup (symbol, strategy, exchange, timeframe, and backtest type). It’s also capable of creating nicely formatted markdown reports that highlight potential bottlenecks in your strategy’s execution. These reports are saved to your logs directory.

The service handles subscription to performance events carefully, preventing accidental double-subscriptions and providing a way to stop listening. It also allows you to clear the accumulated performance data when needed. Finally, it uses a unique storage area for each combination of symbol, strategy, exchange, frame, and backtest to keep things organized.

## Class Performance

The Performance class helps you understand how your trading strategies are performing. It allows you to gather detailed statistics about a strategy's execution, broken down by different types of operations. You can see metrics like total execution time, averages, minimums, maximums, and even volatility to identify potential issues.

It also provides tools to create easy-to-read markdown reports that highlight areas where your strategy might be slow or inefficient. These reports display time breakdowns, detailed statistics, and percentile analysis. Finally, you can save these reports to your computer, making it simple to track performance over time and share results.

## Class PartialUtils

PartialUtils helps you analyze and understand partial profit and loss data generated by your trading strategies. Think of it as a tool to examine those little bits of profit and loss that happen before a trade is fully closed.

It gathers information about these partial events, like when they happened, what symbol was involved, and how much profit or loss occurred. This data is stored temporarily, and PartialUtils provides ways to access and view it.

You can request overall statistics like the total number of profit and loss events.  You can also create nicely formatted reports, presented as markdown tables, that detail each partial event, including important details like the signal ID and the current price at the time. Finally, it can save these reports directly to files on your computer for later review.


## Class PartialReportService

This service helps you keep track of partial trades, specifically when you take profits or losses before a position is fully closed. It listens for signals indicating partial profit or loss events and records these events, including the price and level at which they occurred. 

Think of it as a detailed log of every time you close out a portion of your trade. 

You can start receiving these signals by subscribing, which will give you a way to stop listening later. The service is designed to avoid accidental multiple subscriptions, ensuring you only process each partial exit event once. If you're no longer interested in tracking partial exits, you can unsubscribe to stop receiving these signals.

## Class PartialMarkdownService

The PartialMarkdownService helps you automatically create and save reports detailing your trading performance, specifically focusing on partial profits and losses. It listens for these events and keeps track of them for each symbol and strategy you're using.

The service generates easy-to-read markdown tables summarizing these events, along with overall statistics like total profit and loss. These reports are then saved to your computer in a structured directory.

You can subscribe to receive these events in real-time, and there’s a way to unsubscribe when you no longer need them.  There are also methods to retrieve all the data, generate a report, save it to disk, or completely clear the accumulated data – either for a specific trading setup or everything at once. The service uses a dedicated storage system for each symbol and strategy combination, ensuring data isolation.

## Class PartialGlobalService

The PartialGlobalService acts as a central hub for managing partial profit and loss tracking within the system. It’s designed to be injected into the ClientStrategy, providing a single point of access for these operations and ensuring consistent logging.  Think of it as a gatekeeper – it receives requests related to partial profits and losses, logs them for monitoring purposes, and then passes them on to the PartialConnectionService for the actual processing.

Several validation services are also integrated, confirming the existence of strategies, risks, exchanges, frames, and configurations before any actions are taken.  This helps to prevent errors and ensure the system is operating correctly.  The `validate` property memoizes these checks, avoiding repeated validation for the same setup.

Key functions like `profit`, `loss`, and `clear` handle the respective events, always logging at the global level before delegating the work to the connection service. This layered approach provides both centralized control and detailed auditing of all partial operations.

## Class PartialConnectionService

This service helps keep track of partial profits and losses for each trading signal. Think of it as a central manager for smaller, individual tracking components. It creates and manages these components, called `ClientPartial` instances, each responsible for a specific signal.

It intelligently reuses these `ClientPartial` components, so it doesn't create a new one every time – it remembers them and uses them again, which is efficient.  These components are linked to each signal using a unique identifier.

When a signal hits a profit or loss level, this service handles the process, making sure the relevant `ClientPartial` is updated.  It also cleans up the components when a signal is closed, ensuring resources aren’t wasted. The service uses a logger and emits events to keep everything organized and connected. It’s injected into the overall trading strategy to work seamlessly with other parts of the system.

## Class NotificationLiveAdapter

This component helps you manage and send notifications during your backtesting or live trading sessions. It’s designed to be flexible, allowing you to easily swap out different ways of handling those notifications without changing the core logic of your trading strategies.

Initially, it uses an in-memory storage for notifications, but you can switch to persistent storage on disk or even use a "dummy" adapter that effectively ignores notifications for testing purposes. 

You'll find methods to handle various events like signals, partial profits/losses, strategy commits, and errors, all of which are passed on to the currently selected notification adapter.  It also offers functions to retrieve all stored notifications or clear them out.  Changing the notification adapter is simple – just use the `useNotificationAdapter`, `useDummy`, `useMemory`, or `usePersist` methods to switch between different implementations.

## Class NotificationBacktestAdapter

This class, `NotificationBacktestAdapter`, is designed to manage notifications during backtesting, offering flexibility in how those notifications are handled. It acts as a central point for sending out various event notifications, like signals, profit updates, errors, and more, and allows you to easily switch between different ways of storing or processing them.

You can choose to store notifications in memory for quick, temporary tracking, persist them to disk for later review, or even use a dummy adapter to effectively silence all notifications during testing. The `useMemory`, `usePersist`, and `useDummy` methods provide convenient shortcuts for switching between these options.  Internally, it delegates the actual notification sending to a separate utility class, which can be swapped out if you need custom behavior. The `handleSignal`, `handlePartialProfit`, `handleError`, and similar methods are the core entry points for triggering those notifications. Finally, you can retrieve all stored notifications with `getData` or clear them with `clear`.

## Class NotificationAdapter

This component handles all your notifications, whether they’re from backtesting or live trading. It automatically keeps track of updates by listening for signals. You can easily get all your notifications, separating backtest data from live data, or clear them out entirely. To avoid problems with duplicate notifications, it makes sure subscriptions happen only once. It's designed to be simple to use and clean up after itself properly.

## Class MarkdownUtils

This class helps you control whether or not markdown reports are generated for different parts of your backtest-kit process. Think of it as a central switchboard for report generation.

You can selectively turn on markdown reporting for things like backtests, live trading, performance analysis, or even walkers, choosing exactly what you want to see detailed reports for. When you enable a service, it starts collecting data and preparing a markdown report, but be sure to "unsubscribe" when you're done to prevent memory issues.

Conversely, you can also disable markdown reporting for specific areas without affecting others, letting you fine-tune what's being tracked. This is useful if you only need reports for certain situations. Disabling a service immediately stops it from gathering data and generating reports.

## Class MarkdownFolderBase

This adapter helps you generate backtest reports as individual markdown files, neatly organized into separate folders. It’s designed for creating human-readable reports that you can easily browse and review manually. Each report gets its own .md file, and the file's location is based on the path and filename you specify. 

The adapter handles creating the necessary directories for you, so you don't have to worry about that. It’s the default choice for creating well-structured report directories.

The `waitForInit` method doesn't actually do anything because this adapter writes files directly; it doesn't need any setup steps.

The `dump` method is how you write the actual report content. You provide the markdown content and some options, and it creates the file in the designated location, automatically setting up any necessary folders.

## Class MarkdownFileBase

This class provides a way to write markdown reports as JSONL files, making them easier to process with other tools. It focuses on append-only writing to a single file for each report type, and it's designed to handle a large volume of data safely.

The adapter automatically creates the necessary directories and handles potential errors, ensuring that your reports are logged reliably. You can also filter these reports later based on criteria like symbol, strategy, or exchange using the included metadata.

It initializes the file and stream only once, even if you call the initialization function multiple times.  When you want to add a report, you simply pass the markdown content and some metadata, and the class takes care of formatting it correctly and writing it to the file, with built-in safeguards against timeouts and buffer issues. The complete path to the file is stored internally for easy access.

## Class MarkdownAdapter

This component provides a flexible way to manage markdown files used within the backtest-kit framework. It uses a pattern that allows you to easily switch between different storage methods, like saving each markdown file as a separate document or appending them to a single JSONL file. It cleverly remembers the storage you've set up, so you don't have to reconfigure it every time.

You can control which storage method is used by setting the `MarkdownFactory`, which determines how the markdown storage is created. It handles creating the storage automatically the first time you write data.

There are convenient shortcuts like `useMd()` which defaults to separate files, `useJsonl()` for a combined JSONL approach, and `useDummy()` for testing purposes where you don't want any data to be saved. It's designed to make managing and storing markdown data simple and adaptable.

## Class LoggerService

The `LoggerService` helps keep your backtesting logs organized and informative. It acts as a central point for logging messages throughout the backtest-kit framework. You can plug in your own logging system, or it will default to a basic "no-op" logger if you don't configure anything.

The service automatically adds useful context to each log message, like the strategy and exchange being used, as well as details about the specific trade execution. This means you won’t have to manually add these details yourself, making it easier to understand what's happening during your backtests.

It offers different logging levels—debug, info, warn—to categorize your messages.  You have the option to customize the logging behavior by setting your own `ILogger` implementation using the `setLogger` method. The `methodContextService` and `executionContextService` handle the context injection behind the scenes.

## Class LogAdapter

The `LogAdapter` lets you manage how your backtesting framework records information during a test. Think of it as a flexible system for handling logs. By default, it keeps logs in memory, but you can easily switch it to store them on disk, use a dummy logger that ignores everything, or even write them to a JSONL file.

The adapter pattern allows you to swap out different logging implementations without changing the core of your backtest code. You can choose between different storage backends to suit your needs, from simple in-memory logging to more persistent solutions.  The `useLogger` method allows you to completely customize the logging mechanism. It offers convenient shortcuts like `usePersist`, `useMemory`, and `useDummy` to quickly change the logging behavior.  The `getList` method allows to retreive all logged entries, and the `log`, `debug`, `info`, and `warn` methods provide different levels of logging detail.

## Class LiveUtils

This utility class provides tools for managing live trading operations, making it easier to run and monitor your strategies. It's designed to be a single, easily accessible point for live trading functionalities.

The `run` function is the main entry point, kicking off a live trading process that automatically recovers from crashes by saving and restoring its state.  Think of it as an endless loop that continuously executes your strategy. You can also run a trading process in the background using `background`, which is ideal for tasks like data persistence or callback execution without disrupting the main flow.

Need to know what’s happening? Functions like `getPendingSignal`, `getTotalPercentClosed`, and `getPositionAveragePrice` give you insight into the current state of your position. There’s also `getBreakeven` to check if a price target has been reached.

You can adjust the behavior of your live trading using functions like `commitPartialProfit` and `commitTrailingStop` which allow you to fine-tune how your position is managed in real-time.  `stop` lets you gracefully halt a live trading process.  Functions like `commitCancelScheduled` and `commitClosePending` let you manually intervene without stopping the entire process.

Finally, `getData` and `getReport` are invaluable for tracking performance and debugging. They provide summaries and detailed reports of your live trading activity.

## Class LiveReportService

This service helps you keep a real-time record of what's happening with your trading strategy as it runs. It captures every stage of a trade – from when it's just an idea (idle) to when it's open and active, and finally when it's closed.

Think of it as a detailed logbook that saves all the important information about each trade directly to a SQLite database. This allows you to monitor performance and analyze results while the strategy is actually trading.

To use it, you’ll subscribe to the live signal feed, and it’ll automatically log all the relevant events.  It prevents you from accidentally subscribing multiple times, which could cause problems.  When you're done, you can unsubscribe to stop the logging.  The service also has a built-in logger to help you troubleshoot any issues.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically generate reports about your live trading activity. It listens for every trading event—like when a strategy is idle, opens a position, is active, or closes a trade—and carefully records the details. These details are then organized into easy-to-read markdown tables that show you exactly what happened during your trades. 

The service also calculates useful statistics, such as win rate and average profit/loss. It saves these reports as markdown files in a dedicated log directory, making it simple to review and analyze your trading performance over time.

You can easily subscribe to receive these updates and unsubscribe when you're done. There are methods to retrieve the data, generate reports, save them to disk, and even clear out the accumulated data, providing you with full control over the reporting process. The service ensures that data is stored separately for each combination of symbol, strategy, exchange, frame, and backtest, keeping your reports well organized.

## Class LiveLogicPublicService

This service helps you run live trading strategies while making things easier to manage. It builds on top of another core service, automatically handling the necessary context like the strategy's name and the exchange it's trading on, so you don't have to pass it around manually.

Think of it as a continuous, never-ending stream of trading results – signals to open, close, or cancel trades.  It's designed to be robust, meaning if something goes wrong and the process crashes, it can recover and pick up where it left off. It keeps track of progress using the current time, allowing for real-time updates.

To start a live trade, you simply specify the trading symbol and the service takes care of the rest, providing a seamless experience.

## Class LiveLogicPrivateService

This service handles the ongoing process of live trading, acting as a central coordinator. It continuously monitors market activity in an endless loop, checking for trading signals. 

Think of it as a tireless worker, constantly observing and reacting to the market. It delivers updates – specifically when trades are opened or closed – in a way that's efficient for other parts of your system to consume. If the process encounters a problem and stops, it automatically recovers and picks up where it left off. This service uses a streaming approach, so it avoids unnecessary memory usage, and it’s designed to run indefinitely. You provide the symbol you want to trade, and it streams back the trading results as they happen.

## Class LiveCommandService

This service is your gateway to executing live trades within the backtest-kit framework. Think of it as a simplified interface for accessing the core live trading logic. It’s designed to be easily used when you're setting up your application's dependencies.

It handles the complexities of running a live trading strategy, including managing connections and dealing with potential errors. 

The key function, `run`, is what kicks off the live trading process. You tell it which symbol you want to trade and provide some context – like the name of your strategy and the exchange you’re using.  It then continuously generates results, like whether a trade was opened, closed, or canceled, and automatically tries to recover if things go wrong.  This generator runs indefinitely until you stop it.

The service relies on other services like validation services and a logger to ensure everything runs smoothly and safely.

## Class HeatUtils

HeatUtils helps you visualize and understand how your trading strategies are performing across different assets. Think of it as a tool for creating and sharing performance reports that show you which symbols are contributing the most to your strategy's overall results. 

It gathers statistics like total profit/loss, Sharpe ratio, maximum drawdown, and trade counts for each symbol used by a strategy, then combines those into a single, easy-to-understand view. 

You can request this data programmatically, generate a formatted markdown report, or even save the report directly to a file. The class automatically handles collecting data and organizing it, so you don't have to write the complex logic yourself. It's designed to be a central, readily available resource for heatmap-related operations.

## Class HeatReportService

The HeatReportService helps you keep track of your trading activity by recording when your signals close, particularly focusing on the profit and loss (PNL) associated with those closures. It's designed to collect data across all your assets to give you a broad view of your portfolio’s performance.

The service works by listening for signal events and specifically logging the details of signals that have closed. It stores this information in a database, making it ready for generating heatmap visualizations that can help you analyze your trading patterns. 

To use it, you'll subscribe to receive these signal events; a special mechanism prevents you from accidentally subscribing multiple times. When you're done, you can unsubscribe to stop receiving the events. A logger is also included for debugging purposes.

## Class HeatMarkdownService

The Heatmap Service is designed to provide a clear, visual overview of your backtesting results, acting as a portfolio-wide dashboard. It gathers data from your trading strategies and symbols, constantly updating to show key performance indicators like profit/loss, Sharpe Ratio, and maximum drawdown. 

It creates separate, isolated storage for each exchange, timeframe, and backtest mode, ensuring your data is organized. You subscribe to the service to receive updates as your strategies run, and it handles calculations safely, even if there are unusual data points.

The service can generate easy-to-read markdown reports, allowing you to quickly analyze your portfolio's performance and share your findings.  You can also save these reports directly to disk.  Finally, it provides a way to clear the accumulated data when it's no longer needed, either for specific configurations or a complete reset.

## Class FrameValidationService

This service helps you keep track of your trading timeframes and make sure they’re set up correctly. Think of it as a central place to manage and verify your timeframes.

You can use it to register new timeframes, letting the service know about them. It also checks if a timeframe actually exists before you try to use it, preventing errors.  

To improve speed, it remembers the results of its checks, so it doesn't have to do the same validation repeatedly. Finally, you can easily get a list of all the timeframes you've registered.

## Class FrameSchemaService

The FrameSchemaService helps keep track of all your trading strategies' setups – think of them as blueprints. It uses a special system to ensure these blueprints are consistent and typed correctly, avoiding errors later on. 

You can add new blueprints using `register`, and update existing ones with `override`.  If you need to see a blueprint's details, simply use `get` and provide its name. The service also checks new blueprints to make sure they have the necessary components before they're officially saved. It's designed to organize and manage these strategy setups in a safe and reliable way.


## Class FrameCoreService

This service, `FrameCoreService`, handles the core logic for generating timeframes used in backtesting. Think of it as the engine that figures out *when* your trading strategies will run, based on the data you provide. It works closely with a connection service to fetch the timeframe data, and a validation service to make sure everything is correct. 

It’s a foundational component, automatically managed behind the scenes during backtesting. 

You'll primarily interact with it through the `getTimeframe` method, which takes a symbol (like "BTCUSDT") and a timeframe name (like "1m" for one-minute intervals) and returns a list of dates that define your backtest period.


## Class FrameConnectionService

The FrameConnectionService acts as a central hub for interacting with different trading frames, like daily or hourly data. It automatically directs your requests to the correct frame implementation based on the current trading context. 

To improve performance, it remembers which frames it has already created, so it doesn’t need to recreate them every time.

When running a backtest, it handles the timeframe – the start and end dates – allowing you to focus your analysis on specific periods.  In live trading, however, there are no specific frame constraints. 

Essentially, it simplifies how you work with frames, making sure you're using the right one and doing so efficiently. It retrieves frames using a method called `getFrame`, and provides a way to fetch timeframe boundaries with `getTimeframe`.

## Class ExchangeValidationService

This service acts as a central hub for keeping track of your trading exchanges and making sure they're set up correctly. It allows you to register new exchanges, effectively adding them to a managed list. Before you try to use an exchange in your backtesting, you can use this service to verify it's properly configured and exists. To speed things up, validation results are stored so they don't need to be repeated. Finally, you can easily get a complete list of all exchanges that have been registered within the system.

## Class ExchangeUtils

ExchangeUtils is a handy tool to help you work with different cryptocurrency exchanges within the backtest-kit framework. Think of it as a central place to get data like candles, order books, and trades, while ensuring everything is formatted correctly for each exchange. It’s designed to be easy to use, always available, and keeps things consistent across exchanges.

Specifically, you can use it to:

*   Retrieve historical price data (candles) for a symbol and time interval, automatically handling date calculations.
*   Calculate the volume-weighted average price (VWAP).
*   Make sure order quantities and prices are formatted according to each exchange’s specific rules.
*   Fetch order book data and aggregated trade history.
*   Get raw candle data, offering more control over the date range you want to query.

The system makes sure each exchange has its own independent set of data, avoiding conflicts.

## Class ExchangeSchemaService

This service helps you keep track of different exchange configurations in a safe and organized way. It acts like a central library for exchange schemas, ensuring they all have the necessary information.

You can add new exchange configurations using `addExchange()`, and easily find them later by their names.  The system uses a special type-safe storage mechanism for reliability.

Before a new exchange configuration is added, it’s quickly checked to make sure it has all the essential pieces in place.  If an exchange configuration already exists, you can update parts of it using `override()`. Finally, the `get()` method lets you retrieve a specific exchange configuration when you need it.

## Class ExchangeCoreService

The ExchangeCoreService acts as a central hub for interacting with exchanges, making sure all requests include important context like the trading symbol, the specific time, and whether it’s a backtest or live trade. It's built on top of other services to handle the complexities of communicating with different exchanges and injecting this necessary information.

This service provides a set of methods for retrieving data from exchanges, such as historical candles, order books, and aggregated trades.  It also has functions to format prices and quantities to be appropriate for a specific exchange.

When retrieving data, the `ExchangeCoreService` is mindful of whether it’s a backtest or live simulation, adjusting its behavior accordingly.  It also caches validation results to avoid repeated checks, optimizing performance.  Furthermore, the data fetching methods allow you to specify date ranges and limits, making it versatile for different use cases.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently directs requests to the correct exchange based on your current context, making it easy to work with multiple exchanges without repetitive setup. It keeps a memory of previously used exchanges to speed things up and provides logging to track what's happening behind the scenes.

You can retrieve historical candle data (like open, high, low, close prices) for a specific trading pair and timeframe, or request the next set of candles to progress through a backtest or keep a live trading system updated. It can also fetch the current average price, format prices and quantities to adhere to exchange-specific rules, and obtain order book and aggregated trade data.  The service handles details like date ranges for historical data and formatting prices correctly based on the exchange's requirements.

## Class ConstantUtils

This class provides a set of constants used for setting take-profit and stop-loss levels in your trading strategies. These levels are calculated using a method based on the Kelly Criterion, designed to optimize risk and reward. Think of them as pre-defined percentages of the total distance to your target profit or loss.

For example, TP_LEVEL1 represents a trigger point at 30% of the way to your final take-profit, allowing you to secure a portion of your gains early. Similarly, SL_LEVEL1 is an early warning sign at 40% of the way to your stop-loss, designed to reduce potential losses if the trade isn't performing as expected. The other levels (TP_LEVEL2, TP_LEVEL3, SL_LEVEL2) offer progressively more conservative exit points, ensuring you lock in increasing amounts of profit or minimize losses. 




You can use these constants directly within your trading logic to define your partial take-profit and stop-loss targets.

## Class ConfigValidationService

This service acts as a safety net for your trading configurations, making sure everything adds up mathematically and prevents potentially losing setups. It meticulously checks your global parameters, specifically looking for issues like negative percentages for things like slippage or fees.

It also ensures your take-profit distance is large enough to cover all costs, guaranteeing a profit even when the take-profit is reached.  Beyond that, it verifies that ranges make sense – like stop-loss distances being properly related – and confirms that time-related settings and candle data requests are using valid positive numbers. Essentially, it’s designed to catch common configuration errors before they lead to unexpected problems in your backtests.

The `validate` function performs these checks, giving you a quick way to confirm your settings are sound. It’s a key tool for building robust and reliable trading strategies.

## Class ColumnValidationService

The ColumnValidationService helps ensure your column configurations are set up correctly and avoid problems later on. It checks your column definitions against a specific set of rules, making sure everything is consistent and valid. 

Specifically, it verifies that each column has the essential properties like a unique key, a descriptive label, a formatting function, and a visibility function. The service also confirms that keys are unique across all your columns. It’s designed to catch common errors in your column setup, making sure your data displays and behaves as expected. 

The `validate` method performs these checks on all your column configurations. The `loggerService` property lets the service report any issues it finds, allowing you to quickly identify and fix configuration errors.

## Class ClientSizing

This component, ClientSizing, helps determine how much of your assets to allocate to a trade. It's designed to be flexible, allowing you to choose from several sizing methods like fixed percentages, Kelly Criterion, or using Average True Range (ATR). You can also set limits on the minimum and maximum position size, as well as a maximum percentage of your portfolio that can be used for any single trade. It also supports callbacks, letting you add custom validation and logging for extra control and insight into the sizing process. Ultimately, ClientSizing ensures your strategy executes with carefully considered position sizes. 

The `calculate` method is the core function - it's what actually computes the position size based on the parameters you've configured.

## Class ClientRisk

ClientRisk helps manage risk across your trading strategies, ensuring you don’t exceed pre-defined limits. It's like a safety net for your portfolio.

This system keeps track of all open positions across different strategies, allowing it to consider the overall risk exposure. It prevents signals that might violate those limits, such as exceeding the maximum number of positions you can hold.

You can even create custom risk checks that look at all your active positions to enforce more specific rules.

ClientRisk is designed to work with multiple strategies simultaneously, providing a comprehensive view of your risk. It’s built into the backtesting framework to automatically validate signals before trades are executed.

It manages a record of active positions which it periodically saves and loads. During backtesting, this persistence is skipped for performance reasons.

The `checkSignal` method evaluates each trading signal against your risk rules and callbacks are triggered based on the result.

When a new signal is opened, `addSignal` registers it; and when a signal is closed, `removeSignal` updates the records.

## Class ClientFrame

The `ClientFrame` is like a time machine for your backtesting, helping you create sequences of dates and times for your trading strategies. It's designed to efficiently generate these timeframes, avoiding unnecessary repetition by caching the results. You can customize the interval between these timestamps, ranging from one minute to three days. 

It’s a core component used by the backtesting engine to move through historical data.

The `getTimeframe` function is its main feature – it creates the timeframe array for a specific trading symbol. Think of it as saying, "give me the dates and times for this asset's history." The results are stored for later use, making the process faster.

## Class ClientExchange

This component, `ClientExchange`, acts as a bridge, giving your backtesting system access to real-world exchange data. It handles fetching historical and future candle data – think of it as retrieving the price history and looking ahead to simulate trading. It also provides handy functions to calculate VWAP (a volume-weighted average price) and format quantity and price data according to specific exchange rules, ensuring your simulated trades align with real-world conventions.

Here's a breakdown of what it does:

*   **Candle Data Retrieval:** Easily fetch past and future price data (candles) for specific symbols and time intervals. This is crucial for recreating market conditions during backtesting.
*   **VWAP Calculation:** Quickly calculate the Volume Weighted Average Price, a vital indicator for many trading strategies.
*   **Formatting:** Ensures your trade quantities and prices are formatted correctly, as required by the target exchange.
*   **Flexible Data Fetching:** `getRawCandles` provides a lot of control, letting you specify start and end dates or limits for the data you retrieve.
*   **Order Book Access:** Get a snapshot of the current order book for a trading pair.
*   **Aggregated Trades:** Retrieve a history of aggregated trades, useful for analyzing market activity.

The whole system is designed to be efficient and prevent "look-ahead bias," which is a common pitfall in backtesting – making sure your simulations are based on historical data only. Essentially, it’s a powerful tool for accurately simulating trading scenarios.

## Class ClientAction

The `ClientAction` component is designed to manage and execute custom action handlers within your trading strategies. Think of it as a central hub that takes care of setting up, routing events, and cleaning up after your action handlers do their work.

It automatically handles the creation of your action handler based on provided parameters, ensuring it's initialized only once. You can also rely on it to safely dispose of the handler when it’s no longer needed, preventing resource leaks.

This component then directs various events – like signals from live or backtest modes, breakeven notifications, partial profit or loss triggers, and scheduled pings – to the appropriate methods within your handler.  It’s particularly useful for integrating external systems for things like logging, notifications, analytics, or managing state within your strategies.

There are separate methods for handling events specific to live trading (`signalLive`), backtesting (`signalBacktest`), and more specialized scenarios like breakeven, partial profit/loss, and risk rejections.  The `signalSync` method is a crucial gate for managing position adjustments using limit orders, so be mindful of error handling within your associated functions.

## Class CacheUtils

CacheUtils is a handy tool for speeding up your backtesting processes by automatically caching the results of functions. Think of it as a way to avoid recalculating things you've already figured out.

It's designed to be simple to use – just wrap your functions with either the `fn` or `file` methods.  The `fn` method is for functions that return regular values and automatically invalidates the cache based on timeframe intervals.  The `file` method goes a step further by storing the cached results in files, so they persist even when your backtest ends.  Each function gets its own private cache, ensuring that changes in one function don't interfere with others.

If you need to refresh the cached data, you can use `clear` to remove the cached values just for the current test run or `flush` to completely clear the cache for a function, which is useful when the function itself has changed.  To keep memory usage under control, `gc` periodically cleans up expired cache entries.

## Class BrokerBase

This class, `BrokerBase`, is designed to help you connect your trading strategies to actual exchanges. Think of it as a template – you extend this class to create a bridge between your strategy and a specific broker like Binance or Coinbase. It handles all the nitty-gritty details of sending orders, updating stop-loss levels, and managing your positions, freeing you to focus on strategy development.

The class provides ready-made, "no-op" implementations for all common brokerage actions, so you don't *have* to write anything unless you need to customize something. It automatically logs everything happening, giving you visibility into the trading process.

Here's how it works:

1.  **Initialization:** When your strategy starts, you use `waitForInit()` to connect to your exchange, log in, and load any necessary configuration.
2.  **Event Handling:** As your strategy executes, events trigger specific methods like `onSignalOpenCommit` (for opening positions), `onSignalCloseCommit` (for closing positions), and others for partial profits, loss management, and DCA entries. These methods are your hooks for interacting with the external broker.
3.  **No Cleanup Required:**  You don't need to worry about manually closing connections; the framework handles that.



It’s structured to be easily customizable. By extending `BrokerBase`, you can integrate your strategy with various exchanges, handle trade notifications (like sending alerts via Telegram), and record trades for analysis.

## Class BrokerAdapter

The `BrokerAdapter` acts as a crucial intermediary between your trading strategy and the actual broker. Think of it as a gatekeeper that ensures all trading actions are properly handled and controlled. It's designed to prevent errors and maintain the integrity of your trading state, particularly when switching between backtesting (simulated trading) and live trading.

During backtesting, the `BrokerAdapter` essentially ignores trading commands – it allows you to test your strategies without actually placing orders. However, when you’re live trading, it forwards those commands to your registered broker.

It automatically handles signal open and close events, routing them to the broker.  Other actions like partial profit/loss adjustments, trailing stops, take profits, breakeven orders, and average buy entries are intercepted and validated *before* they impact your core trading logic. If any of these commit actions fail, the changes to your trading state are rolled back – a safeguard against unexpected errors.

You need to register your broker adapter using `useBrokerAdapter` before enabling the adapter with `enable`.  `enable` activates the automated signal routing, and `disable` turns it off. It's important to understand that enabling without a registered broker will result in an error.

## Class BreakevenUtils

This class helps you analyze and report on breakeven events, providing insights into your trading strategies. It acts as a central point for getting statistics and creating reports based on data collected about when your positions reached breakeven.

You can use it to get statistical summaries of breakeven events for a specific symbol and strategy, which can highlight patterns or areas for improvement. 

It also allows you to generate detailed markdown reports that list all breakeven events in a clear, table format, including information like entry price, breakeven price, and timestamps. Finally, it can save these reports directly to files, making it easy to share your results or keep a record of your strategy’s performance. The class handles creating the necessary directories for storing the reports.

## Class BreakevenReportService

The BreakevenReportService helps you keep track of when your trading signals reach their breakeven point. It's like a dedicated recorder for those important milestones.

It listens for these "breakeven" moments and stores all the details – what signal it was, when it happened, etc. – into a database. This lets you review your past trades and see how your signals perform over time.

You can easily start and stop this service using the `subscribe` and `unsubscribe` methods. The `subscribe` method is designed to prevent accidental duplicate recordings, ensuring that you only log each breakeven event once. If you're done tracking, `unsubscribe` stops the recording process.

## Class BreakevenMarkdownService

This service is designed to automatically generate and save reports detailing breakeven events that occur during backtesting. It listens for these breakeven signals, keeping track of all events for each symbol and strategy combination. The service then turns this data into nicely formatted markdown tables, complete with helpful statistics like the total number of breakeven events.

You can subscribe to receive these breakeven events, and the service ensures you won't accidentally subscribe multiple times. When you're finished, you can easily unsubscribe.

The service also offers methods to retrieve the statistics and reports for specific symbol-strategy pairings, and to save the reports to disk in a structured folder layout. It provides a way to clear the accumulated data, either for a specific combination or a complete reset. Essentially, it takes the raw breakeven data and presents it in an organized and easily accessible report format.

## Class BreakevenGlobalService

This service acts as a central point for managing and tracking breakeven calculations within the system. It’s designed to be easily integrated into the ClientStrategy, making it a core dependency. Think of it as a middleman – it handles logging and validation before passing requests on to the actual connection service that manages the ClientBreakeven instance.

The service relies on other injected components for tasks like validating strategy configurations and retrieving data, making it modular and maintainable. You’ll find it’s used to ensure everything is in order before a breakeven calculation is performed, and to keep a record of those operations for monitoring purposes.

Key functions include `check`, which decides whether to trigger a breakeven event, and `clear`, which resets the breakeven state when a signal is closed.  Importantly, both of these functions log their actions globally before handing them off to the connection service for the actual processing.

## Class BreakevenConnectionService

This service helps keep track of breakeven points for your trading signals. It acts as a central manager, making sure you don’t create unnecessary instances of breakeven tracking objects. Think of it as a smart factory—it creates and handles these objects, remembering them for reuse until they're no longer needed.

The service is designed to work closely with your trading strategies, leveraging other services to manage actions and logging. When a signal comes in, it either reuses an existing breakeven tracker or creates a new one, ensuring consistent tracking.

It’s responsible for checking if a breakeven condition has been met and emits events to notify the system. When a signal is closed, it cleans up the tracking data and releases the resources. This system makes sure breakeven tracking runs efficiently and avoids memory issues.

## Class BacktestUtils

This class provides helpful tools to run and analyze backtests within the trading framework. It's designed to simplify the process of executing backtest commands and gathering data.

You can use it to kick off backtests for a specific symbol and strategy, either running them normally or in the background for tasks like logging. `run()` handles the core backtest execution, while `background()` lets you run tests without directly monitoring results.

Need to peek at the strategy's state? Functions like `getPendingSignal`, `getTotalPercentClosed`, and `getPositionAveragePrice` give you insights into things like the active signal, position details (cost, entry price, etc.), and potential profit/loss.

It’s also possible to directly control the backtest with methods like `stop` to halt a test, or `commitClosePending` and `commitCancelScheduled` to force actions on the trading strategy during the test.

Finally, you can gather performance statistics with `getData` or generate detailed reports using `getReport` and `dump`.  The `list()` method is useful to check the status of currently running tests.  Essentially, this class streamlines backtesting operations and provides a rich set of tools for examining strategy behavior.

## Class BacktestReportService

The BacktestReportService is designed to keep a detailed record of your backtesting strategy's actions, storing everything in a SQLite database. It listens for key moments in your strategy's lifecycle – when it's idle, when it opens a position, when it's actively trading, and when it closes a position. 

This service diligently captures all the information associated with these events, allowing you to analyze and debug your strategy's performance. You can easily subscribe to receive these events, and the system makes sure you don't accidentally subscribe multiple times. 

When you’re finished, simply unsubscribe to stop the data collection.  Essentially, it's your tool for thorough backtest auditing.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create reports about your backtesting results. It listens for signals during a backtest and keeps track of when those signals close.

It organizes this information into tables, making it easy to see details like entry and exit prices for each trade. These reports are automatically saved as markdown files in your logs directory.

You can use functions to get overall statistics, generate specific reports, or clear out all the accumulated data.

To use it, you'll need to subscribe to the backtest signal emitter so it can process events – think of it like tuning into the backtest's activity stream. When you're finished, you can unsubscribe to stop receiving those updates. The service also uses a special storage system to keep the data organized and separate for each strategy and timeframe you’re testing.

## Class BacktestLogicPublicService

This service helps you run backtests in a streamlined way. It takes care of automatically passing along important information like the strategy name, exchange, and frame to all the functions involved in the backtest process, so you don't have to manually include it every time. Think of it as a helper that manages the overall backtest process and makes sure everything has the context it needs.

It uses a private service underneath to do the actual backtesting work and adds a layer of automatic context handling. The `run` method is your main entry point - you give it a symbol and it sends back a stream of results as the backtest progresses. 


## Class BacktestLogicPrivateService

This service handles the core logic of running backtests in a memory-efficient way. It works by fetching the necessary timeframes and then processing them one at a time, rather than collecting everything into a large array. 

The process involves getting timeframes, evaluating ticks, and when a trading signal opens, retrieving historical data and running the backtest calculations.  The service will then skip forward in time until the signal closes, and yields a result indicating a closed trade.  

You can stop the backtest at any point by breaking out of the generator that's producing the results. Essentially, it's designed to give you a continuous stream of backtest results as they happen, which can be helpful for very long backtest periods.

The service relies on several other services, including ones for logging, strategy core functionality, exchange interactions, timeframe management, method context, and action handling. The `run` method initiates the entire backtesting process for a specified symbol.

## Class BacktestCommandService

This service acts as a central point for running backtests within the system. It’s designed to be easily integrated into different parts of your application using dependency injection. Think of it as a simplified interface to the core backtesting engine.

It relies on several other services for things like validating strategies, exchanges, and the overall backtest setup. 

The main thing you'll use is the `run` function.  This function starts the backtest process for a specific trading symbol, providing details like the strategy name, exchange, and frame being used to guide the simulation. It returns a stream of results, giving you updates on how the backtest is progressing.

## Class ActionValidationService

The ActionValidationService helps you keep track of and confirm that your trading actions are properly set up. Think of it as a central manager for all your action handlers, ensuring they're present and ready to go before your backtest runs. You register your action handlers using `addAction`, and then `validate` confirms each one exists. This service also remembers its validation checks, so it’s fast and efficient, avoiding repetitive checks. Finally, if you need to see what actions are registered, `list` provides a simple way to view them all.

## Class ActionSchemaService

The ActionSchemaService helps you keep track of your actions, ensuring they are structured correctly and safe to use. Think of it as a central place to define and manage the blueprints for how your actions work.

It uses a type-safe registry to store these blueprints, which helps prevent errors. Before an action blueprint is accepted, it verifies that the actions it defines (methods) are allowed and follow specific rules.

You can register new action blueprints, update existing ones with just the changes needed, and retrieve the full configuration when you need it. This makes it easy to manage and modify how your actions function without having to recreate everything from scratch. The service also allows for private methods, making your code more organized.

## Class ActionProxy

The `ActionProxy` acts as a safety net when your custom trading strategies are running. It essentially wraps your code, ensuring that any errors that occur within your strategy's logic don't crash the entire backtesting or live trading system. Think of it as a protective layer around your strategy’s functions.

It handles events like signal generation, profit/loss updates, scheduled actions, and more, all while diligently catching errors and logging them.  If an error occurs within one of these functions, the `ActionProxy` will record the problem, notify the system, and continue execution – preventing a complete system failure.

You don’t directly create `ActionProxy` instances; instead, you'll provide a partial implementation of `IPublicAction`, and the system will use `fromInstance` to automatically wrap it with this protective layer. The `fromInstance` method guarantees that any methods you've provided will be executed with this error-handling in place, making your strategies more robust and easier to debug.  The `signalSync` function is a special case – errors here are intentionally passed on to help with debugging the order execution process. Finally, the `dispose` function allows for cleanup, also guarded against errors.


## Class ActionCoreService

The `ActionCoreService` is a central hub for managing how strategies execute actions. It's responsible for orchestrating the process of getting action lists from strategy definitions and then making sure each action gets triggered correctly.

Think of it as a traffic controller, ensuring actions happen in the right order and with the right data. It validates everything – from the strategy itself to the actions it's supposed to perform – to prevent errors.

Here's a breakdown of what it does:

*   **Initialization:** It sets up all the individual action components when a strategy starts.
*   **Signal Routing:** It distributes events (like market ticks, breakeven alerts, or scheduled pings) to the appropriate actions based on the strategy's configuration. There are specific functions for backtesting, live trading, and other event types.
*   **Validation:** It performs checks to confirm that the strategy and its components are configured correctly. This validation is cached to avoid unnecessary repetition.
*   **Disposal:** When a strategy finishes, it cleans up all the actions, ensuring no lingering resources.
*   **Synchronization:**  It handles coordinated actions that need to happen across all parts of a strategy.
*   **Clearance:** It provides a way to reset action-related data, either for a single action or globally.

It relies on several other services, like a logger and various validators, to do its job effectively. The service is a key component behind the scenes, powering the execution of trading strategies.

## Class ActionConnectionService

The `ActionConnectionService` acts as a central dispatcher for different actions within your trading strategies. It ensures that the correct action handler is called based on the action's name, the strategy being used, and the exchange and frame context.

Think of it as a smart router that figures out where to send incoming events.  It avoids repeatedly creating the same action handlers by caching them, making things more efficient.

Here’s a breakdown of what it does:

*   **Action Routing:** It uses the `actionName` parameter to direct events to the right `ClientAction` implementation.
*   **Caching:** It keeps a record of these `ClientAction` instances to prevent unnecessary creation, speeding up the process. The cache is keyed by action name, strategy name, exchange name, and frame name, allowing for isolation of actions for each strategy and frame combination.
*   **Event Handling:**  It provides specialized methods like `signal`, `signalLive`, `breakevenAvailable`, and others to route different types of events (like price updates, breakeven triggers, and scheduled pings) to the appropriate `ClientAction`.
*   **Initialization and Cleanup:** It handles the initial setup of `ClientAction` instances (`initFn`) and ensures proper cleanup (`dispose`, `clear`) when they're no longer needed. The `clear` function is particularly useful for releasing resources.
*   **Synchronization:** `signalSync` handles a special type of signal, designed to be tightly coupled with the creation process and any errors will pass through.

## Class ActionBase

This base class, `ActionBase`, is designed to make creating custom actions for your backtest kit strategies much easier. Think of it as a starting point for adding your own logic to manage things like notifications, data logging, or even integrating with external systems. It handles the basic setup and logging for you, so you only need to focus on your unique functionality.

When you extend this class, you'll get default behaviors for a variety of events like signals, breakeven adjustments, profit milestones, and risk rejections, all conveniently logged. You'll also have access to information about the strategy, frame, and the specific action being executed, allowing for context-aware processing.

The lifecycle is straightforward: Initialization happens during `init()`, events fire during execution via methods like `signalLive` (for live trading) and `signalBacktest` (for backtesting), and cleanup occurs during `dispose()`. You can override these methods to customize how your action behaves and ensure proper resource management. Essentially, it’s a well-structured way to plug custom behaviors into your trading strategy, providing defaults and logging to simplify the process.
