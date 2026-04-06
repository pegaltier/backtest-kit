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

The WalkerValidationService helps you keep track of and double-check your parameter sweep setups, often called "walkers," which are used for things like optimizing trading strategies or fine-tuning model settings. It acts like a central directory for these walkers, remembering their configurations.

Before you start running a test or experiment using a walker, this service makes sure that the walker you're referring to actually exists – preventing errors and making sure everything runs smoothly. 

To make things quicker, it remembers the results of past validations, so it doesn't have to re-check everything every time.

You can register new walkers using `addWalker`, confirm a walker's existence with `validate`, and see a complete list of your registered walkers with `list`. The service also uses a logger to help you track what's happening.

## Class WalkerUtils

WalkerUtils provides helpful tools for working with walkers, which are essentially automated trading strategies. It simplifies running and managing these strategies by handling details like logging and automatically identifying relevant information from the walker’s configuration.

You can think of it as a central place to start, stop, and monitor your walkers.

Here’s what it lets you do:

*   **Run walkers:** Easily execute walkers for specific trading symbols and provide additional context.
*   **Run walkers in the background:** Start walkers without waiting for results, which is perfect for tasks like logging or triggering other actions.
*   **Stop walkers:** Halt the generation of new trading signals from a walker, allowing existing signals to finish gracefully. This can be targeted to specific walkers.
*   **Retrieve results:** Access comprehensive data and reports from the walker's strategy comparisons.
*   **Generate reports:** Create formatted reports summarizing walker performance, and save them to a file.
*   **List walkers:** View a list of all running walkers and their current status.

WalkerUtils acts as a convenient, single point of access to manage these automated trading processes.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of different schema definitions for your walkers, ensuring they're all structured correctly. It uses a special system to store these schemas in a type-safe way.

You can add new walker schema definitions using the `addWalker` function (or `register` property).

To find a specific schema, you simply ask for it by name using `get`.

If you need to update an existing schema, the `override` function allows you to make partial changes.

Before a new schema is added, `validateShallow` quickly checks to make sure it has the basic required information and types.

## Class WalkerReportService

This service helps you keep track of how your trading strategies are performing during optimization. It listens for updates from the optimization process and saves those results—things like metrics and statistics—into a database. 

Think of it as a detailed record keeper for your strategy experiments.

You can subscribe to receive these updates, but the system ensures you won't accidentally subscribe multiple times. When you're finished, you can unsubscribe to stop receiving the updates. The service also manages keeping track of the best performing strategies and overall progress of the optimization.

## Class WalkerMarkdownService

This service helps you automatically create and save detailed reports about your trading strategies as they run. It listens for updates from your trading simulations, collecting data about how each strategy performs.

It organizes results separately for each trading strategy (walker), making it easy to compare them. The service then transforms this data into neatly formatted markdown tables. 

You can then save these reports to your computer's file system. 

Here's a breakdown of what it does:

*   **Subscription:** It allows you to connect to the trading simulation to receive progress updates. You can easily stop this connection when you no longer need it.
*   **Data Accumulation:** It stores the simulation results, ensuring that data is efficiently organized and accessible.
*   **Report Generation:** It builds tables that compare the performance of your strategies.
*   **Report Saving:** It automatically saves the generated markdown reports in a structured folder.
*   **Clearing:** It provides a way to erase all accumulated data or just data from a specific strategy.

## Class WalkerLogicPublicService

This service helps manage and run "walkers," which are essentially automated trading strategies. Think of it as a conductor orchestrating different parts of your backtesting process. It automatically passes along important information like the strategy's name, the exchange being used, and the timeframe of the data, so you don't have to manually manage that.

It builds upon a private service (`WalkerLogicPrivateService`) to simplify things.

You can use the `run` method to kick off a comparison of walkers for a specific stock symbol. This method takes the symbol and context information and returns a sequence of results, allowing you to analyze and understand how different walkers perform. It's designed to execute backtests across all your strategies.


## Class WalkerLogicPrivateService

The WalkerLogicPrivateService helps manage and compare different trading strategies. It acts as an orchestrator, running each strategy one at a time and providing updates as they finish.

You'll receive progress notifications as each strategy completes its backtest. 

The service also keeps track of the best-performing strategy in real-time during the process.

Finally, it delivers a complete report ranking all the strategies based on their performance.

Internally, it relies on the BacktestLogicPublicService to actually execute the individual trading strategies. 

The service uses several other components including a logger, markdown generator, and schema service to facilitate its operations.

## Class WalkerCommandService

WalkerCommandService acts as a central point for interacting with the walker functionality within the system. It's designed to be easily integrated into your code using dependency injection.

This service bundles together several important components, including services for managing walker logic, schemas, validations for strategies, exchanges, frames, and walkers, and also risk and action validations.

The core of what it does is the `run` method, which lets you execute a walker comparison for a specific symbol. When you run a walker, you also provide context information like the walker's name, the exchange it's using, and the frame it operates within. This helps the walker understand its environment and operate correctly.

## Class TimeMetaService

TimeMetaService helps you keep track of the most recent candle timestamp for a specific trading setup – think of it as knowing exactly when the last candle closed for a particular symbol, strategy, exchange, and timeframe. It's especially useful when you need that information outside of the normal trading loop, like when executing a command between ticks.

Essentially, it stores these timestamps, providing them when you need them. If the timestamp isn't immediately available, it waits briefly to see if one arrives. 

This service is designed to be reliable, automatically updating as new ticks come in and even falling back on existing information when available within a trading execution. You can also manually clear the stored timestamps, which is important at the beginning of a new trading session to make sure you're working with fresh data. It's registered as a central service, automatically updated and managed by other components.

## Class SyncUtils

SyncUtils helps you analyze and understand what's happening during your trading signal lifecycle. It's like a reporting tool that gathers data from when a signal is opened (like a limit order being filled) to when it’s closed (a position being exited).

You can use it to get overall statistics about your signals, like the total number of opens and closes. 

It also creates easy-to-read markdown reports, essentially tables of all the signal events, including details like the signal ID, direction, entry and exit prices, and profit/loss information.  Finally, you can have these reports automatically saved as files. 

The data comes from events tracked by another service, storing up to 250 events for each combination of symbol, strategy, and other settings.

## Class SyncReportService

The SyncReportService helps track and record important moments in your trading signals. It focuses on two key events: when a signal is initially created (often when an order is filled) and when that signal is closed or exited.

Think of it as creating a detailed audit trail for your trading activity.

It listens for these events and meticulously records the details – for example, the signal's specifics when it’s created, and the profit/loss and reason for closure when it's exited. This information is then saved to a report file.

You can subscribe to receive these signal synchronization events, and importantly, the framework prevents you from accidentally subscribing multiple times. It also provides a way to unsubscribe when you no longer need to track these events. The service uses a logger to provide feedback during operation.

## Class SyncMarkdownService

This service is designed to create and save detailed reports about signal synchronization events, helping you understand how your trading strategies are performing. It listens for signal opening and closing events and organizes them by symbol, strategy, exchange, frame, and whether it's a backtest or live run.

The service builds reports as markdown tables, providing a clear view of the signal lifecycle.  You'll find statistics like total events, opens, and closes included in these reports, giving you a snapshot of activity. These reports are saved to disk in a dump/sync/ folder.

You can subscribe to receive these signal synchronization events; however, to avoid unnecessary re-subscriptions, the subscription is handled in a singleshot manner, providing a unique unsubscribe function.  Calling `unsubscribe` completely stops the service and clears all collected data.

The `tick` method processes each synchronization event, adding a timestamp and routing it to the correct storage location.  You can retrieve accumulated statistics using `getData` or generate a full report using `getReport`.  The `dump` method allows you to save the generated markdown report directly to disk with a specific naming convention. Finally, `clear` provides a way to delete all stored data or clear only specific data based on the provided parameters.

## Class StrategyValidationService

This service helps you keep track of and verify your trading strategies. Think of it as a central hub for your strategies, ensuring they're all set up correctly before you start trading.

It allows you to register new strategies, so you have a clear record of what's available. 

The service goes beyond just checking if a strategy exists; it also validates related elements like risk profiles and actions, giving you confidence that everything is aligned. 

To speed things up, it remembers the results of validation checks, so it doesn't have to re-check everything every time. You can see a full list of all registered strategies with a simple command. 

Here's a quick look at what you can do:
*   Add strategies using `addStrategy()`
*   Validate strategies using `validate()`
*   See all registered strategies using `list()`

## Class StrategyUtils

StrategyUtils helps you analyze and understand how your trading strategies are performing. It provides tools to gather information about strategy events, like when orders are canceled, profits are taken, or losses are managed.

You can use it to get statistical summaries of your strategy’s actions, like how many times it took profits versus how many times it hit stop-losses. It can also build detailed reports presented in a readable Markdown format, showing each event's specifics like the price, percentage changes, and timestamps.

Finally, you can easily save these reports to files, automatically creating the necessary folders if they don't exist, making it simple to track and review strategy performance over time. Think of it as a reporting and analytics hub for your trading strategies.

## Class StrategySchemaService

This service helps you keep track of your trading strategy blueprints. It acts like a central library where you store and organize different strategy designs. 

Think of it as a safe and organized place to manage all your strategy definitions.

You add new strategies using the `addStrategy` function (or, technically, the `register` property), and then find them again later by their names using `get`.

Before a strategy is added, a quick check (`validateShallow`) makes sure it has all the necessary parts in the right format.

If you need to update a strategy, you can use `override` to change specific parts of it without having to redefine the whole thing. This service relies on a system for managing types safely, ensuring consistency across your strategies.


## Class StrategyReportService

This service is designed to meticulously record important events happening during your trading strategy’s execution, creating a detailed audit trail. Think of it as a digital notebook that logs every key action your strategy takes, like canceling scheduled orders, closing pending positions, or taking partial profits.

To start logging these events, you need to "subscribe" to the service. Once subscribed, every action triggers a record that gets written as a separate JSON file – ensuring nothing gets missed. 

When you're done, "unsubscribe" to stop the logging process. It’s designed to be easy to use and safe – you can unsubscribe even if you haven't subscribed yet, and it won't cause any problems.

The service also provides specific functions to log different types of events – for example, `cancelScheduled` captures when a scheduled order is canceled, `partialProfit` logs when a portion of the position is closed at a profit, and `breakeven` tracks when the stop-loss moves to the entry price. Each of these functions receives detailed information about the event, like the symbol involved, the current price, and the strategy's performance metrics.


## Class StrategyMarkdownService

This service is designed to track and report on your trading strategy's actions, like cancels, closures, and profit/loss adjustments. It acts as a temporary memory for these events, gathering them before creating formatted reports.

Instead of writing each event immediately, it holds up to 250 events for each combination of symbol, strategy, exchange, and timeframe, optimizing for batch reporting.

To start using it, you need to subscribe to begin collecting data.  Then, methods like `cancelScheduled`, `closePending`, and `partialProfit` will automatically record relevant events.  You can retrieve the collected data using `getData` to get statistics or `getReport` to generate a readable markdown report. Finally, when you’re done, unsubscribe to stop collection and clear the accumulated data.

The service can provide overall counts of each action taken, and it allows for customizing the information displayed in the reports. You can also save those reports to a file. If you need to start fresh, you can clear the stored events.

## Class StrategyCoreService

This class, `StrategyCoreService`, acts as a central hub for managing strategy operations, particularly within a backtesting or live trading environment. It simplifies the process by automatically injecting relevant information like the trading symbol, the current timestamp, and backtest settings into the strategy's execution context. Think of it as a wrapper around other services to ensure everything runs smoothly and with the correct context.

It provides a wide range of functions for monitoring and managing a trading strategy's state, including retrieving pending signals, calculating position metrics like total cost and percentage closed, and validating various operations.  Many of these functions are designed to be used internally, providing a detailed view into the strategy’s performance and potential actions.

Key capabilities include:

*   **State Retrieval:** It provides methods to fetch information about the current pending signal, such as its cost basis, entry prices (useful for DCA analysis), and P&L.
*   **Validation:** It validates strategies and risk configurations, and memoizes these validations to prevent unnecessary repetition.
*   **Position Management:** Functions to perform actions like adjusting stop-loss levels, adding new DCA entries, or closing positions partially.
*   **Monitoring:** It offers tools to track important metrics like drawdown and time elapsed since key price points, giving insights into the strategy's risk and performance.
*   **Cleanup:**  It allows for the proper disposal of resources and clearing of cached data.



The service’s functions are broadly divided into read-only operations (retrieving signals, prices, etc.) and operations that modify the strategy’s state (like partial profit/loss adjustments, average buy entries, etc.). The `tick` and `backtest` functions facilitate running the strategy logic in a time-series context.

## Class StrategyConnectionService

This class acts as a central hub for managing trading strategies, ensuring they're routed to the correct implementation and handled efficiently. It’s designed to simplify the process of running and backtesting strategies, handling details like initialization and caching.

Here's a breakdown of what it does:

*   **Strategy Routing:** It directs calls to specific trading strategies based on the trading symbol and the strategy being used.
*   **Performance Optimization:** It cleverly stores commonly used strategy instances (ClientStrategy) to avoid repeatedly creating them, speeding things up.
*   **Controlled Execution:** It makes sure strategies are fully initialized before any trading actions are taken.
*   **Comprehensive Functionality:** It supports both live trading (tick()) and historical simulation (backtest()).

**Key Features & Functionality:**

*   **Get Strategies:**  It retrieves and manages the specific strategy implementations for different symbols and configurations.
*   **Signal Management:**  Provides methods to get and manipulate pending and scheduled signals, critical for monitoring and control.
*   **Position Details:**  It offers insights into the current position, like the percentage closed, cost basis, effective price, number of entries, and partial close history.
*   **Profit & Loss Tracking:**  Calculates unrealized profit/loss percentages and costs, accounting for partial closes and DCA entries.
*   **Testing & Control:** Offers tools to validate and execute actions (like partial profits/losses, trailing stops, and breakeven adjustments) and allows for stopping strategies.
*   **Lifecycle Management:** Provides methods for disposing of strategies and clearing the cache to manage resources effectively.


## Class StorageLiveAdapter

The StorageLiveAdapter helps manage how your trading signals are stored, offering flexibility by letting you choose different storage methods. It acts as a bridge between your trading strategies and the actual storage system, allowing you to swap out storage implementations easily.

You can choose between persistent storage (saving signals to disk), in-memory storage (signals exist only during the trading session), or a dummy storage adapter for testing purposes, where no data is actually saved. 

The adapter handles events like signals being opened, closed, scheduled, or cancelled, and provides methods to find signals by ID and list all signals. It also updates timestamps to track activity for signals that are active or scheduled. 

You can easily change which storage method is used with functions like `usePersist()`, `useMemory()`, and `useDummy()`. If your environment changes, like when switching directories, calling `clear()` will reset the adapter to use the default persistent storage.

## Class StorageBacktestAdapter

The `StorageBacktestAdapter` provides a flexible way to manage and store signal data during backtesting. It acts as a central point, allowing you to easily swap out the underlying storage mechanism without changing your core backtesting logic. You can choose between persistent storage (saving data to disk), in-memory storage (keeping data only in RAM), or a dummy adapter that effectively ignores all storage operations. 

The adapter handles various events like signals being opened, closed, scheduled, or cancelled, forwarding those actions to the currently selected storage backend. It also provides methods for finding signals by ID and listing all signals. 

You can switch between storage types using `useDummy`, `usePersist`, or `useMemory`.  `useStorageAdapter` lets you define your own custom storage solutions.  `clear` is useful to ensure a fresh start when your environment changes, like when the working directory gets updated. This adapter simplifies storage management and makes it easily customizable for different backtesting needs.

## Class StorageAdapter

The StorageAdapter is the central component for handling and storing both historical backtest signals and real-time live signals. It automatically keeps track of new signals by listening for updates, making sure your data is always current.

It's designed to work smoothly with backtest-kit, providing a single place to access all your signal data, whether it’s from past tests or current trading.

To prevent unwanted side effects, it uses a 'singleshot' approach to subscriptions. This guarantees it only subscribes to signal updates once.

You can easily turn storage on or off with the `enable` and `disable` functions. The `disable` function is safe to use multiple times.

Need to look up a specific signal? The `findSignalById` function lets you quickly find a signal using its unique ID.  You can also retrieve all backtest signals with `listSignalBacktest` or all live signals with `listSignalLive` to examine your data.

## Class SizingValidationService

The SizingValidationService helps you manage and make sure your position sizing strategies are correctly set up. It acts as a central place to register different sizing methods, like fixed percentages or Kelly Criterion.

Before you try to use a sizing strategy, this service lets you check if it's been registered, preventing errors. It also remembers the results of these checks to speed things up.

You can add new sizing strategies using `addSizing`, and then use `validate` to confirm a strategy exists before running calculations. Need a quick overview of all your available strategies? The `list` function provides a convenient way to see them all.

## Class SizingSchemaService

The SizingSchemaService helps you keep track of different sizing strategies for your trading system. It essentially acts as a safe and organized storage space for these strategies, making sure they're all structured correctly. 

You can add new sizing schemas using `addSizing`, and then easily retrieve them later by their assigned name. If you need to tweak an existing sizing strategy, you can update it with `override`, providing only the changes you want to make. 

Before a sizing schema is officially registered, it's quickly checked to make sure it has all the necessary parts and the right format. This helps catch potential errors early on. The service uses a specialized tool to manage the storage safely and efficiently.

## Class SizingGlobalService

This service handles the calculation of position sizes for trades. It acts as a central point, coordinating the process and ensuring consistency. It leverages other services to manage the specifics of sizing calculations and validations. 

Think of it as the engine that figures out *how much* of an asset to buy or sell, considering risk factors and other constraints. 

The service uses a `sizingConnectionService` to perform the calculations and a `sizingValidationService` to ensure the sizes make sense. It also has a `loggerService` for tracking and debugging. The core function, `calculate`, is what's used to determine the final position size given some input parameters and context.

## Class SizingConnectionService

The SizingConnectionService helps manage how position sizes are calculated within your trading strategies. It acts as a dispatcher, directing sizing requests to the correct sizing implementation based on a name you provide. 

Think of it as a central hub that ensures sizing calculations are handled by the right logic.

It's designed to be efficient; it remembers previously used sizing methods (memoization) so it doesn't have to recreate them every time.

If your strategy doesn't have specific sizing rules, you'll use an empty string for the sizing name.

The `getSizing` property lets you retrieve these sizing implementations, and the `calculate` method performs the actual size calculation, using risk parameters and the chosen sizing method—like fixed percentage or Kelly Criterion.


## Class ScheduleUtils

The ScheduleUtils class is designed to help you understand and monitor the signals your strategies are generating on a schedule. Think of it as a central place to track how well your scheduled tasks are performing.

It allows you to gather statistics about your scheduled signals, including how many are queued, how many are cancelled, and how long they're taking to process. 

You can also generate clear, readable markdown reports, which are useful for reviewing performance and identifying potential bottlenecks.

This class is readily available for use throughout your backtest-kit project, making it easy to monitor and analyze your scheduled strategies. You can retrieve data, generate reports, or save them directly to a file.

## Class ScheduleReportService

The ScheduleReportService helps you keep track of how your scheduled signals are performing. It essentially monitors your signals as they move through their lifecycle—when they're initially scheduled, when they start executing, and when they are cancelled.

This service records these events, calculating how long it takes from the moment a signal is scheduled until it either executes or is cancelled.

The information is then stored in a database, letting you analyze potential delays and optimize your trading strategies.

To use it, you'll subscribe to receive signal events, and when you're done, you'll unsubscribe to stop the monitoring. It’s designed to prevent accidental multiple subscriptions, ensuring your tracking stays clean.

## Class ScheduleMarkdownService

The ScheduleMarkdownService helps you track and understand the scheduling of your trading signals. It listens for signals being scheduled and cancelled, keeping a record of each one.

This service then organizes those records into easy-to-read markdown reports, detailing each event and providing helpful statistics like cancellation rates and average wait times. These reports are automatically saved to files, making it simple to review your signal scheduling history.

You can also retrieve specific data or reports for a particular trading strategy and symbol combination, and even clear out old data when it's no longer needed. It’s designed to give you a clear and structured view of how your signals are being managed. The service uses a dedicated storage area for each unique combination of symbol, strategy, exchange, frame, and backtest, ensuring isolated data for each scenario.

## Class RiskValidationService

This service helps keep track of your risk management setups and makes sure they're valid before you use them. Think of it as a central hub for all your risk profiles. 

It lets you register new risk profiles, ensuring they're properly defined. Before any actions are taken based on a risk profile, it checks to make sure it exists, preventing potential errors.

To speed things up, it remembers the results of past validations, so it doesn't have to re-check everything every time. You can also see a complete list of all the risk profiles that have been registered. The service uses a logger to record important events.

## Class RiskUtils

This class helps you analyze and report on risk rejections in your trading system. It’s like a central hub for gathering and presenting data about why trades were rejected, providing insights into potential issues with your strategies or market conditions.

You can use it to get statistics, like the total number of rejections, broken down by symbol and strategy. It can also generate nicely formatted reports in Markdown, showing you each individual rejection with details such as the position, price, and reason for rejection.

Finally, it allows you to easily save these reports to files, creating organized records of your risk rejection events. The reports are automatically named with the symbol and strategy used, making them easy to locate and review. The data comes from the RiskMarkdownService which listens for risk events and stores them for later use.

## Class RiskSchemaService

The RiskSchemaService helps you manage and keep track of different risk schemas. It's like a central place where you store and organize these schemas, ensuring they're consistent and well-defined.

You can add new risk schemas using the `addRisk()` function (or `register` property), and then easily find them again by their names using the `get` function.

Before adding a schema, the system checks its basic structure with `validateShallow` to make sure it has all the necessary information. If a schema already exists, you can update parts of it using the `override` function. Essentially, it provides a safe and organized way to handle risk schema data.


## Class RiskReportService

This service helps you keep a record of when risk checks reject trading signals. It's designed to capture those rejection events and store them in a database, typically an SQLite database, so you can analyze why signals are being blocked and audit your risk management system.

The service actively listens for these rejection events. When a signal is rejected, it records details like the reason for the rejection and information about the signal itself.

To start using it, you’ll subscribe to the risk rejection emitter, and when you’re done, you’ll unsubscribe. The subscription process is safe – you can't subscribe multiple times. The service also provides a way to log debug information using a logger service.


## Class RiskMarkdownService

The RiskMarkdownService is designed to automatically create and save reports detailing risk rejections within your trading system. It keeps track of each rejection event, categorizing them by symbol and trading strategy.

These events are listened to and then compiled into easy-to-read markdown tables.  The reports contain useful statistics, like the total number of rejections and breakdowns by symbol and strategy.

You can subscribe to receive these rejection events and later unsubscribe when you no longer need them. The service keeps the data organized using a storage system that's separated for each symbol, strategy, exchange, frame, and backtest combination. 

You can retrieve data, generate reports, save reports directly to disk, or even clear out all accumulated data if necessary. This simplifies the process of understanding and addressing potential risks in your trading activities.

## Class RiskGlobalService

RiskGlobalService acts as a central hub for managing risk checks during trading. It's designed to work behind the scenes, making sure trades comply with predefined risk limits.

It handles interactions with various services to perform these validations, including keeping track of what's been validated previously to improve efficiency.

Here's a breakdown of its key functions:

*   **Signal Validation:** The `checkSignal` function determines whether a trading signal is permissible based on risk settings.
*   **Signal Tracking:** `addSignal` records when a trade is initiated, and `removeSignal` cleans up the record when a trade is closed.
*   **Data Clearing:** The `clear` function provides a way to reset risk data, either for a specific risk configuration or a complete wipe.




The service is internally used by the trading framework and used for managing risk limits and validating trades.

## Class RiskConnectionService

This service acts as a central hub for managing risk checks during trading. It takes care of directing risk-related requests to the correct risk implementation based on a provided identifier, ensuring the right checks are performed in the right context.

To improve efficiency, it remembers previously used risk implementations, avoiding repeated creation.

The service validates crucial risk parameters like drawdown, exposure, position counts, and daily losses when evaluating signals. If a signal fails these checks, it will notify the system.

It also offers methods to register and remove trading signals from the risk management system, keeping track of open and closed positions.

You can even clear the cached risk implementations when needed, allowing for a fresh start or cleanup. The identifier used for routing and caching considers the exchange and frame involved, allowing for precise risk control.

## Class ReportUtils

ReportUtils helps you control which parts of the backtest-kit framework are generating detailed logs. It lets you turn on and off logging for specific areas like backtesting runs, live trading, or performance analysis.

The `enable` function allows you to pick which logging areas to activate. When you use it, it starts the logging process and gives you a special function back – it’s very important to call this function later to stop the logging and clean up resources; otherwise, things could get messy.

The `disable` function lets you turn off logging for particular areas without affecting others. It stops the logging for those areas immediately and doesn’t require a separate cleanup function. 

Think of it as fine-grained control over what data you're collecting.

## Class ReportBase

This class provides a way to create and manage files that store trading event data in a standardized JSONL format. Think of it as a dedicated system for collecting and organizing your backtesting results.

It automatically creates the necessary directory structure to hold these files and handles writing data in a stream-like fashion, preventing data loss and ensuring efficient processing. There's even a built-in safeguard to prevent writing operations from taking too long.

You can easily search these files based on criteria like the trading symbol, strategy, exchange, timeframe, or even a specific signal. This makes analyzing and comparing different backtest scenarios much simpler.

The class uses a special initialization process to set up everything correctly, and you can call this setup multiple times without issue.  The `write` method is your primary tool for adding new data to these files, automatically structuring it with relevant metadata and a timestamp.

## Class ReportAdapter

The ReportAdapter helps you manage how your trading data and analytics are stored, offering a flexible way to plug in different storage solutions. It keeps track of storage instances, making sure you only have one for each type of report (like backtest results, live trading data, or walker events), which helps avoid confusion and improves efficiency.

By default, it stores reports as JSONL files, but you can easily change this to use other storage methods. 

It automatically creates storage when you first write data, and it also lets you log events in real time.

Here's a breakdown of what you can do:

*   **Switch Storage:** You can tell the adapter what type of storage to use by providing a constructor.
*   **Memoization:** The adapter remembers the storage instances, ensuring you don't create duplicate ones.
*   **Easy Reset:**  You can clear the cached storage instances, for example, if your working directory changes.
*   **Testing Mode:** You can switch to a "dummy" adapter that effectively ignores all data, which is useful for testing.
*   **Default JSONL:** Quickly revert to the standard JSONL storage.

The `writeData` method is how you send your report data to the currently configured storage.

## Class PriceMetaService

PriceMetaService helps you access the most recent market price for a specific trading setup, like a particular symbol, strategy, exchange, and timeframe. It's designed for situations where you need the current price outside of the regular trading execution flow.

Think of it as a memory bank for prices, storing them for each unique combination of symbol and setup. This memory is updated automatically after each trading tick by another service.

You can reliably get the price whenever you need it, and if a price hasn't arrived yet, it will wait patiently for a short period.

To keep things clean and prevent outdated information, you can clear these stored prices completely or just for a specific setup when you start a new trading test or live session. This ensures you’re always working with the freshest price data available.

## Class PositionSizeUtils

This class helps you figure out how much of an asset to trade, using different strategies. 

It's designed to make position sizing calculations easier, offering pre-built methods for common techniques.

The `fixedPercentage` method calculates your position size based on a fixed percentage of your account balance, considering the risk involved.

The `kellyCriterion` method uses a more sophisticated approach, factoring in your win rate and win-loss ratio to determine the optimal position size.

Finally, the `atrBased` method utilizes the Average True Range (ATR) to account for market volatility and size your positions accordingly.

Each method checks that the provided information is suitable for the sizing strategy chosen.

## Class PersistStorageUtils

This class helps manage how signal data is saved and loaded persistently, ensuring it survives restarts and changes to the working directory. It keeps track of signals individually, each stored in its own file identified by a unique ID.

The system uses a clever approach to prevent data loss, writing changes to disk in a way that’s safe even if the program crashes mid-write.  It also lets you customize how the data is stored if you need something other than the standard JSON format.

Here’s a breakdown of what you can do:

*   **Get Data:** The `readStorageData` method retrieves all the saved signal information, essential for restoring the system’s state.
*   **Save Data:** The `writeStorageData` method makes sure changes to signals are safely written to disk.
*   **Custom Storage:** You can plug in your own way of saving and loading the data using `usePersistStorageAdapter`.
*   **Clear Cache:** The `clear` method is useful for cleaning up old storage when the environment changes.
*   **Switch Storage Types:** You can quickly switch between using a standard JSON-based storage, a dummy adapter that ignores writes, or your own custom adapter via `useJson` and `useDummy`.



Essentially, this utility class ensures that your signal data is reliably stored and recovered, providing stability and flexibility in your backtesting and live trading environments.

## Class PersistSignalUtils

The PersistSignalUtils class helps manage how signal data is saved and retrieved, ensuring reliability even if things go wrong. It keeps track of signal data separately for each strategy you're using, making it organized and efficient.

You can customize how this data is stored using different adapters, or use the built-in JSON adapter for a simple approach. 

The class handles writing data to disk in a safe way, so crashes won't corrupt your signal information.

It also provides a 'dummy' adapter option for testing purposes, allowing you to simulate persistence without actually saving any data. 

If your working directory changes, you'll want to clear the cached storage to ensure the system is using the correct paths. The `readSignalData` method retrieves existing signal data, while `writeSignalData` saves new or updated data.

## Class PersistScheduleUtils

This class provides tools for reliably saving and loading scheduled signals, which are important for certain trading strategies. It intelligently manages where this data is stored, creating separate storage areas for each strategy to keep things organized. 

You can even customize how the data is persisted, choosing from different adapters. The system is designed to be resilient, ensuring that your signals aren't lost even if the application crashes unexpectedly.

The `readScheduleData` method retrieves existing signals, while `writeScheduleData` saves new or updated signals to disk using safe, atomic operations. 

The class also allows you to reset the storage cache with `clear` and switch between different persistence methods, including a default JSON option and a "dummy" mode for testing.

## Class PersistRiskUtils

This class, PersistRiskUtils, helps manage and save information about active trading positions, specifically designed for systems handling risk. It keeps track of these positions in a way that’s reliable and efficient, remembering them even if there are interruptions.

It uses a clever system to store position data separately for each risk profile, and it's designed to work with different ways of storing that data.

You can think of it as a safeguard; it ensures that position data isn't lost unexpectedly and that changes are handled safely.

Here's what you can do with it:

*   **Retrieve Data:** It can fetch previously saved positions, useful when restarting or resuming a trading session.
*   **Save Data:** It allows you to save position changes, making sure the process is secure and prevents corruption.
*   **Customize Storage:** You can even tell it to use a specific method for storing data, or switch to a simple, temporary method that doesn't actually save anything (for testing purposes).
*   **Clear Cache:** It provides a way to clear the cached data if the base path changes, ensuring fresh storage instances are created.



It's a key component for a trading system to maintain a consistent state, especially when dealing with potentially unstable conditions.

## Class PersistPartialUtils

This utility class, PersistPartialUtils, helps manage how partial profit and loss information is saved and retrieved. It's designed to make sure this data isn't lost, even if something unexpected happens during trading.

It keeps track of these partials – pieces of information about profit and loss – for each trading symbol and strategy, and it does so in a way that’s safe and reliable. The system uses a clever method to avoid rewriting the same data repeatedly and allows you to plug in your own custom ways to store this data.

To ensure data integrity, it always writes changes to disk in a way that’s protected from interruptions. It's a critical component when a trading system needs to recover from a crash.

You can choose which type of storage to use – a standard JSON format, a dummy adapter that ignores writes for testing, or even provide your own custom storage solution.  If your trading environment changes, like when the directory where your data is stored changes, you'll need to clear the internal cache to ensure things work correctly. This class is the foundation for the more complex ClientPartial, which handles live trading persistence.

## Class PersistNotificationUtils

This class provides tools for reliably saving and loading notification data, ensuring your trading system's state remains consistent even if things go wrong. It automatically handles storing each notification as a separate file, organized by its unique ID.

You can customize how this data is stored by registering different persistence adapters, or revert to the standard JSON format.  

The `readNotificationData` method loads previously saved notifications, vital for restoring your system's state when it restarts.  Conversely, `writeNotificationData` saves the current notification data to disk, safeguarding against data loss.

For situations where you don't want to actually save any data (like during testing), you can switch to a "dummy" adapter that simply ignores all writes.

To ensure a fresh start when the working directory changes, the `clear` method can be used to wipe the memoized storage.

## Class PersistMemoryUtils

This class helps manage how data is saved and retrieved persistently for your trading strategies. It keeps track of where your data is stored, organizing it by signal ID and bucket name within a specific directory structure.

It provides utilities for reading, writing, and deleting data, ensuring operations are handled safely and efficiently. 

The class is designed to work with different storage methods, letting you choose between JSON, or even a dummy adapter that doesn’t actually save anything. There's also a way to completely clear out the stored data and release resources when they're no longer needed, which is particularly useful if your working directory changes. It's crucial for ensuring your strategies can recover from crashes and maintain state.

## Class PersistMeasureUtils

This class provides tools for storing and retrieving cached data from external APIs, making sure that data is reliably saved and loaded. It helps manage how your backtesting framework keeps track of information obtained from external sources, ensuring consistent results across different runs.

You can think of it as a system for creating and managing different storage areas, each dedicated to a specific type of data (like price data for a particular stock and time period). It’s designed to be flexible, allowing you to plug in different ways of storing this data, like using files or a database.

The class also ensures that writing and reading data is done safely, even if there are unexpected interruptions. It includes an option to clear the stored data, which is particularly useful when the program's working directory changes. It also offers different storage methods, including a simple 'dummy' adapter for testing and development.

## Class PersistLogUtils

This class helps manage how log data is saved and loaded, making sure it’s reliable even if things go wrong. It’s a behind-the-scenes helper used by other parts of the system to keep track of logs.

It provides a way to customize how the log data is stored, allowing you to plug in different storage methods.

The class automatically handles saving each log entry as a separate file, identified by a unique ID.

If you need to reset the log data or switch between different storage options (like using a JSON file or discarding the data entirely), this class provides methods to do so. For example, if the working directory changes between strategy runs, it's important to clear the cached storage to ensure correct persistence.

## Class PersistCandleUtils

This utility class helps manage and store candle data for efficient trading backtests. It works by saving each candle as a separate JSON file, organized by exchange, symbol, and time interval.

The system checks if all the required candle data is present before returning it, ensuring data integrity. It also automatically updates the cache when data is incomplete.

You can use this class to write candle data to cache, and it guarantees atomic operations to prevent data corruption. 

For debugging or testing, there’s even a dummy mode that pretends to save data but actually does nothing. 

You can register custom persistence adapters to tailor the data storage method, or easily switch back to using JSON as the default storage format. It's designed to be used internally by the ClientExchange to streamline candle data handling.

## Class PersistBreakevenUtils

This class manages how your breakeven data is saved and loaded from disk. It's designed to be reliable, ensuring that your progress isn't lost even if the application restarts.

It handles the behind-the-scenes work of writing and reading breakeven state, organizing files in a structured directory format. The data is stored in JSON files, with a separate file for each symbol and strategy combination. 

The class uses a clever caching system to avoid repeatedly reading and writing to disk, creating efficient storage for each symbol and strategy you're using. You can even customize how the data is stored using adapters, or switch to a dummy adapter for testing purposes. If your working directory changes, you can clear the cached storage to ensure fresh persistence.

## Class PersistBase

`PersistBase` provides a foundation for storing data files reliably. It's designed to manage files associated with your trading entities, making sure writes are handled safely and any issues with corrupted files are automatically addressed. This class keeps things organized by storing entities in a specified directory, and it helps prevent data loss by using a technique called atomic writes – essentially, ensuring that a write either completes fully or doesn't happen at all.

The class handles the creation and validation of the storage directory, ensuring it’s ready to go.  You can easily check if a particular entity exists and read its data. When you write data, it's done in a secure way to protect against interruptions.

If you need to list all the entity IDs that are currently stored, a special generator function can provide them, sorted alphabetically. This simplifies accessing and managing your data consistently.

## Class PerformanceReportService

The PerformanceReportService helps you understand how quickly your trading strategies are running and where potential slowdowns might be. It acts like a detective, quietly observing and recording the time it takes for different parts of your strategy to complete.

It listens for these timing events and stores them in a database, allowing you to analyze them later to pinpoint bottlenecks and optimize performance. 

You can easily subscribe to start tracking, and an unsubscribe function is provided to stop the tracking process when it’s no longer needed. It's designed to avoid accidentally subscribing multiple times, ensuring reliable and clean data collection.


## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing. It gathers performance data as your strategies run and organizes it in a way that’s easy to understand.

It keeps track of metrics for each strategy, calculates key statistics like averages and percentiles, and then creates detailed reports. These reports pinpoint areas where your strategy might be struggling or could be improved, and they’re automatically saved to your disk.

You can retrieve these accumulated statistics for specific strategies and symbols, or request a full performance report. There's also a way to clear all collected data when you want to start fresh. The system ensures data is isolated for each strategy and trading environment, preventing mixing of results. Subscribing and unsubscribing to the performance events is managed for you, ensuring you're only receiving data when needed.

## Class Performance

The Performance class helps you understand how well your trading strategies are performing. It offers tools to gather and analyze key performance metrics for specific strategies and symbols.

You can retrieve detailed performance statistics, broken down by operation types, showing things like total time spent, averages, and outliers.

It also generates easy-to-read markdown reports that visually represent your strategy's performance. These reports highlight potential bottlenecks and areas for improvement, using charts and tables to show the distribution of time spent on different operations.

Finally, you can save these reports directly to your file system, creating a record of your strategy’s performance over time. The reports will be stored in a directory named `dump/performance` by default.

## Class PartialUtils

This class helps you analyze and report on partial profit and loss data. It provides ways to get summarized statistics and generate detailed reports about your trading performance.

You can retrieve statistical information, like the total number of profit and loss events, using the `getData` method.

The `getReport` method allows you to create markdown reports that display all the partial profit/loss events for a specific symbol and strategy, presented in an easy-to-read table including things like price, position, and timestamps.

Finally, the `dump` method generates those reports and saves them to files, making it convenient to keep a record of your trading history. It will automatically organize the files into folders based on your symbol and strategy names.

## Class PartialReportService

The PartialReportService helps you keep track of your trading activity by recording every time a position is partially closed, either with a profit or a loss. It's designed to listen for these partial exit events – when you take some profits or cut losses before a full position is closed – and stores that information in a database.

You can tell the service what events to watch for through specific channels. Once it's set up, it diligently logs each partial exit, noting the price and level at which it occurred. 

The service provides a way to sign up to receive these partial exit notifications and also a way to stop listening, preventing accidental duplicate recordings. It manages these subscriptions carefully to ensure everything runs smoothly.

## Class PartialMarkdownService

This service helps you create and save reports detailing small profits and losses ("partial profit/loss") during your trading tests. It keeps track of these events as they happen for each trading symbol and strategy you're using. 

It listens for notifications about these small profits and losses, compiles them, and then generates nicely formatted markdown tables summarizing the data. You can also get overall statistics like the total number of profit and loss events.

The reports are saved as files, one for each symbol and strategy, making it easy to review your trading performance in detail.  You can also clear the accumulated data if needed, either for specific tests or everything at once. 

The service uses a clever storage system, creating a separate, isolated space for each symbol and strategy combination to ensure data doesn’t get mixed up.  It also has ways to subscribe and unsubscribe to the notifications it receives to manage its operation.

## Class PartialGlobalService

The PartialGlobalService acts as a central hub for managing partial profit and loss tracking within the system. It’s designed to be injected into the ClientStrategy, offering a single point of control for these operations.

Think of it as a gatekeeper – it logs all partial operations at a global level before passing them on to the PartialConnectionService to handle the actual work. This centralized logging provides valuable insights into the system's performance.

Several validation services are included – for strategy, risk, exchange, and frame – ensuring configurations are valid.  The `validate` property provides a way to check these configurations, remembering past validations to improve efficiency.

The `profit`, `loss`, and `clear` methods handle specific events – reaching a profit level, hitting a loss threshold, or closing a signal – by logging, validating, and then delegating the appropriate action.

## Class PartialConnectionService

This service manages and tracks partial profits and losses for individual trading signals. It acts like a central hub, ensuring each signal has a dedicated record to keep track of its performance.

The system cleverly avoids creating duplicate records; it uses a "memoized" approach, creating a new record only when needed and storing it for later use. 

When a signal starts making a profit or experiencing a loss, this service steps in, handles the calculations, and reports those changes. When a signal is closed out, this service cleans up its records to prevent unnecessary clutter.

Essentially, it's responsible for creating, managing, and cleaning up these partial records, and it works closely with other components of the trading system to ensure accurate profit/loss tracking. It utilizes a logger and event system to report on its actions and signal performance.

## Class NotificationLiveAdapter

This component lets you manage and send notifications related to your trading strategies, offering a flexible way to handle different notification methods. It's designed to be adaptable, allowing you to easily switch between various ways of delivering those notifications—like storing them in memory, persisting them to disk, or simply discarding them (using a dummy adapter). 

You can choose which type of adapter you want to use through simple methods like `useMemory`, `usePersist`, and `useDummy`. This makes it easy to control where your notifications end up. The `handleSignal`, `handlePartialProfit`, and similar methods are the core of sending out those notifications, passing along the relevant data.  You can retrieve all stored notifications using `getData` and clear them with `dispose`.  If you need a completely custom notification solution, you can even provide your own adapter using `useNotificationAdapter`.  Finally, `clear` is important if your working directory changes during testing, as it ensures a fresh start with the default adapter.

## Class NotificationBacktestAdapter

This component helps you manage notifications during backtesting, letting you choose how those notifications are handled. It provides a flexible way to store or discard notifications by swapping out different "adapter" implementations.

You can easily switch between storing notifications in memory (the default), persisting them to disk, or even using a dummy adapter that simply ignores them. This offers control over data storage and debugging.

The `handleSignal`, `handlePartialProfit`, `handlePartialLoss`, `handleBreakeven`, `handleStrategyCommit`, `handleSync`, `handleRisk`, `handleError`, `handleCriticalError`, and `handleValidationError` methods all pass notification data to the currently selected adapter for processing. `getData` lets you retrieve all stored notifications, and `dispose` clears them.  The `useNotificationAdapter`, `useDummy`, `useMemory`, `usePersist`, and `clear` methods allow you to change how notifications are handled, often used for different testing and development scenarios. When the working directory changes, be sure to call `clear` to refresh the notification storage.

## Class NotificationAdapter

This component handles all your notifications, both from backtesting and live trading environments. It automatically keeps track of new notifications as they come in.

To avoid unwanted duplicates, it ensures that it only subscribes to the notification sources once.

You can easily retrieve all notifications, specifying whether you want backtest or live data.

When you're finished, you can clear all stored notifications to free up resources. It’s also designed to be safely disabled even if it's already disabled.

## Class MemoryAdapter

The MemoryAdapter helps manage and store data related to signals, acting like a central hub for that information. It’s designed to be efficient, avoiding unnecessary data duplication by only creating a data storage instance once for each unique combination of signal and bucket. 

You can easily switch between different ways of storing this data: a fast in-memory option, a persistent file-based storage, or a dummy mode for testing. The default is a blend of both - keeping things in memory for quick access while also saving data to disk.

Before using any of the adapter's features, you need to "enable" it, which allows it to track signal lifecycle events. Disabling it reverses this process. You can write, search, list, remove, and read data from this memory using straightforward functions.

The `clear` function is handy for resetting the adapter's internal cache when the working directory changes, while `dispose` cleans up all resources when you're finished with the adapter.

## Class MaxDrawdownUtils

This utility class helps you analyze and understand maximum drawdown events – those points where your trading strategy experienced significant losses. Think of it as a tool for understanding how much risk your strategy takes.

It doesn't require you to create an instance; you access its functions directly.

You can request statistical summaries of drawdown data, filtered by the asset being traded, the strategy used, and the data source. This lets you pinpoint which combinations are experiencing the most risk.

Need a visual overview? This class also generates markdown reports showcasing all drawdown events for a specific asset and strategy.

Finally, you can have these reports saved directly to a file, making it easy to share or archive your findings. It offers options to customize which columns of data are included in the report.

## Class MaxDrawdownReportService

This service is responsible for tracking and recording maximum drawdown events during a backtest. It listens for notifications about new drawdown occurrences and saves those details to a report database for later analysis.

Think of it as a diligent observer, noting down whenever a drawdown reaches a new peak.

The service keeps track of important information for each drawdown event, including timestamps, symbols, strategy names, prices, and signal details. 

You initiate this process by subscribing to the "maxDrawdownSubject" feed. Importantly, subscribing only happens once – subsequent attempts simply return the existing unsubscribe function, preventing unnecessary subscriptions.

To stop the logging process, use the unsubscribe function, which safely disconnects the service from the "maxDrawdownSubject" and prevents any further records from being written.


## Class MaxDrawdownMarkdownService

This service helps you create and save reports on maximum drawdown, which indicates the largest peak-to-trough decline during a trading period. It listens for drawdown events and organizes them by symbol, strategy, exchange, and timeframe.

You can subscribe to receive these events, and unsubscribe to stop receiving them and clear the stored data. The `tick` method processes each incoming drawdown event.

To get the accumulated drawdown data for a specific symbol and timeframe, use `getData`. `getReport` generates a markdown formatted report, while `dump` creates the report and saves it as a file.

Finally, `clear` lets you remove all previously collected drawdown data or just data for a specific combination of symbol, strategy, exchange, and timeframe.

## Class MarkdownUtils

The `MarkdownUtils` class is designed to help you control the generation of markdown reports for various aspects of your trading framework, such as backtests, live trading, and performance analysis.

It lets you selectively turn on or off markdown reporting for specific features.

The `enable` method allows you to subscribe to the markdown services you want to use. You’ll get back a function that you *must* call later to unsubscribe from all those services at once - failing to do so can lead to memory problems.

You can also use the `disable` method to turn off markdown reporting for certain services individually without affecting others. This method immediately stops report generation and frees up resources.

## Class MarkdownFolderBase

This adapter lets you generate your trading reports as individual markdown files, neatly organized into directories. Think of it as creating a folder full of reports, each saved as its own `.md` file. 

The files are structured using the path and filename you specify, making them easy to find and review. It automatically creates the necessary folders for your reports.

Because it writes files directly, there's no need for any setup or initial preparation – it’s ready to go. This makes it a great choice if you prefer having a structured set of files for manual examination of your backtest results.

The `waitForInit` method doesn't actually do anything as this adapter doesn't require any initial setup.

The `dump` method is what writes the actual markdown content, creating the file and any necessary directories based on the provided options.


## Class MarkdownFileBase

This component handles writing markdown reports to files in a specific JSONL format. Think of it as a way to consistently log your trading reports so they can be easily processed later.

It organizes reports into separate files based on the report type (like trade details or performance summaries). The writing process is designed to be efficient and reliable, handling potential delays and errors gracefully.

Each report is saved as a line in a JSONL file, including important details like the symbol traded, the strategy used, and a timestamp, making it easy to filter and analyze the data. The system automatically creates the necessary directories and handles any errors that might occur during the writing process. It's designed to be robust, with safeguards against write operations taking too long. You can initialize the file and stream when needed, and it's safe to call the initialization multiple times.

## Class MarkdownAdapter

The MarkdownAdapter acts as a flexible way to manage your markdown files, letting you choose how they are stored and organized. It’s designed to be adaptable, allowing you to switch between different storage methods easily. 

It uses a system that remembers the storage instances you've created, ensuring you don't accidentally create multiple copies of the same data. By default, it stores each piece of markdown in its own separate file, but you can also configure it to append everything to a single JSONL file.

You can change the storage method at any time, and the system will automatically initialize storage the first time you write data.  There are shortcuts for switching back to the default folder-based storage or to JSONL storage. A "dummy" mode is available for testing purposes where writes are ignored. This is particularly helpful when your working directory changes during different strategy runs, as it allows you to refresh the storage setup.

## Class LoggerService

The LoggerService helps standardize logging throughout the backtest-kit framework, ensuring messages always include useful context. It lets you provide your own logging mechanism, but automatically adds information like the strategy name, exchange, frame, symbol, and execution time to each log. If you don’t specify a logger, it defaults to a "no-op" logger, which means no logs are actually generated.

You can customize the logging by setting your own logger through the `setLogger` function.

The `log`, `debug`, `info`, and `warn` methods are used to write messages at different severity levels, each incorporating the automatically added contextual details. The service relies on `methodContextService` and `executionContextService` to manage and provide that contextual information.

## Class LogAdapter

The `LogAdapter` provides a flexible way to manage how your backtesting framework records information. Think of it as a central hub for all your logs, whether it's for debugging, monitoring performance, or simply keeping track of events.

You can easily swap out different logging methods – like using memory for quick access, persisting logs to a file for later analysis, or even silencing logs entirely with a dummy adapter. The default is an in-memory solution, but you have control.

The `useLogger` function lets you customize which logging mechanism is used.  `usePersist`, `useMemory`, and `useDummy` are handy shortcuts for common logging configurations. There's also a new `useJsonl` to log to JSONL files.

You can get a complete list of logs using `getList`, and various methods like `log`, `debug`, `info`, `warn` all write information according to the active logging adapter.  Don’t forget to call `clear` when things change, like when the working directory changes, to make sure you get fresh logging.

## Class LiveUtils

LiveUtils provides tools to manage and monitor live trading operations, acting as a central point for interacting with the live trading system. It’s designed to simplify running and observing live strategies.

The `run` method starts a live trading process for a specific symbol and strategy, continuously generating trading ticks. This process is resilient, automatically recovering from crashes by restoring its state from persistent storage.  The `background` method is similar but runs without returning any data, suitable for tasks like logging or updating external systems.

You can retrieve pending signals using methods like `getPendingSignal`, `getScheduledSignal`, and check for their absence with `hasNoPendingSignal` and `hasNoScheduledSignal`, these are helpful for controlling signal generation.

It also provides utilities to calculate position metrics like total percent closed, total cost closed, breakeven price, and other key indicators.  For example, `getPositionPnlCost` gives you the dollar amount of profit or loss, while `getBreakeven` determines if the price has covered transaction costs.

The framework offers methods for controlling the trading process, like `stop` to halt signal generation and `commitClosePending` and `commitCancelScheduled` to force a close or cancellation of a signal. There are also utility functions for adjusting the trailing stop-loss (`commitTrailingStop`) and take-profit (`commitTrailingTake`) levels, and methods to trigger actions like `commitBreakeven` to move the stop-loss to the entry price.

Finally, several methods provide real-time insights into the positions, such as  `getPositionLevels` (DCA entry prices), `getPositionPartials` (partial close events), and various metrics providing detailed analysis of the current position.  `getData` and `getReport` allow extracting and summarizing trading activity, while `dump` saves reports to disk. `list` will display all active live trading instances and their status.


## Class LiveReportService

The LiveReportService is designed to keep a detailed record of your trading activity as it happens. It captures every stage of a trade – from initial signal, through opening and active periods, to when the trade is closed – and saves this information to a SQLite database.

This service connects to your live trading signals and logs all relevant details for each event. 

It uses a 'single shot' mechanism to make sure you're only tracking these events once. 

You can use the `subscribe` method to start listening for events, and when you’re done, `unsubscribe` will stop the service from receiving and logging any more data. It’s like having a continuous log of your trading decisions, ready for analysis and review.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically generate and save reports of your live trading activity. It listens for events related to your trading strategies, like when a trade is opened, active, or closed.

It compiles these events into nicely formatted Markdown tables, giving you a clear record of what's happening. You’ll also get key statistics like your win rate and average profit/loss per trade.

The service saves these reports as Markdown files, making them easy to read and share. You can get detailed information for a specific strategy and trading pair, or clear out all the accumulated data if needed. It keeps separate records for different trading setups to keep everything organized. You subscribe to the service to start receiving events and can unsubscribe when you no longer need reports.

## Class LiveLogicPublicService

This service helps manage and orchestrate live trading operations, taking care of the details so you don't have to. It builds upon a private service to seamlessly handle things like knowing which strategy and exchange are being used without you needing to specify them every time.

Think of it as a continuous stream of trading events – signals to open, close, or cancel trades – flowing indefinitely.  Even if something unexpected happens and the process crashes, it’s designed to recover and pick up where it left off, preserving its state. 

The `run` function is the main way to start the live trading process for a specific asset, handling the flow of data and context automatically. It provides a convenient way to get results from your trading strategy without constantly passing around extra information.

## Class LiveLogicPrivateService

This service manages live trading operations, acting as the engine that executes trades. It continuously monitors market data in a loop, checking for new trading signals.

The core of its functionality is an infinite generator, meaning it runs perpetually and streams back results as they happen – only when a trade is opened or closed, not when it's active or idle. 

Because it’s designed for real-time use, it incorporates safeguards like crash recovery to ensure trades aren’t lost and uses efficient streaming techniques. The generator automatically recovers from crashes by reinitializing from stored data. 

You can initiate a live trade for a specific symbol by using the `run` method, which returns the generator providing those real-time trading results.


## Class LiveCommandService

This service gives you a way to interact with live trading features within the backtest-kit framework. It essentially acts as a central point for accessing live trading capabilities, simplifying how different parts of your application connect to those features.

Think of it as a bridge between your code and the core live trading engine.

The service relies on several other services to handle things like validating your trading strategies, exchanges, and ensuring the risks are acceptable.

The key method, `run`, is what actually starts the live trading process for a specific symbol. It continuously feeds your strategy with market data and handles potential errors or interruptions to keep the trading going. This is done using a special generator that allows for ongoing updates and automatic recovery from unexpected issues.

## Class HighestProfitUtils

This class helps you understand and report on the best-performing trades. It’s designed to gather and display data about the highest profits achieved during backtesting or live trading.

Think of it as a tool to analyze which strategies and symbols are consistently generating the most profit.

It uses a central instance, so you don't need to create new objects - just use the available methods.

You can fetch the detailed statistics for a specific trading setup using `getData`. This gives you a model with all the important metrics.

`getReport` allows you to create a nicely formatted markdown report summarizing the highest profit events for a given symbol and strategy.

Want to save that report directly to a file? `dump` does just that, creating a markdown file containing all the details. You can also customize the data included in the report with the `columns` parameter.

## Class HighestProfitReportService

This service is designed to keep track of the moments your trading strategies achieve their highest profits, storing this information for later review and analysis.

It listens for updates on the `highestProfitSubject` – whenever a new highest profit is recorded, the service writes a detailed record to a database.

This record includes critical information like the timestamp, symbol, strategy name, exchange, timeframe, backtest details, signal ID, position size, current price, and the price levels used for opening, take profit, and stop loss. It pulls this data directly from the signal itself, not the contract details.

To begin logging these profit events, you need to subscribe to the service. Importantly, you only subscribe once; any further attempts simply return the existing unsubscribe function.

To stop logging, use the unsubscribe function. This cleanly disconnects the service from the profit tracking stream. If you haven't subscribed yet, unsubscribing won't do anything.

## Class HighestProfitMarkdownService

This service is responsible for creating reports that show the highest profits achieved by your trading strategies. It listens for data about these profits and organizes it based on the symbol traded, the strategy used, the exchange, and the timeframe.

You can subscribe to receive these profit events, and the service makes sure you don’t accidentally subscribe multiple times.  Unsubscribing completely clears all the stored data.

The `tick` method processes each incoming profit event, categorizing and storing the information.  You can request specific data using `getData`, generate a formatted report using `getReport`, or create a report file on your disk with `dump`.

Finally, `clear` lets you wipe out all accumulated profit data, either for a specific combination of symbol, strategy, exchange, timeframe, and backtest type or everything at once.

## Class HeatUtils

HeatUtils helps you create and analyze portfolio heatmaps, essentially visual representations of how your trading strategies are performing. It's designed to simplify the process of gathering and presenting key statistics for each symbol and your overall portfolio.

Think of it as a tool that automatically collects data from your completed trades, making it easier to understand which symbols are contributing the most to your strategy's success or failure.

You can use HeatUtils to get the raw data for a specific strategy and exchange, generate a formatted markdown report with a table summarizing important metrics like profit, Sharpe ratio, and drawdown, or even save that report directly to a file. The report organizes the symbols by profitability, making it easy to identify top performers. It’s conveniently available as a single, easy-to-access instance.

## Class HeatReportService

The HeatReportService helps you track and analyze your trading performance by recording when your signals close and how much profit or loss they generated. It’s designed to give you a portfolio-wide view, gathering data from all your symbols.

The service listens for closed signal events, specifically focusing on those with associated profit and loss data. It then saves these events to a database, ready for generating detailed heatmap visualizations.

To use it, you'll subscribe to receive these signal events, and you can easily stop that subscription when it’s no longer needed. The service ensures you don't accidentally subscribe multiple times.

Here’s a quick rundown of its components:

*   It uses a logger to help debug any issues.
*   It has a `tick` property to process the incoming signal events.
*   The `subscribe` method starts the data collection.
*   The `unsubscribe` method stops the data collection.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and understand your trading performance. It takes data from your trading signals and organizes it into clear, easy-to-read reports and statistics.

It focuses on "closed" signals to track results and aggregates information at different levels – individual symbols, entire strategies, and across your whole portfolio. 

You can request specific data sets based on things like exchange, timeframe, and whether you're in backtest or live mode. It automatically generates markdown tables showing key metrics like total profit/loss, Sharpe Ratio, and maximum drawdown for each symbol. 

The service is designed to be reliable, even if data contains unusual values. The storage is cleverly managed, so you don’t have to worry about multiple copies of the same data. It also allows you to clear and reset the stored data when needed, either for specific configurations or completely.

## Class FrameValidationService

This service helps you keep track of and confirm the validity of your different timeframes (or "frames") within your trading strategy. Think of it as a central place to register and check if your frames are properly set up before you start running tests or making decisions.

It lets you add new timeframe configurations, ensuring they're registered within the system.

Before using a timeframe, you can use the validation function to verify it exists, preventing potential errors.

The service is designed to be efficient; it remembers the results of previous validations to speed things up.

Finally, you can easily get a list of all registered timeframes to see what's available.

## Class FrameSchemaService

The FrameSchemaService helps you keep track of the structures for your trading frames, ensuring they all have the expected information. It uses a type-safe system to store and manage these frame schemas. 

You can add new frame schemas using `register()` and update existing ones with `override()`.  If you need to check if a frame schema has the necessary properties before adding or updating, it offers a `validateShallow` function. 

To get a frame schema you've already registered, simply use `get()` and provide its name. The service relies on a logger to provide diagnostic information and uses a registry to store the frame schemas.


## Class FrameCoreService

This service, `FrameCoreService`, handles the core logic for managing timeframes used in your backtesting process. Think of it as the engine that provides the sequence of dates your trading strategies will operate on. It works closely with the `FrameConnectionService` to actually fetch those timeframes and uses `FrameValidationService` to make sure they're usable. 

It's designed to be a central point for accessing and generating timeframe data, primarily used by the internal components of the backtesting system. The `getTimeframe` method is the key function here – it’s what you'd use to get a list of dates for a specific trading symbol and timeframe name, ready to be fed into your backtest. The `loggerService` helps track and troubleshoot issues related to timeframe generation.

## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing different frames within the backtesting environment. It intelligently routes requests to the correct frame implementation based on the currently active method context. 

To optimize performance, it caches these frame instances, so frequently used frames don't need to be recreated repeatedly.

The service also handles backtest timeframe management, allowing you to define the start and end dates for your tests. When running in live mode, the frame name will be empty, indicating no specific frame constraints.

Here’s a quick breakdown of its components:

*   It uses a logger service, a frame schema service, and a method context service to function properly.
*   The `getFrame` method provides a way to retrieve those cached frame instances.
*   `getTimeframe` helps determine the date range for a backtest related to a particular symbol.

## Class ExchangeValidationService

The ExchangeValidationService helps you keep track of your trading exchanges and make sure they’re properly set up before you start trading. Think of it as a central place where you register each exchange you're using. 

It lets you add new exchanges to its registry, making sure everything is accounted for. 

Before any trading activity happens, you can use the validation service to check if an exchange is actually registered and ready to go.  It remembers previous checks to speed things up.

Finally, the service provides a way to get a complete list of all the exchanges you’ve registered.

## Class ExchangeUtils

The ExchangeUtils class is designed to simplify interactions with various cryptocurrency exchanges. It acts as a central hub, providing easy access to common exchange functions while ensuring data consistency.

Think of it as a helper for retrieving data like historical prices (candles), order books, and trade information.

It keeps track of individual exchange connections to keep things organized.

The `getCandles` function automatically figures out the right date range for historical price data, making it straightforward to retrieve past performance. You can also get the average price using the `getAveragePrice` function.

When dealing with trade quantities or prices, `formatQuantity` and `formatPrice` take care of correctly formatting the numbers according to the specific rules of the exchange. 

If you need the current order book or a list of aggregated trades, ExchangeUtils makes those actions easy.  The `getRawCandles` method offers even more control, letting you specify precise date ranges to fetch data and avoiding potential look-ahead bias.

## Class ExchangeSchemaService

This service helps you keep track of information about different cryptocurrency exchanges, making sure everything is organized and consistent. 

It uses a special system to store these exchange details in a way that prevents errors related to incorrect data types.

You can add new exchanges using the `addExchange()` method (though it's referred to as `register` in the code), and then find them again later by their name with the `get()` method.

Before an exchange is added, it’s quickly checked (`validateShallow`) to make sure it has all the necessary parts.

If you need to update an existing exchange, you can use `override()` to change just the parts that need updating, rather than the entire schema.

## Class ExchangeCoreService

The ExchangeCoreService acts as a central hub for all exchange-related operations within the backtest-kit framework. It essentially bridges the connection to the exchange with the specific details of the backtest or live trading environment. 

Think of it as a wrapper around the exchange connection, allowing it to understand the context of when and where the data is being retrieved.

This service handles tasks like fetching historical and future candle data, calculating average prices, formatting price and quantity values, and retrieving order books and trades. All these operations are done with careful consideration of the trading context (symbol, date, backtest mode). 

It validates the exchange configuration to ensure everything is set up correctly and remembers the results to avoid unnecessary repeated checks. 

The service is designed to be used internally, ensuring consistency and proper context injection throughout the trading logic.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently directs requests to the correct exchange based on the current context. To speed things up, it remembers (caches) the exchange connections it creates, so it doesn't have to recreate them every time.

Here's a breakdown of what it does:

*   **Smart Routing:** It automatically chooses which exchange to use for your requests.
*   **Efficient Connections:** It keeps a cached list of connections to exchanges for faster operation.
*   **Comprehensive Interface:** It provides a complete set of functions for common exchange operations.
*   **Logging:**  It records everything it does, helping with troubleshooting.

The service offers functions to retrieve historical and future candles (price data), calculate average prices (either from live exchange data or historical candles during backtesting), format prices and quantities according to each exchange's rules, and fetch order books and aggregated trades. It's designed to be flexible, letting you specify date ranges and limits for retrieving raw candle data.

## Class DumpAdapter

The DumpAdapter helps you save data from your backtesting process in different formats, like Markdown files, memory, or even discard it entirely. It's like a flexible tool that adapts to how you want to store your results.

Before you start dumping data, you need to activate the adapter using `enable()`, which subscribes it to signal lifecycle events to keep track of things and prevent memory leaks.  Conversely, `disable()` unsubscribes it when you’re done.

You can then use various methods like `dumpAgentAnswer`, `dumpRecord`, `dumpTable`, `dumpText`, `dumpError`, and `dumpJson` to write different kinds of information. Each method takes a context object to provide extra information.

The adapter defaults to writing to Markdown files, but you can easily switch to other storage options: `useMemory` for storing in memory, `useDummy` to simply ignore the data, or `useDumpAdapter` to use a custom implementation. There's also `useMarkdownMemoryBoth` for writing to both markdown and memory simultaneously.

To ensure the adapter uses the correct path if your working directory changes (like between backtesting strategies), call `clear()` to flush the memoized instance cache.

## Class ConstantUtils

This class provides a set of pre-calculated values to help manage your take-profit and stop-loss levels when trading. It's designed to use a Kelly Criterion-inspired approach that gradually adjusts risk over time.

The constants define levels at which to partially close your position, with TP_LEVEL1 triggering when the price moves 30% of the way to your overall take-profit target, TP_LEVEL2 at 60%, and TP_LEVEL3 at 90%. Similarly, SL_LEVEL1 triggers at 40% of the distance to your stop-loss, and SL_LEVEL2 at 80%.

Think of it as a way to automatically lock in profits early on while still allowing the trade to potentially continue its run, and to have multiple safety nets in case the trade moves against you. These values help manage risk and potentially optimize performance by adjusting exposure based on the progress of the trade.

## Class ConfigValidationService

The ConfigValidationService helps make sure your trading setup is mathematically sound and likely to be profitable. It's designed to catch potential errors in your configuration settings before they cause problems.

The service carefully checks a wide range of parameters, including percentages like slippage and fees, ensuring they aren't negative. It also verifies that your take-profit settings are sufficient to cover all trading costs, guaranteeing a profit when the target is reached.

Beyond that, it validates relationships between values like stop-loss distances and makes sure that time-related settings and candle parameters are set to reasonable, positive values. Essentially, it acts as a safety net to prevent unintentionally unprofitable or flawed trading configurations.

## Class ColumnValidationService

This service helps ensure your column configurations are set up correctly. It's designed to check your column definitions against a set of rules, preventing common errors and inconsistencies.

The service verifies that each column has the necessary properties: a unique key, a descriptive label, a formatting function, and a visibility function. It also confirms that the key and label are strings and not empty, and that the format and visibility are actually functions.  Finally, it makes sure all keys are unique within their respective groups. This helps maintain data integrity and avoid unexpected behavior in your application. The `validate` method performs these checks on your column configurations.

## Class ClientSizing

This component, called ClientSizing, figures out how much of an asset your strategy should trade. It's a flexible system that lets you choose from different sizing techniques, like using a fixed percentage, the Kelly criterion, or Average True Range (ATR).

You can also set limits on how big your positions can be, both in absolute terms and as a percentage of your available capital. 

ClientSizing also provides ways to add custom checks and record important information during the sizing process, ensuring the sizing aligns with your specific needs and logging decisions. The `calculate` method is the core, taking inputs about the trade and returning the calculated position size.


## Class ClientRisk

ClientRisk helps manage risk at the portfolio level, preventing trades that would exceed predefined limits. It acts as a central control point, ensuring that trading signals from various strategies don't collectively violate risk constraints, such as maximum position sizes. This component keeps track of all active positions across strategies using a map, enabling a holistic view of risk exposure.

The system initializes itself once, retrieving existing positions from persistent storage unless in backtest mode. It has a method to update this position map to disk, again skipping the persistence process when backtesting.

The core functionality revolves around `checkSignal`, a crucial method that examines incoming trading signals against the established risk parameters. It allows for custom risk validations, providing detailed information about the signal and current positions. If a validation fails, the signal is rejected, and specific callbacks are triggered.

ClientRisk also provides methods to register newly opened signals (`addSignal`) and remove closed signals (`removeSignal`), maintaining an accurate record of trading activity. These methods are invoked by the StrategyConnectionService to synchronize the risk management system with the trading process.

## Class ClientFrame

The `ClientFrame` class is responsible for creating the timeline of data used during backtesting. Think of it as the engine that generates the sequence of timestamps you'll be working with. It’s designed to avoid unnecessary computation by caching previously generated timelines.

You can control how frequently these timestamps are generated, ranging from one minute to three days.

This component works hand-in-hand with the backtesting logic, providing the historical periods it needs to run simulations.

The `getTimeframe` method is the key – it's what actually produces the timestamp array for a given asset, and it leverages caching to be efficient. 


## Class ClientExchange

This component, `ClientExchange`, handles retrieving data from exchanges – think of it as a bridge between your backtesting system and live market data. It’s designed to be efficient in memory usage.

It provides ways to fetch historical and future candles (price data over time), calculate the VWAP (a volume-weighted average price – useful for understanding market trends), and format prices and quantities to match specific exchange requirements.

You can use it to:

*   **Get historical data:** Retrieve past price movements (candles) from a specific symbol and time interval, working backward from a reference point.
*   **Predict future data (for backtesting):**  Fetch future price movements when simulating trading strategies.
*   **Calculate average prices:** Determine the VWAP based on recent trade data.
*   **Prepare data for the exchange:** Ensure prices and order quantities are formatted correctly for the exchange's rules.
*   **Get order book data:** Retrieve the current order book for a trading pair.
*   **Get aggregated trades:** Retrieve past trade data.

The `getRawCandles` method offers the most flexibility for fetching candles, allowing you to specify start and end dates and limits. All of these methods are careful to avoid "look-ahead bias," meaning they only use data that would have been available at a given point in time.

## Class ClientAction

The `ClientAction` component is a central piece for managing how your custom logic, called action handlers, interacts with the trading framework. It’s responsible for setting up, running, and cleaning up these handlers.

Think of it as a lifecycle manager. It initializes your handler once, routes specific events to it—like signals from live trading, backtesting, or breakeven/profit/loss alerts—and then safely shuts things down when they're no longer needed.

Each handler can be built to handle various tasks, such as managing state, logging activity, sending notifications, or collecting analytics. The framework uses this component to seamlessly integrate your custom logic into the trading process.

The `waitForInit` and `dispose` methods ensure that initialization and cleanup happen only once, preventing unexpected issues.  The `signalLive`, `signalBacktest`, and other `signal...` methods act as pathways for different types of events to reach your handler’s specific logic.

`signalSync` provides a direct connection for managing position openings and closings using limit orders; any errors within that function will be passed up, so handle with care.

## Class CacheUtils

CacheUtils offers a simple way to cache the results of your functions, especially those used in trading strategies. It helps avoid redundant calculations by storing and reusing previously computed values. Think of it as a handy tool to speed up your backtesting process.

The `fn` method lets you wrap regular functions, caching their results based on specific time intervals (like 1-minute or 1-hour candles). This ensures that calculations related to those intervals are only performed once.

Similarly, the `file` method is for wrapping asynchronous functions. It uses file-based caching, so the results are persistently stored on disk, making it even more efficient for computationally expensive functions. Each unique function gets its own isolated cache instance, so changes to one don't impact others.

To clean up, you can use `dispose` to remove a specific function's cache, forcing it to recalculate. The `clear` function is for situations where the underlying file system changes, like when the working directory gets updated – it clears *all* cached data.

## Class BrokerBase

This `BrokerBase` class provides a foundation for connecting your trading strategies to real exchanges. Think of it as a template you customize to interact with a specific broker or exchange, like Binance, Coinbase, or Interactive Brokers.

It handles all the core tasks involved in trading, such as placing orders (both market and limit), adjusting stop-loss and take-profit levels, and tracking your positions.  Importantly, it provides pre-built “no-op” implementations for these functions, so you only need to override the parts that are unique to your exchange.  It also automatically logs all actions for easy tracking and debugging.

To get started, extend this class in your own code to handle the nuances of the exchange you want to use.  The lifecycle involves initializing the connection (`waitForInit`), and then reacting to events triggered by your trading strategy - like opening a new position (`onSignalOpenCommit`), closing a position (`onSignalCloseCommit`), or adjusting partial profits and losses.

These events are called during live trading; they're skipped during backtesting. You'll also find methods for managing trailing stops, take profits, breakeven points, and average buy entries – all designed to make automated trading smoother and more reliable. The framework takes care of most of the underlying communication and order processing, so you can focus on defining your trading logic.

## Class BrokerAdapter

The `BrokerAdapter` acts as a middleman between your trading logic and the actual broker you're using. It's designed to control how trading actions are sent to the broker, ensuring everything is validated and handled safely. Think of it as a gatekeeper for your trades.

During backtesting, the `BrokerAdapter` essentially does nothing—it quietly skips all the broker-related operations to speed up the simulation. When you're trading live, it forwards those operations to your registered broker.

This component includes several methods like `commitSignalOpen`, `commitPartialProfit`, and others, all of which allow you to intercept specific actions before they're finalized.  If one of these methods throws an error, it prevents any changes from happening, preserving the current state.

You register your chosen broker using `useBrokerAdapter`, and then activate the adapter with `enable`.  `enable` also subscribes it to certain signals, while `disable` lets you opt out.  There's also a `clear` function to ensure a fresh broker instance is used when needed, like when your environment changes.

## Class BreakevenUtils

BreakevenUtils helps you analyze breakeven events, providing a way to understand performance and identify patterns. Think of it as a tool for extracting insights from your trading data.

It gathers information about breakeven events—things like when a trade reached its breakeven point—and organizes it for easy analysis.

You can use it to get overall statistics about breakeven occurrences, like how many times breakeven was hit.

It also builds detailed reports in markdown format, presenting breakeven events in a clear, table-like structure. This report includes essential information for each event, such as the symbol, strategy used, entry and breakeven prices, and timestamps.

Finally, it can automatically save these reports as markdown files, making them easy to share or archive.  The file names are designed to be descriptive, based on the symbol and strategy used.

## Class BreakevenReportService

The BreakevenReportService helps you keep track of when your trading signals reach their breakeven point. It's like a record-keeper for your trades, specifically noting when a signal starts to become profitable.

It listens for these "breakeven" moments and saves them, along with details about the signal, into a database.

You can tell it to start listening for these events with the `subscribe` function, which gives you a way to stop listening later. The `unsubscribe` function handles stopping the process and ensures it only does so once to prevent issues. It’s designed to prevent multiple subscriptions accidentally happening. The service uses a logger to provide debugging information, which is helpful for troubleshooting.

## Class BreakevenMarkdownService

The BreakevenMarkdownService is designed to automatically create and save reports summarizing breakeven events for your trading strategies. It listens for these breakeven signals, keeping track of each one for specific symbols and strategies.

It then compiles this information into clear, readable markdown tables, providing statistics like the total number of breakeven events. These reports are saved to your computer, organized by symbol and strategy.

You can subscribe to receive these events, unsubscribe to stop, and even request specific data or generate reports on demand. There's also a way to clear all the accumulated data or just data for a particular symbol and strategy. This service helps you keep an organized record of your trading activity and identify potential patterns.

## Class BreakevenGlobalService

The BreakevenGlobalService acts as a central hub for managing breakeven tracking within the system. It's designed to be a single point of entry for strategies, simplifying how they interact with the underlying breakeven functionality. Think of it as a middleman – it receives requests, logs them for monitoring purposes, and then passes them on to the BreakevenConnectionService to handle the actual processing.

This service relies on several other services injected into it, like validation services for strategies, risks, exchanges, and frames, ensuring everything is properly configured. It has a built-in validation process that avoids repetitive checks. 

The `check` function determines if a breakeven event should occur, while `clear` resets the breakeven state when a signal is closed. Both of these operations are carefully logged before they are handled by the connection service, providing visibility into the entire breakeven process.

## Class BreakevenConnectionService

This service manages and tracks breakeven points for trading signals. It ensures that each signal has its own dedicated instance to keep track of its specific breakeven conditions. The service acts as a central point for creating, maintaining, and cleaning up these instances, preventing unnecessary memory usage.

It uses caching to efficiently manage these instances, creating them only when needed and reusing them for the same signal. This prevents redundant calculations and speeds up the process. The service also communicates events related to breakeven changes to a central system.

To work correctly, the service relies on other services for logging and action processing, which are provided through dependency injection. This allows for flexibility and modularity in the overall trading framework. When a signal is closed, the service not only clears its breakeven state but also removes the cached instance to free up resources.

## Class BacktestUtils

This class provides handy tools for running and analyzing backtests within the framework. It's designed to simplify common backtesting tasks and provides convenient access to several key operations.

The `run` method kicks off a backtest for a specific symbol and context, providing a stream of results. Alternatively, `background` lets you run a backtest silently in the background, useful for tasks like logging or callbacks.

Several methods offer insight into a pending or active position. `getPendingSignal`, `getTotalPercentClosed`, `getTotalCostClosed`, and others provide data like the current pending signal, the percentage of the position held, and the total cost basis.

You can also check if signals are pending or scheduled using `hasNoPendingSignal` and `hasNoScheduledSignal`, which are helpful for controlling signal generation logic.  `getBreakeven` checks if the price has reached a point where the trade is profitable enough to cover costs.

Beyond just running tests, the utility provides functions to inspect the current position’s health, like `getPositionEffectivePrice` (average entry price), `getPositionPnlPercent` (profit/loss percentage), and various methods offering details about DCA entries and partial closes.

Features to manage a backtest also exist, like `stop` which can halt a running backtest, and `commitCancelScheduled` & `commitClosePending` which allow manually triggering signals.  Several commit methods like `commitPartialProfit`, `commitAverageBuy`, and their cost counterparts allow for fine-grained control of trading logic.

Finally, `getData` and `getReport` provide means for data collection and report generation, and `list` displays the status of active backtests.  The `dump` method enables report saving to disk.

## Class BacktestReportService

The BacktestReportService helps you keep a detailed record of what your trading strategy is doing during a backtest. It listens for key events like when a signal is idle, opened, active, or closed, and saves all the specifics of those events.

Think of it as a data logger for your backtest, ensuring you have the information you need to understand and debug your strategy's behavior. 

It connects to the backtest process, captures every signal event, and securely stores the data for later analysis. You can subscribe to these events, but it prevents accidental duplicate subscriptions, and provides a simple way to stop listening when you’re done.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create and save detailed reports of your backtesting results. It keeps track of closed trading signals from your strategies as they happen, using a system that remembers data for each individual combination of symbol, strategy, exchange, timeframe, and whether it’s a backtest.

It generates these reports in a readable markdown format, perfect for analyzing your strategy's performance. This service saves those reports to files on your computer, organized within a logs/backtest folder, making it easy to review them later.

You can ask it for summaries of specific strategies or clear the data it's collected. You can also subscribe to receive updates as new ticks are processed and later unsubscribe when you no longer need those updates. The `subscribe` method returns a function that you can call to stop receiving updates. 

It uses a `loggerService` to display debugging information and a `getStorage` function to manage data, ensuring that each backtest has its own isolated area for storing information.

## Class BacktestLogicPublicService

This service helps manage and run backtests, making it easier to test your trading strategies. It automatically handles important details like the strategy name, exchange, and frame being used, so you don't have to pass them around explicitly.

Think of it as a wrapper around a more private service, providing a simpler, more convenient way to execute your backtests.

The `run` function is the main method for starting a backtest; it takes the symbol you want to backtest and automatically sets up the necessary context. It then generates a stream of results – essentially, the outcome of each trade signal, whether it's a buy, sell, or cancellation.

## Class BacktestLogicPrivateService

The BacktestLogicPrivateService is designed to efficiently manage and execute backtests using an asynchronous, streaming approach. It works by first obtaining timeframes from a frame service and then processing each timeframe one at a time. When a trading signal triggers an action, it retrieves the necessary candle data and runs the backtest logic. The service then skips ahead to the timeframe where the signal is closed before providing a completed result.

This architecture minimizes memory usage by streaming the backtest results as they become available, avoiding the need to store everything in an array. If you need to halt the backtest process before it’s complete, you can simply interrupt it.

To use the service, you provide a symbol, and it returns an asynchronous generator that will sequentially yield different types of results: scheduled ticks, opened signals, closed signals, and cancelled results. This allows for continuous monitoring and processing of the backtest's progression. The service relies on other core services like the logger, strategy, exchange, frame, method context, and action services to perform its functions.

## Class BacktestCommandService

This service acts as a central hub for executing backtests within the system. Think of it as the main gateway to start and manage your backtesting processes.

It simplifies how different parts of the system interact with the core backtesting engine, making it easier to manage dependencies.

Several supporting services – like those handling validation and schema management – are included to ensure the backtests are set up correctly and run smoothly.

You can use the `run` function to initiate a backtest. You'll need to provide the symbol you want to backtest, along with details about the strategy, exchange, and frame you’re using.  The `run` function returns a sequence of results, representing what happened during the backtest.


## Class ActionValidationService

The ActionValidationService helps you keep track of and make sure your trading actions are correctly set up. Think of it as a central place to register all the different actions your system can take, like buying or selling. 

It makes sure that each action is properly defined before anything tries to use it, preventing errors. This service also remembers the results of its checks so it can work quickly, especially when you have many actions.

You can add new actions using `addAction`, check if an action exists with `validate`, and see a complete list of all registered actions with `list`. The service uses a `loggerService` internally to help with debugging and tracks registered actions in an `_actionMap`.

## Class ActionSchemaService

The ActionSchemaService is like a central librarian for your trading actions. It keeps track of all the different action "blueprints" you use, making sure they're well-formed and consistent.

It uses a special system to store these blueprints safely and ensures that any code associated with an action only uses approved methods.

Here's a breakdown of what it does:

*   **Registration:** It lets you register new action blueprints, carefully checking that they are correct and don’t already exist.
*   **Validation:** Before registering a new blueprint, it performs a quick check to ensure the required parts are present and the available methods are permitted.
*   **Overrides:**  You can update existing blueprints with only the changes you need, instead of having to re-register the entire thing.
*   **Retrieval:** It provides a way to easily retrieve a specific action blueprint when needed.

It relies on a `LoggerService` to keep track of what’s happening and uses a tool called `ToolRegistry` for safe storage.

## Class ActionProxy

The `ActionProxy` acts as a safety net when using custom action handlers in your trading strategies. It's designed to prevent errors in your code from bringing down the entire trading system.

Think of it as a wrapper around your user-defined functions (like `init`, `signal`, `signalLive`, etc.) that automatically catches any errors that might occur within those functions. If an error happens, it’s logged, reported, and the process continues – without stopping the entire system.

The `ActionProxy` is created using a special `fromInstance` method, ensuring consistency and error handling. It also accounts for scenarios where you might not provide all the required functions; it handles these gracefully by returning `null`.

This framework is crucial for keeping your backtests and live trading systems stable and reliable. Specifically, the `signalSync` method is an exception to this rule and doesn’t get wrapped in error handling.


## Class ActionCoreService

The ActionCoreService acts as a central hub for managing and executing actions within your trading strategies. It essentially takes the instructions defined in your strategy's schema and translates them into actions that can be performed.

It handles retrieving action lists from strategy schemas, ensuring the strategy context (like strategy name, exchange, and frame) is valid, and validating risks and actions. Then, it systematically sends events to each of the registered actions in the correct sequence.

Several key functions allow you to trigger specific events and operations:

*   **`initFn`**: Initializes actions when a strategy begins.
*   **`signal`, `signalLive`, and `signalBacktest`**: Send data to actions based on the type of signal (live trading, backtesting).
*   **`breakevenAvailable`, `partialProfitAvailable`, `partialLossAvailable`**: Handle events related to profit and loss milestones.
*   **`pingScheduled` and `pingActive`**: Manage scheduled and active pings.
*   **`riskRejection`**: Handles situations where a signal fails a risk check.
*   **`signalSync`**: Ensures that all actions agree on a key state, like opening or closing a position.
*   **`dispose`**: Cleans up actions and resources when a strategy finishes.
*   **`validate`**: Checks the validity of your strategy configuration.
*   **`clear`**: Resets action data, either selectively or globally.

Essentially, this service makes sure that everything runs smoothly and consistently when your strategies are running, whether it's a live trade or a backtest.

## Class ActionConnectionService

The `ActionConnectionService` acts as a central dispatcher for routing different types of events – like signals, breakeven notifications, and scheduled pings – to the correct action handlers within your trading strategies. It cleverly avoids repeatedly creating these handlers by caching them based on the action's name, the strategy using it, the exchange involved, and the frame it's running in.

Think of it as a smart switchboard that directs calls to the right specialists. 

It uses memoization to remember which action handlers are already created, so it doesn't waste time recreating them every time. This caching is keyed by a combination of factors that ensures the correct handler is used for each specific strategy and frame.

The service also provides methods for initializing, disposing of, and clearing these action handlers, ensuring a clean and efficient workflow within your backtesting and live trading environments.  Specific events like risk rejections and synchronization requests are also routed through this service to their appropriate handlers.

## Class ActionBase

This class, `ActionBase`, serves as a foundation for creating custom actions within the backtest framework. Think of it as a starting point to extend and customize how your trading strategy interacts with the outside world—whether that's logging events, sending notifications, or managing data. It handles the repetitive tasks like logging, giving you the core functionality out-of-the-box.

You can think of it as a toolbox with pre-built tools; you only need to add your own specialized ones.

Here's a breakdown:

*   **Initialization:** When you create an action handler, you provide its name, frame, and whether it's for backtesting. The `init()` method is where you set up any asynchronous tasks.
*   **Event Handling:** The framework calls several methods (`signal`, `signalLive`, `signalBacktest`, `breakevenAvailable`, `partialProfitAvailable`, `partialLossAvailable`, `pingScheduled`, `pingActive`, `riskRejection`) as the strategy runs. Each method caters to specific events, such as a new signal, reaching a profit target, or a rejection by risk management. Live and backtest modes have separate signal handlers.
*   **Cleanup:** The `dispose()` method lets you gracefully shut down any resources used by your action handler when it's no longer needed.
*   **Built-in Logging:** Every method has default implementations that log these events, giving you a record of what's happening.
*   **Context:** You have access to details like the strategy name, frame name, and the action's name, which can be useful for identifying the source of events.



By extending `ActionBase`, you can build powerful custom actions without having to write boilerplate code, focusing on the unique logic of your trading strategy.
