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

This service helps you keep track of and confirm your "walkers" – think of them as sets of instructions for exploring different parameter combinations in your trading strategies. It acts as a central place to register these walkers, ensuring they're available when you need them.

The service keeps a record of all your walkers and verifies they exist before you try to use them.  To speed things up, it remembers the results of these checks so it doesn't have to repeat them unnecessarily.

You can use this to register new walkers using `addWalker`, check if a walker exists with `validate`, and see a list of all registered walkers with `list`. It's designed to make managing your parameter sweeps much easier and more reliable.

## Class WalkerUtils

WalkerUtils provides a way to easily manage and run comparisons within your backtest kit framework. Think of it as a helper class that simplifies working with "walkers," which are essentially sets of strategies tested together.

It handles the behind-the-scenes details of running these comparisons, automatically figuring out the necessary information from the walker's setup.  You can run comparisons, run them in the background without needing to see all the progress updates (useful if you just want to log results or trigger actions), and even stop comparisons gracefully. 

There’s also a way to retrieve complete results, generate reports in Markdown format, and save those reports to a file. Finally, you can get a list of all the walkers that are currently running and their status.  The class is designed to be used easily, acting as a single, readily available resource for managing your walker operations.

## Class WalkerSchemaService

This service helps you keep track of different "walker" schemas – think of them as blueprints for how your system works. It uses a secure way to store these blueprints, ensuring everything is typed correctly and consistently. 

You can add new walker schemas using `addWalker()` and find them again later by their name. 

Before a new schema is added, it's checked to make sure it has all the necessary parts. If you need to update an existing schema, you can use the `override` function to make changes. Finally, the `get` function lets you easily retrieve a schema when you need it.

## Class WalkerReportService

The WalkerReportService helps you keep track of how your trading strategies are performing during optimization runs. It listens for updates from the optimization process and neatly stores the results in a database, allowing you to compare different strategy configurations and see which parameters are working best. 

Think of it as a record-keeper for your strategy experiments.

The service uses a logger to provide debug information and a `tick` property that handles the actual logging to the database. To start tracking optimization progress, you'll use the `subscribe` method; this gives you a way to stop listening later with an automatically returned function. The `unsubscribe` method provides a clean way to stop the reporting process when you're done. It’s designed to prevent accidental duplicate subscriptions, so you don't have to worry about overwhelming your database.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you automatically generate and save reports about your backtesting strategies. It listens for updates from your backtesting process, tracking how different strategies perform. It organizes this information, creating clear markdown tables that compare strategies side-by-side.

Essentially, it gathers the results of your strategy tests and turns them into easy-to-read reports saved in a designated folder.

Here’s a bit more detail on what it does:

*   **Keeps track of results:** It remembers the results for each strategy being tested, ensuring data is properly organized.
*   **Generates comparison reports:** It creates markdown tables to show how different strategies stack up against each other.
*   **Automatic Saving:**  It saves these reports directly to your disk, making it easy to review and share your backtesting findings.
*   **Selective Clearing:** You can clear the accumulated data for specific strategies or for all of them, allowing you to start fresh when needed.
*   **Subscription Management:** It provides a safe way to listen for updates during the backtesting process, and easily stop listening when you’re done.

## Class WalkerLogicPublicService

This service helps coordinate and manage the execution of "walkers," which are components that perform backtesting and analysis of trading strategies. It acts as a public interface on top of a more private service, automatically passing along important information like the strategy name, exchange, frame, and walker name.

Think of it as a conductor orchestrating different parts of your backtesting process. The `run` method is the main way to use it, allowing you to specify a symbol and some context, and it will execute the necessary backtests across all strategies, ensuring everything is properly linked and tracked. You don't need to manually manage those contextual details – this service handles that for you. It relies on internal services for logic and schema management, and also uses a logger for tracking activity.

## Class WalkerLogicPrivateService

This service helps you compare different trading strategies against each other, like a race to see which one performs best. It manages the entire process of running each strategy and keeps you informed along the way with progress updates.

As each strategy finishes, you’ll get a report of its performance, and the service keeps track of the best result seen so far.  At the end, you’ll receive a complete ranking of all the strategies you tested. 

Essentially, it takes a symbol, a list of strategies you want to compare, a metric to measure performance, and some context (like the exchange and timeframe) and handles everything else. It utilizes other services to handle the individual backtest executions and formatting the results.

## Class WalkerCommandService

WalkerCommandService acts as a central point for interacting with the walker functionality within the backtest-kit framework. Think of it as a convenient layer on top of the core walker logic, making it easier to manage dependencies. It bundles together several services responsible for different aspects of walker operation, like validation and schema management. 

The `run` method is the key feature – it allows you to initiate a comparison of walkers for a specific trading symbol, passing along information about the walker, exchange, and frame involved to ensure the process is properly configured. It returns a stream of data representing the results of this comparison. This service provides a straightforward way to incorporate walker functionality into your applications.

## Class StrategyValidationService

This service helps you keep track of your trading strategies and make sure they're set up correctly. Think of it as a central place to manage your strategies, ensuring they exist and all the pieces – like risk profiles and actions – are valid before you start trading.

You can add new strategies using `addStrategy`, and this service will remember them. When you need to check if a strategy is ready to go, `validate` does a thorough check. If you just need a quick look at all your registered strategies, `list` provides a simple overview. It's designed to be efficient, remembering validation results to avoid unnecessary checks.

## Class StrategySchemaService

The StrategySchemaService acts as a central place to store and manage the blueprints, or schemas, for your trading strategies. It uses a system to ensure these schemas are stored correctly and safely, using type information to prevent errors. You can add new strategy schemas to the system using the `addStrategy()` function, and retrieve them later by their name when you need them. 

Before a strategy schema is officially added, it's checked to make sure it has all the necessary pieces in place. If a strategy schema already exists, you can update parts of it using the `override()` function. Essentially, this service helps keep your strategy definitions organized and consistent.


## Class StrategyCoreService

This service acts as a central hub for managing strategy operations within the backtesting framework. It essentially combines a connection service with an execution context to ensure strategies have the necessary information like the trading symbol and timeframe.

Here's a breakdown of what it does:

*   **Validation:** It validates both the strategy itself and its associated risk configuration, optimizing performance by remembering the results of these checks.
*   **Signal Retrieval:** It provides methods to retrieve pending and scheduled signals related to a specific symbol.
*   **State Checks:**  You can use it to quickly check the status of a strategy – whether it's stopped, or if it’s reached breakeven.
*   **Core Operations:** It offers methods for core tasks like running a quick backtest on historical data, stopping a strategy from generating new signals, and cancelling scheduled signals.
*   **Resource Management:** It includes functionalities to dispose of strategy instances and clear cached data, ensuring clean resource management.
*   **Partial & Trailing Adjustments:**  Provides functions to handle partial profit/loss closures and trailing stop-loss/take-profit adjustments for active positions, enabling more nuanced trading adjustments.
*   **Contextualization:** Many of its functions receive a "context" object, providing information about the strategy name, exchange, and frame, allowing for targeted operations.

## Class StrategyConnectionService

The `StrategyConnectionService` acts as a central hub for executing strategies within the backtest-kit framework. It intelligently routes requests like generating signals or performing backtests to the correct strategy implementation based on the trading symbol and strategy name. To optimize performance, it caches these strategy instances, avoiding repetitive setup.

Think of it as a dispatcher: when you ask for a strategy's output, it figures out which specific strategy to use, retrieves it (or creates it if it's the first time), and then passes the request along.

Here's a breakdown of what it does:

*   **Strategy Routing:** Automatically directs requests to the right strategy based on symbol and strategy name.
*   **Caching:** Stores strategy instances to avoid repeatedly creating them, which speeds things up.
*   **Initialization:**  Ensures strategies are properly initialized before they're used for live trading or backtesting.
*   **Signal Management:** Provides methods to retrieve and manage pending or scheduled signals.
*   **Breakeven & Stop Checks:** Checks if breakeven points or stop-loss conditions have been met.
*   **Live & Backtest Operations:**  Handles both real-time trading (`tick`) and historical analysis (`backtest`).
*   **Control & Cleanup:** Provides functions to stop a strategy, dispose of resources, and clear the cached strategy instances when they're no longer needed.
*   **Partial and Trailing Adjustments:** Allows for adjusting partial profit, partial loss, trailing stop-loss and trailing take-profit levels.



It relies on several other services (like `LoggerService`, `ExchangeConnectionService`, etc.) to do its job, providing a complete ecosystem for strategy execution.

## Class SizingValidationService

This service helps you keep track of and double-check how you're determining position sizes in your backtesting. It acts like a central organizer for your sizing strategies – think of it as a registry.

You can use it to register new sizing methods with `addSizing`, ensuring they're known to the system. Before you actually use a sizing strategy, `validate` checks to make sure it’s been registered, preventing errors.  To make things quicker, the service remembers the results of these checks, so it doesn’t have to validate the same strategy repeatedly. 

Finally, `list` lets you see all the sizing strategies you’ve registered.

## Class SizingSchemaService

This service helps you organize and manage different sizing strategies for your trading backtests. It keeps track of these strategies, ensuring they're properly structured and type-safe. You can add new sizing strategies using the `register` method, or update existing ones with `override`.  If you need to use a specific sizing strategy, you simply retrieve it by name with the `get` method. Think of it as a central place to store and access all your sizing configurations. Before a strategy is added, a quick check (`validateShallow`) makes sure it has the essential elements in place.

## Class SizingGlobalService

The SizingGlobalService helps determine how much of an asset to trade, acting as a central hub for size calculations within the backtest-kit framework. It combines various services – a connection service for retrieving sizing data, and a validation service to ensure calculations are sound. Think of it as the engine that figures out your trade sizes, considering factors like your risk tolerance and the specifics of the trade.  It’s used both behind the scenes by the core strategy execution and also available for use when building your own custom trading logic. 

The service uses a `loggerService` to record events and a `sizingConnectionService` to actually get sizing information. You’ll interact with it primarily through the `calculate` method, which takes your desired risk parameters and a context and returns the calculated position size.

## Class SizingConnectionService

This service acts as a central point for handling position sizing calculations within the backtesting framework. It intelligently directs sizing requests to the correct sizing implementation based on a name you provide. 

To improve performance, it remembers which sizing implementations it has already created, so it doesn't need to recreate them every time you need them. 

Think of it as a dispatcher that ensures sizing calculations are handled by the right tool, and it optimizes the process by keeping things cached. It uses the `sizingName` parameter to determine the appropriate sizing method, and when no sizing configuration is present, this value will be an empty string.

Here's a breakdown of its key components:

*   **`getSizing`**: This method is used to fetch the appropriate sizing implementation, either creating it if it's the first time it's needed or retrieving the cached instance.
*   **`calculate`**: This method is how you actually trigger a sizing calculation, providing the necessary parameters and a context that includes the sizing name. It supports different sizing strategies like fixed percentage, Kelly Criterion, or ATR-based approaches.

## Class SignalPromptService

The SignalPromptService helps your AI and LLM integrations work smoothly by providing the right prompts for analysis and recommendations. It's designed to load and manage prompts defined in a configuration file. 

It handles system prompts which can be a simple list of strings, or a function that generates those strings – ensuring the AI has the context it needs.  You can also retrieve user prompts, which are used as part of the AI's input. If something goes wrong and a prompt isn't found, it defaults to an empty prompt, preventing errors. The service includes a logger for troubleshooting and debugging.

## Class ScheduleUtils

ScheduleUtils is a handy helper class designed to simplify the process of monitoring and reporting on scheduled signals within your backtesting or trading system. It acts as a central point for accessing and managing information about signals that are waiting to be executed.

Think of it as a way to keep tabs on how your scheduled signals are performing—you can easily see how many signals are queued, track cancellations, and understand things like average wait times. 

The class provides methods for retrieving data and generating clear, readable markdown reports, making it easy to diagnose any potential issues or bottlenecks. You can request statistics for a specific trading symbol and strategy, and even save those reports directly to a file. Because it's implemented as a singleton, it's simple to use throughout your system.

## Class ScheduleReportService

The ScheduleReportService is designed to keep a record of when signals are scheduled, opened, and cancelled, which is really helpful for understanding how long it takes for orders to actually execute. It works by listening for signal events and then storing that information in a database, specifically calculating how much time passes between when a signal is scheduled and when it’s either executed or cancelled. 

To use it, you'll subscribe to the signal emitter – essentially telling the service to start listening for those events.  This subscription is designed to prevent accidental double-subscription, ensuring that things don't get out of hand. When you’re done, you can unsubscribe, stopping the service from listening. The service also relies on a logger for debugging output and a “tick” object to handle those signal events and perform the logging.

## Class ScheduleMarkdownService

The ScheduleMarkdownService is responsible for creating reports detailing scheduled and canceled trading signals. It keeps track of these events as they happen for each trading strategy and generates easy-to-read markdown tables summarizing the activity. These reports include helpful statistics like cancellation rates and average wait times to give you insights into your strategies.

The service automatically saves these reports to disk, organized by strategy, so you can review them later. You can also request specific reports or clear the accumulated data when needed. Think of it as a detailed logbook for your trading signals, helping you understand and refine your strategies.

It works by listening for signal events, accumulating information, and then formatting that into reports. You can get statistics or full reports, and even clear the stored data if you want to start fresh. It’s designed to be flexible, allowing you to specify exactly what data you want to retrieve or save.


## Class RiskValidationService

This service helps you keep track of your risk management setups and make sure they’re all in order. Think of it as a central place to register and check your risk profiles. It allows you to add new risk profiles, confirm that a specific profile exists before you try to use it, and view a complete list of all the profiles you've registered. To make things efficient, the service remembers the results of previous validations so it doesn’t have to re-check everything every time. You can use it to easily manage and verify your risk configurations.

## Class RiskUtils

This class helps you understand and analyze risk rejections that happen during backtesting or live trading. It acts as a central point to gather information about these rejections, like how many times they occurred, which symbols were affected, and why. 

You can ask it for summarized statistics about rejections, providing insights into potential problem areas in your strategies. It can also create detailed reports in Markdown format, showing each rejection event with information like the symbol, strategy, position, and the reason for rejection. Finally, you can easily save these reports to files, making it simple to share or archive your risk analysis. The reports include summary statistics to quickly grasp the overall rejection picture.


## Class RiskSchemaService

This service helps keep track of different risk profiles, ensuring they're all structured correctly. It acts like a central repository where you can register new risk profiles and easily retrieve them later by name.

Think of it as a way to organize your risk assessment templates—you can add new ones, update existing ones with just the changes needed, and always grab the specific template you’re looking for.  The service uses a special system to make sure the risk profiles are typed correctly, preventing errors. It also performs a quick check when you add a new risk profile to make sure it has all the necessary pieces in place.

## Class RiskReportService

This service helps you keep a record of when your risk management system rejects trading signals. Think of it as a digital logbook for those rejections, making it easier to understand why trades aren’t happening and for auditing purposes.

It listens for these rejection events and neatly stores details like the reason for the rejection and what the signal looked like.  You can think of it as passively monitoring and recording.

The `subscribe` method is how you connect it to your risk management system, and it prevents you from accidentally subscribing multiple times. Once subscribed, it gives you a way to stop listening with the returned `unsubscribe` function, and it handles the process safely even if you try to unsubscribe when you aren't subscribed. Essentially, it’s designed to be reliable and straightforward for tracking risk rejections.

## Class RiskMarkdownService

The RiskMarkdownService is designed to automatically create detailed reports about risk rejections in your trading system. It listens for these rejection events and organizes them, creating easy-to-read markdown tables summarizing the information.

Think of it as a tool that gathers all the times your trading strategies were flagged for risk, and puts that information into a structured, shareable format.

You can subscribe to receive these rejection events, and the service keeps track of them for each symbol and strategy you're using. The `getData` function lets you pull out specific statistics, like the total number of rejections, broken down by symbol or strategy.  The `getReport` method builds the full markdown report. The `dump` function saves this report directly to a file on your disk, making it easy to review and share.  Finally, `clear` lets you wipe the collected data when it’s no longer needed. The system ensures that reports and data are isolated for each specific combination of symbol, strategy, exchange, timeframe, and backtest run.

## Class RiskGlobalService

This service acts as a central hub for managing and enforcing risk limits within the trading system. It works closely with a connection service to ensure that trading activity stays within defined boundaries.

Inside, it keeps track of validations to avoid unnecessary checks, and it logs important validation activities for monitoring purposes.

You can use it to check if a trading signal is permissible based on configured risk rules, register new open positions, and remove closed positions from the system's records. It also provides a way to completely clear the risk data, either for all instances or for a specific risk configuration. This helps in maintaining a clean and accurate risk profile for the entire trading environment.

## Class RiskConnectionService

The RiskConnectionService acts as a central hub for managing risk checks in your trading system. Think of it as a smart router – when your strategy needs to verify if a trade is safe based on predefined risk rules, this service directs that request to the correct risk implementation. It’s designed to be efficient by remembering which risk implementations it's already used, so it doesn't have to recreate them every time.

It uses information like the risk name, exchange, and timeframe to pinpoint the specific rules that apply. You can also clear the cached risk implementations if you need to, for example, when switching environments or refreshing risk configurations.

Here's a breakdown of what it does:

*   **Routes risk checks:** Directs risk validation requests to the right implementation based on the risk name.
*   **Caches for speed:** Keeps a record of the risk implementations it uses, making things faster.
*   **Validates trades:** Checks things like portfolio drawdown, symbol exposure, and position counts to make sure trades are within safe limits.
*   **Handles signal registration & removal:**  Manages the lifecycle of trading signals by registering new ones and removing closed ones from the risk management system.
*   **Provides a way to clear the cache:**  Allows you to manually clear the cached risk implementations, useful in certain scenarios.

Strategies that don't have their own risk configurations will use an empty string for the risk name.

## Class ReportUtils

ReportUtils helps you control which parts of the backtest-kit framework are actively logging data. Think of it as a way to turn on or off detailed record-keeping for things like backtesting runs, live trading, or performance analysis.

You can use `enable` to start logging for specific services, like only backtest data or just performance metrics. When you enable logging, it sets up the system to write events to JSONL files in real-time, adding valuable details for later examination. Crucially, `enable` gives you a cleanup function that you *must* call to avoid memory issues when you're done.

If you want to stop logging for certain services without affecting others, `disable` lets you selectively turn off that record-keeping. This is useful for isolating problems or reducing the amount of data being logged. Unlike `enable`, `disable` doesn’t provide a cleanup function – it stops logging immediately.

## Class ReportBase

This class, `ReportBase`, helps you reliably log trading events to files for later analysis. Think of it as a structured way to save information about your backtests. It writes each event as a single line in a JSONL file, which is a simple format where each line is a valid JSON object.

The system automatically creates the necessary directories and handles potential errors. It's designed to be efficient, ensuring data is written quickly without overwhelming the system, and it includes a timeout to prevent writes from hanging indefinitely. 

You can specify what kind of information you want to save (like symbol, strategy, exchange, etc.) and the class takes care of organizing the data.  The `waitForInit` method sets up the initial file and writing process, and the `write` method is how you add new events to the log. Essentially, it's a convenient tool for recording and managing your backtesting data for detailed examination later.

## Class ReportAdapter

The ReportAdapter helps you manage and store your trading data, like backtest results or live trade information, in a flexible and organized way. Think of it as a central hub for where your data goes.

It uses a system that allows you to easily swap out different storage methods – you can use the default JSONL format, or plug in something else entirely.  It keeps track of these storage connections, making sure you don't create multiple copies of the same data storage.

When you need to write data, this adapter handles it automatically, and it will even create the necessary storage if it doesn’t already exist. You can even tell it to ignore data completely with a "dummy" adapter for testing purposes. You can change how data is stored at any time.

## Class PositionSizeUtils

This class offers helpful tools for figuring out how much of an asset to trade in a backtest. It’s designed to make calculating position sizes easier and safer. 

Inside, you'll find different methods for determining your position size, like using a fixed percentage of your account, applying the Kelly Criterion (a more advanced approach), or basing it on the Average True Range (ATR). Each method is carefully checked to make sure it's being used correctly. 

Essentially, this class provides pre-built functions you can use to avoid common mistakes when deciding how much to invest in each trade. It handles some of the complex calculations for you, letting you focus on other aspects of your trading strategy.

## Class PersistSignalUtils

PersistSignalUtils helps keep track of your trading signals, ensuring they're saved and restored even if things go wrong. It's designed to work seamlessly with strategies, storing their signal data in a reliable way. 

It provides a way to customize how this data is stored, allowing you to use different adapters beyond the default JSON format. For testing or debugging, you can even switch to a dummy adapter that simply ignores any signal data, effectively disabling persistence.

The `readSignalData` function retrieves previously saved signals, while `writeSignalData` stores new or updated signals.  It makes sure these operations are done safely, even if the system crashes mid-write, keeping your data intact. This class is particularly important when running strategies in live trading mode because it handles the persistence of the signal state.

## Class PersistScheduleUtils

This utility class helps manage how scheduled signals are saved and restored, especially for trading strategies. It ensures that each strategy has its own safe place to store this information.

You can customize how these signals are persisted, choosing between different storage methods like JSON or even a "dummy" adapter that simply ignores writes—useful for testing.

The `readScheduleData` function retrieves saved signal data, while `writeScheduleData` safely saves the current signal state to disk, protecting against data loss if something goes wrong. These functions are essential for restoring a strategy's state after a restart or crash. It’s used internally by `ClientStrategy` to keep track of scheduled signals.

## Class PersistRiskUtils

This class, `PersistRiskUtils`, helps manage how active trading positions are saved and restored, particularly when dealing with different risk profiles. It ensures that the information about your open trades is reliably stored and can be recovered even if there are interruptions.

The class keeps track of storage locations for each risk profile, allowing for flexibility in how data is handled.  You can even plug in your own custom methods for storing this information.

`readPositionData` is used to load previously saved positions, and `writePositionData` is responsible for saving them – importantly, these operations are designed to be safe and prevent data loss, even if the system crashes.

If you want to test things out or just see what's happening without saving anything, you can switch to a "dummy" adapter that ignores all write attempts.  Alternatively, you can easily revert to using the standard JSON storage.  Finally, you can register your own custom adapter to tailor the persistence mechanism to your specific needs.

## Class PersistPartialUtils

This class provides tools to safely and reliably save and retrieve partial profit and loss information for your trading strategies. It’s designed to handle situations where the program might unexpectedly shut down, making sure your progress isn't lost.

The class automatically manages where this data is stored, creating separate storage locations for each symbol and strategy combination. You can even customize how the data is stored by registering your own adapters.

The `readPartialData` method is used to load any previously saved data when a strategy starts up. The `writePartialData` method is responsible for saving data as your strategies make changes.

For testing or when you don't need to persist data, you can switch to a "dummy" adapter that essentially ignores write requests, or revert to the default JSON based storage. You can also plug in your own custom storage mechanism.

## Class PersistBreakevenUtils

This class helps manage and store the breakeven state of your trading strategies, ensuring that information isn't lost between sessions. It’s designed to work behind the scenes, automatically saving and loading data related to when certain breakeven conditions have been met.

Think of it as a central hub that handles saving and retrieving this data to files, creating a separate file for each symbol and strategy combination you're using. This system uses a clever trick to avoid repeatedly creating these files and connections - it remembers the ones it’s already created, making things faster and more efficient.

You can even customize how this data is stored using adapters; for example, you could switch to a "dummy" adapter which essentially does nothing, or replace the standard JSON format with something else. This makes it flexible for different needs, from testing to more complex storage solutions. It handles all the details of writing data safely and reliably, so you can focus on your trading strategies.

## Class PersistBase

PersistBase provides a foundation for saving and retrieving data to files, ensuring your data stays safe and consistent. It's designed to handle situations where files might get corrupted, automatically checking and cleaning them up. You can use it to store anything that fits the `IEntity` interface.

The system uses atomic writes, which means updates happen as a single, guaranteed step, preventing partial or incomplete data from being saved. It also provides a way to list all the saved data identifiers.

To get started, you specify a name for the data you're storing and a base directory where those files will be located.  The framework automatically manages the directory structure for you, and includes a one-time initialization process to set things up and validate existing files.

## Class PerformanceReportService

This service helps you keep an eye on how long different parts of your trading strategy take to run. It essentially acts as a timer, recording how much time is spent on each step.

Think of it as a detective for your code, pinpointing areas that might be slow or inefficient.  It listens for timing events triggered during strategy execution and then saves those timings to a database.

You can subscribe to receive these timing events, and when you’re done, you can unsubscribe to stop the recording.  The system makes sure you don't accidentally subscribe multiple times. There's a handy unsubscribe function that makes it easy to stop tracking.




It uses a logger to provide debug information and a "track" object to handle the actual logging process.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing. It gathers data about your trades – like how long they take to execute – and organizes it by strategy, symbol, exchange, and timeframe.

Think of it as a data collector and reporter for your backtesting experiments. It listens for performance events during backtests and keeps track of key metrics. 

You can request this service to retrieve summarized performance statistics for a specific strategy or to generate detailed markdown reports that pinpoint potential bottlenecks in your code. These reports are automatically saved to a log file.

The service also lets you clear out old performance data if you want to start fresh, and it ensures you don't accidentally subscribe to performance events more than once.

## Class Performance

The Performance class helps you understand how your trading strategies are performing. It allows you to gather and analyze performance metrics for specific symbols and strategies. 

You can retrieve detailed statistics, including counts, durations, averages, and percentiles, to pinpoint areas where your strategy might be slow or experiencing volatility. 

The class can also generate easy-to-read markdown reports that visualize performance, highlighting bottlenecks and providing a comprehensive overview of your strategy’s behavior. Finally, you can save these reports directly to your hard drive for later review or sharing.

## Class PartialUtils

This class helps you analyze and report on partial profit and loss data collected during backtesting or live trading. It acts as a central point to gather statistics and create readable reports from events triggered by partial profits and losses.

You can use it to get summarized data like total profit/loss event counts for a specific symbol and strategy. It’s also capable of generating markdown reports that present detailed information about each event, including things like the action (profit or loss), symbol, strategy, signal ID, position size, level percentage, price, and timestamp.

Finally, it provides a convenient way to export these reports to files, automatically creating any necessary directories and giving the files descriptive names based on the symbol and strategy. Essentially, it makes it easy to understand and share your partial profit/loss performance.

## Class PartialReportService

The PartialReportService helps you keep track of how your trades are performing by recording every partial profit or loss. It listens for signals indicating when a position is partially exited, whether it's a gain or a loss. This service then saves details about those partial exits, like the level and price, to a database, letting you analyze your trading strategy in more detail.

To get it working, you need to subscribe it to the relevant data streams; the `subscribe` method handles this safely, preventing accidental double-subscriptions. When you're done tracking partials, use the `unsubscribe` method to stop the service from listening. A logger is built-in to help with debugging.

## Class PartialMarkdownService

This service helps you create and save reports detailing your partial profits and losses during backtesting. It listens for signals about these profits and losses, keeping track of them for each symbol and strategy you're using. 

It then organizes this data into easy-to-read markdown tables, allowing you to analyze your performance. You can get overall statistics like the total number of profit and loss events, and save these reports directly to your computer. 

The service is designed to be flexible, letting you clear older data and focusing on specific symbol-strategy combinations when needed. It handles the storage of this data in a way that isolates information for different configurations, ensuring clarity and organization.

## Class PartialGlobalService

PartialGlobalService acts as a central hub for managing partial profit and loss tracking within the system. It's designed to be injected into the core strategy logic, providing a single point for handling these operations and ensuring consistent logging. Think of it as a middleman: when a strategy needs to record a profit, loss, or clear a partial state, it talks to the PartialGlobalService, which then passes that information on to the connection service that actually handles the details. This layered approach makes monitoring and troubleshooting easier by providing a centralized view of all partial operations.  It utilizes various validation services to ensure the strategy, risk, exchange, frame, and other configurations are valid before processing. The `validate` property memoizes validations, optimizing performance by avoiding repetitive checks.

## Class PartialConnectionService

The PartialConnectionService helps track profit and loss for individual trading signals. It’s like a central manager that creates and maintains records for each signal, ensuring we don’t lose track of how well each one is performing.

It uses a clever caching system – essentially remembering previously created signal records – to avoid unnecessary work. When a signal triggers a profit or loss, the service handles the details and sends out notifications.

When a signal is finished, the service cleans up its records, ensuring things don't clutter up the system. It's designed to work closely with the ClientStrategy and uses other services for logging and action management. Think of it as a dedicated assistant, quietly managing the details of each signal's financial journey.




The `getPartial` property is the key to this caching. It creates a unique identifier for each signal based on its ID and whether it's a backtest or live trade.

The `profit`, `loss`, and `clear` methods are the primary ways to interact with the service.  Each method retrieves the correct signal record, performs the necessary operation (recording profit, loss, or clearing the record), and handles any cleanup needed.

## Class OutlineMarkdownService

This service helps automatically create documentation in markdown format from the results of AI-powered strategies. It's particularly useful for debugging and understanding how an AI strategy arrived at its decisions. 

The service organizes and saves information related to a strategy's execution into a specific directory structure under a `dump/strategy` folder. This includes the initial system prompt, each user input, and the final output generated by the AI. 

The `dumpSignal` function handles the actual creation of these markdown files, making sure to avoid accidentally overwriting any existing documentation by checking for the directory's presence first. Essentially, it provides a convenient way to record and review the steps involved in a strategy's reasoning.

## Class OptimizerValidationService

This service helps keep track of your optimizers, ensuring they’re properly registered and available for use. It acts like a central directory for optimizers, storing information about each one. To prevent confusion, it makes sure you don't accidentally register the same optimizer twice. 

The service is designed to be efficient; it remembers previous validation checks to avoid unnecessary work. 

Here’s what it lets you do:

*   **Register optimizers:** You can add optimizers to the registry, providing details about each.
*   **Verify optimizer existence:** It quickly confirms whether a specific optimizer is registered.
*   **View registered optimizers:**  You can get a list of all the optimizers currently in the system.

## Class OptimizerUtils

This set of tools helps you work with strategies created by an optimizer. You can retrieve information about your strategies, like their data and how they're configured. It's also capable of generating the actual code that runs those strategies, giving you a complete, ready-to-use program. Finally, you can easily save that generated code to a file so you can deploy it or examine it more closely. 

Specifically, `getData` gathers strategy details, `getCode` produces the full strategy code, and `dump` saves the code to a file organized by optimizer name and trading symbol.

## Class OptimizerTemplateService

This service is your go-to for creating the code snippets needed to run optimizer tests. Think of it as a code generator that leverages a large language model (LLM) to produce optimized trading strategies. It's designed to handle complex tasks, including analyzing data across different timeframes (like 1-minute, 5-minute, and hourly charts) and generating structured JSON output for trading signals.

It’s built to work with common trading tools and data sources, integrating CCXT for exchange connectivity and a “walker” system to compare various strategies. You can customize some aspects of its behavior through configuration.

Here's a breakdown of what it does:

*   **Code Generation:** It crafts code for various components of your backtesting setup, including how to interact with exchanges, define timeframes, and even the strategies themselves.
*   **LLM Integration:** It uses an LLM (specifically, Ollama) to generate insightful and well-structured trading signals, which include details like entry and stop-loss prices and estimated holding times.
*   **Debugging:** It includes features for logging and saving important data to a designated folder (`./dump/strategy`) for easier debugging and analysis.
*   **Walker Configuration:** It can create configurations to systematically compare different trading strategies.
*   **Timeframe Analysis:**  It’s equipped to analyze data across multiple timeframes to get a comprehensive view of market conditions.



The service generates several helper functions: `getJsonDumpTemplate` saves results, `getTextTemplate` handles general text generation, and `getJsonTemplate` ensures structured output of trading signals. These signals have a defined format including position, explanation, price points and estimated duration.

## Class OptimizerSchemaService

The OptimizerSchemaService is like a librarian for your trading strategies' configurations. It keeps track of all your optimizer schemas, making sure they're set up correctly and easily accessible. 

It's responsible for registering new schemas, verifying that they have the essential information like the optimizer’s name, training range, data source, and how to get the prompt. 

You can think of `register` as adding a new schema to the library's catalog. If you need to tweak an existing schema, `override` lets you update parts of it without changing the entire thing. Finally, `get` is your way of retrieving a specific schema when you need it. The service uses a secure, unchanging storage system to maintain the integrity of your schemas.

## Class OptimizerGlobalService

This service acts as the central point for working with optimizers, ensuring everything runs smoothly and safely. Think of it as a gatekeeper that verifies your optimizer exists before passing requests on to the parts that actually do the work.

It keeps a record of all operations and uses validation to make sure everything is working correctly. 

The service provides a few key actions:

*   **getData:** Retrieves and organizes strategy information, checking that the optimizer you’re looking for is actually available.
*   **getCode:** Builds the complete code needed to run a strategy, again with the essential validation step.
*   **dump:**  Creates the strategy code and saves it to a file, and as always, confirms the optimizer is valid before proceeding.

Essentially, it simplifies the process of using optimizers while guaranteeing data integrity and preventing errors.

## Class OptimizerConnectionService

This service helps you manage and reuse optimizer connections efficiently. It acts as a central place to create and store optimizer clients, so you don't have to recreate them every time.

It keeps track of optimizer instances, remembering them based on their name for faster access. When you need an optimizer, it first checks if one already exists; if not, it creates one.  You can customize the templates used by the optimizer, blending your own settings with the default ones.

The service also provides methods to:

*   Retrieve data and build strategy metadata.
*   Generate the complete code for your trading strategy.
*   Save the generated code directly to a file.



Think of it as a smart assistant that handles the details of connecting to and using optimizers, allowing you to focus on your trading logic.

## Class NotificationUtils

This class, NotificationUtils, makes it easy to work with notifications within the system. It handles some behind-the-scenes setup automatically, so you don't have to worry about it. 

You can use it to retrieve a list of all notifications, displayed in reverse chronological order, with the newest ones appearing first.  If you need to start fresh, you can also clear all existing notifications with a single call. 

Internally, it manages a specific instance that actually handles the notification processing.

## Class MarkdownUtils

The MarkdownUtils class helps you control when and how markdown reports are generated for different parts of the backtest-kit system. Think of it as a central switchboard for report generation.

You can selectively turn on markdown reporting for things like backtests, live trading, or performance analysis using the `enable` property. When you enable a service, it starts collecting data and preparing reports, and it’s important to remember to “unsubscribe” from those services when you're done to prevent issues.

Conversely, the `disable` property lets you turn off markdown reporting for specific areas without affecting others. This is useful if you only need reports sometimes. Unlike enabling, disabling doesn't require a separate cleanup step; it stops the reporting process immediately.

## Class MarkdownFolderBase

This adapter lets you create organized markdown reports, putting each one into its own file within a directory structure. Think of it as the standard way to generate reports – perfect for when you want to easily browse and review the results yourself. It automatically creates the necessary folders for your reports, so you don't have to worry about setting those up manually. 

Essentially, it takes the markdown content and writes it directly to a file based on the path and filename you specify. The `waitForInit` method is a no-operation, meaning it doesn’t do anything – folder adapters don't typically need an initialization step. You'll use the `dump` method to actually write the markdown content to a file and create the folders needed.

## Class MarkdownFileBase

This component handles writing markdown reports in a structured, append-only way using JSONL files. Think of it as a central place to collect and organize your trading reports, making it easier to analyze them later with standard JSON tools.

It creates a single JSONL file for each report type (like trade details or performance summaries) and writes data to it as individual lines. The process is designed to be reliable, handling potential issues like slow writes with a built-in timeout and managing buffer space to prevent slowdowns.

The component automatically sets up the necessary directory structure and ensures that each report includes key metadata like the trading symbol, strategy name, exchange, frame, and signal ID, allowing you to filter and search through your reports easily. You can safely call its initialization multiple times, as it only sets up the file and stream once.  Finally, the `dump` method is used to write the actual markdown content along with its associated metadata.

## Class MarkdownAdapter

The MarkdownAdapter helps you manage how your markdown data is stored, offering flexibility and efficiency. It lets you choose between different storage methods – like separate files or appending to a single JSONL file – and remembers these choices so you don't have to configure them repeatedly. It intelligently creates storage instances only when needed, and it’s easy to switch between storage types with shortcuts like `useMd()` for individual files and `useJsonl()` for combined JSONL storage. You can even set a "dummy" adapter for testing purposes to prevent actual writes. The system is designed to be adaptable, allowing you to customize the storage constructor if you need something beyond the default options.

## Class LoggerService

The LoggerService helps keep your backtesting logs organized and informative. It provides a centralized way to record what's happening during your backtests, automatically adding details about the strategy, exchange, and execution context. 

You can use it to log general messages, debug information, important events, or warnings, all with consistent context. If you don't specify your own logging system, it will default to a “do nothing” logger. 

The service lets you plug in your preferred logger implementation through the `setLogger` function, giving you flexibility while maintaining a standardized logging approach across the framework. It also manages the automatic addition of relevant details to each log entry.

## Class LiveUtils

This class provides tools for managing live trading operations, essentially acting as a central hub for running and controlling your trading strategies in real-time. It's designed to be easy to use and robust, with features to handle crashes and keep things running smoothly.

You can start a live trading session for a specific symbol and strategy using the `run` method, which acts as an infinite generator – it keeps running until you stop it.  If something goes wrong and the program crashes, it automatically recovers from the last saved state.  Alternatively, `background` lets you run a strategy without directly monitoring its output, perfect for tasks like data persistence or sending notifications.

Need to check on what's happening? `getPendingSignal` and `getScheduledSignal` let you peek at the current signals.  You can also use `getBreakeven` to see if the price has moved enough to cover transaction costs.

To control your strategies, you have options like `stop` (to pause signal generation), `commitCancel` (to cancel a scheduled signal), and several `commit...` methods for adjustments like `commitPartialProfit`, `commitPartialLoss`, `commitTrailingStop`, `commitTrailingTake`, and `commitBreakeven`—allowing for precise management of open positions.

Finally, `getData` provides statistics, `getReport` creates detailed reports, `dump` saves those reports to a file, and `list` gives you an overview of all currently running live trading instances. The system creates a dedicated instance for each unique combination of symbol and strategy, providing isolation and preventing interference.

## Class LiveReportService

The LiveReportService helps you track what's happening with your live trading strategies as they run. It acts like a diligent recorder, capturing every key event – from when a signal is idle, to when a position is opened, active, or closed – and saving that information to a SQLite database. This allows you to monitor your strategies in real-time and analyze their performance.

The service connects to a system that broadcasts live trading signals, ensuring each tick event is logged with all the details you need. A built-in mechanism prevents it from accidentally subscribing multiple times, keeping things clean and efficient. You can easily start and stop the logging process by subscribing and unsubscribing, giving you control over when data is captured.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create and save reports of your live trading activity. It keeps track of every event – from when a strategy is idle to when a trade is opened, active, and closed – and organizes them for easy review.

This service listens for signals during trading and turns those signals into nicely formatted markdown tables, which are saved to your logs folder. You can generate detailed statistics like win rate and average profit/loss to understand how your strategies are performing. 

Think of it as a built-in reporting system that captures your trading history, making it simple to analyze and share. You can control which data gets saved, clear out old reports, and customize the way information is presented. It also ensures that each trading strategy and its associated settings has its own separate storage area.

## Class LiveLogicPublicService

This service helps manage live trading operations, streamlining the process with automatic context handling. It builds upon a private service, automatically passing along important information like the strategy name and exchange.

Think of it as a convenient wrapper that simplifies how you interact with the core trading logic.

It provides a continuous stream of trading results – signals, openings, and closures – running indefinitely. This stream is designed to handle interruptions; if the system crashes, it can recover its state and pick up where it left off.  The process tracks time using the system clock, ensuring real-time accuracy. The main function `run` is where you start the live trading for a specific asset.


## Class LiveLogicPrivateService

This service handles the behind-the-scenes work of live trading, acting as a central coordinator. It continuously monitors trading signals in an ongoing loop, checking for new opportunities and reacting to changes. The service streams results—specifically, when trades are opened or closed—rather than constantly sending updates, making it efficient in terms of memory usage.

Think of it as an always-on process that keeps track of what’s happening in the market and automatically reacts to new signals.  If something goes wrong, it's designed to recover and get back to work, ensuring the trading process continues uninterrupted. The whole operation is managed using an infinite generator, meaning it runs continuously without needing to be explicitly stopped. The generator provides updates on opened and closed trades as they occur, allowing other parts of your system to react to them.


## Class LiveCommandService

This service acts as a central point for interacting with live trading features within the backtest-kit framework. Think of it as a convenient helper that wraps around the core live trading logic, making it easy to use and manage dependencies. 

It provides a `run` method, which is the primary way to start a live trading session. This method takes a symbol (like a stock ticker) and some contextual information – like the strategy and exchange names – and then continuously streams back results as an ongoing process.  

It's designed to be robust, automatically recovering from unexpected issues to keep the live trading going. Several validation services are also integrated to ensure strategies, exchanges, risks, and actions are properly configured before trading begins.

## Class HeatUtils

HeatUtils helps you visualize and analyze your trading strategy's performance using heatmaps. Think of it as a tool to quickly understand how different assets contributed to your overall results.

It gathers statistics from all your closed trades for a particular strategy, giving you a breakdown of each symbol's performance alongside portfolio-wide metrics.

You can easily generate a formatted markdown report, showing key information like total profit/loss, Sharpe Ratio, maximum drawdown, and the number of trades executed for each symbol—all neatly organized and sorted by profitability.

HeatUtils also lets you save these reports directly to a file on your computer, making it simple to share or keep records of your strategy's performance. It’s designed to be used frequently, as it provides a convenient, single access point for these important portfolio analysis features.

## Class HeatReportService

HeatReportService helps you track and analyze your trading performance by recording when your signals close, especially how much profit or loss each one generated. It acts like a dedicated observer, listening for signals that have finished executing.

It focuses specifically on closed signals and the associated profit and loss data, storing this information in a way that's perfect for building heatmaps and getting a portfolio-wide view of your trading activity.

You can easily start and stop this service to monitor your signals, and it’s designed to prevent accidental duplicate subscriptions, ensuring reliable data collection. When you're done, simply unsubscribe to stop the logging.

## Class HeatMarkdownService

The Heatmap Service is designed to give you a clear, visual overview of your trading portfolio’s performance. It watches for trading signals and gathers data across different strategies and symbols.

It carefully organizes this data to present both a broad portfolio view and detailed breakdowns for each individual symbol. The service automatically generates reports in a readable markdown format, making it easy to share or analyze your results.

You can think of it as a central hub for tracking your trading activities, with built-in safeguards to handle unusual data gracefully. It keeps information organized by exchange, timeframe, and whether you’re in backtest mode, ensuring you have the right view for your needs. It also offers convenient functions to clear out old data or save the generated reports directly to a file.

## Class FrameValidationService

This service helps you keep track of your trading timeframes and make sure they're set up correctly. Think of it as a central place to register your different timeframe configurations and check that they actually exist before you try to use them in your backtesting. It's designed to be efficient, remembering previous validation results to speed things up. You can add new timeframes using `addFrame`, check if a timeframe is valid with `validate`, and get a list of all your registered timeframes with `list`. This service provides a reliable way to manage and verify your timeframe setups.

## Class FrameSchemaService

This service helps you keep track of the blueprints, or "schemas," that define how your trading strategies operate within backtest-kit. Think of it as a central place to store and manage these structure definitions. It uses a special type-safe storage system to ensure consistency and prevent errors. 

You can add new schema blueprints using the `register` method, update existing ones with `override`, and easily retrieve them by name with `get`. Before adding a new blueprint, it performs a quick check to make sure it has all the necessary elements in the right format. This validation step helps catch potential problems early on.


## Class FrameCoreService

This service acts as the central hub for managing timeframes within the backtesting system. It relies on other services to handle connections and validation of data. Think of it as the engine that provides the specific date ranges you'll use to run your backtests, ensuring they're correctly formatted and valid. The `getTimeframe` function is the key method – you'll use it to request the date ranges for a particular trading symbol and timeframe (like daily, hourly, etc.). It gives you a promise that resolves to an array of dates, ready for your backtesting logic.


## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing different frame implementations within your backtesting environment. Think of it as a smart router – it automatically figures out which specific frame (like a daily, weekly, or monthly view) you need based on the context of your operations. 

It's designed to be efficient too.  It keeps a record of the frames it's created, so it doesn't have to recreate them every time you need them, saving valuable resources. 

The service handles the complexities of timeframe management during backtesting, allowing you to easily define start and end dates for your analysis.  Notably, when running in live mode, no specific frame constraints are applied.

The `getFrame` function is the key to obtaining these frame instances, and it uses caching to optimize performance.  The `getTimeframe` function helps define the period your backtest will cover.

## Class ExchangeValidationService

This service helps you keep track of your exchanges and make sure they're set up correctly before you start trading. It acts as a central place to register each exchange you're using, storing details about its configuration. 

Before any trading activity happens, this service can quickly check if an exchange is properly registered, preventing potential errors. It’s designed to be efficient because it remembers previous validation results.

You can add new exchanges to the service using `addExchange()`, confirm an exchange's validity with `validate()`, and get a complete list of all registered exchanges with `list()`. Think of it as your guardrail for ensuring a smooth and reliable trading environment.

## Class ExchangeUtils

ExchangeUtils is a helper class designed to simplify common operations when working with exchanges. Think of it as a central place to handle tasks like retrieving data and formatting values, all while making sure things are done correctly according to the specific exchange’s rules.

It's structured so that you only ever need one instance of it, ensuring consistency across your project.

Here’s what it can do:

*   **Get historical candle data:** Easily retrieve candlestick data for a specific trading pair and time interval. It automatically handles calculating the appropriate date range.
*   **Calculate Average Price:** Determine the Volume Weighted Average Price (VWAP) based on recent trade data.
*   **Format quantities and prices:**  Ensure trade quantities and prices are formatted correctly to meet the exchange's precision requirements.
*   **Fetch order books:** Retrieve the current order book data for a trading pair, which shows the best bid and ask prices and the volume available at those prices.



Essentially, ExchangeUtils provides a layer of abstraction that makes interacting with different exchanges easier and more reliable.

## Class ExchangeSchemaService

The ExchangeSchemaService helps you keep track of information about different cryptocurrency exchanges in a structured and organized way. It uses a system for safely storing these exchange details, ensuring consistency and preventing errors.

You can add new exchanges using the `addExchange` function, and then easily find them again by their name using the `get` function. 

Before adding an exchange, the service checks that it has all the necessary information with `validateShallow`. If an exchange already exists, you can update specific parts of its information with `override`. This service acts like a central hub for managing all your exchange-related data.

## Class ExchangeCoreService

ExchangeCoreService acts as a central hub for interacting with exchanges, particularly within a backtesting environment. It combines the capabilities of connection and execution services, ensuring that each exchange operation is performed with the correct context – knowing the symbol, the time period, and whether it's a backtest or live trade.

This service handles tasks like retrieving historical candle data, getting future candles (specifically for backtests), calculating average prices, and formatting price and quantity values.  It also provides functions to fetch order book data. 

A key feature is its validation process, which checks the exchange configuration and optimizes performance by remembering previously validated configurations. The service’s internal workings are used by other core components of the trading framework.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges within the backtest-kit framework. It intelligently directs your requests to the correct exchange based on the currently active context. Think of it as a smart router ensuring your trading commands reach the intended platform.

It keeps track of exchange connections, avoiding the overhead of repeatedly establishing them. This memoization technique significantly speeds up operations.

You can retrieve historical candle data, fetch the next set of candles based on your execution timeline, get the average price (using either real-time data or a calculated VWAP in backtesting), and access the order book – all through this service. It also handles formatting prices and quantities to adhere to each exchange's specific rules, preventing errors due to precision mismatches. Essentially, it streamlines your interaction with various exchanges, providing a consistent and efficient interface.

## Class ConstantUtils

This class provides a set of predefined percentages used for calculating take-profit and stop-loss levels, based on a Kelly Criterion approach that considers risk decay. Think of it as a built-in guide for setting up these levels in a way that balances locking in profits and protecting against losses.

The `TP_LEVEL1`, `TP_LEVEL2`, and `TP_LEVEL3` properties represent increasing percentages of the total profit target reached, allowing for a staged exit from a winning trade. `TP_LEVEL1` lets you secure an early partial profit, while `TP_LEVEL3` gets you nearly all the way out.

Similarly, `SL_LEVEL1` and `SL_LEVEL2` are designed for stop-loss management, helping to mitigate potential losses. `SL_LEVEL1` acts as an early warning sign to reduce exposure, and `SL_LEVEL2` ensures a complete exit before significant losses occur. These constants offer a structured, mathematically informed way to manage risk and reward in your trading strategies.

## Class ConfigValidationService

This service acts as a safety net for your backtesting configurations, making sure your settings are mathematically sound and won't lead to unrealistic or unprofitable trading scenarios. It meticulously checks your global configuration parameters, focusing on things like slippage, fees, and profit margins, confirming they are all non-negative values.

The service also examines the economic feasibility of your trades, ensuring your take-profit distance is large enough to cover all associated costs. It verifies relationships between minimum and maximum values for parameters like stop-loss distances, and confirms time-based settings and candle parameters are using appropriate, positive integer values. Ultimately, this validation service helps prevent errors and ensures your backtests are based on realistic and viable trading configurations. It's a good way to catch potential problems before you start running your backtests.

## Class ColumnValidationService

The ColumnValidationService helps ensure your column configurations are set up correctly and won't cause problems later. It acts as a safety net, checking your column definitions against a set of rules. 

Think of it as a quality control system. It makes sure every column has the essential properties like a unique key, a descriptive label, a formatting function, and a visibility function. 

It also verifies that those keys are unique, preventing potential conflicts. This service helps you catch errors early, making your overall system more robust and reliable. It's a simple way to maintain consistency and avoid headaches down the road.

## Class ClientSizing

This class, ClientSizing, helps determine how much of your capital to allocate to a trade. It’s a flexible tool designed to calculate optimal position sizes. 

You can choose from several sizing methods like fixed percentage, Kelly Criterion, or using Average True Range (ATR).  It also allows you to set limits on position size, ensuring you stay within your risk parameters. 

The `calculate` method is the core function; it takes parameters and returns the calculated position size, considering your chosen method and any defined constraints. You can even add custom logic through callbacks for validation or logging purposes, tailoring it precisely to your trading style.


## Class ClientRisk

ClientRisk acts as a guardian for your portfolio, making sure your trading strategies don’t take on too much risk at once. It helps control things like the maximum number of positions you can hold across all your strategies, and it allows you to create custom checks to enforce even more specific rules.

This component is shared between multiple strategies, so it can analyze risk across your entire portfolio, not just individual strategies. Think of it as a central risk management hub.

It’s used behind the scenes when your strategies generate trading signals, ensuring those signals align with your risk limits before a trade is actually placed.

Here's a breakdown of what it does:

*   **Tracks Active Positions:** It keeps a running record of all open trades, identifying them by strategy, exchange, and symbol.
*   **Enforces Limits:**  It checks each signal against your configured risk parameters.
*   **Custom Validation:** You can define your own rules to further refine risk control.
*   **Signal Registration & Removal:** It records when positions are opened and closed, keeping its track of active positions up-to-date.






## Class ClientOptimizer

The ClientOptimizer helps you run optimization processes, pulling data from various sources and piecing together the steps needed to generate trading strategies. It’s designed to work closely with the OptimizerConnectionService.

It can fetch data related to different trading symbols, compiling it into a form useful for strategy creation.  You can also request that it generates the actual code for a complete trading strategy, combining all the necessary parts into a single, runnable file.

Finally, the ClientOptimizer has the ability to export the generated strategy code and save it to a file, automatically creating any necessary directories in the process. As these operations run, it provides progress updates via a callback function.


## Class ClientFrame

The `ClientFrame` is a component responsible for creating the timeline of data your backtest uses – essentially, the sequence of dates and times the trading simulations will run against. It's designed to be efficient, avoiding repeated calculations by caching previously generated timeframes.

You can configure the spacing between these timestamps, letting you choose intervals from one minute all the way to three days.

The `ClientFrame` also provides ways to customize the timeframe generation process through callbacks; you can use these to validate the generated data or log important events.

The `getTimeframe` function is the key part – it’s what produces the date array for a specific trading symbol, and it remembers the results so it doesn't have to calculate them again.

## Class ClientExchange

This `ClientExchange` class is your go-to for accessing exchange data within the backtest-kit framework. It’s designed to be efficient, using prototype functions to minimize memory usage. You can use it to retrieve historical and future candle data, essential for backtesting strategies.

It also provides handy tools like calculating VWAP, which is a volume-weighted average price useful for understanding market trends.  Formatting functions ensure that the quantities and prices you're using are presented correctly, adhering to the exchange’s specific rules.  Finally, it allows you to fetch order book data to see the current state of bids and asks.  The class focuses on getting the data you need, leaving the complexities of specific exchange implementations to other parts of the system.

## Class ClientAction

The `ClientAction` component is the engine that connects your custom logic (action handlers) to the backtest-kit framework. It’s designed to manage the lifecycle of these handlers, making sure they're set up correctly, receive the right signals, and are cleaned up when they’re no longer needed.

Think of it as a middleman—it takes events from the backtest or live trading environment and routes them to the appropriate functions within your action handler.

The framework handles the details of initializing your handler, ensuring it only happens once, and disposing of it properly at the end. Your action handlers can then focus on things like managing your application’s state, logging activity, sending notifications, and collecting data for analysis.

Specifically, `ClientAction` provides dedicated methods like `signal`, `signalLive`, and `signalBacktest` to handle different types of events coming from backtesting or live trading. It also has specialized methods for breakeven, partial profit/loss, and ping events, allowing you to build sophisticated trading logic.

## Class CacheUtils

CacheUtils helps you speed up your backtesting by automatically caching the results of functions. It's designed to be easy to use – you simply wrap a function and it will remember its results based on the timeframe you specify.

Think of it as a memory for your functions, so they don’t have to recalculate things they've already done.

The `fn` property is the main tool – you use it to wrap functions with this caching behavior.  Each function gets its own independent cache.

If your function's logic changes or you just want to clear things out, the `flush` method completely removes the cache for that function. This is like wiping the slate clean.

The `clear` method is more targeted; it only removes the cache for the current specific scenario (like a particular strategy and exchange combination). This is useful if you want to force a recalculation for just that situation.

CacheUtils is designed to be used as a single instance, making it simple to integrate into your backtesting framework.

## Class BreakevenUtils

The BreakevenUtils class helps you analyze and report on breakeven events within your backtesting or live trading system. Think of it as a tool to understand how often your strategies hit breakeven points and to visualize those events.

It acts as a central point for getting statistics and generating reports about breakeven occurrences. You can request overall statistics like the total number of breakeven events for a specific symbol and strategy.

Need to see the details of each breakeven event? This class can create a nicely formatted markdown report, complete with tables showing entry prices, signal IDs, and timestamps.  You can even specify which data columns you want to see in the report.

Finally, it allows you to easily save these reports to files on your computer, with filenames that clearly identify the symbol and strategy being analyzed, so you can keep track of performance over time. It takes care of creating the necessary folders for you.

## Class BreakevenReportService

This service helps you keep track of when your trading signals reach their breakeven point. It acts like a recorder, capturing each time a signal hits breakeven and saving all the details – like what signal it was and when it happened – into a database.

To use it, you subscribe to a signal emitter which sends breakeven notifications. Once subscribed, it diligently records each breakeven achievement.  It's designed to prevent accidental duplicate subscriptions, ensuring a clean and reliable data flow.

You can stop the recording process by unsubscribing, which ensures the service no longer receives or logs breakeven events. The service uses a logger for debugging information, and a component `tickBreakeven` handles the event processing and database storage.

## Class BreakevenMarkdownService

This service helps you automatically generate and save reports about breakeven points in your trading strategies. It listens for breakeven events and organizes them by symbol and strategy. The service then creates nicely formatted markdown tables detailing each event, along with overall statistics like the total number of breakeven events. These reports are saved to your hard drive in a specific directory structure, making them easy to find and review.

You can subscribe to receive these events and unsubscribe when you no longer need them. The `tickBreakeven` function is the core of processing these events, and the service uses a clever system to manage storage so each combination of symbol, strategy, exchange, frame, and backtest gets its own dedicated space.

You can request the collected data and reports for specific symbols and strategies, or clear the data if you need to start fresh. The `dump` function makes it simple to save reports to disk, and it will even create the necessary directories if they don't already exist.

## Class BreakevenGlobalService

This service acts as a central hub for managing breakeven calculations within the trading system. It's designed to be easily integrated into the trading strategy using a dependency injection approach. Think of it as a middleman – it logs all breakeven-related actions globally and then passes those actions on to another service that actually handles the details.

The system uses several validation services to ensure that the strategy, associated risks, exchange, and frame configurations are all valid before any breakeven calculations take place. This helps to prevent errors and ensure the reliability of the process.

The `check` function determines whether a breakeven event should be triggered, carefully evaluating conditions and then forwarding the request. Similarly, the `clear` function resets the breakeven state when a signal closes, again with global logging and delegation. You'll find it's injected with logging and connection services to manage its core functions.

## Class BreakevenConnectionService

This service manages the tracking of breakeven points for trading signals. It's designed to efficiently create and manage "ClientBreakeven" objects, ensuring there's only one for each unique signal. Think of it as a central hub that makes sure breakeven calculations are done correctly and keeps track of them.

It utilizes caching to avoid unnecessary calculations – once a breakeven object is created for a specific signal, it’s reused. When a signal is finished, the service cleans up these objects to prevent memory issues.

The service receives information from other parts of the system, like a logger and a core action service, and it communicates its findings through events. It's a key component in the overall trading strategy, helping to determine when a trade has reached its breakeven point. Specifically, it's used by the ClientStrategy and utilizes a clever caching system.

## Class BacktestUtils

This class, `BacktestUtils`, offers convenient ways to run and manage backtesting scenarios within the trading framework. Think of it as a helper for streamlining your backtest process.

It provides methods to execute backtests, either by yielding results or running them silently in the background for tasks like logging. You can also check for pending or scheduled signals related to a strategy.

Several functions let you manipulate a running backtest, such as setting a stop to halt signal generation, canceling scheduled signals, or adjusting trailing stop-loss and take-profit levels.  It even allows for moving stop-loss to breakeven based on price movement.

You can access statistical data and generate reports summarizing the results of completed backtests. The `list` method shows you the status of all running backtest instances. The `_getInstance` property manages isolated instances for each symbol and strategy combination, ensuring backtests don't interfere with each other.

## Class BacktestReportService

BacktestReportService is designed to keep a detailed record of your trading strategy's activity during backtesting. It acts like a data logger, capturing every key signal event – when a signal is idle, opened, active, or closed – and storing these details in a database.

Think of it as a way to easily analyze and debug your strategy's behavior later on.

The service connects to the backtest environment and listens for signal events, meticulously logging each one with all relevant information. To prevent accidental duplicate logging, it uses a mechanism that ensures it only subscribes once. You can easily start and stop this logging process by subscribing and unsubscribing. When you’re finished, unsubscribing gracefully stops the data collection.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create detailed reports about your backtesting results. It listens for trading signals and keeps track of how those signals performed, specifically focusing on closed trades. It organizes this information, then turns it into easy-to-read Markdown tables that you can save to files.

Think of it as a dedicated recorder for your backtesting experiments. It remembers the specifics of each trade and presents the data in a structured way.

Here's a breakdown of what it does:

*   **Tracks Performance:** It analyzes closed signals to determine their effectiveness.
*   **Creates Reports:** Generates Markdown reports summarizing the signal performance. These reports are organized by symbol, strategy, exchange, and timeframe.
*   **Saves Results:** Automatically saves these reports to your logs directory.
*   **Clears Data:** You can clear the recorded data, either for a specific backtest setup or all of them at once.
*   **Subscription:** It allows you to connect to the backtesting process and receive updates as trades happen. You can unsubscribe when you no longer need those updates.



The `getStorage` property is a key component, managing separate storage areas for each unique combination of symbol, strategy, exchange, and timeframe, ensuring that data doesn't get mixed up.

## Class BacktestLogicPublicService

This service helps you run backtests easily by handling some of the setup behind the scenes. It manages things like the strategy name, exchange, and frame – so you don’t have to pass them around as parameters every time. Think of it as a helper that automatically sets the stage for your backtesting process.

Essentially, it simplifies running backtests by automatically providing the necessary context, making your code cleaner and easier to read. The `run` method is the main way to start a backtest and it streams the results as you go, allowing you to process them incrementally.

## Class BacktestLogicPrivateService

BacktestLogicPrivateService helps you run backtests efficiently, especially when dealing with a lot of data. It works by first getting the time periods you want to test, and then stepping through them one by one. Whenever a trading signal appears (like a buy or sell signal), it fetches the necessary historical price data and runs the backtesting logic. 

Instead of storing everything in memory, it sends the results to you as they become available, using a technique called an asynchronous generator. This is great for keeping your computer from running out of memory.  You can even stop the backtest early if you want by interrupting the process.

The service relies on other components like a logger, strategy core, exchange core, frame core, and method context service to handle different parts of the backtesting process. The `run` method is your entry point – you give it a symbol (like "BTCUSDT"), and it starts the backtest, providing you with a stream of backtest results.

## Class BacktestCommandService

This service acts as a central hub for running backtests within the backtest-kit framework. It simplifies access to the underlying backtesting engine and is designed to be easily integrated into your application using dependency injection. Think of it as a friendly interface for triggering and managing backtest processes. 

It relies on several other services for things like validating strategies, exchanges, and frames, ensuring everything is set up correctly before the backtest begins.

The core function, `run`, is your go-to method for initiating a backtest. You provide the trading symbol you want to test, along with details about the strategy, exchange, and frame you’ll be using – and it handles the rest, returning a stream of backtest results as the process unfolds.


## Class ActionValidationService

The ActionValidationService helps keep track of your action handlers – those pieces of code that respond to specific events or requests in your system. It's designed to make sure these handlers exist before your application tries to use them, preventing unexpected errors. 

You can think of it as a central registry where you add your action handler definitions. The service provides ways to register new handlers, check if a particular handler exists, and view a complete list of all registered handlers. 

To speed things up, it remembers the results of its checks, so it doesn’t have to re-validate handlers repeatedly. This is particularly useful when you have a lot of action handlers in your application. 



The `addAction` method lets you register a new action handler. The `validate` method verifies that a handler is registered. Finally, the `list` method allows you to view all registered actions.

## Class ActionSchemaService

The ActionSchemaService is responsible for keeping track of and managing different action schemas, which define how actions are handled within the system. Think of it as a central library for defining and organizing these action blueprints.

It ensures that these schemas are set up correctly and consistently, using type safety to prevent errors. The service validates that the actions adhere to defined rules, particularly that the methods used to handle them are permissible. 

You can register new action schemas, updating them incrementally with the `override` method, which is handy for small changes. If you need to adjust a schema without completely re-registering it, this is the way to go.  The `get` method provides a way to retrieve a fully configured action schema when needed.

## Class ActionProxy

The `ActionProxy` acts as a safety net when using custom action handlers in your trading strategy. It's designed to prevent errors in your own code from crashing the entire backtesting or live trading system. 

Think of it as a wrapper that catches any mistakes happening within your custom logic, logs them, and keeps things running smoothly.  If a method isn't implemented in your custom handler, `ActionProxy` handles that gracefully, returning a default value instead of causing problems.

You don't directly create `ActionProxy` instances; instead, you use the `fromInstance()` method to create one that wraps your own action handler.  This ensures consistent error handling across various events like signal generation, profit/loss adjustments, and cleanup when the strategy is finished.  Each of the methods (`init`, `signal`, `signalLive`, etc.) are individually wrapped to handle errors securely.

## Class ActionCoreService

The ActionCoreService is the central hub for managing how strategies take action – it’s like a traffic controller for signals and events. It fetches lists of actions defined in a strategy's blueprint, checks that everything is configured correctly, and then sends those signals to the appropriate action handlers one after another.

Think of it this way: When a strategy needs to buy, sell, or adjust a position, this service orchestrates the process, ensuring the right actions happen in the right order.

It offers several methods to handle different types of events: `signal`, `signalLive`, `signalBacktest`, `breakevenAvailable`, `partialProfitAvailable`, `partialLossAvailable`, `pingScheduled`, `pingActive`, `riskRejection`, and `dispose`. Each of these methods retrieves the list of defined actions and sequentially invokes the corresponding handlers.

The `validate` function is a key safety check, verifying things like the strategy name, exchange, and any associated risks or actions. It's designed to be efficient, remembering previous checks to avoid unnecessary work.

Finally, `initFn` prepares the actions at the beginning of a strategy's run, while `dispose` cleans up afterward, ensuring a smooth and reliable process.  The `clear` method provides a way to wipe the action data entirely, either selectively or for everything.

## Class ActionConnectionService

The `ActionConnectionService` acts as a central hub for directing different action requests to the correct implementations. It's designed to make sure that each action is handled by the right "ClientAction" instance, considering factors like the specific action being requested, the trading strategy in use, the exchange involved, and the timeframe. 

To improve performance, it uses a caching mechanism – once an "ClientAction" is created for a particular combination of these factors, it's stored and reused for subsequent requests. This avoids unnecessary re-creation.

The service offers various methods for handling different events and actions: `signal`, `signalLive`, `signalBacktest`, `breakevenAvailable`, `partialProfitAvailable`, `partialLossAvailable`, `pingScheduled`, `pingActive`, `riskRejection`, and `dispose`. These methods route relevant data to the appropriate "ClientAction" for processing. You can also clear the cached actions when they are no longer needed. The `getAction` property provides the core functionality for retrieving and managing these action instances.

## Class ActionBase

This base class, `ActionBase`, provides a starting point for creating custom handlers that respond to events within your trading strategy. Think of it as a central hub for your strategy's extra actions, like sending notifications, logging data, or managing state. It takes care of the basic setup and logging, so you only need to focus on what you want your custom actions to *do*.

When you extend `ActionBase`, you'll get access to crucial information like the strategy's name, frame, and the specific action being triggered.  The class also provides default implementations for all the event handlers, so you don’t *have* to implement everything – just the parts you need.

The lifecycle is straightforward: initialization (`init`), event handling (`signal`, `breakevenAvailable`, etc.), and cleanup (`dispose`).  There are different signal events for live and backtesting, so you can tailor your actions accordingly. For instance, `signalLive` is for actions only appropriate during live trading, while `signalBacktest` is specific to backtesting scenarios.  `dispose` is where you'll clean up any resources used during the strategy's runtime.



This framework helps organize your code and ensures consistent event logging, making it easier to build and maintain complex trading strategies.
