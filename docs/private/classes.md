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

The WalkerValidationService helps you keep track of your parameter sweep configurations, often used for optimizing trading strategies or tuning hyperparameters. Think of it as a central place to register and verify these configurations exist before you try to use them. 

It provides a way to add new configurations, ensuring they're properly set up.  It also checks if a configuration is valid before operations begin, preventing errors down the line. To boost efficiency, the service remembers the results of these validations, so it doesn’t have to repeatedly check the same configurations. Finally, you can easily see a full list of all the registered configurations at any time.

## Class WalkerUtils

WalkerUtils provides a set of helpful tools to manage and interact with walkers, which are used for backtesting and analyzing trading strategies. Think of it as a simplified way to run and monitor those backtesting processes.

It offers a single, easy-to-use instance to control walkers, automatically handling details like identifying the correct exchange and walker name. You can initiate walker comparisons, run them in the background for tasks like logging, or completely stop them, preventing new signals from being generated—all while ensuring it's safe and doesn't interrupt existing trades.

The class also lets you retrieve complete data and generate reports on walker results, and even save those reports directly to your disk. Finally, you can check the status of all currently running walkers to keep track of what's happening.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of different blueprints, or "walkers," used in your system. Think of it as a central place to store and manage these blueprints in a way that's checked for correctness.

It uses a special system to ensure your blueprints are stored safely and with the right types. 

You can add new blueprints using `addWalker()` and find them again later by their names. The `validateShallow` function checks that new blueprints have all the necessary pieces before they're added.  If you need to change a blueprint that already exists, the `override` function lets you update just the parts that need changing. Finally, `get` allows you to easily look up blueprints by their name.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you create and save reports about your trading strategies as readable markdown documents. It listens for updates as your strategies run (using “walker” events) and keeps track of their performance. The service organizes this data, compares different strategies, and presents the information in tables. These reports are automatically saved to files in your logs directory, making it easy to review and analyze your trading results.

The service uses a clever system to manage data, ensuring each trading strategy has its own dedicated storage space. It provides functions for retrieving data, generating the markdown reports, and saving them to disk. You can even customize which data points are included in the reports.  The service also has a handy way to clear out old data when you’re finished, either for a specific strategy or all of them. It’s designed to be simple to set up – it automatically initializes when you first use it.

## Class WalkerLogicPublicService

This service helps manage and run automated trading strategies, acting as a public interface to the core logic. It automatically passes along important information like the strategy name, exchange, and frame used, simplifying how you set up and execute tests. 

Think of it as a helper that streamlines the process of running your trading strategies by handling background details. You can use it to run comparisons of strategies for a specific financial instrument, letting it take care of setting up the necessary context. 

It relies on other internal services to do its job, and it provides a `run` method to start the testing process, giving you a stream of results back.

## Class WalkerLogicPrivateService

The WalkerLogicPrivateService helps you compare different trading strategies against each other. It's designed to orchestrate these comparisons, giving you updates as each strategy finishes running.

Essentially, it manages the process of testing each strategy, tracking which one performs best as it goes, and then presenting you with a final, ranked list of results. 

It uses another service, BacktestLogicPublicService, to actually run the individual strategy backtests. The `run` method is how you kick off a comparison, providing details like the ticker symbol, the strategies to compare, the metric you're using to judge them, and some context information about the environment. As each strategy completes, it'll send you a progress update with the results.

## Class WalkerCommandService

The WalkerCommandService acts as a central point for accessing the core walker functionality within the backtest-kit. Think of it as a convenient manager that brings together several important services, making it easier to work with walkers in a consistent way. It's designed to be used when you need to inject dependencies, ensuring different parts of your code can work together smoothly.

It handles tasks like validating strategies, exchanges, and frames, and has access to services that deal with walker schemas and risk assessments.

The most important thing it does is the `run` function. This function is what you’ll use to kick off a walker comparison, telling it which symbol to analyze and providing details like the walker’s name, the exchange it's using, and the frame it's operating within. The `run` function provides a stream of results, letting you process the comparison step-by-step.

## Class StrategyValidationService

This service helps you keep track of your trading strategies and make sure they're set up correctly. It acts like a central hub, managing a list of your strategies and their configurations. Before you try to use a strategy, this service can double-check that it exists and that any associated risk settings are also valid. 

You can easily add new strategies to the system using `addStrategy`, and `list` provides a quick way to see everything that's registered. For efficiency, the service remembers previous validation results to avoid unnecessary checks. This can really speed up your testing process and helps ensure that your strategies are reliable.

## Class StrategySchemaService

The StrategySchemaService helps you keep track of your trading strategies and their definitions in a safe and organized way. It acts like a central library where you can register your strategy blueprints – the `IStrategySchema` – using the `addStrategy()` function (represented by the `register` property).  You can then easily find a specific strategy later using its name with the `get()` function.

Before registering a strategy, the `validateShallow()` function quickly checks that your strategy blueprint has all the essential parts in the right format.  If you need to update an existing strategy, the `override()` function lets you change just specific parts of it, leaving the rest untouched.  The service relies on a type-safe storage system and utilizes a logger to keep track of what's happening.

## Class StrategyCoreService

StrategyCoreService acts as a central hub for managing strategy operations, essentially providing a layer of coordination between different services. It injects important information like the trading symbol, timestamp, and whether it's a backtest into the strategy's execution environment.

Think of it as a helper that streamlines how strategies are run and monitored. It handles things like validating strategies, retrieving pending signals, checking if a strategy is stopped, and executing backtests.

Several key functions are available:

*   **Validation:** It checks that strategies and their risk configurations are properly set up, and it avoids unnecessary re-checks.
*   **Signal Retrieval:** It can find out what signals are currently pending or scheduled for a specific symbol.
*   **Status Checks:** It lets you quickly see if a strategy has been stopped.
*   **Execution:** The `tick` and `backtest` functions run a strategy and simulate its performance using provided data.
*   **Control:** You can also use it to stop a strategy from generating new signals or to cancel a scheduled signal, and clear its cached data for a fresh start.

This service is primarily used internally by other parts of the backtesting framework, but provides methods to control and monitor strategies.

## Class StrategyConnectionService

This service acts as a central hub for managing and executing strategy operations. Think of it as a router that directs requests to the correct strategy implementation based on which symbol and strategy name are involved. It’s designed to be efficient, storing frequently used strategy instances to avoid repeated setup.

Before any trading actions occur, it ensures the strategy is properly initialized.  It supports both real-time (tick) and historical (backtest) analysis.

Here's a breakdown of its key functionalities:

*   **Strategy Routing:** It figures out which specific strategy to use for a given symbol and strategy name.
*   **Caching:** It keeps track of previously created strategies, reusing them when possible for faster performance.
*   **Initialization:**  It makes sure each strategy is ready to go before it's asked to do anything.
*   **Live Trading (`tick`):**  Handles real-time updates and signal generation.
*   **Backtesting (`backtest`):**  Analyzes historical data to evaluate strategy performance.
*   **Stopping (`stop`):**  Pauses a strategy's signal generation.
*   **Clearing (`clear`):**  Resets a strategy, forcing a fresh start.
*   **Cancellation (`cancel`):**  Cancels a specifically scheduled signal without stopping the entire strategy. It's important to note that confirmation of cancellation might occur on the next live tick.



The service relies on other components like a logger, execution context, and connection services to perform its tasks effectively.

## Class SizingValidationService

This service helps keep track of your position sizing strategies, making sure they're set up correctly before you start trading. Think of it as a central registry where you register your sizing methods, like fixed percentage or Kelly Criterion.

Before you try to use a sizing strategy, this service lets you quickly check if it's registered and valid. It’s designed to be efficient, remembering past validation checks to speed things up.

You can add new sizing strategies using `addSizing`, double-check they exist with `validate`, and see a complete list of all registered strategies with `list`.  It maintains a record of your sizing configurations and validates them before use, improving the reliability of your backtesting process.

## Class SizingSchemaService

The SizingSchemaService helps you keep track of different sizing strategies for your trading backtests. It's like a central place to store and manage these sizing rules, ensuring they're organized and easy to find.

Behind the scenes, it uses a special tool to make sure the sizing strategies you add are structured correctly, checking for essential information. 

You can add new sizing strategies using `register`, update existing ones with `override`, or simply fetch a strategy by name with `get`. This service makes it simpler to work with and reuse different sizing approaches in your backtesting framework.

## Class SizingGlobalService

This service handles the calculations needed to determine how much of an asset to trade, based on your risk settings. It acts as a central point, coordinating with other services to validate and perform the actual size calculations. Think of it as the engine that figures out your position size, used both behind the scenes and potentially by your own trading strategies. 

It relies on a connection service to access the necessary data and a validation service to ensure everything is set up correctly.  The `calculate` function is the main method you'd be concerned with—it takes parameters defining your risk and returns the calculated position size.

## Class SizingConnectionService

The SizingConnectionService acts as a central hub for handling position sizing calculations within the backtest-kit framework. It intelligently directs requests to the right sizing method based on a name you provide, ensuring the correct sizing logic is applied. 

To improve performance, it remembers previously used sizing methods, so it doesn't have to recreate them every time. 

Think of it as a traffic controller, making sure sizing requests go to the right place and doing so efficiently. If a strategy doesn't have custom sizing configured, the sizing name will be an empty string. It allows for calculation of position sizes considering risk management principles, and supports different sizing approaches like fixed percentages or Kelly criterion.

## Class ScheduleUtils

This class helps you keep track of and understand how your scheduled trading signals are performing. It's designed to be easy to use, acting as a central point for getting information about signals that are waiting to be executed.

You can ask it for statistics on signals related to a specific trading symbol and strategy, to see things like how many signals are queued, how often they're canceled, and how long they’re waiting.

It can also automatically generate readable markdown reports summarizing these statistics, perfect for reviewing your system’s behavior.  You can even save these reports directly to a file. Think of it as a helpful assistant for monitoring your scheduled trading.

## Class ScheduleMarkdownService

This service automatically creates reports detailing the scheduling and cancellation of trading signals. It keeps track of these events for each strategy you're using, organizing them by the asset being traded. The reports are presented in a readable markdown format, including key statistics like cancellation rates and average wait times.

The service listens for signal events—when a signal is scheduled or cancelled—and collects this information.  You can request these reports, or have them saved directly to disk as `.md` files within the `logs/schedule` directory, making it easy to review your trading strategy’s signal management. 

It’s designed to be straightforward to use; it automatically sets itself up and keeps its data separate for each asset and strategy combination. You can clear the accumulated data if needed, either for a specific asset/strategy or globally.

## Class RiskValidationService

This service helps you keep track of your risk management configurations and makes sure they're set up correctly. Think of it as a central place to register and verify different risk profiles your system uses. It provides a simple way to add new risk profiles, check if a specific one exists before using it in your trading logic, and see a full list of all the profiles you've registered. To speed things up, it remembers the results of validation checks, so you don't have to repeat them unnecessarily.

Here’s what you can do with it:

*   **Register risk profiles:** Use `addRisk` to add new configurations.
*   **Verify configurations:** Use `validate` to confirm a profile exists before you try to use it.
*   **See all profiles:** Use `list` to get a complete overview of your registered risk configurations.


## Class RiskUtils

The RiskUtils class is like a central hub for understanding and analyzing risk rejection events within your trading system. It gathers data about rejections, summarizes them, and can even produce easy-to-read reports. Think of it as a tool to help you pinpoint why trades might be getting blocked and identify patterns.

You can use it to get a quick overview of rejection statistics – like how many rejections happened for a specific asset or strategy.  It can also generate detailed markdown reports that show each individual rejection event, including the reason, price, and position details.  Finally, it allows you to save these reports to files for later review or sharing. This helps keep track of potential issues and improve your strategies. The information is collected and managed by other parts of the system, and this class provides a convenient way to access and present it.

## Class RiskSchemaService

This service helps keep track of different risk profiles, ensuring they are all structured correctly. It uses a special system to store these profiles in a safe and organized way.

You can add new risk profiles using the `addRisk()` function (referred to as `register` in the code), and retrieve them later by their name using `get()`. If you need to update a risk profile, the `override()` function lets you make changes to existing ones.

Before a new risk profile is added, `validateShallow()` checks if it has all the necessary information and is properly formatted. This helps prevent errors and ensures consistency across all your risk profiles. The system internally uses a `loggerService` for tracking and troubleshooting, and `_registry` for storing profiles.

## Class RiskMarkdownService

This service helps you create reports detailing risk rejections in your trading system. It listens for events related to rejected trades and organizes them by the asset (symbol) and trading strategy being used. 

Think of it as a record keeper for when trades are blocked due to risk rules. It gathers all those rejection events and compiles them into easy-to-read markdown tables, complete with helpful statistics like the total number of rejections, broken down by asset and strategy.

You can then save these reports as `.md` files, making it simple to review and analyze your risk management performance. The system automatically manages the storage of these events, ensuring that each asset and strategy has its own separate record. It also offers options to clear out old data and provides a convenient way to generate and save reports, with customizable columns. The initial setup happens automatically when you start using the service.

## Class RiskGlobalService

This service acts as a central point for managing and validating risk limits within the backtesting framework. It works closely with the RiskConnectionService, handling the checks needed before a trading signal can be executed. 

Think of it as a gatekeeper that ensures trades stay within pre-defined risk boundaries. 

The service keeps track of open and closed trading signals, communicating these events to the wider risk management system. It also provides a way to clear out all risk data or selectively clear data for a specific risk configuration. The validation process is optimized to prevent unnecessary checks, and logging is included to monitor validation activity.

## Class RiskConnectionService

The RiskConnectionService acts as a central hub for managing risk checks during trading. It intelligently directs risk-related operations to the correct risk management component based on a name you provide. 

To speed things up, it remembers previously used risk components, avoiding unnecessary re-creation. This memoization is key for performance, keeping separate caches for backtesting and live trading environments.

You can use it to ensure signals adhere to pre-defined risk limits, such as drawdown and exposure limits. The service handles signal registration and removal, keeping the risk system up-to-date as trades occur. It also provides a way to clear the cached risk components if needed. Strategies without risk configurations will use an empty string for the risk name.

## Class PositionSizeUtils

This class offers helpful tools for figuring out how much of an asset to trade, based on different strategies. It provides pre-built calculations for several popular position sizing methods, making it easier to determine the right size for your trades.

Each method, like fixed percentage, Kelly Criterion, or ATR-based sizing, comes with built-in checks to ensure the input data is appropriate for the chosen approach. Essentially, it helps prevent errors by verifying your data setup.

You’ll find functions to calculate position size using:

*   **Fixed Percentage:** Sizes your position based on a pre-determined percentage of your account balance.
*   **Kelly Criterion:** A more complex method that considers win rates and win/loss ratios to optimize position size.
*   **ATR-Based:** Uses the Average True Range (ATR) to gauge volatility and size positions accordingly.

These functions all require some information about the asset you’re trading, your account balance, the price, and other parameters specific to the sizing method.

## Class PersistSignalUtils

PersistSignalUtils helps manage how trading signals are saved and restored, particularly for strategies running in live mode. It ensures that signal data is stored reliably, even if there are unexpected interruptions.

Each strategy gets its own dedicated storage space, and you can even customize how the data is persisted using adapters.

The system automatically handles reading and writing signal data in a safe way, ensuring data isn't lost or corrupted. When a strategy starts, it uses PersistSignalUtils to load any previously saved signal data. Similarly, when a strategy updates a signal, PersistSignalUtils handles saving that new data. It’s designed to be crash-safe, which means it protects your signal state in case of system errors.

You can register your own custom storage methods if the default isn't suitable for your needs.

## Class PersistScheduleUtils

This utility class helps manage how scheduled signals are saved and restored for your trading strategies. It ensures that your strategies remember their scheduled actions even if there are interruptions or crashes. 

Each strategy gets its own dedicated storage, and you can even customize how the data is stored using different adapters. 

The `readScheduleData` method retrieves previously saved scheduled signal information, and `writeScheduleData` saves new or updated information safely. The `usePersistScheduleAdapter` function allows you to plug in your own custom storage mechanism if the default isn't suitable for your needs. ClientStrategy uses these functions to persist data.

## Class PersistRiskUtils

This class helps manage how your trading positions are saved and loaded, especially when dealing with risk profiles. It's designed to keep things stable and prevent data loss, even if your application crashes.

Think of it as a reliable storage system that remembers your active positions for each risk profile. It uses a clever technique called memoization to efficiently manage these storage instances.

You can even customize how the data is stored using custom adapters. The `readPositionData` method retrieves the saved position data, while `writePositionData` securely saves changes to disk, making sure everything stays consistent. 

The `usePersistRiskAdapter` method lets you plug in your own way of persisting data, providing flexibility in how data is handled. It’s an important component for keeping track of your active positions and ensuring data integrity.

## Class PersistPartialUtils

This utility class, PersistPartialUtils, helps manage and save partial profit/loss information, crucial for strategies that track progress over time. It cleverly remembers where to store this data for each symbol and strategy combination, preventing unnecessary re-reading.

You can even customize how this data is stored using your own adapters, providing flexibility. The system makes sure reads and writes are handled carefully, ensuring that even if something goes wrong, your partial data remains safe.

The `readPartialData` method is used to load previously saved data, while `writePartialData` saves the current state, all with a focus on avoiding data corruption. Finally, `usePersistPartialAdapter` lets you swap in a different method for storing this information if the default isn't quite what you need.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing. It keeps track of performance data as your strategies run, organizing it by symbol, strategy, and whether it’s a backtest or live trading. 

You can ask it to calculate key statistics like average performance, the best and worst results, and percentiles to get a good overview. It also automatically generates detailed reports in markdown format, including analyses of what might be slowing things down.

The service stores these reports in a designated folder so you can review them later. It's designed to be initialized only once, and you can clear the accumulated data when it's no longer needed. Essentially, it's your central hub for monitoring and analyzing trading strategy performance.

## Class Performance

The Performance class is your tool for understanding how well your trading strategies are doing. It lets you gather overall performance numbers for specific symbols and strategies, whether you're analyzing a backtest or live trading. 

You can request detailed performance data, broken down by the different steps your strategy takes, including how long each step typically takes. This data highlights averages, minimums, maximums, and even outliers to help you pinpoint inefficiencies. 

Generating reports is simple – the Performance class can create readable markdown documents that visualize your strategy’s performance, showing time distribution and providing detailed statistics. You can even save these reports directly to your hard drive, so you can easily track progress over time and share your findings.

## Class PartialUtils

This class helps you analyze and understand the small, partial profit and loss events that occur during trading. It acts like a central hub to collect and present data generated by the system’s tracking of these events.

You can use it to get a summary of how often profits and losses happened, or to generate a detailed report. This report shows each individual partial profit/loss event as a table with important information like the symbol traded, the strategy used, the price, and when it occurred. 

Finally, it’s easy to save those reports to a file on your computer so you can review them later, and the class will automatically organize the files with meaningful names. Think of it as a way to dig deeper into the smaller movements that make up your overall trading performance.

## Class PartialMarkdownService

This service helps you create and save detailed reports about partial profits and losses during your backtesting or live trading. It listens for profit and loss events and keeps track of them, organized by the traded symbol and the strategy used.

You can then ask it to generate a nicely formatted markdown table summarizing these events, complete with statistics like total profit and loss events. These reports are saved as files on your disk, making it easy to review your performance.

The service automatically manages its data storage, ensuring each combination of symbol, strategy, and backtest has its own isolated space. It also initializes itself automatically when needed. You can clear the stored data if you want to start fresh or only clear data for specific symbol/strategy combinations.

## Class PartialGlobalService

This service acts as a central hub for managing partial profit and loss tracking within the backtesting framework. Think of it as a gatekeeper, logging all partial operations before passing them on to the connection service. It’s designed to be injected into your trading strategies, providing a single point for dependency injection and ensuring consistent logging across all partial operations.

Several key components are automatically wired in, including services for logging, handling connections, validating strategies, and retrieving configuration.  

The `profit`, `loss`, and `clear` methods are the primary ways you'll interact with this service. They handle updating and signaling profit/loss levels, and crucially, they always log these events globally before passing them along for actual processing.  The `validate` method provides a way to ensure your strategy and associated risk are correctly configured, and it's designed to be efficient by remembering previous validations.

## Class PartialConnectionService

This service helps track partial profits and losses for trading signals, especially useful when you're not executing every trade immediately. Think of it as a way to keep tabs on potential gains or losses even if you're just observing a signal.

It cleverly remembers previously created tracking objects (called `ClientPartial`) for each signal, so it doesn't recreate them unnecessarily. When a signal starts or closes, this service handles the necessary calculations and updates, and it ensures those tracking objects are cleaned up when no longer needed, preventing memory issues.

It works closely with the larger trading strategy, acting as a middleman to manage and delegate profit/loss calculations to specialized objects. You'll find it's essential for managing the details of partial trades, letting you focus on the bigger picture of your trading system.

Here's a breakdown of how it functions:

*   **Creates a record for each signal:** Each unique signal gets its own tracking object.
*   **Remembers these records:** The service keeps a handy list of these tracking objects for quick access.
*   **Handles profit and loss events:** It triggers actions when profit or loss thresholds are met.
*   **Cleans up when done:**  It automatically removes the tracking records when a signal is finished.


## Class OutlineMarkdownService

This service helps to create markdown documentation from the results of AI-powered strategies. It's particularly useful for debugging and keeping track of how an AI strategy arrived at its decisions, by saving the conversations and data.

The service automatically organizes files into a structured directory, placing system prompts, user inputs, and the final AI output into separate markdown files. Each conversation turns (system messages, user prompts, AI responses) is captured, numbered, and saved in its own file.

You don’t have to worry about accidentally overwriting previous logs; it checks to see if a directory already exists before creating new files. The service relies on a logger service to handle the actual writing of the markdown files. Essentially, it's designed to make it easier to understand and analyze the process of an AI strategy.

## Class OptimizerValidationService

This service keeps track of your optimizers, making sure they exist and are properly registered within the backtest-kit framework. Think of it as a central directory for optimizers. 

It lets you add new optimizers to this directory, and it won't let you add the same optimizer twice.  

When you need to verify an optimizer's presence, this service efficiently checks the registry – it even remembers previous checks to speed things up. 

You can also get a complete list of all registered optimizers with their details. Essentially, it helps organize and confirm your optimizers are ready to be used.


## Class OptimizerUtils

This section provides tools to work with your trading strategies after they've been optimized. Think of it as a way to package up your best strategies and make them ready to use.

You can retrieve strategy data, which includes details like how each strategy performed during training.

It also allows you to generate the actual code for your strategies, including all the necessary parts to make them run. This code can be downloaded and saved as a file.

Finally, there's a function to automatically create the code file and save it in a specified directory, ensuring it’s named in a standardized way. 


## Class OptimizerTemplateService

This service provides pre-built code snippets to help you automate the process of backtesting and optimizing trading strategies, particularly when using large language models (LLMs). It's designed to simplify creating backtest configurations and leverages the Ollama LLM for tasks like generating trading signals and analyzing market data.

It handles several crucial aspects of backtesting, including:

*   **Multi-timeframe Analysis:** It can pull data from multiple timeframes (1-minute, 5-minute, 15-minute, 1-hour intervals) to provide a broader market view.
*   **Structured Signal Generation:** It formats trading signals into a standardized JSON structure, making them easier to process and implement.
*   **Debugging:** Debug information is automatically saved to a directory, allowing you to track the LLM's reasoning and identify any issues.
*   **Exchange Integration:** It connects to exchanges using the CCXT library, allowing you to test strategies against real-world market data.
*   **Strategy Comparison:** It supports comparing different strategies using a "walker" approach, letting you see which performs best.

You can customize certain aspects of this service through configuration, but it generally provides a solid foundation for building automated trading workflows. The generated code includes components for exchange setup, timeframe configuration, strategy implementation (often with LLM assistance), and launcher scripts to run the backtests. The generated signals specify position (long/short/wait), explanation, entry/take profit/stop loss prices, and an estimated duration.

## Class OptimizerSchemaService

This service helps you keep track of and manage the blueprints for your optimization processes. Think of it as a central place to store and organize the rules and settings that guide how your backtesting experiments run.

It ensures that each blueprint (optimizer schema) is properly structured and contains all the necessary information before it's put into use. You can register new blueprints, update existing ones by making small changes, and easily retrieve a blueprint when you need it.

Behind the scenes, it uses a secure storage system to protect the integrity of these blueprints. This service handles the validation and organization, so you can focus on the actual backtesting process.


## Class OptimizerGlobalService

This service acts as a central point for working with optimizers, ensuring everything is validated before proceeding. It handles logging operations and checks to make sure the optimizer you're trying to use actually exists.

Think of it as a gatekeeper – you request data, code, or a code dump, and this service verifies everything is in order before passing your request on. 

It relies on other services for connecting to optimizers and validating their existence, keeping things organized and secure.

Here’s a breakdown of what it does:

*   **`getData`**: Retrieves data for a specified symbol and optimizer, compiling it into a structured format.
*   **`getCode`**: Creates the full code required to run a strategy, again checking for optimizer validity.
*   **`dump`**: Generates the strategy code and saves it directly to a file, confirming the optimizer is present first.

## Class OptimizerConnectionService

This service helps you manage connections to your optimization tools, like Pine Script or TradingView. It keeps a record of previously created connections to avoid needing to set them up again, which speeds things up.

You can customize the default settings used by these tools by combining your own settings with the standard ones. It allows you to inject logging functionality for tracking and debugging. 

The core functionality relies on a client optimizer to actually execute the optimization process.

Here's a breakdown of what you can do:

*   **`getOptimizer`**: This is your go-to method for getting a connection to your optimization tool. It automatically handles caching and combining settings.
*   **`getData`**:  This function gathers all the necessary information and creates a description of the trading strategies.
*   **`getCode`**:  This generates the full code for your strategies, ready to be executed.
*   **`dump`**: This saves the generated code into a file, making it easy to deploy.

## Class NotificationUtils

This class, NotificationUtils, makes it easy to manage and view notifications within the system. Think of it as a helpful assistant for accessing and clearing your notification history. 

It automatically handles some behind-the-scenes setup, so you don't have to worry about the technical details.  You can use it to retrieve a list of all your notifications, ordered from newest to oldest, or to completely clear out all existing notifications. Essentially, it provides a clean and simple interface for dealing with notifications. 

Inside, it uses an internal instance to handle the actual notification logic, but you don't typically need to interact with that directly.

## Class LoggerService

The `LoggerService` helps keep your backtesting logs organized and informative. It provides a way to log messages at different levels – debug, info, warn – and automatically adds helpful details about where the log originated, like which strategy, exchange, and frame are involved, as well as information about the symbol and time. If you don't configure a specific logger, it uses a default "no-op" logger that essentially does nothing.

You can customize the logging behavior by providing your own logger implementation using the `setLogger` method. This service manages the context information and delegates the actual logging to the configured logger. It also contains services to manage method and execution context.

## Class LiveUtils

LiveUtils is a helper class designed to simplify running and managing live trading operations within the backtest-kit framework. It acts as a central point for interacting with the live trading system, providing convenient functions and ensuring stability.

Think of it as a single, always-available resource for managing your live trading sessions. The `run` function is the core—it starts an infinite, persistent trading loop for a specific symbol and strategy, automatically recovering from crashes and keeping track of progress.  You can also kick off a "background" process for trading that doesn't directly give you results, useful for things like constantly updating external data or persistence.

If you need to know what the strategy is currently doing, `getPendingSignal` and `getScheduledSignal` fetch information about any active signals. To pause a strategy's signal generation, use `stop`; to just cancel a scheduled signal without stopping the strategy, `cancel` is the way to go. 

`getData` gives you performance stats, while `getReport` and `dump` let you generate and save detailed reports about the trading activity. Finally, `list` shows you all the currently running live trading instances and their status.

## Class LiveMarkdownService

The LiveMarkdownService is designed to automatically create and save detailed reports about your trading activity. It keeps track of every event—like when a strategy is idle, opens a position, is actively trading, or closes a trade—for each strategy you're using. 

These events are then organized into clear, readable markdown tables that include specific information about each trade. You'll also get key trading statistics like win rate and average profit/loss.

The service automatically saves these reports to your logs directory, making it easy to review your strategy's performance. You can also clear out old data when you need to. Importantly, it initializes automatically when you first start using it, and ensures it only initializes once. It relies on a `loggerService` for debugging and a `getStorage` function to manage the data for each trading setup (symbol, strategy, and backtest).

## Class LiveLogicPublicService

LiveLogicPublicService helps orchestrate live trading, making it easier to manage the context needed by your strategies. Think of it as a convenient layer built on top of another service, automatically handling things like the strategy name and exchange being used.

It's designed to run continuously, producing a stream of trading signals – both when a position is opened and when it’s closed – and it does this in an endless loop. If something goes wrong and the process crashes, it’s built to recover, bringing back your trading state from where it left off.  The service keeps track of time using the system clock, ensuring real-time accuracy.

To get started, you simply tell it which symbol to trade and provide the context (strategy and exchange). The service then takes care of the rest, seamlessly passing this context to all the underlying functions.


## Class LiveLogicPrivateService

This service helps manage live trading by continuously monitoring and reacting to signals. It works by constantly checking for new trading opportunities, essentially running an endless loop. 

It creates real-time snapshots of the current date to ensure accuracy and streams the results—specifically, when trades are opened or closed—in a memory-efficient way.  Because it's designed to run indefinitely, it includes crash recovery mechanisms to make sure your trading process can bounce back from interruptions and maintain its state. 

You can initiate live trading for a specific symbol using the `run` method, and it will provide a stream of updates as opportunities arise. Think of it as an automated, ever-vigilant trading assistant.




The service relies on other components like `loggerService`, `strategyCoreService`, and `methodContextService` to function properly.

## Class LiveCommandService

This service acts as a central hub for live trading operations within the backtest-kit framework. Think of it as a convenient way to access and manage the core live trading logic without needing to deal with the underlying complexities directly. It's designed to be easily integrated into your applications through dependency injection.

Inside, it coordinates several other services – handling things like validating your trading strategies and exchanges, checking for risks, and retrieving strategy information.

The key function, `run`, is responsible for actually kicking off the live trading process for a specific symbol, providing details like the strategy and exchange you're using. It operates continuously, automatically handling any unexpected issues that might arise during trading.


## Class HeatUtils

HeatUtils helps you visualize and understand your portfolio's performance across different strategies. It’s a handy tool for creating heatmaps that show how well each symbol is doing within a strategy, and overall portfolio metrics. You can easily request data for a specific strategy, and it automatically pulls together all the necessary information from your closed trades.

It can also generate a nicely formatted markdown report, complete with a table that breaks down each symbol's performance (like total profit, Sharpe Ratio, and maximum drawdown). You have control over which columns are displayed in the report.

Finally, it allows you to save these reports directly to your file system, making it simple to share or archive your findings.  HeatUtils is designed to be easy to use, providing a single point of access for all your heatmap needs.


## Class HeatMarkdownService

The Heatmap Service is designed to give you a clear picture of your trading performance, especially how different strategies are doing. It watches for completed trades and compiles key statistics like total profit, risk-adjusted return (Sharpe Ratio), maximum drawdown, and the number of trades executed.

It organizes this data both for each individual asset and across your entire portfolio, broken down by strategy. You can then easily view this information in a nicely formatted Markdown table, which is great for reporting and analysis.

The service keeps its data separate for each strategy and whether you're running a backtest or live trading, ensuring that your data is organized logically. It also handles potential math errors gracefully, preventing issues from unexpected data.  The service automatically sets itself up when you first use it and you don't need to worry about manual setup. You can also save the reports to files if you want a permanent record.

## Class FrameValidationService

This service helps you keep track of your trading timeframes and makes sure they're properly set up before your backtests run. Think of it as a central place to register and verify your timeframes, like "1m", "5m", or "1h". It lets you add new timeframes with their specific details, and then quickly check if a timeframe exists before you try to use it in your backtesting logic.  The service remembers the results of these checks, so validations are fast. You can also get a complete list of all the timeframes you've registered to see what's available. It uses a `loggerService` for any logging needs and internally uses a `_frameMap` to manage registered timeframes.

## Class FrameSchemaService

This service acts as a central place to manage and store the blueprints, or schemas, for your trading strategies. It uses a special system to keep track of these schemas in a way that prevents errors. 

You can think of it as a library where you register different types of trading strategies, each with its own specific requirements. 

The service lets you add new schema definitions, update existing ones, and easily retrieve them by name when needed. Before a new strategy blueprint is accepted, it’s checked to make sure it has all the necessary components and is structured correctly. This helps ensure consistency and reliability across your backtesting framework.

## Class FrameCoreService

The FrameCoreService acts as a central hub for handling timeframes within the backtesting framework. It works closely with other services to ensure accurate and reliable timeframe generation. Think of it as the engine that provides the timeline for your backtest, taking into account the specific trading symbol and timeframe you've chosen. 

It manages connections to data sources and validates the timeframes retrieved. The `getTimeframe` method is its primary function, producing an array of dates representing the time periods the backtest will analyze. This service is essential for coordinating the overall backtesting process.


## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing different trading frames within the backtest environment. It intelligently directs requests to the correct frame implementation based on the currently active context. To make things efficient, it remembers which frames it's already created, so it doesn't have to rebuild them every time you need them.

Think of it as a smart router that knows which frame handles each task, optimizing performance. It also handles the backtest timeframe – specifically, setting the start and end dates for your analysis. This service is crucial for ensuring your backtests run within the defined historical data range.

Here's a breakdown of its main responsibilities:

*   It automatically routes operations to the appropriate frame.
*   It keeps a record of frames to avoid unnecessary creation.
*   It provides access to the timeframe configuration used in backtests, helping to limit the backtest dates. 
*   If you're in live mode (not backtesting), the frame name will be empty, indicating no frame constraints.

## Class ExchangeValidationService

This service acts as a central hub for keeping track of your trading exchanges and making sure they're properly set up. Think of it as a quality control system for your exchanges.

It allows you to register new exchanges, providing details about their configuration.  Before you try to actually trade through an exchange, you can use this service to confirm that it's been registered and is ready to go. To improve performance, the service remembers whether an exchange has been validated, so it doesn't have to check repeatedly. Finally, you can easily get a complete list of all the exchanges you've registered.

## Class ExchangeUtils

This class, `ExchangeUtils`, acts as a helpful toolkit for working with different cryptocurrency exchanges. It's designed to make common tasks easier and safer by validating data along the way and ensuring consistency. 

You'll find functions here to retrieve historical price data (candles) for a specific trading pair and timeframe, calculate the average price using volume-weighted calculations, and properly format trade quantities and prices to meet each exchange's specific rules.  The `getCandles` function cleverly figures out the correct date range for your data requests automatically. This toolkit is always available as a single, readily accessible instance, making it convenient to use throughout your trading strategies. Each exchange has its own private instance for isolated operations.

## Class ExchangeSchemaService

This service helps you keep track of information about different cryptocurrency exchanges, ensuring everything is structured correctly and consistently. It acts like a central repository for exchange details, storing them in a way that's safe and easy to manage with TypeScript.

You can add new exchange information using the `addExchange` function and then easily find it again by its name later. The service makes sure that the data you add conforms to a specific format, checking for essential properties before it’s stored. 

If you need to update an existing exchange's details, you can use the `override` function to make partial changes, rather than replacing the entire record. Ultimately, this service promotes organization and reliability when working with exchange data.

## Class ExchangeCoreService

ExchangeCoreService acts as a central hub for interacting with exchanges, ensuring that each operation understands the specific trading environment it's operating within. It combines connection details with information like the trading symbol, the point in time, and whether it's a backtest or live trading scenario. This service is a foundational component used internally by other parts of the backtesting system.

It keeps track of logging, connection management, and validation processes. The validation functionality checks exchange configurations and avoids repeatedly checking the same settings.

Key functions let you retrieve historical candle data, simulate fetching future data for backtesting purposes, calculate average prices, and correctly format prices and quantities based on the specific trading context. Each of these operations includes the relevant contextual information, ensuring consistency and accuracy.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently directs your requests to the correct exchange based on your current context, making it easier to work with multiple exchanges without writing separate code for each.

It keeps track of the exchange connections it creates, reusing them when possible to improve performance. This avoids unnecessary overhead and makes the process more efficient.

You can use it to fetch historical price data (candles), get the latest average price, and format prices and quantities to meet the specific requirements of each exchange. The service handles the complexities of communicating with each exchange, ensuring your requests are properly formatted and handled. It also keeps a log of all its actions, which can be helpful for troubleshooting or auditing.

## Class ConstantUtils

This class provides a set of useful constants for defining take-profit and stop-loss levels within your trading strategies. These constants are calculated based on the Kelly Criterion and incorporate a risk decay model, aiming to optimize profit-taking and loss mitigation. 

Think of them as pre-defined percentages that help you break down your ultimate target profit or stop-loss into smaller, manageable steps. For instance, TP_LEVEL1 represents 30% of the way towards your total take-profit goal, TP_LEVEL2 is 60%, and TP_LEVEL3 is 90%. Similarly, SL_LEVEL1 signals an early warning for a potential loss at 40% of the distance to your stop-loss, and SL_LEVEL2 suggests a final exit at 80%.  You can use these levels to gradually lock in profits or reduce exposure as the trade progresses.


## Class ConfigValidationService

This service helps make sure your trading setup is mathematically sound and capable of making a profit. It double-checks all your global configuration settings to catch potential errors that could lead to losses.

It specifically looks at percentages like slippage and fees, ensuring they’re not negative. It also verifies that your take profit distance is large enough to cover all trading costs. 

Beyond percentages, the service also validates that time-related settings and retry counts are positive integers, and that ranges have sensible minimum and maximum values. Think of it as a safety net for your configurations, preventing common mistakes that could impact your trading performance.

## Class ColumnValidationService

The ColumnValidationService acts as a quality control check for your column configurations. It ensures that the way you've defined your columns—things like their names, labels, how they're displayed, and whether they're visible—all make sense and follow the rules. 

Specifically, it makes sure you've provided all the necessary information for each column (like a unique key, a descriptive label, and how it should be formatted) and that everything is the correct type. It also confirms that each column has a unique identifier. This service helps prevent errors and inconsistencies down the line by catching potential problems early on. 

The `validate` function is the main tool here; it’s the one that actually runs the checks on your column configurations. Think of it as a safety net for your data.

## Class ClientSizing

ClientSizing is a tool that helps figure out how much of an asset to buy or sell in a trading strategy. It allows you to use different methods for determining position size, such as a fixed percentage, the Kelly Criterion, or using Average True Range (ATR). 

You can also set limits on how much you can trade at once, whether that’s a minimum or maximum position size or a percentage of your capital.

It also provides flexibility with callbacks so you can add your own checks and record what's happening during the sizing process. Essentially, it’s the component that figures out the ideal trade size for your strategy before it actually executes.

The `calculate` method is the core of ClientSizing, it’s what performs the position size calculation using the provided parameters.


## Class ClientRisk

ClientRisk helps manage risk across your trading strategies, ensuring you don’t exceed predefined limits. It acts as a central control point for portfolio-level risk, preventing trades that could violate those limits. Think of it as a safety net that keeps an eye on the total number of positions you're holding and allows for custom risk checks that can consider all your active positions.

It shares information between multiple strategies, giving you a holistic view of your portfolio’s risk.  This component actively tracks your open positions and is integrated into the trading process to validate signals before they become trades. 

It keeps a record of current positions, automatically saving them and loading them when needed, though this feature is bypassed during backtesting. The `checkSignal` method is core to its function – it evaluates signals against your risk rules, giving you control over what trades are permitted.  Signals are registered when opened and removed when closed, keeping the position tracking up-to-date.

## Class ClientOptimizer

This component, `ClientOptimizer`, helps manage the process of optimizing trading strategies. It acts as a bridge, connecting to different data sources and using them to create and export strategy code. 

Think of it as a worker bee, gathering information, building conversations (for using with LLMs), and ultimately crafting a complete, runnable trading strategy. It pulls data from various places, organizes it, and then uses templates to generate the code for your strategy.

You can also ask it to save the generated strategy code to a file, creating the necessary folders if they don't already exist. This class is designed to be used by another system, `OptimizerConnectionService`, to handle the optimization workflow. It reports its progress through a callback function you provide.

## Class ClientFrame

The ClientFrame helps your backtesting process by creating the timeline of dates and times your strategies will operate on. Think of it as the engine that feeds data to your trading algorithms during a backtest. It avoids unnecessary work by remembering previously generated timelines, making your backtests run faster. 

You can easily customize how often these timeline points are generated, from one-minute intervals all the way to three-day spans.  It also allows you to add custom checks and logging during the timeline creation, providing more insight into how your backtest is running. The `getTimeframe` method is the main way to get these timelines, and it uses a caching system so you don't have to recreate them repeatedly.


## Class ClientExchange

This class, `ClientExchange`, acts as a bridge to get data from an exchange, specifically designed to be efficient for backtesting. It provides ways to retrieve past and future price data (candles), calculate the Volume Weighted Average Price (VWAP) from recent trades, and format quantities and prices to match the exchange's standards.  When fetching historical data, it looks backwards from a specified execution time, and for future data—crucial for backtesting—it looks forward. The VWAP calculation uses the last few 1-minute candles and adjusts based on volume traded, and if volume data is missing, it defaults to a simple average of closing prices.  Finally, it handles formatting numbers to precisely match the exchange’s requirements for order placement. It’s built to use memory efficiently through prototype functions.

## Class CacheUtils

CacheUtils offers a simple way to speed up your code by automatically caching function results. Think of it like giving your functions a memory – they remember previous calculations and don’t have to repeat them unnecessarily.

It works by wrapping your functions, making sure they only recalculate when needed based on a timeframe interval you define. This is really useful in backtesting scenarios where you might be re-running calculations many times.

You can get a single, shared instance of CacheUtils to manage all your cached functions.

If you need to force a recalculation, you can clear the cache for a specific function within a particular test setup, or flush the entire cache for a function to completely remove its stored results. Flushing is a more aggressive action, clearing everything related to that function, while clearing only targets the current test environment. This lets you control when your functions are recomputed and keep things running smoothly.

## Class BacktestUtils

BacktestUtils provides a set of helpful tools for running and managing backtests within the trading framework. Think of it as a centralized place to kick off backtest processes and get information about them. 

It offers a simple way to start a backtest using the `run` method, which handles the underlying complexity and automatically logs progress. If you want to run a backtest in the background without needing to see the results directly—perhaps just for logging or triggering other actions—the `background` method is what you need. 

You can also check on the status of running strategies. `getPendingSignal` and `getScheduledSignal` allow you to see what signals a strategy is currently working on.  Need to pause a strategy from generating new signals? `stop` will do that.  Want to just cancel a specific scheduled signal without affecting the strategy’s overall operation?  Use `cancel`.

Beyond running the backtests, this utility gives you ways to analyze the results.  `getData` fetches statistics from past trades, while `getReport` and `dump` let you create and save detailed reports about a symbol and strategy's performance. Finally, `list` allows you to see a quick overview of all currently running backtest instances and their current states. This whole class is designed to make working with backtests easier and more consistent.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create easy-to-read reports about your backtesting results. It listens for trading signals as your backtest runs, keeping track of how each strategy performs on different symbols. 

It automatically builds markdown tables summarizing signal details, allowing you to easily analyze your strategies. These reports are saved to your logs directory, making it simple to review and share your findings.

The service manages data efficiently, using a clever system to store information for each symbol, strategy, and backtest combination separately. You can customize the reports by specifying which columns to include.

You can also clear out the accumulated data when you're finished testing or want to start fresh, either for all strategies or just specific ones. The initialization happens automatically when you first use the service, so you can get started right away.

## Class BacktestLogicPublicService

The `BacktestLogicPublicService` helps you run backtests in a streamlined way. It essentially handles the behind-the-scenes coordination of your backtesting process. 

It automatically manages important context information—like the strategy name, exchange, and frame—so you don't have to pass it around to every function. This makes your backtesting code cleaner and easier to read.

The core function is `run`, which lets you execute a backtest for a specific asset.  It delivers the results as a continuous stream of data, allowing you to process them incrementally. Think of it as a convenient wrapper around more complex backtesting logic.


## Class BacktestLogicPrivateService

The `BacktestLogicPrivateService` helps orchestrate backtesting processes efficiently. It works by first figuring out the timeframes needed for the backtest, then stepping through each one, checking for trading signals. When a signal triggers a trade, it gathers the necessary historical price data and runs the backtest logic. 

Crucially, it doesn't store everything in memory at once; instead, it streams the results as they become available. This is especially helpful for longer backtests. You can even stop the backtest early if you need to. 

The service relies on other components like a logger, strategy core, exchange core, frame core, and method context service to do its job. The `run` method is the main way to start a backtest; it takes a symbol as input and produces a stream of backtest results.

## Class BacktestCommandService

BacktestCommandService acts as a central point for running backtests within the system. Think of it as a convenient helper that ties together various components needed for a backtest, allowing other parts of the application to easily initiate and manage them. It handles tasks like validating strategies, exchanges, and data frames to ensure everything is set up correctly before the actual backtest begins. 

The `run` method is the main way to start a backtest; you provide a symbol (like a stock ticker) and information about the strategy, exchange, and data frame you want to use.  It returns a sequence of results, giving you the backtest data step-by-step. This service simplifies backtesting by managing dependencies and validation, letting you focus on the analysis of the results.

