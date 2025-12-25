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

The Walker Validation Service helps you keep track of and make sure your parameter sweep configurations, often called "walkers," are set up correctly. It acts like a central hub, storing information about each walker and confirming they exist before you try to use them. To speed things up, it remembers the results of validations so it doesn't have to check repeatedly.

You can register new walkers using `addWalker`, ensuring your configurations are known to the service. Before running any processes that rely on a walker, use `validate` to double-check its existence. If you need to see all the walkers you’ve registered, `list` provides a handy way to get a list of their configurations. This service simplifies managing and validating walkers, leading to more reliable and efficient optimization processes.

## Class WalkerUtils

WalkerUtils is a handy helper class that simplifies working with walkers, which are essentially automated trading strategies. Think of it as a central place to start, manage, and get information about your walkers. It's designed to be easy to use, as it automatically handles a lot of the setup details.

You can use it to run walkers, which compare different strategies, either in the foreground to see the results or in the background if you just want to do things like log data or trigger callbacks.  The `background` function is great when you don't need to see the walker's progress directly.

If you need to pause a walker's activity, the `stop` function sends a signal to all strategies within that walker, effectively preventing them from generating new trading signals. It’s carefully designed to only affect the walker you specify.

Beyond running them, WalkerUtils lets you retrieve the complete results of a walker's analysis (`getData`), create detailed reports in Markdown format (`getReport`), and save those reports to a file (`dump`).  Finally, you can get a list of all currently running walkers and their status (`list`) to keep track of what's happening. The class is managed as a single instance, making it readily available wherever you need it.

## Class WalkerSchemaService

The WalkerSchemaService helps keep track of different trading strategies, or "walkers," ensuring they're all set up correctly. It uses a special system to store these strategies in a way that prevents errors related to incorrect data types.

You can add new strategies using `addWalker()` and find them again later using their names.  Before adding a new strategy, the service checks that it has all the necessary parts and that those parts are the right types – this helps catch mistakes early on.  If a strategy already exists, you can update parts of it using `override()`. Finally, you can easily retrieve any strategy by its name using `get()`.

## Class WalkerMarkdownService

This service helps you automatically create and save reports about your trading strategies as they're being tested, using a walker framework. It listens for updates from the walkers and carefully tracks the performance of each strategy.

Essentially, it gathers the results, organizes them, and presents them in nicely formatted markdown tables so you can easily compare how different strategies are performing. These reports are saved as files, making it simple to review and analyze your backtesting progress.

The service handles the storage of results separately for each walker, ensuring that data doesn't get mixed up. There's also a built-in mechanism to automatically clear old data when needed, and initialization happens automatically the first time you use it. You can customize the reports with specific columns to focus on the metrics that are most important to you.

## Class WalkerLogicPublicService

WalkerLogicPublicService acts as a helpful coordinator for managing and running your trading walkers. It builds upon a private service and automatically passes along important information like the strategy name, exchange, frame, and walker name, so you don't have to manually include it in every call.

Think of it as a layer that simplifies how you interact with your walkers, ensuring they always have the context they need.

It has a few key components behind the scenes, including services for handling logging, the private walker logic, and walker schema.

The `run` method is the main way to start a walker comparison; you give it a symbol to analyze and a context object, and it will execute backtests for all your strategies, automatically spreading context information.


## Class WalkerLogicPrivateService

The WalkerLogicPrivateService is designed to manage and compare different trading strategies, acting as a central orchestrator. It works by running each strategy one after another and providing updates on their progress as they finish. You'll get real-time insights into the best-performing strategy throughout the process, and ultimately, it delivers a ranked list of all the strategies compared. 

Internally, it leverages other services like BacktestLogicPublicService to actually perform the backtesting.

To use it, you give it a symbol to analyze, a list of strategies to compare, a metric to optimize for, and some contextual information about the environment (exchange, timeframe, and the name of the walker itself). The `run` method then kicks off the process and provides a stream of results, each representing a completed strategy.

## Class WalkerCommandService

WalkerCommandService acts as a central hub for interacting with the walker functionality within the backtest-kit framework. It’s designed to make it easier to manage dependencies and provides a straightforward way to access various services involved in running and validating your trading strategies.

Think of it as a convenient wrapper around the core walker logic, making it simpler to use in different parts of your application.

Here’s a breakdown of what you can do with it:

*   **Centralized Access:** It bundles together services for managing walkers, schemas, validations, and more, preventing you from needing to hunt down each one individually.
*   **Dependency Injection:**  It’s built to work well with dependency injection, which helps keep your code organized and testable.
*   **`run` Method:**  The most important function is `run`. This lets you execute a comparison of walkers for a specific trading symbol, providing context like the walker's name, exchange, and frame. The results come back as a stream of data.

## Class StrategyValidationService

The StrategyValidationService helps you keep track of your trading strategies and make sure they’re set up correctly. It essentially acts as a central place to register your strategies and check if they're valid before you start trading. 

You can add new strategies using `addStrategy`, providing a name and its configuration details.  Whenever you’re ready to use a strategy, `validate` will confirm that it exists and, if you've defined one, that the associated risk profile is also valid. To see all the strategies you've registered, use `list`. 

To speed things up, the service remembers its validation results, so it doesn't have to repeat checks unnecessarily. It's designed to work with other services like a risk validation service, and uses a logging service to keep you informed.

## Class StrategySchemaService

This service acts as a central place to store and manage the blueprints, or schemas, that define your trading strategies. It uses a special system to ensure your strategy definitions are consistent and type-safe.

You can add new strategy schemas using the `addStrategy` function, and retrieve them later using their names.  Before adding a strategy, it quickly checks to make sure it has all the necessary parts – this is done with `validateShallow`. 

If a strategy already exists, you can update parts of it with `override`. And of course, you can always `get` a strategy’s details using its name.

## Class StrategyCoreService

StrategyCoreService acts as a central hub for managing and interacting with trading strategies within the backtest-kit framework. It's designed to streamline strategy operations by automatically providing essential information like the trading symbol, time, and backtest settings to the strategies themselves.

This service relies on other components to handle tasks like connecting to strategies, validating configurations, and managing logs. It keeps track of things like pending signals and whether a strategy has been stopped, enabling monitoring of trade parameters and preventing further signal generation.

When you need to run a backtest or execute a strategy, StrategyCoreService handles the execution context, ensuring everything runs smoothly. It also offers methods to clear cached strategy data, forcing a fresh start for strategy re-initialization. Validation is also handled here and smartly avoids unnecessary repeated checks.

## Class StrategyConnectionService

The StrategyConnectionService acts like a central traffic controller, directing requests to the correct trading strategy based on the symbol and its name. It's designed to be efficient, remembering which strategies are already loaded so it doesn't have to recreate them every time.

Before it can do anything, it makes sure the strategy is properly set up. It handles both live trading (the `tick` method) and historical backtesting (the `backtest` method), ensuring each runs correctly. You can also check if a strategy is currently paused (`getStopped`) or retrieve its pending signal (`getPendingSignal`).

If you need to completely reset a strategy, the `clear` method forces a fresh start. Finally, the `stop` method allows you to pause a strategy from generating further signals.

## Class SizingValidationService

This service helps you keep track of your position sizing strategies and makes sure they're set up correctly before you start trading. Think of it as a central place to register and verify your sizing methods, like fixed percentage or Kelly Criterion.

It provides a way to add new sizing strategies to a registry. You can then use it to check if a specific sizing strategy exists before using it in your backtesting process.

To improve performance, the service remembers the results of previous validations. You can also get a list of all the sizing strategies you've registered. Essentially, it's a tool for organizing and ensuring the reliability of your sizing configurations.

## Class SizingSchemaService

The SizingSchemaService helps you keep track of different sizing strategies for your trading backtests. Think of it as a central place to store and manage these sizing rules. It uses a special system to make sure your sizing schemas are structured correctly and avoids type-related issues.

You can add new sizing strategies using `register`, update existing ones with `override`, and easily retrieve them by name using `get`. This service keeps your sizing configurations organized and consistent throughout your backtesting process. It uses a registry to store these configurations, making it simple to access and manage them.

## Class SizingGlobalService

The SizingGlobalService is a central component that handles how much of an asset your trading strategy will buy or sell. It takes care of the complex calculations needed to determine the right size for each trade, ensuring it aligns with your risk management rules. 

Think of it as a helper that uses other services to figure out the position size. 

Inside, it relies on `SizingConnectionService` to do the heavy lifting, and `SizingValidationService` to make sure everything is correct.  The core function, `calculate`, is what you'd use if you needed to programmatically determine a trade size based on specific inputs and a given context. It returns a promise that resolves to the calculated size.


## Class SizingConnectionService

The SizingConnectionService acts as a central hub for handling position sizing calculations within the backtest framework. It intelligently directs sizing requests to the correct sizing implementation, allowing for flexibility in how position sizes are determined.

To optimize performance, it remembers previously used sizing implementations, so you don't have to recreate them every time.  This caching makes sizing calculations faster.

When calculating a position size, you specify a sizing name, which tells the service which sizing method to use – such as fixed percentage, Kelly Criterion, or ATR-based sizing.  The service handles the details of choosing the right method and applying the necessary risk management rules. If a strategy doesn't have specific sizing configured, an empty string is used as the sizing name.

## Class ScheduleUtils

ScheduleUtils helps you keep an eye on how your scheduled trading signals are performing. It's a handy tool for monitoring signals generated by your strategies.

Think of it as a central place to track signals waiting to be processed, signals that got canceled, and how long they typically wait. 

You can use it to quickly grab statistics about a specific symbol and strategy, or to generate a nicely formatted markdown report showing all the scheduled signal activity. 

It also lets you save those reports directly to a file on your computer for later review. It's designed to be easy to use and gives you a clear picture of your scheduling process.

## Class ScheduleMarkdownService

This service automatically creates reports detailing your trading signals – specifically, when signals are scheduled and when they are canceled. It keeps track of these events for each strategy you're using.

The service listens for signal events and compiles them into easy-to-read markdown tables, which are saved as files. These reports include useful statistics like the cancellation rate and average wait times for signals. 

You can retrieve the statistical data or the full report for a specific trading symbol and strategy, or clear all the accumulated data if needed. The service handles the technical details of saving these reports to disk, organizing them by strategy name in a designated log directory, and makes sure everything initializes properly the first time it's used.

## Class RiskValidationService

This service helps you keep track of your risk management settings and makes sure they're all set up correctly before your trading strategies run. Think of it as a central place to register all your risk profiles—like maximum position sizes or margin requirements—and double-check they exist before your backtests or live trading begins.

It allows you to add new risk profiles easily using `addRisk`, and quickly verify if a specific profile is registered with the `validate` function. To see all of your registered risk profiles, you can use the `list` function. For efficiency, the service remembers the results of its validations so it doesn't have to re-check things unnecessarily.

## Class RiskUtils

This class provides easy access to risk rejection data, letting you understand and analyze potential problems in your trading strategies. It acts as a central point for gathering statistics and generating reports about risk rejections.

You can use it to get overall statistics like the total number of rejections, broken down by which asset and strategy were affected.  It's designed to pull this data from the system's tracking of risk events, allowing you to spot trends and identify areas for improvement.

The class can also create detailed markdown reports that clearly show each risk rejection event, including details like the asset traded, the position taken (long or short), and the reason for the rejection. These reports make it simple to investigate specific incidents. Finally, you can easily export these reports to files for archiving or sharing.


## Class RiskSchemaService

This service helps you manage and keep track of different risk profiles for your trading strategies. It uses a special system to ensure the risk profiles are structured correctly and consistently. 

You can add new risk profiles using the `addRisk()` function, and retrieve them later by their name. If you need to update an existing profile, the `override()` function allows you to make changes in a controlled way. The service also performs a quick check (`validateShallow()`) to make sure new profiles have all the necessary components before they are added. Think of it as a central hub for defining and accessing your trading risk configurations.

## Class RiskMarkdownService

The RiskMarkdownService helps you automatically create reports detailing risk rejections in your trading system. It keeps track of rejected trades, organizing them by the traded symbol and the strategy used. 

The service generates clear, readable markdown reports that include detailed rejection information and overall statistics like the total number of rejections, broken down by symbol and strategy. These reports are saved as files, making it easy to review and analyze your risk management performance.

You don’t need to manually handle event listening or data accumulation; the service does this automatically by subscribing to risk rejection events. It uses a system of storage to ensure data for each symbol, strategy, and backtest is kept separate. It also provides functions to clear the stored data when it's no longer needed, and initializes itself automatically when first used.

## Class RiskGlobalService

This service acts as a central point for managing risk checks within the backtest-kit framework. It works alongside a connection service to ensure trading activities adhere to defined risk limits. 

It keeps track of opened and closed trading signals, communicating these events to the risk management system. 

The service also offers a way to clear out risk-related data, either for all scenarios or for a specific risk configuration. 

To avoid unnecessary checks, the validation process is cached, and each validation is logged for auditing purposes.

## Class RiskConnectionService

The RiskConnectionService acts as a central hub for managing risk checks during trading. It makes sure risk calculations are directed to the correct system based on a name you provide, which allows for different risk rules for different strategies. To make things faster, it remembers previously used risk systems, so you don't have to recreate them every time. 

You can use it to check if a trade signal is okay to execute, considering limits on things like portfolio drawdown and how much you're exposed to any one asset.  It also keeps track of open and closed trades to ensure ongoing compliance with risk parameters. 

If you need to reset the risk systems, you can clear the cached instances, either globally or for a specific risk name. Remember that strategies without specific risk configurations will use an empty string as their risk name.

## Class PositionSizeUtils

This class provides tools to help you determine how much of your assets to allocate to each trade. It offers several different sizing methods, like fixed percentage, Kelly Criterion, and ATR-based approaches, each designed to manage risk in a unique way. 

The calculations within these methods are checked to ensure they are compatible with the method being used.

Think of it as a set of pre-built formulas you can use to decide on your position size, making it easier to automate and standardize your trading strategy. Each method takes into account factors like your account balance, the price of the asset you're trading, and other relevant parameters to produce a suggested position size.


## Class PersistSignalUtils

This class helps manage and safely store signal data used by your trading strategies, especially when running in live mode. It essentially remembers the state of your signals so you don't lose progress even if something goes wrong.

The class keeps separate storage for each strategy, making it organized and efficient. It also provides a way to use your own custom storage methods if the default isn't quite what you need.

Think of it as a reliable notebook for your strategies, automatically saving information and preventing data loss with a robust system that handles unexpected interruptions. It’s particularly useful for strategies that need to remember their decisions between sessions. 

You can even tell it to use different storage “notebooks” by registering custom adapters. The `readSignalData` method retrieves the saved information, while `writeSignalData` securely saves new data.

## Class PersistScheduleUtils

This utility class, PersistScheduleUtils, handles how scheduled signals are saved and loaded, especially for trading strategies. It makes sure each strategy has its own dedicated storage space and allows you to plug in your own methods for saving data if the default isn't what you need. 

The class prioritizes safety; it uses atomic operations to write data, meaning the process either completes fully or doesn't happen at all, protecting against data corruption if something goes wrong. When a strategy starts, it uses `readScheduleData` to load any previously saved scheduled signals. Conversely, `writeScheduleData` saves the current state of scheduled signals whenever they are updated.

The `usePersistScheduleAdapter` method gives you the flexibility to customize how these signals are persisted, letting you adapt the system to your specific requirements. Essentially, this class works behind the scenes to keep your trading strategy's scheduled signals reliable and consistent.

## Class PersistRiskUtils

This class helps manage how your trading positions are saved and restored, particularly for risk-based strategies. It keeps track of active positions for each risk profile and makes sure this information is stored reliably.

The class uses a clever system to avoid repeatedly creating storage instances, improving efficiency. You can even plug in your own custom storage solutions.

To retrieve existing positions, use the `readPositionData` method; if no positions are found, it returns an empty record.  When you make changes to your positions, like adding or removing signals, the `writePositionData` method saves them to disk using a safe process to prevent data loss if something goes wrong.

Finally, the `usePersistRiskAdapter` method allows you to integrate different methods for persisting the data – basically, you can customize where and how the information is stored.

## Class PersistPartialUtils

This utility class, `PersistPartialUtils`, helps manage and save the partial profit and loss data used by your trading strategies. It keeps track of this data separately for each symbol and strategy you're using, so you don't lose progress even if something goes wrong.

Think of it as a safe and reliable way to store and retrieve partial information about your trades. It utilizes a clever system that remembers where your data is stored and uses special techniques to ensure that updates are saved correctly, even if your program crashes unexpectedly.

You can also customize how this data is stored by providing your own adapters.

Here's a breakdown of what it does:

*   **Stores Data Securely:** It handles saving and loading the partial profit/loss data.
*   **Keeps Things Organized:**  It structures storage based on the symbol and the name of your trading strategy.
*   **Protects Against Crashes:**  It writes data in a way that prevents corruption if something goes wrong.
*   **Allows Customization:**  You can use your own persistence mechanisms.



The `readPartialData` method loads previously saved data, while `writePartialData` saves the current state. The `usePersistPartialAdapter` method lets you plug in different ways of storing the data.

## Class PerformanceMarkdownService

This service helps you keep track of how your trading strategies are performing. It listens for performance data as your strategies run and organizes that data so you can analyze it.

It breaks down performance metrics by strategy and symbol, calculating things like average execution times, minimums, maximums, and percentiles.  You can then request these aggregated results or generate detailed reports in markdown format, including insights into potential bottlenecks.

These reports can be saved directly to files, allowing you to easily review and share your performance analyses. The service also has a built-in cleanup function to clear out old performance data when needed.  Finally, it's designed to be initialized once and only once to ensure consistent behavior.

## Class Performance

The Performance class helps you understand how well your trading strategies are doing by providing tools to analyze their performance. It lets you collect overall statistics for specific strategies and symbols, giving you a clear picture of their efficiency. 

You can request specific data points like the total execution time, average durations, and volatility metrics to pinpoint areas for improvement. 

The class also creates readable markdown reports that summarize these findings, highlighting potential bottlenecks and presenting data in an easy-to-understand format.  Finally, you can easily save these reports to your computer for later review and sharing.

## Class PartialUtils

This class offers tools to analyze and report on partial profit and loss data collected during backtesting or live trading. Think of it as a way to dig into the details of how your trading strategies are performing in terms of small gains and losses.

It gathers information from events like profits and losses, storing a limited history (up to 250 events) for each symbol and strategy combination. You can use it to get overall statistics, like the total number of profit and loss events. 

You can also easily generate clear, formatted reports in Markdown, including tables showing individual profit/loss events with details such as signal ID, position, level, and price. These reports are incredibly useful for reviewing and understanding your strategy's behavior. 

Finally, the class provides a simple way to save these reports directly to a file on your computer, making it easy to share your analysis or keep a record of your results.

## Class PartialMarkdownService

This service helps you keep track of and report on your partial profits and losses during backtesting or live trading. It listens for events indicating small gains and losses, organizing them by the asset being traded and the specific strategy used.

It automatically builds readable markdown reports summarizing these events, allowing you to analyze performance in detail. You can also request overall statistics, like the total number of profit and loss events. 

The service saves these reports as files on your computer, making it easy to review your progress over time. You can control which data is included in reports and where they’re saved. The whole process is designed to be straightforward – the service handles the data collection and formatting, freeing you to focus on understanding your trading performance. It initializes itself automatically when needed, ensuring everything is set up correctly.

## Class PartialGlobalService

The PartialGlobalService acts as a central hub for managing partial profit and loss tracking within the backtest-kit framework. Think of it as a middleman that sits between your trading strategy and the underlying connection layer. It receives instructions from your strategy, logs these actions for monitoring purposes, and then passes them on to be handled by the PartialConnectionService. 

This service helps keep things organized by providing a single point of injection for your strategy and simplifying the process of tracking partial profits and losses. It also makes it easier to monitor how your strategy is performing by providing centralized logging.

The service relies on several other components, including logging services and validation services, to ensure everything runs smoothly and safely.  The `profit`, `loss`, and `clear` methods are the main ways you interact with this service, handling events when profit or loss levels are reached, or when a trading signal closes.

## Class PartialConnectionService

This service manages how profit and loss is tracked for individual trading signals. It’s designed to avoid creating unnecessary objects, reusing them whenever a signal needs to be tracked again. Think of it as a central place to handle the details of profit and loss for each signal, keeping everything organized and efficient.

It makes sure that each signal has its own dedicated record for profit and loss, but it cleverly remembers these records so it doesn't have to recreate them every time. It's set up to work smoothly with other parts of the system, automatically cleaning up when signals are no longer needed. When a signal reaches a profit or loss threshold, or when it closes, this service is responsible for recording and communicating those events.

## Class OutlineMarkdownService

This service is designed to help automatically create documentation from the results of AI-powered trading strategies. Specifically, it's used by the AI Strategy Optimizer to save important details like the system prompts used, the conversation history between the AI and the user, and the final output from the AI. 

It organizes this information into a structured directory system within a "dump/strategy" folder, creating separate markdown files for each key part of the interaction. You'll find files containing the initial system messages, each user input, and the final AI-generated output, all clearly labeled and organized.

The service checks if the directory already exists before writing, so you won’t accidentally overwrite any previous documentation. It relies on a logger service to handle the writing process and the `dumpSignal` method is the main way it does its work.

## Class OptimizerValidationService

This service helps keep track of all the optimizers your backtesting system uses, making sure they're properly set up and available. Think of it as a central address book for optimizers. 

It allows you to register new optimizers, ensuring you don’t accidentally add the same one twice. 

When you need to confirm an optimizer is present, the service quickly checks its records, remembering previous validations to speed things up. 

You can also ask this service to display a complete list of all optimizers it's managing, along with their details.

## Class OptimizerUtils

OptimizerUtils offers tools to work with strategies generated by your backtest kit setup. You can easily retrieve strategy data, like performance metrics and configuration, using the `getData` method. If you want to see the actual code that will be executed, `getCode` will produce the full strategy code, including all necessary components. Finally, `dump` lets you save that generated code directly to a file, creating a self-contained module ready for deployment, automatically organizing your files into a sensible directory structure. This simplifies the process of managing and sharing your optimized strategies.


## Class OptimizerTemplateService

This service acts as a starting point for creating code snippets used in backtesting and optimization, essentially providing a template for your trading strategies. It leverages a large language model (Ollama) to help generate these snippets, including code for analyzing market data, defining strategies, and configuring exchanges. 

The service handles a lot of the groundwork, including: 

*   Preparing the initial setup with necessary imports and constants.
*   Crafting prompts for the language model to understand your data and requirements.
*   Generating configuration code for different parts of your trading system, such as exchanges (using CCXT), strategy comparisons (using a "Walker" approach), and timeframes.
*   Creating helpers for debugging, like dumping conversations and results, and for structuring the output of the language model into JSON format, defining the structure of generated trading signals (position, explanation, price levels, estimated duration).

You can customize certain aspects of this service through configuration, allowing you to fine-tune how the code snippets are generated to fit your specific needs. It supports multi-timeframe analysis, meaning it can look at data from different periods (1m, 5m, 15m, 1h) to inform your strategy.

## Class OptimizerSchemaService

The OptimizerSchemaService helps keep track of different optimizer configurations, making sure they're all set up correctly and consistently. It's like a central hub for defining and managing how optimizers work.

When you want to add a new optimizer setup, you register it with the service. The service will even double-check to make sure you’ve included all the necessary information. 

If you need to adjust an existing optimizer configuration, you can partially update it; the service intelligently merges your changes with what’s already there. 

And, of course, it provides a simple way to find and retrieve a specific optimizer configuration when you need it. It uses a registry to store these schemas in a secure and unchanging way.

## Class OptimizerGlobalService

The OptimizerGlobalService acts as a central hub for working with optimizers within the backtest-kit framework. Think of it as a gatekeeper that ensures everything is set up correctly before allowing operations to proceed.

It handles tasks like logging actions, verifying that the requested optimizer actually exists, and then passing the work along to a specialized connection service.

You'll primarily use this service to retrieve data, generate strategy code, or save code to a file. Before any of these actions happen, it will double-check to make sure the optimizer you’re referencing is valid, providing an extra layer of safety.

Essentially, it provides a clean and validated public interface for interacting with your optimizers. It has dependencies on other services for logging, connecting and validation which are injected during creation. The `getData` method fetches strategy data, `getCode` generates the strategy code, and `dump` saves the code to a file.

## Class OptimizerConnectionService

The OptimizerConnectionService helps you work with optimizers in a streamlined way. It acts as a central place to create and reuse optimizer connections, preventing you from repeatedly setting them up. Think of it as a smart manager for your optimizers – it remembers which ones you've already created so it can quickly provide them again when needed. 

It combines your custom configurations with default settings, making sure your optimizer setup is just right. You can inject a logger for tracking what's happening, and it simplifies fetching data and generating code for your trading strategies.

Here's a breakdown of what it offers:

*   **Easy Optimizer Access:**  `getOptimizer` is your go-to method for getting an optimizer; it remembers the ones you've used before to save time.
*   **Data Retrieval:** `getData` pulls together information from various sources and prepares it for strategy development.
*   **Code Generation:**  `getCode` assembles the final code you’ll run for your strategies.
*   **Code Saving:**  `dump` lets you automatically save generated code to a file, which is useful for organizing and sharing your work.


## Class LoggerService

The LoggerService is designed to provide consistent and informative logging throughout the backtest-kit framework. It’s your central hub for all logging needs, automatically adding crucial context to your messages.

You can think of it as a smart wrapper around a logger you provide, automatically including details like the trading strategy, exchange, and even the specific trade being executed. This ensures your logs are always packed with the information you need for debugging and analysis.

If you don’t configure a logger yourself, it gracefully falls back to a "no-op" logger, meaning no logging happens but the framework still functions correctly.

The `setLogger` method allows you to plug in your own custom logging implementation.  You'll find helpful methods like `log`, `debug`, `info`, and `warn` for different logging severity levels, all of which automatically inject the relevant context. It uses `methodContextService` and `executionContextService` internally to manage this context.

## Class LiveUtils

LiveUtils is a helper tool designed to simplify running and managing live trading sessions within the backtest-kit framework. Think of it as a central point for launching, controlling, and monitoring your live strategies.

It offers a way to kick off live trading using a simplified command, automatically handling things like restarts if your process crashes and keeping track of progress in real time.  You can run a live strategy and receive a continuous stream of results – it’s designed to keep running indefinitely until you tell it to stop.

If you just want to run a strategy quietly in the background for purposes like saving data or triggering external actions, there’s a dedicated function for that too.  You can also stop a strategy from generating new trading signals while allowing any existing trades to finish.

LiveUtils also lets you retrieve performance statistics, generate reports in Markdown format, save those reports to a file, and see a list of all your currently running live trading sessions and their status. Everything is set up to be easily accessed, acting as a single, reliable point of control for your live trading activities.

## Class LiveMarkdownService

This service helps you automatically generate reports about your live trading activity. It quietly listens to every trade event – from when a strategy is idle, to when a trade is opened, active, or closed. 

The service organizes these events for each strategy you’re running, creating detailed tables that you can easily read. You'll also get useful trading statistics like win rate and average profit/loss. 

The reports are saved as markdown files in a logs directory, making them easy to review and share. You can clear out old data whenever you like, either for a specific trading strategy or all of them at once. This service handles the data storage and report generation so you can focus on your trading. It also sets itself up automatically when you first use it.

## Class LiveLogicPublicService

LiveLogicPublicService makes it easier to run live trading strategies by handling a lot of the background work for you. It automatically manages things like the strategy name and exchange, so you don't have to pass them around constantly in your code.

Think of it as a wrapper around a more complex internal service, simplifying how you interact with it. 

It continuously runs your trading logic as a stream of data, and it's designed to keep going even if something unexpected happens – it can recover from crashes by saving and restoring its state. The system tracks progress in real-time, using the current date and time.

You can start a live trading session for a specific symbol using the `run` method, which generates a never-ending stream of trading signals (both opening and closing signals).

## Class LiveLogicPrivateService

This service is designed to handle live trading operations, acting as a central orchestrator. It continuously monitors the market using an ongoing loop, checking for trading signals and managing the trading process. 

It generates results in real-time, focusing only on positions that have been opened or closed, and efficiently streams these updates. Because it’s built as an infinite generator, it runs continuously – you don't need to worry about it stopping. 

If things go wrong, like a crash, it can recover and pick up where it left off. The service relies on several other components—like a logger, a strategy core, and a method context—to function. To start trading, you simply call the `run` method, specifying the trading symbol.

## Class LiveCommandService

This service acts as a central hub for accessing live trading features within the backtest-kit framework. Think of it as a convenient gateway, making it easier to manage and inject dependencies related to live trading.

It bundles together several essential components, including services for logging, handling live trading logic, validating strategies and exchanges, defining strategy schemas, and assessing risks.

The core functionality revolves around the `run` method.  This method allows you to initiate live trading for a specific asset.  It's designed to continuously generate results (like whether a trade opened or closed) and includes automatic recovery if unexpected errors occur, ensuring a more stable live trading process. The `run` method needs the symbol you want to trade and some contextual information like the name of your strategy and the exchange you're using.


## Class HeatUtils

HeatUtils helps you visualize and understand your trading strategy's performance through heatmaps. It’s a handy tool that gathers data about how each symbol performed within a strategy, and then presents that information in a clear and organized way. 

You can use it to get the raw data for a specific strategy, or to generate a nicely formatted markdown report showing key metrics like total profit, Sharpe Ratio, maximum drawdown, and the number of trades for each symbol.  This report sorts symbols by profitability, so you can quickly see which ones are contributing the most (or the least) to your overall results. 

The tool can also save these reports directly to a file on your computer, making it easy to share and review your strategy’s performance. It’s designed to be easy to use – think of it as a convenient shortcut for accessing and reporting on portfolio heatmap statistics.


## Class HeatMarkdownService

The Heatmap Service helps you visualize and analyze your trading strategies’ performance. It gathers data about closed trades, calculating key metrics like total profit, Sharpe Ratio, and maximum drawdown, both for individual symbols and the entire portfolio. 

It organizes this information by strategy and whether it’s a backtest or live trade, keeping everything separate and easily manageable. You can request these statistics on demand, generate formatted reports in Markdown to share or save, or clear the data when it's no longer needed. The service automatically sets itself up when you first use it, so there’s no manual setup required – it just works. It’s designed to handle unusual numerical values gracefully, ensuring you get reliable insights even in tricky situations.

## Class FrameValidationService

This service acts as a central authority for managing and verifying your trading timeframe configurations. Think of it as a librarian for your timeframes, keeping track of them and making sure they're valid before your trading strategies try to use them. You can register new timeframes with the `addFrame` function, and before any trading operation uses a specific timeframe, the `validate` function confirms it actually exists. To improve performance, validation results are cached, so frequently used timeframes don't require repeated checks. Finally, `list` lets you see all the timeframes currently registered within the system.



It handles keeping track of all your defined timeframes and ensuring they’re ready to be used.

## Class FrameSchemaService

This service helps you keep track of the different "frames" – think of them as blueprints – used in your backtesting system. It uses a special system to ensure these blueprints are consistent and follow the rules.

You can add new frame blueprints using `register`, and update existing ones with `override`. If you need to use a particular blueprint, just ask for it by name with `get`. This system stores these blueprints securely and makes sure they're valid before using them. It’s a way to organize and manage the structures that drive your backtesting process.


## Class FrameCoreService

The FrameCoreService acts as a central hub for managing timeframes within the backtesting framework. It relies on other services to handle connections, validation, and ultimately, to produce the date ranges needed for running backtests. Think of it as the engine that provides the timeline for your trading strategies.

The `getTimeframe` function is its primary tool – you give it a symbol (like 'BTCUSDT') and a timeframe name (like '1h' for hourly data), and it returns an array of dates representing the period to be backtested.  This service is crucial for preparing the historical data your backtest will use.


## Class FrameConnectionService

The FrameConnectionService acts as a central hub for interacting with different trading frames, like daily, weekly, or monthly data. It intelligently directs your requests to the correct frame based on the context of your trading operations. 

Think of it as a smart router that automatically figures out which frame you need without you having to specify it every time.  It's also designed to be efficient, caching frequently used frames to speed things up.

The service manages backtesting timeframes, allowing you to define a start and end date for your simulations. This helps limit the scope of your backtests to specific periods. 

For live trading scenarios, where no specific frame is needed, the frame name is empty, and it operates without constraints.  It relies on other services like the logger, schema, and method context services to function correctly. The `getFrame` method is how you get a frame, and `getTimeframe` helps define the bounds of your backtest.

## Class ExchangeValidationService

This service acts as a central place to keep track of your trading exchanges and make sure they're properly set up. Think of it as a gatekeeper – before your trading strategies try to connect to an exchange, this service verifies that the exchange is actually registered and configured correctly. It keeps a list of all the exchanges you've added, and it remembers whether each one has been validated already, which helps speed things up.

You can use it to register new exchanges with their specific details, check if an exchange is valid before using it in your trading logic, and get a complete list of all the exchanges you’ve registered. The service also utilizes logging to provide feedback on its operations.

## Class ExchangeUtils

The ExchangeUtils class is like a helpful assistant for working with different cryptocurrency exchanges. It provides easy ways to interact with exchange data and ensures things are done correctly. You can think of it as a central place to handle common tasks like fetching historical price data, calculating average prices, and properly formatting trade quantities and prices to match the specific rules of each exchange.

It’s designed to be used everywhere in the backtest-kit framework, ensuring consistency and simplifying your code.

Here's a breakdown of what it can do:

*   **Fetching Candles:** It gets historical price data (candlesticks) for a specific cryptocurrency pair and timeframe. It automatically figures out the correct date range to retrieve.
*   **Calculating Average Price:** Determines the volume-weighted average price (VWAP) from recent price data.
*   **Formatting Quantity:**  Makes sure the quantity of an asset being traded adheres to the exchange's specific formatting rules.
*   **Formatting Price:** Ensures the price is formatted correctly according to the exchange’s precision rules.

## Class ExchangeSchemaService

This service helps keep track of the structures for different cryptocurrency exchanges. It acts like a central place to store and manage the blueprints for how your backtesting system understands each exchange.

Think of it as a registry; you add exchange schemas using `addExchange()` or `register()`, giving each one a unique name. You can then easily retrieve a schema later using its name with the `get()` function.

Before adding a new exchange schema, `validateShallow()` checks if it has all the necessary parts and they're the right types – this prevents errors down the line. If you need to update an existing exchange schema, the `override()` function lets you change only the parts you need to. It uses a special tool to ensure everything stays type-safe, making it less likely to have unexpected problems.

## Class ExchangeCoreService

The ExchangeCoreService acts as a central hub for all exchange-related operations within the backtesting framework. It combines several underlying services to ensure that every interaction with the exchange, like fetching data or formatting values, includes the necessary context – the specific symbol, the relevant time, and whether it’s a backtest or live trade. 

Think of it as a wrapper around the connection to the exchange, injecting extra information to make sure everything is handled correctly for the specific trading scenario.

Here's what you can do with it:

*   **Get historical candle data:** Retrieve past price movements for a symbol.
*   **Fetch future candles:** Specifically for backtesting, this allows you to simulate looking ahead.
*   **Calculate average price:** Determine the VWAP (volume-weighted average price) for a specific period.
*   **Format price and quantity:**  Present price and quantity values in a standardized way, taking into account the exchange’s conventions.

The service also includes a validation process to make sure the exchange configuration is correct, and it caches these validations to avoid unnecessary checks.

## Class ExchangeConnectionService

The `ExchangeConnectionService` acts as a central hub for interacting with different cryptocurrency exchanges. It automatically directs requests to the correct exchange based on the current context, like which exchange you're working with. 

To speed things up, it remembers (caches) the exchange connections it creates, so it doesn't have to rebuild them every time. It essentially implements a standard interface (`IExchange`) to provide a unified way to get candles, fetch average prices, and format prices and quantities to match the specific rules of each exchange. 

You can retrieve historical candle data, get the next set of candles for backtesting or live trading, calculate average prices (either from live data or historical candles), and properly format prices and quantities to ensure they're valid for the exchange you’re using. The service handles the details of connecting to and communicating with each exchange.

## Class ConstantUtils

This class provides a set of pre-calculated values to help manage your trading take-profit and stop-loss levels, all based on the Kelly Criterion and a system of exponential risk decay. Think of these values as guides for strategically exiting trades, aiming to maximize profit while minimizing potential losses. They represent percentages of the total distance between your entry point and your ultimate profit or loss target.

For instance, the `TP_LEVEL1` property at 30, means that if your overall profit target is 10%, this level triggers when the price reaches 3% of that profit distance.  `TP_LEVEL2` at 60 would trigger at 6%, and `TP_LEVEL3` at 90 would trigger at 9%. The stop-loss levels follow a similar principle, offering tiered exit points to manage risk.  These levels are designed to let you lock in profits gradually, secure the majority of your position while a trend continues, and provide early warnings or final exits to limit potential losses.

## Class ConfigValidationService

The ConfigValidationService helps keep your trading configurations sound by making sure the numbers make sense and won't lead to losses. It acts like a safety check, verifying settings like slippage, fees, profit margins, and timeouts to prevent errors. 

Specifically, it ensures your take-profit distance is large enough to cover transaction costs, that all percentages are non-negative, and that time-related values are positive whole numbers.  It also checks that values are within reasonable ranges to avoid unexpected behavior. This service performs these checks during setup to give you confidence in your trading framework's configuration. It uses a logger service to report any issues found during validation.


## Class ColumnValidationService

The ColumnValidationService helps keep your column configurations in good shape. Think of it as a quality control system for how your data is organized and displayed.

It makes sure every column has the essential pieces: a unique identifier (key), a descriptive name (label), a formatting rule (format), and a setting to control visibility (isVisible).

It also verifies that your keys are unique, preventing confusion and errors. Finally, it confirms that the formatting and visibility rules are actual functions, ready to be used. Essentially, this service makes sure your column definitions are consistent and prevent unexpected problems down the line.

## Class ClientSizing

This component, called ClientSizing, figures out how much of your assets to allocate to a trade. It's designed to be flexible, offering several approaches to sizing positions, such as using a fixed percentage, the Kelly Criterion, or Average True Range (ATR). You can also set limits on the minimum and maximum size of a position, as well as a percentage cap on how much of your capital can be used.  The ClientSizing component can also be customized with callbacks to validate calculations and record logging information. Ultimately, it's used during the trade execution process to determine the most suitable position size.

It takes a set of initial parameters to configure how sizing will work, and its primary function is to perform the actual size calculation based on specific input parameters.

## Class ClientRisk

ClientRisk helps manage risk across your trading strategies, ensuring they don’t violate pre-defined limits. It's designed to work at the portfolio level, so it considers the combined impact of signals from multiple strategies. 

Think of it as a safety net; it checks each potential trade to make sure it aligns with your overall risk tolerance. 

Key features include limiting the number of concurrent positions you hold and allowing you to create custom risk validation rules. The `_activePositions` property keeps track of all your open positions, and the system only initializes this data once, even when running backtests.

The `checkSignal` method is the core of the risk assessment – it evaluates signals and decides whether to allow them based on those rules. Signals are registered with `addSignal` when opened and removed with `removeSignal` when closed.

## Class ClientOptimizer

The ClientOptimizer helps automate the process of creating and evaluating trading strategies. It connects to various data sources, retrieves strategy information, and generates code. Think of it as a central hub for building strategies – it fetches the data, crafts the code, and can even save that code to a file for you.

The optimizer collects data, keeps track of the process with progress updates, and uses that data to build up the necessary conversation history for larger language models. It then combines all the pieces – imports, helper functions, and the strategies themselves – into a fully functional code file. You can even specify a location where it should save the generated code, and it will create any missing directories. 

Essentially, this component takes care of a lot of the behind-the-scenes work needed to create and manage trading strategies, streamlining the optimization process.


## Class ClientFrame

The `ClientFrame` component is responsible for creating the timelines your backtesting runs use. Think of it as the engine that builds the sequence of dates and times your trading strategies will evaluate. It’s designed to avoid unnecessary work by caching previously generated timelines, ensuring efficiency. You can control how finely spaced those timestamps are, from one minute to three days, and it allows you to add custom checks and logging during timeline creation. The `getTimeframe` method is the key – it’s how you request a timeline for a specific trading symbol, and it remembers the results for later use.

## Class ClientExchange

This class provides a way to interact with an exchange to retrieve data needed for backtesting and trading. It's designed to be efficient in its memory usage.

You can use it to fetch historical candle data, essential for analyzing past performance, and to request future candles, which are crucial for simulating how a strategy would behave moving forward.  It also calculates a Volume Weighted Average Price (VWAP) based on recent trade data to give you an idea of average price over a period.

The class also has functions to properly format quantities and prices, making sure your trade orders look correct for the specific exchange you're using – this handles things like decimal places and rounding based on the instrument. Everything is set up to work efficiently, using prototype functions to minimize memory consumption.

## Class CacheUtils

CacheUtils helps you speed up your backtesting by caching the results of your functions. Think of it as a way to avoid re-calculating the same things over and over.

It works by wrapping your functions, ensuring that they only run when needed and store the results for later use. Each function gets its own dedicated cache, so changes to one function's cache won't affect others.

You can clear the cache for a specific function when you've made changes to its underlying logic or completely flush all cached data if you’re switching to a new test scenario. If you only need to invalidate the cache for a particular test setup, `clear()` allows you to do that without affecting other runs. It's like giving your function a fresh start for a specific situation.

## Class BacktestUtils

BacktestUtils is a helper class designed to simplify the process of running backtests within the trading framework. Think of it as a central place to kick off and manage backtest operations.

It offers a convenient way to execute backtests using `run`, which handles the underlying complexities and provides logging. You can also run backtests in the background with `background` if you only need the side effects like logging, without needing to see the detailed results. 

Need to stop a backtest mid-way? `stop` allows you to halt signal generation, ensuring a clean shutdown. 

After a backtest is complete, `getData` gives you a summary of statistics, while `getReport` generates a detailed markdown report to analyze performance.  The `dump` function lets you save those reports directly to a file. Finally, `list` allows you to see the status of all backtests that are currently running.  This class acts as a singleton, so you can access these functions easily from anywhere in your code.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create readable reports summarizing your backtesting results. It automatically keeps track of closed trading signals for each strategy and symbol you're testing. 

Think of it as a way to neatly organize all the data from your backtests into Markdown tables that you can easily view and share.

Here's a breakdown of what it does:

*   **Signal Tracking:** It listens for trading signals and saves information about when those trades close.
*   **Report Generation:** You can request a report for a specific strategy and symbol, which will be formatted into a Markdown table.
*   **Saving Reports:** It can save these reports directly to your computer, making it easy to keep a record of your backtesting experiments.
*   **Automatic Initialization:** The service automatically sets itself up when you first use it.
*   **Clearing Data:** You can clear out the accumulated signal data if you want to start fresh or only clear data for a specific test. 

It’s designed to work with your backtesting framework's tick processing, and it handles the complexities of storing and presenting your backtest data in a clean, organized way.

## Class BacktestLogicPublicService

The `BacktestLogicPublicService` simplifies running backtests by handling the necessary context information for you. Think of it as a convenient layer on top of the core backtesting engine. It automatically manages things like the strategy name, exchange, and frame, so you don't need to keep passing them around to different functions.

You initiate a backtest using the `run` method, providing the symbol you want to backtest.  This method then streams backtest results, making it easy to process them as they become available.  Essentially, it makes it easier to work with the backtesting framework without needing to worry about manual context management.


## Class BacktestLogicPrivateService

This service manages the behind-the-scenes work of running a backtest, designed to be efficient and flexible. It pulls in the necessary data – like historical timeframes – and walks through them one by one, mimicking the trading process.

When a trading signal appears, it fetches the relevant candle data and then executes the backtesting logic. Instead of storing everything in memory, it streams the results of completed trades to you, which makes it ideal for large datasets or complex strategies. 

You can even stop the backtest early if needed. The service relies on several other components to do its job, including services for logging, strategy execution, exchange data, historical data frames, and method context.  The primary function, `run`, initiates the backtest process for a specified symbol and returns a stream of backtest results.

## Class BacktestCommandService

This service acts as a central point for running backtests within the system. Think of it as a helper that makes it easy to access the core backtesting engine and related validation processes. It handles the behind-the-scenes setup, letting you focus on defining what you want to test.

The service relies on several other components for tasks like logging, validating strategy definitions, and checking the configuration of exchanges and data frames. 

The main function you'll use is `run`, which lets you initiate a backtest for a specific asset (like a stock or cryptocurrency). You need to provide information about the strategy, exchange, and data frame you’re using for the test. The `run` function will then generate a sequence of backtest results, allowing you to examine the performance over time.

