---
title: docs/internals
group: docs
---

# backtest-kit api reference

![schema](../assets/uml.svg)

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


# backtest-kit functions

## Function setLogger

This function lets you customize how the backtest-kit framework reports information. You can provide your own logger to handle log messages, allowing you to direct them to a file, a database, or any other logging destination you prefer.  The framework automatically adds helpful context to each log message, like the strategy name, exchange, and the symbol being traded, making it easier to understand what's happening during your backtests. To use it, just pass in an object that implements the `ILogger` interface.

## Function listenSignalOnce

This function lets you set up a temporary listener for signals from your trading strategy. You provide a filter that defines which signals you're interested in, and a function to run when a matching signal arrives. 

Once that first matching signal is detected, the provided function runs, and the listener automatically disappears – no need to manually unsubscribe. This is really handy when you need to react to a specific, one-time signal condition within your backtesting setup.

Essentially, it’s a convenient way to wait for and react to a single event. 

You specify a filter to determine which signals you want to listen for, and then provide a callback function that will execute only once when a matching signal is received.

## Function listenSignalLiveOnce

This function lets you temporarily hook into live trading signals, but only to receive one specific event. Think of it as setting up a quick, single-use listener.

It works by letting you define a filter – a condition that must be met – and a callback function that gets executed only when a signal event passes that filter. 

Once the matching event arrives, your callback runs, and the listener automatically disappears, ensuring it doesn't continue to trigger unnecessarily. It’s great for things like capturing a single data point or reacting to a specific market condition during a live trading simulation. 

You provide a function (`filterFn`) that decides which signals to pass through and another function (`fn`) that does something with the signal it receives.


## Function listenSignalLive

This function lets you tap into the live trading signals generated by backtest-kit. Think of it as setting up a listener that gets notified whenever a trading signal is produced during a live simulation.

It’s designed to handle events from executions started with `Live.run()`.  The signals arrive one at a time, in the order they happen, ensuring that your code processes them sequentially.

You provide a function that will be called with each signal; this function will receive data about the signal, represented as an `IStrategyTickResult`.  The function you provide returns another function that allows you to unsubscribe from receiving those live signals when you’re done.


## Function listenSignalBacktestOnce

This function lets you temporarily listen for specific signals generated during a backtest. You provide a filter that defines which signals you're interested in, and a function to execute when a matching signal appears. Once that one signal is processed, the listener automatically stops, ensuring it doesn't continue running unnecessarily. Think of it as a quick and clean way to react to a single event during a backtest run. It’s useful for things like logging a specific trade execution or triggering a one-off calculation.


## Function listenSignalBacktest

This function lets you tap into the flow of your backtesting process, allowing you to react to events as they happen. It sets up a listener that receives updates during a backtest run, specifically from `Backtest.run()`. Think of it as a way to get notified about each tick and respond to it, one after another, in the order they occurred. You provide a function that will be called with each signal event, letting you do whatever you need with that information. The function you provide will be executed for each signal. When you’re done listening, the function it returns lets you unsubscribe from these updates.

## Function listenSignal

This function lets you easily listen for updates from your trading strategy. Whenever your strategy generates a signal – like when a trade is opened, closed, or changes state – this function will call a function you provide. 

Importantly, these updates are handled one at a time, even if your provided function needs to do some asynchronous processing. This helps ensure things happen in the order they're received and prevents conflicts.

To use it, you simply pass a function that will be called with each signal event. This function receives an object containing information about the signal. The function that `listenSignal` returns is used to unsubscribe from the listener.

## Function listenError

This function lets you tap into errors that happen behind the scenes when using background tasks within your trading strategies, either in live trading or during backtesting. It’s like setting up an error listener for those hidden operations. 

Any errors that occur within `Live.background()` or `Backtest.background()` will be reported to your provided function.  Importantly, these errors are handled in the order they happen, and even if your error handling function takes some time to process each error (like doing something async), the errors will be processed one at a time to avoid any unexpected interactions. This ensures a reliable and predictable way to manage any issues that arise during background processing. 

You provide a function that will be called whenever an error happens. The function receives the error object itself as an argument.  The `listenError` function returns a function you can use later to unsubscribe from these error notifications.

## Function listenDoneOnce

This function lets you react to when background tasks finish, but only once. It's helpful for things you need to do just after a process completes. 

You provide a filter to specify which completion events you're interested in, and then a function to run when that specific event happens. Once the function runs, it automatically stops listening for those events, so you don't need to worry about manually unsubscribing. It works with both Live and Backtest environments for background task completion notifications.

## Function listenDone

This function lets you monitor when background tasks finish, whether they’re running within a live trading environment or a backtest. Think of it as setting up a notification system for when those background processes are done. Importantly, any code you put inside your notification function will run one step at a time, even if it's asynchronous, to avoid conflicts and ensure things proceed in the order they were initiated. You provide a function that will be called when the background task completes, and this function returns another function that you can use to unsubscribe from those notifications later.

## Function getMode

This function lets you find out whether the trading framework is running in backtest mode or live trading mode. It returns a promise that resolves to either "backtest" or "live", telling you exactly what environment the system is operating in. This is helpful for adapting your code based on the current execution context. Essentially, it's a quick way to know if you're testing or actually trading.

## Function getDate

This function, `getDate`, gives you access to the current date within your trading strategy. Think of it as a way to know what date your calculations are based on. When you're backtesting, it will return the date associated with the specific timeframe you're analyzing. If you're running your strategy live, it will return the actual current date. It's a simple way to incorporate date-based logic into your trading decisions.

## Function getCandles

This function helps you retrieve historical price data, like open, high, low, and close prices, for a specific trading pair. You tell it which pair you're interested in (e.g., BTCUSDT), the time frame you want the data for (like 1-minute intervals or 4-hour intervals), and how many candles you need. It then pulls that data from the exchange you're connected to, giving you a look at past price movements to help analyze trends or test trading strategies. The data is provided as an array of candle objects.

## Function getAveragePrice

This function helps you figure out the average price of a trading pair, like BTCUSDT. It does this by looking at the last few minutes of trading data and calculating a Volume Weighted Average Price, or VWAP. Basically, it considers both the price and how much was traded at each price point. 

If there’s no trading volume data available, the function will instead calculate a simple average of the closing prices. To use it, you simply need to provide the symbol of the trading pair you're interested in.

## Function formatQuantity

This function helps you present quantity values in the exact format required by the trading exchange you're using. It takes the trading pair symbol, like "BTCUSDT," and a raw quantity number as input. It then uses the exchange’s specific rules to format the quantity correctly, ensuring you have the right number of decimal places. Think of it as automatically handling the nuances of how different exchanges represent quantities.




It returns a string representing the formatted quantity.

## Function formatPrice

This function helps you display prices in the correct format for a specific trading pair. It takes the symbol, like "BTCUSDT", and the raw price value as input. It then uses the exchange's rules to ensure the price is formatted accurately, including the right number of decimal places. This is especially useful for presenting prices clearly to users or in reports, avoiding potential confusion caused by inconsistent formatting. 

It returns a string representing the formatted price.

## Function addStrategy

This function lets you add a trading strategy to the backtest-kit framework. Think of it as registering your trading logic so the system knows how to run it. When you add a strategy, the framework will check to make sure everything is set up correctly, like ensuring the price data and stop-loss/take-profit calculations make sense. It also helps prevent your strategy from sending too many signals too quickly and makes sure your strategy’s data can survive unexpected system interruptions when running in a live environment. You provide a configuration object that describes how your strategy works.

## Function addFrame

This function lets you tell backtest-kit about a specific timeframe you want to use for your backtesting analysis. Think of it as defining the “lookback window” for your tests – when and at what frequency you’re going to pull data. You provide a configuration object describing the start and end dates of your backtest, the interval (like daily, hourly, or weekly), and a function that will be notified about significant events during timeframe generation. By registering these timeframes, you're essentially setting up the backbone of how your backtesting data will be structured.

## Function addExchange

This function lets you tell backtest-kit where to get your historical market data. Think of it as connecting the framework to a specific data source, like Binance or Coinbase. You provide a configuration object that describes how to access the data, including how to fetch historical price information and format trade details. By registering an exchange, the framework knows where to pull data for your trading strategies.

# backtest-kit classes

## Class StrategyValidationService

The `StrategyValidationService` helps ensure your trading strategies are set up correctly before you start backtesting. It acts like a gatekeeper, making sure your strategy definitions are valid and conform to the expected structure. 

You can think of it as a way to register your strategies and then confirm they are properly defined. The `addStrategy` function allows you to register a strategy along with its blueprint (the schema).  Then, the `validate` function checks if a specific strategy, represented by its name and the source code, aligns with its registered schema. This helps catch potential errors early on, preventing unexpected behavior during backtesting.

## Class StrategySchemaService

The StrategySchemaService helps you keep track of your trading strategies and their configurations in a structured and type-safe way. Think of it as a central hub for defining and managing what your strategies look like. 

You can register new strategy definitions using `addStrategy()`, effectively adding them to the system's knowledge base. When you need to use a specific strategy, you can retrieve its details by name using `get()`.

Before a strategy is added, `validateShallow()` checks that it has the essential building blocks and that they are the right types. If you want to update an existing strategy, `override()` lets you change specific parts of its definition without replacing the entire thing. 




The service relies on a logger for tracking what's happening and uses a special type-safe registry to store everything.

## Class StrategyGlobalService

This service helps you interact with your trading strategies within the backtest environment. It acts as a central point for things like checking signals, performing quick backtests, and stopping strategies from generating new signals.

Think of it as a helper that automatically sets up the context for your strategies – ensuring they know what symbol they're trading, when, and whether it’s a backtest.

You can use it to quickly run tests against historical candle data.

If you need to halt a strategy’s signal generation, this service handles that as well. 

Finally, it also provides a way to clear out cached strategy information, forcing a refresh when needed.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub for interacting with your trading strategies. It automatically directs your requests—like getting signals or running backtests—to the correct strategy based on the context of your application. 

Think of it as a smart router; it ensures that each strategy is used where it's needed and it keeps track of the strategies it's using to avoid unnecessary overhead. The service uses a caching system, so it remembers which strategies it's working with and doesn’t have to recreate them every time. 

Before running any operations, it makes sure that the strategies are properly initialized. This service provides methods for live trading (`tick`), historical analysis (`backtest`), stopping a strategy’s activity (`stop`), and even clearing out the stored strategies for a fresh start (`clear`).

## Class PersistSignalUtils

This class, PersistSignalUtils, helps manage how trading signals are saved and loaded, ensuring your strategies remember their state even if things go wrong. It acts as a central place to handle signal persistence, especially used by the ClientStrategy when it's actively trading.

Think of it as a smart storage system for your signals, automatically creating separate storage areas for each trading strategy.  You can even customize how these signals are stored by plugging in your own adapter.

The `readSignalData` function retrieves previously saved signal information for a specific strategy and trading symbol, helping your strategy pick up where it left off.  `writeSignalData` safely saves new signal data to disk using a method that prevents data loss if the system crashes mid-save. The `usePersistSignalAdapter` method allows you to build your own storage solutions by registering custom persistence adapters.

## Class LoggerService

The LoggerService helps keep your backtesting logs organized and informative. It acts as a central point for all logging within the backtest-kit framework. You can provide your own custom logger, or it will default to a basic "no-op" logger that doesn't actually write anything if you don't. 

It automatically adds helpful details to each log message, like the name of your trading strategy, the exchange you’re using, and the specific frame being processed. It also includes information about the asset you’re trading and when the log message occurred. 

You can use the `log`, `debug`, `info`, and `warn` methods to output messages at different severity levels, all with that automatic context injected.  Finally, if you have a preferred logging library, you can easily configure the LoggerService to use it via the `setLogger` method.

## Class LiveUtils

The `LiveUtils` class helps you manage live trading sessions in a more straightforward way, offering a simplified interface for running trades and monitoring their progress. Think of it as a central hub for interacting with your live trading environment.

It provides a `run` function, which is the primary tool for live trading. This function creates an infinite stream of trading results – imagine a continuous flow of information about your trades. Importantly, if something goes wrong and your program crashes, the trading process can restart and pick up where it left off thanks to persistent state.

If you just need to run live trading for things like triggering callbacks or storing data without actively processing the results, you can use the `background` function. It keeps the trading process running in the background and handles everything internally.

To get a summary of what's happened during a live trading session, use `getReport`. This function compiles a detailed markdown report of all the events that occurred. Finally, the `dump` function allows you to save that report directly to a file on your disk for later review.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create reports about your trading strategies, saving them as markdown files. It listens to every tick and records important events like when a strategy is idle, opens a trade, is active, or closes a trade. 

You'll get nicely formatted markdown tables summarizing these events, along with key trading statistics like win rate and average profit/loss. These reports are saved to a `logs/live/{strategyName}.md` file for each strategy you're running.

The service uses a logger for debugging and keeps data isolated for each strategy to prevent interference. 

To get started, the service automatically initializes when you first use it. You can also clear the accumulated data for specific strategies or for all strategies at once. Finally, you can manually dump reports to disk, specifying a custom path if needed.

## Class LiveLogicPublicService

This service helps orchestrate live trading while conveniently handling the surrounding context. Think of it as a layer on top of the private trading logic that automatically passes along details like the strategy name and exchange.

It provides a continuous stream of trading signals, both opening and closing, as an infinite generator – meaning it runs perpetually.  The system can gracefully recover from crashes by restoring its state from disk, keeping things running smoothly.

To start live trading, you simply call the `run` method, providing the trading symbol. The beauty is that all the underlying functions will automatically understand which strategy and exchange you're working with, making your code cleaner and easier to manage.

## Class LiveLogicPrivateService

This service handles the ongoing process of live trading, designed to run continuously. It acts as the core engine, constantly monitoring market data and reacting to signals. 

The service operates in an infinite loop, regularly checking for new signals and yielding only the results when a trade is opened or closed – it doesn't send updates when nothing significant happens.  It's built to be resilient; if the process crashes, it automatically recovers and picks up where it left off, thanks to its connection to the strategy's stored state.  The way it’s structured using an asynchronous generator ensures efficient use of memory as it processes data in a streaming fashion. You provide a symbol, and it continuously generates updates on the trading activity for that symbol.

## Class LiveGlobalService

This service acts as a central hub for accessing live trading features within the backtest-kit framework. Think of it as a convenient way to inject dependencies and access the underlying live trading logic. 

It provides access to tools for logging, validation of strategies and exchanges, and most importantly, the ability to run live trading sessions. 

The `run` function is the key component – it starts and manages a continuous live trading process for a specific symbol. It's designed to keep running indefinitely, automatically recovering from any crashes to ensure uninterrupted trading. You provide the symbol you want to trade and some context to identify the strategy and exchange being used.

## Class FrameValidationService

The FrameValidationService helps ensure your trading framework is set up correctly by checking if the expected data structures, or "frames," exist and conform to their defined formats. It keeps track of the frames you're expecting, letting you add new ones as needed.  You tell the service what frames you’re working with and what their structure should be. Then, you can use the validation function to confirm that the data you’re receiving actually matches those expected structures. This service helps catch configuration errors early, making your backtesting more reliable. The `addFrame` method lets you register a frame schema, and the `validate` method is used to confirm that data for a given frame is present and valid.

## Class FrameSchemaService

The FrameSchemaService helps you keep track of the different structures your backtesting system uses. It's like a central library for defining how your data is organized.

It uses a special type-safe system to store these definitions, making sure everything is consistent. You can add new structures using `register`, update existing ones with `override`, and fetch them by name using `get`. 

The service also has a built-in check (`validateShallow`) to make sure new structures have the necessary pieces in place before they’re officially added. This helps prevent errors later on.

## Class FrameGlobalService

The FrameGlobalService helps manage timeframes needed for backtesting. It's a behind-the-scenes component that uses a connection to retrieve data and create those timeframe arrays. Think of it as the engine that provides the sequence of dates for your backtest to run against a specific asset.  It's tightly integrated, relying on other services for data access and logging. The `getTimeframe` function is its key feature – you’ll use it to get the dates needed for a particular symbol.

## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing specific trading frames within your backtesting environment. It intelligently routes requests to the correct frame implementation based on the active method context, essentially making sure the right frame handles the right operations. 

To improve efficiency, it keeps track of previously created frame instances, reusing them whenever possible. This avoids unnecessary creation overhead.

You can think of it as a smart router that finds the right frame and keeps things organized. The `getFrame` method is your main way to access these frames, and the `getTimeframe` method lets you define the start and end dates for your backtesting period, focusing your analysis on specific time windows. When running in live mode, frames are not constrained.

## Class ExchangeValidationService

This service helps ensure your trading exchanges are properly defined and consistent within the backtest-kit framework. It acts like a gatekeeper, verifying that each exchange you want to use has a clear and valid structure.

You can think of it as a way to prevent errors later on by confirming your exchange setups are correct upfront. 

The `addExchange` method is how you tell the service about a new exchange, providing its name and a description of its expected format. The `validate` method then checks if an exchange actually exists and is properly configured. The service utilizes a logger, so any validation issues will be reported there.

## Class ExchangeSchemaService

This service helps you keep track of your exchange schema definitions in a safe and organized way. It acts like a central repository for these schemas, ensuring consistency and type safety. 

You can add new exchange schemas using the `addExchange` function (represented by `register` in the code), and retrieve them later by their name using the `get` function. The service uses a registry to store these schemas, leveraging type information to prevent errors.

Before adding a schema, the `validateShallow` function performs a quick check to make sure it has all the necessary properties and data types. If you need to update an existing schema, the `override` function allows you to make partial changes. The `loggerService` property gives you access to logging functionality for debugging and monitoring.

## Class ExchangeGlobalService

This service helps you interact with an exchange, making sure the right information about the trading environment is available. It combines a connection to the exchange with details about the specific symbol, time, and backtesting settings.

You've got methods for getting historical candle data, and a special method to retrieve future candles – which is used specifically when backtesting. It can also calculate the average price (VWAP) and format prices and quantities, ensuring they’re presented correctly based on the current context. This service is a crucial part of how the backtesting framework communicates with exchanges.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It handles the complexities of connecting to each exchange and routing your requests to the correct implementation.

Think of it as a smart dispatcher – it automatically figures out which exchange you’re trying to use based on your current context. It keeps a record of previously used exchanges to avoid unnecessary connections, making things faster and more efficient.

You can use it to retrieve historical candle data, get the next set of candles based on your trading timeline, and fetch the current average price. It also ensures that prices and quantities are formatted correctly, adhering to the specific rules of each exchange you’re using. This helps prevent errors when placing orders.

## Class ClientFrame

The `ClientFrame` is a component that helps create timelines for backtesting trading strategies. Think of it as a factory that generates lists of timestamps representing a specific period of historical data. 

It's designed to be efficient; it remembers previously calculated timelines and reuses them, avoiding unnecessary work. You can configure how far apart these timestamps are, from one minute to three days.

Furthermore, you can add custom checks and record events as these timelines are built, giving you more control and insight into the process. This is especially helpful when you're working with the backtesting engine to simulate trades over time. 

The `getTimeframe` property is the core of this component – it's what actually produces the timestamp arrays for your backtest.


## Class ClientExchange

The `ClientExchange` class helps your backtesting system connect to and retrieve data from an exchange. It's designed to be memory-efficient by using prototype functions.

You can use it to get historical candle data, moving backward in time from a specific point.  It also enables fetching future candle data, which is really useful when simulating trading strategies in a backtest.

Calculating the VWAP (Volume Weighted Average Price) is also a supported feature, leveraging the last five one-minute candles to get an average price that considers volume.

Finally, the `ClientExchange` provides handy functions to properly format quantities and prices to match the exchange's precision rules, ensuring your orders are correctly represented.

## Class BacktestUtils

The `BacktestUtils` class is a helpful tool for running and analyzing backtests within the framework. Think of it as a central place to start backtest runs and get useful reports.

The `run` property lets you kick off a backtest for a specific trading symbol, providing information like the strategy name, exchange, and timeframe. It gives you results as they come, allowing you to monitor the backtest's performance.

Need to run a backtest silently, perhaps just for logging or triggering some other action? Use the `background` property to start a backtest that runs in the background without showing you the intermediate results.

After a backtest is complete, you can easily generate a detailed report in markdown format using the `getReport` property, summarizing the trading signals. 

Finally, the `dump` property lets you save that report directly to a file on your computer.

## Class BacktestMarkdownService

This service helps you create readable reports about your backtesting results. It listens for trading signals and keeps track of closed trades for each strategy you're testing. The information is organized and presented in nicely formatted markdown tables, making it easy to analyze what happened during your backtest.

The service automatically saves these reports as markdown files in your logs/backtest directory, named after the strategy being tested. Each strategy gets its own dedicated report file.

You can clear the accumulated trading data at any point, either for a specific strategy or for all strategies, allowing you to start fresh for new backtests. The service also handles initialization automatically, so you don't need to worry about setting it up manually. It uses a logger service for any necessary debugging output and utilizes memoization to efficiently manage the storage of trading data for each strategy.

## Class BacktestLogicPublicService

This service helps manage and run backtests in a straightforward way. It takes care of automatically passing along important information like the strategy name, exchange, and frame, so you don't have to repeatedly specify them in your code. 

Think of it as a helper that simplifies the backtesting process, particularly when dealing with functions like fetching candles or generating signals.

The `run` method is your main tool for kicking off a backtest for a specific trading symbol. It sends back a stream of results, making it easy to process the backtest data step-by-step. This stream carries all the necessary context information behind the scenes.


## Class BacktestLogicPrivateService

The `BacktestLogicPrivateService` helps you run backtests efficiently. It works by fetching timeframes and processing them one by one, which means it doesn't need to store everything in memory at once. 

When a trading signal tells the system to open a position, it fetches the necessary candle data and performs the backtest calculations. The service then skips over timeframes while a position is open.

The results are provided as a stream of closed signals, making it easy to analyze the backtest outcomes without building up large arrays. You can even stop the backtest early if needed.

To actually run a backtest, you’ll call the `run` method, providing the symbol you want to backtest. This method returns an async generator that will yield the closed trading results as the backtest progresses. 

The service relies on other services like `loggerService`, `strategyGlobalService`, `exchangeGlobalService`, and `frameGlobalService` to handle logging, strategy management, exchange data, and timeframe data respectively.

## Class BacktestGlobalService

The BacktestGlobalService acts as a central hub for running backtests within the framework, making it easy to manage dependencies and access key backtesting components. It’s like a helper class that simplifies the process of launching a backtest.

You’re essentially given access to underlying services for logging, validating strategies, exchanges, and frames.

The most important thing it offers is the `run` function, which is how you kick off the backtesting process. You provide the symbol you want to backtest and some context – the names of the strategy, exchange, and frame you’re using – and it returns a sequence of results, allowing you to analyze the performance of your trading strategy.

# backtest-kit interfaces

## Interface IStrategyTickResultOpened

This interface represents the result you receive when a new trading signal is created within your backtesting strategy. It's specifically triggered after a signal has been validated and saved, marking the moment a trade is initiated. 

You'll find details about the newly created signal, including its unique ID and all associated data, within the `signal` property. It also provides information about which strategy and exchange generated the signal, along with the current VWAP price at the time the trade was opened. This allows for precise tracking and analysis of your trading decisions.

## Interface IStrategyTickResultIdle

This interface represents what happens when your trading strategy is in a resting, or "idle," state. It means there's no active trading signal being generated right now. 

The `action` property confirms that the strategy is indeed idle. You’ll see the strategy name, the exchange it's connected to, and the current VWAP price at the time the idle state was recorded.  Essentially, it provides context about what was happening when the strategy wasn't actively trading. The `signal` property is explicitly set to `null` to clearly indicate the absence of a signal.

## Interface IStrategyTickResultClosed

This interface represents the result you get when a trading signal is closed by your strategy. It contains all the important information about the closing event, including why the signal was closed (like reaching a take-profit or stop-loss), the final price used for calculations, and a detailed breakdown of the profit or loss, factoring in fees and slippage. You’ll find the original signal parameters here, along with details like the strategy and exchange names used for tracking purposes. Essentially, this provides a comprehensive snapshot of a completed trading signal and its financial outcome.


## Interface IStrategyTickResultActive

This interface describes a tick result within the backtest-kit framework when a trading strategy is actively monitoring a signal. It means the strategy has generated a signal and is now waiting for a specific event like a take-profit or stop-loss trigger, or a time expiration.

The `action` property confirms the strategy is in an "active" state, acting as a clear identifier. You'll also find the `signal` itself, which represents the details of the signal being tracked. 

Alongside the signal, the `currentPrice` gives you the prevailing VWAP price used for monitoring the trade. Finally, the `strategyName` and `exchangeName` help you track which strategy and exchange are associated with this active trade.

## Interface IStrategySchema

This interface, `IStrategySchema`, is the blueprint for defining how a trading strategy works within the backtest-kit framework. Think of it as the recipe you provide so the system knows how to generate trading signals. 

It requires a unique `strategyName` to identify it.  You also specify an `interval` to control how often signals are generated, preventing overwhelming the system.

The core of the schema is the `getSignal` function. This is the function you write to analyze market data and decide whether to buy, sell, or hold a specific asset. It returns a signal when one exists and returns `null` otherwise. 

Finally, you can optionally define `callbacks` – functions that are triggered at specific points in the strategy's lifecycle, like when it starts or stops.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the outcome of a trading strategy's profit and loss calculation. It gives you the key numbers to understand how well a strategy performed. You’ll find the profit or loss expressed as a percentage of your investment, offering a clear picture of the strategy's return. 

The `priceOpen` property tells you the price at which your trades entered the market, already taking into account small fees and slippage. Similarly, `priceClose` shows the price at which trades exited, also adjusted for those same fees and slippage.

## Interface IStrategyCallbacks

This interface lets you hook into important moments in a trading strategy's lifecycle. Think of it as a way to be notified and react to what's happening with your strategy. 

You can receive updates on every tick of the market with `onTick`.  `onOpen` alerts you when a new trading signal is created and ready to go. `onActive` lets you know when a strategy is actively monitoring a signal. When nothing is being actively traded, `onIdle` provides a notification. Finally, `onClose` tells you when a trading signal has been closed and provides the closing price. These callbacks allow you to customize your strategy's behavior based on its current state.

## Interface IStrategy

The `IStrategy` interface outlines the essential methods a trading strategy needs to function within the backtest-kit framework.

The `tick` method is the heart of the strategy’s operation, handling each new market data point and performing calculations like VWAP and signal checks. It's designed to be efficient, so signal generation is carefully managed.

For quick testing with past data, the `backtest` method lets you run your strategy against a series of historical candles to see how it would have performed.

Finally, the `stop` method allows you to pause the strategy’s signal generation without abruptly closing any existing orders. It’s a way to gently end a strategy’s activity while allowing open positions to complete naturally.

## Interface ISignalRow

This interface represents a single trading signal that's ready to be used within the backtest-kit framework. Think of it as a finalized signal – it's been checked for validity and is now equipped with all the necessary information to execute a trade. Each signal gets a unique ID automatically assigned, which helps track it throughout the system.

You'll find details like the exchange being used, the strategy that generated the signal, the exact time it was created, and the trading symbol (like BTCUSDT) all contained within this structure. It’s a core building block for creating and managing automated trading strategies.

## Interface ISignalDto

The `ISignalDto` represents a trading signal, acting as a structured way to communicate the details of a potential trade. When you request a signal, this object will be returned, containing all the necessary information to execute a trade. 

It includes an optional ID, which will be automatically generated if you don't provide one.  You'll specify whether the trade should be a "long" (buy) or "short" (sell) position. A human-readable note explains the reasoning behind the signal.

The `priceOpen` indicates the entry price for the trade.  For long positions, the `priceTakeProfit` (target price) should be higher than the entry price, and the `priceStopLoss` should be lower. Conversely, for short positions, the target price should be lower, and the stop loss higher.  Finally, `minuteEstimatedTime` estimates how long the signal is expected to be active before timing out.

## Interface ISignalData

The `ISignalData` interface represents the information saved about a trading signal. It’s designed to store the current state of a signal, including the possibility of it being inactive (represented by a null value). Think of it as a container holding the signal's current condition, allowing for updates to be made safely and atomically. The core of this data is the `signalRow` property, which holds the actual signal data.

## Interface IPersistBase

This interface defines the basic actions you'll use to manage data persistence within the backtest-kit framework. Think of it as a foundation for reading, writing, and checking for the existence of your trading data. 

The `waitForInit` method makes sure the necessary storage area is set up correctly and any initial setup only happens once. `readValue` retrieves a specific data item, while `hasValue` allows you to quickly check if a particular item is already stored. Finally, `writeValue` is how you save your data to persistent storage, ensuring updates happen safely and reliably.

## Interface IMethodContext

The `IMethodContext` interface provides essential information about the trading environment. Think of it as a little package of data that gets passed around to tell the backtest-kit exactly *which* strategy, exchange, and frame it should be using.  It holds the names of these components - specifically, the `exchangeName`, `strategyName`, and `frameName`. The `frameName` will be empty when running in live trading mode, distinguishing it from backtesting. This context ensures the right components are loaded and used for each operation.

## Interface ILogger

The `ILogger` interface is your way to keep track of what's happening inside the backtest-kit trading framework. Think of it as a detailed record-keeping system.

It lets you record messages about different events, using varying levels of importance. You can use `log` for general happenings, `debug` for very specific details useful when you're troubleshooting, `info` to get a sense of overall system activity, and `warn` to flag potential issues that don't stop things from running but might need looking into.

This logging mechanism is used across almost every part of the framework – from how agents work to how data is stored and how policies are checked – making it a powerful tool for understanding, debugging, and monitoring your trading strategies.

## Interface IFrameSchema

The `IFrameSchema` defines the building blocks of your backtesting environment, essentially setting up the time-based structure. It lets you specify a unique name for each frame, along with the time interval (like daily, weekly, or hourly) used to generate timestamps during the backtest. Crucially, you tell the framework the start and end dates that encompass the backtesting period. You can also optionally provide lifecycle callbacks to be triggered at different points in the frame's processing. Essentially, this schema helps organize and define the timeline of your trading simulation.

## Interface IFrameParams

The `IFrameParams` interface defines the information needed when creating a ClientFrame, which is a core component for building trading simulations. It builds upon the `IFrameSchema` to include a logger, allowing you to track and debug what's happening inside the frame during backtesting. Think of the logger as a way to see the internal workings of your simulation as it runs, helping you identify any unexpected behavior. The `logger` property provides a convenient way to send debug messages.

## Interface IFrameCallbacks

This section details the `IFrameCallbacks` interface, which helps you react to significant moments in the backtest framework's timeline generation. Think of it as a way to be notified when the framework figures out the dates and intervals it will use for your backtest.

Specifically, the `onTimeframe` property allows you to provide a function that will be executed immediately after the timeframe array is created.  You can use this to verify the timeframes, log them for debugging, or perform any other actions that need to happen once the timeline is set. The function receives the timeframe array itself, along with the start and end dates and the interval used for creating those timeframes.

## Interface IFrame

The `IFrames` interface is a core component within backtest-kit, responsible for creating the timeline of data your backtesting strategy will work with. Think of it as the engine that builds the sequence of moments in time for your trading simulation. 

Its primary function, `getTimeframe`, generates a list of specific dates and times for a given trading symbol, ensuring they are spaced appropriately based on the timeframe you’ve chosen (like daily, hourly, etc.). This method is a critical part of how backtest-kit organizes and feeds data to your trading algorithms.

## Interface IExecutionContext

The `IExecutionContext` interface holds important information needed during strategy execution and exchange interactions. Think of it as a little package of details passed around to keep everything synchronized. It includes the trading symbol, like "BTCUSDT," so your code knows which asset it's working with. It also carries the current timestamp, crucial for order placement and time-based calculations. Finally, it flags whether the process is a backtest, which helps tailor behavior for simulated trading versus live trading.

## Interface IExchangeSchema

This interface describes how backtest-kit interacts with different cryptocurrency exchanges. Think of it as a blueprint for connecting to a specific exchange, telling the framework where to get historical price data (candles) and how to handle quantities and prices according to that exchange’s rules. 

Each exchange you want to use needs to be registered with the framework using this schema.  It defines a unique name for the exchange and provides a function, `getCandles`, to retrieve historical price information. You'll also specify how to correctly format order quantities and prices to match the exchange's specific precision requirements. 

Finally, you can optionally provide callback functions to be notified about certain events related to candle data, allowing for more customized behavior.

## Interface IExchangeParams

The `IExchangeParams` interface defines the information you need to provide when setting up an exchange within the backtest-kit framework. Think of it as the initial setup instructions for your simulated exchange.

It requires a `logger` so you can track what's happening during your backtesting runs – useful for debugging and understanding your strategy's behavior. 

You also need to supply an `execution` context, which tells the exchange what environment it's operating in, specifying things like the trading symbol and the timeframe you're using. Essentially, it provides the crucial details for the exchange to understand the testing conditions.

## Interface IExchangeCallbacks

The `IExchangeCallbacks` interface lets you hook into events happening when your backtest-kit framework is fetching data from an exchange. It's like setting up listeners for specific moments in the data retrieval process.

Specifically, the `onCandleData` property allows you to receive notifications whenever new candlestick data is successfully retrieved. You'll get details like the symbol (the asset being traded), the interval (e.g., 1 minute, 1 hour), the starting date and time for the data, the number of candles requested, and an array containing the actual candlestick data. This lets you potentially log data, perform real-time analysis, or trigger other actions as data becomes available.

## Interface IExchange

The `IExchange` interface defines how your backtesting environment interacts with an exchange. It's the key to getting historical price data and formatting trade sizes and prices to match the exchange's rules.

You'll use `getCandles` to retrieve past candle data – think of it as grabbing historical price charts. `getNextCandles` is specifically for backtesting, allowing you to simulate fetching future price data.

`formatQuantity` and `formatPrice` are helpers that ensure you’re submitting orders with the correct size and price formatting that the exchange expects.

Finally, `getAveragePrice` calculates the Volume Weighted Average Price (VWAP) using the most recent five minutes of trading activity, which can be useful for evaluating trade execution.


## Interface IEntity

This interface, IEntity, serves as the foundation for all data that gets saved and retrieved within the backtest-kit framework. Think of it as a common blueprint ensuring that every persistent object, like trades or orders, has a consistent structure. It's a core building block, establishing a baseline for how data is managed and organized within the system. If you're defining your own custom data types to be stored, they're likely to implement this interface.

## Interface ICandleData

This interface defines the structure for a single candlestick, representing a specific time period in your trading data. It’s the fundamental building block for many backtesting and analysis tasks. Each candlestick includes the timestamp indicating when the period began, the opening price, the highest and lowest prices reached, the closing price, and the total trading volume during that time. Think of it as a snapshot of price action and trading activity for one specific moment.

## Interface DoneContract

This interface helps you track when background tasks finish, whether they're running a backtest or a live trade. It’s like a notification that lets you know a process has completed. You’re provided with details about the execution, including the exchange used, the name of the strategy that ran, whether it was a backtest or live execution, and the trading symbol involved. Think of it as a record of what just happened behind the scenes.
