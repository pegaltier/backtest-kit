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

This service helps you keep track of and verify your walker configurations – think of walkers as setups for exploring different parameter combinations to optimize your trading strategies. It acts as a central place to register these configurations, ensuring they’re valid before you use them in your backtesting. 

The service keeps a record of all your walkers, allowing you to easily add new ones and check if a specific walker exists. To make things efficient, it also remembers previous validation results, so it doesn’t have to re-check things unnecessarily. You can also use it to see a complete list of all the walkers you've registered.


## Class WalkerUtils

WalkerUtils provides a simple way to manage and run walker comparisons, which are essentially automated tests of your trading strategies. It acts as a central helper, taking care of details like retrieving information from the walker schema and handling logging.

Think of it as a tool that lets you easily execute and monitor these tests, whether you need the results immediately or just want to run them in the background for tasks like logging. You can also use it to stop strategies from generating new signals, ensuring a controlled testing environment.

The class gives you methods to get detailed data, generate reports in markdown format, and even save these reports to a file. It also provides a list of all active walker instances and their status, so you can keep track of what's running.  WalkerUtils aims to streamline the process of working with walkers, making it less complex and more manageable.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of different trading strategies, or "walkers," and their configurations in a structured and reliable way. It's like a central library where you store all the details about each strategy.

This service uses a special system to ensure that the information you store is always in the correct format, preventing errors down the line. You can add new strategies using `addWalker()` (represented by the `register` property), and easily find existing ones by their names with `get()`.

If you need to make small adjustments to an existing strategy, the `override()` function lets you update specific parts without having to redefine the entire strategy. Before adding a new strategy, `validateShallow()` checks if it has all the necessary components, ensuring everything is set up correctly from the beginning.

## Class WalkerReportService

WalkerReportService helps you keep track of your trading strategy optimization experiments. It acts like a diligent recorder, capturing the results of your walker's efforts – things like metrics and statistics – and neatly storing them in a database.

Think of it as a system that listens for updates during optimization runs and saves those details for later review. It's designed to help you understand which parameters are working best and how your strategy is improving over time.

You can easily set it up to monitor your walker's progress and then, when you’re done, safely remove it to prevent interference.  The system prevents accidentally subscribing multiple times, ensuring your data stays clean and organized.

## Class WalkerMarkdownService

This service helps you automatically generate and save reports about your backtesting experiments. It listens for updates from your backtesting process, tracking the results of different strategies as they run.

The service organizes the results for each backtest ("walker") separately, ensuring that data doesn’t get mixed up. It then creates easy-to-read markdown tables that let you compare the performance of your strategies side-by-side.

You can customize the reports by choosing which data points to display. Finally, it saves these reports to files on your computer, making it simple to review and share your findings.

You can subscribe to receive updates as your backtests run, and unsubscribe when you’re finished. The `clear` function allows you to delete accumulated data, either for a specific backtest or all of them.

## Class WalkerLogicPublicService

This service helps manage and run "walkers," which are like individual tests or executions within the backtest-kit framework. Think of it as the public-facing part of a system that orchestrates these walkers, handling behind-the-scenes details.

It automatically passes along important information like the strategy name, exchange, frame, and walker name, so you don’t have to manually provide them each time.  This makes running walkers much simpler and cleaner.

The `run` method is the main way to execute walkers; you give it a symbol (like a stock ticker) and some context, and it returns a sequence of results from those walkers. This lets you run tests across all your strategies for a given symbol.

It relies on other services for its operation – a logger, a private walker logic service, and a schema service – so those are managed internally.

## Class WalkerLogicPrivateService

The WalkerLogicPrivateService helps you compare different trading strategies against each other, acting as an orchestrator for this process. It's designed to give you updates as each strategy runs, so you can monitor progress and potentially see which ones are performing well in real-time. Once all strategies have finished, it provides a ranked list of results, letting you easily see which ones came out on top.

Essentially, it leverages the BacktestLogicPublicService to run each strategy and then organizes and presents the outcomes in a clear and helpful way. You can use it to compare strategies for a specific financial symbol, defining which strategies to test, the metric you're optimizing for (like profit or Sharpe ratio), and the exchange, frame, and walker names involved.


## Class WalkerCommandService

WalkerCommandService acts as a central point to interact with the core walker functionality within the backtest-kit framework. Think of it as a convenient helper to access and manage the different services involved in running a backtest. It simplifies how you trigger and control the backtesting process, especially when working with dependency injection.

The service coordinates with several other services internally, handling tasks like validating strategies, exchanges, and the overall framework setup, ultimately ensuring everything is correctly configured before a backtest begins.

Its key feature is the `run` method which allows you to initiate a walker comparison for a specific trading symbol. When you call this, it passes along important context like the walker's name, the exchange being used, and the frame it operates within, ensuring the backtest is executed within the correct environment.


## Class StrategyValidationService

This service helps you keep track of your trading strategies and make sure they're set up correctly. Think of it as a central manager for your strategies, ensuring each one is properly registered and ready to go. It lets you add new strategies, providing details about their configuration, and validates that those configurations – including any associated risk profiles and actions – are valid before you start trading. To speed things up, it remembers previous validation results, so you don’t have to repeat checks unnecessarily. You can easily see a complete list of all your registered strategies too.

## Class StrategyUtils

StrategyUtils is a helpful tool for understanding how your trading strategies are performing. It acts as a central place to gather and present information about strategy events, like when a trade was canceled, partially closed for profit, or adjusted with a trailing stop. 

You can use it to get a summary of statistics – like how many times each type of action occurred – or to create detailed reports showing each event. These reports include important details like the symbol traded, the action taken, the price at the time, and timestamps. 

The tool also simplifies exporting these reports to files, automatically creating the necessary folder structure and giving the files descriptive names so you can easily track and analyze your strategy’s behavior. This makes it easy to review performance and identify areas for improvement.

## Class StrategySchemaService

This service keeps track of different trading strategy blueprints, ensuring they're structured correctly. It's like a central library for strategy definitions. You can add new strategy blueprints using `addStrategy()`, and then retrieve them later by their name.

The service checks that each new strategy blueprint has all the essential information before adding it to the library, using a quick check to make sure everything's in place. If a strategy blueprint already exists, you can update parts of it using `override()`. Finally, `get()` lets you easily find a specific strategy blueprint by its name. The service utilizes a specialized storage mechanism for type safety.

## Class StrategyReportService

This service helps you keep a detailed record of what your trading strategies are doing, especially when backtesting. It focuses on logging specific actions like canceling orders, closing positions, taking profits or losses, and adjusting stop-loss or take-profit levels.  Instead of building a report in memory, it writes each event directly to a JSON file as it happens, making it a good choice for creating an audit trail.

To start logging, you need to call `subscribe()`, and to stop, call `unsubscribe()`.  Each of the methods like `cancelScheduled`, `closePending`, and `partialProfit` handles a particular event and saves the relevant details. The `handleSignalEvent` method acts as a central point, directing events to the correct logging method based on the action being performed. Remember that `subscribe` needs to be called before any logging happens, and `unsubscribe` stops the logging process.

## Class StrategyMarkdownService

This service acts like a digital notebook for your backtesting strategies, keeping track of important events like order cancellations, profit-taking, and stop-loss adjustments. Instead of writing each event down immediately, it holds onto them temporarily, allowing for efficient reporting and analysis.

Think of it as a central hub where strategy actions are recorded. To start tracking, you need to "subscribe" to the service.  Once subscribed, it automatically captures events related to your strategies. You can then access this data to generate detailed reports in Markdown format, which are helpful for understanding your strategies' behavior and identifying areas for improvement. These reports can also be saved directly to files.

You can choose to clear the stored events at any time, either for a specific strategy or globally. The service uses a clever caching system to manage the stored data efficiently. It ensures that only the data relevant to each symbol-strategy combination is stored, making the process scalable and resource-friendly. Ultimately, this service provides a convenient and organized way to monitor and document your backtesting activities.

## Class StrategyCoreService

The `StrategyCoreService` acts as a central hub for managing strategy operations, especially when it needs to work with specific trading contexts like a particular symbol or timeframe. It essentially connects the strategy logic with the necessary environment information.

It has several helper services for logging, validation, and connecting to strategies. It also has caching mechanisms to avoid repeated validation.

You can use it to:

*   **Retrieve Signals:** Get the currently active pending or scheduled signals for a specific symbol, useful for monitoring or managing positions.
*   **Check Breakeven:** Determine if a pending signal has reached its breakeven point.
*   **Check Strategy Status:**  Find out if a strategy is currently stopped.
*   **Run a Backtest:** Quickly test a strategy's performance against historical candle data.
*   **Control Strategy Actions:**  Stop, cancel scheduled signals, or close pending positions – all without stopping the strategy completely.
*   **Dispose of Strategies:** Clean up resources and remove strategy instances from the system.
*   **Perform Partial Exits:** Partially close positions based on profit or loss levels.
*   **Adjust Trailing Stops & Take Profits:** Fine-tune stop-loss and take-profit levels for active signals.



Essentially, `StrategyCoreService` provides a set of pre-built functions to interact with strategies in a controlled and consistent way, making sure they have the right information to operate effectively.

## Class StrategyConnectionService

This service acts as a central hub for managing and executing trading strategies within the backtest-kit framework. It intelligently routes requests to the correct strategy implementation based on the specific symbol and strategy name used. To optimize performance, it keeps a cache of these strategies, so frequently used ones are readily available.

Before any trading actions can happen, the service makes sure the strategies are properly initialized. It handles both live trading (through the `tick` method) and historical backtesting (through the `backtest` method).

Here's a breakdown of key functionalities:

*   **Strategy Management:** It fetches, creates, and caches strategies to avoid repeatedly creating them. The cache is organized to isolate strategies based on exchange and frame, ensuring correct operation in various scenarios.
*   **Signal Retrieval:** It provides methods to get the current pending and scheduled signals for a strategy.
*   **Risk and Position Management:** It offers methods for adjusting breakeven points, stopping strategies, and closing positions partially or entirely, all while ensuring that signals are handled correctly.
*   **Backtesting Operations:** It allows to run backtests against historical data.
*   **Cleanup:** It provides mechanisms to clear the strategy cache, either for specific strategies or all of them, as well as canceling scheduled signals and closing pending orders.



Essentially, it simplifies working with multiple strategies by handling the underlying complexities of routing and managing them while providing methods for essential trading actions.

## Class SizingValidationService

This service helps you keep track of your position sizing strategies and makes sure they're available when you need them. Think of it as a central place to register and check your sizing methods. 

It allows you to add new sizing strategies using `addSizing`, so you can easily manage them. Before you start using a sizing strategy, `validate` makes sure it's registered and ready to go. 

If you need to see what sizing strategies you have available, `list` provides a simple way to get a list of them all.  To make things faster, the service also remembers the results of previous validations, so it doesn't have to re-check them every time.

## Class SizingSchemaService

The SizingSchemaService helps you keep track of how much to trade in different situations. It's like a central place to store and manage your trading sizing rules. 

Think of it as a registry where you can add, update, or retrieve sizing schemas – these schemas define things like how much capital to risk on each trade. 

The service uses a special system to ensure your sizing schemas are structured correctly, so you don't have any unexpected errors. You can add a new sizing schema using `register`, update an existing one with `override`, and grab a sizing schema you need using `get`. It uses a logging system to help you understand what's happening behind the scenes.

## Class SizingGlobalService

The SizingGlobalService is a central component that handles determining how much of an asset to trade. It works with other services to ensure sizing calculations are accurate and consistent. Think of it as the engine that figures out your position sizes, considering factors like risk and account balance. 

It uses a connection service to access sizing data and a validation service to make sure everything is in order. The `calculate` method is the core function – it takes parameters like risk tolerance and market data and returns the calculated position size. This service is a crucial part of how backtest-kit executes trading strategies.

## Class SizingConnectionService

The SizingConnectionService acts as a central hub for all position sizing calculations within the backtest-kit framework. It intelligently directs sizing requests to the correct sizing implementation, allowing you to use different sizing methods like fixed percentage, Kelly Criterion, or ATR-based sizing. 

To improve efficiency, it remembers previously used sizing implementations, so it doesn’t have to recreate them every time you need them. This caching significantly speeds up the backtesting process.

You specify which sizing method to use through a parameter called `sizingName`. If your strategy doesn't require any specific sizing configuration, this parameter will be an empty string. The service uses `loggerService` and `sizingSchemaService` for logging and schema validation.  The `calculate` function is where the actual sizing calculation happens, taking into account risk parameters and your chosen sizing method.


## Class ScheduleUtils

ScheduleUtils is a helpful tool for understanding how your trading signals are being processed and managed on a schedule. It acts as a central point to monitor and report on scheduled signals, making it easier to identify potential bottlenecks or issues.

You can use ScheduleUtils to get a snapshot of statistics, like the number of signals queued, how many were cancelled, and how long signals are waiting.  It also generates clear, readable markdown reports summarizing signal activity, which are great for analysis and debugging. The system automatically keeps track of information and provides access to it, saving you time and effort.

Essentially, it's a convenient way to keep tabs on your scheduled signals, with the option to save those reports directly to a file.

## Class ScheduleReportService

The ScheduleReportService helps you keep track of how your scheduled trading signals are performing by logging key events. It listens for signals being scheduled, when they start running (open), and when they are cancelled.

It automatically calculates how long it takes from when a signal is scheduled until it actually runs or is cancelled, which is great for spotting delays. 

The service records this information in a database, allowing you to analyze the performance of your scheduled trading strategies. You can easily subscribe to receive these signal events, and there's a built-in mechanism to prevent accidentally subscribing multiple times. When you're done, you can unsubscribe to stop receiving the updates.

## Class ScheduleMarkdownService

This service automatically generates reports detailing scheduled trading signals, providing a record of what happened during backtesting or live trading. It listens for when signals are scheduled and cancelled, keeping track of each strategy's activity. The service then organizes this information into easy-to-read markdown tables, complete with helpful statistics like cancellation rates and average wait times. These reports are saved as files, making it simple to review performance and identify any potential issues.

The service uses a clever system to isolate data for each specific trading setup (symbol, strategy, exchange, timeframe, and whether it's a backtest). You can subscribe to receive events, unsubscribe when you no longer need them, and clear the stored data when necessary.  You can also request specific statistics or generate full reports for any combination of symbol, strategy, exchange, and timeframe, or have them saved directly to disk.

## Class RiskValidationService

This service helps you keep track of and double-check your risk management settings. Think of it as a central hub for all your risk profiles. 

You can register new risk profiles using `addRisk`, which essentially tells the service about a new rule or configuration.  Before you actually *use* a risk profile, it’s a good idea to `validate` it – this makes sure it's properly registered and avoids potential problems later. 

The service also keeps a handy list of all your registered risk profiles accessible through `list`, allowing you to quickly see what you’ve configured. To make things efficient, it remembers the results of validations so it doesn't have to re-check things repeatedly.

## Class RiskUtils

The RiskUtils class helps you analyze and understand risk rejection events within your trading system. Think of it as a tool to review why trades might have been blocked or adjusted.

It gathers information about rejected trades – like the symbol involved, the strategy used, the position taken, and the reason for rejection – and organizes it for you.  You can request summaries of this data, for example, total rejection counts broken down by symbol or strategy.

You can also generate detailed reports in markdown format, which present the rejection events in a readable table, along with overall statistics.  Finally, this class makes it easy to save these reports directly to files for later review or sharing. Essentially, it’s your go-to place for examining and documenting risk management decisions.

## Class RiskSchemaService

This service helps you keep track of your risk schemas in a safe and organized way. It uses a special system to ensure the schemas are typed correctly, preventing errors later on. You can add new risk profiles using `addRisk()`, and easily find them again by their name. 

The service includes a way to quickly check if a new schema has the necessary building blocks before it's registered.  You can also update existing schemas with new information using the `override` function. Finally, you can retrieve any risk schema by simply providing its name.

## Class RiskReportService

This service helps you keep track of when your risk management system blocks trades. It essentially acts as a recorder, capturing every time a trading signal is rejected and why.

It listens for these rejection events and stores them in a database, allowing you to analyze risk patterns and conduct audits later on. You subscribe to receive these events, and the system makes sure you don’t accidentally subscribe multiple times. When you're finished, you can unsubscribe to stop receiving the data. This ensures a clean and organized record of risk rejections.

## Class RiskMarkdownService

The RiskMarkdownService helps you automatically generate reports detailing risk rejections in your trading system. It listens for these rejection events and organizes them based on the symbol, strategy, exchange, frame, and whether it’s a backtest.  It then compiles this information into nicely formatted markdown tables and provides overall statistics like the total number of rejections.

You can subscribe to receive these rejection events and the service takes care of storing the data, ensuring each symbol and strategy combination has its own isolated storage. The `getData` method allows you to retrieve statistics, `getReport` generates the markdown report itself, and `dump` saves that report to a file on your disk.  The `clear` function lets you wipe out accumulated rejection data, either for everything or specific combinations. The service uses a logger for debugging and manages the storage process behind the scenes, making it easier to analyze and understand risk rejections within your backtesting and live trading environments.

## Class RiskGlobalService

The RiskGlobalService acts as a central hub for managing risk within the backtest-kit trading framework. It handles validation of risk configurations and enforces trading limits, essentially ensuring that strategies stay within defined boundaries. This service relies on other components like a connection service and validation services to perform its duties.

It keeps track of open trading signals, validating each one to ensure it adheres to established risk rules before allowing execution.  When a trade is opened, the system registers it; when it’s closed, it removes the record.

For efficiency, validation checks are cached, preventing repetitive processing for the same risk scenarios.  You can selectively clear risk data, either targeting a specific combination of risk, exchange, and frame or clearing everything entirely. The service also logs its activity for auditing and monitoring purposes.

## Class RiskConnectionService

The RiskConnectionService acts as a central hub for handling risk-related operations within the trading system. It intelligently directs requests to the correct risk management implementation based on a given risk name, ensuring that risk checks are applied appropriately. To improve efficiency, it keeps a record of these risk implementations, so it doesn't have to recreate them every time.

This service provides methods for checking if a signal is permissible according to risk limits, registering new signals, and removing closed signals. When a signal is blocked due to risk constraints, the system notifies relevant components.  The service also has a way to clear its cached risk implementations, allowing for resets or updates. Risk configurations are specific to each exchange and frame within the system. Strategies without defined risk settings will use an empty string as the risk name.

## Class ReportUtils

ReportUtils helps you control which parts of the backtest-kit framework – like backtests, live trading, or performance analysis – generate detailed logs in JSONL format. 

Think of it as a way to turn on or off specific monitoring for different aspects of your trading system.

The `enable` function lets you pick which services you want to track and will automatically start collecting and saving data. Crucially, it gives you a function to call later to stop all the logging you've started.  Remember to use that function to avoid memory problems.

The `disable` function lets you stop logging for specific services without affecting others.  It immediately stops the logging process and frees up resources, but doesn't give you a cleanup function like `enable` does.



It’s usually extended by other classes that build upon its reporting capabilities.

## Class ReportBase

The `ReportBase` class helps you reliably log and analyze trading events. It creates a single JSON file for each report type, appending new data as individual lines in a standard JSONL format. This allows for flexible post-processing and analysis of your backtest results. 

The system handles writing these events efficiently, even when dealing with a high volume of data, and includes built-in safeguards like timeouts to prevent issues. You can easily filter these reports later by searching for specific information like the trading symbol, strategy name, or exchange.

Initialization is handled automatically and safely, creating the necessary directories and ensuring proper setup. The `write` method is your primary tool for adding data, bundling the event details with relevant metadata and a timestamp for easy tracking.

## Class ReportAdapter

This component helps manage and store your trading data in a flexible way, like backtest results or live trade information. It uses a pattern that allows you to easily swap out different storage methods without changing your core code.

Think of it as having a central place to send your data, and it automatically remembers which storage method to use for each type of report (backtest, live trades, etc.), creating just one instance of each. 

You can change how data is stored – maybe you want to use JSONL files, or something else – and this component handles that change seamlessly. There's even a “dummy” mode that lets you disable data writing entirely, which is handy for testing. It also starts storing data only when you actually need to write something, and all the writing is done in a way that's designed for analytics pipelines. 

To adjust the storage method, you can use the `useReportAdapter` method. You can revert to the default JSONL format using `useJsonl`.

## Class PositionSizeUtils

This class offers helpful tools for figuring out how much of an asset to trade in your backtests. It includes different position sizing strategies, each with its own specific way of calculating the right amount. 

You'll find methods like fixed percentage, Kelly Criterion, and ATR-based sizing built right in. 

Each method comes with built-in checks to make sure you're using it correctly, ensuring the calculations are accurate. It’s like having a guide to help you choose and apply the best sizing approach for your trading strategy. 

The class provides ready-to-use functions, so you don't have to worry about writing those calculations from scratch.


## Class PersistSignalUtils

This class helps manage how signal data is saved and loaded, especially for trading strategies. It's designed to make sure your strategy’s progress isn't lost, even if something unexpected happens.

The class keeps track of storage locations for each strategy, allowing you to customize how data is stored if needed. It ensures data is read and written safely, and handles crashes gracefully by protecting your signal state.

You can choose different ways to persist data – a default JSON format, a dummy adapter for testing that simply ignores writes, or even register your own custom adapters.  The `readSignalData` function retrieves previously saved signal information, while `writeSignalData` saves the current signal state. This is particularly helpful when restarting a strategy to pick up where it left off.

## Class PersistScheduleUtils

PersistScheduleUtils helps manage how scheduled trading signals are saved and loaded, especially when using ClientStrategy. It ensures that signal information is stored reliably even if there are unexpected interruptions.

The framework provides a way to customize how these signals are persisted, allowing you to plug in different storage mechanisms. It also handles the process of reading and writing these signals to disk safely, making sure that the data isn't corrupted.

The class offers a couple of convenient options for testing or debugging: you can use a default JSON storage or switch to a “dummy” adapter that effectively ignores any write attempts. This is useful for situations where you want to verify behavior without actually saving data. ClientStrategy relies on these utilities to keep track of scheduled signals.

## Class PersistRiskUtils

The PersistRiskUtils class helps manage and save the details of your active trading positions, especially when dealing with different risk profiles. It’s designed to ensure that your position data is stored reliably, even if something unexpected happens to the system.

Think of it as a safe keeper for your trading state, and it's used by the ClientRisk system to remember where things were left.

You can customize how this data is stored using different adapters, or easily switch back to a default JSON-based system. There's even a "dummy" adapter that lets you temporarily disable saving to disk, which is useful for testing. The class ensures changes are written to storage safely, so you won't lose your progress.




The `readPositionData` function retrieves existing position data, while `writePositionData` saves the current state of your positions.



It’s built to handle situations where the system might crash during a save, protecting your data from corruption.

## Class PersistPartialUtils

This class helps manage and save partial profit and loss information, crucial for keeping track of your trading progress even if the system restarts. It ensures that this data is stored reliably and consistently for each trading strategy and symbol combination. 

It utilizes a clever system to avoid repeatedly loading and saving the same data, and offers the flexibility to use different storage methods – whether it's the standard JSON format, a custom adapter you create, or even a “dummy” adapter that simply ignores any saving requests (useful for testing!). The data writes are handled carefully, ensuring that even if something goes wrong during the process, your data remains protected.

Here's a breakdown of what you can do with it:

*   **Store Data Securely:** It automatically handles saving partial profit/loss information to disk.
*   **Customization:** Easily swap out the storage method to suit your needs.
*   **Atomic Writes:**  The saving process is designed to be safe, minimizing the risk of data corruption.
*   **Restore State:**  It can retrieve previously saved data, bringing your trading back to where you left off.

## Class PersistCandleUtils

This utility class helps manage how candle data is stored and retrieved from a cache, ensuring efficient and reliable access. It organizes each candle as a separate JSON file, making it easy to locate and update specific data points. 

The system validates the cache to make sure it returns the correct amount of data and automatically updates when information is missing. It uses atomic operations when reading and writing data, preventing errors and ensuring data integrity.

You can customize how the data is persisted by registering different adapters or switch back to a dummy adapter for testing purposes, which effectively ignores any writes. The `readCandlesData` method retrieves the cached data, and `writeCandlesData` handles saving it to the cache.

## Class PersistBreakevenUtils

This utility class helps manage and store breakeven data, ensuring that your trading strategies remember their progress even when you restart. Think of it as a way to save and load the state of your strategies, so you don't lose any information.

It cleverly handles storing this data on disk, organizing it into files for each symbol and strategy you use. The system creates these files automatically if they don't already exist.

You can even customize how the data is stored, potentially using a different format or even disabling storage entirely for testing purposes. The class uses a technique called memoization, which means it creates and reuses storage instances efficiently, only creating new ones when needed. This makes sure you’re not wasting resources.

## Class PersistBase

PersistBase provides a foundational structure for saving and retrieving data to files, ensuring that the process is reliable and safe. It's designed to work with file-based storage and prevents data corruption by using atomic write operations. This means files are written completely, so you don't risk ending up with partially saved data.

The framework automatically checks for and cleans up any damaged files it finds and can efficiently iterate through all stored data. It also handles potential issues like file deletion by automatically retrying if needed. 

You specify the name of the data you're storing and the main directory where the files will reside when setting up the persistence.  The `waitForInit` method ensures the storage directory is properly set up and validates existing data upon initialization, only happening once.  Functions like `readValue` and `writeValue` handle reading and saving entities, while `hasValue` allows you to quickly check if a specific piece of data already exists. Finally, `keys` provides a way to loop through all stored entity IDs.

## Class PerformanceReportService

The PerformanceReportService helps you understand how your trading strategies are performing by tracking how long different parts take to run. It acts like a detective, monitoring all the timing events during strategy execution and saving this information to a database. This lets you pinpoint slow areas and optimize your code for better efficiency.

You can tell the service to start listening for these timing events, and it will automatically record them. Importantly, it makes sure you don't accidentally subscribe multiple times, which could cause problems. When you're done, you can easily tell the service to stop listening and clean up. The service relies on a logger to provide helpful debug messages and uses a special tracking mechanism to record each event with its duration and relevant details.

## Class PerformanceMarkdownService

The PerformanceMarkdownService helps you keep track of how your trading strategies are performing. It listens for performance data, gathers it separately for each strategy and trading combination, and then calculates useful statistics like averages and percentiles. 

You can request the collected data to see how a particular strategy is doing, or generate a nicely formatted markdown report to analyze its performance in detail. This report includes insights to help you identify potential bottlenecks. 

The service automatically saves these reports to your logs directory, making it easy to review past performance. You also have the option to clear out old performance data if needed, and the system prevents accidental duplicate subscriptions to performance events.

## Class Performance

The Performance class helps you understand how well your trading strategies are doing. It offers tools to collect and analyze performance data, identifying areas where your strategy might be slow or inefficient.

You can request performance statistics for specific trading symbols and strategies to see detailed breakdowns of how long different operations take, including averages, minimums, maximums, and volatility measures.  It also highlights potential outliers using percentile analysis.

To make understanding these metrics even easier, the Performance class can generate readable reports in Markdown format. These reports visually display operation timing distributions and present key performance statistics in a table, which can be customized with specific columns.

Finally, you can easily save these reports to your hard drive, and the system will automatically create the necessary directories if they don't already exist, making it simple to track and share your strategy's performance over time.

## Class PartialUtils

The `PartialUtils` class helps you analyze and report on the partial profit and loss data collected during trading. Think of it as a tool to understand how your strategies are performing in smaller increments, beyond just the final outcome.

It gives you access to statistics like the total number of profit and loss events.

You can also generate nicely formatted markdown reports, which include tables showing details of each profit or loss event, such as the symbol traded, the strategy used, the signal ID, position, level, price and timestamp. These reports provide a clear overview of your trading activity.

Finally, `PartialUtils` makes it easy to export these reports directly to files, named with the symbol and strategy, for later review or sharing. It handles creating the necessary folders automatically so you don't have to worry about file paths.

## Class PartialReportService

The PartialReportService helps you keep track of when your trades partially close, whether that's for a profit or a loss. It's designed to record these "partial exit" events—like when you sell off some of a position—so you can analyze how your strategies perform. 

Think of it as a logging system specifically for these partial closures. It listens for signals indicating a partial profit or loss and saves details like the price and level at which those partial exits occurred.

To make sure you're not accidentally recording the same event multiple times, it uses a mechanism to prevent multiple subscriptions. You can use the `subscribe` method to start listening for these events, and it will give you a function to call when you want to stop receiving them. If you want to stop the recording completely, you can use the `unsubscribe` method.

## Class PartialMarkdownService

The PartialMarkdownService helps you keep track of and report on smaller, incremental profits and losses during your backtesting or live trading. It listens for these profit and loss events and organizes them by the symbol (like AAPL or BTC) and the strategy you're using.

Think of it as a detailed logbook for your trading, automatically creating nicely formatted markdown tables that show exactly how much profit or loss you've experienced for each symbol and strategy. You can then easily save these reports to your computer.

It's designed to be flexible – you can generate reports for specific combinations of symbol, strategy, exchange, timeframe, and backtest settings, or you can clear all the data if you want to start fresh. The service makes sure that each symbol-strategy combination has its own separate storage, so your data stays neatly organized. It also offers options to customize the columns displayed in the reports.

## Class PartialGlobalService

PartialGlobalService acts as a central hub for managing partial profit and loss tracking within the backtest framework. Think of it as a gatekeeper, receiving requests related to partials and ensuring everything is logged appropriately before passing them on to the connection service. It’s injected into the core strategy, streamlining dependency management and providing a single place to monitor partial operations.

This service relies on several other services like validation and schema services for confirming the validity of strategy configurations and associated data.  You won’t directly interact with PartialGlobalService; instead, it works behind the scenes. The `profit`, `loss`, and `clear` methods handle the recording and processing of profit, loss, and signal closure events respectively.  Each of these methods first logs the action and then forwards the request to the `PartialConnectionService` to perform the actual work.

## Class PartialConnectionService

The PartialConnectionService is like a manager for keeping track of small bits of profit and loss for each trading signal. It’s designed to be efficient by remembering (memoizing) these individual tracking pieces, so it doesn't have to recreate them every time.

Think of it as a factory; it creates these little trackers – called ClientPartial – for each signal, ensuring each one has the right tools (logger and event handlers) to do its job. When a signal starts making a profit or taking a loss, this service steps in to record it and let others know. 

When a trade is finished, the PartialConnectionService cleans up those trackers, freeing up resources and preventing things from piling up unnecessarily. It works closely with other parts of the system, receiving information about trades and handling the details of tracking their progress.

## Class NotificationUtils

This utility class, `NotificationUtils`, makes it easy to manage and retrieve notifications within your application. It automatically sets up the necessary connections to receive notifications so you don't have to worry about the underlying setup. 

You can use `getData` to get a list of all notifications, displayed in the order they occurred (with the newest ones appearing first).  If you haven't already, this method will also make sure the system is actively listening for notifications.  The `clear` method allows you to remove all previously recorded notifications.  Similarly, it will subscribe to emitters if needed.

When you’re finished receiving notifications, both `enable` and `disable` provide a simple way to disconnect from the notification sources and clean up resources. They achieve the same result - unsubscribing from the systems sending notifications.

## Class MarkdownUtils

MarkdownUtils helps you control whether or not to generate markdown reports for different parts of backtest-kit, like backtesting, live trading, or performance analysis. Think of it as a central switchboard for markdown reporting.

You can use the `enable` function to turn on markdown reporting for specific areas. When you enable something, it starts collecting data and listening for events, and it's really important to remember to unsubscribe when you're done to avoid memory issues – the `enable` function will give you a way to do that easily.

The `disable` function lets you turn off markdown reporting for certain areas without affecting others. It immediately stops the reporting process for those services and cleans up resources.

## Class MarkdownFolderBase

This adapter, `MarkdownFolderBase`, is designed for creating well-organized, human-readable reports by saving each report as a separate markdown file. It’s the default choice for situations where you want easily navigable report directories.

Each report gets its own `.md` file, with the file's location determined by settings you provide, allowing for a clear file structure. The adapter automatically sets up any necessary directories, so you don’t have to worry about that. It's a straightforward process using direct file writing, avoiding complex stream management.

You initialize it with a key identifying the report type and then use the `dump` method to write the report content to a file. The `waitForInit` method is a simple placeholder, as this adapter doesn't actually require initialization.

## Class MarkdownFileBase

This component helps you generate markdown reports in a standardized, append-only JSONL format. It’s designed to streamline logging and make it easier to process your reports using JSONL tools.

Each report type gets its own file, organized in a predictable directory structure. The system handles creating those directories automatically and includes built-in safeguards to prevent write errors and timeouts, ensuring data integrity.

You can easily filter your reports later based on metadata like the trading symbol, strategy used, exchange, timeframe, or signal ID.

The `waitForInit` method safely sets up everything needed—creating the file and opening the write stream—and can be called repeatedly without issues. The `dump` method is how you actually write the markdown content along with its associated metadata to the file.

## Class MarkdownAdapter

The MarkdownAdapter acts as a flexible middleman for storing your markdown data, letting you choose how that data is actually saved. It provides a simple way to switch between different storage methods, like saving each markdown file as a separate document or appending them all to a single JSONL file.  The system remembers the storage instances it creates, making sure you don't end up with multiple copies of the same data. 

You can easily change the default storage method using `useMarkdownAdapter`, and handy shortcuts like `useMd` and `useJsonl` let you quickly switch to the folder-based or JSONL approaches. If you just want to test something without actually saving anything, you can use the `useDummy` adapter which effectively ignores all write attempts.  The adapter automatically handles setting up the storage the first time you write data, and it uses the `MarkdownFactory` to create storage instances.

## Class LoggerService

The `LoggerService` helps ensure consistent logging across your backtesting framework by automatically adding important details to your log messages. It's designed to work with a logger you provide, or it can fall back to a basic "no-op" logger if you don't configure one.

It automatically includes information about which strategy, exchange, and frame are being used, as well as details like the symbol, timestamp, and whether it's a backtest. You can customize the logging behavior by setting your own logger implementation using the `setLogger` method. 

The service uses `methodContextService` and `executionContextService` internally to manage and inject this contextual information into log messages. There are specific methods for different log levels like `log`, `debug`, `info`, and `warn`, all of which benefit from this automatic context addition.

## Class LiveUtils

This class helps manage live trading operations, providing a simplified way to run and interact with trading strategies. It acts like a central hub for your live trading, handling things like crash recovery and real-time monitoring.

It's designed to be easy to use, almost like a helper you can always rely on. 

Here's a breakdown of what you can do with it:

*   **Run Trading:** You can start live trading for a specific symbol and strategy, and it automatically saves progress so you don’t lose data if something goes wrong. It keeps running indefinitely.
*   **Background Execution:** There's a way to run trading in the background if you only need it to trigger other actions without directly watching the results.
*   **Signal Management:** You can check what signals are currently active or scheduled.
*   **Breakeven Checks:** It can tell you if the price has moved far enough to cover transaction costs, which is useful for risk management.
*   **Control Strategies:** You can stop a strategy from opening new trades or cancel scheduled signals without interrupting ongoing operations.
*   **Modify Positions:** It provides functions to adjust profit targets, stop-losses, and trailing stops for active trades.
*   **Reporting & Data:** Get statistics and detailed reports on how your strategies are performing. You can even save these reports to a file.
*   **Listing Instances:** See a list of all active live trading sessions.

Essentially, it streamlines the entire live trading process, making it more reliable and easier to manage.

## Class LiveReportService

The LiveReportService helps you keep an eye on your trading strategy as it's actually running. It listens for events from your strategy, like when it’s waiting, opening a position, actively trading, or closing one. 

Essentially, it's designed to record every tick event – the complete signal details – and save them to a database so you can monitor performance and analyze what’s happening in real-time.

It uses a system to make sure you only subscribe to the live signal once, preventing any issues from multiple connections. You’ll get a function back when you subscribe which lets you stop listening at any time. If you've already unsubscribed, calling unsubscribe again won't cause any problems. It also has a logger to help with debugging.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create and save reports of your live trading activity. It keeps track of everything that happens during your trades—from idle periods to when positions are opened, active, and closed—for each strategy you're using.

It generates nicely formatted markdown tables that detail these events and provides key trading statistics like win rate and average profit/loss. These reports are saved to your logs folder, making it easy to review your performance.

To use it, the service connects to your trading system to receive updates and requires a subscription to receive those updates. You can also retrieve data, generate reports, save them to disk, or clear the stored data as needed. It organizes data based on the symbol, strategy, exchange, timeframe, and whether it's a backtest, ensuring that each combination has its own independent storage.

## Class LiveLogicPublicService

This service helps you run live trading strategies smoothly. It handles the complexities of managing context, like knowing which strategy and exchange you're working with, so you don't have to constantly pass that information around.

Think of it as a central hub that orchestrates the trading process, continuously generating signals – opening, closing, or canceling trades – in an ongoing stream. 

It's designed to be robust, meaning that if something goes wrong, your progress is saved and can be recovered, preventing lost data or restarts from scratch. The system keeps track of time using the current date and time, ensuring accurate real-time updates during trading. You simply tell it which symbol to trade and provide a context, and it takes care of the rest.


## Class LiveLogicPrivateService

This service manages the ongoing process of live trading, focusing on keeping things running smoothly and efficiently. It continuously monitors the market, checking for trading signals in an endless loop. The service uses an asynchronous generator to stream trading results – specifically, it sends you updates only when a trade is opened or closed, avoiding unnecessary data.

If something goes wrong and the process crashes, it automatically recovers, ensuring minimal interruption to trading activity. The whole system is designed to be memory-friendly by streaming data and constantly updating with real-time information. The `run` method lets you initiate the live trading process for a specific symbol.

## Class LiveCommandService

This service acts as a central hub for live trading operations within the backtest-kit framework. Think of it as a simplified interface to access the core live trading logic, making it easy to integrate into your applications. It handles the complexities behind the scenes, ensuring a smooth and reliable trading experience.

The service relies on several other components like validation services and a schema service to make sure everything is working correctly. 

The `run` function is the most important part – it's what actually starts the live trading process. You give it the trading symbol and information about your strategy and exchange, and it will continuously generate results, even if things go wrong and the system needs to recover. It's designed to run indefinitely, constantly providing updates on how your strategy is performing in real-time.

## Class HeatUtils

HeatUtils helps you visualize and analyze your trading strategy's performance using heatmaps. Think of it as a convenient tool to understand how different symbols contribute to your overall results. It gathers data from closed trades within a strategy, automatically calculating key statistics like total profit, Sharpe Ratio, and maximum drawdown for each symbol.

You can easily retrieve this aggregated data using the `getData` method, allowing you to programmatically access the performance breakdown. 

Want a nicely formatted report? The `getReport` method generates a markdown table summarizing symbol performance, sorted by profitability. Finally, the `dump` method lets you save these reports directly to your disk as markdown files, making it easy to share and archive your results. It’s designed to be straightforward to use, always available as a single instance.

## Class HeatReportService

The HeatReportService is designed to help you understand how your trading strategies are performing by tracking closed signal events. It essentially listens for when signals are closed – when a trade is finished – and records this information along with the profit and loss (PNL) data. 

This service gathers data from all the symbols you're trading, providing a portfolio-wide view to identify patterns in your trading. The collected data is then stored, ready for generating heatmaps that can visualize your trading activity and performance trends.

To ensure you're not accidentally overloading the system, it prevents multiple subscriptions to the signal events. You can subscribe to receive these events, and it will give you a way to stop listening when you no longer need it. Similarly, it provides a simple unsubscribe function to stop processing events.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and understand how your trading strategies are performing across different assets and timeframes. It watches for completed trades and gathers key metrics like total profit/loss, Sharpe Ratio, and maximum drawdown for each symbol and overall portfolio. 

It organizes this data in a way that's easy to navigate and provides a nicely formatted Markdown report summarizing your strategy's performance. The service ensures accurate calculations, even when dealing with potentially problematic data like infinity or undefined values. 

You can subscribe to receive updates as new trades happen, and there's a way to clear the collected data when you want to start fresh. The service efficiently manages its data storage, so each strategy, exchange, and timeframe combination has its own dedicated space. You can also easily save the generated reports directly to files on your computer.

## Class FrameValidationService

This service helps you keep track of your trading timeframes and make sure they're set up correctly before you start backtesting. Think of it as a central place to register all your different timeframe configurations, like daily, hourly, or weekly data. 

It keeps a record of all the timeframes you've defined and checks to see if a timeframe actually exists before you try to use it in your backtesting process. To improve speed, it remembers the results of previous validations so it doesn’t have to repeat the checks. 

You can use it to add new timeframes, confirm that a timeframe is valid, or simply get a list of all the timeframes you’ve currently registered. This ensures your backtests are running with the intended timeframes and helps prevent errors.


## Class FrameSchemaService

This service helps keep track of different trading strategy blueprints, or "frames," ensuring they're all structured correctly. It uses a special system to store these blueprints in a type-safe way, preventing errors caused by mismatched data.

You can think of it as a central place to add, update, and retrieve these strategy blueprints. The `register` method adds a new blueprint, `override` lets you make changes to an existing one, and `get` retrieves a blueprint you need. Before a blueprint is added, it's checked to make sure it has all the necessary parts and that those parts are of the right type, this is called `validateShallow`.


## Class FrameCoreService

This service, `FrameCoreService`, is a central hub for managing timeframes within the backtesting framework. It handles the creation of timeframe sequences needed to run backtests. Think of it as the engine that provides the chronological data points for your trading strategies to analyze.

It relies on other services—`FrameConnectionService` to fetch the data and `FrameValidationService` to ensure its correctness. You generally won't interact with it directly, as it’s primarily used by the backtest logic itself.

The `getTimeframe` function is its core offering. It takes a symbol (like "AAPL") and a specific timeframe name (like "1h" for one-hour intervals) and returns an array of dates representing that timeframe. This array is then used to iterate through the historical data during a backtest.


## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing different trading frames within the backtest kit. It intelligently routes requests to the correct frame implementation based on the current context, ensuring that operations are performed on the appropriate timeframe. 

To improve performance, it cleverly caches these frame instances, so it doesn't need to recreate them every time. The service also handles backtest timeframe management, allowing you to specify the start and end dates for your simulations. 

When running in live mode, there are no frame constraints, and the `frameName` will be empty. You can obtain a cached frame using `getFrame` and retrieve the timeframe boundaries for a specific symbol using `getTimeframe`.

## Class ExchangeValidationService

This service acts like a central hub for keeping track of all your configured exchanges. It’s responsible for making sure those exchanges actually exist before you try to use them, preventing potential errors.  You can use it to register new exchanges, check if an exchange is valid, or get a full list of all exchanges you've registered.  The system remembers validation results to work faster, so repeated checks don’t slow things down. Think of it as a quality control system for your trading environment. 

You can add exchanges using `addExchange`, verify their validity with `validate`, and see a full list of registered exchanges using `list`.

## Class ExchangeUtils

ExchangeUtils is a handy helper class designed to simplify interactions with different cryptocurrency exchanges. Think of it as a central point for common tasks like getting historical price data, calculating average prices, and formatting trade quantities and prices to match each exchange's specific rules. It’s set up as a single, readily available instance, so you don't have to worry about creating new objects each time you need it.

The class provides methods for retrieving candles (price charts), calculating volume-weighted average prices (VWAP), and ensuring that trade sizes and prices are formatted correctly for each exchange. You can also request order book information, which shows the current buy and sell orders at different price levels.  

When fetching historical data, it automatically adjusts the time period based on the interval and amount of data you're requesting, and it's designed to work consistently with how the system previously handled data.  It's also possible to directly request raw candle data and specify a custom start and end date.

## Class ExchangeSchemaService

The ExchangeSchemaService helps keep track of information about different cryptocurrency exchanges, ensuring consistency and accuracy. It acts as a central place to store and manage these exchange details. 

You can add new exchange schemas using the `addExchange()` function, and later retrieve them by their name using `get()`. Before a new exchange schema is added, `validateShallow()` checks it to make sure it has all the necessary pieces in place.

If you need to update an existing exchange schema, the `override()` function lets you modify specific parts of it, while keeping the rest unchanged. The service relies on a logging system (`loggerService`) to keep things running smoothly and uses a special type-safe storage system (`_registry`) to organize all the exchange data.

## Class ExchangeCoreService

ExchangeCoreService acts as a central hub for interacting with exchanges within the backtest framework. It combines connection management with the ability to inject specific information – like the trading symbol, the time period, and whether it's a backtest or live trade – into the exchange operations. This service handles tasks like fetching historical candle data, calculating average prices, and formatting price and quantity values, all while keeping track of execution context.

The service includes built-in validation to ensure exchange configurations are correct and efficient, preventing unnecessary repeated checks. It provides methods to retrieve candles, including the ability to fetch future data specifically for backtesting purposes.  You can also request order book data.  Finally, `getRawCandles` gives more control over date ranges and the number of candles retrieved.

## Class ExchangeConnectionService

The `ExchangeConnectionService` acts as a central hub for interacting with different cryptocurrency exchanges within the backtest-kit framework. It intelligently routes your requests to the correct exchange based on your current trading context, making it easy to switch between exchanges without modifying your code.

Think of it as a smart dispatcher. It automatically creates and remembers connections to each exchange, improving performance by avoiding unnecessary re-establishment of those connections.

You can use it to retrieve historical candle data, get the latest average price, format prices and quantities to match exchange rules, and fetch order book information. It provides methods for fetching both regular and raw candles, allowing for more flexibility in data retrieval, especially when dealing with specific historical data ranges. The service handles the complexities of communicating with each exchange and ensures the data you receive is formatted correctly.

## Class ConstantUtils

The `ConstantUtils` class provides pre-calculated percentages designed to manage take profit and stop loss levels, drawing inspiration from the Kelly Criterion and incorporating a risk decay model. These constants help automate how much of a trade you’ll exit at different points as the price moves toward your initial target.

Think of it like this: if you're aiming for a 10% profit, `TP_LEVEL1` will trigger a partial exit when the price hits 3% profit, `TP_LEVEL2` at 6%, and `TP_LEVEL3` at 9%. Similarly, for stop losses, `SL_LEVEL1` acts as an early warning at 40% of the loss distance, while `SL_LEVEL2` ensures you exit the remaining position before a larger loss occurs.

The class offers these pre-defined levels – `TP_LEVEL1`, `TP_LEVEL2`, `TP_LEVEL3`, `SL_LEVEL1`, and `SL_LEVEL2` – as constants that you can directly use in your trading strategies, simplifying the process of implementing these risk management techniques.

## Class ConfigValidationService

The ConfigValidationService acts as a safeguard for your backtesting setup, making sure your trading configurations are mathematically sound and likely to be profitable. It’s designed to catch potential errors *before* you start running simulations.

Essentially, it performs a series of checks to ensure your settings make sense. These checks include verifying that percentages like slippage and fees are non-negative, and that your take profit distance is large enough to cover all transaction costs. It also confirms that time-related values are positive integers and that ranges of values (like stop-loss distances) are properly defined. 

Think of it as a preventative measure to avoid unexpected and unprofitable results during backtesting. It helps maintain the integrity of your trading framework by validating key parameters.

## Class ColumnValidationService

The ColumnValidationService helps keep your column configurations clean and reliable. It acts as a safeguard, ensuring each column definition follows a strict set of rules to avoid problems later on. 

Think of it as a quality control check for your column data. It verifies that essential properties like 'key', 'label', 'format', and 'isVisible' are always present. 

It also makes sure that the 'key' and 'label' values are strings and aren’t blank, and that the 'format' and 'isVisible' properties are functions that can actually be used. To top it off, it guarantees that each 'key' is unique, preventing conflicts and ensuring data integrity within your column collections. The `validate` method performs all these checks.

## Class ClientSizing

This component, ClientSizing, figures out how much of an asset your trading strategy should buy or sell. It’s a flexible system allowing you to use different sizing approaches, like fixed percentages, Kelly Criterion, or Average True Range (ATR). 

You can set limits on position sizes, ensuring you don’t risk too much capital on any single trade.  It also allows you to add custom validation checks and log information during the sizing process. Essentially, ClientSizing takes inputs like your account balance, risk tolerance, and market volatility to determine the appropriate position size for each trade, guided by the settings you provide. The `calculate` method is the core – it's what actually does the sizing calculation.

## Class ClientRisk

ClientRisk helps manage risk for your trading strategies by making sure they don’t exceed pre-defined limits. Think of it as a safety net preventing strategies from taking on too much risk simultaneously. It keeps track of all open positions across different strategies, so you can enforce rules that consider the overall portfolio.

The system uses a central `_activePositions` map to monitor what’s happening, and it initializes this data once during setup, skipping that step when running backtests. This helps avoid any persistence issues during simulations.

`checkSignal` is the key method – it assesses each potential trade to ensure it aligns with your risk guidelines. It handles custom risk checks and immediately stops processing if any validation fails.  You can define your own rules here, accessing details of the signal and the current positions.

New trades are registered through `addSignal`, and closed trades are removed with `removeSignal`, so ClientRisk always has an up-to-date view of the portfolio’s risk exposure.

## Class ClientFrame

The ClientFrame helps create the timelines your backtesting strategies use. It's designed to efficiently generate arrays of timestamps representing the historical periods your strategies will analyze. To avoid unnecessary work, it cleverly caches these timelines, so it doesn't recreate them unless needed.

You can customize how far apart these timestamps are, choosing intervals from one minute all the way up to three days. It also allows for callbacks, letting you add extra checks or log information during the timeline generation process. The ClientFrame works closely with the backtesting engine to power its historical analysis.

The `getTimeframe` property is the main way to get these timelines; it takes a symbol (like a stock ticker) and returns a promise that resolves to an array of dates.  This function remembers its results to make subsequent requests faster.

## Class ClientExchange

This `ClientExchange` component provides a way to interact with an exchange to retrieve data, specifically designed for backtesting and trading. It handles fetching historical and future candles, crucial for simulating trading strategies.

You can retrieve past price data using `getCandles`, and look ahead to get future data with `getNextCandles`, vital for evaluating strategy performance. The framework even calculates a Volume Weighted Average Price (VWAP) using recent candles with `getAveragePrice`, useful for understanding price trends.

The `formatQuantity` and `formatPrice` methods ensure that trade sizes and prices are displayed correctly according to the exchange’s specific rules.

The `getRawCandles` function provides extensive flexibility in retrieving candle data, allowing you to specify start and end dates and limits, all while respecting backtesting constraints to avoid look-ahead bias.  Finally, `getOrderBook` pulls order book data, essential for understanding market liquidity.

It’s designed for efficiency by using prototype functions and incorporates various checks to prevent common backtesting errors, like using future data.

## Class ClientAction

ClientAction helps manage and run your custom action handlers, which are the pieces of code that perform actions like logging, sending notifications, and managing your trading state. Think of it as a central coordinator that sets up your handler, routes events to it, and makes sure everything cleans up properly when it’s done.

It initializes your action handler only once, ensuring resources aren't wasted, and provides specific methods for different types of events, such as signals from live trading, backtesting, or when certain profit or loss milestones are hit.  These methods (like `signal`, `breakevenAvailable`, `partialProfitAvailable`) let your handlers react to different trading scenarios.  Finally, it handles disposal, making sure to release resources when the handler is no longer needed, again ensuring clean and efficient operation.

## Class CacheUtils

CacheUtils helps you speed up your backtesting by automatically caching the results of your functions. Think of it as a way to avoid recalculating things you've already figured out, like indicator values or order execution details. 

It’s designed to be easy to use; you simply wrap your functions with the `fn` property, and it takes care of the caching based on the timeframe you’re using.  The caching is specific to each function, so changes to one function's cache won't affect others.

If you need to force a recalculation, `clear()` removes the cached value only for the current test scenario (strategy, exchange, backtest mode).  Or, if you really want to clean things up, `flush()` lets you completely remove the cache for a function – useful when you’ve made changes to the function itself or when you want to free up memory. It's a singleton, meaning there's only one instance of it to manage all your caching.

## Class BreakevenUtils

The BreakevenUtils class helps you analyze and report on breakeven events within your backtesting or live trading environment. Think of it as a tool to understand how often your strategies hit breakeven points and generate reports about them.

It gathers data from breakeven events – including details like the symbol traded, the strategy used, the signal ID, the entry price, and the current price – and stores them temporarily. You can then request statistical summaries of these events, like the total number of times breakeven was reached.

Want a detailed report? It can create a nicely formatted Markdown document, complete with a table of all breakeven events and some summary numbers.  This report can also be easily saved to a file, named according to the symbol and strategy, for later review. The class handles the file creation and saving for you, making it simple to keep track of your breakeven performance.


## Class BreakevenReportService

The BreakevenReportService helps you keep track of when your trading signals hit their breakeven point. It's designed to listen for these "breakeven" moments and record them in a database – specifically, SQLite – so you can analyze your strategies later. 

Essentially, it watches for events indicating a signal has reached breakeven, and saves all the important details about that signal, like its characteristics, for future review. It uses a special mechanism to ensure it only records these events once, even if multiple parts of your system are monitoring them.

To use it, you’ll subscribe to receive these breakeven notifications, and when you’re done, you can unsubscribe to stop the recording. The service also has a logger to help you see what's happening behind the scenes.

## Class BreakevenMarkdownService

The BreakevenMarkdownService is designed to automatically create and save reports detailing breakeven events for your trading strategies. It listens for these breakeven signals and keeps track of them, organizing them by the symbol and strategy being used. These events are then compiled into easy-to-read markdown tables, complete with statistics summarizing the total number of breakeven occurrences.

You can subscribe to receive these events, and the service will handle the accumulation and report generation. The reports themselves are saved as markdown files, neatly organized in a directory structure.  There are methods to retrieve the accumulated data, generate full reports, save the reports to disk, and even clear the stored data – either for a specific trading setup or everything at once. Think of it as an automated record-keeping tool for monitoring and understanding your strategies' breakeven points.

## Class BreakevenGlobalService

The BreakevenGlobalService acts as a central hub for managing breakeven calculations within the trading system. It simplifies things by providing a single place to inject breakeven functionality into your trading strategies, making your code cleaner and easier to maintain.  Think of it as a middleman – it logs all breakeven-related actions and then passes those requests on to another service that handles the actual calculations.

This service is designed to keep track of when breakeven points are reached and to reset them when trades close. It validates the strategy and related configurations before proceeding, to ensure everything is set up correctly.  The `check` function determines if a breakeven event should happen, while `clear` handles resetting the breakeven state when a signal closes.  The system caches validation results to avoid unnecessary checks, improving performance. The service relies on other validation and configuration services to ensure the trading process is secure and reliable.

## Class BreakevenConnectionService

The BreakevenConnectionService is a helper that keeps track of when a trade might have reached its breakeven point. It's designed to create and manage specific tracking objects – called ClientBreakeven – for each trading signal. Think of it as a system that ensures you don’t have too many of these tracking objects and cleans them up when they're no longer needed.

It uses a technique called memoization to store these ClientBreakeven objects, so it doesn't have to recreate them every time. This makes things more efficient.

The service is given tools to log information and notify other parts of the system when breakeven events happen.

It's integrated into the overall trading strategy, and its main jobs include checking if breakeven conditions are met, cleaning up the tracking when a signal is closed, and efficiently managing the client objects responsible for the tracking.

## Class BacktestUtils

This class provides helpful tools for running and managing backtest simulations. It acts as a central point for interacting with the backtesting engine, simplifying common tasks.

The `run` method is your go-to for initiating a backtest, automatically handling logging and context information. If you just want to run a backtest in the background for tasks like logging or callbacks without needing the results immediately, use the `background` method.

Need to peek at what signals the strategy is expecting or has scheduled? `getPendingSignal` and `getScheduledSignal` give you a look.  You can also check if a pending signal has reached its breakeven point using `getBreakeven`.

For more granular control, there are methods to stop (`stop`), cancel scheduled signals (`commitCancelScheduled`), or close pending signals (`commitClosePending`) without completely halting the backtest.  You can also manually adjust aspects of the trade like partial profit/loss (`commitPartialProfit`, `commitPartialLoss`), or fine-tune trailing stop-loss and take-profit orders (`commitTrailingStop`, `commitTrailingTake`).  It's important to note that trailing stop/take adjustments are calculated based on the *original* stop/take levels to avoid accumulating errors. Finally, `commitBreakeven` allows automatically moving the stop-loss to the entry price once a certain profit threshold is reached.

You can retrieve backtest statistics using `getData` or generate a formatted report with `getReport` and `dump`.  Lastly, `list` provides an overview of all currently running backtest instances and their states.  This class is designed as a single instance, making it readily available throughout your backtesting workflow.

## Class BacktestReportService

The `BacktestReportService` helps you keep a detailed record of what's happening during your backtesting runs. Think of it as a meticulous observer, noting every signal event – when a strategy is idle, when it opens a position, when it’s actively trading, and when it closes. 

It listens for these events and diligently saves them to a database, providing a valuable log for later analysis and debugging. This service prevents you from accidentally subscribing multiple times, ensuring efficiency. 

You can subscribe to receive these events and then unsubscribe when you’re done, giving you control over the data collection process. This logging service is essential for understanding and improving your trading strategies.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create detailed reports about your trading backtests. It works by listening to trading signals as they happen and keeping track of how those signals perform. 

Essentially, it accumulates information about closed trades for each strategy you're testing. Then, it neatly organizes that data into Markdown tables, allowing you to easily review and analyze your backtest results.

You can generate reports that include specific data points, and these reports are saved as files on your system, making it simple to share or archive your backtest findings. The service also offers ways to clear out old data or stop receiving signals if you need to. It ensures each backtest run (based on symbol, strategy, exchange, timeframe) has its own isolated data storage.

## Class BacktestLogicPublicService

BacktestLogicPublicService is designed to make running backtests easier and more organized. It essentially acts as a middleman, working with the core backtesting logic while automatically handling important information like the strategy name, exchange, and data frame used.  You don't need to repeatedly pass this context data around – it’s managed for you. 

The `run` method is the primary way to start a backtest; it takes a symbol (like "AAPL") and an optional context object (though the context is often implicit thanks to this service). The method returns results as a stream of data, allowing you to process them incrementally. Think of it as a convenient way to kick off and monitor a backtest without getting bogged down in manual context management.


## Class BacktestLogicPrivateService

The `BacktestLogicPrivateService` helps manage and run backtests efficiently, especially when dealing with lots of data. It works by getting a sequence of time periods, and for each period, it checks for trading signals. When a signal tells the system to start a trade, it pulls in the necessary price data and runs the backtesting logic.

Instead of storing all the results in memory, it sends them back to you one at a time as a stream – this is really useful for large backtests. You can also stop the backtest early if you want.

The service relies on other components like a logger, a strategy core, exchange core, frame core, and method context service to function correctly.  Its main feature is the `run` method which initiates the backtest process and provides a stream of backtest results for a specific symbol.

## Class BacktestCommandService

This service acts as the main entry point for running backtests within the backtest-kit framework. Think of it as a central hub that coordinates all the necessary components to execute a backtest. It’s designed to be easily integrated into your application using dependency injection.

Inside, it relies on several other services to handle things like validating your trading strategy, checking for potential risks, and ensuring everything is set up correctly with the exchange and data frames you're using.

The `run` method is the core function you’ll use; it tells the system to start a backtest for a specific trading symbol, providing details like the name of your strategy, the exchange, and the data frame to use.  It returns a series of results as the backtest progresses, allowing you to monitor and analyze the performance in real-time.

## Class ActionValidationService

This service acts as a central place to keep track of your action handlers and make sure they're set up correctly. Think of it as a librarian for your actions – it registers them, checks if they're available, and remembers its findings to speed things up. You can use it to add new action configurations, verify that an action exists before your code tries to use it, and get a complete list of all the actions you've registered. The service even uses caching to avoid unnecessary checks, making it efficient.

## Class ActionSchemaService

The ActionSchemaService helps you organize and manage the blueprints for your trading actions. It's like a central library where you define how each action should behave, ensuring everything is type-safe and follows the rules.

It keeps track of your action schemas, checking to make sure they're properly structured and only use allowed methods. You can register new action schemas, update existing ones with just the changes you need, and easily retrieve them when required.

Think of it as a guardian, ensuring that your action handlers are consistent and working correctly. The service uses a special type-safe storage system, and it will even flag issues if your handlers try to use methods they shouldn't. Private methods are supported, and you have the flexibility to override existing schemas to make modifications.

## Class ActionProxy

The `ActionProxy` acts as a safety net when using custom action handlers within the backtest-kit framework. It essentially wraps your custom code to prevent errors in your logic from bringing the entire trading system down. If your action handler encounters a problem, the `ActionProxy` will log the error and gracefully continue execution, returning a null value instead of crashing.

Think of it as a universal error handler for your action methods, ensuring a more robust and reliable backtesting and live trading experience. It uses a factory method (`fromInstance`) to create instances, ensuring consistent error handling across all methods like `init`, `signal`, `signalLive`, `signalBacktest`, and others that deal with events like breakeven, partial profit/loss, scheduled pings, risk rejections, and cleanup. It's designed to handle scenarios where your action handler might not implement all required methods, providing a fallback and preventing unexpected behavior. This class is used internally by the framework to safely execute your custom actions.

## Class ActionCoreService

The ActionCoreService acts as a central hub for handling actions within your trading strategies. It essentially takes action lists defined in your strategy configurations and makes sure each action gets the signals it needs to operate.

Think of it as a dispatcher; it gets instructions (events like new ticks, breakeven points, or scheduled pings) and sends them to the appropriate actions registered for a specific strategy, exchange, and frame. It also validates everything to make sure things are set up correctly.

Here's a breakdown of what it does:

*   **Initialization:** Sets up all the individual actions for a strategy, loading any necessary persisted data.
*   **Signal Routing:**  Directs different signal events (live, backtest, scheduled pings) to the actions.
*   **Validation:** Checks that the strategy, exchange, frame, risks, and actions are all valid before anything happens. This check is performed once and reused whenever possible.
*   **Event Handling:**  Handles special events like breakeven, partial profit/loss, and risk rejections, routing them to the corresponding actions.
*   **Cleanup:**  Properly disposes of actions when a strategy is finished.
*   **Data Clearing:** Provides a way to clear out action data, either for a specific action or for all actions.

It heavily relies on other services like action connection, validation, and schema services to perform its tasks, making it a crucial piece of the backtesting and live trading process.

## Class ActionConnectionService

The ActionConnectionService acts like a central dispatcher for different actions within your trading framework. It figures out which specific action handler should be used for a given task, based on things like the action's name, the strategy and exchange involved, and whether you're in backtest mode. 

To optimize performance, it remembers (caches) frequently used action handlers, so it doesn't have to recreate them every time. This caching is specific to each strategy and frame combination, ensuring actions are isolated properly.

It offers several methods – `signal`, `signalLive`, `signalBacktest`, and others like `breakevenAvailable` and `dispose` – that route different types of events to the appropriate action handler. These methods all pass information like the event data, backtest status, and strategy details to make sure the right action is triggered.  You can also clear the cache if needed, which is helpful for cleanup or when re-initializing a strategy.

## Class ActionBase

This base class, `ActionBase`, is designed to simplify creating custom handlers for your backtest kit strategies. Think of it as a starting point for extensions that manage things like state, notifications, logging, and custom logic. It handles a lot of the boilerplate, including automatic logging, so you don't have to implement every event method if you don't need it.

When you extend `ActionBase`, you'll receive information about your strategy (`strategyName`, `frameName`, `actionName`) and whether the code is running in a backtest mode. The lifecycle involves initialization (`init`), handling events like signals, breakeven, partial profits/losses, and finally cleanup (`dispose`). 

Specific events like `signal`, `signalLive`, `signalBacktest`, `breakevenAvailable`, `partialProfitAvailable`, `partialLossAvailable`, `pingScheduled`, `pingActive`, and `riskRejection` are triggered during execution, allowing you to respond to different situations in either live or backtest environments.  You can override the default logging behaviors of these methods to customize how your actions interact with the backtest framework. The `dispose` method is essential for cleaning up resources when a strategy is finished, ensuring a clean and reliable backtesting process.
