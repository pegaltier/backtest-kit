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

The Walker Validation Service helps you keep track of and double-check your parameter sweep configurations, which are used for things like optimizing trading strategies or tuning hyperparameters. It acts like a central directory for your walkers, ensuring they're properly set up before you run any tests.

You can register new walkers using `addWalker`, and then confirm their existence with `validate` to avoid errors. To see what walkers are currently registered, use the `list` function. To speed things up, it also remembers the results of validations, so it doesn't have to repeatedly check the same walkers.

## Class WalkerUtils

WalkerUtils simplifies working with walkers, which are essentially sets of trading strategies evaluated together. Think of it as a helper tool for running and managing these strategy evaluations.

It provides a straightforward way to execute walkers, automatically handling some of the underlying setup based on how the walker is defined. You can easily run a comparison for a specific trading symbol and get results back.

There's also a way to run walkers in the background, which is useful if you just want to use them for things like logging or triggering other actions without needing to see the immediate results.

If you need to pause a walker’s signal generation, a `stop` function provides a clean way to do that, ensuring strategies finish their current actions before halting.

To see how a walker performed, you can retrieve its complete results or generate a formatted report as a markdown file.  You can even save this report directly to your hard drive.

Finally, WalkerUtils allows you to see a list of all the walkers that are currently running and their status, giving you a quick overview of what's happening. It's designed to be easily accessible, acting as a single point of contact for interacting with walkers.

## Class WalkerSchemaService

The WalkerSchemaService is responsible for keeping track of different walker schemas, ensuring they are correctly structured and accessible. It uses a special registry to store these schemas in a way that prevents errors due to incorrect types.

You can add new walker schemas using the `addWalker` function, and retrieve them later by their name using `get`.

Before adding a schema, `validateShallow` checks if it has all the necessary properties and that they are of the expected type, acting as a safety net.

If a schema already exists, you can update parts of it using `override`, allowing you to make changes without completely replacing the existing definition.

## Class WalkerReportService

The WalkerReportService helps you keep track of how your trading strategies are performing during optimization runs. Think of it as a dedicated record-keeper for your walker experiments. It listens for updates from the walker, capturing details like metrics and statistics from each test.

It stores this information in a SQLite database, allowing you to later analyze your optimization process, compare different strategy configurations, and identify your best-performing setups. 

You can subscribe the service to receive these updates, and it ensures that you don't accidentally subscribe multiple times. When you're finished, you can unsubscribe to stop the data logging.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you automatically create and save reports about your backtesting experiments. It listens for updates from your trading simulations (walkers), carefully tracks how each strategy is performing, and then organizes this information into easy-to-read markdown tables.

Each walker gets its own dedicated space to store results, ensuring that data from different simulations doesn't get mixed up.  You can subscribe to receive these updates in real-time, and unsubscribe when you're finished. 

The `tick` function is the key to processing each update from the walker and storing it.  You can then use `getData` to retrieve specific data points, `getReport` to generate the markdown report, and `dump` to save that report to a file. Finally, `clear` allows you to erase all accumulated data, or just the data for a specific walker, when you're ready to start fresh.

## Class WalkerLogicPublicService

This service helps coordinate and manage the execution of "walkers," which are components that analyze trading data. It builds upon a private service to automatically pass along important details like the strategy being used, the exchange it's operating on, and the name of the walker itself, simplifying how you work with them. 

Think of it as a helper that makes sure your walkers always have the information they need without you having to explicitly provide it each time.

It has a few key parts: a logger for recording events, the underlying private service that does the actual work, and a schema service for understanding the structure of your walkers. 

The core functionality is the `run` method, which lets you kick off a walker comparison for a specific stock ticker symbol, ensuring that context is automatically handled. This method essentially runs backtests across all strategies you've defined.

## Class WalkerLogicPrivateService

This service helps you compare different trading strategies against each other, like a tournament for your bots. It takes a specific financial instrument (symbol), a list of strategies you want to test, the metric you're using to judge performance (like profit or Sharpe ratio), and some contextual information about your testing environment.

As each strategy runs, you'll receive updates on its progress. The service keeps track of the best-performing strategy in real-time. Finally, it gives you a complete report at the end, ranking all the strategies based on how they did. 

Behind the scenes, it relies on another service to actually execute the backtests. Think of it as a manager overseeing the entire comparison process.

## Class WalkerCommandService

WalkerCommandService acts as a central point to interact with the walker functionality within the backtest-kit. Think of it as a convenient helper that simplifies accessing the core walker logic. It bundles together several specialized services to handle tasks like validating strategies, exchanges, and frames, and it's designed to be easily integrated into your application's dependency injection system.

The `run` method is the primary way to use this service. It allows you to execute a walker comparison for a specific trading symbol, ensuring that the right context (walker name, exchange name, and frame name) is passed along during the process.  Essentially, it kicks off the comparison process, providing you with a stream of results. 

The service also has properties to interact with services used internally.

## Class StrategyValidationService

This service helps you keep track of your trading strategies and make sure they're set up correctly. Think of it as a central place to register your strategies and double-check their configurations before you start trading. 

It allows you to add new strategies, with their specific setups, to a registry. The service performs a few checks – confirming the strategy exists, verifying any associated risk profiles are valid, and making sure any defined actions are also set up correctly. 

To make things faster, the service remembers the results of these checks, so it doesn’t have to re-validate strategies repeatedly. You can also easily get a list of all the strategies you've registered. It relies on other services for risk and action validation.

## Class StrategyUtils

StrategyUtils helps you analyze and understand how your trading strategies are performing. It's like a central hub for gathering reports and statistics about your strategies’ activity.

You can ask it for detailed statistical data, like how many times your strategy took profits, cut losses, or adjusted stop-loss orders. It collects this information from events triggered by your strategies.

Need a clear overview? StrategyUtils can generate a nicely formatted markdown report that summarizes all the events for a specific strategy, showing things like the signal ID, action taken, price, and timestamps. This report can be exported directly to a file on your computer, organized by symbol, strategy, and time.  Think of it as automatically creating a detailed logbook of your strategy’s activity.

## Class StrategySchemaService

This service acts as a central place to store and manage the blueprints, or schemas, for your trading strategies. It uses a special type-safe system to keep everything organized. You can add new strategy schemas using `addStrategy()`, and then easily find them again later by their name using `get()`. 

Before a strategy schema is officially registered, it's checked for essential details like required properties with `validateShallow` to ensure it's complete and correctly formatted. 

If you need to update an existing strategy's schema, you can use `override` to make changes without replacing the whole thing. It helps keep your strategy definitions consistent and manageable.

## Class StrategyReportService

This service is designed to keep a detailed record of your trading strategy's actions. Think of it as an audit trail, writing every significant event – like canceling scheduled orders, closing pending orders, or adjusting stop-loss levels – to individual JSON files. 

To start logging, you need to call `subscribe()`. Once subscribed, the service automatically writes events as they happen, ensuring you have a persistent record for later review. When you're done logging, use `unsubscribe()` to stop the process and clean up. 

The service relies on other components – a logger and a core strategy service – to function properly. Each of the event functions (like `cancelScheduled`, `closePending`, `partialProfit`, etc.) receive specific details about the event and format them into a structured JSON record for storage. These records provide a comprehensive history of your strategy's behavior.

## Class StrategyMarkdownService

This service helps you keep track of what's happening during your backtesting or live trading. It essentially acts like a detailed logbook for your strategies.

Instead of writing every action to a file immediately, it temporarily stores these actions in memory, allowing for more efficient reporting and analysis. Think of it as gathering data before presenting a neat summary.

To start using it, you need to "subscribe" to begin collecting events. Then, as your strategy executes (buying, selling, adjusting stop losses, etc.), this service automatically records those actions.  You can later retrieve statistics, generate nicely formatted markdown reports, or save those reports as files.  When you're done, "unsubscribe" to stop collecting data and clear everything.

It’s designed to be flexible, letting you customize which data is included in the reports and control how often and where those reports are saved. It also provides ways to clear the data it's holding, whether you want to clear everything or just specific strategy and symbol data.

## Class StrategyCoreService

This service acts as a central hub for managing strategy operations, seamlessly integrating with other services to handle execution context (like symbol, timeframe, and backtest settings). It's a foundational component used internally by backtesting and live trading logic.

It offers a variety of functions for interacting with strategies, including retrieving pending and scheduled signals, checking for breakeven and stop conditions, and executing actions like stopping, canceling, and closing signals.  These functions often work by delegating to other services – like StrategyConnectionService – to handle the underlying implementation.

For backtesting, it provides a 'backtest' method to run strategies quickly against historical data.  It also manages the lifecycle of strategy instances, handling their disposal and clearing from caches.  

Several functions – like `partialProfit`, `partialLoss`, `trailingStop`, `trailingTake`, `breakeven`, and `activateScheduled` – allow for adjustments to active pending signals, modifying aspects like stop-loss and take-profit levels.  These generally involve direct modifications to the strategy’s state.

The service also includes validation checks to ensure that strategies and configurations are correct, employing memoization to optimize performance. It logs these validation activities.

## Class StrategyConnectionService

This service acts as a central hub for managing and running trading strategies within the backtest-kit framework. It intelligently routes requests to the correct strategy implementation based on the specific symbol and strategy name being used. To ensure efficiency, it caches these strategy instances, so they don’t need to be recreated repeatedly.

Think of it as a dispatcher – you tell it which strategy you want to use for a particular asset (symbol), and it handles the rest.

Here's a breakdown of what it does:

*   **Smart Routing:** Directs requests (like getting signals or running ticks) to the right strategy.
*   **Caching:** Keeps frequently used strategies readily available for faster processing.
*   **Synchronization:** Makes sure strategies are fully initialized before any operations are performed.
*   **Comprehensive Management:** Handles both live trading (tick) and historical analysis (backtest) scenarios.

The service offers methods for retrieving pending and scheduled signals, checking for breakeven conditions, stopping strategies, clearing the cache, canceling and closing signals, and adjusting partial profits or losses. It also includes methods for adjusting trailing stop-loss and take-profit distances. Essentially, it gives you fine-grained control over how your strategies are executed and managed.

## Class StorageLiveAdapter

The StorageLiveAdapter acts as a flexible middleman for how your trading signals are stored. Think of it as a customizable container; it allows you to easily swap out the actual storage mechanism without changing the rest of your code.

By default, it uses persistent storage, meaning your signals are saved to disk. However, you can switch it to use memory-only storage for testing or a "dummy" adapter that essentially ignores all storage operations.

The adapter handles events like signals being opened, closed, scheduled, or cancelled, forwarding these actions to the currently selected storage. You can also retrieve signals by their ID or list them all.

Essentially, this adapter gives you control over where your trading signals live, making it easier to manage and test different storage strategies. You can change the underlying storage backend by providing a custom constructor, or simply switch between the default persistent storage, memory storage, and dummy storage using convenient helper functions.

## Class StorageBacktestAdapter

The StorageBacktestAdapter provides a flexible way to manage data during backtesting, allowing you to choose different storage methods without changing your core logic. Think of it as a middleman that can talk to different storage systems, like saving data to a file, keeping it in memory, or even just ignoring writes altogether for testing purposes.

You can easily switch between storage options with convenient helper methods: `usePersist` for saving to disk, `useMemory` for keeping data in RAM, and `useDummy` for completely ignoring storage writes. This makes it straightforward to test your backtesting strategy with different data persistence scenarios.

The adapter handles events like signals being opened, closed, scheduled, or cancelled, relaying those actions to the currently selected storage method. It also lets you find specific signals by their ID and list all stored signals.  You have full control over which storage implementation is used, which is great for customizing your backtesting environment.

## Class StorageAdapter

The StorageAdapter acts as a central hub for managing your trading signals, keeping track of both historical backtest data and live, real-time signals. It automatically updates as new signals are generated, making sure your data is always synchronized. You can easily access and retrieve signals, whether you're interested in examining past performance (backtest signals) or monitoring current market activity (live signals). To prevent accidental duplicates, it makes sure that subscriptions to signal sources only happen once. There’s also a way to cleanly shut down the storage and unsubscribe from all signals when you're finished, ensuring no lingering connections. 

You can control when storage is active using the `enable` property, which ensures a one-time subscription to the signal sources. The `disable` method provides a safe and simple way to stop the storage process, even if you call it multiple times. You can search for a specific signal using its ID with `findSignalById`, or list all signals from either the backtest or live data sets using `listSignalBacktest` and `listSignalLive` respectively.

## Class SizingValidationService

This service helps you keep track of and double-check your position sizing rules, making sure everything's set up correctly before you trade. It acts like a central record keeper for your sizing strategies, allowing you to register new ones and easily verify they exist.

Think of it as a safety net – before your trading system tries to use a sizing rule, this service validates it's actually there.

The service also remembers the results of these checks to speed things up. You can add sizing rules using `addSizing`, confirm they’re available with `validate`, and see a complete list of all registered rules using `list`. It’s designed to simplify managing your sizing configurations and prevent errors.

## Class SizingSchemaService

The SizingSchemaService helps you keep track of different sizing strategies for your trading system. It acts like a central library where you can store and retrieve these strategies, making sure they're all structured correctly.

You can think of it as a place to register your sizing rules – how much to trade – and then easily access them later by name. The service uses a special registry to ensure everything is typed correctly and avoids unexpected errors.

To use it, you’ll add sizing schemas using `register`, update existing ones with `override`, and get them back with `get`. There's also a built-in check to make sure the sizing schema you're adding has all the necessary pieces before it's saved.

## Class SizingGlobalService

This service helps determine how much of an asset to trade, acting as a central point for calculating position sizes. It uses a connection service to manage the details of those calculations and another service to ensure the sizing is valid. Think of it as the brain behind deciding how much to buy or sell, based on factors like risk tolerance. 

It's used both within the backtest-kit's internal workings and by the parts of the system you might directly interact with. 

Inside, it keeps track of logging and connection services for managing information and coordinating sizing calculations. The core function, `calculate`, takes information about your desired trade and the current context, and then returns the suggested position size.

## Class SizingConnectionService

The SizingConnectionService acts as a central hub for calculating position sizes within your backtesting system. It intelligently directs sizing requests to the specific sizing method you've configured, whether it's a fixed percentage, Kelly Criterion, or something else. 

To improve performance, it remembers which sizing methods have already been loaded, avoiding unnecessary re-creation. Think of it as a smart router that ensures the right sizing logic is used and that it’s reused efficiently. 

When you need to calculate a position size, you provide a name identifying the sizing method, and the service handles the rest, factoring in your risk parameters. If a sizing method hasn't been used before, it will be created and cached for future use. The `sizingName` is simply left blank if your strategy doesn’t use a specific sizing configuration.

## Class ScheduleUtils

ScheduleUtils is a helper tool designed to make it easier to monitor and report on scheduled signals within your trading system. Think of it as a centralized place to keep track of signals that are waiting to be executed and to understand how well they're being processed.

It keeps tabs on signals that are queued up, any that have been cancelled, and can even calculate things like how often cancellations happen and how long signals typically wait. 

You can request data about specific symbols and strategies, get nicely formatted markdown reports outlining signal activity, or save those reports directly to a file. This utility is always available as a single instance, making it simple to use throughout your backtest-kit project.

## Class ScheduleReportService

The ScheduleReportService helps you keep track of how your scheduled trading signals are performing. It monitors the lifecycle of these signals, recording when they're scheduled, when they start executing, and when they’re cancelled. This allows you to analyze delays in order execution and identify potential issues in your trading strategy.

It works by listening for signal events and logging them, along with the time it takes from scheduling to execution or cancellation. The service ensures you don’t accidentally subscribe multiple times, and provides a straightforward way to stop monitoring these signals. It stores this data in a database, allowing for detailed tracking and analysis of your scheduled trades. 

You'll find properties for logging and the tick processing functionality, along with methods to subscribe to signal events and unsubscribe when you no longer need them.

## Class ScheduleMarkdownService

This service automatically creates reports detailing scheduled signals for your trading strategies. It keeps track of when signals are scheduled and cancelled, gathering information about each event. The service then organizes this data into easy-to-read markdown tables, including useful statistics like cancellation rates and average wait times.

You can request these reports for specific strategies and symbols, and the service will save them as files in the `logs/schedule/` directory. There's also a way to clear out this accumulated data if you need to start fresh. The system carefully manages how it stores this data, creating separate storage for each unique combination of symbol, strategy, exchange, frame, and backtest to prevent interference. You can subscribe to receive these reports in real-time or request them on demand.

## Class RiskValidationService

This service helps you keep track of your risk management setups and make sure they're all valid before you start trading. Think of it as a central place to register your risk profiles—like the rules you have in place to protect your capital—and a way to double-check they're correctly configured.

You can add new risk profiles using `addRisk()`, and then use `validate()` to confirm that a specific risk profile exists before using it in your trading strategies. The service is designed to be efficient, caching the results of validations to avoid unnecessary checks. Finally, `list()` gives you a quick overview of all the risk profiles you've registered.

## Class RiskUtils

The RiskUtils class helps you understand and analyze risk rejections that occur during backtesting or live trading. It acts as a central place to gather information about these rejections and present them in a useful way.

Think of it as a tool for reviewing why trades were rejected, letting you identify potential problems in your strategies or risk management rules.

You can use it to:

*   Get statistics about the rejections, like how many occurred, and broken down by symbol and strategy.
*   Create nicely formatted markdown reports summarizing the rejection events. These reports show details like the symbol, strategy, position, price, and the reason for the rejection.
*   Save those reports to files so you can easily share them or keep a record of past issues.

The information comes from a system that listens for risk rejection events and stores them, allowing you to examine trends and spot areas for improvement.

## Class RiskSchemaService

The RiskSchemaService helps you keep track of your risk profiles in a structured and type-safe way. It acts like a central place to store and manage these profiles, ensuring they all have the necessary information.

You can add new risk profiles using the `addRisk()`-like functionality (actually `register`), and easily retrieve existing ones by their name with the `get()` method. Before a new profile is added, it checks to make sure the basic structure is correct with `validateShallow`, catching potential errors early on.

Need to update a profile?  The `override()` method allows you to make changes to existing profiles, only updating the parts you need to. The service uses a specialized registry to safely store all your risk schemas, making it a reliable system for managing this critical data.

## Class RiskReportService

This service helps you keep a record of when your risk management system rejects trading signals. Think of it as a detailed logbook for those rejections, storing information about why a signal was blocked and what the signal looked like. 

It listens for these "risk rejection" events and automatically saves them to a database, making it easier to analyze risks and audit your trading decisions. You subscribe to this service to start receiving these events, and it makes sure you don't accidentally subscribe multiple times. When you're done, you can unsubscribe to stop the logging. This allows tracking of rejected signals, along with the reasons and details, to understand and improve your risk management processes.

## Class RiskMarkdownService

The RiskMarkdownService helps you automatically create detailed reports about risk rejections within your trading system. It listens for risk rejection events and organizes them by symbol and strategy, essentially keeping track of when trades are blocked due to risk controls.

You can think of it as a reporting engine that generates readable markdown tables summarizing these rejections, along with useful statistics like the total number of rejections and breakdowns by symbol and strategy. It then saves these reports as `.md` files, making it easy to review and analyze your risk management effectiveness.

The service is designed to be flexible; you can subscribe to receive rejection events, unsubscribe when you don't need them, and retrieve the accumulated data or generate reports for specific symbol-strategy combinations. The `clear` function lets you easily wipe the accumulated data if needed, either for everything or just a specific combination.

## Class RiskGlobalService

This service acts as a central hub for managing risk within the trading framework. It handles validation of risk configurations, ensuring that trading decisions adhere to pre-defined limits. The service utilizes a connection to a risk management system and offers methods to check if a trading signal is permissible, register open positions, and remove closed positions from the system's records.  It also includes a way to clear all or specific risk data for maintenance or testing purposes. Essentially, it's the gatekeeper that makes sure trading activity stays within safe and defined boundaries.

## Class RiskConnectionService

The RiskConnectionService acts as a central point for managing risk checks within the trading framework. It intelligently directs requests to the correct risk management component based on a specified risk name, ensuring that risk assessments are applied appropriately. To make things efficient, it remembers (caches) those risk components so it doesn't have to recreate them every time – a significant performance boost.

Essentially, it handles validating signals against risk limits, considering factors like drawdown and exposure. When a signal fails a risk check, the system notifies interested parties. It also provides methods for registering and removing signals from the risk management system, keeping track of open positions.  You can even clear the cached risk components if needed, providing flexibility in how you manage risk. For strategies without custom risk configurations, a default, empty risk setting is used.

## Class ReportUtils

ReportUtils is a helper class designed to simplify how you manage and control reporting for your trading framework. It lets you easily turn on and off detailed logging for different parts of your system, like backtesting, live trading, or performance analysis.

The `enable` method allows you to pick and choose which services you want to log, and it returns a function you *must* call later to stop the logging. Think of it as subscribing to receive reports and needing a way to unsubscribe when you're done. This ensures you don’t have lingering processes consuming resources.

Conversely, the `disable` method lets you turn off logging for specific services without affecting others. It's a straightforward way to pause detailed logging when it’s not needed. It doesn't require a separate unsubscribe function, as it handles the cleanup immediately.



This class is usually extended by `ReportAdapter` for even more customized reporting options.

## Class ReportBase

This class provides a way to record trading events as JSONL files, making it easy to analyze your backtesting results later. Think of it as a dedicated logging system that automatically creates the necessary folders and files.  It handles writing data efficiently, even when things get busy, and includes built-in safeguards to prevent issues like data loss due to timeouts.

The `reportName` identifies the specific type of data being logged, and the `baseDir` determines where these log files are stored.  You can safely call the `waitForInit` method multiple times without causing problems – it only initializes the file and stream once.  The `write` method is your primary tool for recording events; it combines your data with important metadata like the symbol being traded, the strategy used, and a timestamp.  This metadata makes it simpler to filter and search your data later for insights.

## Class ReportAdapter

The ReportAdapter helps you manage and store your trading data in a structured way, like logs for backtests or live trading sessions. It's designed to be flexible – you can easily swap out different storage methods without changing much of your core code.

It keeps track of different report types (backtest, live trading, etc.) and makes sure you only have one instance of each storage system running at a time, which helps with efficiency.

By default, it uses JSONL files to store information, but you have the option to change this to other storage options or even a “dummy” adapter that just throws away data for testing.  The adapter automatically sets up storage the first time you write data to a specific report type.

You can easily change how reports are stored by using `useReportAdapter`.  `useDummy` lets you disable writes completely, and `useJsonl` goes back to the standard JSONL setup.

## Class PositionSizeUtils

This class offers helpful tools for figuring out how much of an asset to trade – essentially, how to size your positions. It's designed to make calculating position sizes easier, with pre-built methods for different strategies.

You'll find a few different ways to calculate position size here, including:

*   **Fixed Percentage:** This method uses a set percentage of your account balance for each trade.
*   **Kelly Criterion:** This more advanced approach considers your win rate and the ratio of your wins to losses to determine an optimal position size.
*   **ATR-Based:** This method factors in the Average True Range (ATR), a measure of price volatility, to help size your positions appropriately.

Each of these methods does some behind-the-scenes checks to make sure the information you provide is correct for the specific sizing approach you're using. They all work by taking in information like your account balance, the asset's price, and other relevant data to spit out a recommended position size.

## Class PersistStorageUtils

This utility class helps manage how signal data is saved and loaded, ensuring a reliable and consistent experience. It cleverly memoizes storage instances, which means it avoids creating unnecessary copies and improves efficiency. You can even customize how the data is stored by using different adapters, giving you flexibility in your setup.

The class reads and writes signal data to disk, with each signal’s information stored in its own file, organized by a unique identifier. To prevent data loss in unexpected situations, it uses atomic operations to write files, guaranteeing that data isn't corrupted if something goes wrong during the saving process.

If you want to test things without actually saving anything, there’s a dummy adapter that just ignores all write attempts. To get started with the standard approach, there's a built-in JSON adapter that you can easily enable.  The `readStorageData` function loads the previously saved signal information, crucial for restoring the system’s state, while `writeStorageData` is used to update the saved data when changes occur.

## Class PersistSignalUtils

This class helps strategies remember their state, especially important for live trading. It acts as a central hub for saving and retrieving signal information.

It's designed to keep things safe and reliable, using techniques like atomic writes so that data isn't lost even if something goes wrong. You can even plug in your own custom ways to store this data.

The class includes handy shortcuts: you can easily switch between using a standard JSON format, a dummy adapter that doesn't actually save anything (useful for testing), or bring your own specialized storage solution.

Think of it as a safe deposit box for your strategy's data, ensuring it can pick up where it left off. The `readSignalData` method gets the data back, and `writeSignalData` saves the latest version.

## Class PersistScheduleUtils

This class helps keep track of scheduled signals for your trading strategies, ensuring they're saved and restored reliably. It cleverly uses a system where each strategy has its own separate storage area, making it organized and efficient.

You can even customize how these signals are stored by plugging in your own persistence adapters.  

The `readScheduleData` method retrieves any existing scheduled signal data for a particular symbol and strategy, and it will return nothing if no signal is found.  `writeScheduleData` then safely saves changes to disk, using special techniques to protect against data loss if something goes wrong.

For testing or development, you can switch to a "dummy" adapter that simply ignores any attempts to save data, or revert back to the default JSON-based storage. Finally, you can register your own custom persistence mechanism with `usePersistScheduleAdapter`.

## Class PersistRiskUtils

This class helps manage how trading positions are saved and loaded, especially when dealing with different risk profiles. It’s designed to keep track of active positions safely and reliably, even if something unexpected happens.

Think of it as a central place to store information about your open trades, making sure that data is consistent and available when you need it.

It offers flexibility too, allowing you to choose different ways to store that information, like using standard JSON files or even a dummy adapter for testing purposes where you don't want anything actually saved. 

The `readPositionData` function retrieves saved positions, while `writePositionData` saves them – both done in a way that protects against data loss. This is particularly important for keeping track of what's happening in a live trading environment. You can also plug in your own custom storage solutions if the built-in ones don't quite fit your needs.

## Class PersistPartialUtils

This class, `PersistPartialUtils`, helps manage how your trading strategy's partial profit and loss information is saved and restored, especially when the strategy is running live. It’s designed to be reliable, even if your system crashes unexpectedly.

It keeps track of these partial profit/loss levels separately for each symbol and strategy, using a system that remembers these data points and lets you customize how they're stored. The way it saves data is built to be safe and avoid corruption.

You can even plug in your own ways of saving and loading this information, or switch to a “dummy” mode where data isn’t saved at all for testing purposes. The `readPartialData` function is used to load up previously saved partial profit/loss levels when your strategy starts, and `writePartialData` makes sure that any changes are saved correctly.

## Class PersistNotificationUtils

This class helps manage how notifications are saved and loaded, ensuring their state is preserved even if things go wrong. It acts as a central helper for other notification persistence tools.

It keeps track of where notifications are stored, and allows you to customize how that storage works, using different adapters if needed. You can switch between a standard JSON-based storage, a dummy adapter that simply ignores writes (useful for testing), or even provide your own custom storage mechanism.

The class handles reading and writing notification data, guaranteeing that these operations are done safely and in a way that protects against data loss during crashes. Each notification is stored as its own individual file, making it easy to manage and recover specific notification details. It’s designed to be used by other tools like those used in live trading and backtesting environments to ensure notifications are always reliably saved and restored.

## Class PersistCandleUtils

This class helps manage and store candle data, acting like a persistent cache for your trading framework. It organizes candle data into individual files, making it easy to manage and validate the cache. The system checks if all expected candle files exist before returning data, ensuring you only get complete sets. 

It's designed to work with ClientExchange, allowing it to efficiently store and retrieve historical candle data. You can even swap out the storage method – choosing between JSON, a dummy adapter that effectively ignores writes, or providing your own custom persistence solution. The `readCandlesData` function meticulously verifies the cache's integrity before returning data, and `writeCandlesData` carefully organizes the writing process.

## Class PersistBreakevenUtils

This class helps manage and save your breakeven data, which is crucial for keeping track of your trading strategy’s progress. It automatically handles reading and writing this data to files on your computer, ensuring that your progress isn’t lost.

Think of it as a central place where your trading strategy's "memory" is stored. It makes sure that when you restart, your strategy picks up where it left off.

It cleverly creates and manages these storage areas to avoid conflicts, ensuring that each strategy on each trading pair has its own dedicated space. You can even customize how this data is stored if you want, and there's a handy "dummy" mode for testing purposes that simply ignores any write operations.

## Class PersistBase

PersistBase provides a foundation for saving and retrieving data to files, ensuring your data remains safe and consistent. It's designed to handle file operations reliably, even if things go wrong. 

The `entityName` identifies the type of data you’re storing, and `baseDir` defines the main folder where these files are kept.  The system automatically manages the specific storage directory based on these settings.

It offers methods to read, write, and check for the existence of data, all while protecting against data corruption through atomic file writes.  You can easily iterate over all the IDs of the data being stored using the `keys` generator, which presents them in a sorted order.  The `waitForInit` method ensures the storage directory is properly set up and checks for any damaged files when things start.

## Class PerformanceReportService

This service helps you keep track of how long different parts of your trading strategy take to run, which is really useful for finding bottlenecks and making things faster. It listens for timing events as your strategy executes and records those events in a database.

You can think of it as a performance monitor that automatically gathers data for you. It ensures you don't accidentally subscribe multiple times, preventing unexpected behavior. To start collecting this performance data, you subscribe to the service, and to stop, you simply unsubscribe. This allows for easy control over when performance metrics are being logged.

## Class PerformanceMarkdownService

This service helps you keep track of how your trading strategies are performing. It listens for performance updates and organizes them, letting you see key statistics like average, minimum, and maximum values.

It automatically generates reports in a readable markdown format, providing insights into potential bottlenecks in your strategy's execution. These reports are saved to your logs directory.

You can subscribe to receive performance updates, and the service ensures you don't accidentally subscribe multiple times. You can also retrieve performance data and generate reports for specific symbols and strategies. 

The service lets you clear out old performance data when you're ready to start fresh. Each combination of symbol, strategy, exchange, timeframe, and backtest type gets its own dedicated storage space.

## Class Performance

The Performance class helps you understand how well your trading strategies are performing. It provides tools to gather and analyze performance statistics for specific symbols and strategies.

You can retrieve detailed performance data, broken down by different operations, giving you insights into metrics like duration, volatility, and potential outliers. 

It also allows you to generate clear, readable reports in Markdown format, visualizing the time spent on various operations and highlighting possible bottlenecks. These reports can be saved directly to your hard drive for later review or sharing. 

Essentially, this class provides a convenient way to monitor, diagnose, and improve the efficiency of your backtesting and live trading systems.

## Class PartialUtils

This class helps you understand and share information about partial profits and losses in your backtesting or live trading. It's like a handy tool that gathers data about small wins and losses and presents it in an organized way.

You can ask it for overall statistics, like the total number of profit and loss events.  It can also generate detailed reports in a readable markdown format – imagine a table showing each profit or loss with its details like symbol, strategy, signal ID, price, and timestamp.  This makes it easy to review what’s happening.

Finally, you can easily save those reports as files, so you can share them or keep them for later analysis. The files are named clearly, so you know exactly what symbol and strategy they relate to. It takes care of creating the necessary folders for you, too.

## Class PartialReportService

This service helps you keep track of how your trades are performing by recording every partial exit, whether it’s a profit or a loss. It listens for signals indicating a partial trade closure and saves that information—like the price and level at which the trade exited—to a database.

To get it working, you’ll need to subscribe it to the relevant event streams that announce these partial closures. Once subscribed, the service diligently logs each partial exit.

If you decide you no longer need to track partial exits, you can easily unsubscribe to stop the logging. The service is designed to prevent accidentally subscribing multiple times, ensuring a clean and reliable operation. It uses a logger for debugging output to help you understand what it’s doing.

## Class PartialMarkdownService

The PartialMarkdownService helps you keep track of your trading performance by creating reports on partial profits and losses. It listens for these events as they happen, organizing them by the symbol being traded and the strategy used. Think of it as a detailed log of your wins and losses during a trade.

This service compiles that data into nicely formatted markdown tables that you can easily review and understand, providing you with insights into your trading activity. It also calculates overall statistics, like the total number of profit and loss events.

You can then save these reports to your computer, making it easy to archive and analyze your trading history. You have the flexibility to save reports for specific symbol/strategy combinations or clear all accumulated data if needed. The service ensures that data for each unique trading scenario (symbol, strategy, exchange, timeframe, backtest status) is kept separate and organized.

## Class PartialGlobalService

This service acts as a central hub for managing partial profit and loss tracking within your trading strategies. It simplifies things by providing a single place for ClientStrategies to access these features, making it easier to monitor and control how partials are handled. Think of it as a middleman; it receives requests related to profit, loss, and clearing partials, logs them for auditing and monitoring, and then passes them on to the underlying PartialConnectionService to do the actual work.

It's designed to be injected into your strategies, and relies on other services to validate configurations and schemas.  The `validate` function helps ensure that your strategies are set up correctly and avoids unnecessary checks.

The `profit`, `loss`, and `clear` functions are the main actions it handles, and each one logs the operation before forwarding it to the PartialConnectionService.

## Class PartialConnectionService

The PartialConnectionService helps track profits and losses for individual trading signals. Think of it as a central manager that keeps tabs on how each signal is performing. 

It avoids creating unnecessary objects by cleverly caching them using a technique called memoization – essentially remembering previously created instances. Each signal gets its own dedicated record for profit/loss tracking.

When a signal starts making money or losing money, this service handles the updates and notifications. When a signal is closed, it cleans up its record to prevent clutter and ensure things run efficiently. 

It works closely with the broader trading system, receiving instructions and passing tasks along to specialized components. You don’t need to worry about creating or managing these individual tracking records directly, the PartialConnectionService takes care of it all.

## Class NotificationLiveAdapter

This class, `NotificationLiveAdapter`, helps you manage and send notifications about your trading strategies. Think of it as a central hub for all those "heads-up" messages you want to receive during live trading.

It's designed to be flexible, so you can easily swap out different notification methods – like sending alerts to a database, displaying them in a memory store, or even just ignoring them entirely (using the dummy adapter).

The adapter handles various events, such as signals, partial profits or losses, errors, and validation issues, forwarding them to the currently selected notification system. You can choose between storing notifications in memory, persisting them to disk, or using a dummy adapter that effectively silences them. The `usePersist()`, `useMemory()`, and `useDummy()` methods make switching between these options simple. If you need to retrieve all notifications or clear them, `getData()` and `clear()` are your go-to methods. You can even change the underlying notification mechanism at any time using `useNotificationAdapter()`.

## Class NotificationBacktestAdapter

This component manages notifications within your backtesting environment, providing a flexible way to handle events like signals, profits, losses, and errors. It uses an adapter pattern, meaning you can easily swap out the underlying notification implementation—whether you want to store notifications in memory, persist them to disk, or simply discard them (using the dummy adapter).

The `handleSignal`, `handlePartialProfit`, `handlePartialLoss`, `handleBreakeven`, `handleStrategyCommit`, `handleRisk`, `handleError`, `handleCriticalError`, and `handleValidationError` methods act as intermediaries, passing these events on to the currently selected notification adapter.  You can retrieve all stored notifications with `getData` and clear them completely using `clear`. 

To change how notifications are handled, you can use the convenience methods `useDummy`, `useMemory`, and `usePersist` to switch between different adapter configurations. For more advanced customization, the `useNotificationAdapter` method allows you to provide a custom notification adapter constructor. The default behavior uses in-memory storage.

## Class NotificationAdapter

The NotificationAdapter is the central hub for managing notifications during backtesting and live trading. It automatically keeps track of notifications as they happen, ensuring you don't miss any important events. You can easily access both backtest notifications and live notifications through this adapter, and it prevents duplicate subscriptions to avoid unnecessary clutter. To stop notifications, you can disable the adapter – it’s safe to do this repeatedly. If you need to retrieve all notifications or clear them out, there are convenient functions for both backtest and live data.

## Class MarkdownUtils

This class helps you control which parts of the backtest-kit framework generate markdown reports. Think of it as a central switchboard for markdown reporting.

You can use it to turn on markdown reports for specific areas, like backtesting, live trading, or performance analysis. When you enable a service, it starts collecting data and generating reports – but be sure to clean up afterwards to avoid memory problems!  There’s a special function it gives you that lets you turn off all the enabled services at once.

Conversely, you can disable markdown reports for particular components without affecting others. This is useful when you only need reports for certain scenarios.  Unlike enabling, disabling doesn’t give you a cleanup function; it stops reporting immediately. 

Essentially, it gives you fine-grained control over when and where markdown reports are created.

## Class MarkdownFolderBase

This adapter is designed for creating well-organized reports where each report is saved as its own markdown file within a directory structure. Think of it as the standard way to generate reports for easy browsing and manual review. 

It automatically creates the necessary folders to hold your reports, and the filename and location are controlled by the options you provide.  There’s no need to worry about managing streams; it simply writes the markdown content directly to the designated file. 

The `waitForInit` method is essentially a placeholder because this adapter doesn't require any setup before it can write reports. The `dump` method is the core functionality, handling the writing of report content to individual markdown files with the specified filename and location.

## Class MarkdownFileBase

This component handles writing markdown reports in a structured, append-only format to a JSONL file. Think of it as a way to log your markdown outputs—like performance reports or visualizations—in a machine-readable format. It organizes these reports into individual files, each representing a different type of markdown report.

The system automatically creates the necessary directory structure and handles writing data in chunks, which helps prevent issues when dealing with large reports. It includes built-in safeguards to prevent timeouts during writing operations and ensures that only one initialization process occurs.

You can easily search these reports later using metadata like the trading symbol, strategy name, exchange, frame, and signal ID, making it simple to filter and analyze specific events.  The `dump` method is your primary tool for adding new markdown content, automatically adding metadata and a timestamp. It’s designed for centralized logging and easy integration with other JSON processing tools.

## Class MarkdownAdapter

The MarkdownAdapter helps you manage how your markdown data is stored, offering flexibility and efficiency. It's designed to let you easily switch between different storage methods without changing your core code.

You can choose between storing your markdown as individual files, appending to a single JSONL file, or even using a dummy adapter that does nothing – useful for testing or situations where you don’t need to persist the data.

The system remembers your storage configurations so that you don’t have to recreate them repeatedly. It automatically creates the necessary storage when you first write data.

You have control over the type of storage used via the `useMarkdownAdapter` method, and convenient shortcuts `useMd` and `useJsonl` exist for the most common storage choices. The system defaults to storing each markdown type in separate files.

## Class LoggerService

The LoggerService helps ensure your backtesting framework logs information in a clear and organized way, automatically adding useful details to each message. It allows you to provide your own logging solution, but if you don't, it defaults to a basic "no-op" logger that doesn't actually log anything. 

This service automatically includes information like which strategy, exchange, and frame are being used, alongside the specific symbol, timestamp, and whether it's a backtest scenario. You can customize the logging behavior by setting a custom logger.

The `log`, `debug`, `info`, and `warn` methods are essentially shortcuts for creating log entries at different severity levels, with the contextual information automatically added. It uses `methodContextService` and `executionContextService` internally to manage the added context.

## Class LiveUtils

This class provides tools for live trading operations, acting as a central point for interacting with the live trading system. It's designed to make running and managing live strategies easier and more robust.

The `run` method kicks off live trading for a specific symbol and strategy, continuously generating trading signals in an ongoing process that automatically recovers from crashes by restoring saved state.  You can also run strategies in the background with `background`, which is useful when you only want the system to perform actions like persisting data or triggering callbacks without you needing to directly process the trade results.

Need to check on the current status of a strategy?  `getPendingSignal` and `getScheduledSignal` retrieve details about active signals.  `getBreakeven` determines if a signal has reached a price level that covers transaction costs.

For controlling the strategies, `stop` pauses new signal generation, while `commitCancelScheduled`, `commitClosePending`, and similar methods allow fine-grained control over individual signals without halting the entire process.  You can even adjust trailing stop-loss and take-profit levels with `commitTrailingStop` and `commitTrailingTake`, ensuring your strategies adapt to changing market conditions. These trailing functions are important as they always operate based on the original stop-loss/take-profit distances, preventing error accumulation.

Finally, utility functions like `getData`, `getReport`, and `dump` help you monitor and analyze the performance of your live trading strategies, and `list` provides a quick overview of all currently running strategies. The `commitActivateScheduled` allows for manually triggering a scheduled signal.

## Class LiveReportService

This service is designed to keep a real-time record of what your trading strategy is doing as it runs. It essentially acts as a live logger, capturing key events like when a strategy is idle, when a position is opened, when it’s actively trading, and when it's closed.

The service listens for these events from your strategy and stores them in a database, allowing you to monitor and analyze the strategy's performance as it's happening.

You can easily start and stop the logging process by subscribing and unsubscribing. Because of a safety feature, you'll only be able to subscribe once at a time, preventing any issues with duplicate logs. When you're finished, the `unsubscribe` method cleanly stops the logging.

## Class LiveMarkdownService

The LiveMarkdownService automatically generates reports about your trading activity as it happens. It listens for every signal event, like when a strategy is idle, opening a position, actively trading, or closing a trade, and carefully records all the details. 

It then compiles this information into well-formatted markdown tables, providing you with statistics like win rate and average profit/loss.  These reports are saved as `.md` files in a dedicated logs directory, making it easy to review your strategy's performance.

You can subscribe to receive these real-time updates, and unsubscribe when you no longer need them.  The service offers methods to retrieve the accumulated data, generate specific reports, save them to disk, and even clear out the stored data if you want to start fresh.  It uses a clever storage system that keeps data separate for each symbol, strategy, exchange, timeframe, and backtest combination, ensuring your reports remain organized.

## Class LiveLogicPublicService

This service helps manage and run live trading sessions, making it easier to work with your strategies. It automatically handles things like knowing which strategy and exchange you're working with, so you don't have to pass that information around constantly. 

Think of it as a central coordinator for your live trading logic. It continuously streams trading results – signals to open, close, or cancel positions – and it's designed to keep running indefinitely.  Even if something goes wrong and the process crashes, it can recover and pick up where it left off thanks to state persistence. It uses the current time to ensure accurate, real-time progression of trades.

## Class LiveLogicPrivateService

This service handles the ongoing, real-time execution of your trading strategies. It works by continuously monitoring the market and reacting to signals, essentially acting as the engine that powers your live trading.

Think of it as an always-on loop: it checks for new signals, records what’s happening (new orders placed or closed), and then pauses briefly before checking again. This process is designed to be resilient – if something goes wrong, it will automatically recover and pick up where it left off.

The key benefit here is a continuous stream of results that you can easily process without overwhelming your system, as it's built to be memory-efficient.  It's a generator, meaning it provides results as they become available, rather than waiting for a whole batch to be ready.  The `run` method kicks off this continuous monitoring for a specific trading symbol.

## Class LiveCommandService

This service lets your applications interact with the live trading environment. Think of it as a central hub for executing trades and receiving updates.

It's designed to be easily integrated into other parts of your system, making it straightforward to inject dependencies.

Inside, it uses other services to handle things like validating your trading strategy, checking exchange information, and ensuring everything is safe and compliant.

The core function, `run`, is what actually starts the live trading process for a specific asset. It continuously provides real-time updates about trades, including when they open, close, or are cancelled, and it’s built to automatically recover if something goes wrong. It essentially keeps the trading process running smoothly and consistently.

## Class HeatUtils

HeatUtils is a helpful tool for visualizing and analyzing your trading strategy's performance. It gathers data across all your symbols to give you a clear picture of how your portfolio is doing.

You can easily request the underlying data using `getData`, which provides a breakdown of performance for each symbol as well as overall portfolio metrics.

The `getReport` method lets you create a nicely formatted markdown table showing key stats like total profit, Sharpe Ratio, maximum drawdown, and trade count, sorted by profit.

Finally, `dump` is there to save that report to a file so you can share it or review it later. It will even create the necessary folder if it doesn’t exist, and names the file after your strategy.

## Class HeatReportService

This service helps you track and analyze your trading performance by recording closed signals. It's designed to gather data about when trades end, specifically focusing on the profit and loss (PNL) associated with those closures.

The service listens for these closed signal events and stores the information in a database, which you can then use to create heatmaps – visual representations of your trading activity across different assets. It’s built to ensure you don’t accidentally subscribe multiple times, preventing data duplication.

You can start receiving these signal updates by using the `subscribe` function, and when you're done, use the `unsubscribe` function to stop the data collection. The `tick` property is where the main processing of closed signals happens, and the `loggerService` is there to help with debugging.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and understand the performance of your trading strategies. It keeps track of closed trades across different symbols and strategies, giving you a clear picture of how your portfolio is doing. 

You can think of it as a central hub that gathers data from your trading signals, calculates key metrics like profit/loss, Sharpe Ratio, and maximum drawdown for each symbol and overall portfolio, and then presents this information in a nicely formatted Markdown table. 

The service makes sure it handles tricky math situations gracefully, and it remembers previously calculated data to speed things up. It’s designed to be flexible, letting you clear specific data sets or clear everything, and it provides a way to save your reports directly to files. You connect it to your signal emitter to receive updates, and it lets you easily stop that connection when you’re done.

## Class FrameValidationService

The FrameValidationService helps you keep track of your trading timeframes and make sure they're set up correctly. Think of it as a central place to register your different timeframes, like 1-minute, 5-minute, or daily charts. 

Before you try to use a timeframe in your backtesting process, this service can quickly confirm it exists, preventing errors. It remembers whether a timeframe is valid, so it doesn’t have to check every time, making the validation process faster.

You can add new timeframes to the service using `addFrame`, check if a timeframe is valid with `validate`, and see a complete list of registered timeframes with `list`. It uses a logging service for any relevant messages.

## Class FrameSchemaService

This service helps keep track of your trading frame schemas – essentially, the blueprints for how your backtests are structured. It uses a special type-safe system to store these schemas, ensuring everything is set up correctly. 

You can add new frame schemas using the `register` method, or update existing ones with `override`.  If you need to use a schema in your backtest, simply retrieve it by name with the `get` method. Before a schema is added, it checks to make sure all the essential pieces are there with the `validateShallow` check. 


## Class FrameCoreService

This service, `FrameCoreService`, handles the creation of timeframes needed for backtesting. It works behind the scenes, managing the connections to data sources and validating the generated timeframes. Think of it as the engine that provides the chronological sequence of data points your backtesting logic will use. It leverages a `FrameConnectionService` to actually fetch the data and a `FrameValidationService` to ensure everything is correct. The key method you'll interact with is `getTimeframe`, which takes a symbol (like a stock ticker) and a timeframe name (like "1h" for one-hour candles) and returns an array of dates representing that timeframe.


## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing different trading frames within your backtesting environment. Think of it as a smart router that automatically directs your requests to the correct frame implementation based on the current context.

It keeps things efficient by remembering previously created frames, avoiding unnecessary re-creation. This is particularly helpful during backtests where you might be working with multiple timeframes.

You can easily fetch frames using their names, and the service will handle creating them if they don't already exist.

This component also provides a way to retrieve the start and end dates for a backtest, allowing you to focus on specific periods within your historical data. If you're running in live mode, it operates without any frame constraints.

## Class ExchangeValidationService

The ExchangeValidationService helps keep track of your trading exchanges and makes sure they're set up correctly. Think of it as a central place to register and check the health of your exchanges before you start trading. You can use it to add new exchanges to your system, confirm that an exchange exists before trying to use it, and get a complete list of all exchanges you’ve registered. To make things faster, it remembers the results of validations so it doesn’t have to repeat the same checks over and over. This service uses a `loggerService` for tracking and `_exchangeMap` to store the exchange information.

## Class ExchangeUtils

ExchangeUtils is a helper class designed to make working with different cryptocurrency exchanges easier and more consistent within the backtest-kit framework. Think of it as a central place to handle common exchange-related tasks, ensuring everything works reliably.

It’s set up as a single, readily available instance, so you don’t have to create it yourself each time you need it.

Need historical price data (candles)? The `getCandles` function simplifies fetching this, automatically figuring out the date range based on the interval you request.  If you’re looking for the average price, `getAveragePrice` calculates it using recent price data.

Dealing with trade quantities or prices?  `formatQuantity` and `formatPrice` handle the specifics of each exchange, ensuring your orders and calculations are accurate.  Want to see the current order book?  `getOrderBook` retrieves that information, respecting the exchange's data format.

For advanced users needing maximum flexibility, `getRawCandles` allows you to fetch candle data with very specific start and end dates, giving you full control over the data you retrieve. This function also prioritizes avoiding look-ahead bias, which is important for backtesting.

## Class ExchangeSchemaService

This service helps you keep track of different exchanges and their specific configurations. Think of it as a central place to store and manage information about each exchange you're working with. 

It uses a safe and organized system to hold this information, ensuring everything is typed correctly. You can add new exchanges using `addExchange()`, and retrieve them later by their name.

Before adding an exchange, the service checks to make sure all the essential pieces of information are present and in the right format. 

If an exchange already exists, you can update specific parts of its configuration using `override()`, and always retrieve a complete exchange definition with `get()`.

## Class ExchangeCoreService

The ExchangeCoreService acts as a central hub for interacting with exchanges, making sure that each operation understands the specific trading context – like the symbol being traded, the precise time, and whether it's a backtest or a live trade. It builds upon other services to manage these details.

It validates exchange configurations to ensure everything is set up correctly and avoids repeating those checks unnecessarily.

You can use it to retrieve historical price data (candles), or even simulate future data during backtesting. It also offers ways to calculate average prices, format prices and quantities correctly for the specific exchange, and get order book information. The `getRawCandles` method provides even more control when fetching data, letting you specify date ranges and limits precisely.

## Class ExchangeConnectionService

The `ExchangeConnectionService` acts as a central hub for interacting with different cryptocurrency exchanges within the backtest framework. It intelligently routes your requests – like fetching candles or order books – to the correct exchange implementation based on the configured exchange name.

To improve performance, it remembers which exchange instances it’s created, so it doesn’t have to recreate them every time. This memoization feature makes things faster.

The service handles common tasks such as getting historical candles, fetching the next batch of candles for backtesting progression, calculating average prices (either live or using historical data), and formatting prices and quantities to meet specific exchange rules. It also provides a way to retrieve order book data and raw candle data with customized date ranges. Logging is built-in to track all interactions.

## Class ConstantUtils

This class provides pre-calculated values that help define your take-profit and stop-loss levels when trading. It uses a method based on the Kelly Criterion, which focuses on maximizing profit while managing risk, and incorporates a system of gradual risk reduction. Think of it as setting up multiple smaller goals along the way to your final profit or loss targets.

For example, if your goal is a +10% profit, `TP_LEVEL1` will trigger when the price moves +3%, `TP_LEVEL2` at +6%, and `TP_LEVEL3` at +9%.  Similarly, `SL_LEVEL1` acts as an early warning sign for a potential loss, while `SL_LEVEL2` is your final safety net to avoid large losses. These levels are expressed as percentages of the distance to the overall target, letting you adjust your trading strategy based on these predefined milestones.

## Class ConfigValidationService

This service helps keep your trading configurations healthy and profitable. It acts as a safety net, double-checking your settings to make sure they make mathematical sense and won't lead to losing trades. 

It verifies things like ensuring your slippage and fees aren’t negative, and that your take profit distance is large enough to actually cover those costs and make a profit. The service also makes sure your time-based settings and retry counts are all positive numbers. Essentially, it helps prevent common mistakes in configuration that could negatively impact your backtesting results.

## Class ColumnValidationService

The ColumnValidationService is designed to make sure your column configurations are set up correctly and consistently. It acts as a safety check to prevent issues caused by incorrectly defined columns. 

Essentially, it verifies that each column has all the necessary pieces – a unique identifier (key), a descriptive name (label), a defined formatting method (format), and a visibility setting (isVisible). It also ensures that these identifiers are unique, and that the formatting and visibility settings are actually functions that can be executed. Think of it as a quality control system for your column data. 

The `validate` method performs these checks, helping you catch potential problems early on.

## Class ClientSizing

This component, called ClientSizing, figures out how much of an asset your trading strategy should buy or sell. It’s designed to be flexible, offering several different approaches to sizing, like using a fixed percentage of your capital, the Kelly criterion, or the Average True Range (ATR).

You can also set limits on how much you can trade at once, both in terms of the absolute amount and as a percentage of your total capital.  It's like having safety rails to prevent overly aggressive trades.

The `calculate` method is the heart of this – it takes the current market conditions and your strategy’s parameters and spits out the recommended position size. This calculation considers any constraints you’ve set, ensuring trades stay within your defined boundaries.


## Class ClientRisk

ClientRisk helps manage the overall risk of your trading portfolio by setting limits and making sure your strategies don’t take on too much exposure. It acts as a safety net, preventing signals that would violate those limits, like exceeding the maximum number of positions you can hold at once.

It's designed to be shared across multiple strategies, which allows for a holistic view of your risk exposure – how all your strategies interact with each other. This component checks signals before trades are executed, ensuring compliance with your defined risk rules.

The `_activePositions` property keeps track of all open positions across all strategies, and it’s automatically updated to reflect changes. This system uses a special initialization process to ensure this data is loaded correctly, but skips that process when running in backtest mode.

You can also define custom risk validations to tailor the risk checking logic to your specific needs, having access to details about the signal and the current positions. Signals are registered when opened using `addSignal`, and removed when closed with `removeSignal`.

## Class ClientFrame

The `ClientFrame` class is responsible for creating the timelines your backtesting runs use. Think of it as the engine that provides the sequence of dates and times for your trading simulations. It avoids unnecessary work by remembering previously generated timelines and reusing them. You can customize the interval between those dates and times, ranging from one minute to three days. 

This class works behind the scenes, primarily used by the backtesting logic itself to step through historical data.

The `getTimeframe` method is its core functionality: it’s how you request a timeframe for a particular trading symbol, and it will give you back an array of dates. Importantly, this generation is "singleshot," meaning it caches the results so it doesn’t have to recreate the same timeline repeatedly.


## Class ClientExchange

This `ClientExchange` component is the go-to for your backtest-kit framework to interact with exchange data. It's designed to be efficient, using prototypes to minimize memory usage.

You can use it to pull historical and future candle data – think getting past price movements and predicting what might happen next during a backtest. It can also calculate VWAP (a volume-weighted average price), which is useful for understanding trading activity, and format prices and quantities to match the specific requirements of an exchange. 

If you need raw candle data with custom start and end dates, the `getRawCandles` method provides flexibility.  It carefully manages timing to avoid looking into the future and messing up your backtest results. Finally, it provides access to the order book, which shows the current buy and sell orders for a trading pair.

## Class ClientAction

The `ClientAction` class is a core component for running your custom action handlers within the backtest-kit framework. Think of it as a manager that sets up, routes events to, and cleans up after your action handlers.

It's designed to let you plug in your own logic – whether that's managing state with tools like Redux, sending notifications via Telegram or Discord, collecting analytics, or logging events – without directly interfering with the main trading engine.

The `ClientAction` handles the complexities of initializing your handler once, making sure events reach the right place (live trading vs. backtesting), and ensuring resources are released when they're no longer needed.  It uses a special technique called "singleshot" to guarantee that initialization and cleanup happen only once, which is important for reliability.

You’ll use the `signal`, `signalLive`, `signalBacktest`, and related methods (`breakevenAvailable`, `partialProfitAvailable`, etc.) to send different types of events to your action handler, triggering the custom actions you've defined. Each event type has its own dedicated method, ensuring that your handler receives precisely the information it needs to respond appropriately.

## Class CacheUtils

CacheUtils helps you speed up your backtesting by automatically storing and reusing the results of your functions. Think of it like a smart memory system for your code. 

It uses a singleton, meaning there’s just one instance of it managing all the caching. The `fn` property is how you tell CacheUtils to start caching a particular function – you specify how often the cache should refresh based on the candle timeframe.

If you change the way a function works, or want to free up memory, you can use `flush` to completely wipe out the cached data for that function. `clear` is a bit more targeted; it clears just the current cache entry, allowing you to force a recomputation for a specific scenario. Finally, `gc` helps keep things tidy by regularly removing old, expired cache entries.

## Class BreakevenUtils

This class helps you analyze and report on breakeven events within your trading backtests. Think of it as a tool to pull together and present information about when your strategies hit breakeven points.

It gathers data that’s been collected by another component and provides several ways to work with that data.

You can request summary statistics about the breakeven events, like how many times breakeven was reached. It can also create detailed reports in Markdown format, which are essentially nicely formatted tables showing individual breakeven occurrences, including the symbol traded, strategy used, entry price, and time of the event.  Finally, you can have it save those reports directly to files on your computer. 

The reports include helpful data such as the symbol traded, the strategy used, when the event happened, and the price at which breakeven was reached. You can customize which details appear in the report and where the file is saved.

## Class BreakevenReportService

This service helps you keep track of when your trading signals reach their breakeven point. It essentially listens for these “breakeven” moments – when a trade has recovered its initial investment – and diligently records them in a database. You can think of it as a record keeper specifically for these successful milestones in your trading.

To use it, you'll need to subscribe to receive these events. The subscription is designed to prevent you from accidentally subscribing multiple times, ensuring a clean and reliable process. When you're finished tracking, you can unsubscribe. The service also includes a logger, which is helpful for debugging and understanding its activity.

## Class BreakevenMarkdownService

This service helps you automatically create reports detailing breakeven events for your trading strategies. It listens for breakeven signals and neatly organizes them for each symbol and strategy you’re using. The service then generates easy-to-read markdown tables summarizing these events, along with some overall statistics.

You can subscribe to these signals to receive updates as they happen, and the service will store the data for you.  The reports are saved as markdown files, making them simple to view and share. The service keeps things organized by storing data separately for each combination of symbol, strategy, exchange, timeframe, and whether it’s a backtest.

You can request specific data, generate reports for particular symbol/strategy combinations, or clear the stored data entirely. It allows you to easily examine and understand the performance of your strategies related to breakeven points.

## Class BreakevenGlobalService

This service acts as a central hub for tracking breakeven points within the trading system. It's designed to be easily integrated into the core trading strategy and provides a consistent way to manage and monitor breakeven calculations.

Think of it as a middleman – it receives requests related to breakeven, logs those actions for auditing and troubleshooting, and then passes them on to the connection service that actually handles the underlying calculations.

The system injects this service into the strategy, uses a logger for tracking, and relies on other services to validate different aspects of the trading setup like the strategy itself, risk parameters, and the exchanges involved. The `validate` method helps ensure everything is correctly configured before proceeding, and it remembers previous validations to avoid unnecessary repetition.  The `check` and `clear` methods are responsible for triggering and resetting breakeven conditions, respectively, always logging before delegating the actual work.

## Class BreakevenConnectionService

This service helps track and manage breakeven points for trading signals. It’s designed to be efficient, making sure you don’t create unnecessary calculations or objects. 

Essentially, it creates and remembers a specific breakeven tracker for each unique trading signal, storing these trackers in a clever way to avoid repeating work. You can think of it as a factory that creates and manages these trackers.

The service is used by your overall trading strategy, and it keeps things organized by handing off the actual breakeven checks and clearings to these individual trackers. When a signal is finished, it cleans up these trackers, preventing your system from using too much memory. It also reports events related to the breakeven calculations.

## Class BacktestUtils

This class provides helpful tools for running and managing backtest simulations. It's designed to simplify the process of testing your trading strategies.

You can use `run` to execute a backtest for a specific trading symbol and strategy, and it will give you a stream of results. If you only need to run a test for side effects, like logging or callbacks, `background` is useful as it runs the test silently.

Need to check if a pending signal is ready for breakeven or a scheduled signal is active?  `getPendingSignal` and `getScheduledSignal` retrieve that information.  `getBreakeven` helps determine if the price has moved enough to cover transaction costs.

`stop` gives you the ability to halt a backtest while allowing any currently active signal to complete normally.  You can also manually manage signals – `commitCancelScheduled` cancels a scheduled signal, and `commitClosePending` closes a pending signal.

For more refined control, there are methods for adjusting stop-loss and take-profit levels: `commitTrailingStop`, `commitTrailingTake`, and `commitBreakeven`. These allow you to fine-tune risk management during the backtest. You can also activate a scheduled signal early using `commitActivateScheduled`.

Finally, `getData` provides statistical information about closed signals, `getReport` generates a markdown report, `dump` saves the report to a file, and `list` shows you the status of all running backtest instances. This class is designed to make backtesting more manageable and insightful.

## Class BacktestReportService

The BacktestReportService helps you track and analyze your trading strategies by recording every important event as it happens during a backtest. It listens for signal events like when a strategy is idle, opens a position, is actively trading, or closes a position, and saves all that data to a database. Think of it as a detailed logbook for your backtesting process, allowing you to debug and understand exactly what your strategy did at each step.

The service uses a logger to provide extra debugging information and has a special feature to prevent it from accidentally subscribing multiple times, which could cause issues. You can easily subscribe to start receiving these event logs, and unsubscribe when you’re done. This service is a valuable tool for anyone looking to improve their backtesting workflow.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you automatically generate reports summarizing the performance of your trading strategies. It listens for trading signals, specifically focusing on closed positions, and carefully tracks the details of each one. Think of it as a record-keeper that organizes your backtesting results.

It generates easy-to-read markdown tables with signal information, allowing you to easily analyze and understand how your strategies are performing. The reports are saved to your logs directory, making them readily accessible.

You can customize the reports to include the data you find most important and clear the accumulated data when you’re finished with a particular backtest run. There's also a way to subscribe to and unsubscribe from the backtest signal emitter, letting you control when the service is actively listening for events. The service uses a clever storage system to keep data organized and separate for each strategy and trading environment.

## Class BacktestLogicPublicService

This service helps manage and run backtests in a user-friendly way. It simplifies the process by automatically handling important context information like the strategy name, exchange, and frame – you don’t have to pass these around manually in your code. 

Essentially, it acts as a wrapper around the private backtesting logic, making it easier to use. The `run` method is the primary function, allowing you to kick off a backtest for a specific symbol and receive results as a stream of signals. This stream delivers information about trades (opened, closed, cancelled) and scheduled actions.


## Class BacktestLogicPrivateService

This service manages the complex process of running a backtest, particularly focusing on efficiency. It works by first retrieving the necessary timeframes, then systematically processing each timeframe by requesting ticks. Whenever a trading signal appears, it fetches the relevant candle data and executes the backtest logic. 

Importantly, it skips ahead in time until a signal closes, and then it delivers the finalized result as part of a continuous stream – think of it like a conveyor belt of backtest data instead of building up a massive list in memory.  You can even stop the backtest early by interrupting this flow.

The service relies on several other components like a logger, the core strategy engine, the exchange interface, the frame management system, context management, and action handling. Finally, the `run` method is the primary way to initiate the backtest for a specific trading symbol, yielding results as they become available.

## Class BacktestCommandService

This service acts as a central point to interact with the backtesting capabilities of the framework. Think of it as a friendly interface for triggering and managing backtest runs. It handles the behind-the-scenes work, including validating strategies, exchanges, and the overall testing setup.

It's designed to be easily used within your application, allowing you to inject dependencies and control the backtesting process.

The core function, `run`, is your main tool: it initiates a backtest for a specific trading symbol, passing along important information like the strategy, exchange, and frame being tested. It provides a stream of results as the backtest progresses, giving you real-time insights into how your trading strategy performs.


## Class ActionValidationService

The ActionValidationService helps you keep track of your action handlers and make sure they're available when you need them. Think of it as a central manager for your actions.

You can register new action handlers using `addAction`, providing a name and a schema to describe what the action does. Before you actually *use* an action handler, `validate` is your friend; it checks if it's registered so you don’t run into unexpected errors.

To speed things up, the service remembers previous validation results. If you need to see everything you've registered, the `list` function will give you a complete overview of all action schemas. The service also has a `loggerService` for tracking any issues and an internal `_actionMap` to organize the registered actions.

## Class ActionSchemaService

The ActionSchemaService helps you keep track of your action schemas in a structured and safe way. It's like a central library where you define and manage the blueprints for your actions.

You can register new action schemas with it, and it will check to make sure they’re set up correctly, including verifying that the methods your action handlers use are valid. It uses type safety to prevent errors.

You can even update existing schemas – just provide the changes you need without having to redefine the whole thing.  The service also ensures your action handlers only use approved methods. Finally, it provides a way to retrieve those schemas when needed.

## Class ActionProxy

ActionProxy acts as a safety net when dealing with user-defined action handlers in your trading strategies. It essentially wraps your custom code to prevent errors within those handlers from bringing down the entire system. Think of it as a bodyguard for your strategy's logic.

Whenever your strategy needs to execute a user-provided action, like responding to a signal or cleaning up resources, ActionProxy steps in.  It catches any errors that might occur during these actions, logs them, and ensures the process continues smoothly instead of crashing.  This means your strategy can gracefully handle unexpected issues in the user-provided code.

You don't directly create an ActionProxy; instead, you use `fromInstance()` to create one that wraps an existing action handler. The `fromInstance()` method ensures a consistent and safe execution environment for these handlers. All the methods related to handling signals, profits, losses, pings, and disposal are wrapped for error protection. If a particular method isn’t implemented by the user, ActionProxy handles it gracefully by returning null.

## Class ActionCoreService

The `ActionCoreService` is the central hub for managing and executing actions within your trading strategies. It acts as a coordinator, ensuring that actions are dispatched in the correct order and that all necessary validations occur.

Think of it as the conductor of an orchestra, making sure each instrument (action) plays its part at the right time and in harmony.

Here's a breakdown of what it does:

*   **Action Orchestration:** It reads action lists directly from your strategy's configuration and systematically invokes the appropriate handlers for each action.
*   **Validation is Key:**  Before any actions are taken, it thoroughly checks your strategy's settings and the validity of the actions themselves. This includes verifying the strategy name, exchange, frame, and associated risks.
*   **Event Routing:**  It's responsible for delivering various event types (like signals, breakeven notifications, partial profits, and more) to the registered actions, ensuring they react appropriately.
*   **Initialization & Cleanup:** It handles the setup (initialization) and teardown (disposal) of actions, making sure everything is loaded and cleaned up correctly at the beginning and end of strategy execution.
*   **Data Clearing:** It provides a way to clear action data, either for a specific action or globally across all strategies.

The service relies on several other services for validation and connection, and offers methods for initializing, signaling, and disposing of actions, all based on the configurations defined in your strategy schema.

## Class ActionConnectionService

This service acts as a central dispatcher for different actions within your trading system. It takes an action name and routes it to the correct implementation, ensuring that the right logic is executed for each action. To improve performance, it remembers (caches) previously used action implementations, so it doesn't have to recreate them every time.

Think of it like a switchboard operator, directing calls (actions) to the appropriate department (ClientAction).

Here's a breakdown of how it works:

*   **Action Routing:** It uses the action name, along with details like the strategy and frame, to determine which action to execute.
*   **Caching:** It cleverly stores these action implementations to avoid unnecessary creation, which speeds things up.  The cache key includes strategy, exchange, and frame names, so actions are isolated to their specific context.
*   **Event Handling:**  It handles different event types—signal, breakeven, partial profit, risk rejection, and ping-related events—directing them to the appropriate action.
*   **Initialization and Disposal:** It ensures actions are properly initialized and cleaned up when needed, including loading any persistent data.
*   **Clearing Cache:** It allows you to clear the cached actions if needed.



The service uses other components like a logger and action schema service to perform its functions.

## Class ActionBase

This base class, `ActionBase`, is your foundation for creating custom actions within the backtest-kit framework. Think of it as a central spot to add your own logic that interacts with the trading strategy – things like sending notifications, logging events, or even triggering custom business rules. It handles a lot of the groundwork for you, automatically logging events and providing access to key information about the strategy and trading environment.

You extend `ActionBase` to build actions that manage state, send real-time updates (like Telegram messages or Discord alerts), track key metrics, and generally customize the behavior of your trading strategy.

Here's the breakdown:

*   **Initialization:** When your action is created, it receives the strategy name, frame name, and action name for context. An `init()` method lets you set up any necessary resources (like database connections) asynchronously.
*   **Event Handling:**  A series of methods (`signal`, `signalLive`, `signalBacktest`, `breakevenAvailable`, `partialProfitAvailable`, `partialLossAvailable`, `pingScheduled`, `pingActive`, `riskRejection`) are triggered during the strategy’s execution.  You can override these to perform specific actions based on each event, like logging a profit milestone or sending a notification when a breakeven is reached.  `signalLive` is specifically for actions that *must* happen during live trading, while `signalBacktest` is for backtesting-specific logic.
*   **Cleanup:** When the strategy finishes, the `dispose()` method allows you to clean up any resources you’ve used.
*   **Built-in Logging:**  Don't worry about setting up logging—`ActionBase` does it automatically using the `backtest.loggerService`.

Essentially, `ActionBase` provides a structured way to plug in your own custom behaviors without having to worry about the underlying infrastructure. It's all about giving you the flexibility to tailor your trading strategy to your exact needs.
