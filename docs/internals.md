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

**Architecture Layers:**

* **Client Layer:** Pure business logic without DI (ClientStrategy, ClientExchange, ClientFrame) using prototype methods for memory efficiency
* **Service Layer:** DI-based services organized by responsibility:
  * **Schema Services:** Registry pattern for configuration (StrategySchemaService, ExchangeSchemaService, FrameSchemaService)
  * **Connection Services:** Memoized client instance creators (StrategyConnectionService, ExchangeConnectionService, FrameConnectionService)
  * **Global Services:** Context wrappers for public API (StrategyGlobalService, ExchangeGlobalService, FrameGlobalService)
  * **Logic Services:** Async generator orchestration (BacktestLogicPrivateService, LiveLogicPrivateService)
* **Persistence Layer:** Crash-safe atomic file writes with PersistSignalAdaper

**Key Design Patterns:**

* **Discriminated Unions:** Type-safe state machines without optional fields
* **Async Generators:** Stream results without memory accumulation, enable early termination
* **Dependency Injection:** Custom DI container with Symbol-based tokens
* **Memoization:** Client instances cached by schema name using functools-kit
* **Context Propagation:** Nested contexts using di-scoped (ExecutionContext + MethodContext)
* **Registry Pattern:** Schema services use ToolRegistry for configuration management
* **Singleshot Initialization:** One-time operations with cached promise results
* **Persist-and-Restart:** Stateless process design with disk-based state recovery

**Data Flow (Backtest):**

1. User calls BacktestLogicPrivateService.run(symbol)
2. Async generator with yield streams results
3. MethodContextService.runInContext sets strategyName, exchangeName, frameName
4. Loop through timeframes, call StrategyGlobalService.tick()
5. ExecutionContextService.runInContext sets symbol, when, backtest flag
6. ClientStrategy.tick() checks VWAP against TP/SL conditions
7. If opened: fetch candles and call ClientStrategy.backtest(candles)
8. Yield closed result and skip timeframes until closeTimestamp

**Data Flow (Live):**

1. User calls LiveLogicPrivateService.run(symbol)
2. Infinite async generator with while(true) loop
3. MethodContextService.runInContext sets schema names
4. Loop: create when = new Date(), call StrategyGlobalService.tick()
5. ClientStrategy.waitForInit() loads persisted signal state
6. ClientStrategy.tick() with interval throttling and validation
7. setPendingSignal() persists state to disk automatically
8. Yield opened and closed results, sleep(TICK_TTL) between ticks

**Performance Optimizations:**

* Memoization of client instances by schema name
* Prototype methods (not arrow functions) for memory efficiency
* Fast backtest method skips individual ticks
* Timeframe skipping after signal closes
* VWAP caching per tick/candle
* Async generators stream without array accumulation
* Interval throttling prevents excessive signal generation
* Singleshot initialization runs exactly once per instance

**Use Cases:**

* Algorithmic trading with backtest validation and live deployment
* Strategy research and hypothesis testing on historical data
* Signal generation with ML models or technical indicators
* Portfolio management tracking multiple strategies across symbols
* Educational projects for learning trading system architecture


# backtest-kit functions

## Function setLogger

You can now control how backtest-kit reports its activity by providing your own logging system. The `setLogger` function lets you plug in a logger that conforms to the `ILogger` interface. This means all the framework’s internal messages – things like trade executions, data loading, and error reports – will be sent to your logger. Importantly, useful context like the strategy name, exchange, and trading symbol will automatically be included with each log message, giving you valuable insight into what’s happening during your backtests.

## Function listenSignalOnce

This function lets you subscribe to signals from your backtest, but only for a single event that meets certain criteria. You provide a filter – a test to see if the signal matches what you’re looking for – and a function to run when a matching signal arrives. After that single event is processed, the subscription automatically ends. Think of it as a way to react to a specific condition occurring just once during your backtesting simulation. 

The first argument you give is the filter, defining which signals you’re interested in. The second is the function that gets executed when a signal passes that filter. The function returns another function which you can call to stop the subscription.

## Function listenSignalLiveOnce

This function lets you subscribe to live trading signals, but with a special twist: it only runs your code once and then stops listening. 

You provide a filter – a way to specify which signals you're interested in – and a function to execute when a matching signal arrives. It’s great for quickly reacting to a specific event during a live trading simulation without needing to manually unsubscribe later. The function only works with signals generated from `Live.run()`. 

Think of it as setting up a temporary alert – you define what triggers it, what happens when it triggers, and then it automatically disappears.

## Function listenSignalLive

This function lets you tap into the live trading signals generated by your backtest-kit strategy. Think of it as setting up a listener that gets notified whenever a signal is produced during a live run. Importantly, it queues these signals and processes them one by one, ensuring they're handled in the order they arrive.  You provide a function that will be called for each signal, receiving data about the strategy's current state – essentially, a snapshot of what's happening during the live execution. This is specifically designed for events coming from `Live.run()`.  The function you provide will be executed for each live signal. The returned value of this function can be used to unsubscribe from the listener.

## Function listenSignalBacktestOnce

This function lets you set up a listener that reacts to specific events generated during a backtest simulation. Think of it as a temporary alert system – you specify a condition (using `filterFn`) and a function (`fn`) to run when that condition is met.

The listener is designed to run only once; after it executes your provided function, it automatically stops listening. 

It's useful for actions that should happen only a single time based on a backtest signal, like logging a particular trade or triggering a one-off calculation. You provide a function to determine which events you’re interested in, and another function to process those events.


## Function listenSignalBacktest

This function lets you hook into the backtest process to receive updates as it runs. It provides a way to listen for signal events generated during a backtest execution, specifically those from `Backtest.run()`.  You’re essentially creating a listener that gets called whenever a signal is produced. The signal events are handled one at a time, ensuring they're processed in the order they occur. To use it, you provide a function that will be called with each signal event; this function will receive an `IStrategyTickResult` object containing the details of the signal. The function you provide also returns another function to unsubscribe from these backtest signal events.

## Function listenSignal

This function lets you register a callback that will be triggered whenever the backtest kit generates a signal related to your trading strategy. Think of it as setting up an alert system for key moments in your strategy's execution, like when it’s idle, opens a position, is actively trading, or closes a trade.  The important thing to know is that the events are handled one after another, even if your callback function takes some time to complete – this ensures things stay in the right order and avoids unexpected behavior. To use it, you simply provide a function that will be executed with the signal data. The function returns another function that you can call to unsubscribe from these signals.

## Function listenError

This function lets you keep an eye on errors that happen in the background tasks of your backtest or live trading system. Specifically, it listens for problems occurring within `Live.background()` and `Backtest.background()`. When an error pops up, the provided callback function will be triggered, ensuring that errors are handled in the order they happen, even if the callback itself needs to do some asynchronous work. It uses a queuing system to prevent any chaos from multiple callbacks running at the same time. You simply provide a function to handle these errors, and the framework takes care of the rest.


## Function getMode

This function tells you whether the trading framework is currently running in backtest or live mode. It's a simple way to check if you're simulating trades or actually executing them in a real-time environment. The function returns a promise that resolves to either "backtest" or "live", giving you clear indication of the operational context. You can use this information to adjust your code's behavior depending on the execution mode.

## Function getDate

This function, `getDate()`, helps you retrieve the current date within your trading strategy. It’s a straightforward way to know what date your code is operating on. When running a backtest, it gives you the date associated with the historical data you're analyzing. If you're running live, it provides the actual current date. It’s useful for things like conditional logic based on dates, or for displaying date information to the user.

## Function getCandles

This function lets you retrieve historical price data, like open, high, low, and close prices, for a specific trading pair. Think of it as requesting a chart of past prices. You tell it which trading pair you're interested in (like BTCUSDT), the timeframe you want (like 5-minute intervals), and how many candles (price bars) you need. The function then pulls this data from the exchange you’re connected to. It’s a core function for analyzing past performance and building trading strategies.


## Function getAveragePrice

This function helps you find the average price of a trading pair, specifically using a method called VWAP. It looks at the last five minutes of trading data to figure out this average, weighing prices by the volume traded at each price point.  If there's no trading volume recorded, it falls back to simply averaging the closing prices. You provide the trading pair's symbol, like "BTCUSDT," and it returns a promise that resolves to the calculated average price.

## Function formatQuantity

The `formatQuantity` function helps you make sure the amounts you're trading are expressed correctly for the specific exchange you're using. It takes the trading pair, like "BTCUSDT", and the raw quantity you want to trade. The function then applies the exchange's rules for displaying the quantity, ensuring it has the right number of decimal places. This is essential for submitting valid orders. Think of it as a way to automatically handle the often-complex formatting requirements of different exchanges.

## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes the symbol of the trading pair, like "BTCUSDT," and the raw price value as input. It then uses the specific formatting rules for that exchange to ensure the price is shown with the correct number of decimal places, which is important for accurate representation. Essentially, it makes sure your displayed prices look right according to the exchange's standards.

## Function addStrategy

This function lets you add a trading strategy to the backtest-kit framework, essentially telling the system about a new way to make trades. When you add a strategy, it's automatically checked to make sure it’s set up correctly—things like the price data, take profit/stop loss rules, and timing are all verified. The framework also helps prevent signals from being sent too frequently and ensures the strategy's state is safely stored even if the system crashes during live trading. You provide a configuration object describing your strategy, and the framework takes care of the rest.

## Function addFrame

This function lets you tell backtest-kit how to create the timeframes it will use for testing your strategies. Think of it as defining the scope and frequency of your backtest. You provide a schema that outlines when the backtest starts and ends, and how often new timeframes (like minute, hourly, daily) should be generated. This is crucial for setting up the testing environment to accurately simulate trading conditions. By registering a frame, you’re essentially telling the backtest engine how to slice up the historical data.

The `frameSchema` you provide contains all the details needed for this process, including the start and end dates of your backtest and the interval at which timeframes are generated.

## Function addExchange

This function lets you tell the backtest-kit framework about a new data source for trading – think of it as adding a stock exchange or cryptocurrency platform to the system. You provide a configuration object, called `exchangeSchema`, which details how to fetch historical price data, how prices and quantities should be displayed, and how to calculate things like the VWAP (Volume Weighted Average Price) based on recent trading activity.  Essentially, it's how you connect your chosen data feeds and trading logic to the backtesting environment. Without adding an exchange, the framework won't know where to get the price data it needs to simulate trades.

# backtest-kit classes

## Class StrategyValidationService

The StrategyValidationService helps ensure your trading strategies are set up correctly before you start backtesting. Think of it as a quality control check for your strategy definitions. 

It lets you register different strategy schemas, essentially telling the service what each strategy *should* look like. You add these schemas using the `addStrategy` method. 

Then, when you’re ready to run a backtest, the `validate` method confirms that your strategy definition matches the registered schema. This helps catch errors early, preventing unexpected behavior during your backtesting process. The service keeps track of the strategies you've registered internally.

## Class StrategySchemaService

This service acts as a central place to manage and keep track of your trading strategy definitions. It uses a special system to ensure your strategy information is structured correctly and consistently.

You can add new strategy definitions using the `addStrategy` function (though technically it’s called `register`), and retrieve them later by their names using the `get` function.

Before a strategy is officially saved, the `validateShallow` function quickly checks to make sure all the essential parts are present and have the expected types. 

If you need to update an existing strategy definition, the `override` function lets you modify specific parts of it without replacing the entire definition. The service also has a logging component for tracking what's happening.

## Class StrategyGlobalService

This service acts as a central point for running strategies, automatically providing them with important information like the trading symbol, the specific time being analyzed, and whether it’s a backtest or live trading scenario. It combines the functionality of other services to simplify the process of interacting with strategies.

You can use it to quickly check the status of a strategy at a particular moment in time with the `tick` function. This is useful for getting a snapshot of what a strategy is doing.

The `backtest` function allows you to run a rapid backtest using a set of historical candle data, giving you a fast way to evaluate how a strategy might perform. Essentially, it streamlines the process of testing your strategies.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub for interacting with your trading strategies. It intelligently routes requests to the correct strategy implementation based on the current trading context.

Think of it as a smart dispatcher – it automatically figures out which strategy you're using and directs your commands to it. To improve performance, it keeps a record of the strategies it’s using, so it doesn't have to recreate them every time.

You use the `tick` method for live trading; it analyzes the current market conditions and returns a signal. The `backtest` method lets you run simulations by providing historical data (candles) and testing how your strategy would have performed. Before either of these methods runs, the service ensures the strategy is properly set up and ready. 

The service relies on several other components like the logger, execution context, schema service, exchange connection, and method context services to function correctly.

## Class PersistSignalUtils

This class, PersistSignalUtils, helps keep track of trading signals even when your application restarts. It's especially important for live trading, as it ensures your strategy picks up where it left off.

Think of it as a smart memory for your trading strategies. It automatically manages how these signals are stored, and lets you customize the storage method if needed. 

The class handles reading and writing signal data, making sure these operations are done safely and prevent data loss, even if something unexpected happens. It works behind the scenes within ClientStrategy, automatically restoring and saving signal information.

You can even plug in your own custom storage solutions if the default isn't what you need. Essentially, it simplifies the process of reliably saving and loading trading signal state.

## Class LoggerService

The `LoggerService` helps you keep your backtesting logs organized and informative. It provides a central place for logging messages, automatically adding details about where the log came from – like which trading strategy, exchange, and frame are involved, and also important details about the trade execution itself.

You can use the `log`, `debug`, `info`, and `warn` methods to record different types of messages, each with automatic context added.  If you don’t configure a logger, it silently does nothing, but you can easily plug in your own custom logger using `setLogger` to control where and how your logs are handled. The service utilizes internal services for managing method and execution contexts, streamlining the logging process.

## Class LiveUtils

The `LiveUtils` class helps simplify running and managing live trading sessions. It provides a single, easy-to-use way to execute your trading strategies and keep track of what's happening.

The `run` function is the core – it launches your strategy in a continuous, never-ending loop, generating results as it trades.  It’s designed to be resilient; if your process crashes, it can recover and pick up where it left off.

If you need a background process to handle tasks like sending data to another system or constantly updating a database without needing the results directly, the `background` function is for you. It runs your strategy quietly in the background.

The `getReport` function allows you to create a detailed markdown report outlining all events that occurred during a strategy's execution.  You can then use `dump` to save this report to a file on your disk.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create detailed reports of your trading strategies as they run. It keeps track of every event – from periods of inactivity to when positions are opened, active, and closed – and organizes this information for each strategy.

You’re able to generate reports in markdown format, which includes things like win rates and average profit/loss (PNL). These reports are saved to your logs directory, making it easy to review your trading history.

The service handles the technical details of subscribing to live trading signals and creating the reports, so you can focus on analyzing your strategy's performance. It's designed to work seamlessly within the backtest-kit framework. You can clear the data, or clear it for a specific strategy. The service initializes automatically when you first use it, simplifying the setup process.

## Class LiveLogicPublicService

This service helps manage and execute live trading operations, simplifying the process with automatic context handling. Think of it as a layer on top of the private trading logic that automatically passes along important information like the strategy name and exchange being used.

It provides a continuous stream of trading signals – both openings and closings – as an ongoing process, essentially running indefinitely.  You don't need to manually provide this contextual information each time you request data or generate signals; the service takes care of it for you.

The system is designed to be resilient; if something goes wrong and the process crashes, it can recover its progress from saved data, picking up where it left off.  It tracks time using the system clock to ensure accurate progression through the trading day.  You can start the live trading process for a specific symbol, and it handles everything from there.


## Class LiveLogicPrivateService

This component handles the ongoing process of live trading, orchestrating everything behind the scenes. Think of it as the engine that keeps your trading strategy running continuously.

It works by constantly checking for new signals, similar to how it would monitor market data.  The core of its operation is an unending loop that yields results only when a trade is opened or closed - it avoids sending unnecessary updates. 

Because it’s built with async generators, it sends updates efficiently without hogging memory.  If something goes wrong and the process crashes, it's designed to recover and resume trading from where it left off, ensuring your strategy stays active. It’s essentially a tireless, resilient worker managing your live trades.

## Class LiveGlobalService

This service acts as a central hub for live trading operations within the backtest-kit framework. It simplifies how different parts of the system interact, making it easier to manage dependencies.

Think of it as a helper that bundles together essential components like logging, live trading logic, and validation services. 

The `run` method is the key feature – it initiates and manages the live trading process for a specific trading symbol. This method continuously generates trading results, automatically handles potential errors to keep the process running smoothly. It also carries information about which strategy and exchange are being used.

## Class FrameValidationService

The FrameValidationService helps ensure your trading strategies are structured correctly. It allows you to define and register the expected format, or "schema," for different data frames used in your backtesting process. Think of it as a way to double-check that the data coming into your system is what you expect it to be.

You can add frame schemas using the `addFrame` method, specifying the frame's name and its expected structure. The `validate` method then allows you to verify if a particular frame exists and conforms to its registered schema. This service helps catch errors early on, leading to more reliable backtest results and a smoother development workflow.


## Class FrameSchemaService

This service acts as a central place to store and manage the blueprints, or schemas, that define your trading strategies. Think of it as a library where you can save the structure of your data frames. 

It uses a special tool to keep track of these schemas in a type-safe way, ensuring that everything is structured correctly. 

You can add new schemas using `register`, update existing ones with `override`, or simply retrieve a schema you’ve already saved using `get`. Before a schema is added, it’s checked to make sure it has all the necessary parts using a quick validation process.

## Class FrameGlobalService

The `FrameGlobalService` acts as a central point for managing timeframes within the backtesting framework. It works closely with the `FrameConnectionService` to fetch and organize the dates needed for running simulations. Think of it as the system's way of ensuring you have the correct historical data to perform your backtests.  It handles the complexities of retrieving timeframes, so you don't have to.  The `getTimeframe` method is its core function; it allows you to specify a symbol (like a stock ticker) and will return an array of dates representing the time periods you’ll be testing against. This service is a crucial internal component, but its `getTimeframe` function provides a straightforward way to get the time data you need.

## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing specific trading frames within the backtest kit. It automatically directs your requests to the correct frame implementation based on the current method context, streamlining your interactions.

To improve performance, it cleverly caches these frame instances, so you don’t have to recreate them repeatedly. Think of it as a smart assistant that remembers which frame you need.

This service also provides access to the backtest timeframe—the start and end dates—allowing you to confine your tests to a specific period.  If you’re in live mode, there isn’t a frame constraint because there’s no historical data to consider. 

You can grab a frame using the `getFrame` method, which creates it if needed and caches it for later use. The `getTimeframe` method helps you define the date range for your backtests.

## Class ExchangeValidationService

The ExchangeValidationService helps ensure your trading strategies are set up correctly by verifying the structure of your exchanges. 

It works by letting you define the expected schema for each exchange you use. You can add exchange schemas using the `addExchange` function, specifying the exchange’s name and its structure. Then, the `validate` function checks if a given exchange actually conforms to the schema you've provided, which is especially useful before running backtests or live trades. Essentially, it's a safety check to catch configuration errors early. The service uses a logger to report any issues it finds during validation.

## Class ExchangeSchemaService

The ExchangeSchemaService helps you keep track of information about different cryptocurrency exchanges in a structured and reliable way. It acts as a central place to store and manage these exchange details, making sure they’re consistent and easy to access. 

Think of it like a library where you can register details about each exchange. You can add new exchanges using `addExchange()` and then later look them up by name using `get()`. 

Before adding a new exchange, the service checks if the information you’re providing has the necessary details in the right format using `validateShallow`.  If an exchange already exists, you can update parts of its information using `override()`. The service relies on a specialized type-safe storage system for secure and organized management of these exchange schemas.

## Class ExchangeGlobalService

The ExchangeGlobalService acts as a central hub for interacting with exchanges, seamlessly incorporating information about the trading environment like the symbol being traded, the trading time, and backtesting parameters. It builds upon the ExchangeConnectionService and ExecutionContextService to provide a consistent and informed way to retrieve data and format values.

You'll find methods here for getting historical candle data, specifically designed for backtesting environments, as well as functions to calculate average prices and format both prices and quantities in a way that aligns with the current trading context. Think of it as a layer that adds crucial context to your exchange operations. It’s used internally to power the core backtesting and live trading logic.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently directs your requests—like fetching historical price data or getting the current average price—to the correct exchange based on your trading context.

It's designed to be efficient; once it connects to an exchange, it remembers that connection so it doesn't have to re-establish it every time. This speeds up your backtesting and trading operations.

You can request candles (price history) for a specific cryptocurrency, retrieve the next batch of candles based on your current position in time, and get the average price, which will be real-time when you's live and calculated from historical data when you's backtesting. The service also helps ensure your prices and quantities are formatted correctly to meet the specific requirements of each exchange. Essentially, it takes care of the technical details of communicating with different exchanges so you can focus on your trading strategies.

## Class ClientFrame

The ClientFrame is the engine that creates the timeline for your backtesting simulations. It's responsible for generating the array of timestamps your trading logic will step through. To avoid unnecessary work, it remembers previously calculated timeframes and reuses them. You can customize the time intervals used, ranging from one minute to three days. The ClientFrame works closely with the backtesting system’s core logic.

The `getTimeframe` method is how you request a timeframe for a specific trading symbol. This method uses a singleshot caching system, so calling it multiple times for the same symbol will only generate the timeframe once. 

The ClientFrame’s constructor takes parameters that control how timeframes are generated.

## Class ClientExchange

The `ClientExchange` class provides a way to interact with an exchange, specifically designed for backtesting scenarios. It lets you retrieve historical and future price data (candles) for a given symbol and interval. You can pull candles backward in time for analysis and forward in time to simulate order execution during backtesting.

It also calculates the Volume Weighted Average Price (VWAP) based on recent trade data, useful for understanding price trends.  Finally, it provides methods to format quantities and prices to match the exchange’s specific precision requirements. All the functionality is structured to be memory-efficient through the use of prototype functions.

## Class BacktestUtils

The `BacktestUtils` class offers helpful tools to simplify running backtests and analyzing results within the backtest-kit framework. It’s designed to be easily accessible, existing as a single, readily available instance.

The primary function, `run`, allows you to execute a backtest for a specific trading symbol and provides logging alongside the process, giving you a stream of results.  If you just need to run a backtest without needing to see the results directly – perhaps just for logging or triggering other actions –  `background` provides a way to execute the backtest in the background.

After a backtest is complete, `getReport` can generate a user-friendly markdown report summarizing the closed signals for a strategy, making it easy to understand performance. Finally, `dump` lets you save that report directly to a file on your disk for later review.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create readable reports about your trading backtests. It watches for trading signals and keeps track of closed positions for each strategy you're testing. It automatically generates nicely formatted markdown tables showing details about those closed positions.

You can then save these reports to disk in a standard location, making it easy to review and share your backtest results. The service manages storage for each strategy separately, so you have isolated reports for each one.

It's designed to be straightforward to use – it handles the data accumulation and report generation for you. The initialization process happens automatically the first time you use it, so you don’t have to worry about setting it up manually. You can also clear the stored data whenever you need to start fresh.

## Class BacktestLogicPublicService

BacktestLogicPublicService is your go-to for running backtests and managing the context around them. It simplifies things by automatically handling information like the strategy name, exchange, and frame – you don’t have to pass it around with every function call. 

Essentially, it acts as a helpful layer on top of the more technical backtest logic, making the process more streamlined. 

The `run` function is the main way to execute a backtest. It takes a symbol (like a stock ticker) and streams back results, one closed signal at a time. This structured output makes it easier to analyze and interpret the backtest results.


## Class BacktestLogicPrivateService

This service handles the behind-the-scenes coordination of backtesting, making it easier to test your trading strategies. It works by efficiently processing data in a streaming fashion, avoiding large memory usage.

Here's how it operates: It retrieves the available timeframes, then step-by-step evaluates each one, requesting the necessary data like candles only when a trading signal appears. It keeps track of open signals and efficiently skips ahead in time until those signals are closed. 

The backtest results are delivered as a continuous stream of completed trades, allowing you to process them as they become available. The testing can be stopped at any time by breaking the flow of the stream.

This service relies on several other services like the logger, strategy, exchange, and frame services to manage different aspects of the backtesting process. 

The `run` method is the main entry point, taking the trading symbol as input and producing an async generator that yields the backtest results.

## Class BacktestGlobalService

The BacktestGlobalService acts as a central hub for running backtests within the system. Think of it as a convenient way to access the core backtesting engine and related services. It's designed to be used for dependency injection, making it easier to manage and test different parts of the backtesting process.

Inside, you'll find references to services that handle logging, the main backtest logic, and validation for strategies, exchanges, and data frames. 

The key functionality is the `run` method.  This method lets you kick off a backtest for a specific trading symbol and provides the context (strategy, exchange, and data frame) needed for the test. The result is an asynchronous generator, letting you step through the backtest results as they become available.

# backtest-kit interfaces

## Interface IStrategyTickResultOpened

This interface describes the data you receive when a new trading signal is created within your backtesting strategy. It signifies that a signal has been successfully generated, validated, and saved. 

You'll find key information included, such as the newly created signal itself (complete with a unique ID), the name of the strategy that generated it, the exchange being used, and the prevailing VWAP price at the moment the signal was opened. This information is helpful for monitoring the creation of signals and understanding the conditions that led to their generation.

## Interface IStrategyTickResultIdle

This interface describes what happens in your trading strategy when it's in a state of inactivity, also known as "idle." It’s used to track events when no trading signals are present.

You'll see this structure when your strategy isn't actively buying or selling. 

The `action` property will always be "idle" to clearly identify the state. The `signal` will be `null` because there's no active signal to process. To keep track of which strategy and exchange were idle, the `strategyName` and `exchangeName` properties are included. Finally, the `currentPrice` property captures the market price during this idle period, providing a snapshot of the market conditions.

## Interface IStrategyTickResultClosed

This interface describes the result you get when a trading signal is closed, providing a complete picture of what happened. It includes the original signal details, the price at which the trade was closed, and the reason for the closure, whether it was due to a time limit, a take-profit order, or a stop-loss trigger. Crucially, it also contains a breakdown of the profit and loss, accounting for fees and slippage, along with the names of the strategy and the exchange used. It's essentially the final report card for a closed trade.

## Interface IStrategyTickResultActive

This interface represents a tick result in the backtest-kit framework, specifically when a trading signal is actively being monitored. Think of it as a state where the system is waiting for a trade to be closed, either through a take-profit/stop-loss trigger or a time-based expiration. 

The `action` property clearly identifies this state as "active." The `signal` property holds the details of the signal that initiated this monitoring. You're also given information about the current price being tracked (`currentPrice`), which strategy is running (`strategyName`), and the exchange being used (`exchangeName`) for record-keeping and analysis.

## Interface IStrategySchema

This interface, `IStrategySchema`, describes how you register a trading strategy within the backtest-kit framework. Think of it as a blueprint for your trading logic. 

It requires a unique `strategyName` to identify it, and an `interval` to control how often your strategy produces signals. 

The core of the schema is the `getSignal` function – this is where you write the code that analyzes market data and decides whether to buy, sell, or hold.  If your strategy doesn't have any signal to generate, the function should return `null`. 

Finally, `callbacks` are optional functions you can provide to respond to events like when a strategy starts (`onOpen`) or stops (`onClose`).

## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the outcome of a trading strategy’s profit and loss calculation. It provides a clear picture of how well a strategy performed, taking into account the impact of both transaction fees and slippage. The `pnlPercentage` tells you the profit or loss as a percentage of your initial investment, making it easy to compare strategies. To understand the actual price points used in the calculations, you can check the `priceOpen`, which reflects the entry price after fees and slippage have been factored in, and `priceClose`, which shows the exit price with those same adjustments.

## Interface IStrategyCallbacks

This interface lets you hook into the key moments in a trading strategy's lifecycle. Think of it as a way to get notified about what's happening – when a signal starts, is actively being watched, pauses, or finishes. 

You can provide functions for `onTick` to react to every price update, `onOpen` when a new trade opportunity is identified, `onActive` to monitor a position, `onIdle` when there's nothing to trade, and `onClose` when a trade concludes. These callbacks provide valuable insight and control over your strategy’s behavior at each stage.

## Interface IStrategy

The `IStrategy` interface outlines the essential methods any trading strategy using backtest-kit needs to provide. At its heart is the `tick` method, which represents a single step in strategy execution, handling VWAP monitoring and checking for trading signals while also managing stop-loss and take-profit conditions. 

For quickly testing your strategy’s performance, there's the `backtest` method; it allows you to run your strategy against a series of historical candle data, calculating VWAP and evaluating take-profit and stop-loss triggers on each candle to simulate trading. This is a speedy way to get a feel for how your strategy might perform in different market conditions.

## Interface ISignalRow

The `ISignalRow` interface represents a complete signal ready for use within the backtest-kit framework. Think of it as the finalized signal object after it’s been checked for validity. Each signal has a unique identifier, generated automatically as a UUID, making it easy to track. It also includes information about which exchange and strategy produced the signal, along with a timestamp indicating when it was created, and the symbol of the trading pair involved, such as BTCUSDT. This standardized structure ensures consistency throughout the backtesting process.


## Interface ISignalDto

The `ISignalDto` represents a trading signal, the information used to initiate a trade. Think of it as a standardized way to communicate what a trading strategy wants to do.

It includes details like the trade direction – whether to go long (buy) or short (sell). You'll also find a human-readable note to explain the reasoning behind the signal. 

The signal also specifies the entry price, take profit level, and stop-loss price to manage the trade’s potential gains and losses. Finally, it allows for estimating how long a trade might be open before it automatically closes. 

If you don't provide an ID when creating a signal, one will be automatically generated for you.

## Interface ISignalData

This interface, `ISignalData`, represents the data you'll find when storing signal information. Think of it as a container holding the current state of a trading signal. 

It has a single, important piece of information: `signalRow`. This property holds the actual signal data itself and can be empty (null) when there isn't an active signal to track. This structure makes it easy to update signal information reliably, even when dealing with potentially missing data.

## Interface IPersistBase

This interface defines the core functions for saving and retrieving data within the backtest-kit framework. Think of it as the foundation for how your trading strategies and data are stored and accessed. 

You'll use `waitForInit` to make sure the storage area is ready and properly set up, ensuring everything works as expected when your backtest starts. `readValue` lets you pull existing data back from storage based on a unique identifier.  Before you try to read or write, `hasValue` is helpful to quickly check if a particular piece of data already exists. Finally, `writeValue` handles the actual process of saving data to storage, making sure that updates are written safely and reliably.

## Interface IMethodContext

This interface, `IMethodContext`, acts like a little package of information that helps your backtesting framework know which specific configurations to use. Think of it as a shortcut – instead of repeatedly specifying the names of your exchange, strategy, and frame, this context object holds them all in one place. 

It’s automatically passed around by the framework, so you don't typically need to create it directly. The `exchangeName`, `strategyName`, and `frameName` properties tell the system exactly which schemas to load for the given backtest.  If `frameName` is empty, it means you're running in live mode, not a backtest.

## Interface ILogger

The `ILogger` interface provides a way for different parts of the backtest-kit framework to record what’s happening. Think of it as a central place to leave breadcrumbs about your trading system’s activity.

You can use the `log` method for important general events – anything you want to keep track of, from agent actions to storage changes. `debug` is for more detailed information used primarily when you’re developing or troubleshooting. `info` messages are for higher-level updates on successful actions and validations. Finally, `warn` is for situations that might not stop the system but deserve a closer look.

Essentially, `ILogger` helps you understand what your backtest-kit system is doing and pinpoint any issues that arise.

## Interface IFrameSchema

The `IFrameSchema` lets you define a reusable template for how your backtest data is structured. Think of it as a blueprint for generating a series of trading periods.

Each schema specifies a unique name for identification, a time interval (like daily, weekly, or monthly), and clearly defines the start and end dates for your backtesting period, making sure your tests cover the intended timeframe. You can also add optional lifecycle callbacks to customize how the frame is handled. This schema becomes a building block for creating data frames within your backtesting framework.

## Interface IFrameParams

The `IFrameParams` interface defines the configuration you provide when setting up a backtest environment. Think of it as the blueprint for how your backtesting framework will operate. It builds upon the `IFrameSchema` and crucially includes a `logger`. This `logger` is your friend – it provides a way to see what's happening internally within the framework, helping you diagnose issues or understand the flow of execution during your backtests. By supplying a logger, you get valuable insight into the inner workings of the testing process.

## Interface IFrameCallbacks

The `IFrameCallbacks` interface lets you hook into the key moments in how backtest-kit creates and manages timeframes for your simulations. 

Specifically, the `onTimeframe` property provides a function that's called immediately after a set of timeframes is created. This is a great place to check if the timeframes look correct, log some diagnostic information, or perform any validation steps you need. You’re given the array of `Date` objects representing the timeframes, the start and end dates of the backtest, and the interval used for generation.


## Interface IFrame

The `IFrame` interface is a core part of backtest-kit, handling how your trading data is organized across different time periods. It's mainly used behind the scenes to coordinate the backtesting process.

The `getTimeframe` method is the key function here; it’s responsible for creating a list of specific dates and times that your backtest will run through. You give it a ticker symbol (like "AAPL"), and it returns a `Promise` that resolves to an array of dates. These dates are evenly spaced based on the timeframe you’ve set up for your backtest, ensuring consistent data points for your strategy.

## Interface IExecutionContext

The `IExecutionContext` interface provides important information about the environment your trading strategy is running in. Think of it as a package of details passed along to your code so it knows what's happening. It includes the trading symbol, like "BTCUSDT," to specify which asset you're working with. It also keeps track of the current timestamp, which is crucial for time-sensitive operations. Finally, it tells your strategy whether it’s running a backtest (analyzing past data) or operating in a live trading environment. This context helps your strategy make informed decisions based on the specific situation.

## Interface IExchangeSchema

This interface, `IExchangeSchema`, acts as the blueprint for connecting your backtesting system to different cryptocurrency exchanges. Think of it as defining how your system talks to each exchange.

It requires you to specify a unique name for each exchange you're integrating. The most important part is providing a function, `getCandles`, which tells the system exactly how to retrieve historical price data (candles) from that exchange – whether it's pulling from an API or a database.

You'll also need functions to correctly format trade quantities and prices to match the specific rules of each exchange, ensuring your orders are valid.

Finally, you can optionally provide functions for handling special events related to the exchange's data, allowing for more customized behavior.

## Interface IExchangeParams

The `IExchangeParams` interface defines the information needed when setting up a connection to an exchange within the backtest-kit framework. Think of it as the configuration object you pass to create an exchange connection. It requires a `logger` to help track what's happening during your backtesting process and an `execution` object, which provides important details like the trading symbol, the time period being analyzed, and whether you're running a backtest or live trading. Essentially, it’s how you tell the exchange which assets, timeframes, and environment you're working with.

## Interface IExchangeCallbacks

The `IExchangeCallbacks` interface lets you register functions to be notified about events happening when fetching data from an exchange. Specifically, you can provide an `onCandleData` function. This function will be called whenever candle data is retrieved, and it gives you the symbol, the time interval for the candles, the starting date and limit of data, and an array of the actual candle data. This allows you to react to incoming data as it arrives.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with a simulated trading environment. It allows you to retrieve historical and future candle data for a specific trading symbol and time interval, crucial for evaluating trading strategies. 

You can use `getCandles` to get past price action and `getNextCandles` to look ahead, which is particularly useful during backtesting. The `formatQuantity` and `formatPrice` functions ensure your order sizes and prices are correctly formatted according to the exchange's rules. Finally, `getAveragePrice` lets you quickly calculate the VWAP (volume-weighted average price) based on recent trading activity, giving you a sense of the prevailing market price.

## Interface IEntity

This interface, `IEntity`, acts as the foundation for anything that gets saved and retrieved from a database within the backtest-kit framework. Think of it as the parent for all your data objects – whether they represent trades, orders, or account balances. If a class is designed to be persistently stored, it should implement this `IEntity` interface, ensuring a consistent structure for data management within your backtesting environment. It provides a common ground for interacting with persistent data.

## Interface ICandleData

This interface represents a single candlestick, containing essential price and volume information. Think of it as a snapshot of market activity over a specific time interval. It includes the timestamp marking when the candle began, the opening price, the highest and lowest prices reached, the closing price, and the total volume traded during that period. Backtest-kit uses this structure to provide the data needed for analyzing trading strategies and simulating past performance.
