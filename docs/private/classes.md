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

This service helps you keep track of and verify your walker configurations, which are essential for parameter sweeps and hyperparameter tuning. It acts as a central place to register your walkers, ensuring they’re available before you try to use them. To speed things up, it remembers the results of previous validations. 

You can use it to add new walkers, check if a walker exists, and get a full list of all the walkers you’ve registered. It simplifies the process of managing and confirming your optimization setups. 

Think of it as a helpful assistant for keeping your parameter sweeps organized and error-free.


## Class WalkerUtils

WalkerUtils is a handy tool for working with walkers, which are essentially sets of trading strategies. It simplifies running and managing these walkers, taking care of some of the complexities behind the scenes. Think of it as a central place to start, stop, and get information about your walkers.

The `run` function lets you execute a walker comparison for a specific symbol, giving you the results as they become available. If you just want a walker to run in the background for things like logging or triggering other actions, use `background`.

Need to pause a walker’s activity? The `stop` function gracefully halts all strategies within a specified walker, allowing current signals to finish before stopping new ones. 

You can also retrieve the complete data from a walker with `getData` or create a nicely formatted report using `getReport` and save it to a file with `dump`. Finally, `list` gives you a quick overview of all your active walkers and their status. WalkerUtils is designed to be easy to use and helps keep your walker operations organized and efficient.

## Class WalkerSchemaService

The WalkerSchemaService helps keep track of different schema definitions for your trading strategies, ensuring they're consistent and correctly structured. It acts like a central repository where you can store and manage these schemas. 

You add new schemas using the `addWalker()` method, and can retrieve them later using their names. Before a schema is officially registered, it's checked to make sure it has all the necessary components and the right types.

If you need to update an existing schema, you can do so using the `override()` method which allows you to change specific parts of it. The `get()` method lets you quickly find a schema by its name when you need it. This service uses a special registry to store schemas safely and with type checking.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you automatically create and save reports about your backtesting strategies. It listens for updates from your walkers – the components that run your strategies – and keeps track of how each strategy is performing. 

It builds nicely formatted markdown tables that compare different strategies, making it easy to analyze your results. These reports are then saved as files, typically in a `logs/walker/{walkerName}.md` location.

The service uses a clever storage system to ensure each walker has its own set of data. It also handles the initialization process automatically, so you don't have to worry about setting things up. You can even clear out all the accumulated data when you're finished, or just clear the data for a specific walker.

## Class WalkerLogicPublicService

This service helps manage and run automated trading strategies, often called "walkers," in a structured way. It acts as a bridge between internal components and provides a simplified interface for running these strategies.

Think of it as an orchestrator – it handles the details of setting up and executing the walkers, automatically passing along important information like the trading symbol, the name of the strategy, and the specific trading environment. This means you don’t have to manually specify these details each time you run a walker.

The service relies on other components like a logger, a private walker logic service, and a schema service to function.

The main function, `run`, is used to initiate a comparison or execution of a walker for a given trading symbol, using the provided context. It returns a sequence of results from the walker's execution.


## Class WalkerLogicPrivateService

This service helps you run and compare different trading strategies, like a coordinator for your backtesting experiments. It takes a symbol, a list of strategies you want to test, a key metric to evaluate them on, and some contextual information.

As each strategy finishes running, you'll receive updates on its progress. The service keeps track of the best-performing strategy in real-time.

Finally, once all strategies are done, it delivers a complete report, ranking them based on your chosen metric. It relies on other services to actually perform the backtesting calculations and generate reports.

## Class WalkerCommandService

The WalkerCommandService acts as a central point for accessing various walker-related functionalities within the backtest-kit framework. Think of it as a convenient hub, making it easier to manage dependencies and interact with different services.

It bundles together essential services like logging, walker logic, schema management, and validation components. This simplifies how you work with walkers, especially when building larger systems.

The `run` method is a key feature. It lets you execute a walker comparison for a specific trading symbol, providing context about the walker, exchange, and frame being used.  This is useful for performing detailed analysis and comparisons.

## Class StrategyValidationService

This service helps you keep track of your trading strategies and make sure they're set up correctly. It acts like a central hub for managing your strategy configurations, allowing you to register new strategies and quickly check if they exist before you use them. 

The service also verifies any associated risk profiles, making sure everything aligns with your planned approach. To speed things up, it remembers the results of its validations, so you don't have to repeat checks unnecessarily. 

You can add strategies using `addStrategy`, validate them with `validate`, and get a complete list of all registered strategies with `list`. It's designed to simplify strategy management and reduce the chance of errors.

## Class StrategySchemaService

This service helps keep track of different strategy blueprints, ensuring they're all structured correctly. It uses a special system to store these blueprints in a type-safe way, preventing errors caused by mismatched data.

You can add new strategy blueprints using the `addStrategy` function, and find existing ones by their name with the `get` function. If a blueprint already exists, you can update parts of it using the `override` function.

Before a new blueprint is added, the system checks it to make sure it has all the necessary components and they are of the correct type, thanks to `validateShallow`.  Essentially, it’s like a librarian for your strategy templates, keeping everything organized and consistent.

## Class StrategyCoreService

StrategyCoreService acts as a central hub for managing and running trading strategies within the backtest-kit framework. It combines several other services to provide a streamlined way to interact with strategies, particularly during backtesting or live trading.

Think of it as a manager that ensures strategies have the information they need, like the specific trading symbol and the time period. This is done by injecting that data into the strategy's execution context.

It offers helpful functions like:

*   **Validation:** It verifies that a strategy and its risk settings are correctly configured, remembering previous checks to avoid unnecessary repeated validation.
*   **Signal Retrieval:** It can quickly fetch the current pending signal for a strategy, which is crucial for monitoring things like take-profit and stop-loss orders.
*   **Status Checks:**  It allows you to confirm if a strategy is currently stopped.
*   **Simulation & Execution:** It handles the core "tick" and "backtest" operations, which run the strategy's logic against market data. The "tick" function checks the signal status at a given point in time, while the "backtest" function performs a quick simulation.
*   **Control:** You can use it to stop a strategy from creating new signals or clear the cached strategy to force a fresh start.

Essentially, StrategyCoreService simplifies the process of working with strategies by providing a unified and efficient interface for common tasks.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub, directing trading operations to the correct strategy implementation. It manages and caches strategy instances, making sure the right strategy handles trades for specific symbols.

Think of it like a switchboard operator, connecting incoming trading requests to the appropriate strategy based on the symbol and strategy name. It remembers which strategies it's already set up, avoiding unnecessary work and keeping things efficient.

Before any trading activity happens, it ensures the strategy is properly initialized. You can use it to run live trading ticks (`tick()`), perform backtesting with historical data (`backtest()`), and even stop a strategy from generating further signals (`stop()`).  It also provides ways to check the current signal (`getPendingSignal()`) and stopped state (`getStopped()`) of a strategy. If you need to completely reset a strategy or free up resources, you can use the `clear()` function to force a fresh start.

## Class SizingValidationService

This service helps you keep track of and double-check your position sizing strategies in your backtesting setup. Think of it as a central hub for managing how much of your capital you're using for each trade.

It lets you register different sizing methods, like fixed percentage or Kelly Criterion, and then verifies they’re actually registered before you try to use them. This prevents errors from misspelled names or strategies that haven't been properly set up. 

To speed things up, it remembers whether a sizing strategy is valid or not, so it doesn’t have to re-check every time. You can also easily see a list of all the sizing strategies you’ve added. 


## Class SizingSchemaService

This service helps you keep track of how you size your trades. Think of it as a central place to store and manage different sizing strategies. It uses a safe system for storing these strategies, ensuring they're structured correctly.

You can add new sizing strategies using the `register` method, and update existing ones with `override`.  If you need to use a sizing strategy, simply retrieve it by name with the `get` method. Before a sizing strategy is saved, the system checks that it has the necessary information, a quick and basic check to help prevent errors. This service makes it easy to organize and access your sizing rules.

## Class SizingGlobalService

The SizingGlobalService helps determine how much of an asset to trade, playing a crucial role in the backtest-kit system. It acts as a central hub, coordinating the calculations needed for position sizing. Think of it as the engine that figures out the right size for your trades, taking into account factors like risk tolerance.

It relies on other services – the sizing connection service and a sizing validation service – to do its job, and it's used both behind the scenes by the core strategy execution and by the public-facing API.

The `calculate` method is its main function, receiving parameters and a context to determine the size for a given trade and then returning that calculated size as a number.  It's the core process for deciding how much to trade.


## Class SizingConnectionService

The SizingConnectionService acts as a central hub for handling position sizing calculations within the backtest-kit framework. It intelligently directs sizing requests to the correct sizing implementation based on a name you provide.

To optimize performance, it remembers (caches) previously used sizing implementations, so you don’t have to recreate them every time. This caching is a key feature for efficiency.

Essentially, it allows you to specify which sizing method (like fixed percentage, Kelly Criterion, or ATR-based sizing) you want to use and handles the details of finding and executing it. If your strategy doesn't require any sizing, the sizingName will be empty.

The service relies on other components like a logger and a sizing schema service to function properly. The `getSizing` property allows retrieving the sizing implementation, while the `calculate` method performs the actual size calculation based on your input parameters and context.

## Class ScheduleUtils

ScheduleUtils helps you keep an eye on how your trading signals are being scheduled and executed. Think of it as a handy tool for monitoring the timing and performance of your automated trading strategies.

It lets you easily grab data about scheduled signals, like how many are in the queue, how often they’re being canceled, and how long they typically wait. 

You can also generate clear, readable markdown reports that summarize this information, making it simple to identify potential bottlenecks or issues. This feature allows you to save these reports directly to your computer for later review. 

This is set up as a single, always-available instance so it’s easy to use in different parts of your backtesting or live trading system.

## Class ScheduleMarkdownService

This service automatically creates reports detailing your trading signals, specifically focusing on when signals are scheduled and cancelled. It keeps track of these events for each strategy you’re using, creating a running log of activity. The reports are presented in a readable markdown format and saved to your logs directory.

It gathers information from your trading platform's signal events, accumulating data for each strategy. You can retrieve statistics like cancellation rates and average wait times, and generate comprehensive reports showing all scheduled signal events. The service is designed to be easy to use – it automatically starts when needed, and you can clear the accumulated data whenever you like, either for a specific strategy or all of them. You can also control which data points appear in the reports.

## Class RiskValidationService

This service helps you keep track of your risk management setups and makes sure they're all in order before you start trading. Think of it as a central place to register and verify your risk profiles. 

It allows you to add new risk profiles using the `addRisk` method, and the `validate` method ensures that a risk profile actually exists before any actions are taken – preventing errors and unexpected behavior. 

To speed things up, the service remembers the results of previous validations, so it doesn’t have to re-check everything every time. You can also see a complete list of all registered risk profiles with the `list` method. It’s designed to manage and protect your risk configurations effectively.

## Class RiskUtils

The RiskUtils class provides tools for analyzing and reporting on risk rejections within your backtesting environment. Think of it as a way to examine why trades were potentially blocked or adjusted due to risk management rules.

It gathers information about rejected trades – things like the symbol involved, the strategy used, the position size, and the reason for rejection – and organizes it for review. You can request this data as aggregated statistics or as detailed reports presented in a readable Markdown format.

The `getData` method lets you pull out key statistics, like the total number of rejections. The `getReport` method constructs a comprehensive Markdown document, including a table of rejection events and summary statistics. Finally, `dump` allows you to easily save these reports to files on your system, helping you share and archive your risk analysis findings. The reports include crucial details such as the trade's timestamp, price, active positions, and the reason for the rejection, allowing for a deep dive into risk management performance.

## Class RiskSchemaService

This service helps you keep track of and manage your risk schemas, ensuring they're structured correctly. It uses a special system to store these schemas in a type-safe way, meaning the framework knows exactly what kind of data to expect. You can add new risk profiles using the `addRisk()` function, and easily find existing ones by their names using the `get()` function.

Before a new risk profile is added, it's checked to make sure it has all the necessary information in the right format – that's what the `validateShallow()` function does.  You can also update existing risk profiles by partially changing their properties with the `override()` function.  The `register` property is used internally for adding new risk schemas.

## Class RiskMarkdownService

This service helps you automatically generate and store reports detailing risk rejections during your trading backtests. It keeps track of every time a trade is rejected based on risk rules, organizing them by the asset (symbol) and trading strategy being used.

It collects these rejection events as they happen, then lets you easily create readable markdown reports summarizing the rejections, including helpful statistics like the total number of rejections and a breakdown by symbol or strategy. These reports are saved as files on your computer, making it simple to review and analyze your risk management setup. 

The service handles the behind-the-scenes organization, creating storage for each combination of symbol, strategy, and backtest, and automatically initializes itself when you start using it.  You can also clear out the accumulated data when you're done with a backtest or want to start fresh.

## Class RiskGlobalService

This service acts as a central hub for managing risk checks within the backtest-kit framework. It sits on top of a connection service to handle risk limit validation, and is used by both the trading strategies and the public-facing API. 

It keeps track of signals, adding them when a trade is opened and removing them when a trade is closed. To avoid unnecessary work, validations are cached to prevent repeating the same checks. 

You can clear out all risk data or focus on clearing data for a specific risk instance using the `clear` function. The service also logs its validation activities to help with monitoring and troubleshooting.

## Class RiskConnectionService

The RiskConnectionService acts like a dispatcher, making sure risk checks are sent to the correct place within your trading system. It's designed to efficiently handle risk assessments based on a name you provide, like "market risk" or "portfolio risk."

This service keeps a record of those risk assessment handlers (called `ClientRisk` instances) to avoid recreating them every time.  This memoization speeds things up considerably.

You can use it to check if a trading signal is safe to execute, register a new trade (adding a signal), or close out a trade (removing a signal), all while ensuring the appropriate risk limits are in place.  If a signal is rejected due to risk limits, the system will let you know.  

It also offers a way to clear the cached risk assessment handlers, which can be useful in certain situations.  If you don't have any specific risk configuration set up for a trading strategy, the risk name will be left blank.

## Class PositionSizeUtils

This utility class provides helpful tools for determining how much of your assets to allocate to a trade, also known as position sizing. It offers several pre-built methods to calculate the appropriate size, such as a fixed percentage of your account, the Kelly Criterion (which aims to maximize growth), and a method based on the Average True Range (ATR) to account for market volatility. 

Each sizing method is carefully validated to ensure it's being used correctly, and it includes details about the sizing method name for tracking purposes. You don’t need to create instances of this class; instead, you can directly use the provided methods to find the right position size for your strategy. 

Here's a quick breakdown of the available methods:

*   **fixedPercentage:** Uses a pre-defined percentage of your account balance.
*   **kellyCriterion:** Calculates size based on your win rate and win/loss ratio.
*   **atrBased:** Uses the ATR to adjust size based on market volatility.

## Class PersistSignalUtils

This class, PersistSignalUtils, helps manage how trading signals are saved and retrieved, especially when a trading strategy is running live. It makes sure signal data is stored safely and reliably for each strategy you're using.

Think of it as a secure vault for your trading signals, ensuring they’re not lost even if something unexpected happens.

It intelligently handles storage, automatically creating separate storage areas for each strategy. You can even customize how signals are stored using adapters. 

The `readSignalData` function is used to bring back previously saved signals, while `writeSignalData` saves the current signal. These operations are designed to be very safe, ensuring data isn't corrupted during crashes. Finally, you can register your own specialized storage methods with `usePersistSignalAdapter` if you need more control.

## Class PersistScheduleUtils

This class helps manage how scheduled signals are saved and loaded for your trading strategies, particularly when running in live mode. It ensures your strategies remember their scheduled actions even if the system crashes.

Essentially, it provides a way to store and retrieve scheduled signal data for each strategy, keeping track of things like when to place an order. It uses a clever system to automatically handle different storage methods (adapters) and ensures these operations are safe and reliable, preventing data loss.

The `readScheduleData` method retrieves existing scheduled signals from storage, while `writeScheduleData` saves new or updated signals. The system prioritizes protecting your data by using atomic write operations to prevent corruption.

You can also customize how these signals are stored by registering your own persistence adapter using `usePersistScheduleAdapter`.

## Class PersistRiskUtils

This class, PersistRiskUtils, helps manage and save information about active trading positions, specifically for different risk profiles. It acts as a central place to store and retrieve this position data.

Think of it as a smart storage system—it remembers past positions and allows you to plug in different ways to store that data, like using a custom adapter. The data writes are carefully handled to ensure they are safe even if the system crashes unexpectedly.

The `readPositionData` method lets you load the saved positions for a particular risk profile, and `writePositionData` saves changes to those positions. These are key functions used when bringing a trading system back online or updating its state. 

You can also customize how the data is stored by registering a custom persistence adapter using `usePersistRiskAdapter`.

## Class PersistPartialUtils

This utility class helps manage how partial profit and loss data is saved and loaded, particularly for strategies running live. It ensures that your strategy's progress isn't lost even if something unexpected happens.

The class uses a clever system to store these partial data levels, keeping them separate for each symbol and strategy combination. You can also plug in your own custom way of saving this data if the default isn’t suitable.

When your strategy starts up, `readPartialData` fetches any previously saved partial information. Similarly, `writePartialData` safely saves the current state after any changes to the profit/loss levels. This process is designed to be reliable and prevent data corruption by using atomic file operations.

Finally, `usePersistPartialAdapter` lets you customize how the data is stored, giving you flexibility to adapt to different storage needs.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing by gathering and analyzing performance data. It listens for events related to strategy execution and keeps track of key metrics for each strategy. You can then request summarized statistics like average performance, minimums, maximums, and percentiles to get a quick overview.

The service also generates detailed reports in markdown format, offering insights into potential bottlenecks in your trading logic. These reports are automatically saved to your logs directory.

To use it, you’ll provide a logger service and a way to access storage. The `track` method is how you feed performance information into the system; it's meant to be called from your existing performance tracking code. You can retrieve overall performance data, request reports, save reports to disk, and even clear out the accumulated data when needed. The service initializes itself to start listening for events, but it only does this once.

## Class Performance

The Performance class helps you understand how well your trading strategies are doing. It offers tools to gather and analyze performance data, providing insights into where your strategies might be struggling or succeeding.

You can retrieve detailed performance statistics, grouped by the different operations your strategy performs, giving you a clear picture of overall execution time, volatility, and potential outliers.

The class also lets you create easy-to-read markdown reports that visualize this data, highlighting potential bottlenecks and areas for optimization.  You can customize these reports to show specific data columns.

Finally, it's simple to save these reports directly to your hard drive for later review and sharing, with a default location under a `dump/performance` directory.

## Class PartialUtils

This class offers helpful tools for examining partial profit and loss data collected during backtesting or live trading. Think of it as a way to analyze the smaller wins and losses that contribute to your overall strategy performance.

It gathers information from partial profit and loss events—things like when a trade partially filled, or a stop-loss was triggered—and organizes them for you.

You can use it to:

*   Get a summary of key statistics like the total number of profit and loss events.
*   Create detailed markdown reports that show a table of these events, including crucial details like the symbol, strategy name, signal ID, position, level, price, and timestamp.  You can even customize the columns displayed in the report.
*   Save these reports directly to a file on your computer for later review or sharing.



Essentially, it simplifies the process of understanding and documenting those smaller, but important, pieces of your trading activity.

## Class PartialMarkdownService

This service helps you create and store reports detailing small profits and losses (partial profit/loss) during your trading backtests. It listens for these events and organizes them by the trading symbol and strategy used. 

You can then generate nicely formatted markdown reports, complete with statistics, summarizing these partial profits and losses.  These reports are saved to disk, allowing you to review performance in detail.

The service manages its data storage for each symbol and strategy combination separately, ensuring clarity and organization. It automatically initializes when needed, so you don't have to worry about setup.

You can clear out accumulated data when you're done analyzing a specific backtest, either for a single symbol-strategy combination or everything at once.  The service uses a logger to provide feedback during operation.

## Class PartialGlobalService

This service acts as a central hub for managing partial profit and loss tracking within your trading strategies. Think of it as a gatekeeper; it receives requests related to profit, loss, and clearing of these states, logs them for monitoring purposes, and then passes them on to a dedicated connection service to handle the actual work. It’s injected into your trading strategies as a single point of dependency, making your code cleaner and easier to maintain.

Essentially, this service sits between your trading logic and the underlying connection layer, giving you a place to keep an eye on what's happening with partial profits and losses at a global level.  Several validation services are also available for verifying strategy and risk configurations.

It provides functions to:

*   Record profits and losses, triggering events when new thresholds are met.
*   Clear the partial profit/loss state when a trade closes.
*   Validate that the strategy being used is valid and has the proper risk configuration.

## Class PartialConnectionService

The PartialConnectionService is like a smart manager for keeping track of profit and loss for each trading signal. It ensures there’s only one record for each signal, preventing clutter and saving memory.

Think of it as a factory that creates and handles these individual records (called ClientPartial objects) – it remembers them and makes sure they're properly set up with logging and notifications.

When a signal hits a profit or loss level, this service handles it by finding or creating the right record and updating it. When a signal closes, the service cleans up its record, removing it from memory.

This service works behind the scenes, being integrated into the larger trading strategy system to manage the detailed profit/loss tracking. It uses a clever caching mechanism to avoid creating unnecessary objects and events are sent out to notify about profit, loss, or clear events.

## Class OutlineMarkdownService

This service helps automatically create documentation in Markdown format, particularly useful for debugging and understanding how AI strategies are working. It's designed to capture the key steps in a conversation with an AI, like system prompts, user inputs, and the final output.

The service organizes this information into a structured directory, creating separate files for the system prompt, each user message, and the AI's final response. This makes it much easier to review the entire process later on.

The service avoids accidentally overwriting any previous documentation by checking if the directory already exists. It relies on a logger service to manage the file writing process. You can specify a custom output directory if needed.


## Class OptimizerValidationService

This service helps keep track of available optimizers and makes sure they're properly set up for your backtesting processes. Think of it as a central directory for your optimizers.

It allows you to register optimizers, making them known to the system.  You can add new optimizers with a name and a description of their structure.

Before using an optimizer, you can check with this service to confirm it’s registered. The validation process is designed to be quick, even if you're doing it repeatedly.

Need a quick overview of all the optimizers you have available? This service can provide a list of all registered optimizer schemas. 

It's also designed to avoid any naming conflicts when registering optimizers, ensuring things run smoothly.

## Class OptimizerUtils

This set of tools helps you work with strategies created by your optimizer. You can use it to retrieve strategy data, generate the actual code that will run your strategies, and save that code directly to files. 

The `getData` function pulls all the information about your strategies, combining data from different sources and building a record of how each strategy was trained.  The `getCode` function takes that information and turns it into a complete, runnable code file, including all the necessary parts like imports and helper functions. Finally, `dump` lets you automatically create and save these code files in a structured way.

## Class OptimizerTemplateService

This service acts as a central tool for building and customizing trading strategies using an LLM (Large Language Model). It automatically creates the necessary code snippets for your strategies, streamlining the development process.

It supports a range of features, including analyzing data across multiple timeframes (like 1-minute, 5-minute, and hourly charts), structuring the LLM's output into a clear JSON format for trading signals, and providing debugging logs. The service integrates with CCXT for exchange connectivity, and it allows for comparison of different strategies using a "walker" system.

You can tailor parts of the generated code by adjusting the optimizer schema configuration. The service provides templates for various components:

*   **Banners:**  It generates introductory code with imports and crucial settings.
*   **Prompts:** It handles the communication with the LLM, crafting messages for both the user and the assistant.
*   **Walkers:** Creates configuration code for comparing different strategies.
*   **Strategies:**  Generates the core strategy configuration, incorporating multi-timeframe analysis and signal generation.
*   **Exchanges:** Configures the connection to exchanges like Binance.
*   **Timeframes (Frames):** Sets up the data collection for specific time periods.
*   **Launchers:**  Produces the code to run the strategy comparisons and track progress.
*   **Debugging Helpers:** Creates functions for saving LLM conversations and results for easier troubleshooting.
*   **Text and JSON Generators:**  Specialized functions for the LLM to produce either text-based analysis or structured JSON trading signals, which include details like entry price, take profit targets, and stop-loss levels.

## Class OptimizerSchemaService

This service helps you manage and organize the settings for your optimizers, which are essentially the blueprints for how your trading strategies are tested and refined. Think of it as a central place to store and keep track of all those configurations.

It makes sure your optimizer setups are valid before they're saved, checking for essential pieces like the optimizer's name and data ranges. 

You can register new optimizer configurations with this service, update existing ones by modifying only certain parts, and easily retrieve them when you need to. It keeps a record of these configurations so you don't have to worry about losing them. The service uses a registry to securely store these schemas.

## Class OptimizerGlobalService

The OptimizerGlobalService acts as a central hub for interacting with trading optimizers. It ensures everything runs smoothly and securely before passing requests on to other components. Think of it as a gatekeeper – it logs each request, checks to make sure the optimizer you're asking about actually exists, and then handles the task.

You can use this service to retrieve data related to optimizers, get the complete code generated by an optimizer, or even save that code directly to a file. 

Here's a breakdown of what you can do:

*   **getData:**  Allows you to get the data and metadata associated with a specific optimizer for a given trading symbol.
*   **getCode:**  Provides you with the complete, runnable code produced by the optimizer.
*   **dump:**  Automatically creates and saves the generated optimizer code to a file, making it easy to deploy.

The service relies on other services for logging, connecting to optimizers, and verifying optimizer availability, all working together to provide a reliable and validated interface.

## Class OptimizerConnectionService

This service helps you easily work with optimizers, storing and reusing them to save time and resources. It acts as a central point for creating and managing optimizer clients, making sure you don't recreate them unnecessarily.

It combines custom templates with default settings to create the configurations you need, and it keeps track of everything so you can quickly get the code or data you're looking for. 

You can grab a cached optimizer instance with `getOptimizer`, fetch strategy data with `getData`, generate the full code using `getCode`, or even save the generated code to a file with `dump`. This simplifies the process of using optimizers within your trading framework.

## Class LoggerService

The LoggerService helps ensure consistent logging across the entire backtest-kit framework. It allows you to plug in your own logging solution, but automatically adds important details to each log message, like which strategy, exchange, and frame are being used, along with information about the symbol, time, and whether it’s a backtest. 

If you don't set up your own logger, it defaults to a “do nothing” logger, so it won't interfere with your application.

You can control the logging level with methods like `log`, `debug`, `info`, and `warn`, each adding context automatically.  The `setLogger` method is key for integrating your preferred logging library. The service internally manages context services to inject the relevant information.

## Class LiveUtils

LiveUtils helps you manage live trading sessions in a simple and reliable way. It acts as a central hub for running and controlling your trading strategies. Think of it as a helper that makes it easier to start, stop, and monitor your live trading activities.

It handles the complexities of keeping your trades running smoothly, even if things go wrong—it automatically recovers from crashes and persists important data. 

Here's what you can do with LiveUtils:

*   **Start Live Trading:** The `run` function lets you kick off a trading session for a specific symbol and strategy, continuously generating updates.
*   **Run in the Background:** If you just need your strategy to perform actions like saving data or triggering callbacks, the `background` function keeps it running without you needing to process the results directly.
*   **Stop Trading:** The `stop` function gently pauses a strategy, allowing existing trades to finish before stopping.
*   **Track Performance:** You can grab statistics (`getData`) and generate reports (`getReport`, `dump`) to see how your strategies are performing.
*   **Monitor Instances:** The `list` function gives you an overview of all the live trading sessions that are currently active.

LiveUtils is designed to be easy to use and keeps everything organized, ensuring your live trading runs effectively. It's a singleton, meaning there's only one instance to manage all your live trading operations.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create detailed reports of your trading activity. It keeps track of every event – from idle periods to when you open, manage, and close trades – for each strategy you’re using. 

Think of it as a record-keeping system that translates those trading events into easy-to-read markdown tables, including key statistics like win rate and average profit.  These reports are automatically saved to your logs folder, making it simple to analyze your trading performance over time.

The service works by listening for signals and accumulating data, so you simply need to make sure it’s connected to your trading environment.  It handles the creation of separate storage for each symbol and strategy combination, ensuring your data stays organized. It also initializes automatically, so you don't have to worry about setting it up manually.  You can clear this data if you need to start fresh or just wipe specific strategy or symbol data.

## Class LiveLogicPublicService

The LiveLogicPublicService acts as a central hub for live trading, simplifying how you run strategies. It builds upon a private service, automatically managing essential context like the strategy name and exchange.

You can think of it as a way to run your trading logic without constantly passing around context information.  It produces a continuous stream of trading signals – both when a position is opened and closed – and keeps running indefinitely.

A key benefit is built-in resilience: if the system crashes, it can recover and pick up where it left off, thanks to saved state. It uses the current time to ensure accurate real-time progression through the trading day. You just provide the trading symbol and the service handles the rest, creating a seamless trading experience.

## Class LiveLogicPrivateService

This service helps manage live trading by continuously monitoring a symbol and providing updates as they happen. It works like an always-on system, checking for signals and delivering results in a way that's efficient for your application. Think of it as a stream of information about trades, focusing only on when positions are opened or closed, not just when things are active.

Because it’s built to be reliable, it handles crashes gracefully and automatically recovers its state. The process keeps running indefinitely, so you don't have to worry about it stopping unexpectedly. It uses components like a logger, core strategy service, and method context service to function.

The `run` method is the main way to use this service; you tell it which symbol to monitor, and it starts sending you those trade updates as a continuous stream.

## Class LiveCommandService

This service acts as a central hub for interacting with live trading features within the backtest-kit framework. It’s designed to make it easy for different parts of the system to access live trading capabilities in a controlled and dependency-injected way. 

Think of it as a simplified layer on top of another internal service, ensuring a consistent and manageable approach to live trading.

It handles tasks like validating strategies and exchanges, and it includes essential components for risk management and schema handling.

The core functionality lies in its `run` method, which allows you to start a live trading session for a specific symbol. This method continuously produces results as the trading occurs, and it's designed to be resilient, automatically recovering from potential errors during the process. It's essentially an ongoing stream of trading updates.


## Class HeatUtils

HeatUtils helps you visualize and analyze your trading strategy's performance with easy-to-understand heatmaps. It automatically gathers data from your closed trades and consolidates it for each symbol and the overall portfolio, making it simple to see where your strategy is succeeding and where it might need adjustments.

You can use HeatUtils to get raw data representing the heatmap statistics, or to generate a nicely formatted markdown report displaying key metrics like total profit, Sharpe ratio, and maximum drawdown for each symbol.  This report sorts symbols by profit, so you can quickly identify your top performers.

Finally, HeatUtils can save these reports directly to your file system, creating a directory if needed, so you can share your analysis or keep a record of your strategy's evolution. This functionality is always available as a single, easy-to-access instance.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and analyze your backtest results, providing a clear picture of how your strategies are performing. It gathers data on closed trades and organizes it into useful statistics, like total profit/loss, Sharpe Ratio, and maximum drawdown, both for individual assets and your entire portfolio.

Think of it as a dashboard that generates reports – formatted as easy-to-read Markdown tables – to summarize performance. You can specify which metrics to include in these reports and even save them directly to files. The service keeps things organized using separate storage areas for each strategy and whether you're running a backtest or live trading simulation. 

It automatically sets itself up when you first start using it, and it’s designed to handle potential errors like missing data gracefully. This allows you to quickly assess strategy performance and navigate between different strategy runs.

## Class FrameValidationService

This service helps you keep track of and double-check your trading timeframes, ensuring everything is set up correctly. Think of it as a central manager for all your timeframe configurations. You can register new timeframes using `addFrame()`, and before you start trading or running any calculations, `validate()` makes sure the timeframe you’re using actually exists.  To speed things up, it remembers validation results so it doesn’t have to check repeatedly. Finally, `list()` gives you a complete overview of all the timeframes you've registered.

## Class FrameSchemaService

This service helps you keep track of the different structures, or "schemas," that your backtesting framework uses. It’s like a central library where you define what a trading frame *should* look like, ensuring everything stays consistent and avoids errors. It uses a special type-safe storage system for managing these schemas, and makes sure new schemas fit the expected format before adding them to the library.

You can add new schemas using `register()`, update existing ones with `override()`, and easily retrieve them by name with `get()`. This allows you to organize and reuse your frame definitions, making your backtesting setup much more maintainable and reliable.

## Class FrameCoreService

This service is the central hub for managing timeframes within the backtesting framework. It works behind the scenes to create the sequences of dates and times needed to run a backtest. Think of it as the engine that powers the chronological progression of your trading simulation.

It relies on other services to connect to data sources and validate the timeframes generated. Specifically, it uses `FrameConnectionService` to establish the connection and `FrameValidationService` to ensure the resulting timeframes are accurate and suitable for analysis. 

The `getTimeframe` method is the primary function you'll encounter; it takes a trading symbol and a timeframe name (like "1h" or "1d") and returns a Promise that resolves to an array of dates representing that timeframe.


## Class FrameConnectionService

The FrameConnectionService acts like a traffic controller for your trading frames, making sure operations go to the right place. It automatically figures out which frame to use based on the current context, so you don't have to manually specify it. 

To speed things up, it remembers previously created frames, reusing them when possible. It also provides a straightforward way to get the start and end dates for a backtest, allowing you to focus on a specific timeframe for analysis. When running in live mode, it doesn’t impose any frame constraints, giving you maximum flexibility. 

It relies on a logger, schema service, and method context service to function, and offers a method to fetch frames and a way to determine the timeframe for backtesting.

## Class ExchangeValidationService

This service helps you keep track of your trading exchanges and make sure they're set up correctly before your backtests run. Think of it as a central place to register and double-check your exchanges.

You can add new exchanges using `addExchange()`, which stores their configuration details.  Before you start a backtest, use `validate()` to confirm an exchange is properly registered and active.  To see a complete list of all exchanges you’ve registered, the `list()` method provides that information. The system also remembers validation results to speed things up.

## Class ExchangeSchemaService

The ExchangeSchemaService helps keep track of different exchange configurations in a safe and organized way. It uses a special system to store these configurations, ensuring they are consistent and reliable. You can add new exchange configurations using the `addExchange()` method, and easily find them again later by their names.

The service performs a basic check when you add a new configuration to make sure it's structured correctly. 

If a configuration already exists, you can update specific parts of it using the `override()` method. Finally, you can retrieve a specific exchange configuration by providing its name.


## Class ExchangeCoreService

This service acts as a central hub for all exchange-related operations within the backtest framework. It's designed to work closely with other core services, ensuring that every exchange interaction considers the specific trading symbol, the timestamp, and the backtest parameters. Think of it as a layer that wraps around the connection to the exchange, adding extra context for accurate simulations and analysis.

It keeps track of important things like validation logs and connection details.  

It provides handy functions for retrieving historical and, in backtest mode, even future candlestick data. You can also use it to calculate average prices and format price and quantity values appropriately for the context of your trade.  This formatting takes into account the trading environment, whether it's a live trade or a backtest.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently directs your requests to the correct exchange based on the current context, streamlining your trading operations. 

It keeps track of exchange connections to avoid repeatedly establishing them, making things faster and more efficient. You can use this service to fetch historical price data (candles), get the latest average price, and properly format prices and quantities to meet each exchange's specific requirements. The service handles details like fetching candles for backtesting or live trading and calculating average prices depending on the mode you're using.

## Class ConstantUtils

This class provides a set of pre-calculated values that help define take-profit and stop-loss levels for your trading strategies. These levels are based on the Kelly Criterion and incorporate an exponential risk decay method, designed to optimize risk and reward. Think of them as guideposts along the way to your ultimate profit or loss targets.

For example, if you're aiming for a 10% profit, `TP_LEVEL1` (30) means the first take-profit trigger happens when the price moves 3% in your favor, `TP_LEVEL2` is at 6%, and `TP_LEVEL3` at 9%. Similarly, `SL_LEVEL1` and `SL_LEVEL2` provide early warnings and final exit points for your stop-loss, protecting your capital. They're intended to help you manage risk progressively throughout a trade.


## Class ConfigValidationService

The ConfigValidationService helps make sure your trading configurations are mathematically sound and won't lead to losses. It acts as a safety net, checking all the settings you've defined for things like slippage, fees, and profit margins. 

It makes sure key relationships hold true, such as ensuring your stop-loss distance isn't smaller than your take-profit distance. The service also verifies that your take-profit distance is large enough to cover all potential trading costs – slippage and fees – so you're actually making money when a trade hits its target. 

You’ll find checks on time-based settings too, ensuring timeouts and lifecycles are set to reasonable positive integer values. It also looks at candle-related parameters, ensuring retry counts, delays, and anomaly detection thresholds are properly configured. The `validate` method performs these comprehensive checks, keeping your backtesting environment reliable and your results trustworthy.

## Class ColumnValidationService

This service helps keep your column configurations in good shape. It makes sure each column definition has all the necessary pieces – a unique key, a readable label, a format for displaying data, and a way to control its visibility. 

The service verifies that each column’s key and label are strings, and that the format and visibility settings are actually functions that can be executed. It also ensures all your keys are unique, preventing any confusion or errors when working with your data. Essentially, it acts as a safety net to catch any mistakes in your column setup before they cause problems.

## Class ClientSizing

This component, called ClientSizing, figures out how much of your assets to allocate to a trade. It's designed to be flexible, offering several ways to determine position size, such as using a fixed percentage, the Kelly Criterion, or Average True Range (ATR).  You can also set limits on how much you can trade at once, both in absolute terms and as a percentage of your total capital.

The `calculate` method is the core of this component – it takes in trading parameters and produces a recommended position size. This component provides a building block for strategies to help manage risk and optimize potential returns. It uses configurable parameters to control its behavior, allowing for customization to fit different trading styles.

## Class ClientRisk

ClientRisk helps manage the overall risk of your trading portfolio, acting as a gatekeeper to ensure your strategies don't exceed predefined limits. It’s designed to work across multiple trading strategies, analyzing their combined impact on your risk exposure. 

Think of it as a safety net that prevents signals from being executed if they would push you beyond your set boundaries, such as a maximum number of open positions. It allows for custom risk checks, giving you granular control over what trades are permitted.

Internally, it keeps track of active positions, storing them so all connected strategies can see the bigger picture. This tracking is automatically handled and persists data, but skips persistence when running backtests.

The `checkSignal` method is key; it’s what evaluates each potential trade against your risk rules. Signals are registered with `addSignal` when opened and removed with `removeSignal` when closed.

## Class ClientOptimizer

This component, called ClientOptimizer, is responsible for handling the optimization process, working behind the scenes to manage data and generate code. It acts as a bridge between various data sources and the optimization logic.

It gathers information from different places, often in batches, and prepares it for use.  It keeps track of the optimization's progress and sends updates as it goes.

The ClientOptimizer can create complete strategy code based on provided templates and data, combining necessary elements into a runnable file.  You can also save this generated code directly to a file, with the option to specify the location.  Essentially, it's the workhorse for producing optimized trading strategies.

## Class ClientFrame

The `ClientFrame` component is responsible for creating the sequences of timestamps that your backtesting engine uses to step through historical data. Think of it as the engine that generates the timeline for your trading simulation. It avoids repeating work by caching these timelines, and you can customize how frequently the timestamps are generated – from every minute to every three days.  You can also add your own logic to validate or record information as these timestamps are being created.  It works closely with the backtesting logic to ensure the simulation proceeds correctly through time. 

The `getTimeframe` property is the main way to get these timestamp arrays; it fetches the timeline for a specific trading symbol and ensures it's only generated once.  You can clear the cached timeline if needed.

## Class ClientExchange

This class provides a way to interact with an exchange when running backtests. It's a client-side implementation designed to efficiently retrieve historical and future price data, crucial for simulating trading strategies. You can request candles (price bars) from the past and into the future, which is useful for understanding how a strategy would have performed over time.

The class also calculates the VWAP, or Volume Weighted Average Price, a common indicator used in trading. It also helps ensure that price and quantity values are presented in the correct format for the specific exchange being used, adhering to their particular rules. This client is built for performance, using techniques to minimize memory usage.

## Class BacktestUtils

BacktestUtils is a handy tool that simplifies running backtests and managing their results. Think of it as a central place to start, stop, and analyze your trading simulations. It keeps track of each backtest, ensuring that each symbol and strategy combination has its own dedicated space.

You can easily start a backtest using the `run` method, which streams back the results as they come in.  If you just want to run a backtest for something like logging or testing a callback without needing to see the results directly, the `background` method is perfect. 

Need to pause a strategy? The `stop` method gently halts signal generation, allowing existing trades to finish before stopping completely.

After a backtest is complete, you can retrieve performance statistics with `getData` or generate a nicely formatted markdown report with `getReport`.  Want to save that report to a file?  Use `dump`.  Finally, `list` lets you see the status of all your currently running backtests.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create easy-to-read reports about your trading backtests. It automatically tracks the signals generated by your strategies as they close, neatly organizing the data for each symbol and strategy you’re testing. 

Essentially, it listens for events during your backtest, collects information about closed trades, and then formats that information into markdown tables. You can then save these reports as `.md` files, which are easy to view and share. 

The service keeps data organized using a system of storage, ensuring that information for each symbol, strategy, and backtest is kept separate. You can request overall statistics, generate full reports, or clear the collected data when you're finished with a particular backtest. It also handles creating the necessary folders for saving these reports automatically. The service initializes itself automatically, so you don’t have to worry about setting it up manually.

## Class BacktestLogicPublicService

BacktestLogicPublicService makes running backtests easier by handling background details for you. It takes care of passing information like the strategy name, exchange, and frame to the underlying backtesting engine, so you don't have to specify it repeatedly. 

Think of it as a helpful layer that simplifies how you interact with the core backtesting logic.

It primarily offers a `run` method which lets you initiate a backtest for a given symbol and provides the results as a stream of data. The `run` method automatically manages the context for each backtest step.

## Class BacktestLogicPrivateService

This service helps orchestrate backtesting processes, especially when dealing with a lot of data. It works by efficiently pulling timeframe data and processing trading signals. Think of it as a conductor leading an orchestra, step-by-step: it first gets the timing information, then processes each tick, and when a trading signal appears, it fetches the necessary data to execute the backtest. 

The system cleverly streams results as it goes, avoiding building up massive arrays in memory, which is great for performance.  You can even stop the backtest early if needed.

The `run` method is the main entry point; it takes a symbol as input and returns a stream of backtest results for closed trading signals.  The service relies on other components – like services for logging, strategy execution, exchange data, timeframes, and method context – to do its job.


## Class BacktestCommandService

This service acts as a central point to control and manage backtesting operations within the framework. Think of it as a helpful intermediary, simplifying how you interact with the core backtesting engine. It bundles together several other services, allowing you to easily inject dependencies and keep your code organized. 

The `run` function is the main tool you'll use – it kicks off a backtest for a specific trading symbol and provides results in a step-by-step fashion, so you can monitor progress and analyze what's happening. You'll need to specify the strategy, exchange, and frame to use for the backtest. 

It provides access to validation services for strategies, exchanges and frames as well, to ensure the backtest configuration is valid.
