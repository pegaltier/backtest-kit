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

This function lets you plug in your own logging system for backtest-kit. It's a way to control where and how backtest-kit’s internal messages are displayed. 

When you provide a logger, all log messages generated by the framework will be sent to your logger instead of the default.  Importantly, your logger will automatically receive extra context information like the strategy name, exchange, and trading symbol alongside each log message, making it easier to understand what's happening during backtesting. You'll need to implement the `ILogger` interface to create your custom logger.

## Function listWalkers

This function gives you a peek at all the different "walkers" currently set up in your backtest-kit environment. Think of walkers as specialized components that process data during a backtest. Calling this function returns a list containing information about each walker, allowing you to see what's configured and potentially use this information to build tools or displays. It's a handy way to inspect your backtest setup.


## Function listStrategies

This function lets you see a complete inventory of all the trading strategies that are currently set up and ready to use within the backtest-kit framework. Think of it as a way to get a clear view of what strategies are available for analysis or simulation. It returns a list containing detailed information about each strategy, which is helpful for understanding their configurations or displaying them in an application. You can use this to see exactly what strategies are registered and what their settings are.

## Function listSizings

This function helps you see all the sizing configurations that your backtest kit is using. Think of sizing as how much of an asset you're trading – this function provides a simple way to get a complete list of those sizing rules. It’s handy if you’re trying to understand how your strategy is set up, documenting your system, or creating a user interface that needs to show these settings. The function returns a promise that resolves to an array of sizing schema objects, giving you all the details about each sizing configuration.

## Function listRisks

This function allows you to see all the risk configurations your backtest kit is using. It essentially gathers all the risk settings you've added and presents them in a list. Think of it as a way to inspect what your system considers a "risk" for trading purposes. This is helpful for checking your setup, creating documentation, or building interfaces that need to know about all the potential risks involved.

## Function listFrames

This function provides a way to see all the data frames your backtest kit is using. Think of it as a directory listing for your data – it gives you a list of all the "frames" (essentially tables of data) that have been set up in your trading environment.  It's really helpful if you’re trying to understand the structure of your data, for building tools that automatically display information about your frames, or just for checking that everything is set up correctly during development. The function returns a promise that resolves to an array describing each frame.

## Function listExchanges

This function lets you see all the different exchanges that your backtest-kit framework knows about. It's like getting a directory of supported trading platforms. You can use this to confirm that exchanges are properly registered, to generate a list for a user interface, or simply to understand what data sources are available for your simulations. The function returns a list of exchange schemas, each describing an exchange's capabilities and data requirements.

## Function listenWalkerOnce

This function lets you listen for specific progress updates from a trading simulation, but only once. Think of it as setting up a temporary alert – you define what kind of event you’re waiting for, and when it happens, a function you provide gets called. After that one execution, the listener automatically stops, so you don’t have to worry about cleaning up. It’s a convenient way to react to a particular event within a larger simulation process.

You tell it what event you’re interested in using a filter function and then give it a function that will run when that specific event occurs. Once the event is triggered, your function executes and the subscription ends.

## Function listenWalkerComplete

This function lets you get notified when the backtest kit finishes running all of its tests. It's a way to know when the whole process is done, and it makes sure your code that handles the results runs one step at a time, even if it involves some asynchronous operations. You provide a function that will be called with the results once the testing is complete. Think of it as setting up a listener that waits for the backtest to finish and then executes your function with the results.

## Function listenWalker

This function lets you keep an eye on how a backtest is progressing. It allows you to subscribe to events that are fired after each strategy finishes running within a `Walker`. Think of it as a way to get notified about the completion of each strategy, so you can log results, update a dashboard, or perform other actions. The important thing to remember is that any code you put inside the callback function will be executed one after another, even if it involves asynchronous operations, ensuring a controlled and sequential flow of information. You’re essentially setting up a listener that gets updates in a predictable order.

## Function listenValidation

This function lets you keep an eye on any problems that pop up during the risk validation process, like when your trading signals are being checked. It’s a way to catch errors and debug issues as they happen. Whenever a validation check fails, this function will call a callback you provide, ensuring those errors are handled in the order they occur, even if your callback takes some time to complete. It’s like setting up a notification system specifically for validation failures. You give it a function that will be executed when an error occurs, and it takes care of making sure those errors are dealt with properly.

## Function listenSignalOnce

This function lets you temporarily listen for specific trading signals. You provide a filter—a rule that determines which signals you're interested in—and a callback function that will run only once when a signal matches that rule.  Once the callback has been executed, the subscription automatically stops, so you don’t have to worry about managing it yourself. Think of it as a way to react to a single, particular event in your trading system.

The filter function (`filterFn`) checks each incoming signal to see if it matches your criteria. If it does, the callback function (`fn`) you provided will be triggered just one time, and the subscription ends.


## Function listenSignalLiveOnce

This function lets you temporarily listen for specific trading signals coming from a live backtest. You provide a filter – essentially, rules that define which signals you're interested in – and a function to run when a matching signal arrives. It’s designed for one-time use: once the function runs and processes a signal that fits your filter, it automatically stops listening, keeping your code clean and preventing unnecessary processing. This is helpful for quickly reacting to a particular market condition or testing a specific strategy adjustment without ongoing subscription. The signals you receive come directly from the live backtest execution, ensuring you're dealing with the same data as the simulation.


## Function listenSignalLive

This function lets you tap into the live trading signals being generated by backtest-kit. Think of it as setting up a listener that gets notified whenever a trading signal is ready. It's specifically for signals coming from a `Live.run()` execution – it won’t pick up signals from backtesting.

The signals are delivered one at a time, in the order they occur, ensuring you process them sequentially. You provide a function (`fn`) that will be called whenever a new signal is available, and this function receives the details of the trading signal event. When you’re done listening, the function returns another function that you can call to unsubscribe and stop receiving signals.

## Function listenSignalBacktestOnce

This function lets you listen for specific trading signals generated during a backtest, but only once. You provide a filter that defines which signals you're interested in, and then a function that will be executed just one time when a matching signal arrives. After that single execution, the subscription is automatically canceled, so you don't need to worry about cleaning up. It's perfect for quick, one-off reactions to backtest events without long-term subscriptions. 

Here's a breakdown of how it works:

*   You tell it which signals to look for using a `filterFn`.
*   You provide a `fn` to handle those signals.
*   The `fn` is called just once when a signal matches your filter.
*   The subscription is then automatically removed.

## Function listenSignalBacktest

This function lets you tap into the flow of a backtest and react to what's happening as it runs. It's like setting up an observer that gets notified whenever a signal is generated during the backtest.  The function you provide will be called with information about each signal event, and it's important to note that these events are handled one at a time, ensuring they’re processed in the order they occur. You're only receiving events originating from a `Backtest.run()` execution, so it's specifically for monitoring ongoing backtests. The function you provide returns a way to unsubscribe from these notifications later.

## Function listenSignal

This function lets you easily listen for trading signals – like when a strategy goes idle, opens a position, becomes active, or closes a trade. It provides a way to react to these events in your backtesting code. Importantly, it handles these signals in the order they arrive, and makes sure your reaction code runs one step at a time, even if it involves asynchronous operations. To use it, you provide a function that will be called whenever a signal event occurs, and it will return a function you can call to stop listening.


## Function listenProgress

This function lets you keep an eye on what's happening during a backtest, particularly when long-running tasks are involved. It essentially sets up a listener that gets notified as the backtest progresses, giving you updates on its status. 

The updates, or "progress events," are delivered one at a time, even if your code needs a little extra time to process each one. This ensures that the progress information is handled in a controlled and predictable order. 

To use it, you provide a function that will be called whenever a progress event occurs; this function will receive data about the current progress. The function you provide will be executed sequentially, which is useful when dealing with asynchronous operations.

## Function listenPerformance

This function lets you keep an eye on how your trading strategies are performing in terms of timing. It provides a way to track when different parts of your strategy are running, which is really useful for finding slow spots or bottlenecks. Whenever your strategy executes, it will send timing data to the function you provide, letting you profile its performance. Importantly, these performance updates are processed one at a time, even if your callback function takes some time to complete, ensuring a predictable order of events. To stop listening, the function returns a function that you can call to unsubscribe.

## Function listenError

This function lets you monitor and respond to errors happening behind the scenes when your backtest or live trading system is running tasks in the background. It's a way to be notified if something goes wrong with those background operations, like data fetching or order execution.  You provide a function that will be called whenever an error occurs within the background processes used by `Live.background()` or `Backtest.background()`. The errors are handled one at a time, even if your error handling function takes some time to process – this ensures things stay in order and prevents unexpected issues from concurrent execution. It’s essentially an error listener specifically for background tasks.

## Function listenDoneWalkerOnce

This function lets you listen for when a background process within backtest-kit finishes, but it only triggers once and then automatically stops listening. You provide a filter – a function that determines which completion events you're interested in – and a callback function that will be executed when a matching event occurs. Think of it as setting up a temporary alert that fires just once for a specific kind of completion. After the callback runs, the listener is automatically removed, preventing it from firing again.


## Function listenDoneWalker

This function lets you keep track of when background tasks within your trading backtest finish running. It’s designed to ensure that these completion events are handled one at a time, even if the function you provide to handle them takes some time to complete, like making an asynchronous API call. You give it a function that will be called when a background task is done, and it returns another function you can use to unsubscribe from these completion notifications later. This lets you reliably know when a batch of tasks has finished processing.

## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running within the backtest-kit framework. Think of it as setting up a listener that gets notified only when a specific condition is met regarding the completed background task. The listener will execute your provided function just once, then automatically stops listening, ensuring it doesn't keep running unnecessarily.  You define what triggers the notification by providing a filter function that checks the details of the completed task. This is useful for reacting to specific outcomes of your background tasks without needing to manually manage subscriptions.

## Function listenDoneLive

This function lets you keep an eye on when background tasks within the backtest-kit framework finish running. It's designed for situations where you need to react to the completion of these background processes. 

Think of it as setting up a listener that gets notified when a background task is done. The notification will be delivered in the order the tasks completed, even if your reaction to that completion involves some asynchronous processing. This makes sure things happen in a predictable sequence. You simply provide a function that will be called whenever a background task finishes.

## Function listenDoneBacktestOnce

This function lets you react to when a backtest finishes running in the background, but in a special way – it only triggers your code once. You provide a filter to specify which completed backtests you're interested in, and then a function that will run when a matching backtest is done. After your function runs once, the subscription automatically stops, so you don’t have to worry about managing it yourself. Think of it as setting up a temporary alert for a specific kind of backtest completion. 

It's handy for things like displaying a completion message or performing a one-time action after a particular backtest concludes.


## Function listenDoneBacktest

This function lets you be notified when a backtest finishes running in the background. It’s a way to get a signal that the calculations are complete. When a backtest concludes, the function you provide will be executed. Importantly, even if your function involves asynchronous operations, the backtest kit will ensure these are handled one at a time, in the order they arrive. This guarantees consistent and predictable completion handling. You're essentially signing up for updates on backtest finishes, with the assurance of orderly processing.


## Function getMode

This function tells you whether the trading framework is currently running in backtest mode, which is for testing strategies against historical data, or in live mode, which means it's actively trading with real money. It returns a promise that resolves to either "backtest" or "live," letting your code adapt its behavior based on the environment. Think of it as a simple way to check if you're practicing or performing.

## Function getDate

The `getDate` function provides a simple way to retrieve the current date within your trading strategy. It adapts to the environment you’re running in; when backtesting, it gives you the date associated with the specific historical timeframe you’re analyzing. If you’re running the strategy live, it provides the current real-time date. This is useful for time-based logic within your trading decisions.

## Function getCandles

This function helps you retrieve historical price data, specifically candle data, from a connected exchange. Think of it as a way to look back and see how a trading pair, like BTCUSDT, has performed over time.

You tell the function which trading pair you're interested in, the timeframe you want to examine (like 1-minute, 5-minute, or hourly candles), and how many candles you need. 

The function then uses the exchange's built-in method to fetch that data and returns it to you in a structured format. This is useful for analyzing past performance, testing trading strategies, and generally understanding market trends.

## Function getAveragePrice

This function helps you figure out the average price of a trading pair, like BTCUSDT. It calculates what's called the Volume Weighted Average Price, or VWAP. 

Essentially, it looks at the last five minutes of trading data, specifically the high, low, and closing prices, along with the volume traded at each price. It then figures out a weighted average, giving more importance to prices with higher trading volumes. 

If there's no trading volume available, it just takes the simple average of the closing prices. You provide the symbol of the trading pair, and the function returns a promise that resolves to the calculated average price.

## Function formatQuantity

This function helps you make sure the amounts you're using in your trades are formatted correctly for the specific exchange you're trading on. It takes the trading pair symbol, like "BTCUSDT", and the raw quantity you want to use, and then figures out the right way to display it, accounting for things like decimal places that the exchange requires.  Essentially, it translates your numerical quantity into a string that’s ready to be used when placing orders. 

The function handles the details of how the quantity should be formatted, so you don't have to worry about it. It returns a string representing the formatted quantity.

## Function formatPrice

This function helps you display prices accurately for different trading pairs. It takes a symbol like "BTCUSDT" and a raw price number as input. The function then formats the price based on the specific rules of the exchange, ensuring the correct number of decimal places are shown. It's a convenient way to handle price formatting without having to manually calculate the precision for each trading pair. Essentially, it makes sure your displayed prices look right according to the exchange's standards.

## Function addWalker

This function lets you add a "walker" to your backtest kit, essentially setting up a system for comparing different trading strategies against each other. Think of it as creating a standardized process where multiple strategies are run on the same data and their results are analyzed. You provide a configuration object, known as `walkerSchema`, which tells the backtest kit how to execute and evaluate these strategies. This is useful for systematically testing and refining your trading approaches.

## Function addStrategy

This function lets you add a trading strategy to the backtest-kit framework. Think of it as registering your strategy so the system knows how to use it. When you add a strategy, the framework automatically checks it for potential problems like incorrect pricing or issues with stop-loss orders. It also helps prevent signals from being sent too frequently and ensures your strategy's data is safely stored even if something unexpected happens while you’re trading. You provide a configuration object that describes your strategy, and the framework takes care of the rest.

## Function addSizing

This function lets you tell the backtest-kit framework how to determine the size of your trades. Think of it as setting up the rules for how much capital you're willing to risk on each trade. You provide a configuration object that dictates the sizing method – whether it's a fixed percentage, a Kelly Criterion approach, or based on Average True Range (ATR) – and the specific risk parameters involved. The configuration also includes constraints to limit position sizes and any custom logic you might need through callbacks. By registering this sizing configuration, you ensure the backtest-kit uses your defined rules when calculating position sizes during simulations.

## Function addRisk

This function lets you set up how your trading framework manages risk. Think of it as defining the guardrails for your trading strategies. You're essentially telling the system the maximum number of trades you want to have open at any given time.

It also lets you create more complex risk checks, such as analyzing how your different strategies interact or ensuring certain portfolio conditions are met. When a signal is generated, these risk checks can either allow it to proceed or reject it, and you can even set up notifications for when signals are rejected.

Importantly, multiple trading strategies share the same risk settings, allowing for a holistic view of your overall portfolio risk. The system keeps track of all current trades and makes this information available to your validation functions so you can make informed decisions. This lets you keep a handle on risk across all of your automated trading activities.

## Function addFrame

This function lets you tell backtest-kit how to generate the timeframes it will use for your backtesting simulations. Think of it as defining the 'schedule' for your backtest – you specify the start and end dates, the frequency of the data (like daily, hourly, or weekly), and how the framework should handle events related to those timeframes.  Essentially, it sets up the backbone for organizing your historical data into usable periods for testing your trading strategies. The `frameSchema` object contains all the details to build the timeframe.

## Function addExchange

This function lets you connect your trading framework to a data source representing an exchange. Think of it as telling the system where to get historical price data and how to interpret it. You provide a configuration object, called `exchangeSchema`, that contains all the necessary details about the exchange you're integrating. This includes how to retrieve candle data and how to properly format prices and quantities for trading calculations. By adding an exchange, the framework can then access and utilize its data for backtesting and strategy development.

# backtest-kit classes

## Class WalkerValidationService

The WalkerValidationService helps ensure your trading strategies, or "walkers," are properly configured. Think of it as a gatekeeper that verifies each walker has a defined structure before it's allowed to run.

You can add walker schemas to the service, essentially registering the expected format for each one. The `validate` function then checks if a given source data conforms to the registered schema for a specific walker. 

If you need to see what walkers are registered and their associated schemas, the `list` function provides a convenient way to retrieve that information. This allows you to inspect the defined structure of your trading strategies.

## Class WalkerUtils

WalkerUtils simplifies working with walker comparisons, offering convenient shortcuts to common tasks. Think of it as a helper class to make your life easier when analyzing trading strategies.

The `run` method is your go-to for executing a walker comparison for a specific symbol and providing information about the walker itself. 

If you just need to kick off a walker comparison without needing to see the results immediately, the `background` method lets you run it in the background.

Need to retrieve the complete results of a walker comparison? `getData` pulls all the data you need.

For a nicely formatted summary of the comparison, `getReport` creates a markdown report.

Finally, `dump` allows you to save that report directly to a file on your disk.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of your trading strategies’ configurations, ensuring they're set up correctly. It acts as a central place to store and manage these configurations, which we call "walker schemas."

You can think of it as a system for registering your strategies, giving them unique names, and then easily finding them later. The service uses a special method to make sure the configurations you’re registering are properly formatted. 

Adding a new strategy is simple – you just register it with a name.  If you need to adjust an existing strategy, you can update specific parts of its configuration. Finally, retrieving a strategy is as easy as providing its name.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you automatically create and save reports detailing your trading strategy performance. It listens for updates from your trading simulations (walkers) and organizes the results. Think of it as a system that keeps track of how different strategies are doing and neatly presents that information in a readable markdown format.

Each walker gets its own dedicated storage area, so you can easily compare results across different strategies. You can generate reports for a specific strategy or get a complete overview of all your simulations. The service handles saving these reports to your logs folder automatically.

To get started, the service needs to be initialized, but it handles this automatically the first time you use it.  You can also clear out the accumulated results if you need to, either for all walkers or just a specific one.

## Class WalkerLogicPublicService

This service helps manage and run automated trading strategies, known as "walkers." It simplifies things by automatically passing along important information like the strategy's name, the exchange being used, and the timeframe of the data. 

Think of it as a layer on top of another internal service, making it easier to execute and track backtests across different strategies and exchanges. You can specify a symbol, and the service will handle running the backtests and managing the context needed for each strategy. 

It’s primarily responsible for orchestrating the execution of these backtests, ensuring the correct information is available during the process.

## Class WalkerLogicPrivateService

This service manages the process of comparing different trading strategies – think of it as an orchestrator for strategy battles. It takes a symbol, a list of strategies you want to compare, a metric to evaluate them on (like profit or drawdown), and some contextual information. 

It works by running each strategy one after another, using another service to handle the actual backtesting. As each strategy finishes, you’re given updates on its progress.  Throughout the process, it keeps track of the best performing strategy based on your chosen metric. 

Finally, it delivers a complete report ranking all the strategies you tested. The service relies on other services for logging, handling backtest logic, generating markdown reports, and managing the schema.

## Class WalkerGlobalService

WalkerGlobalService acts as a central point to access walker functionality within the backtest-kit framework. Think of it as a helper that makes it easier to manage dependencies and use the core walker logic. 

It provides a simple way to interact with the walker comparison process, allowing you to run comparisons for specific symbols and pass along important information like the walker’s name, the exchange it’s using, and the name of the frame. 

The service includes a logger for tracking what's happening and a reference to the underlying walker logic. This makes incorporating walkers into your testing and analysis workflows straightforward.

## Class StrategyValidationService

The StrategyValidationService helps ensure your trading strategies are well-defined and consistent before you start backtesting. It acts as a central place to register your strategies and confirm they have the expected structure.

You can add strategy definitions to the service, essentially telling it what a valid strategy looks like.  The `validate` function then checks if a particular strategy definition conforms to the registered schema.

The service also keeps track of all registered strategies, so you can get a list of all known strategy types.  This is useful for understanding what strategies are available for use within your backtesting environment. 

Think of it as a librarian for your strategies – it makes sure everything is organized and follows the rules.

## Class StrategySchemaService

This service acts as a central hub for keeping track of your trading strategy blueprints, ensuring they're well-defined and consistent. It uses a special type-safe system to store these blueprints, making sure they adhere to specific rules. 

You can add new strategy blueprints using the `addStrategy` function, and retrieve them later by their names. The `validateShallow` function helps catch any errors in your blueprint's structure early on, before things get complicated. If you need to update an existing blueprint, the `override` function allows you to do so with just the parts you want to change. Finally, the `get` function lets you easily fetch a specific strategy blueprint by its name when you need it.

## Class StrategyGlobalService

The StrategyGlobalService helps you interact with your trading strategies within the backtest framework. It provides a convenient way to run tests and manage strategies by combining the functionality of other services.

You can use it to quickly check a strategy's signal status at a specific time, essentially peeking at what it would have done. It also allows you to run a fast backtest using a set of historical candle data.

The service provides methods to stop a strategy from producing new signals and to clear its cached information, ensuring a fresh start when needed. These operations are all handled internally, so you don't need to worry about the underlying complexities.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub for managing and executing trading strategies. It automatically directs calls to the correct strategy implementation based on the current context, streamlining the trading process.  To optimize performance, it intelligently caches strategy instances, reusing them whenever possible.

Before you can perform any trading actions, it's essential to ensure the service is initialized. The `tick` method handles real-time trading, processing market conditions and generating signals, while the `backtest` method allows you to test your strategies against historical data. 

If you need to temporarily halt a strategy's signal generation, you can use the `stop` method.  The `clear` method provides a way to refresh a strategy, forcing it to re-initialize and potentially release any resources it might be using.  Essentially, it’s a smart and efficient way to connect to and operate your trading strategies within the backtest-kit framework.

## Class SizingValidationService

The SizingValidationService helps ensure your trading strategies are using correctly defined sizing methods. Think of it as a central place to manage and verify how much capital your strategy is allocating to each trade.

You can add different sizing methods, each with its own specific rules and logic, using the `addSizing` function. This lets you define how your strategy will determine trade size. 

The `validate` function checks if a sizing method has been added and, if you want, checks if the sizing method is of a particular type. 

If you need to see all the sizing methods you've registered, the `list` function provides a way to retrieve them. This is useful for debugging or understanding your overall sizing setup.

## Class SizingSchemaService

The SizingSchemaService helps you organize and manage your sizing schemas in a structured way. It acts like a central repository for these schemas, making sure they're properly registered and easily accessible.

Think of it as a safe keeper for your sizing configurations; it uses a type-safe system to store them. You add new sizing schemas using `register()`, and if you need to update an existing one, you can use `override()` to make partial changes.

Need to use a particular sizing schema? Just grab it by its name using `get()`. It also has a built-in check (`validateShallow`) to make sure your sizing schemas have the necessary information before they’re added.

## Class SizingGlobalService

The SizingGlobalService helps determine how much of an asset to trade, essentially figuring out your position size. It works behind the scenes within backtest-kit and uses a connection service to perform those calculations. Think of it as the engine that translates your risk tolerance and trading strategy into concrete order sizes. It keeps track of logging and manages the connection service for sizing. You can use the `calculate` function to request a position size, providing details about the trade and the context in which it's happening.

## Class SizingConnectionService

The `SizingConnectionService` helps manage how position sizes are calculated within your backtesting system. It acts as a central point, directing sizing requests to the correct sizing method based on a name you provide.

Think of it as a smart router – when you need to calculate a position size, you tell it the sizing method you want to use (like "fixed-percentage" or "kelly-criterion"), and it handles the details. It also remembers which sizing methods you’re using so it doesn't have to recreate them every time, making things faster.

You provide the sizing method name when you need to calculate a size. This service then uses that name to find and use the right sizing logic. If it's the first time using a particular method, it creates it; otherwise, it reuses the existing one.

The `calculate` function takes in parameters and a context that includes the sizing name, ultimately producing the position size based on the chosen sizing method.

## Class RiskValidationService

The RiskValidationService helps you make sure your trading strategies are operating within acceptable risk boundaries. Think of it as a way to define and enforce rules about how much risk a strategy can take.

You start by adding risk profiles, each with a name and a structure (using `addRisk`). Then, when you want to check if a particular strategy is still within those limits, you can use the `validate` function. 

If you need to see all the risk profiles you've set up, the `list` function will return them in a handy list. The `loggerService` property allows you to hook up your preferred logging mechanism for tracking risk-related events. The `_riskMap` property is an internal data structure, so you generally won't need to interact with it directly.

## Class RiskSchemaService

The RiskSchemaService helps you keep track of your risk profiles in a structured and reliable way. It acts as a central place to store and manage these profiles, ensuring they're consistently formatted. 

You can add new risk profiles using the `addRisk()` function, and retrieve them later by their assigned name.  Before a new profile is added, it's checked to make sure it has all the necessary information – this validation happens with `validateShallow`.

If you need to update an existing risk profile, you can use the `override` function to make partial changes without needing to redefine the entire profile.  Finally, the `get` function lets you easily access a risk profile when you need it. This service uses a special type-safe storage system to keep everything organized.

## Class RiskGlobalService

This service acts as a central point for managing risk checks during trading. It connects to a risk management system to ensure trades stay within defined limits. 

The `RiskGlobalService` essentially safeguards your strategies by verifying each trading signal against pre-set risk parameters. It's a behind-the-scenes component that ensures your trading activity complies with risk policies.

Here's what it can do:

*   **`checkSignal`**: This method evaluates whether a trading signal is permissible based on the current risk limits.
*   **`addSignal`**: It lets you register an open position with the risk management system.
*   **`removeSignal`**:  This is used to notify the system when a trade has closed, removing it from active risk monitoring.

The service also internally uses a logger for tracking events and a connection service to interact with the external risk management system.

## Class RiskConnectionService

The RiskConnectionService acts as a central hub for managing risk checks in your trading system. It intelligently directs risk-related operations to the correct risk implementation based on a given name.

Think of it as a smart router; when your strategy needs to check if a trade is safe according to risk limits, this service figures out which risk checker to use.  It also remembers which risk checker is responsible for each name, so it doesn’t have to figure it out every time, making things more efficient.

You can use it to validate trades against various limits like drawdown, symbol exposure, and position counts. It also provides ways to register and unregister trading signals so the risk system knows which positions are active.  If your strategy doesn't have any configured risks, the “riskName” will be empty.

## Class PositionSizeUtils

This class offers helpful tools for figuring out how much of an asset to trade, based on different strategies. Think of it as a set of pre-built calculators for position sizing. 

You can use methods like `fixedPercentage` to size your positions based on a set percentage of your account balance, or `kellyCriterion` for a more sophisticated calculation that considers win rates and win/loss ratios. If you prefer a strategy tied to volatility, `atrBased` uses the Average True Range to determine the size.

Each of these methods has built-in checks to make sure you're using the right inputs for the chosen sizing approach, ensuring more accurate results. You don't need to build these calculations yourself—just call the appropriate method and provide the necessary information.

## Class PersistSignalUtils

The `PersistSignalUtils` class helps manage how trading signals are saved and restored, ensuring your strategies remember their progress even if things go wrong. It acts as a central hub for storing signal data, organizing things neatly for each strategy.

It intelligently caches storage instances, so it's efficient and avoids unnecessary overhead. You can even customize how the data is stored by plugging in your own persistence adapters.

The class handles reading and writing signal data safely, using techniques that make it less likely to lose information if there's a crash. `readSignalData` retrieves saved signal information for a specific strategy and asset, while `writeSignalData` saves new signal data securely. 

Essentially, it provides a robust and reliable way to keep track of your strategies' signal states.

## Class PerformanceMarkdownService

This service helps you understand how well your trading strategies are performing. It listens for performance data as your strategies run and keeps track of key metrics like average execution time, minimum and maximum durations, and percentiles. 

It organizes this data separately for each strategy you're testing. You can easily retrieve the statistics for a specific strategy or generate a detailed markdown report that includes an analysis of potential bottlenecks. The service also allows you to save these reports to disk for later review and provides a way to clear the accumulated data when needed. Finally, it initializes itself to begin listening for performance events.

## Class Performance

The Performance class helps you understand how your trading strategies are performing. It provides tools to gather and analyze performance data, allowing you to identify areas for optimization. 

You can retrieve aggregated performance statistics for a specific strategy to see detailed metrics like average duration, volatility, and outliers. The class also generates readable markdown reports that visually break down performance, highlighting potential bottlenecks and areas needing attention. 

You can save these reports directly to disk for later review or share them with others. Finally, the class lets you clear the accumulated metrics from memory, effectively resetting the performance tracking for a fresh start.

## Class LoggerService

The LoggerService helps you keep track of what's happening during your backtesting and trading simulations. It's designed to automatically add useful information to your log messages, like which strategy is running, which exchange is being used, and the specific timeframe being analyzed. This contextual information makes it much easier to understand and debug issues.

You can use this service's `log`, `debug`, `info`, and `warn` methods to output messages at different levels of severity, all while having the relevant context automatically added for you. If you don't provide your own logger, it defaults to a "no-op" logger, meaning nothing is logged.  You have the flexibility to plug in your own custom logger implementation using the `setLogger` method. The service relies on `methodContextService` and `executionContextService` to manage and inject the contextual information.

## Class LiveUtils

The LiveUtils class is designed to make live trading simpler and more robust. It provides a single, easily accessible way to start and manage live trading processes.

You can initiate live trading using the `run` method, which acts as an unending stream of trading results.  If the process unexpectedly stops, the system is designed to recover and continue from where it left off.

For scenarios where you only need the process to run in the background without directly monitoring the results, the `background` method is available. This is particularly useful for tasks like saving data or triggering external actions.

The `getData` method lets you retrieve statistics related to a specific trading strategy, offering insights into its performance. You can also generate a detailed report in markdown format with `getReport` to analyze all events of a strategy. Lastly, the `dump` method enables you to save these reports directly to your disk for later review.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create reports about your live trading strategies. It keeps track of every event – like when a strategy is idle, opens a position, is active, or closes a trade – and organizes this information for each strategy individually. 

It builds nicely formatted markdown tables showing these events in detail, and also calculates key statistics like win rate and average profit/loss.  The service saves these reports as `.md` files in a `logs/live` directory, making it easy to review your trading activity.

You don't have to worry about manually setting things up; it automatically subscribes to the trading signals. It’s designed to run alongside your strategies, quietly collecting data and generating reports, so you can focus on the trading itself. You can clear the collected data when needed, either for a specific strategy or all of them.

## Class LiveLogicPublicService

The LiveLogicPublicService helps manage and execute live trading operations in a straightforward way. It builds upon the LiveLogicPrivateService, automatically handling the context needed for your trading strategies – things like the strategy name and the exchange being used – so you don’t have to pass them around manually.

Think of it as a continuous stream of trading results (both signals to open and close positions), running indefinitely.  Even if the system crashes, it can recover and pick up where it left off thanks to saved state. 

It provides a `run` function that takes a symbol as input and produces this continuous stream of results, allowing for real-time trading progression based on the current date and time. The service uses a `loggerService` for logging and relies on the `liveLogicPrivateService` for the core trading logic.

## Class LiveLogicPrivateService

This service handles the ongoing process of live trading, working behind the scenes to manage your strategy’s activity. It continuously monitors the market, checking for new signals and keeping track of your trading positions. 

Think of it as an engine that runs indefinitely, constantly checking in with your strategy and providing updates on what's happening. It uses a special technique called an "async generator" to efficiently stream results, so you only receive the important information—when positions are opened or closed. 

If anything goes wrong, it can automatically recover and resume trading from where it left off. You provide a symbol, and it handles the rest, providing a steady flow of trading activity updates. It never stops running, ensuring continuous monitoring and trading.

## Class LiveGlobalService

The LiveGlobalService provides a way to access live trading features within the backtest-kit framework. Think of it as a central point for accessing live trading logic, making it easy to integrate into your applications. It bundles together several important services, including those for logging, public live logic, strategy validation, and exchange validation. 

The core functionality is the `run` method, which allows you to initiate live trading for a specific symbol. This method acts as an ongoing, resilient connection to the live market, continuously providing updates and automatically recovering from potential issues. You’ll need to provide the symbol you want to trade and some context, like the strategy and exchange names.

## Class HeatUtils

This class provides tools to easily create and manage portfolio heatmaps, offering a user-friendly way to visualize strategy performance. Think of it as a helper for understanding how your trading strategies are performing across different assets. 

You can retrieve performance data for a specific strategy, including statistics like total profit/loss, Sharpe Ratio, maximum drawdown, and the number of trades executed for each symbol. It automatically gathers this data from completed trades within the strategy.

It can also generate a nicely formatted markdown report summarizing the heatmap data for a strategy, presenting the information in a table sorted by profitability. Finally, you can save this report to a file on your disk, creating the necessary directories if they don't already exist, so you can share it or keep a record of your analysis. It's designed to be easily accessible and used throughout your backtesting workflow.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and analyze the performance of your trading strategies by creating a portfolio-wide heatmap. It gathers information about closed trades and calculates key metrics like total profit, Sharpe Ratio, and maximum drawdown, both for individual symbols and across your entire portfolio. 

Think of it as a reporting tool that presents your trading data in a clear, easy-to-understand Markdown table. Each strategy gets its own dedicated storage area, ensuring data isolation. 

You can generate reports, save them to disk, and even clear the data when you need to start fresh. The service initializes automatically when you start using it, and it handles potential errors gracefully, so you don't have to worry about unexpected results due to missing or invalid data.

## Class FrameValidationService

The FrameValidationService helps ensure your trading strategy's data is structured correctly. Think of it as a quality control system for the data your strategy uses. 

You start by telling the service the expected format (schema) for each piece of data – for example, a "ticks" frame or an "orders" frame.  The `addFrame` method lets you register these expected formats.

Then, when your strategy receives data, the `validate` method checks if the incoming data matches the registered format. If something is off, you'll get notified. 

Need a quick overview of all the formats you're expecting? The `list` method provides a handy list of all the frame schemas you've registered.  The `loggerService` property gives you access to logging functionalities, while `_frameMap` holds the frame data internally.

## Class FrameSchemaService

The FrameSchemaService helps you keep track of the structure of your trading frames, ensuring they all have the necessary components. It uses a system to safely store these frame structures and allows you to easily add new ones or update existing ones. You can register a new frame schema with a unique name, and then retrieve it later by that same name. The service also includes a validation step to make sure your frame schemas are correctly formatted before they are saved.

## Class FrameGlobalService

The `FrameGlobalService` helps manage and generate the timeframes needed for backtesting. It works behind the scenes, using a connection to data and a logger. 

Essentially, it provides a way to retrieve the dates for each bar in your backtest, organizing them based on the trading symbol you're analyzing. The `getTimeframe` function is the primary tool for getting this date array. It takes a symbol as input and returns a promise that resolves to the timeframe array.

## Class FrameConnectionService

The FrameConnectionService helps you work with specific backtest frames in your trading system. It acts as a central point for accessing and managing these frames, automatically routing requests to the correct frame implementation based on the current context.

Think of it as a smart router – you don't have to manually specify which frame you're working with; the service figures it out for you.  It keeps a memory of the frames it's already created, so accessing them is fast and efficient.

It also provides a way to get the start and end dates for a backtest, allowing you to control the timeframe your backtest covers. This service is particularly useful when you're running backtests but doesn't play a role in live trading where there are no defined frames.

## Class ExchangeValidationService

The ExchangeValidationService helps ensure your trading strategies are compatible with different exchanges. It keeps track of the expected structure (schema) for each exchange you want to use.

You can add exchange schemas to the service, specifying what data is required for each. The `validate` function lets you check if an exchange's data matches the expected schema.

Need to see what exchanges are registered? The `list` function provides a handy overview of all the schemas currently managed.

## Class ExchangeSchemaService

This service helps you keep track of information about different cryptocurrency exchanges, ensuring that data is structured correctly. It uses a special system to safely store these exchange details, making sure everything is type-safe.

You can add new exchange information using the `addExchange` function, and retrieve it later by its name. 

Before adding an exchange, the service checks to make sure all the necessary details are present and in the right format.  You can also update existing exchange information with just the changes you need.

## Class ExchangeGlobalService

This service helps manage interactions with an exchange, making sure the right information about the trade (like the symbol being traded, the exact time, and whether it's a backtest) is available during those operations. It builds on top of another service that handles the exchange connection, effectively adding context to the requests.

You can use it to retrieve historical price data (candles) for a specific symbol and time period. There’s also a method to fetch *future* candles, but that’s only available when running a backtest.

This service can also calculate the average price (VWAP) and format prices and quantities in a way that’s appropriate for the specific trade and context. Each method takes into account the symbol, time, and whether you're in backtest mode.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently routes your requests – like fetching historical price data or getting the current average price – to the correct exchange based on your current settings.

To improve performance, it remembers the connection to each exchange, so you don't have to repeatedly establish them. It’s designed to seamlessly work in both backtesting and live trading environments, adapting how it retrieves data accordingly.

Here’s a quick look at what it offers:

*   **Automatic Exchange Selection:** It figures out which exchange to use based on your configuration.
*   **Optimized Connections:** It keeps track of exchange connections to make things faster.
*   **Candle Data Retrieval:** Easily get historical and future price data.
*   **Price and Quantity Formatting:**  It makes sure prices and quantities are formatted correctly for the specific exchange you’re using, so your orders are valid.

## Class ClientSizing

This class, ClientSizing, helps determine how much of your assets to allocate to a trade. It's designed to be flexible, offering several different sizing methods like fixed percentages, the Kelly Criterion, and Average True Range (ATR) based sizing. You can also set limits on position sizes, ensuring you don't risk too much on any single trade.

The class allows for callbacks, giving you the opportunity to validate the sizing calculations or log the results. It takes parameters when it’s created, outlining how you want it to function. The primary function is the `calculate` method; this is what you'll use to actually get the position size for a given set of conditions.

## Class ClientRisk

The ClientRisk component helps manage risk at the portfolio level, ensuring trading activity stays within predefined boundaries. It acts as a gatekeeper, checking proposed trading signals against configured limits like the maximum number of simultaneous positions you can hold. This component is shared across multiple trading strategies, which enables a broader view of potential risk exposures across your entire portfolio.

It keeps track of all active positions across all strategies in a central location.  The `checkSignal` method is the core of this system, evaluating each potential trade against these rules and custom validations. If a signal fails a check, it’s blocked, and callbacks are triggered to notify the system. 

The `addSignal` and `removeSignal` methods are used to update the system’s record of open and closed positions; these are automatically called when strategies execute trades. Essentially, ClientRisk helps prevent your strategies from taking on too much risk by enforcing established limits and providing a centralized view of your portfolio’s exposures.

## Class ClientFrame

The ClientFrame is a core component for creating the timeline of events during a backtest. It’s responsible for generating the sequence of timestamps that your trading logic will iterate through.

Think of it as the engine that powers the chronological order of your backtest.

It intelligently avoids re-calculating timeframes by caching the results, making the process much more efficient. You can adjust how far apart these timestamps are, from as short as one minute to as long as three days, to fit your backtesting needs.

ClientFrame also allows you to add custom checks and record details during timeframe generation. The `getTimeframe` method is the main way to get these timestamp arrays, and it uses a special caching system to avoid unnecessary computations.


## Class ClientExchange

This class, `ClientExchange`, provides a way to interact with an exchange, specifically designed for backtesting. It's a client-side implementation, meaning it handles fetching data and formatting information.

You can use it to retrieve historical candle data (past price movements), and importantly, to fetch future candles – essential for simulating trading strategies during backtesting. It can also calculate the VWAP (Volume Weighted Average Price) which is an average price reflecting trading volume.

The class also includes helpful methods for formatting trade quantities and prices to match the exchange’s specific requirements. All operations are designed to be efficient, avoiding unnecessary memory usage. It’s your go-to tool for accessing and preparing exchange data within your backtesting environment.

## Class BacktestUtils

This class provides helpful tools for running and analyzing backtests within the trading framework. It streamlines the backtesting process and makes it easier to get insights into your strategies.

The `run` method lets you execute a backtest for a specific symbol, passing along important context information like the strategy's name, the exchange, and the timeframe. It returns a stream of results, letting you track the backtest's progress.

If you just want to run a backtest in the background without needing the individual results – maybe you're just logging the events or triggering some actions – the `background` method is perfect. It quietly runs the backtest and handles the data internally.

Need to understand how a strategy performed overall? `getData` retrieves statistics based on all the signals the strategy generated.  And if you want a nicely formatted report you can easily share, `getReport` creates a markdown document summarizing the backtest's results. Finally, `dump` allows you to save that report directly to a file on your system.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you automatically create and save detailed reports of your backtesting results. It essentially listens for trading signals during a backtest and collects information about the closed trades for each strategy you's using.

You can think of it as a behind-the-scenes reporter that gathers data. Each strategy has its own private storage area for this information. 

The service generates easy-to-read markdown tables summarizing your trades and saves these reports to files, making it simple to review your strategy’s performance.  You can also clear the collected data if you need to start fresh or want to remove old results. The `init` function handles the initial setup and only runs once.

## Class BacktestLogicPublicService

This service simplifies backtesting by automatically handling the context needed for your strategies. Think of it as a helper that passes along information like the strategy name, exchange, and frame, so you don't have to keep repeating it in every function call. 

It uses a private service under the hood to do the heavy lifting and adds a layer of convenience. 

The core functionality is the `run` method, which executes a backtest for a given symbol and provides a stream of closed signals as you iterate through them.  Essentially, it sets up and manages the backtest process, making it easier to focus on your strategy logic.

## Class BacktestLogicPrivateService

This service helps you run backtests in a really efficient way, especially when dealing with lots of data. It breaks down the backtesting process into a series of steps, first getting the timeframe information, then processing each timeframe one by one.

Whenever a trading signal appears (like a buy or sell signal), it fetches the necessary candle data and executes your backtesting logic. It's designed to skip ahead in time until a signal is closed.

The most important thing about this service is that it delivers results as a stream, meaning it doesn't store everything in memory at once. This makes it memory-friendly. You can also stop the backtest early if you need to.

To start a backtest, you call the `run` method, providing the symbol you want to backtest. It returns an async generator that produces the closed results. This service depends on several other global services for timeframes, logging, strategy details, exchange information and execution context.

## Class BacktestGlobalService

This service acts as a central hub for running backtests within the backtest-kit framework. Think of it as a convenient way to access and coordinate various backtesting components. It provides a straightforward interface for kicking off a backtest, passing in the symbol you want to test, along with details about the strategy, exchange, and data frame being used.  Underneath the hood, it manages dependencies like logging and validation services. 

The `run` method is the main entry point; it takes a symbol and context information to execute the backtest and return a sequence of results. This allows you to easily initiate backtesting processes and retrieve the detailed performance data.

# backtest-kit interfaces

## Interface WalkerContract

The WalkerContract describes what happens as a comparison of different trading strategies progresses. Think of it as a report card issued each time a strategy finishes its test run within the larger comparison.

It tells you the name of the strategy that just completed, the exchange and timeframe it was tested on, and the symbol it traded. You’ll also get key performance statistics – like profits and losses – along with a specific metric the framework is trying to improve.

The contract also tracks overall progress, telling you how many strategies have been tested so far, the total number of strategies planned, and what the best-performing strategy has been up until that point. It provides a clear view of how each strategy is performing relative to the others in the comparison.

## Interface TickEvent

This interface defines a standard format for all tick events within the backtest-kit framework. It provides a consistent way to access information about trading activity, regardless of whether it’s a new signal, an open trade, or a closed position.

Each event will have a timestamp and an action type, indicating what's happening (idle, opened, active, or closed). For trades, you'll find details like the symbol being traded, a unique signal ID, the position type (long or short), and any notes associated with the signal.

When a trade is active, you can access the open price, take profit level, and stop-loss price. When a position is closed, you're given information about the closing price, the profit/loss percentage (PNL), the reason for closing, and the duration of the trade. This unified structure simplifies report generation and analysis of your backtesting results.

## Interface ProgressContract

This interface helps you keep an eye on the progress of your backtesting runs. It provides details about what's happening behind the scenes when you're running a backtest in the background. 

You'll see information like the exchange and strategy being used, the trading symbol, and importantly, how far along the backtest is.  It tells you the total number of historical data points being analyzed, how many have already been processed, and the percentage of completion. This allows you to monitor the backtest's status and estimate how much longer it will take.

## Interface PerformanceStatistics

This object holds a collection of performance data for a specific trading strategy. It provides a summary of how the strategy performed, including the strategy's name, the total number of events processed, and the overall execution time. 

You’ll find detailed statistics broken down by different performance metrics, giving you insight into areas like trade execution and order fulfillment. 

Finally, a full list of the raw performance events is available, allowing for a more granular examination of the strategy's behavior.

## Interface PerformanceContract

This interface, `PerformanceContract`, helps you keep an eye on how quickly your trading strategies and backtest kit are running. It’s like a detailed log of the time spent on different operations. Each entry includes a timestamp, the time of the previous event, the type of operation being measured (like order execution or data retrieval), how long that operation took, and details like the strategy name, exchange, and trading symbol involved. Knowing whether it's a backtest or live execution is also recorded. This data is extremely valuable for identifying slow areas in your code and optimizing your trading system's performance.

## Interface MetricStats

This interface, `MetricStats`, is designed to hold a collection of statistics about a particular performance metric. Think of it as a summary report for a specific measurement within your backtesting system.

It includes details like the metric type itself, the total number of times the metric was recorded, and measures of central tendency and spread – things like average, minimum, maximum, and standard deviation durations. 

You'll also find percentiles like the 95th and 99th, which show you how long the metric took most of the time. Lastly, it provides timing statistics relating to intervals between occurrences of the measured event. This information helps you understand the performance characteristics of whatever you're measuring.

## Interface LiveStatistics

This interface gives you a detailed snapshot of your live trading performance. It collects a wide range of statistics from every event, including idle periods, new trades, active positions, and closed signals. You're provided with the total number of events, and a breakdown of winning and losing trades.

Key performance indicators like win rate, average PNL, and total PNL allow you to quickly assess profitability. Volatility is measured through standard deviation, and risk-adjusted returns are evaluated with the Sharpe and annualized Sharpe ratios.  A certainty ratio helps understand the reliability of your trades, and expected yearly returns offer a long-term perspective. Note that if calculations encounter potential issues like division by zero, the corresponding values will be null to indicate an unreliable result. The `eventList` provides the raw data behind all these calculations.

## Interface IWalkerStrategyResult

This interface represents the outcome of running a trading strategy within the backtest-kit framework. It bundles together essential information about a strategy's performance. You'll find the strategy's name, detailed statistics about its backtest results, and a specific metric value that’s used to compare it to other strategies. A ranking is also included, showing how the strategy performed relative to the others – the lower the rank number, the better it did.

## Interface IWalkerSchema

The `IWalkerSchema` lets you set up A/B testing for different trading strategies within your backtest. Think of it as defining a controlled experiment where you're comparing how various strategies perform against each other.

You give it a unique name to identify the test, and can add a note to help you remember what the test is for. 

It specifies which exchange and timeframe to use for all the strategies in the test, keeping everything consistent. The core of the test is the `strategies` property: this is a list of the strategy names you want to compare.

You choose what metric to optimize—like Sharpe Ratio—to see which strategy comes out on top. Optionally, you can provide callbacks to run custom code at different stages of the walker's lifecycle.

## Interface IWalkerResults

The `IWalkerResults` object holds all the information gathered after a backtest walker has compared different trading strategies. It tells you which strategy walker performed the tests, what symbol was being traded, and which exchange and timeframe were used. Crucially, it lists the metric used for comparison, the total number of strategies evaluated, and identifies the best-performing strategy along with its best metric score. You also get the full statistical breakdown of that top-performing strategy for detailed analysis.

## Interface IWalkerCallbacks

This interface provides a way to hook into the backtest process, allowing you to observe and react to key events as the framework compares different strategies.

You can use `onStrategyStart` to know when a particular strategy and symbol combination is beginning its backtest. 

`onStrategyComplete` gets called once a strategy's backtest is finished, giving you access to statistics and metrics to analyze its performance.

Finally, `onComplete` is triggered when all strategy comparisons are done, providing the overall results of the walker process.

## Interface IStrategyTickResultOpened

This interface describes what happens in the backtest-kit framework when a new trading signal is created. It's a notification that a signal has been successfully validated and stored, letting you know a new opportunity is live. 

You’ll find important details included, such as the name of the strategy that generated the signal, the exchange being used, the trading symbol (like "BTCUSDT"), and the current price at the time the signal was opened. The `signal` property itself holds all the information about the newly created signal, including its automatically assigned ID. Essentially, it’s a way to get a notification and the details of every new signal as it begins.


## Interface IStrategyTickResultIdle

This interface represents what happens in your trading strategy when it's in a "waiting" or "idle" state – meaning no active trades are running. It provides key information about the conditions at that moment. 

You'll see this result when your strategy isn’t generating buy or sell signals. It includes the strategy and exchange names, the symbol being traded (like BTCUSDT), the current price, and confirms the action is indeed "idle". The `signal` property will be `null` to clearly indicate the absence of a trading signal. It helps you track when your strategy is waiting for opportunities.

## Interface IStrategyTickResultClosed

This interface represents the outcome when a trading signal is closed, providing a complete picture of what happened and how profitable it was. It includes the original signal details, the final price used for calculations, and a clear explanation of why the signal was closed – whether it was due to a time limit expiring, reaching a take-profit level, or hitting a stop-loss. 

You’ll also find information about the exact time the signal closed, a breakdown of the profit and loss including any fees or slippage, and tracking details such as the strategy and exchange names. It's essentially a final report card for a closed trading signal, giving you all the information needed to understand its performance.

## Interface IStrategyTickResultActive

This interface represents a tick result within the backtest-kit framework when a trading signal is actively being monitored. It means the strategy is waiting to see if the signal reaches a take-profit or stop-loss level, or if a time expiration occurs.

The `action` property confirms this active state.  You’re also given key information about the signal itself, stored in the `signal` property – think of it as the data driving the monitoring.  The `currentPrice` holds the current VWAP (volume-weighted average price) which is being used to track the signal's progress.  Finally, the `strategyName`, `exchangeName`, and `symbol` properties provide useful context for tracking and debugging your backtesting process; they tell you *which* strategy, exchange, and trading pair are involved in the active monitoring.

## Interface IStrategySchema

This schema defines the blueprint for a trading strategy within the backtest-kit framework. Think of it as a way to describe how a strategy generates trading signals – when to buy or sell. 

Each strategy needs a unique name so the system knows which one it is. You can also add a developer note to explain the strategy’s logic. 

The `interval` property sets a minimum time between signal requests, which helps manage how frequently the strategy is evaluated. The core of the strategy is the `getSignal` function, which takes a symbol (like "AAPL") and returns a signal—or nothing if no signal is available. 

You can also define optional lifecycle callbacks, such as `onOpen` and `onClose`, to perform actions when the strategy starts and stops. Finally, you can assign a `riskName` to help categorize the strategy's risk profile.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the outcome of a trading strategy's profit and loss calculation. It gives you the percentage gain or loss, accounting for both trading fees and slippage – those small differences between expected and actual trade prices. You'll find the `pnlPercentage` which tells you the profit or loss as a percentage.  The `priceOpen` property shows the price you originally entered the trade at, adjusted for fees and slippage, while `priceClose` indicates the price you exited the trade at, also adjusted for those costs.

## Interface IStrategyCallbacks

This interface provides a way to hook into the key moments of a trading strategy's lifecycle. Think of it as a notification system, letting your code react to what’s happening in the backtest.

You can define functions to be called on every incoming tick of data using `onTick`, allowing you to perform actions based on real-time market movements.  `onOpen` is triggered when a new trading signal is initiated and validated. `onActive` lets you respond whenever a signal is actively being monitored. `onIdle` signals a period where no active signal is present, and finally, `onClose` provides information when a signal has been closed, including the closing price. These callbacks give you granular control and visibility into your strategy’s behavior during a backtest.

## Interface IStrategy

The `IStrategy` interface outlines the essential functions for any trading strategy built with backtest-kit.  It's the foundation that allows strategies to execute, analyze data, and manage their behavior.

The `tick` function represents a single step in the strategy's execution, processing incoming market data and checking for potential trading signals while also considering take profit and stop-loss orders. 

The `backtest` function offers a quick way to test a strategy using historical price data, simulating trades based on those historical movements.

Finally, the `stop` function provides a way to halt the strategy's signal generation—useful for ending a trading session cleanly without abruptly closing any existing trades that are still active.

## Interface ISizingSchemaKelly

This interface defines a sizing strategy based on the Kelly Criterion, a mathematical formula used to determine optimal bet sizes. When implementing this, you're essentially telling the backtest kit that your sizing logic follows the Kelly Criterion approach. 

The `method` property must be set to "kelly-criterion" to identify it as such. 

The `kellyMultiplier` property controls how aggressively you apply the Kelly Criterion; a value of 0.25, for example, represents a quarter Kelly strategy, which is a more conservative approach. You can adjust this number to suit your risk tolerance.

## Interface ISizingSchemaFixedPercentage

This schema defines a trading strategy where you consistently risk a fixed percentage of your capital on each trade. The `method` property is always set to "fixed-percentage" to identify this specific sizing approach. You’re essentially telling the system how much of your total funds you're comfortable losing on a single trade, expressed as a number between 0 and 100, using the `riskPercentage` property. For example, a `riskPercentage` of 10 means you risk 10% of your capital per trade.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, provides a foundational structure for defining how much of your account to allocate to trades. Think of it as the blueprint for sizing your positions. 

It includes essential properties like a unique identifier (`sizingName`) to distinguish different sizing strategies, a place for notes (`note`) to explain your logic, and limits on position sizes – both as a percentage of your account (`maxPositionPercentage`) and in absolute units (`minPositionSize`, `maxPositionSize`).  You can also attach callback functions (`callbacks`) to trigger actions at different stages of the sizing process, allowing for more dynamic sizing behavior. This schema is a core component for controlling risk and optimizing trade performance.


## Interface ISizingSchemaATR

This schema defines how your trading strategy determines the size of each trade using the Average True Range (ATR). 

The `method` property is always set to "atr-based", indicating you're using this specific sizing approach. 

`riskPercentage` lets you control how much of your account balance you're willing to risk on a single trade, expressed as a percentage.  

Finally, `atrMultiplier` scales the ATR value to calculate the stop-loss distance, essentially defining how much price movement you're comfortable with before exiting a trade.

## Interface ISizingParamsKelly

This interface defines how you can specify sizing parameters based on the Kelly Criterion when setting up your trading strategy. It allows you to incorporate logging for debugging purposes, ensuring you can track and understand how your sizing decisions are being made. The `logger` property lets you plug in a logging service to monitor the sizing calculations and any potential issues. Essentially, it’s a way to make your trading strategy more transparent and easier to troubleshoot.

## Interface ISizingParamsFixedPercentage

This interface defines how much of your capital you’re going to use for each trade when using a fixed percentage sizing strategy. It’s a simple way to ensure your trades are consistently sized based on a percentage of your total account balance. 

The `logger` property is included so you can easily add debugging information to track how your sizing calculations are working. You’ll pass in a logging service to get helpful output during backtesting.

## Interface ISizingParamsATR

This interface defines the settings you can use when determining how much to trade based on the Average True Range (ATR). It helps you control your trading size in a way that reacts to market volatility.

The `logger` property is all about getting helpful information during your backtesting process; it allows you to see what's happening and debug any potential issues. Think of it as a way to keep an eye on things behind the scenes.

## Interface ISizingCallbacks

The `ISizingCallbacks` interface helps you tap into the sizing process within backtest-kit. Think of it as a way to observe and potentially influence how your trading system decides how much to buy or sell. Specifically, the `onCalculate` callback gets triggered after the system has determined the size of the trade. You can use this opportunity to log the calculated size, verify it makes sense, or perform any other actions you need based on that value. The callback provides you with the calculated quantity and some extra parameters to work with.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate trade sizes using the Kelly Criterion. It's all about figuring out how much to risk on each trade based on your historical performance.

You'll need to provide your win rate, which is the proportion of your trades that have been successful.  Then, you also need the average win/loss ratio, which represents how much you win on winning trades compared to how much you lose on losing trades.  Essentially, it allows you to specify the inputs for a Kelly Criterion calculation to help determine optimal position sizing.

## Interface ISizingCalculateParamsFixedPercentage

This interface helps define how much of your capital to use for each trade when using a fixed percentage sizing strategy. It's a straightforward way to risk a consistent portion of your available funds on every trade. You specify the `method` as "fixed-percentage" to indicate you're using this sizing approach. The `priceStopLoss` property is crucial; it represents the price at which your stop-loss will be triggered, helping determine the size of the trade based on the risk associated with that stop-loss level.

## Interface ISizingCalculateParamsBase

This interface, `ISizingCalculateParamsBase`, provides the foundational information needed when determining how much of an asset to trade. It ensures all sizing calculations have access to the same essential data. You’ll find things like the trading pair’s symbol – like "BTCUSDT" – along with your current account balance and the anticipated price at which you plan to enter the trade. These parameters act as a common starting point for calculating position sizes in backtest-kit.

## Interface ISizingCalculateParamsATR

When calculating trade sizes using an ATR-based method, this structure defines the information you need to provide. It requires you to specify that you're using the "atr-based" sizing method and also includes the current ATR value, which is a key factor in determining how much to trade. Think of this as telling the system "I want to size my trades based on the Average True Range, and here's what the ATR currently is."

## Interface ISizing

The `ISizing` interface helps your trading strategies determine how much to buy or sell in each trade. It's all about figuring out the right position size. The core of this interface is the `calculate` function, which takes in some parameters outlining your risk preferences and then returns the calculated position size as a number. This function is the workhorse for managing risk and determining how much capital to allocate to each trade.

## Interface ISignalRow

The `ISignalRow` interface represents a complete signal that's been processed and validated within the backtest-kit framework. Think of it as the standard format for signals that move through the system.

Each signal has a unique identifier, automatically created to keep things organized.  It also includes the entry price for a trade, along with details about which exchange and strategy generated the signal. 

You'll find information like the creation timestamp, and the trading symbol (like BTCUSDT) all packaged neatly within this interface. It’s a central piece for understanding and working with signals during backtesting.


## Interface ISignalDto

This data structure, called ISignalDto, represents a trading signal. It's what you're given when you request a signal.

Each signal includes details like whether to go long (buy) or short (sell), a description of why the signal was generated, and the suggested entry price.

You’ll also find target prices for taking profits and stop-loss levels, with the important rule that take profit needs to be higher than the entry price when going long and lower when going short, and stop loss has the opposite condition. 

Finally, there's a field to estimate how long the signal is expected to be active before it expires. A unique ID will be automatically generated if you don't provide one yourself.

## Interface IRiskValidationPayload

This data structure holds information used when evaluating risk in your backtesting simulations. Think of it as a snapshot of your portfolio's current state.

It includes the total number of active trades you’re holding, and a detailed list of each of those active positions, providing specifics on what’s currently open. This information lets risk validation functions assess potential vulnerabilities and ensure your trading strategy stays within defined boundaries.

## Interface IRiskValidationFn

This defines a function that's crucial for ensuring your trading strategies are safe and well-configured. Think of it as a gatekeeper for your risk settings. It takes your risk parameters as input, performs checks to make sure they're reasonable and won't lead to unintended consequences, and if something's amiss, it raises an error to alert you. This helps prevent your backtesting or live trading from going off the rails due to incorrect settings. Essentially, it's about building a layer of protection into your trading framework.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define rules to ensure your trading strategies are safe and sound. Think of it as setting up checkpoints to verify that your risk parameters are reasonable before a trade is executed. 

It has two key parts: the `validate` function, which is where you put the actual logic to check the risk values, and the `note` property, where you can add a friendly description to explain what the validation is doing. This note helps others (or even yourself later!) understand the purpose of the risk validation.

## Interface IRiskSchema

The `IRiskSchema` lets you define and manage risk controls for your trading portfolio. Think of it as a blueprint for how you want to enforce certain rules and limitations on your trades. 

Each schema needs a unique `riskName` so you can easily identify it. You can also add a `note` to help you and other developers understand the purpose of this specific risk control.

The `callbacks` property allows you to hook into specific moments in the trading process, like when a trade is rejected or allowed, giving you extra control and potential for logging or other actions.

Finally, `validations` is where you put the actual rules – a list of functions or objects – that will be used to determine if a trade can proceed based on your defined risk parameters. This is the heart of your risk logic.

## Interface IRiskParams

The `IRiskParams` interface defines the information you provide when setting up the risk management component of your backtesting system. Think of it as a blueprint for configuring how the system will manage risk. It requires a `logger` – this is a tool that allows you to track what's happening during your backtest, helping you debug and understand its behavior. Essentially, it's a way to keep an eye on things as your backtest runs.

## Interface IRiskCheckArgs

This interface, `IRiskCheckArgs`, provides the information needed to assess whether a new trade should be allowed. Think of it as a safety check performed before a trading strategy generates a signal. It bundles key details like the trading symbol, the name of the strategy requesting the trade, which exchange it's happening on, the current market price, and the timestamp of the check. This information allows you to enforce rules or constraints before a trade is actually executed, ensuring conditions are right for opening a new position. You'll find that it carries data directly from the `ClientStrategy` context.

## Interface IRiskCallbacks

This interface defines optional functions you can use to get notified about the results of risk assessments during trading. Think of them as event listeners for risk-related decisions.

`onRejected` is called whenever a trading signal is blocked because it violates your predefined risk limits. This lets you know a potential trade was stopped.

`onAllowed` is triggered when a trading signal successfully clears all the risk checks and is approved for execution. This lets you track which signals are being permitted.



You don’t need to implement these callbacks if you’re happy with the default risk handling, but they provide a way to monitor and potentially react to risk events in your backtesting or live trading environment.

## Interface IRiskActivePosition

This interface, `IRiskActivePosition`, represents a single trading position that's being actively tracked by the risk management system. Think of it as a snapshot of a trade that’s currently open. It holds important details about that position, such as the signal that triggered it, the name of the strategy responsible, the exchange used, and the exact time the position was started. Having all this information together allows for a more complete view of risk across different trading strategies.

## Interface IRisk

The `IRisk` interface helps manage and control the risk associated with your trading strategies. Think of it as a gatekeeper, ensuring your signals and positions stay within defined risk boundaries.

It offers a way to check if a signal is permissible, considering your risk limits – essentially, a safety check before placing a trade. 

You can also register when a new signal or position is opened, and equally important, inform the system when a position is closed. This tracking allows the framework to maintain accurate risk exposure and make informed decisions. 

The `checkSignal` method is used to evaluate signals, while `addSignal` and `removeSignal` are for tracking open and closed positions respectively, keeping your risk management updated.

## Interface IPositionSizeKellyParams

This interface defines the settings you need to calculate position sizes using the Kelly Criterion. It's all about figuring out how much of your capital to allocate to each trade. 

You'll provide two key pieces of information: the win rate, which represents the percentage of trades that are profitable, and the win/loss ratio, which describes the average profit compared to the average loss on a winning trade. These parameters help the framework determine an optimal position size based on your trading strategy's historical performance.

## Interface IPositionSizeFixedPercentageParams

This interface defines the settings needed for a trading strategy that uses a fixed percentage of your available capital to size each trade, and includes a stop-loss price. Specifically, `priceStopLoss` tells the system at what price you want to place a stop-loss order to limit potential losses on the trade. It helps ensure your trades are managed responsibly by automatically implementing a stop-loss based on a predetermined price.

## Interface IPositionSizeATRParams

This interface, `IPositionSizeATRParams`, defines the information needed to calculate your position size based on the Average True Range (ATR). It’s specifically designed to be used when determining how much to trade, using the ATR as a key factor. The core piece of information you provide is the `atr` value, which represents the current ATR calculated over a certain period. This value is crucial for sizing your trades appropriately based on market volatility.

## Interface IPersistBase

This interface provides the fundamental building blocks for managing data storage within the backtest-kit. Think of it as the core way to read, write, and check for the existence of your trading data. 

The `waitForInit` method ensures your storage area is set up correctly and any necessary initializations happen only once. `readValue` allows you to retrieve a specific data item from storage, while `hasValue` lets you quickly check if a data item already exists. Finally, `writeValue` provides the mechanism for saving data to the storage, guaranteeing that the write operation is completed reliably.

## Interface IMethodContext

The `IMethodContext` interface helps your backtest-kit code know which specific versions of your trading systems to use. Think of it as a little package of information that gets passed around. It tells your code which strategy, exchange, and frame configurations it should be working with during a backtest or simulation. The `exchangeName` and `strategyName` properties are straightforward – they indicate the names of the schemas for those components.  The `frameName` property is a bit special; it's left blank when you're running in live trading mode because you’ll be using real-time data, not a historical frame.

## Interface ILogger

The `ILogger` interface provides a way to record what's happening within the backtest-kit trading framework. It's like a digital notebook that different parts of the system use to keep track of events.

You can use it to write down general messages about what's going on, or more detailed debug information when you're trying to figure something out. It also lets you log informational updates about successful actions and warnings about potential issues. This logging helps with troubleshooting, monitoring the system’s health, and understanding its behavior over time.

Essentially, it gives you a flexible way to capture various lifecycle events, tool executions, validations, and errors so you can better understand and manage your trading strategies.

## Interface IHeatmapStatistics

This interface defines how statistics are organized for a portfolio heatmap, giving you a consolidated view of your trading performance. It bundles information about all the symbols you're tracking into one place.

You’ll find an array detailing statistics for each individual symbol, alongside key overall portfolio metrics. These metrics include the total number of symbols, the overall portfolio profit and loss (PNL), the Sharpe Ratio indicating risk-adjusted returns, and the total number of trades executed across your portfolio. Essentially, it's a convenient way to see the big picture of your portfolio's activity.

## Interface IHeatmapRow

This interface represents a single row of data in a portfolio heatmap, providing a snapshot of performance for a specific trading pair like BTCUSDT. It bundles key metrics calculated across all strategies used for that pair.

You'll find information like the total profit or loss percentage achieved, a measure of risk-adjusted return (Sharpe Ratio), and the largest drop experienced (maximum drawdown). It also details the total number of trades executed, broken down into wins and losses. 

Other useful figures include the average profit per trade, the consistency of returns (standard deviation), and a look at win/loss patterns. Finally, it captures streaks of winning and losing trades, as well as a broader expectation of future performance.

## Interface IFrameSchema

The `IFrameSchema` defines how your backtesting environment is structured in terms of time. Think of it as setting the rules for when your trading strategy will be evaluated. It tells the backtest-kit what dates and time intervals you want to use for your historical data.

Each schema has a unique name to identify it, and a helpful note for developers to add context. It specifies the time interval – like daily, hourly, or weekly – and the start and end dates of your backtest period. You can also optionally provide lifecycle callbacks to customize behavior at various points during the backtesting process. Essentially, this schema lays the foundation for your entire backtest, ensuring the engine knows when and how to generate the necessary timestamps.

## Interface IFrameParams

The `IFramesParams` interface defines the information needed when creating a ClientFrame, which is a core component for running trading strategies. It's designed to hold essential configuration details and includes a `logger` property. This logger lets you track what's happening internally within the frame, helping you debug and understand how your trading logic is executing. Think of it as a way to peek behind the scenes and see the frame's inner workings.

## Interface IFrameCallbacks

The `IFrameCallbacks` interface lets you hook into important moments in how backtest-kit builds and manages the time periods it uses for testing. Specifically, you can use it to react when the timeframes for backtesting are created. The `onTimeframe` callback gives you the generated array of dates, the start and end dates, and the interval used to create them. This is a handy way to check that the timeframes are what you expect, or to record information about their construction for later analysis.

## Interface IFrame

The `IFrame` interface helps manage the timeline of your backtesting simulations. It's how backtest-kit figures out when to execute trades. 

The key method, `getTimeframe`, is responsible for creating an array of dates – these dates represent the points in time your trading strategy will be tested on.  You provide a trading symbol, and the function returns a promise that resolves to an array of dates, spaced according to how frequently you want your backtest to run (e.g., every minute, hour, or day). Essentially, it gives you the sequence of moments your strategy will experience during the backtest.

## Interface IExecutionContext

The `IExecutionContext` interface holds important information about the current trading environment. Think of it as a package of details passed along during strategy execution or when retrieving data. It tells your strategy what trading pair it’s dealing with, what the current time is, and whether it’s running a backtest or a live trade. This context is essential for making informed decisions and ensuring your code behaves correctly in different scenarios.

## Interface IExchangeSchema

The `IExchangeSchema` lets you connect backtest-kit to different data sources, like APIs or databases, that provide market data. Think of it as a blueprint for how backtest-kit understands and uses data from a specific exchange.

You're required to give each exchange a unique `exchangeName` for identification.  You can optionally add a `note` to provide extra information for developers using the framework.

The core of the schema is the `getCandles` function, which is responsible for retrieving historical candle data (open, high, low, close prices) for a given symbol and timeframe.  It also lets you define how to correctly format order quantities and prices to match the exchange's specific rules with `formatQuantity` and `formatPrice`.

Finally, you can provide optional `callbacks` to be notified of events, like when new candle data becomes available, giving you fine-grained control over the data flow.


## Interface IExchangeParams

The `IExchangeParams` interface defines the information needed when setting up an exchange within the backtest-kit framework. Think of it as the configuration settings for how your exchange will operate during a backtest. 

It requires a `logger` so you can see what's happening – useful for debugging and understanding your trading logic.

You also need to provide an `execution` context, which contains critical information like the trading symbol, the time period being tested, and whether it's a backtest or a live run. This context makes sure your exchange behaves correctly within the backtest environment.

## Interface IExchangeCallbacks

The `IExchangeCallbacks` interface lets you hook into events happening when the backtest kit is pulling data from an exchange. Specifically, the `onCandleData` callback lets you react whenever a batch of candlestick data is retrieved. This callback provides the symbol, interval (like 1 minute or 1 day), the starting date, the number of candles requested, and the actual data received. You can use this to log data, perform real-time calculations, or react to specific price patterns as they come in.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with an exchange to get data and format orders. 

It allows you to retrieve historical candle data (`getCandles`) by specifying a symbol, interval, and how many candles you need. Similarly, `getNextCandles` lets you fetch future candle data, which is useful during backtesting. 

For placing orders, `formatQuantity` and `formatPrice` ensure that order sizes and prices adhere to the exchange's specific precision requirements.

Finally, `getAveragePrice` calculates the VWAP (Volume Weighted Average Price) using the most recent five-minute candles, providing a useful indicator for trading decisions.

## Interface IEntity

This interface, IEntity, serves as the foundation for all data objects that are saved and retrieved from a database or persistent storage. Think of it as a common blueprint ensuring that every entity you work with has a consistent structure. It’s the starting point for defining your data models within the backtest-kit framework, guaranteeing a standardized way to interact with persistent data.

## Interface ICandleData

This interface defines the structure of a single candlestick, the basic building block for analyzing price action and building trading strategies. Each candlestick represents a specific time interval and contains important data points like the time it started (`timestamp`), the price when it opened (`open`), the highest and lowest prices within that period (`high`, `low`), the closing price (`close`), and the volume of trades that occurred (`volume`). It's a core element for calculating indicators and running backtests to evaluate trading ideas. You'll encounter this structure frequently when working with historical price data within the backtest-kit framework.

## Interface DoneContract

This interface signals when a background process, either in backtesting or live trading, has finished running. Think of it as a notification that your automated strategy has completed its work. It provides key details about the process, including which exchange was used, the name of the trading strategy that ran, whether it was a backtest or live execution, and the specific trading symbol involved.  It's helpful for tracking and monitoring the completion of asynchronous tasks within your trading system.

## Interface BacktestStatistics

This interface holds all the key statistical information generated after running a backtest. You're given a detailed breakdown of your strategy's performance, including a list of every individual trade and its specifics.

It tracks the total number of trades made, and separates them into winning and losing trades. The win rate shows the percentage of profitable trades.

Several metrics help you assess profitability and risk: average PNL (profit per trade), total PNL (cumulative profit), and volatility represented by standard deviation. The Sharpe Ratio and Annualized Sharpe Ratio combine these factors for a risk-adjusted return assessment, while the Certainty Ratio indicates how much better winning trades are compared to losing ones. Finally, you can estimate yearly returns based on trade durations and profits. 

Keep in mind that if calculations result in undefined or infinite values, those statistics will be reported as null.
