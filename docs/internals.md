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

This function lets you plug in your own logging system for backtest-kit. Instead of the framework's default logging, it will now use the logger you provide.  The nice part is that it automatically adds helpful information to your log messages, such as the strategy name, exchange, and trading symbol, making it much easier to debug and understand what's happening during backtesting. Just pass in an object that implements the `ILogger` interface, and all the framework's logging will go through it.


## Function listStrategies

This function gives you a straightforward way to see all the trading strategies currently loaded into the backtest-kit framework. Think of it as a quick inventory check – it returns a list containing details about each strategy, allowing you to understand what's available for backtesting. You can use this information to build tools that automatically display available strategies or to verify that your strategies have been correctly registered. It’s like getting a clear overview of your strategy toolbox.

## Function listFrames

This function gives you a look at all the different timeframes your backtest kit is using. Think of it as a way to see a complete inventory of the time units – like daily, hourly, or weekly – that your trading strategies are analyzing. You can use this list to understand how your system is configured or to build tools that work with those specific timeframes. It’s a simple way to inspect what’s happening behind the scenes in your backtesting environment.

## Function listExchanges

This function helps you discover all the exchanges your backtest-kit setup knows about. It returns a list of exchange details, which is handy if you're trying to understand what data sources are available or want to build tools that adapt to different exchanges. Think of it as a way to see the full picture of your trading environment’s connectivity. It’s particularly useful when you've added custom exchanges and want to confirm they're properly registered.


## Function listenSignalOnce

This function lets you set up a listener that reacts to specific trading signals, but only once. It’s designed to trigger a callback function when a particular condition is met based on your defined filter. After the callback executes, the listener automatically stops listening, so you don’t have to worry about cleaning up. Think of it as a way to wait for a specific trading signal to occur and then perform an action.

You provide a filter function that determines which signals should trigger the callback, and then you provide the callback function that will be executed when a matching signal arrives. The listener will then automatically unsubscribe after the one execution.


## Function listenSignalLiveOnce

This function lets you temporarily listen for specific trading signals coming from a live backtest. You provide a filter—a way to define which signals you're interested in—and a function that will be executed when a matching signal arrives.  The callback function will only run once, and then the listener automatically stops, ensuring it doesn't interfere with other parts of your system. It's ideal for situations where you need to react to a particular signal just once during a live simulation.




The first argument is how you specify the type of signal you want to capture. The second argument is the action you're going to take when that signal appears.

## Function listenSignalLive

This function lets you hook into a live trading simulation, allowing you to react to signals as they happen. It’s designed to receive updates specifically from a `Live.run()` execution. Think of it as setting up a listener that gets triggered whenever a new signal comes in.

The function takes a callback function as input. This callback receives a special object (`IStrategyTickResult`) containing information about the signal.  Importantly, the signals you receive will be processed one at a time, ensuring they arrive in the order they're generated, which is vital for some strategies. The `listenSignalLive` function returns a function that, when called, will unsubscribe you from receiving these live signal events.


## Function listenSignalBacktestOnce

This function lets you tap into the signals generated during a backtest, but only for a single event. You provide a filter—a rule to determine which signals you’re interested in—and a function to execute when a matching signal appears. Once that single signal is processed, the subscription automatically ends, ensuring you don't keep listening unnecessarily. It’s a clean way to react to a specific backtest event and then move on.

The `filterFn` defines the criteria for which signals you want to receive.  The `fn` is the code that will run exactly one time when a signal passes that filter.


## Function listenSignalBacktest

This function lets you tap into the backtest process and get updates as it runs. Think of it as subscribing to a stream of information about what's happening during the backtest. You provide a function that will be called whenever a new signal event is generated, like a trade suggestion or a market update. These events are delivered one at a time, ensuring they are processed in the order they occurred during the backtest run. This is useful for monitoring progress, displaying information, or even reacting to events in real-time during the simulation.


## Function listenSignal

This function lets you tap into the trading signals generated by your backtest. Think of it as subscribing to updates about what the strategy is doing – when it's idle, when it opens a position, when it's actively trading, and when it closes a position. Importantly, these updates are handled one at a time, even if the callback you provide needs to do some asynchronous work, ensuring things happen in the order they occur. You give it a function that will be called whenever a signal event happens, and it returns a function you can use later to unsubscribe from these updates.

## Function listenProgress

This function lets you keep an eye on how your backtest is progressing, especially when it's performing lengthy calculations in the background. It gives you a way to get updates as the backtest runs, ensuring you can track its status. The updates are delivered in order, and even if your update function takes some time to process, the backtest will continue smoothly without interruptions. You provide a function that will be called with progress information at various stages of the backtest.

## Function listenPerformance

This function lets you keep an eye on how your trading strategies are performing in terms of timing. It's like setting up a listener that gets notified whenever a significant operation happens during the strategy’s run. You provide a function that will be called with details about each operation’s timing. Importantly, these timing updates are handled one at a time, ensuring that any asynchronous work your callback does won't interfere with the sequence of events. This is great for pinpointing where your strategy might be slow or inefficient. You can think of it as a tool for profiling your code to optimize its speed.

## Function listenError

This function lets you keep an eye on any errors that pop up during background tasks within your backtest or live trading environment. It's designed to catch problems occurring in `Live.background()` or `Backtest.background()`. Whenever an error is caught, your provided function will be called to handle it. Importantly, these errors are processed one at a time, ensuring that your error handling logic isn’t overwhelmed, even if callbacks are asynchronous. This helps keep things stable and predictable.

You provide a function (`fn`) that will be called whenever an error occurs, and this function will return another function that you can use to unsubscribe from these error notifications later.

## Function listenDoneOnce

This function lets you react to when background tasks finish, but only once. It’s designed to be used with `Live.background()` or `Backtest.background()` to know when those processes are done.

You provide a filter function that decides which completion events you’re interested in.  Then, you give a callback function that will run when a matching event occurs.

Once the callback has run once, the subscription is automatically canceled, ensuring you don't get triggered repeatedly. It’s a clean way to handle single-time notifications about background task completion.


## Function listenDone

This function lets you be notified when a background process finishes, whether you're running a live trading simulation or a backtest. Think of it as setting up a listener to catch the "all done" signal from those long-running tasks. Importantly, even if the notification you receive involves asynchronous operations, the notifications themselves are handled one after another, ensuring order. It's a reliable way to know when the background work is truly complete. You provide a function that will be executed when the background task finishes.

## Function getMode

This function tells you whether the trading framework is running in backtest mode or live trading mode. It’s a simple way to check the context of your code – are you simulating historical data or actually making trades? The function returns a promise that resolves to either "backtest" or "live", giving you a clear indication of the operating environment. You can use this information to adjust your trading logic based on the current mode.

## Function getDate

This function, `getDate`, provides a way to retrieve the current date within your trading strategies. It’s useful for time-sensitive calculations or logic. When running a backtest, it will give you the date associated with the specific historical timeframe you're analyzing. If you're running live, it gives you the current date and time as it is.

## Function getCandles

This function lets you retrieve historical price data, also known as candles, for a specific trading pair. Think of it as requesting a record of how the price moved over time. 

You tell it which trading pair you're interested in, like "BTCUSDT" for Bitcoin against USDT, and how frequently you want the data – options range from one-minute intervals to eight-hour intervals. Finally, you specify how many candles (data points) you want to fetch.

The function pulls this data from the exchange you're using, automatically handling the details of connecting to it and retrieving the information. The data comes back as a list of candles, each representing a specific time period.

## Function getAveragePrice

This function helps you figure out the average price a symbol has traded at recently. It calculates the Volume Weighted Average Price, or VWAP, using the last five minutes of trading data. Essentially, it gives more weight to prices where more trading activity occurred. If there wasn't any trading volume during that time, it simply averages the closing prices instead. You just need to tell it which trading pair you're interested in, like "BTCUSDT".

## Function formatQuantity

This function helps you ensure your trade quantities are formatted correctly for a specific exchange. It takes a trading symbol like "BTCUSDT" and a raw quantity number, then transforms the number into a string that follows the exchange's rules for decimal places. This is really useful for making sure your orders are valid and don't get rejected because of formatting issues. Essentially, it handles the often-tricky details of how different exchanges represent quantity values.

## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes a symbol like "BTCUSDT" and a raw price value as input. It then uses the specific formatting rules of the exchange associated with that symbol to ensure the price is shown with the right number of decimal places. Essentially, it handles the exchange-specific price formatting for you.

## Function addStrategy

This function lets you officially register a trading strategy with the backtest-kit framework. Think of it as telling the system, "Hey, I have a strategy I want to use!" The framework will then check to make sure your strategy is set up correctly, including validating the signals it produces and preventing it from sending too many signals at once. If you're running the framework in live mode, it makes sure your strategy's data can be safely stored even if something unexpected happens.

To register a strategy, you provide a configuration object that describes how the strategy works. This configuration tells the framework all the details it needs to run your strategy properly.

## Function addFrame

This function lets you tell backtest-kit how your data is structured and how to generate timeframes for backtesting. Think of it as defining the scope and resolution of your historical data – when your backtest starts and ends, and how frequently you want data points. You provide a configuration object that outlines the start and end dates for your backtesting period, the interval (like daily, weekly, or hourly) at which you want your data, and a way for the framework to be notified about timeframe generation events. Essentially, it's how you tailor the backtest to your specific dataset's format and granularity.


## Function addExchange

This function lets you tell backtest-kit about a new data source for trading, like a specific cryptocurrency exchange. You'll give it a configuration object that describes how to fetch historical price data, how to format prices and trade sizes, and how to calculate key indicators like VWAP. Think of it as setting up a connection to the market data you want to backtest against. By registering an exchange, you’re telling the framework where to get the information it needs to simulate trades.




This allows backtest-kit to understand the specifics of the exchange you're working with, enabling realistic backtesting scenarios.

# backtest-kit classes

## Class StrategyValidationService

The StrategyValidationService helps you ensure your trading strategies are properly defined and conform to expected formats. Think of it as a quality control system for your strategy blueprints. 

You can add strategy schemas to the service, essentially registering the expected structure for each strategy you intend to use. The `validate` function checks if a strategy's code aligns with its registered schema. 

Need to see what strategies you’ve already defined? The `list` function provides a simple way to view all registered strategy schemas. This service helps you catch potential errors early and maintain consistency across your backtesting environment.

## Class StrategySchemaService

The StrategySchemaService helps keep track of your trading strategies' blueprints, ensuring they're consistent and well-defined. It acts like a central repository for strategy schemas, making it easy to register new ones and retrieve existing ones by name.

Think of it as a way to define the structure of your strategies – what properties they *must* have and what types those properties should be. Before a strategy is officially registered, it goes through a quick check to make sure it has all the necessary pieces.

If you need to update a strategy's schema, you can use the override function to make targeted changes without rebuilding the entire thing. Getting a strategy's schema back is simple: just ask for it by name. The service relies on a ToolRegistry to keep things organized and type-safe.

## Class StrategyGlobalService

StrategyGlobalService provides a central place to interact with strategies, making sure they have the necessary information like the trading symbol and timestamp. It’s designed to work behind the scenes, powering the backtesting and live trading logic.

You can use it to quickly check how a strategy would have performed against a set of historical candle data. It allows you to stop a strategy from generating new trading signals, or to completely clear its cached data, forcing it to reload.

Here’s a breakdown of what it offers:

*   **tick():**  Lets you check the strategy's signals at a specific moment in time.
*   **backtest():**  Performs a fast test of a strategy using historical price data.
*   **stop():**  Pauses a strategy from creating new signals.
*   **clear():** Resets a strategy, forcing it to re-initialize.

The service handles the details of providing the strategy with the context it needs to function correctly.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub for managing and executing trading strategies. It intelligently directs requests to the correct strategy implementation based on the current context. 

Think of it as a smart router that finds the right strategy to run a particular action. It keeps track of previously used strategies, making things faster by reusing them when possible. 

Before any trading actions happen, it makes sure the strategy is properly set up. You can use it to process live market data (tick) or to test how a strategy would have performed using historical data (backtest). 

There’s also a way to temporarily halt a strategy from generating new signals, and you can even clear out a strategy from memory to force it to reinitialize.

## Class PersistSignalUtils

This class helps manage and save your trading signals, ensuring they're kept safe even if something unexpected happens. Think of it as a reliable memory for your strategies.

It keeps track of signal data separately for each trading strategy, and it's designed to work well with custom storage solutions if you need them. When your strategy is initialized, this class loads previously saved signals. Conversely, when you make changes to signals, this class saves them to disk in a way that prevents data loss due to crashes.

You can even tell it to use a specific storage method to suit your needs. It’s the backbone for keeping your trading data consistent and recoverable.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing. It listens for performance data and keeps track of metrics like average trade duration, minimum latency, and more, all organized by strategy. 

You can request aggregated statistics for a specific strategy to see its overall performance. It even creates detailed markdown reports that pinpoint areas of potential bottlenecks and inefficiencies, and conveniently saves these reports to your logs directory. 

The service is designed to be easy to use – it handles storing data for each strategy separately and provides a way to clear that data when needed. It also initializes itself to start tracking performance automatically, but only does so once to prevent issues.

## Class Performance

The Performance class helps you understand how your trading strategies are performing. It provides tools for gathering performance statistics, creating easy-to-read reports, and saving those reports for later review.

You can use `getData` to retrieve a detailed breakdown of your strategy's performance, showing you things like how long operations take on average and how much they vary. The `getReport` method then transforms this data into a nicely formatted markdown report, highlighting potential bottlenecks and areas for improvement.  If you want to save the report, `dump` lets you store it to a file – it will even create the necessary folders if they don't already exist.  Finally, `clear` allows you to reset the accumulated performance data, useful for starting fresh with a new backtest or simulation.

## Class LoggerService

The LoggerService helps ensure consistent logging across your backtesting framework by automatically adding important context to each log message. Think of it as a central hub for all your logging needs. You can use it to easily see which strategy, exchange, or frame generated a particular log message, and what the relevant symbol and timestamp were.

It automatically injects information like the strategy name, the exchange used, and the specific frame being processed, so you don’t have to add it manually each time. You can even customize the underlying logger if you want to use a different logging solution, like sending logs to a file or a remote service. If you don’t configure a logger, it falls back to a "do nothing" mode, ensuring your application continues to run smoothly.

The `setLogger` method allows you to plug in your own custom logging implementation. The `log`, `debug`, `info`, and `warn` methods are your primary ways to write log messages, each with different severity levels.

## Class LiveUtils

LiveUtils simplifies running and monitoring your live trading strategies. It’s designed to be a handy, always-available tool for your trading framework.

The `run` method is the core functionality, allowing you to kick off a live trading session for a specific symbol and context. It's structured as an infinite, asynchronous generator, meaning it continuously produces trading results and automatically recovers from crashes by saving state to disk.

For situations where you just need live trading to execute tasks in the background – like saving data or triggering callbacks – you can use the `background` method. This runs the live trading loop without you needing to process the results directly.

You can also retrieve statistics and reports about a strategy's performance with `getData` and `getReport`, respectively. The `dump` method then helps you save those reports to a file for later review.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create detailed reports about your live trading strategies. It keeps track of every event – from idle periods to opened, active, and closed trades – for each strategy you’re running. 

It organizes this information into nicely formatted markdown tables that include all the important details of each trade. Beyond just the raw data, it also calculates and presents useful trading statistics like win rate and average profit/loss. 

The reports are saved to your logs directory, making it easy to review your trading performance. The service handles the technicalities of managing this data and generating the reports, so you can focus on analyzing your strategies. You don't need to explicitly initialize it; it’s designed to start automatically when needed.

## Class LiveLogicPublicService

This service helps manage live trading operations, making it easier to run strategies without constantly passing around context information like the strategy name and exchange. It essentially acts as a wrapper around a private service, handling the details of context management for you.

Think of it as an automated system that continuously runs a trading strategy for a specific asset. It sends you a stream of results – signals to open or close positions – and keeps running indefinitely. 

If something goes wrong and the process crashes, it can automatically recover and pick up where it left off thanks to persistent state. The system constantly checks the current time to ensure everything progresses smoothly.

You initiate a live trading run by specifying the asset you want to trade and the trading context. The system then handles the rest, keeping everything running and managing the flow of information.


## Class LiveLogicPrivateService

This service helps orchestrate live trading using a continuous, ongoing process. It essentially runs a never-ending loop that constantly checks for new trading signals.

Imagine it as a tireless monitor, always watching the market. Every time it detects a new trade opening or closing, it sends that information out as a stream of data. If the process crashes unexpectedly, it’s designed to bounce back and resume where it left off.

The service is built for efficiency, avoiding unnecessary data and using a streaming approach to conserve memory. It receives help from other services to manage logging, global strategy information, and the context of the trading method. The `run` method is the heart of it, initiating the live trading process for a specific symbol and continuously sending out those crucial trade updates.

## Class LiveGlobalService

This service acts as a central point for accessing live trading features within the backtest-kit framework. It simplifies how different parts of the system interact with live trading logic, making it easier to manage and test.

Essentially, it bundles together essential tools like logging, live trading logic, and validation services. 

The `run` method is the core functionality, allowing you to start live trading for a specific symbol. It continuously generates trading results and handles any crashes that might occur during the process, ensuring a resilient trading experience. You provide the symbol you want to trade and some context like the strategy and exchange names to guide the process.

## Class FrameValidationService

The FrameValidationService helps you ensure your trading data frames are correctly structured and conform to expected formats. Think of it as a quality control system for your data.

You can add frame schemas to the service, essentially telling it what a valid frame for a particular name should look like.  The `validate` function then checks a given data source against a registered frame schema.

Need to see what schemas you’ve defined? The `list` function provides a straightforward way to get a list of all registered frame schemas.  The service also utilizes a logger service to help track validation activities.


## Class FrameSchemaService

The FrameSchemaService helps you keep track of the structure of your trading frames, ensuring everyone's on the same page about what data is expected. It uses a type-safe system to store these frame definitions. 

You can add new frame structures using `register` or update existing ones with `override`. If you need to use a frame, `get` allows you to fetch it by name. Before a frame is added, it’s checked with `validateShallow` to make sure it has all the necessary components.  The service also internally manages a registry and utilizes a logger to keep things organized.

## Class FrameGlobalService

This service acts as a central point for managing timeframes used in your backtesting process. It’s responsible for creating the sequences of dates that your trading strategies will analyze. Think of it as the engine that provides the historical data schedule. 

It uses a `FrameConnectionService` to actually retrieve the dates, and keeps a reference to a logger for tracking events.  The core functionality is `getTimeframe`, which you’ll call to get an array of dates for a specific trading symbol – those dates become the backbone of your backtest. This service is designed to be an internal helper, so you likely won't interact with it directly when building your trading strategies.

## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing your trading frames, like historical data sets. It intelligently routes your requests to the correct frame implementation based on the current context, making sure you're working with the right data.

To optimize performance, it keeps a cache of these frame implementations, so it doesn't need to recreate them every time you need them.

You can use it to get a specific frame by name, and to retrieve the start and end dates of your backtest timeframe for a particular symbol, ensuring your backtesting stays within the defined period. In live trading mode, there are no frame constraints as the `frameName` will be empty. 

It relies on a few underlying services – a logger, a schema service, and a method context service – to function properly.

## Class ExchangeValidationService

The ExchangeValidationService helps you keep track of and verify the structure of your exchanges within the backtest-kit framework. Think of it as a central registry for exchange definitions. 

You can add new exchange schemas using the `addExchange` function, specifying the exchange's name and its underlying data structure. To ensure your exchanges are correctly defined, use the `validate` function to check if a specific exchange exists in the registry.  If you need a complete picture of all the exchanges you’ve set up, the `list` function provides a convenient way to retrieve them all. The `loggerService` property gives you access to logging capabilities for debugging and monitoring validation processes. The `_exchangeMap` holds the exchange schemas internally.

## Class ExchangeSchemaService

The ExchangeSchemaService helps keep track of information about different exchanges you're working with, ensuring everything is structured correctly. It acts like a central place to store and manage these exchange details, using a system that helps prevent errors with TypeScript's type safety.

You can add new exchange information using `addExchange()` and find existing exchanges by their name with `get()`. If you need to update an existing exchange's details, the `override()` method lets you make partial changes.

Before a new exchange's information is stored, it's checked with `validateShallow()` to make sure it has all the necessary pieces in the right format. The `_registry` property internally manages the storage of these exchange schemas.

## Class ExchangeGlobalService

This service acts as a central hub for interacting with an exchange, streamlining common operations like retrieving candle data and formatting prices. It smartly incorporates information about the trading symbol, the specific time, and whether you're in backtest mode, ensuring consistency throughout your backtesting or live trading process.

Think of it as a helper that sits between your trading logic and the exchange itself.

Here’s a breakdown of what it does:

*   **Fetching Candles:**  It can grab historical candle data, and even future candles for backtesting purposes, making sure each request is properly contextualized.
*   **Calculating Average Price:** It can determine the average price of an asset, considering the trading context.
*   **Formatting Prices and Quantities:** It helps you display prices and trade quantities in a standardized and appropriate manner, again taking the trading context into account.

Essentially, this service takes care of the behind-the-scenes details so your trading logic can focus on making decisions.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It automatically directs your requests—like fetching historical data or getting the current average price—to the correct exchange based on the active context. To avoid repeatedly creating connections, it cleverly caches these connections for efficiency.

You can think of it as a translator that understands which exchange you're talking to and speaks its language.

Here's a breakdown of what it offers:

*   **Automatic Exchange Selection:**  No need to specify the exchange manually; it figures it out based on the trading context.
*   **Cached Connections:** It keeps track of exchange connections so it doesn’t have to create a new one every time.
*   **Full Exchange Functionality:** It provides a complete set of actions you're likely to perform against an exchange.
*   **Price and Quantity Formatting:**  It ensures that prices and quantities conform to the specific rules of the exchange you're using (like the correct number of decimal places).
*   **Historical and Next Candles:** It can retrieve past and future candle data for analysis and trading.




It also provides access to internal components like logging and schema services, but these are generally managed internally.

## Class ClientFrame

The ClientFrame component is responsible for creating the timelines your backtesting strategy will run on. Think of it as the engine that produces the sequence of dates and times for your historical data. It avoids unnecessary calculations by remembering previously generated timelines, speeding up the backtesting process. 

You can customize how frequently the timeline is updated, ranging from one minute to three days. The ClientFrame also allows you to hook into the timeline generation process with callbacks, giving you opportunities to verify the data or record events as timelines are created. 

The `getTimeframe` function is the key function, generating that crucial date array for a particular trading symbol. It's designed to be efficient, using caching to prevent repeated calculations.


## Class ClientExchange

This class, `ClientExchange`, provides a way to interact with exchange data, specifically designed for backtesting scenarios. It's essentially a bridge to get the data your backtest needs.

You can retrieve historical candle data, looking backward from a specific point in time. Conversely, it lets you fetch future candles, a crucial capability when simulating trades and evaluating strategies.

Calculating the Volume Weighted Average Price (VWAP) is also supported, based on recent trading activity. This is done by averaging the price of recent trades, taking volume into account.

It also includes helpful methods to ensure that quantity and price values are formatted correctly for the exchange you’re working with. The design prioritizes efficient memory use, which is important when dealing with a large dataset for backtesting.

## Class BacktestUtils

BacktestUtils offers helpful tools for running and analyzing backtests within the framework. Think of it as a central place to start backtests and get useful information about them.

You can initiate a backtest using the `run` method, providing the symbol to test and some context details like the strategy and exchange names. This method gives you a stream of results as the backtest progresses.

If you just need to run a backtest for a side effect, like logging or triggering callbacks, the `background` method lets you do that without needing to process the results directly.

To understand how a strategy performed, you can retrieve statistical data with `getData` or generate a detailed markdown report with `getReport`. Finally, `dump` makes it easy to save those reports to a file. This class is designed to be easily accessible throughout your backtesting process.

## Class BacktestMarkdownService

This service helps you create readable reports about your backtesting results. It listens for events as your strategies run and keeps track of the closed signals generated by each one.

Think of it as a way to automatically create detailed tables summarizing the performance of your strategies, including important information about each closed signal. These reports are saved as markdown files in a dedicated folder (logs/backtest/{strategyName}.md), making it easy to review and analyze your results.

The service uses a clever system of memoization, ensuring that each strategy gets its own separate storage space for its signal data. It handles the heavy lifting of data accumulation, report generation, and saving to disk, letting you focus on the strategies themselves.

You can clear the accumulated data anytime—either for a specific strategy or for all of them—to start fresh.  The initialization happens automatically the first time you use it, so you don't have to worry about setting it up manually.

## Class BacktestLogicPublicService

BacktestLogicPublicService acts as a central point for running backtests, making the process simpler by automatically handling important details like the strategy, exchange, and timeframe you're using. Think of it as a convenient wrapper around the core backtesting engine. 

It manages context information so you don't have to repeatedly pass it around – functions like fetching candles or generating signals will know where to pull data from. 

The `run` method is your go-to for initiating a backtest; it takes the symbol you want to test and delivers the results as a stream of closed signals.  Essentially, it handles the complexities behind the scenes, allowing you to focus on analyzing the backtest results.

## Class BacktestLogicPrivateService

The `BacktestLogicPrivateService` is the engine that powers your backtesting process, especially when you're dealing with lots of data. It handles the whole backtesting flow, fetching timeframes and running your strategy’s logic.

It works by first gathering the available timeframes, then stepping through each one and calling your strategy's `tick()` function.  When a signal opens (meaning your strategy wants to trade), it grabs the necessary candle data and executes your strategy's `backtest()` method. It intelligently skips ahead in time until a signal closes.

Crucially, this service delivers the results in a memory-friendly way. Instead of building up a massive list of results, it streams them to you one at a time as an asynchronous generator.  This is really helpful when backtesting large datasets. You can even stop the backtest early by breaking out of the generator loop.

The service relies on a few other components – `loggerService`, `strategyGlobalService`, `exchangeGlobalService`, `frameGlobalService`, and `methodContextService` – to manage logging, strategy state, exchange data, timeframes, and method context. The `run` method is the primary way to start a backtest for a specific symbol.

## Class BacktestGlobalService

This service acts as a central hub for backtesting operations within the framework. Think of it as a convenient way to access key components needed for running backtests, especially when you're structuring your code with dependency injection. 

It provides access to things like logging, the core backtesting logic, and validation services to ensure your strategy, exchange, and data frame are all set up correctly. The most important function is `run`, which allows you to execute a backtest for a specific trading symbol, passing along information about the strategy, exchange, and data frame you're using. It returns the results of each tick as the backtest progresses.

# backtest-kit interfaces

## Interface TickEvent

The TickEvent interface represents a single data point within a backtest, providing a consistent structure for all tick-related information. It allows you to easily track and analyze what happened during a trade, regardless of whether it’s an initial signal, an active position, or a closed trade. 

Each TickEvent includes details like the exact timestamp of the event, the type of action that occurred (idle, opened, active, or closed), and relevant data depending on the event type. For example, opened, active, and closed events will provide information on signal IDs, position types, take profit and stop loss prices, and the reason for closing a trade. Closed events also include performance metrics like P&L percentage and trade duration. This unified structure simplifies report generation and analysis by providing all relevant data in a standardized format.

## Interface ProgressContract

This interface helps you monitor the progress of a backtest as it runs in the background. It provides key details like the exchange and strategy being used, the trading symbol, and how far along the backtest is. You'll see the total number of historical data points being analyzed, how many have been processed so far, and a percentage representing the overall completion. Essentially, it's a way to keep an eye on a long-running backtest without blocking your main application.

## Interface PerformanceStatistics

This object holds all the performance data collected during a backtest run for a specific strategy. It allows you to understand how well your strategy performed by aggregating various metrics. 

You'll find the strategy's name here, along with the total number of performance events that were tracked and the overall execution time. The `metricStats` property provides a detailed breakdown of performance grouped by different metric types, while `events` contains the complete list of raw performance events captured during the backtest. This comprehensive set of information helps you analyze your strategy's strengths and weaknesses.

## Interface PerformanceContract

The PerformanceContract helps you keep an eye on how your trading strategies are performing. It’s like a report card for your code, providing details on how long different actions take to complete. You’ll see when each measurement was taken, what kind of operation it was (like order placement or data fetching), and how long it lasted. It also tells you which strategy, exchange, and trading symbol were involved, along with whether it's happening during a backtest or in live trading. This information lets you pinpoint slow parts of your strategy and optimize them for better efficiency.

## Interface MetricStats

This object helps you understand how a particular performance measurement, like order execution time or fill slippage, behaved over the course of a backtest. It bundles together several key statistics about that measurement.

You'll find the `metricType` to know exactly what's being measured (e.g., "order_execution_time"). The `count` tells you how many times that measurement was recorded. Then, you can look at things like `totalDuration`, `avgDuration`, `minDuration`, and `maxDuration` to get a sense of the overall range and central tendency.

For a more detailed picture, the `stdDev` tells you how spread out the values are, while `median`, `p95`, and `p99` give you insights into the durations experienced by a typical sample, and the durations at the extreme ends of the spectrum.

## Interface LiveStatistics

The LiveStatistics interface provides a wealth of information about your live trading results, allowing for detailed analysis of performance. It tracks everything from the raw event data to key performance indicators.

You'll find a complete list of all trading events, including idle periods, order openings, active trades, and closed positions, within the eventList property.  The totalEvents count gives you the total number of all actions taken, while totalClosed indicates how many signals have been closed.

Key metrics like winCount and lossCount tell you how many trades resulted in profit and loss, respectively.  From these, the system calculates winRate, giving you the percentage of winning trades.  You can also see the average profit (avgPnl) and overall cumulative profit (totalPnl) per trade.

Beyond simple profit and loss, LiveStatistics provides insights into risk and volatility. The standard deviation (stdDev) measures the fluctuation of returns, while the Sharpe Ratio and annualized Sharpe Ratio help assess risk-adjusted performance. Certainty Ratio shows how much better wins are compared to losses, and expectedYearlyReturns provides an estimated yearly return based on trade duration and PNL. All numeric values are marked as null if the calculation isn't reliable.

## Interface IStrategyTickResultOpened

This interface represents the result you receive when a new trading signal is created within your backtesting strategy. It signifies that a signal has been validated, saved, and is now actively open.

You'll find key information included in this result, like the `signal` itself – a complete data object containing all the details about the signal, including its newly assigned ID. It also tells you the name of the strategy that generated the signal, the exchange it's associated with, and the price at the moment the signal was opened. Think of it as confirmation and a snapshot of the trading opportunity as it begins.


## Interface IStrategyTickResultIdle

This interface represents what happens during a trading strategy's tick when it's in an "idle" state – meaning no active trading signal is present. It provides information about why the strategy is currently inactive. 

You’ll see the strategy’s name and the exchange it’s operating on to help you track these idle periods.  The `currentPrice` field gives you the prevailing market price (VWAP) at the time of the idle tick. Importantly, the `signal` property will be null, clearly indicating the absence of a trading signal. This structure provides clarity and traceability when the strategy isn't actively making trades.

## Interface IStrategyTickResultClosed

This interface describes the result when a trading signal is closed, giving you a complete picture of what happened. It includes the original signal details, the final price at which it closed, and the reason for the closure – whether it was due to a time limit expiring, a take-profit level being reached, or a stop-loss triggered. 

You’ll also find the exact timestamp of the closing event, along with a detailed profit and loss breakdown including any fees or slippage that occurred. Finally, it clearly identifies the strategy and exchange involved, making it easy to track performance and analyze results. This is your final, definitive report on a closed trading signal.


## Interface IStrategyTickResultActive

This interface represents a tick result within the backtest-kit framework, specifically when a strategy is actively monitoring a signal. Think of it as the state your strategy enters while it’s waiting for a signal to reach a target price (take profit or stop loss) or a specific timeframe to expire.

It carries important information about the current situation, including the name of the strategy and the exchange it's operating on. You’ll also find the signal that's being tracked, the current VWAP price used for monitoring, and confirms that the strategy is in an "active" state. This data helps in understanding and debugging the backtesting process.

## Interface IStrategySchema

The `IStrategySchema` is how you define and register a trading strategy within the backtest-kit framework. Think of it as a blueprint for how your strategy will generate buy and sell signals. 

Each strategy needs a unique `strategyName` so the system can identify it.  You can optionally add a `note` to provide helpful information for other developers. 

The `interval` property controls how often your strategy can be checked for signals – it’s a way to prevent overwhelming the system. 

The most important part is `getSignal`, which is the function that actually figures out what your strategy thinks should happen.  It receives the ticker symbol and returns a signal (or nothing if there's no signal).

Finally, you can include `callbacks` to handle special events like when a strategy starts or stops.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the result of a profit and loss calculation for a trading strategy. It tells you how much your strategy made or lost, expressed as a percentage. 

The `pnlPercentage` property shows the overall profit or loss as a percentage gain or loss. 

You'll also find the `priceOpen` and `priceClose` properties, which detail the entry and exit prices respectively. Importantly, these prices have already been adjusted to account for typical trading costs like fees (0.1%) and slippage (0.1%), so you see a more realistic picture of your strategy’s performance.

## Interface IStrategyCallbacks

This interface lets you hook into the key moments of a trading strategy's lifecycle. You can provide functions to be called when a signal is first opened, while it's actively being monitored, when there are no active signals, or when a signal is closed. Each callback function gives you access to important data like the symbol being traded, the signal data, the current price, and whether the execution is part of a backtest. Think of these callbacks as your chance to react to what's happening in the market and adapt your strategy's behavior accordingly, such as logging events, adjusting parameters, or triggering other actions.




The `onTick` callback gives you access to the raw data on every tick, allowing you to observe market activity in detail. 

`onOpen` alerts you when a new signal is validated and ready to be acted upon.

`onActive` signifies that a strategy is currently watching a signal.

`onIdle` indicates a period where no signals are being actively monitored.

`onClose` informs you when a signal has completed, along with the closing price.

## Interface IStrategy

The `IStrategy` interface lays out the essential functions any trading strategy built with backtest-kit needs to have. Think of it as a blueprint for how your strategy will interact with the framework.

The `tick` method represents a single, individual moment in time for your strategy. It's what happens when new market data arrives – it checks if a new trading signal should be generated and also looks for opportunities to trigger stop-loss or take-profit orders.

The `backtest` method allows you to quickly test your strategy against historical data. It runs through a series of past candles, simulates trades, and helps you evaluate its performance.

Finally, the `stop` method provides a way to pause your strategy's signal generation. This is useful for controlled shutdowns or when you want to temporarily halt trading without abruptly closing any existing orders.

## Interface ISignalRow

This interface, `ISignalRow`, represents a finalized signal that's ready to be used within the backtest-kit framework. Think of it as the core data structure that holds all the details about a trading signal after it's been checked and prepared. 

Each signal has a unique identifier, a `priceOpen` representing the entry price, and information about which `exchangeName` and `strategyName` generated it.  You'll also find the exact `timestamp` the signal was created and the `symbol` being traded – like "BTCUSDT" for Bitcoin against USDT. Essentially, it's a complete package of information to execute a trade.

## Interface ISignalDto

This interface describes the data used to represent a trading signal. When you request a signal, you're going to receive an object structured like this. 

Each signal includes details like the trade direction ("long" to buy, "short" to sell), a human-friendly note explaining the reasoning behind the signal, and the entry price. 

You'll also find information about where to set your take profit and stop-loss orders relative to the entry price – remember, take profit should be higher for long positions and lower for short positions, and the reverse applies to stop-loss. 

Finally, the `minuteEstimatedTime` property lets you know how long the signal is expected to remain active before it expires. An ID is automatically created if you don't provide one.

## Interface IPersistBase

This interface defines the basic operations for saving and retrieving data. It's designed to handle tasks like checking if a piece of data exists, reading it back, and writing new data – all while ensuring that these actions happen reliably.  The `waitForInit` method sets up the storage area and makes sure it’s done only once.  You can use `readValue` to get a specific item, `hasValue` to quickly see if something is stored, and `writeValue` to save a new item or update an existing one.

## Interface IMethodContext

This interface, `IMethodContext`, provides essential information to the backtest-kit framework. Think of it as a little package of details that helps the system know which specific strategy, exchange, and data frame to use during a backtest or simulation. It contains the names of these components – the `exchangeName`, `strategyName`, and `frameName` – allowing the framework to automatically find and connect to the right resources.  The `frameName` will be blank when running in live mode, indicating that no historical data frame is needed. This context is passed around by the `MethodContextService` to streamline the process and avoid having to manually specify these names everywhere.

## Interface ILogger

The `ILogger` interface is your way to record what’s happening inside the backtest-kit framework. It provides different levels of logging – general messages, detailed debugging information, informational updates, and warnings – so you can track events, diagnose problems, and monitor performance.

You can use the `log` method for important events, `debug` for very detailed information useful during development, `info` to get a general overview of successful operations, and `warn` to highlight potential issues that need checking. This logging mechanism is used throughout the system, from agents to policies, so you have visibility into nearly every part of the process.

## Interface IFrameSchema

The `IFrameSchema` lets you define how your backtest will generate data points, essentially setting the boundaries of your historical analysis. Think of it as specifying the timeframe and frequency of your data. 

You’re required to give each frame a unique `frameName` to identify it. You can also add a `note` to help yourself or others understand the purpose of this particular frame.

Crucially, you define the `interval` – whether your data will be daily, hourly, or some other frequency – and set the `startDate` and `endDate` to outline the backtest period.  Finally, you have the option to include `callbacks` for different lifecycle events within the frame, allowing for more customized behavior.

## Interface IFrameParams

The `IFrameParams` interface defines the information needed when setting up a trading environment using the backtest-kit framework. Think of it as the configuration details passed to the `ClientFrame` to get things started. It builds upon the `IFrameSchema` to include a `logger`, which is crucial for tracking what's happening during your backtesting and debugging any issues. This logger allows you to easily see internal workings and any errors that might arise.

## Interface IFrameCallbacks

This section describes the `IFrameCallbacks` interface, which allows you to react to key moments in the backtest framework's handling of timeframes. Think of it as a way to tap into what’s happening behind the scenes. Specifically, the `onTimeframe` property lets you be notified when the framework has created a new set of timeframes for analysis. This is a great opportunity to check that the timeframes are being generated as expected, perhaps by logging their start and end dates or confirming the interval used.

## Interface IFrame

The `IFrame` interface helps generate the sequence of timestamps that your backtesting process will use. Think of it as the engine that provides the dates and times your trading strategies will be evaluated against. 

The `getTimeframe` function is the key here; it takes a symbol (like "BTCUSDT") and returns a promise that resolves to an array of dates. This array represents the intervals at which your strategy will be tested – ensuring your backtest considers data at regular intervals.

## Interface IExecutionContext

The `IExecutionContext` interface provides essential information about the current trading environment. Think of it as a container holding the context needed for your strategies and exchanges to function correctly. It's automatically passed around by the backtest-kit framework, so you don’t have to manually manage it.

You’ll find details like the trading symbol (e.g., "BTCUSDT"), the current timestamp, and whether the code is running in backtesting mode (as opposed to a live trading environment) inside this interface. This helps ensure your code behaves appropriately depending on the situation.


## Interface IExchangeSchema

This interface describes how backtest-kit interacts with different cryptocurrency exchanges. Think of it as a blueprint for connecting to an exchange – it tells the framework where to get candle data (like open, high, low, and close prices over time) and how to properly format trade quantities and prices to match the exchange's specific rules. 

Each exchange you want to use with backtest-kit needs its own schema defined according to this blueprint. You'll provide a unique name for the exchange, an optional note for your own documentation, and the crucial `getCandles` function which retrieves historical price data.  You also specify how to correctly format trade quantities and prices – essential for accurate backtesting.  Finally, you can optionally include callback functions to respond to specific events related to data.

## Interface IExchangeParams

This interface, `IExchangeParams`, defines the information needed when setting up your exchange connection within the backtest-kit framework. Think of it as the configuration details you pass to create your exchange instance. 

It requires a logger, which allows you to track what's happening during your backtesting process with helpful debug messages.  You also need to provide an execution context, which holds vital information like the symbol you're trading, the timeframe you’re using, and whether you’re running a backtest or a live trade.  Essentially, it links your exchange to the broader backtesting environment.

## Interface IExchangeCallbacks

The `IExchangeCallbacks` interface lets you hook into events happening as your backtest kit gathers data from an exchange. Specifically, `onCandleData` is a callback function you can provide. This function will be triggered whenever the system pulls in candlestick data for a particular trading symbol and timeframe.  You'll receive information about the symbol, interval (like 1 minute or 1 day), the starting date of the data, the number of candles requested, and an array containing the actual candle data. Use this callback to perform custom actions, like logging or further processing, based on incoming candlestick information.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with trading venues. It allows you to retrieve historical and future price data (candles) for specific symbols and time intervals, which is essential for simulating trading strategies. 

You can also use this interface to format trade quantities and prices to match the exchange’s rules and to easily calculate the VWAP (Volume Weighted Average Price) based on recent trading activity. This VWAP calculation helps assess the average price at which an asset has traded over a specific period.

## Interface IEntity

This interface, `IEntity`, serves as the foundation for all objects that are stored persistently within the backtest-kit framework. Think of it as a common starting point that ensures all stored data has a consistent structure. Any class implementing `IEntity` guarantees it will have at least the basic properties required for saving and retrieving information. It's a building block that helps maintain order and reliability in your backtesting environment.

## Interface ICandleData

This interface defines the structure of a single candlestick, a common piece of data used in trading. Each candlestick represents a specific time interval and contains key information about price action and trading volume. You'll find the exact time the candle began (timestamp), the opening price, the highest and lowest prices reached, the closing price, and the total volume traded during that period. This data is essential for calculating indicators like VWAP and for building backtesting strategies.

## Interface DoneContract

This interface tells you when a background task, either a backtest or a live trade execution, has finished running. It provides key details about what just completed, like the name of the exchange used, the strategy that ran, and whether it was a backtest or a live trade. You'll find the trading symbol involved, too, so you know exactly what asset was being worked with. Essentially, it's a notification with important information about the finished execution.

## Interface BacktestStatistics

The `BacktestStatistics` interface gives you a detailed breakdown of your trading strategy's performance after a backtest. It holds key metrics like the total number of trades executed and how many were winners versus losers.

You're provided with the win rate, showing the percentage of profitable trades, and the average Profit and Loss (PNL) per trade. Overall cumulative PNL is also included to understand total profitability.

To assess risk, volatility is measured through standard deviation, and a Sharpe Ratio – combining return and risk – is provided, both in standard and annualized form. The certainty ratio highlights the ratio of average winning trade to the average losing trade. Finally, you can see an estimate of expected yearly returns based on trade duration and profitability. All numeric values are omitted if the calculation is not safe to prevent misleading interpretations.
