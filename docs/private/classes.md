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

The Walker Validation Service helps you keep track of and ensure the correctness of your walker configurations – those are the setups you use for testing different parameter combinations in your strategies. Think of it as a central place to register your walkers and double-check they're available before you start running tests.

It keeps a record of all your walkers, preventing errors that might occur if a walker is missing. The service also remembers its validation results, making the process faster the more you use it. 

You can use it to add new walker setups, verify an existing walker’s validity, and easily see a complete list of all the walkers you’ve registered.

## Class WalkerUtils

WalkerUtils helps you easily manage and run automated trading tests, often called "walkers." Think of it as a central hub for running and monitoring these tests. It simplifies the process of kicking off a walker, tracking its progress, and getting results, all while keeping things organized.

It uses a special system to ensure each trading test runs independently, preventing conflicts when you're running multiple tests at once. 

Here's what you can do with WalkerUtils:

*   **Run tests:**  You can start a walker comparison for a specific asset, and it handles the underlying complexities.
*   **Run tests in the background:** Need to run a test just for logging or to trigger other actions without waiting for results? WalkerUtils lets you do that.
*   **Stop tests:** If you need to halt a trading test, you can do so gracefully, allowing any ongoing activity to finish safely.
*   **Get results:** You can retrieve the complete results of a walker, including data from each trading strategy involved.
*   **Generate reports:** Easily create formatted reports (like markdown files) summarizing the walker's performance.
*   **Save reports:** Save these reports directly to your file system.
*   **List walkers:** Check the status of all currently running trading tests.



WalkerUtils acts as a single, convenient point of access to all these operations.

## Class WalkerSchemaService

The WalkerSchemaService acts as a central place to keep track of different walker schema definitions. It uses a special system to ensure the schemas are structured correctly and consistently. You can add new walker schemas using the `addWalker` function, and retrieve them later by their unique names. 

The service also has a built-in check to make sure any new schemas you add have the necessary properties. If a schema already exists, you can update parts of it using the `override` function. Essentially, this service helps you organize and manage your walker schemas in a safe and reliable way.

## Class WalkerMarkdownService

The WalkerMarkdownService is designed to automatically create and save reports detailing the performance of your trading strategies. It listens for updates as your strategies run – often called "ticks" – and collects results for each strategy.

Think of it as a reporting engine that organizes your strategy comparisons into easy-to-read markdown tables.  These tables are then saved as files, typically located in a 'logs/walker' directory, allowing you to track and analyze performance over time.

The service uses a clever system to keep data separate for each walker, preventing results from getting mixed up. It handles the creation of these separate data stores automatically.

Key functions allow you to retrieve specific data points, generate full reports, and even clear out accumulated data when you need to start fresh. The service is designed to be simple to use – it initializes itself automatically when you first start using it, so you don't have to worry about setup.

## Class WalkerLogicPublicService

The WalkerLogicPublicService acts as a central hub for running and managing your trading strategies, streamlining the process behind the scenes. It builds upon the WalkerLogicPrivateService, automatically passing along important information like the strategy name, exchange, frame, and walker name, so you don't have to manually manage it each time. 

Think of it as a helper that simplifies how you execute your backtesting processes. 

It has a few key components:

*   A logger for tracking events and errors.
*   The core logic for running walkers (the WalkerLogicPrivateService).
*   A service to handle the structure and organization of your walkers.

The main function, `run`, is what you'll use to actually kick off a comparison between walkers. You provide a symbol to analyze and context information to define the environment for the backtest. This method automatically executes backtests across all of your strategies.

## Class WalkerLogicPrivateService

The WalkerLogicPrivateService helps you compare different trading strategies against each other, acting as an orchestrator for these comparisons. It works by running each strategy one after another and giving you updates on their progress as they finish. 

As each strategy completes, you'll receive information about its performance. The service also keeps track of the best-performing strategy in real-time.

Finally, it provides a complete report at the end, ranking all the strategies you tested. This service relies on other internal components like the BacktestLogicPublicService to handle the individual backtesting processes. 

You can use it to run comparisons for a specific trading symbol, defining which strategies to test, what metric to optimize for, and providing details about the trading environment (exchange, timeframe, and walker name).


## Class WalkerCommandService

WalkerCommandService acts as a central hub for interacting with the walker functionality within the backtest-kit framework. It's designed to make it easy to access and use these features, especially when setting up your application.

Think of it as a convenient layer that sits on top of more detailed services, allowing you to inject dependencies cleanly. It bundles together several services responsible for different aspects of the process.

Inside, you'll find tools for validation, managing schemas, and ultimately, running the core walker comparisons.

The `run` function is the main entry point – you give it a symbol (like a stock ticker) and some contextual information (like the names of the walker, exchange, and frame you're using), and it will execute the comparison and provide you with the results.

## Class StrategyValidationService

This service helps you keep track of your trading strategies and make sure they're set up correctly. Think of it as a central place to register and verify your strategies, ensuring they exist and their associated risk settings are also valid. It remembers validation results to speed things up, so you don’t have to repeat checks unnecessarily.

You can add new strategies using `addStrategy`, check if a strategy is valid with `validate`, and get a complete list of all registered strategies with `list`. This simplifies managing and validating your strategies before you start backtesting or live trading. The service relies on a logger and a risk validation service for its functions.

## Class StrategySchemaService

This service acts as a central place to store and manage the blueprints, or schemas, for your trading strategies. It uses a safe and organized way to keep track of these schemas, ensuring they are consistent and well-defined.

You can add new strategy schemas using `addStrategy()` and then retrieve them later by their name when you need to use them.  Before a strategy is added, the system checks to make sure it has the essential parts in the correct format with `validateShallow`. If a strategy already exists, you can update specific parts of it using `override()`. Finally, `get()` lets you easily fetch a strategy schema based on its name.

## Class StrategyCoreService

The StrategyCoreService acts as a central hub for managing and interacting with trading strategies within the backtest-kit framework. It combines the functionalities of connecting to strategies and injecting important context like the trading symbol, time, and backtest settings. 

Think of it as a helper that streamlines how strategies are run and monitored.

Here's a breakdown of what it does:

*   **Validation:** It checks if a strategy and its associated risk settings are valid, remembering previous checks to avoid unnecessary repetition.
*   **Signal Retrieval:** It can fetch pending and scheduled signals for a specific symbol, which is useful for monitoring things like take profit/stop loss orders and activation timelines.
*   **Status Checks:**  It determines if a strategy has been stopped.
*   **Execution:** It handles the actual execution of strategy ticks and backtests, providing the necessary context.
*   **Control:** It allows you to stop a strategy from producing new signals, cancel scheduled signals, and clear the cached strategy data for a fresh start.



Essentially, it simplifies the process of working with strategies by handling the setup, context, and basic management tasks.

## Class StrategyConnectionService

This service acts as a central hub for interacting with different trading strategies. It intelligently routes requests – like getting signals or running backtests – to the correct strategy implementation based on the symbol and the strategy's name. To make things efficient, it remembers (caches) those strategy instances so you don’t have to recreate them every time.

Before anything can happen, it makes sure the strategy is properly initialized. It handles both live trading (using `tick()`) and historical analysis (using `backtest()`).

Here's a breakdown of what it offers:

*   **Smart Routing:** It finds the right strategy to execute your requests.
*   **Caching:** Keeps things fast by reusing strategy instances.
*   **Initialization:**  Guarantees that strategies are ready before use.
*   **Signal Management:**  Provides ways to check for pending or scheduled signals, and to cancel scheduled ones.
*   **Control:** Allows you to stop a strategy from generating signals or clear its cached state to force a refresh.

The service relies on other components like a logger, execution context, strategy schema, risk connection, exchange connection, method context and partial connection service.

## Class SizingValidationService

The SizingValidationService helps you keep track of and ensure the correct sizing strategies are being used in your backtesting process. Think of it as a central manager for your sizing rules. It allows you to register different sizing methods, like fixed percentage or Kelly Criterion, and then verify that they're actually available before you try to use them. To make things faster, it remembers the results of these checks, so it doesn't have to re-validate them every time. You can also use it to see a complete list of all the sizing strategies you've registered.

## Class SizingSchemaService

This service helps you keep track of different sizing strategies for your trading backtests. Think of it as a central place to store and manage how much of your capital you'll use for each trade. It uses a secure and organized system to hold these sizing rules, making sure they're correctly typed and consistent.

You can add new sizing strategies using `register`, which saves them for later use. If you need to make small adjustments to an existing strategy, `override` lets you update just the parts you want to change.  And when you’re ready to use a strategy, `get` helps you easily retrieve it by name. This service performs a quick check when you add a new sizing strategy to ensure it has all the necessary information.


## Class SizingGlobalService

The SizingGlobalService helps determine how much of an asset to trade, acting as a central hub for position sizing calculations. It works closely with other services, including one for managing connections and another for validating sizing rules. Think of it as the engine that figures out the size of your trades, taking into account factors like risk tolerance and account balance.

It's a core component used both behind the scenes by the backtest-kit and potentially accessible through a public interface.

Here's a breakdown of what it includes:

*   **loggerService:** Provides logging capabilities for debugging and tracking.
*   **sizingConnectionService:** Handles communication with systems that provide sizing information.
*   **sizingValidationService:** Ensures sizing calculations adhere to pre-defined rules.
*   **calculate:** This is the main method—it takes parameters defining the sizing request and calculates the resulting position size.

## Class SizingConnectionService

The SizingConnectionService acts as a central hub for handling position sizing calculations within the backtest-kit framework. It intelligently directs sizing requests to the correct sizing implementation based on a specified name. To improve efficiency, it keeps a record (a "memoized" cache) of these sizing implementations, so it doesn’t have to recreate them every time you need them. 

Think of it as a traffic controller, ensuring sizing requests go to the right place and avoiding unnecessary work. The service leverages information about sizing schemas and a logger for internal operations.

When calculating a position size, the `calculate` method takes your risk parameters and context, then uses the configured sizing method to determine the appropriate position size. If a strategy doesn't have specific sizing instructions, it will use an empty string as the sizing name. The `getSizing` property handles fetching the appropriate sizing object, creating it if it doesn't already exist in the cache.

## Class ScheduleUtils

ScheduleUtils is a handy tool designed to help you monitor and understand how your trading signals are being scheduled and processed. Think of it as a central place to keep an eye on things like how many signals are waiting, if any have been cancelled, and how long they're taking to execute. 

It provides a straightforward way to access and report on scheduled signals, logging activity along the way. You’ll find functions to retrieve statistics, create detailed markdown reports, and even save those reports directly to a file. Essentially, it simplifies the process of analyzing the scheduling aspects of your trading strategies. 

You can request data for specific symbols and strategies, generate reports showcasing the entire history of scheduled events, and easily save these reports for later review or sharing. It’s designed to be easily accessible and used throughout your backtesting workflow.


## Class ScheduleMarkdownService

The ScheduleMarkdownService automatically creates reports detailing the scheduling and cancellation of trading signals. It keeps track of all these events for each strategy you're using. 

Think of it as a system that listens for signal events – when a signal is scheduled or canceled – and neatly organizes this information into easy-to-read markdown tables. The reports also provide useful statistics, like cancellation rates and how long signals typically wait before being executed.

These reports are saved as markdown files, making them simple to view and analyze. The service manages the storage of this data in an organized way, with each symbol and strategy having its own dedicated storage area.  You can also clear out this stored data if needed. The service initializes itself automatically when you first start using it, so you don’t have to worry about any setup steps.

## Class RiskValidationService

This service helps you keep track of and make sure your risk management rules are set up correctly. It acts like a central hub for all your risk profiles, allowing you to register new ones and quickly verify they exist before your trading strategies use them. To make things efficient, the service remembers the results of previous validations, so it doesn't have to check the same rules repeatedly. You can also easily see a complete list of all the risk profiles you’ve registered. It's designed to be reliable and performant, ensuring your risk management is always in good shape.

## Class RiskUtils

This class offers helpful tools for analyzing and understanding risk rejection events within your backtesting framework. Think of it as a centralized place to gather and present information about why trades were rejected due to risk controls.

It lets you pull out key statistics like the total number of rejections, broken down by symbol and strategy, giving you a quick overview of risk performance. You can also generate detailed markdown reports that present each rejection event in a clear, tabular format, including details like the position, exchange, price, and reason for the rejection.

Finally, it simplifies the process of saving these reports to files on your disk, automatically creating the necessary directories and naming the files in a consistent way so you can easily track and share your risk analysis. It's designed to work seamlessly with the RiskMarkdownService, pulling data from accumulated rejection events to provide these valuable insights.

## Class RiskSchemaService

This service helps you keep track of your risk schemas, ensuring they're consistent and well-managed. It uses a special registry to store these schemas safely and predictably. You can add new risk profiles using the `addRisk()`-like function and retrieve them later by their names. 

Before a new schema is added, it's quickly checked to make sure it has the essential pieces in place. If you need to update an existing risk profile, you can do so with partial changes, only modifying what needs to be adjusted. Finally, you can easily grab a specific risk schema whenever you need it, just by providing its name.

## Class RiskMarkdownService

This service helps you create reports about rejected trades due to risk management rules. It keeps track of why trades were rejected, organizes them by the traded asset and the trading strategy used, and then presents this information in a readable markdown format. 

Think of it as an automated way to document and analyze your risk management decisions. The service gathers data about each rejection, then compiles it into tables and statistics to give you a clear overview.  You can easily save these reports as files so you can review them later. 

It handles the storage of this data intelligently, creating separate storage areas for each combination of asset, strategy, and whether it’s a backtest or live trade. The service initializes itself automatically, so you don’t need to worry about manual setup. You can also clear the accumulated data if you want to start fresh or focus on a specific period.

## Class RiskGlobalService

This service acts as a central point for managing risk-related operations within the trading framework. It sits on top of a connection service and handles validating risk configurations to ensure trading activity stays within defined limits. Think of it as a gatekeeper, checking each trade against preset rules.

The service keeps track of open trading signals, registering them when a trade is initiated and removing them when a trade is closed.  This ongoing monitoring helps the system understand its overall risk exposure.

It also offers a convenient way to clear out risk data, either for a specific risk setup or a complete reset.  The validation process is designed to be efficient, remembering previous checks to avoid unnecessary repetition.

## Class RiskConnectionService

The RiskConnectionService acts as a central hub for managing risk checks within the backtest-kit framework. It intelligently directs risk-related operations to the correct risk implementation based on a name you provide. 

To boost performance, it keeps a memory of these risk implementations, so it doesn’t have to recreate them every time you need them. This memory is cleared when requested, useful for resetting simulations or live environments. 

The service lets you check if a trade signal is safe to execute, considering things like portfolio drawdown and exposure limits. It also registers and removes signals as they open and close, keeping the risk system up-to-date. If a signal is blocked due to risk limits, the system notifies you through a special event. If your strategies don't require any risk configuration, you can leave the risk name empty.

## Class PositionSizeUtils

This class offers helpful tools for figuring out how much of an asset to trade, also known as position sizing. It contains different methods to calculate this, like using a fixed percentage of your account, the Kelly Criterion (a more complex formula aiming for optimal growth), or basing it on the Average True Range (ATR) to account for volatility. Each method comes with built-in checks to ensure the information you provide is suitable for that specific sizing technique. 

You don't create instances of this class directly; instead, you'll use the provided methods to get your position size. The methods take information like your account balance, the price of the asset, and other parameters relevant to the chosen sizing strategy.

Here’s a breakdown of the available sizing methods:

*   **fixedPercentage:** Calculates position size based on a fixed percentage of your account balance.
*   **kellyCriterion:** Uses the Kelly Criterion formula, which considers win rate and win/loss ratio to determine the ideal position size.
*   **atrBased:** Determines position size based on the Average True Range (ATR), helping to adjust for market volatility.

## Class PersistSignalUtils

This class helps manage how trading signals are saved and loaded, especially for strategies running in live mode. Think of it as a safe and reliable way to remember a strategy's progress even if the system restarts. 

It uses a clever system to keep signal information separate for each strategy, and you can even customize how it saves data if you need to. The class makes sure that updates to signal information happen in a way that prevents data loss, even if something unexpected happens during the save process.

It retrieves existing signal data when a strategy starts up and stores new signal data when the strategy makes changes.  You can register different ways to persist the data beyond the default.

## Class PersistScheduleUtils

This class, `PersistScheduleUtils`, helps manage how trading strategies keep track of scheduled signals, those automated actions that happen at specific times. It's designed to make sure this information isn't lost, even if something unexpected happens.

Each strategy gets its own dedicated storage, and you can even customize how this storage works using adapters. The class ensures that reading and writing these signals is done safely and reliably. 

The `readScheduleData` method retrieves previously saved signal data for a particular trading symbol and strategy. Conversely, `writeScheduleData` saves the current signal data back, making sure it's stored securely with safeguards against data corruption. It’s the tool used to reliably maintain that scheduled signal state. 

Finally, you can register custom data storage methods with `usePersistScheduleAdapter` to tailor the persistence mechanism to your specific needs.

## Class PersistRiskUtils

This utility class, `PersistRiskUtils`, helps manage how your trading positions are saved and loaded, especially when dealing with different risk profiles. It's designed to keep things reliable and prevent data loss, working closely with the `ClientRisk` component.

Think of it as a safe keeper for your active positions. It remembers them and ensures they’re written to disk in a secure, crash-resistant way.

Here’s a breakdown of how it works:

*   **Smart Storage:** It keeps track of different storage locations for each risk profile, preventing conflicts.
*   **Adapters:** You can customize how the data is saved using custom adapters, giving you flexibility.
*   **Reliable Updates:** When you add or remove signals, this class makes sure those changes are saved consistently to disk.
*   **Safe Reads:** When your system starts up, it can read these saved positions back in to quickly resume trading.
*   **Customization:** Allows to register a custom adapter for persistence.



Essentially, `PersistRiskUtils` takes care of the behind-the-scenes work of saving and restoring your trading positions, so you can focus on your strategies.

## Class PersistPartialUtils

This class, PersistPartialUtils, helps manage how your trading strategy's partial profit and loss information is saved and loaded. Think of it as a safety net, ensuring your progress isn't lost even if something unexpected happens. 

It keeps track of these partial data points separately for each symbol and strategy you're using, ensuring everything stays organized. You can even customize how it saves this data if you have specific needs.

The system automatically handles reading and writing this partial data, and it does so safely, making sure that writes are completed fully or not at all, preventing data corruption. It’s a crucial component for keeping your strategy’s state reliable. 

Specifically, when your strategy starts up, `readPartialData` recovers any saved partial profit/loss information. When your strategy makes changes to profit/loss levels, `writePartialData` is used to save those changes. Finally, `usePersistPartialAdapter` provides a way to plug in your own specialized storage mechanism if the default isn't quite right for your use case.


## Class PerformanceMarkdownService

The PerformanceMarkdownService helps you understand how your trading strategies are performing. It gathers performance data as your strategies run, breaking it down by symbol, strategy, and whether it's a backtest or live trading.

It then calculates important statistics like average performance, minimum and maximum results, and percentiles, to give you a clear picture of what's happening. 

The service automatically creates detailed reports in markdown format that pinpoint potential bottlenecks and areas for improvement. These reports are saved to your logs directory. 

You can retrieve the collected data, generate custom reports with specific columns, and even clear the data when it's no longer needed. The service initializes itself automatically upon startup to begin tracking performance immediately.

## Class Performance

The Performance class is your tool for understanding how well your trading strategies are performing. It gives you a way to collect and analyze data about your strategies, helping you pinpoint areas for improvement. 

You can retrieve aggregated performance statistics for a specific trading symbol and strategy, getting key metrics like average duration, volatility, and percentiles to identify potential bottlenecks.

It also allows you to generate comprehensive markdown reports that visually break down the performance, showing time distribution across different operations and highlighting potential problem areas. You can even save these reports directly to your computer for later review or sharing. Think of it as a way to get a clear picture of what's working well and what needs tweaking in your trading system.


## Class PartialUtils

This utility class helps you analyze and report on partial profit and loss data within your backtesting or live trading environment. It acts as a central point for accessing and presenting information gathered about individual profit and loss events.

You can use it to get summarized statistics, like total profit and loss counts, related to specific symbols and strategies.  It's designed to easily generate clear, formatted markdown reports that detail each partial profit/loss event, including crucial details like the action taken (profit or loss), the symbol traded, the strategy used, signal ID, position size, level percentages, price, timestamp, and whether it was a backtest or live trade.  Finally, it can save these reports directly to files, organized by symbol and strategy, for later review or sharing. The class retrieves information from a central data store that accumulates events from partial profit/loss notifications.

## Class PartialMarkdownService

This service helps you create and save reports detailing small profits and losses during your trading backtests. It listens for these "partial" profit and loss events, keeps track of them separately for each trading symbol and strategy you're using. You can then ask it to generate nicely formatted markdown tables summarizing these events, along with some overall statistics.

The service automatically organizes and stores these reports on your computer, placing them in a specific folder structure. You can also clear the data if you need to start fresh. Importantly, this service handles the setup automatically - you don’t need to manually initialize it; it just works when you need it. It uses a clever system to ensure each trading setup gets its own private storage for these details.

## Class PartialGlobalService

This service acts as a central hub for managing and tracking partial profit and loss events within your trading strategies. It's designed to be injected into your strategies during setup, providing a consistent and controlled way to handle these events. Think of it as a middleman – it records actions at a global level before passing them on to a connection service that actually handles the details.

It provides logging for all partial operations, making it easier to monitor how your strategies are performing. The service relies on other injected services to validate strategy configurations and manage the underlying connections. 

The `profit`, `loss`, and `clear` functions are the main ways to interact with this service. These functions essentially handle updating and signaling when profit or loss thresholds are reached or when a signal closes, respectively, always recording these actions for monitoring purposes.

## Class PartialConnectionService

This service manages how profit and loss tracking is handled for individual trading signals. Think of it as a central place to keep track of how each signal is performing. It smartly avoids creating duplicate tracking records for the same signal – it remembers previously created ones and reuses them.

Each signal gets its own dedicated record, and this service makes sure those records are set up correctly with logging and notification features. When a signal makes a profit or experiences a loss, this service handles the calculations and lets other parts of the system know. When a signal is closed out, it cleans up the tracking record, freeing up resources. It’s all about keeping things organized and efficient when monitoring your trades. The service uses a clever caching technique to quickly access these records and is integrated into the broader trading system through dependency injection.

## Class OutlineMarkdownService

This service helps create documentation in markdown format, primarily used by the AI Strategy Optimizer to keep track of its work. It organizes the information generated during the AI optimization process into a clear file structure. 

The service automatically creates a directory to store these files, with each file representing a different part of the conversation or process – system prompts, user inputs, and the final output from the AI. This makes it easier to review and debug the AI's decision-making process.

The files are named consistently, using the signal ID to group related information. The service is designed to be careful and won’t overwrite existing documentation, ensuring you always have a record of past runs. It relies on an injected logger service and a function to handle writing the actual data to these markdown files.

## Class OptimizerValidationService

This service keeps track of all the optimizers your backtesting system knows about. Think of it as a central directory that ensures you’re using valid optimizers.

It lets you register new optimizers, making sure you don't accidentally register the same one twice. 

If you try to use an optimizer that hasn’t been registered, this service will flag it for you.  To avoid repeated checks, it remembers the results of previous validation, making things faster.

You can also ask it for a list of all the optimizers it manages, which can be helpful for understanding what’s available.

## Class OptimizerUtils

This set of tools helps you work with strategies created through optimization processes. You can use it to retrieve information about your strategies, generate the actual code that will run those strategies, and save that code to files for later use.

Specifically, `getData` gathers strategy information, essentially preparing the metadata for your optimized strategies. `getCode` takes that metadata and creates a complete, runnable code file combining all the necessary components. Finally, `dump` automates saving that generated code to a file, organizing it neatly within a specified directory. It creates a file named with the optimizer’s name and the trading symbol.

## Class OptimizerTemplateService

This service acts as a blueprint for creating code snippets used in backtesting and optimization of trading strategies. It leverages a large language model (LLM) via Ollama to generate these snippets, incorporating features like multi-timeframe analysis and structured signal output. Think of it as a tool that helps automate the generation of the code needed to test and refine your trading ideas.

It can handle various aspects of the backtesting process, including:

*   Creating configurations for different exchanges (like Binance using CCXT)
*   Setting up timeframes for analysis (1 minute, 5 minutes, hourly, etc.)
*   Generating comparison tests using "walkers" to see how different strategies perform.
*   Crafting code for launching these tests and tracking their progress.
*   Creating helper functions for debugging and saving conversation logs to a specific directory. 

The LLM is used to generate strategy configurations and trading signals with a pre-defined structure - these signals include details like entry price, take profit, stop loss, and an estimated holding time. You can customize some parts of this process through configuration.

## Class OptimizerSchemaService

The OptimizerSchemaService is like a librarian for your trading strategies' configurations. It keeps track of all your optimizer schemas, ensuring they are set up correctly.

It makes sure each schema has the necessary information like a name, training range, data source, and instructions for generating prompts.

You can register new schemas, update existing ones by merging in new details, or simply retrieve a schema when you need it. The service uses a reliable storage system, guaranteeing that your schemas remain safe and consistent.

## Class OptimizerGlobalService

The OptimizerGlobalService acts as a central hub for interacting with optimizers, ensuring everything is handled correctly and securely. Think of it as a gatekeeper – it logs your requests, verifies that the optimizer you're trying to use actually exists, and then passes the work on to specialized services. 

It provides three main functions: retrieving data, generating code, and saving code to a file. Each of these functions first checks that the specified optimizer is valid before proceeding, preventing errors and ensuring a smooth workflow.  The service relies on helper services for logging, connecting to optimizers, and validating their existence, keeping the core functionality clean and focused.


## Class OptimizerConnectionService

The OptimizerConnectionService helps you easily work with optimizers within the backtest-kit framework. Think of it as a central hub for managing connections to different optimizers, ensuring you don't have to create new connections every time you need one. It smartly caches these connections to speed things up.

It combines your custom optimizer templates with default settings, providing a convenient way to tailor your strategies.  You can inject a logger to keep track of what's happening, and it relies on the ClientOptimizer for the actual optimization tasks.

The `getOptimizer` function is key—it's used to grab an existing optimizer or create one if it doesn’t exist yet, and its caching behavior makes repeated calls efficient. 

You can also use `getData` to pull together data and create strategy metadata, or `getCode` to generate the complete code needed for your strategies. Finally, `dump` lets you save that generated code directly to a file, making it easy to deploy.

## Class LoggerService

The `LoggerService` helps ensure consistent and informative logging across the backtest-kit framework. It's designed to take your preferred logging solution and automatically add important details to each log message, so you don't have to. 

Think of it as a smart wrapper around your logger. It will automatically include things like the trading strategy name, the exchange being used, the current frame, and the details of the execution itself (like the symbol and timestamp).

If you don't configure a custom logger, it defaults to a “no-op” logger, meaning it won’t actually do anything, which is useful for development or environments where you want to disable logging entirely. 

You can provide your own logger implementation via the `setLogger` method. The service also manages context information through the `methodContextService` and `executionContextService` properties, though you likely won't need to interact with these directly. The `log`, `debug`, `info`, and `warn` methods provide convenient ways to log messages at different severity levels, all with automatic context enrichment.

## Class LiveUtils

This class offers tools to manage live trading operations, making it easier to run and monitor strategies in real-time. It acts as a central hub for interacting with the live trading system, ensuring everything runs smoothly and recovers from potential crashes.

The `run` function is a key feature - it provides an endless stream of trading results, allowing you to continuously monitor and react to market changes. This stream automatically saves its state, so if something goes wrong, it can pick up right where it left off.  You can also run trading in the background with `background` for tasks that need to happen constantly, like sending data to external systems.

Need to know the current signal or scheduled signal a strategy is working with?  `getPendingSignal` and `getScheduledSignal` have you covered.  If you need to pause a strategy from creating new trades, `stop` provides a clean way to do so.  Want to just cancel a scheduled signal without halting the strategy? `cancel` lets you do just that.

Beyond control and monitoring, `getData` provides performance statistics, while `getReport` and `dump` can create detailed reports of trading activity. Finally, `list` gives you a snapshot of all currently running live trading instances and their status.

## Class LiveMarkdownService

This service helps you automatically create reports about your live trading activity. It keeps track of everything that happens – idle periods, when trades are opened, when they’re active, and when they’re closed – all organized by strategy. 

The service builds these events into nicely formatted Markdown tables, providing valuable insights into your trading performance, including win rates and average profit/loss.  These reports are saved as files, making it easy to review your trading history.

The service is designed to work seamlessly with your trading strategies, automatically listening for events and updating the reports.  You don’t have to manually trigger report generation; it handles that for you. The data is stored in a way that keeps information separate for each symbol, strategy, and backtest configuration. You can also clear the stored data when you need to start fresh or if you want to remove old reports.  It's initialized automatically when you first use it, so setup is straightforward.


## Class LiveLogicPublicService

This service helps manage and orchestrate live trading operations, making it easier to work with your strategies. It automatically handles important context information like the strategy and exchange names, so you don’t have to pass them around manually to different functions.

Think of it as a continuous, never-ending stream of trading signals – it keeps running and producing results. 

If things go wrong and the process crashes, it's designed to recover and pick up where it left off by restoring data from disk. It uses the current time to track the trading progression, ensuring accurate and real-time data. 

The `run` method is the core – you provide a symbol (like a stock ticker) and it starts the live trading process, automatically sending signals as it goes.


## Class LiveLogicPrivateService

This service helps manage and orchestrate live trading operations, focusing on efficiency and reliability. It continuously monitors the trading environment, checking for new signals at regular intervals. Think of it as a tireless observer, constantly looking for opportunities.

The service streams trading results – specifically, when positions are opened or closed – directly to you, avoiding unnecessary data. It’s designed to be very memory-efficient because it uses an asynchronous generator to produce these results.

Importantly, this system is built to be resilient. If something goes wrong and it crashes, it automatically recovers and picks up where it left off, ensuring continuous operation. It runs indefinitely, providing a constant stream of trading updates for a specific symbol.

## Class LiveCommandService

This service acts as a central hub for accessing live trading features within the backtest-kit framework. Think of it as a convenient way to get things done in real-time, offering a simplified interface for other parts of the system to use. 

It bundles together several essential components, including services for handling logging, live trading logic, strategy and exchange validation, schema management, and risk assessment. 

The core function, `run`, is the key to live trading. It continuously executes a trading strategy for a given symbol, intelligently managing errors and keeping the process running even if issues arise. You provide it with the symbol you want to trade and some context like the strategy and exchange names, and it returns a stream of results detailing how the strategy is performing in real-time.

## Class HeatUtils

HeatUtils helps you visualize and analyze your trading strategy's performance using heatmaps. It acts as a central hub for accessing and generating these visual reports, streamlining the process and adding logging for clarity.

You can easily retrieve aggregated statistics for a specific strategy, giving you a detailed breakdown of how each symbol contributed to the overall portfolio performance.

Need a nicely formatted report? HeatUtils can generate a markdown table showing key metrics like total profit, Sharpe Ratio, maximum drawdown, and trade counts, sorted to highlight the best-performing symbols.

Finally, you can save those reports directly to a file, automatically creating any necessary directories, making it simple to share and track your strategy's evolution. It's designed to be a straightforward, always-available tool for your backtesting and analysis workflow.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and analyze your trading strategy's performance across different assets. It gathers data from closed trades, calculating key metrics like total profit/loss, Sharpe Ratio, and maximum drawdown for each symbol and for the overall portfolio. This service is designed to work with a signal emitter, constantly updating the heatmap as new trades are closed.

You can request the current statistics for a specific strategy and backtest mode, or generate a nicely formatted Markdown report to share or document your results.  The service also allows you to save these reports directly to disk.  It has a built-in mechanism to prevent errors caused by unusual numerical results.

To start using it, there's no manual setup needed—it automatically initializes when you first use it.  You can also clear the accumulated data if you need to start fresh or want to delete data for a specific strategy. The system keeps separate data for each strategy and backtest configuration to prevent interference between different tests.

## Class FrameValidationService

This service acts as a central manager for your trading timeframe configurations. It keeps track of all the timeframes you've defined, like daily, hourly, or weekly, and makes sure they actually exist before your trading strategies try to use them. Think of it as a gatekeeper ensuring everything is set up correctly.

Adding a new timeframe is easy with `addFrame`, and `validate` helps you confirm a timeframe is ready before starting any calculations.  If you need a quick overview of all available timeframes, `list` will provide you with a simple list. The system cleverly remembers validation results, so it doesn't need to re-check everything every time, which makes things run faster.

## Class FrameSchemaService

This service helps you keep track of the different blueprints, or "frames," your trading strategies use. Think of it as a central place to define and manage what each strategy needs to function correctly. It uses a special, type-safe way to store these blueprints, ensuring they’re consistent.

You can add new blueprints using `register()` or update existing ones with `override()`.  Need to know what a specific blueprint looks like? Just use `get()` and provide its name. Before a blueprint is added, it’s quickly checked to make sure it has all the necessary pieces with the right types to avoid problems later. The service also has internal components for logging and validation, but you typically won't interact with those directly.


## Class FrameCoreService

The FrameCoreService is like the central manager for handling timeframes within the backtesting process. It works closely with a connection service to fetch the data needed to create those timeframes. Think of it as an internal helper that makes sure the backtest logic has the right sequence of dates to work with. It keeps track of logging, connection details, and ensures timeframes are valid. 

If you need a list of dates for a specific trading symbol and timeframe (like daily or hourly data), the `getTimeframe` function is your go-to tool for generating that array.


## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing different trading frames within the backtest environment. Think of it as a smart router that directs requests to the correct frame based on the active context. 

It automatically finds and provides the right frame implementation, avoiding manual selection. To speed things up, it remembers frequently used frames, so you don't have to recreate them every time.

The service also handles timeframe management, letting you define the start and end dates for your backtests. When running in live mode, no specific frame is selected, allowing for unconstrained operation.

The `getFrame` method is key; it's how you retrieve a frame instance, and it’s optimized for efficiency thanks to caching.  `getTimeframe` allows you to easily pull the date boundaries for backtesting a particular symbol.

## Class ExchangeValidationService

This service helps keep track of your trading exchanges and makes sure they’re set up correctly before you start trading. It acts like a central registry, allowing you to register new exchanges and easily check if they're valid. 

Think of it as a safety net – it verifies that an exchange actually exists before your trading logic tries to use it, preventing unexpected errors. To improve speed, it remembers the results of past validations so it doesn't have to repeat the checks unnecessarily. 

You can use it to add new exchanges, confirm their validity, and get a complete list of all exchanges you’ve registered. The service also has a place to store logging information and maintains an internal map of exchanges.

## Class ExchangeUtils

This class, `ExchangeUtils`, offers helpful tools for working with different exchanges within the backtest-kit framework. Think of it as a centralized place to handle common exchange-related tasks like fetching data and formatting numbers.

It’s designed to be easy to use – there’s only one instance of it available, making it accessible wherever you need it.

You can use `getCandles` to retrieve historical price data, and it cleverly figures out the right date range for you, ensuring consistency with how data was handled previously.

Need to calculate the average price? `getAveragePrice` provides that functionality based on recent candlestick data.

Finally, `formatQuantity` and `formatPrice` ensure that the quantities and prices you're working with are correctly formatted according to the specific rules of the exchange you're using, avoiding potential errors.

## Class ExchangeSchemaService

The ExchangeSchemaService helps you keep track of different exchange configurations in a safe and organized way. It’s like a central repository for your exchange settings, making sure they're consistent and well-defined. 

You add new exchange configurations using `addExchange()`, and then you can easily find them later by their name using `get()`. Before adding a new exchange, the service checks if it has the essential parts, a process managed by `validateShallow`. If an exchange already exists, you can update parts of its configuration using `override()`. This service relies on a secure storage system to prevent errors and ensures everything stays properly typed.

## Class ExchangeCoreService

This service acts as a central hub for interacting with an exchange, streamlining common operations and ensuring the right information is available for each request. It combines connection to the exchange with the details of the trading environment, like the symbol being traded and the specific time period. 

The `validate` function checks the exchange configuration to make sure everything is set up correctly, remembering previous checks to avoid unnecessary repetition. 

Several key functions provide access to data, including fetching historical candles (`getCandles`), simulating future candles specifically for backtesting (`getNextCandles`), calculating average prices (`getAveragePrice`), and formatting price and quantity values (`formatPrice`, `formatQuantity`). All these functions consider the context of the execution, whether it’s a real-time trade or a backtest simulation.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It automatically directs your requests to the correct exchange based on the currently active context, so you don't need to specify it manually. 

To optimize performance, it cleverly caches the connection details for each exchange, reusing them whenever possible. You can think of it as a smart router that handles all your exchange-related operations.

Here's a breakdown of what it offers:

*   **Easy Exchange Selection:** It figures out which exchange to use without you having to tell it.
*   **Performance Boost:** It remembers exchange connections to avoid repetitive setup.
*   **Full Exchange Functionality:** It provides all the standard methods for interacting with an exchange.
*   **Candle Data Retrieval:** It fetches historical and subsequent candle data for specific symbols and time intervals.
*   **Price Averaging:** It can get you the current average price, whether you're backtesting or trading live.
*   **Price and Quantity Formatting:** It makes sure your prices and quantities adhere to the specific formatting rules of each exchange, which is crucial for successful orders.

## Class ConstantUtils

This class provides a set of pre-calculated percentages used for setting take-profit and stop-loss levels, designed around the Kelly Criterion and an exponential decay of risk. These values represent portions of the total distance to your final profit or loss targets. 

For instance, if your target profit is 10%, `TP_LEVEL1` (30) means a partial take-profit is triggered when the price reaches 3% profit. `TP_LEVEL2` locks in 6% of profit, and `TP_LEVEL3` captures 9%.  A similar concept applies to stop-loss levels, helping to manage risk and reduce exposure as the trade progresses.

The class offers constants for three take-profit levels (`TP_LEVEL1`, `TP_LEVEL2`, `TP_LEVEL3`) and two stop-loss levels (`SL_LEVEL1`, `SL_LEVEL2`), each indicating the percentage of the total distance that must be traveled before the level is triggered.  You can use these constants to automate your trading strategies and manage profit-taking and risk mitigation.

## Class ConfigValidationService

This service is your safety net when setting up trading configurations. It meticulously checks all the important parameters in your global settings to make sure everything adds up mathematically and prevents you from accidentally creating a system that will lose money. 

It verifies things like ensuring your slippage and fees aren’t unrealistic, that your profit margins are positive, and that your take profit distance is sufficient to cover those costs. The service also makes sure your timing settings and retry attempts are valid numbers, and that your candle data parameters are reasonable. Essentially, it's there to catch potential errors before they lead to real-world losses.

The `validate` function is the core of this process, performing all these checks against your configuration. The `loggerService` is used to report any issues found during validation.

## Class ColumnValidationService

The ColumnValidationService helps ensure your column configurations are set up correctly and avoid common errors. It acts as a safety net when defining how data is displayed and handled, making sure everything aligns with the expected structure.

Essentially, it performs a thorough check of your column definitions, verifying that each column has all the necessary components like a unique identifier (key), a descriptive name (label), formatting instructions (format), and visibility settings (isVisible). It also confirms that your keys are unique and that the formatting and visibility are handled by functions. This service ensures your column setups are consistent and prevents potential problems down the line.


## Class ClientSizing

This component, called ClientSizing, helps determine how much of your capital to use for each trade. It's a flexible system that lets you choose from several different sizing strategies, like using a fixed percentage of your capital, the Kelly Criterion, or the Average True Range (ATR). You can also set limits on the minimum and maximum position sizes, and restrict the overall percentage of your capital that can be used.  It’s designed to work within a trading strategy, providing calculated position sizes based on the strategy's needs and your defined rules.

The `calculate` method is the core of this component, taking in parameters and returning the calculated position size.  The `params` property holds the configuration settings that control the sizing behavior.


## Class ClientRisk

ClientRisk helps manage risk across your entire portfolio, acting as a safeguard for your trading strategies. It keeps track of all open positions, even those from different strategies, to prevent you from exceeding your pre-defined limits. 

Think of it as a central authority ensuring your strategies don't take on more risk than you're comfortable with. It can enforce rules like limiting the number of positions you have open at once and even allows you to create your own custom risk checks. 

This component simplifies portfolio-level risk management and keeps your trades within safe boundaries. It automatically loads and saves position data (except during backtesting) and offers a way to register and unregister signals to monitor their lifecycle.

## Class ClientOptimizer

The ClientOptimizer is responsible for handling the behind-the-scenes work of optimizing trading strategies. It gathers data from various sources, which can include historical price data and other relevant information. It then uses this data to build the code for your trading strategy, leveraging templates to ensure it's well-structured and ready to run.

The optimizer also keeps track of its progress and reports updates to you. You can configure it with specific parameters to control how it operates, and it can automatically save the generated strategy code to a file. This component is a key part of how the backtest-kit framework enables you to efficiently create and refine your trading strategies. 

Essentially, it's your assistant for building and exporting strategy code.


## Class ClientFrame

This `ClientFrame` component is responsible for creating the timeline of historical data your backtesting strategy will use. Think of it as the engine that produces the sequence of dates and times your trading decisions will be based on. It efficiently generates these timelines, avoiding unnecessary repetition through caching, and it's designed to work with various time intervals, from one-minute increments to three-day spans. 

It allows you to customize the timeframe creation process with callbacks for verification and logging, and it's specifically used within the backtest logic to navigate through historical data. 

The `getTimeframe` property is the key method here; it's what you’ll use to actually generate the timeframe array for a given symbol. Because it uses a caching mechanism, it only creates the timeframe once, making the process fast and efficient for repeated use.


## Class ClientExchange

This component acts as a bridge to retrieve data from an exchange, designed specifically for backtesting scenarios. It allows you to pull historical and future candle data—essential for recreating past market conditions and simulating trades.  You can fetch candles going backwards in time, reflecting past events, and also pull candles forward to account for signal durations during your backtest.

It also calculates the VWAP, or Volume Weighted Average Price, based on recent trading activity, which is useful for analyzing price trends.  Finally, it handles the complexities of formatting trade quantities and prices to match the exact specifications of the exchange you’re working with, ensuring your simulated trades align with real-world rules.  The system is built with memory efficiency in mind, using prototype functions.

## Class CacheUtils

CacheUtils provides a simple way to automatically cache the results of functions, making your backtesting process more efficient. Think of it as a tool that remembers function results so it doesn't have to recalculate them repeatedly, especially useful when dealing with time-based data. 

It works by wrapping your functions, and each function gets its own dedicated caching area.  You specify a timeframe interval when wrapping, which determines when the cache needs to be refreshed.

If you need to force a recalculation, you have two options: `clear` removes the cached value *only* for the current trading setup (strategy, exchange, backtest mode), while `flush` completely wipes out the cache for that function, regardless of the trading setup.  `flush` is great for when you've changed how a function works and want to ensure all cached results are invalid, or to free up memory.

## Class BacktestUtils

BacktestUtils is a handy tool for managing and running backtests within the trading framework. Think of it as a central place to kick off backtest processes, monitor their progress, and grab important data.

It simplifies the process of running backtests by providing a straightforward way to execute them and log their results. The `run` function is your go-to for initiating a backtest, while `background` lets you run them in the background without needing to process the results immediately – perfect for tasks like logging or triggering other actions.

You can also check on what’s happening with your backtests.  `getPendingSignal` and `getScheduledSignal` let you see the signals a strategy is currently working with.  If you need to put a stop to a backtest, the `stop` function gracefully halts signal generation.  For more targeted cancellations, `cancel` removes scheduled signals without interrupting the overall backtest.

To analyze completed backtests, `getData` provides statistics, and `getReport` generates a markdown report. The `dump` function lets you save these reports directly to your disk. Finally, `list` gives you a snapshot of all currently running backtest instances and their status. The whole class is designed for easy use, ensuring you have a single, accessible point for your backtesting needs.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you automatically create and save reports about your backtesting results in a readable Markdown format. It listens for signals generated during backtests, keeping track of how each strategy performed on different symbols.

Essentially, it gathers information about closed trades – when they started, ended, and how profitable they were – and organizes it neatly into tables. These tables are then compiled into a Markdown report file, conveniently saved to your logs directory.

You don't have to worry about setting up the initial reporting, as it handles that automatically the first time you use it. The service uses a clever system to keep data separate for each symbol and strategy, ensuring you get a clear picture of how each one is doing.  You have the option to clear out old data when you’re finished with a backtest, or clear only a specific backtest's information if needed. If you need to retrieve summary statistics or a complete report for a specific symbol and strategy, it provides methods to do so.

## Class BacktestLogicPublicService

BacktestLogicPublicService helps you run backtests more easily by handling the behind-the-scenes details for you. It builds on another service to automatically manage important information like the strategy name, exchange, and frame, so you don't have to pass it around every time you need it. This makes things cleaner and simpler when you're requesting data or generating signals during your backtest.

The core functionality is the `run` method, which kicks off a backtest for a specific symbol.  It streams the results back to you in a way that allows you to process them step-by-step. Think of it as automatically setting the stage so your trading strategy can play out its history.


## Class BacktestLogicPrivateService

This service helps orchestrate the backtesting process, especially when dealing with lots of data. It works by getting a list of timeframes and then processing them one by one. When a trading signal appears, it fetches the necessary historical data and runs the backtesting logic. 

The system jumps ahead in time to when the signal closes, then provides a result, and continues with the next timeframe. This process is designed to be memory-efficient because it doesn't store everything in memory at once; instead, it streams the results. You can also stop the backtest early if needed. 

Essentially, it's a way to run backtests in a more streamlined and efficient way using asynchronous generators. The `run` method is the main entry point; you give it a symbol and it streams back the backtest results.

## Class BacktestCommandService

This service acts as a central hub for running backtests within the backtest-kit framework. Think of it as a convenient way to access the core backtesting functionality, especially useful when you're setting things up with dependency injection. 

It bundles together various other services, like those for handling strategy and exchange validation, ensuring everything works together smoothly.

The main thing it offers is the `run` method. This lets you initiate a backtest for a specific trading symbol, providing details like the strategy, exchange, and timeframe you want to use. The `run` method delivers backtest results step by step, allowing you to analyze the process as it happens.
