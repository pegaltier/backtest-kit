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

You can now customize how backtest-kit reports information during your backtesting runs. This `setLogger` function lets you plug in your own logging system, like sending logs to a file, a database, or a centralized logging service. The framework will automatically add helpful context to each log message – things like the strategy name, the exchange being used, and the trading symbol – making it easier to understand what's happening during the backtest. Just provide an object that follows the `ILogger` interface, and all internal messages will be directed to your new logger.

## Function listWalkers

This function lets you see all the different strategies (walkers) that are currently set up within the backtest-kit framework. Think of it as a way to get a complete inventory of your trading approaches. It returns a list of descriptions, allowing you to understand what each strategy is designed to do. This is helpful for understanding your system, creating tools to manage your strategies, or simply checking what's running.

## Function listStrategies

This function helps you see all the trading strategies that are currently set up within the backtest-kit framework. Think of it as a way to get a complete inventory of your available strategies. It returns a list of strategy descriptions, which you can use to understand what strategies are ready to be used for backtesting or to display them in a user interface. Essentially, it’s a tool for exploration and organization within your trading environment.


## Function listSizings

This function lets you see all the sizing configurations that are currently in use within the backtest-kit framework. It's like checking a registry of how different assets are sized for trading. You can use this to understand how your sizing rules are set up, to generate documentation about your configurations, or even to build user interfaces that dynamically adjust based on the available sizing options. Essentially, it gives you a complete view of your sizing setups.

## Function listFrames

This function lets you see all the different types of data structures – we call them frames – that your backtesting system is using. Think of it as getting a directory listing of your data organization. It's particularly helpful if you're trying to understand how your system is structured, generating documentation, or building tools that need to know about all the available frame types. The function returns a list of these frame schemas, giving you a clear picture of the data models in play.

## Function listExchanges

This function helps you discover all the exchanges your backtest-kit is set up to work with. Think of it as a way to see a full inventory of trading venues your system knows about. It fetches a list of exchange configurations, which is useful for things like checking your setup, generating documentation, or building interfaces that adapt to different exchanges. The result is a promise that resolves to an array of exchange schema objects.


## Function listenWalkerOnce

This function lets you watch for specific events happening within a process, but only once. Think of it as setting up a temporary observer that reacts to a single occurrence of something you're interested in. 

You provide a filter – a condition that must be met for the event to trigger your callback function. Once an event passes this filter, your callback is executed, and the observer automatically disappears, preventing further executions. 

It's a handy way to wait for a particular state to be reached or a specific action to complete without needing to manage subscriptions manually. The function returns an unsubscribe function so you can manually stop the listener if needed.


## Function listenWalkerComplete

This function lets you be notified when the backtest kit has finished running all of your strategies. It's like setting up a listener that gets triggered once the entire testing process is done. The information about the results of the backtesting is passed to your function. Importantly, even if your function does something asynchronous (like making a network request), it won't interrupt the sequence of other completion events. You get a guarantee that things happen in the order they're meant to. The function returns another function you can call to unsubscribe from these completion notifications.

## Function listenWalker

The `listenWalker` function lets you keep an eye on how a backtest is progressing. It provides a way to be notified after each strategy finishes running within a `Walker`.  You give it a function (`fn`) that will be called with information about the completed strategy. Importantly, this function will be executed sequentially, even if it's an asynchronous operation, ensuring that events are handled in the order they arrive and preventing any issues with running things concurrently.  The function you provide returns another function, which you can use to unsubscribe from these progress updates when you no longer need them.

## Function listenSignalOnce

This function lets you set up a temporary listener for trading signals. It’s perfect when you only need to react to a specific signal condition once and then stop listening. You provide a filter – a rule to determine which signals you're interested in – and a function that will be executed when a matching signal arrives. The listener automatically removes itself after the callback has run just one time, keeping your code clean and preventing unnecessary processing.


## Function listenSignalLiveOnce

This function lets you quickly react to specific trading signals coming from a live backtest run. You provide a filter that defines which signals you're interested in, and a callback function that will be executed just once when a matching signal arrives.  Think of it as setting up a temporary listener that automatically disappears after it’s done its job, ensuring you don't continue receiving signals unnecessarily. It’s perfect for situations where you need to perform a one-off action based on a live signal, like logging a particular event or triggering a simple alert. The function returns an unsubscribe function so you can manually stop listening if needed, although it will automatically unsubscribe after the callback executes. 


## Function listenSignalLive

This function lets you tap into the live trading signals generated by backtest-kit. Think of it as setting up a listener that gets notified whenever a new signal is produced during a live run. 

It’s designed to handle these signals in a reliable way – events are processed one at a time, ensuring they’re handled in the order they arrive.  You're only going to receive events from executions started with `Live.run()`. 

To use it, you provide a function (`fn`) that will be called whenever a new signal arrives. This function receives an `IStrategyTickResult` object, which contains all the information about the signal.  The function also returns another function that you can call to unsubscribe from these live signals.


## Function listenSignalBacktestOnce

This function lets you set up a listener that only reacts to specific signals generated during a backtest. Think of it as setting up a temporary alert – you define what kind of signal you're interested in, and when that signal appears, your code runs once. After that single execution, the listener automatically turns itself off, so you don’t have to worry about managing subscriptions. You provide a filter to determine which signals you want to see, and a function to handle that signal when it appears. It’s designed for situations where you need to react to a particular event during a backtest run and then are done with it.


## Function listenSignalBacktest

This function lets you tap into the backtest process and react to what's happening during the simulation. It’s like setting up a listener that gets notified whenever a signal is generated within the backtest. 

You provide a function, and this function will be called repeatedly with information about each signal. Importantly, these signals are handled one at a time, ensuring things happen in the order they occur within the backtest run. 

This is particularly useful if you need to react to signals in real-time or perform actions based on the data being generated during the backtest.


## Function listenSignal

This function lets you tap into the trading signals generated by the backtest-kit framework. Think of it as setting up a listener that gets notified whenever a strategy changes state – whether it's idle, opening a position, actively trading, or closing one. The key thing to know is that these notifications are handled in a specific order, even if your processing involves asynchronous operations. This guarantees a predictable sequence of events, ensuring that your logic runs smoothly and avoids any unexpected race conditions. You simply provide a function that will receive these signal events, and the framework takes care of managing the delivery and order of notifications.

## Function listenProgress

This function lets you keep an eye on how your backtest is doing while it's running in the background. It's like setting up a listener that gets notified about progress updates. These updates are sent while the backtest is performing its calculations in the background. Importantly, even if your progress update function takes some time to process (like if it’s asynchronous), the updates will be handled one after another in the order they were received, preventing any conflicts. To stop listening for these progress updates, the function returns another function that you can call to unsubscribe. You simply provide a function that will be called with each progress event.

## Function listenPerformance

This function lets you monitor how your trading strategies are performing in terms of timing. It's like having a built-in profiler that tells you how long different parts of your strategy take to execute. 

You provide a function (`fn`) that will be called whenever a performance event occurs. The function receives a `PerformanceContract` object containing the timing details. 

Importantly, the events are handled one after another, even if your callback function does some asynchronous work. This ensures that performance data is collected reliably without getting tangled up in concurrent operations. Think of it as a way to keep a close eye on where your strategy might be slow and optimize accordingly.

## Function listenError

This function lets you keep an eye on any errors that pop up during background tasks within your backtesting or live trading environment. It's like setting up an error listener specifically for operations running in the background, such as data fetching or strategy calculations. 

Whenever an error is caught while a background task is running, this listener will call the function you provide. Importantly, even if your error handling function itself takes some time to execute, the errors will be processed one at a time to prevent any potential conflicts. This helps ensure your application handles errors in a controlled and reliable manner. You provide a function to be executed when an error occurs, and the function will return an unsubscribe function, which you can use to stop listening for errors.

## Function listenDoneWalkerOnce

This function lets you react to when a background task finishes within backtest-kit, but only once. You provide a filter to specify which task completions you're interested in, and then a function to execute when a matching task is done. Once the function runs, it automatically stops listening for further events, simplifying your code and preventing unnecessary callbacks. It's useful for things like cleaning up resources or performing actions immediately after a specific background process completes.

## Function listenDoneWalker

This function lets you be notified when a background task within the backtest-kit framework finishes running. It’s useful for knowing when asynchronous processes, triggered by `Walker.background()`, are complete. The notifications happen in the order they finish, and even if your notification code involves other asynchronous operations, they're handled one at a time to prevent issues. You provide a function that will be called when the background task is done, and this function returns another function that you can use to unsubscribe from these notifications later.

## Function listenDoneLiveOnce

This function lets you react to when a background task, started with `Live.background()`, finishes. You provide a filter – a test that determines which completions you care about – and a function to run when a matching completion happens. Critically, it's designed for one-time use; it subscribes to these completion events, runs your provided function just once when it sees a match, and then automatically stops listening. This makes it ideal for situations where you need to perform a single action upon a specific background task's completion and don't want to continue listening afterward. 

The `filterFn` allows you to specify criteria for the events you're interested in, ensuring that your callback only runs when a relevant background task is finished. The `fn` is simply the function that will be executed once the filter matches.


## Function listenDoneLive

This function lets you tap into when background tasks within your backtest are finished. It’s a way to be notified when a process you're running in the background has completed, ensuring things happen in the order they were initiated. Importantly, any code you put inside your callback function will be executed one at a time, even if it involves asynchronous operations, guaranteeing a predictable sequence of actions. You provide a function (`fn`) that will be called with details about the completed task whenever it finishes. The function you provide returns another function which you can use to unsubscribe from these notifications.

## Function listenDoneBacktestOnce

This function lets you react to when a backtest finishes running in the background, but in a special way – it only triggers your code *once* and then stops listening.  You can use a filter to specify exactly which backtest completions should trigger your reaction. It’s perfect for situations where you need to perform a one-time action when a particular backtest is done, like updating a display or saving results. Think of it as a quick, single-use notification system for backtest completion. The filter helps you focus on just the backtests you're interested in.

## Function listenDoneBacktest

This function lets you get notified when a background backtest finishes running. It’s like setting up a listener that will call your provided function once the backtest is done. 

Crucially, it handles completion events one at a time, even if your notification function involves some asynchronous work. This ensures events are processed in the order they arrive and prevents any unexpected issues caused by trying to process them simultaneously.

You provide a function (the `fn` parameter) which will be called when the backtest completes. The function receives a `DoneContract` object containing information about the completed backtest. The function you provide returns another function to unsubscribe.


## Function getMode

This function tells you whether the trading framework is currently running a backtest or operating in a live trading environment. It's a simple way to check the context of your code, allowing you to adjust your logic based on whether you're analyzing historical data or actively trading. The function returns a promise that resolves to either "backtest" or "live", indicating the current mode of operation.

## Function getDate

This function, `getDate`, provides a simple way to retrieve the current date within your trading strategy. It's useful for time-based calculations or conditional logic. When running a backtest, it gives you the date associated with the specific historical timeframe you're analyzing. If you’re running your strategy live, it returns the actual current date. Essentially, it allows you to incorporate the date into your trading decisions, regardless of whether you're looking at historical data or trading in real-time.

## Function getCandles

This function lets you retrieve historical price data, or "candles," for a specific trading pair like BTCUSDT. You tell it which pair you're interested in, the time interval for the candles (like 1 minute, 5 minutes, or 1 hour), and how many candles you want to see. It pulls this data from the exchange you’re connected to, going back from the present time. The data returned is an array of candle objects, each representing a specific time period's price action.

## Function getAveragePrice

This function helps you figure out the average price of a trading pair, like BTCUSDT. It does this by looking at the last five minutes of trading data and calculating a Volume Weighted Average Price, which gives more weight to prices where a lot of trading happened. If there's no trading volume available, it falls back to calculating a simple average of the closing prices instead. You just need to provide the symbol of the trading pair you're interested in, and it will return the average price as a number.

## Function formatQuantity

This function helps you display quantity values, like how many Bitcoin you're buying or selling, in the way the specific exchange you’re using expects it. It takes the trading pair symbol, such as "BTCUSDT," and the raw quantity as input.  It automatically adjusts the formatting to include the correct number of decimal places based on the exchange’s rules, so you don't have to worry about manual calculations. This ensures your orders and displays look accurate and compliant.


## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes a trading symbol like "BTCUSDT" and a raw price value as input. The function then uses the specific formatting rules associated with that trading pair to ensure the price is shown with the appropriate number of decimal places, as dictated by the exchange. It returns a formatted string representing the price, ready for display.

## Function addWalker

This function lets you add a "walker" to the backtest-kit system. Think of a walker as a specialized tool that runs multiple strategy backtests simultaneously, ensuring they all analyze the same historical data. It then compares the results of these strategies, providing insights into which ones perform best according to a defined metric.  To use it, you pass in a configuration object defining how the walker should operate. This allows for standardized comparisons across different strategies.

## Function addStrategy

This function lets you tell the backtest-kit framework about a new trading strategy you've created. Think of it as registering your strategy so it can be used for backtesting or live trading. When you register a strategy, the framework automatically checks to make sure your strategy’s signals are well-formed – for example, that the prices are valid, take profit and stop loss values make sense, and timestamps are appropriate. It also includes safeguards to prevent signal flooding and ensures that the strategy’s settings are safely saved even if there's a system crash when running in live mode. You pass in a configuration object, which contains all the details about your strategy.

## Function addSizing

This function lets you tell the backtest-kit how to determine the size of your trades. Think of it as setting the rules for how much capital you’re willing to risk on each trade. You provide a configuration object that specifies the sizing method you want to use, like a fixed percentage of your capital, a Kelly Criterion approach, or something based on Average True Range (ATR).  The configuration also lets you control the risk involved, setting limits on how much you’re willing to lose, and defining maximum position sizes.  Adding a sizing schema essentially tells the backtest-kit *how* to calculate your position sizes based on market conditions and your defined risk parameters.

## Function addFrame

This function lets you tell backtest-kit about a specific timeframe you want to use for your backtesting analysis. Think of it as defining a window of time with a particular frequency – like daily, hourly, or weekly – that the system will use to generate the data it analyzes. You provide a configuration object that specifies the start and end dates of your backtest, the interval (how often the data points are generated), and a way to handle events related to the timeframe. By registering these timeframes, you essentially tell the backtest-kit how to slice up your historical data for testing.



It's crucial to define your timeframes correctly to ensure your backtesting accurately reflects the conditions you're trying to simulate.

## Function addExchange

This function lets you connect your trading framework to a specific exchange, like Coinbase or Binance. It's how you tell the system where to get historical price data and how to interpret it. You provide a configuration object that outlines the exchange’s specifics – things like how to fetch historical candles, how to format price and quantity values, and how to calculate the VWAP (Volume Weighted Average Price). Essentially, you’re defining how the framework interacts with your chosen exchange.

# backtest-kit classes

## Class WalkerValidationService

The WalkerValidationService helps ensure your trading strategies, or "walkers," are set up correctly. Think of it as a quality control system.

You can add walker schemas, essentially blueprints for your strategies, using the `addWalker` method. This lets the service know what to expect. 

The `validate` method checks if a specific walker exists and is configured as expected.  If something's missing or incorrect, it's flagged.

Need a quick overview of all the walkers you've registered?  The `list` method provides a simple way to see them all.


## Class WalkerUtils

The WalkerUtils class offers helpful shortcuts for working with walkers, making it easier to run comparisons and analyze results. It essentially simplifies using the walkerGlobalService.

The `run` method allows you to execute a walker comparison for a specific symbol and provides access to the comparison’s progress.

If you just need to trigger a walker comparison and don't need to see the progress data (perhaps for logging or callbacks), the `background` method is ideal.

You can retrieve the complete results of a walker's strategy comparisons using `getData`.

The `getReport` method creates a readable markdown report summarizing the walker's performance across different strategies.

Finally, `dump` provides a simple way to save the generated report directly to a file. It acts as a convenient helper to avoid repetitive code.

## Class WalkerSchemaService

This service helps you keep track of your trading strategies, or "walkers," and their configurations in a structured and safe way. It acts as a central place to store and manage the blueprints for your trading logic.

Think of it like a library where you can register different trading strategy templates. The `addWalker()` method, or `register` property, lets you add a new template to the library. When you need to use a specific strategy, you can retrieve its blueprint by name using the `get` property.

Before adding a strategy, the service checks to make sure it has all the essential parts and is set up correctly using `validateShallow`.  If you want to update an existing strategy, you can use `override` to make changes without having to completely redefine it. Essentially, it helps you organize and maintain your trading strategies, ensuring they're well-defined and consistent.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you create and store reports about your trading strategies' performance. It listens for updates from your walkers – the components that run your strategies – and keeps track of the results.

It builds detailed comparison tables in markdown format, making it easy to visualize and analyze how different strategies are doing. These reports are saved as markdown files, organized by walker name, within a designated logs directory.

You can retrieve specific data points, generate full reports, or clear all accumulated results. The service initializes automatically when first used, ensuring everything is set up to receive and process those walker updates. There’s also a method to clear all data, or just data for a specific walker.

## Class WalkerLogicPublicService

The WalkerLogicPublicService acts as a central point for coordinating and executing your trading strategies, making sure all the necessary information flows correctly. It builds upon the WalkerLogicPrivateService, automatically handling context like the strategy name, exchange, frame, and walker details.

Think of it as a helpful assistant that simplifies running your backtests.

It has a few key components: a logger for tracking what's happening, the core logic service for actual backtesting, and a schema service to manage how your strategies are defined.

The main function, `run`, lets you execute a comparison for a specific trading symbol. When you call `run`, it automatically passes along all the necessary context information so your backtests can work correctly. This way you don’t have to manually manage these details in each strategy.


## Class WalkerLogicPrivateService

This service helps you compare different trading strategies against each other, essentially orchestrating a "walkthrough" of their performance. 

It works by running each strategy one after another and providing updates on their progress as they finish. As each strategy completes, you'll receive information about its performance. 

The service also keeps track of the best-performing strategy in real-time, and at the end, it returns a ranked list of all strategies compared, giving you a clear picture of how they stack up. 

Internally, it relies on another service to handle the backtesting process for each individual strategy.




The `run` method is how you kick off the comparison process, telling it which asset (`symbol`) to evaluate, which strategies to include, which metric to optimize for, and some context about the environment.

## Class WalkerGlobalService

The WalkerGlobalService acts as a central point to access the core walker functionality within the backtest-kit framework. Think of it as a helpful intermediary, making it easier to manage dependencies and integrate the walker components into your projects. 

It bundles together essential services, including a logger for tracking what's happening and the core logic for running the walkers themselves.

The `run` method is the main way to use this service.  It allows you to execute a comparison of walkers for a specific stock symbol, providing context like the walker's name, the exchange it’s on, and the timeframe you're analyzing. The result is a stream of data (an AsyncGenerator) representing the walker comparison.

## Class StrategyValidationService

The StrategyValidationService helps ensure your trading strategies are set up correctly before you start backtesting. Think of it as a quality control checkpoint for your strategy definitions.

You can add strategy schemas to the service using `addStrategy`, essentially registering the blueprint for a particular trading approach. The `validate` function then checks if a strategy exists and is properly defined. 

If you need to see what strategies you've registered, the `list` function provides a handy way to retrieve a list of all available schemas. It’s designed to make managing and verifying your strategies a bit easier.

## Class StrategySchemaService

This service acts as a central place to store and manage the blueprints, or schemas, for your trading strategies. It keeps track of what properties each strategy needs to have, ensuring consistency and helping prevent errors. 

You can add new strategy schemas using `addStrategy()`, which actually uses an internal registry to keep everything organized and type-safe. To use a strategy, you can retrieve its schema by name using `get()`.

Before a new strategy is added, `validateShallow()` checks if it has all the essential parts and that they are the correct types. If you need to update an existing strategy's schema, `override()` lets you make changes without replacing the entire schema. The service also has a logger to help you track what's happening.

## Class StrategyGlobalService

StrategyGlobalService provides a way to interact with trading strategies, seamlessly integrating them with the testing environment. It acts as a central point for managing strategies, ensuring they have the necessary information like the trading symbol and timestamp.

You can use it to quickly test a strategy's performance against historical candle data using the `backtest` method.  The `tick` method allows you to check the strategy's signal at a specific point in time.

For managing strategies more directly, you can use `stop` to prevent a strategy from generating new signals and `clear` to force a strategy to be reloaded. It handles communication with the underlying strategy connection service and provides logging capabilities.

## Class StrategyConnectionService

This service acts as a central hub for interacting with different trading strategies. It intelligently routes your requests to the correct strategy implementation based on the context of your operation.  Think of it as a smart dispatcher.

It keeps track of the strategies it’s using, storing them in a way that’s quick to access – a sort of memory for strategies. This helps keep things efficient.

Before you can actually trade or run backtests, you need to make sure the service is properly initialized.  The `tick()` method handles live trading, evaluating market conditions and returning a signal. The `backtest()` method allows you to test your strategy against historical data.

You can also stop a specific strategy from generating signals using the `stop()` method, and the `clear()` method allows you to refresh or release a strategy’s resources when needed.

## Class SizingValidationService

The SizingValidationService helps you make sure your trading strategies are using the right sizing methods. Think of it as a central place to define and check how much capital your strategy will use for each trade.

You can add different sizing methods, like fixed percentage, Kelly Criterion, or ATR-based sizing, and associate them with specific names.  The `validate` function lets you check if a sizing method exists and optionally confirms the method being used.

If you need to see all the sizing methods you've registered, the `list` function provides a simple way to retrieve them.  Essentially, this service makes sure your sizing logic is well-defined and ready to go before your backtesting begins.

## Class SizingSchemaService

This service helps you keep track of different sizing strategies for your trading backtests. It acts like a central repository where you can store and manage these strategies, ensuring they are properly structured. 

You can register new sizing strategies using the `register` method, which adds them to the system. If you need to update an existing strategy, the `override` method lets you make partial changes without replacing the whole thing.  Need to use a sizing strategy in your backtest? Just use the `get` method to retrieve it by name. The service also includes some internal checks to make sure the strategies you're adding are well-formed.

## Class SizingGlobalService

This service handles the crucial task of determining how much to trade – the position size – based on your defined risk management rules. It works behind the scenes within backtest-kit, and it relies on a connection service to perform the actual calculations. The service keeps track of a logger for recording events and holds the sizing connection service to do the heavy lifting in position size computations. The `calculate` method is the primary way to interact with it; you're providing parameters like risk amounts and a context, and it returns the calculated position size you should use.

## Class SizingConnectionService

The SizingConnectionService acts as a central hub for all your position sizing calculations within the backtest kit. It intelligently directs sizing requests to the correct sizing method based on a name you provide. 

Think of it as a smart router - you tell it which sizing strategy you want to use (like fixed percentage or Kelly Criterion), and it handles getting the right implementation ready for you. To improve performance, it remembers these sizing implementations, so it doesn't have to recreate them every time you need them.

You’re interacting with it primarily through the `calculate` method, which takes parameters related to your risk and the sizing name, ultimately determining the appropriate position size. If a strategy doesn’t have any sizing configured, the sizing name will be an empty string. It's designed to seamlessly handle different sizing approaches and make your backtesting process more efficient.

## Class PositionSizeUtils

This utility class provides helpful tools for determining how much of your account to allocate to each trade. It offers several pre-built methods, each calculating position size based on different strategies. 

You'll find methods like fixed percentage, which sizes positions based on a set percentage of your account balance, and Kelly Criterion, a more advanced approach that considers win rates and win/loss ratios. There's also an ATR-based method, which uses the Average True Range to size positions. 

Each sizing method is validated to ensure it's being used correctly, helping to prevent errors in your trading strategies. You simply provide the necessary inputs—like account balance, entry price, and stop-loss price—and the class handles the calculations.

## Class PersistSignalUtils

The `PersistSignalUtils` class helps manage how trading signals are saved and restored, especially for strategies running in live mode. It’s designed to reliably store signal data, even if there are unexpected interruptions like crashes. 

The class uses a clever system where each strategy has its own dedicated storage, and you can even plug in your own custom storage solutions if needed. When a strategy starts up, it uses `readSignalData` to load any previously saved signal information. Conversely, when a strategy makes a new trade suggestion, `writeSignalData` saves that information to disk using a special technique that ensures the data isn't corrupted even if the system crashes.

You can customize how signal data is stored by using `usePersistSignalAdapter` to register a new storage adapter. The `PersistSignalFactory` and `getSignalStorage` properties are internal components that are usually handled automatically.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing. It gathers performance data as your strategies run, keeping track of key metrics for each one individually. You can then ask it to calculate overall statistics like average performance, the lowest and highest results, and percentiles to get a good overview.

The service can create easy-to-read reports in markdown format, which includes an analysis of where potential bottlenecks might be occurring. These reports are automatically saved to your logs directory.

To use it, you'll need to make sure it's initialized, and then your strategy's performance tracking code needs to send performance events to it. When you're done, you can clear the accumulated data, or even completely clear everything to start fresh. Each strategy has its own separate storage space to keep data organized.

## Class Performance

The Performance class helps you understand how your trading strategies are performing. It provides tools to gather and analyze performance data, identify bottlenecks, and create readable reports. 

You can use it to get a consolidated view of your strategy’s metrics, seeing things like the total time spent in different operations and how much the performance varies. The `getReport` method creates a markdown document summarizing the analysis, making it easy to share and understand your results. 

You can save these reports directly to your disk with the `dump` function. If you need to start fresh, the `clear` method will wipe the performance data from memory, preparing you for a new backtest.

## Class LoggerService

The LoggerService is designed to make logging in your backtesting strategies straightforward and informative. It handles adding important details to your log messages automatically, so you don't have to. 

It lets you provide your own logging mechanism if you prefer, but if you don't specify one, it will default to a basic "no-op" logger that doesn't actually log anything. 

Key features include injecting context like the strategy name, exchange, and frame, along with execution details such as the trading symbol and the time of execution. You can customize the service with your own logger, and it offers methods for different logging levels like debug, info, warn, and general logs, all with automatic context appended. The service includes internal services for managing method and execution context, giving you a consistent logging experience across your backtest kit.

## Class LiveUtils

This class provides helpful tools for running and monitoring live trading sessions. Think of it as a central place to manage your live trading processes, making them easier to start, track, and recover from unexpected issues.

The `run` method is the main workhorse; it starts an infinite, asynchronous process that continuously generates trading results for a specified symbol and provides crash recovery – if the process crashes, it will automatically resume from where it left off. 

You can also run trading in the background using `background`, which is great when you only need to trigger actions based on live trading events without needing to see the results directly; it's like a silent helper running in the background.

To keep an eye on things, `getData` lets you retrieve statistical information about how a strategy has been performing, while `getReport` creates a detailed markdown report summarizing all the events. Lastly, `dump` allows you to save this report to a file for later review.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create and save reports about your trading strategies. It quietly listens to every signal – whether it’s a pause, a trade opening, an active trade, or a trade closing – and keeps track of all the details for each strategy. 

It then organizes this information into easy-to-read markdown tables that include important statistics like win rate and average profit/loss. These reports are saved as `.md` files in the `logs/live/` directory, making it simple to review your strategies' performance.

The service handles the technical parts, so you don't have to manually collect data or format reports. You can clear out the stored data for specific strategies or clear everything at once, and the initialization happens automatically the first time you use it.

## Class LiveLogicPublicService

This service helps you run live trading strategies while automatically managing important details like the strategy name and the exchange you're using. It essentially simplifies the process by handling these details for you, so your code doesn’t have to.

Think of it as an ongoing process that continuously generates trading signals – it runs indefinitely, constantly producing data.  If something goes wrong and the process crashes, it's designed to recover and pick up where it left off, thanks to saved state.

You can start the trading process for a specific symbol, and it will stream open and closed signals as an ongoing flow, making it easy to react to market changes. The service automatically takes care of passing along the necessary information to all the underlying components, removing the need to manually specify it each time.

## Class LiveLogicPrivateService

This service handles the complex process of live trading, acting as a central coordinator. It continuously monitors the market, checking for new trading signals. 

Think of it as a tireless worker that runs an endless loop, regularly checking the status of your trading strategy.  It delivers updates only when a trade is opened or closed – no unnecessary information!  

Because it uses an asynchronous generator, it efficiently streams results, and the whole process is designed to recover gracefully if something goes wrong, ensuring your trading can resume even after unexpected interruptions. The service keeps running, pulling data and making decisions, without ever stopping.

## Class LiveGlobalService

The `LiveGlobalService` helps manage live trading operations within the backtest-kit framework. Think of it as a central hub that simplifies how different parts of your application interact with the live trading functionality.

It provides access to essential services like logging, live logic, strategy validation, and exchange validation, all neatly packaged for easy use. 

The core feature is the `run` method. It initiates a live trading process for a specific trading symbol, passing along important details about the strategy and exchange being used. This `run` method is designed to run continuously, automatically handling any unexpected issues to keep the trading process going. It provides results as a stream of tick results, indicating when a strategy has opened or closed a position.

## Class HeatUtils

This class, HeatUtils, helps you visualize and understand how your trading strategies are performing. It gathers data about your portfolio's performance, like total profit/loss, Sharpe Ratio, and maximum drawdown, for each symbol used in a strategy.

You can easily request this data using the `getData` method, which gives you a structured object with performance details for each symbol and overall portfolio statistics.  The `getReport` method takes this data and turns it into a nicely formatted markdown table, showing how each symbol contributed to the strategy's results, sorted by profit. Finally, `dump` allows you to save that markdown report directly to a file on your computer, making it simple to share or keep a record of your strategy's performance. It's designed to be easy to use, working like a single, always-available helper for your backtesting process.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and understand the performance of your trading strategies. It gathers data about closed trades across all your symbols and strategies, creating a comprehensive portfolio-wide overview.

Think of it as a real-time dashboard that tracks key metrics like total profit/loss, Sharpe Ratio, and maximum drawdown for each symbol and strategy. It automatically builds these metrics as trades close, so you're always seeing the latest picture.

The service can generate a markdown report summarizing this data into a visually appealing table, which you can then save to a file for later review or sharing. It’s also designed to handle potential math errors (like dealing with missing or infinite values) gracefully.

Each strategy gets its own dedicated storage space, keeping data organized and isolated. To get started, the service automatically sets itself up when you first use it. You can also manually clear the data for specific strategies or for everything if you need to.

## Class FrameValidationService

The `FrameValidationService` helps ensure your trading strategies are working with the expected data structures, which are called frames. Think of it as a quality control system for your data.

You start by telling the service what frames you expect, along with their definitions. The `addFrame` function lets you register these expected structures.

Then, when your strategy is running and generating data, you can use the `validate` function to check if the incoming data matches the registered frame definitions. This helps catch errors early. 

Need to know what frames you've already registered?  The `list` function provides a straightforward way to get a list of all the defined frame schemas. The `loggerService` is used internally to log messages during validation, and `_frameMap` is an internal data structure.

## Class FrameSchemaService

The FrameSchemaService helps you keep track of the structure and rules for your trading data frames. Think of it as a central place to define what a frame *should* look like.

It uses a special type-safe storage system, relying on ToolRegistry to ensure everything is consistent. You add new frame definitions using `register`, and update existing ones with `override`.  If you need to know what a specific frame looks like, you can use `get` to retrieve it by name. The service also includes a built-in check (`validateShallow`) to make sure your new frame definitions are correctly structured before they're saved.

## Class FrameGlobalService

The `FrameGlobalService` is a helper that manages how timeframes are created for your backtesting. It works closely with the `FrameConnectionService` to fetch the data needed to build these timeframes. Think of it as the engine that prepares the timeline of price data your backtesting strategy will analyze. 

It’s designed to be used internally, so you generally won't need to interact with it directly. The `getTimeframe` method is the main function, and it produces an array of dates for a specific trading symbol, forming the foundation of your backtest's chronological data. You'll likely use this data to drive your trading logic and evaluate performance.


## Class FrameConnectionService

The FrameConnectionService acts as a central hub for interacting with different backtest frames. It automatically directs requests to the correct frame implementation based on the context of the operation. 

To improve performance, it intelligently caches these frame instances, so you don't have to recreate them repeatedly. This service also handles the management of backtest timeframes, allowing you to restrict testing to specific start and end dates. 

It provides a simple way to retrieve a frame using `getFrame`, and a way to define the testing timeframe using `getTimeframe`. When running in live mode, no frame is actively used.

## Class ExchangeValidationService

The ExchangeValidationService helps ensure your trading strategies are compatible with different exchanges. Think of it as a central place to register and verify the structure of data coming from various exchanges.

You start by adding the schema for each exchange you want to support, essentially defining what data it sends. The `validate` method checks if an exchange's data conforms to the registered schema, helping you catch errors early.  If you need to see what exchanges are currently registered, the `list` method provides a convenient way to get a list of their schemas.  The `addExchange` method is how you tell the service about a new exchange and its data format.

## Class ExchangeSchemaService

This service helps you keep track of information about different cryptocurrency exchanges, ensuring everything is consistent and organized. It acts like a central hub for storing and managing exchange schemas, using a secure and type-safe way to do so.

You can add new exchanges using `addExchange()` and find existing ones by their name with `get()`.  If you need to update an existing exchange's details, `override()` lets you make changes without replacing the whole thing. Before adding an exchange, `validateShallow()` checks if it has all the necessary information in the right format, preventing errors down the line. The service relies on a logger for tracking what's happening and using a registry to store all exchange schema.

## Class ExchangeGlobalService

This service helps you interact with an exchange, providing a way to fetch data and format values while ensuring the trading environment – like the symbol, trading time, and whether it's a backtest – is correctly considered. 

It’s built on top of other services that handle the exchange connection and manage the overall execution context.

You can use it to get historical candle data, retrieve future candles specifically for backtesting scenarios, and calculate the average price. 

It also offers convenient methods to format prices and quantities, ensuring they’re presented appropriately within the context of the trade. Essentially, it handles the complexities of interacting with the exchange while keeping track of the important details of your trading setup.

## Class ExchangeConnectionService

This service acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently directs your requests to the correct exchange implementation based on the current context. To avoid repeatedly creating connections, it cleverly caches exchange connections, making things faster and more efficient.

Here’s a breakdown of what you can do with it:

*   **Get historical data (candles):** Retrieve past price movements for a specific cryptocurrency pair and timeframe.
*   **Fetch the next batch of candles:**  Get the next set of candles after the current point in time, useful for progressing a backtest or keeping a live system updated.
*   **Find the average price:** Obtain the current average price, either from a live exchange or calculated from historical data in backtest mode.
*   **Format prices and quantities:**  Make sure your prices and trade quantities are in the exact format required by the exchange you're using. This helps prevent errors and ensures your orders are processed correctly. 

It relies on other services to determine which exchange to use and handle caching, making it easy to integrate with your trading logic.

## Class ClientSizing

This component, ClientSizing, helps determine how much of your capital to allocate to a trade. It's designed to be flexible, allowing you to choose from several sizing techniques like fixed percentages, the Kelly Criterion, or using Average True Range (ATR). 

You can also set limits on the minimum or maximum position size, and restrict the overall percentage of your capital used for any single trade. This class also supports callbacks, which are useful for validating the calculated size or logging information about the sizing process. Essentially, it takes input parameters and calculates an appropriate position size for your trading strategy to use.

## Class ClientFrame

The ClientFrame helps create the timelines your backtesting needs, essentially building the sequence of timestamps for your trading strategies to run against. It’s designed to be efficient, avoiding the repeated creation of these timelines by caching the results. You can control how frequently the timestamps are generated, setting the interval from one minute to three days. 

The ClientFrame is used internally by the backtesting engine to move through historical data.

To get started, you provide initial settings when creating a ClientFrame. The core function, `getTimeframe`, is what actually generates the timeline for a specific trading symbol; it fetches the timestamps and saves them for future use, so you don’t have to recompute them every time.

## Class ClientExchange

This `ClientExchange` component acts as a bridge to retrieve data from an exchange, specifically designed for backtesting scenarios. It allows you to pull historical candle data, looking backward from a specific time, and crucially, it can fetch future candles needed to simulate trading.  You can use it to get the data necessary to evaluate trading strategies.

It calculates the VWAP (Volume Weighted Average Price) based on recent trading activity, providing a useful indicator for understanding price trends.  The component efficiently handles formatting of both quantities and prices to match the exchange's precision requirements, ensuring trades can be accurately represented. This whole class is built to be memory-efficient, using prototype functions to minimize overhead.

## Class BacktestUtils

BacktestUtils helps you run and analyze backtest simulations within the trading framework. It offers a simple way to execute backtests, providing logging and context management. 

You can easily start a backtest for a specific symbol and strategy, either getting real-time results or running it in the background for tasks like logging or callbacks without needing to process the data yourself. 

Need statistics? BacktestUtils can gather data from completed signals for a particular strategy. It even generates a readable markdown report summarizing those signals. Finally, you can save those reports directly to a file for record-keeping.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create and save detailed reports about your backtesting results. It keeps track of closed trading signals for each strategy you're testing.

It works by listening to data from your strategies and accumulating information about each closed trade. The service then organizes this information into easy-to-read markdown tables that show important details about your signals. These reports are saved as `.md` files in a `logs/backtest` folder, making it easy to review your strategy's performance.

You can clear the accumulated data for specific strategies or for all strategies at once. The service also includes an initialization process that automatically happens when you first use it, ensuring everything is set up correctly. This helps you understand how your strategies are performing over time, and helps identify areas for improvement.

## Class BacktestLogicPublicService

BacktestLogicPublicService helps you run backtests more easily by handling the background details of managing context information. Think of it as a helpful layer on top of the core backtesting engine. It automatically passes along important details like the strategy name, exchange, and timeframe to the backtesting functions, so you don't have to repeatedly specify them. 

This service lets you start a backtest using the `run` method, which takes a symbol as input and returns a stream of results. This stream provides information about each trading decision made during the backtest. The beauty of this service is it cleans up your code by reducing the amount of explicit context parameters needed.


## Class BacktestLogicPrivateService

This service manages the entire backtesting process, working behind the scenes to orchestrate everything. It starts by getting the necessary timeframes and then systematically processes them, one by one.

When a trading signal tells the backtest to open a position, it fetches the required historical data and runs the backtesting logic. The system is designed to efficiently handle large datasets by streaming results as they become available, rather than building up a large array in memory. 

You can even stop the backtest early if needed, providing flexibility during testing. This service relies on other global services for things like logging, strategy information, exchange data, and managing timeframes. The primary function is `run`, which starts the backtest for a specified trading symbol and delivers results as a stream of closed trading signals.

## Class BacktestGlobalService

The BacktestGlobalService is a central hub within the backtesting framework, designed to make it easy to manage and access core backtesting functions. Think of it as a convenient way to inject dependencies and interact with the system's logic. 

It provides access to logging tools, and the underlying services responsible for handling strategy, exchange, and data frame validation. 

The most important function is `run`, which orchestrates the backtest process. You provide the trading symbol and details about the strategy, exchange, and data frame you want to use, and it will return a stream of results showing how the strategy performed. Essentially, it’s your gateway to simulating trading and analyzing strategy performance.

# backtest-kit interfaces

## Interface WalkerContract

The WalkerContract helps you keep track of how a trading strategy comparison is progressing. It provides information each time a strategy finishes its test and its ranking is updated. 

You’ll see details like the walker's name, the exchange and frame being used, the symbol being backtested, and the name of the strategy that just completed. The contract also gives you the backtest statistics, the value of the metric being optimized, and importantly, the current best metric value seen so far, alongside the name of the best performing strategy. Finally, you can track the overall progress – how many strategies have been tested and how many are left to go.

## Interface TickEvent

The `TickEvent` interface holds all the information you need to understand what happened during a trade, regardless of whether it's a simple idle state or a complex closed position. Think of it as a single, unified record of each event in your backtest.

It includes the exact time the event occurred, the type of action that took place (like opening, closing, or just being idle), and for trades, the symbol being traded.  You’ll also find details specific to active trades, such as the signal ID, position type, a note about the signal, the price at which the trade was opened, take profit and stop loss levels, and the trade's P&L.  When a trade closes, this interface also captures the reason for closure and the trade's duration. It makes generating reports and analyzing backtest results much simpler by providing all the data in one convenient place.

## Interface ProgressContract

This interface, `ProgressContract`, helps you keep an eye on how your backtest is running. It's used when you’re letting a backtest run in the background. 

You’ll get updates containing the exchange and strategy names, the trading symbol being tested, and vital numbers like the total number of historical data points (frames) the backtest will process, how many it’s already finished, and the overall progress as a percentage. This allows you to monitor the backtest’s status without blocking the main thread of your application.

## Interface PerformanceStatistics

This object holds a collection of performance data gathered during strategy backtesting. It gives you a broad view of how your strategy performed. 

The `strategyName` clearly identifies which strategy these statistics relate to. `totalEvents` tells you the overall number of performance events tracked. `totalDuration` represents the cumulative time spent calculating metrics. 

The `metricStats` property contains a breakdown of statistics for different metric types, allowing you to analyze specific areas of performance. Finally, `events` provides a detailed list of all the individual performance events recorded, giving you the raw data for deeper investigation.

## Interface PerformanceContract

The PerformanceContract helps you monitor how your trading strategies are performing. It captures key data points, like when an action happened (timestamp) and how long it took to complete (duration). This information is categorized by what type of operation it was (metricType), which strategy was used (strategyName), and which exchange and symbol were involved. You can also easily tell if the performance data came from a backtest or live trading environment. By collecting these performance details, you can analyze and optimize your trading system to improve its efficiency.

## Interface MetricStats

This interface, `MetricStats`, helps you understand how a particular performance measurement is behaving over time. It bundles together a bunch of useful statistics related to a specific metric, like execution time or wait time. You'll find information like the total number of times the metric was recorded, the total time it took across all recordings, and key summary values such as the average, minimum, maximum, and median durations.  It also provides insights into the variability of the metric with standard deviation and percentiles (95th and 99th). Finally, it gives you details about the time intervals between events, showing average, minimum, and maximum wait times.

## Interface LiveStatistics

This interface provides a collection of statistical data reflecting your live trading performance. It breaks down your trading activity, tracking everything from the total number of events to individual win and loss counts. You'll find key metrics like win rate, average profit/loss per trade, total profit, and volatility measures like standard deviation.  The system also calculates risk-adjusted performance ratios like the Sharpe Ratio and Annualized Sharpe Ratio. You can also see how well your winning trades outperform your losing ones with the certainty ratio, and get an estimate of potential yearly returns. If a calculation is unreliable, the value will be null, preventing misleading results.

## Interface IWalkerStrategyResult

This interface, `IWalkerStrategyResult`, represents the outcome of running a single trading strategy within a comparison process. It bundles together key information about that strategy's performance. You'll find the strategy's name, alongside a detailed set of statistics calculated from its backtest. 

A crucial value is the `metric`, which is the number used to assess how well the strategy performed relative to others—it might be null if the strategy's performance couldn't be meaningfully evaluated. Finally, the `rank` property indicates the strategy’s position when compared to all the other strategies in the test, with a lower number signifying a better rank.

## Interface IWalkerSchema

The IWalkerSchema lets you define how to run A/B tests comparing different trading strategies. Think of it as a blueprint for your experiment, telling the backtest-kit exactly what strategies to pit against each other.

You specify a unique name for each walker (your test setup), and can add a note for yourself to explain what the test is about. The schema also defines the exchange and timeframe to use consistently across all strategies in the test.

Crucially, you'll list the names of the strategies you want to compare—these strategies need to be registered beforehand.  You can choose a metric to optimize, such as Sharpe Ratio, and you have the flexibility to add callback functions for specific events during the backtesting process if you need more control.

## Interface IWalkerResults

The `IWalkerResults` interface holds all the information gathered after a complete comparison of different trading strategies. It tells you which strategy walker ran the test, what asset (symbol) was traded, and which exchange and timeframe were used. 

You'll find details like the optimization metric used, the total number of strategies tested, and most importantly, the name of the best-performing strategy.  

The results also include the best metric value achieved during the walk, and a complete set of statistics detailing the performance of that winning strategy. It’s a single place to view a summary of the entire backtesting process.

## Interface IWalkerCallbacks

This interface provides a way to hook into the backtest process, letting you track what's happening behind the scenes. You can use it to monitor the start and completion of each strategy's testing, and also receive a summary of all results when the entire process finishes. The `onStrategyStart` callback lets you know when a specific strategy begins testing, while `onStrategyComplete` is triggered when a strategy’s backtest is done, giving you statistics and a key metric. Finally, `onComplete` provides the overall results from the entire testing run.

## Interface IStrategyTickResultOpened

This interface describes the data you receive when a new trading signal is created within your backtesting strategy. It's a notification that a signal has been validated, saved, and is now active.

You'll find key information included, such as the newly generated signal details (represented by `ISignalRow`), the name of the strategy that created it, and the exchange and symbol associated with the trade. The `currentPrice` tells you the VWAP price that was in effect when the signal was opened, which is helpful for understanding the trade’s initial conditions. Essentially, it’s your confirmation that a trade has started and a record of its initial setup.

## Interface IStrategyTickResultIdle

This interface represents what happens in your backtest when your trading strategy isn't actively making any trades – it's in an idle state. It tells you the name of the strategy, the exchange it's running on, and the symbol being traded. You'll see this result when the strategy isn’t generating a buy or sell signal. It also includes the current price at the moment of the idle state and allows you to keep track of these periods within your backtesting analysis. It’s essentially a snapshot of the conditions when your strategy is waiting for a potential trading opportunity.

## Interface IStrategyTickResultClosed

This interface represents the result you get when a trading signal is closed, providing a complete picture of what happened and the outcome. It includes all the details like the original signal parameters, the final price used for the trade, and the reason why the signal was closed – whether it was due to a time limit expiring, hitting a take-profit target, or triggering a stop-loss. You'll also find the exact timestamp of the close, the profit and loss calculation (including fees and slippage), and identifying information like the strategy and exchange names. Essentially, it's a full report on a closed trade, allowing you to analyze its performance.

## Interface IStrategyTickResultActive

This interface represents a trading scenario where a strategy is actively monitoring a signal, essentially waiting for a specific event like a Take Profit (TP), Stop Loss (SL), or time expiration. It holds all the key information about that active monitoring process. 

You’ll find details like the name of the strategy being used, the exchange it’s running on, and the trading symbol involved – all crucial for tracking and debugging.  The `signal` property provides access to the specifics of the signal being watched. The `currentPrice` represents the VWAP price currently used for evaluating the signal's progress. It’s a clear indication that the strategy is in a 'waiting' state, actively tracking the signal.

## Interface IStrategySchema

This interface, `IStrategySchema`, is how you tell backtest-kit about your trading strategies. Think of it as a blueprint – it describes what your strategy does and how it works. 

Each strategy needs a unique `strategyName` so backtest-kit knows which one is which. You can also add a `note` to explain your strategy to other developers.

The `interval` property controls how often your strategy can generate signals, preventing it from overwhelming the system.  The core of the strategy is the `getSignal` function; this is where the logic for generating buy, sell, or hold signals resides. Finally, `callbacks` allow your strategy to react to events like the start and end of a backtest.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, holds the results of a trading strategy’s profit and loss calculation. It provides key data points about a trade’s performance, including the percentage change in profit or loss. The `pnlPercentage` property tells you exactly how much the strategy gained or lost, expressed as a percentage. To get a clear picture of the trade's financial impact, the `priceOpen` and `priceClose` properties show the entry and exit prices, respectively. These prices have already been adjusted to account for trading fees (0.1%) and slippage (0.1%), so you’re seeing a more realistic view of the trade's profitability.

## Interface IStrategyCallbacks

This interface lets you hook into the key moments of a trading strategy's lifecycle. Think of it as a way to listen in on what’s happening – when a signal is first opened, when it's actively being monitored, when things quiet down and the strategy is idle, and finally, when a signal is closed. You can define functions to respond to these events, like logging activity, displaying notifications, or triggering other actions based on the signal's status. The `onTick` callback provides data from every market tick, allowing for granular monitoring, while the other callbacks offer focused responses to specific signal states.

## Interface IStrategy

The `IStrategy` interface outlines the fundamental actions a trading strategy needs to perform within the backtest-kit framework.

At its core, a strategy implements a `tick` method, which simulates a single market update and allows the strategy to react – checking for new trading signals and evaluating potential take-profit or stop-loss triggers.

For quick testing on historical data, the `backtest` method lets you step through a sequence of candles, essentially running a condensed version of the strategy's logic.

Finally, the `stop` method provides a way to pause a strategy's signal generation, ideal for cleanly shutting down a live strategy without abruptly closing any existing orders that are still working toward their targets.

## Interface ISizingSchemaKelly

The `ISizingSchemaKelly` interface defines how to size your trades using the Kelly Criterion, a method aiming to maximize long-term growth. 

It requires you to specify the sizing method as "kelly-criterion."  You'll also set a `kellyMultiplier`, which controls how aggressively your position sizes are determined – a lower number like 0.25 represents a more conservative, "quarter Kelly" approach, while higher numbers increase risk. This multiplier essentially dictates the fraction of your available capital you're willing to bet on each trade based on the calculated edge.

## Interface ISizingSchemaFixedPercentage

This schema helps you define a trading strategy where the size of each trade is determined by a fixed percentage of your available capital. It's straightforward – you specify a `riskPercentage`, which represents the maximum percentage of your capital you’re willing to risk on a single trade. This value should be between 0 and 100, and the framework uses it to calculate the trade size automatically. It's a simple way to implement a consistent risk management approach.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, provides a foundation for defining how much of your trading account to allocate to each trade. Think of it as a blueprint for sizing strategies. 

It includes essential properties like `sizingName`, which gives your sizing configuration a unique identifier, and a `note` field for your own documentation. You'll find controls for position sizing too, like `maxPositionPercentage` to limit your risk as a percentage of your account, and `minPositionSize` and `maxPositionSize` to set absolute limits. 

Finally, there’s a section for `callbacks`, allowing you to hook into specific points in the sizing process. 


## Interface ISizingSchemaATR

This schema defines how to size your trades using the Average True Range (ATR) as a key factor. It tells the backtest-kit framework that you're using an "atr-based" sizing approach. 

You specify a `riskPercentage` which represents the percentage of your account you're willing to risk on each individual trade; a common range is between 0 and 100. 

The `atrMultiplier` determines how much the ATR value influences the size of your position. A higher multiplier will lead to larger positions when the ATR is high, reflecting increased volatility.

## Interface ISizingParamsKelly

This interface, `ISizingParamsKelly`, helps you define how much of your capital your trading strategy will risk on each trade, specifically using the Kelly Criterion. It's used when setting up the sizing behavior within the backtest-kit framework. 

You'll use it to provide a logger, which is useful for seeing debug messages and understanding how the sizing calculations are being performed. The logger helps you keep track of what's happening under the hood and troubleshoot any sizing-related issues.

## Interface ISizingParamsFixedPercentage

This interface, `ISizingParamsFixedPercentage`, defines how much of your capital you're going to use for each trade when using a fixed percentage sizing strategy. Think of it as setting a rule: "I'm going to risk 2% of my account on every single trade."

It has one required property:

*   **logger**: This is simply a way to output debugging information. It’s helpful for tracking what’s happening behind the scenes as your backtest runs, so you can fine-tune your strategy.

## Interface ISizingParamsATR

This interface, `ISizingParamsATR`, helps you define how much to trade based on the Average True Range (ATR) indicator. It's used when setting up your trading strategy’s sizing logic. 

You're required to provide a `logger` object to help with debugging and understanding what your sizing parameters are doing. This logger allows you to see the values being used during the backtesting process.


## Interface ISizingCallbacks

The `ISizingCallbacks` interface helps you tap into what's happening during the sizing process in your trading strategy. Specifically, it lets you receive notifications after the framework has calculated the position size. Think of it as a way to observe or double-check the sizing logic – maybe you want to log the quantity and parameters used, or confirm the calculated size makes sense given your strategy's rules. You provide a function, `onCalculate`, which gets called with the determined quantity and the parameters that influenced that calculation.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate trade sizing using the Kelly Criterion. To use it, you'll need to specify the method as "kelly-criterion," along with your win rate—a number between 0 and 1 representing the proportion of winning trades—and your average win/loss ratio, which tells you how much you typically win compared to how much you lose on a winning trade. These values are crucial for determining an optimal bet size based on your trading performance.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the parameters needed when you want to calculate your trade size using a fixed percentage of your account balance. You're telling the backtest kit, "I want to risk a specific percentage of my capital on this trade."

It requires two key pieces of information: you must specify that you're using the "fixed-percentage" method, and you need to provide the `priceStopLoss` which determines the price at which your stop-loss will be triggered. This stop-loss price is crucial for calculating the appropriate trade size based on the fixed percentage risk.

## Interface ISizingCalculateParamsBase

This interface, `ISizingCalculateParamsBase`, provides the fundamental information needed to determine how much of an asset to trade. Think of it as the baseline data for sizing calculations. It includes the symbol of the trading pair, like "BTCUSDT", along with your current account balance and the price at which you intend to enter the trade. These core pieces of information are used in various sizing strategies to calculate the appropriate trade size.

## Interface ISizingCalculateParamsATR

When you're figuring out how much to trade, this interface helps you use the Average True Range (ATR) to guide your sizing decisions. It provides a structured way to specify that you want to base your trade size on the ATR.  You'll define the `method` as "atr-based" to indicate this approach, and crucially, you'll provide the current `atr` value itself, which is the key data point used in the calculation. This `atr` value represents the average range of price movement over a specific period, and it's used to determine an appropriate position size.

## Interface ISizing

The `ISizing` interface helps your trading strategies determine how much of an asset to buy or sell. Think of it as the engine that figures out your position sizes.

It contains a `calculate` function – this is the core of sizing. When called, it takes a set of parameters related to your risk management and returns a number representing the calculated position size. This allows strategies to adjust their trades based on factors like risk tolerance and account balance.

## Interface ISignalRow

This interface, `ISignalRow`, represents a complete trading signal that’s ready to be used within the backtest-kit framework. Think of it as a finalized signal after it's been checked for accuracy. 

Each signal has a unique ID, automatically created when the signal is generated. It also includes the opening price for the trade, the specific exchange you’ll be using, and the name of the strategy that created the signal. You’ll find the timestamp indicating when the signal was initially created, and of course, the symbol of the asset being traded, like "BTCUSDT". This row provides all the information needed to execute a trade based on the signal.


## Interface ISignalDto

The `ISignalDto` represents the data used to define a trading signal. Think of it as a blueprint for telling the backtest system *what* trade you want to simulate. It includes details like whether you're going long (buying) or short (selling), the entry price, target take profit and stop-loss levels, and an estimated duration for the trade.  An automatically generated ID is added when the signal is processed, so you don't always need to provide one yourself. The `note` property lets you add a human-readable explanation for why you're making the trade, helping you understand your strategy later.  There are also rules for the take profit and stop loss prices—they need to be set logically based on your long or short position.

## Interface IPositionSizeKellyParams

This interface, `IPositionSizeKellyParams`, defines the necessary information for calculating position sizes using the Kelly Criterion. It helps you determine how much of your capital to allocate to a trade based on expected win rate and average win/loss ratio. 

You'll provide a `winRate` value, representing the probability of a winning trade – a number between 0 and 1.  You'll also need to specify a `winLossRatio`, which describes the average profit compared to the average loss on a winning trade. These two values work together to help automatically size your positions.


## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed for a trading strategy that uses a fixed percentage of your capital for each trade, but includes a stop-loss price. The `priceStopLoss` property specifies the price at which you want to place your stop-loss order to limit potential losses. Think of it as telling the system, "If the price drops to this level, I want to exit the trade." It’s essential for risk management within your backtesting setup.

## Interface IPositionSizeATRParams

This interface, `IPositionSizeATRParams`, defines the information needed to calculate a position size based on the Average True Range (ATR).  It's a straightforward way to specify the current ATR value, which is a key factor in determining how much to trade. The `atr` property simply holds that current ATR number. Think of it as providing a single piece of data that influences the trading size calculation.

## Interface IPersistBase

This interface outlines the basic operations for storing and retrieving data within the backtest-kit framework. It handles the essential actions of reading, writing, and checking for the existence of data. 

The `waitForInit` method makes sure the storage area is ready and any existing files are in good shape when things start up – it only runs once.  `readValue` gets a specific piece of data back from storage, while `hasValue` simply tells you if a piece of data exists without actually retrieving it. Finally, `writeValue` is how you save data to storage, guaranteeing that the write happens completely or not at all.

## Interface IMethodContext

The `IMethodContext` interface acts like a little travel guide for your backtesting operations. It carries essential information—the names of the strategy, exchange, and frame you’ve defined—so the backtest-kit knows exactly which components to use. Think of it as a way to keep everything organized and avoid confusion when running your trading simulations, especially when you're using different strategies or exchanges. The frame name is even left blank when you're testing in live mode, which makes sense because there’s no historical data to work with then. It’s automatically provided by the system, so you typically won't need to interact with it directly.

## Interface ILogger

The `ILogger` interface provides a way for different parts of the backtest-kit framework to record what’s happening. Think of it as a central place to capture important events, from the moment something starts up to when it finishes, and everything in between.

You can use the `log` method to record general events that are important to note. For more detailed information during development or when you're trying to figure out what’s going on, use `debug`. `info` is for recording successful operations and confirmations. Finally, `warn` allows you to flag potential issues or unexpected conditions that aren't critical enough to stop the system, but still warrant investigation.

## Interface IHeatmapStatistics

This interface describes the overall statistics displayed on a portfolio heatmap. It gives you a snapshot of how your entire portfolio is performing. 

You're provided with an array of individual symbol statistics, letting you drill down into specifics. 

Along with that, you get key metrics like the total number of symbols, overall profit and loss (PNL), the portfolio’s Sharpe Ratio (a measure of risk-adjusted return), and the total number of trades executed. This gives a clear, consolidated view of your portfolio's activity and performance.

## Interface IHeatmapRow

This interface describes the performance metrics for a single trading symbol when analyzing a portfolio’s backtest results. It bundles key statistics like total profit, risk-adjusted return (Sharpe Ratio), and maximum drawdown to give a quick overview of how a symbol performed across different trading strategies. You’ll find details about the number of trades, win/loss counts, and individual trade profitability, including average win and loss amounts. It also includes streak information and expectancy, which offer deeper insights into the trading behavior of that symbol. Essentially, it's a single snapshot of a symbol's trading history, bringing together a range of vital performance indicators.

## Interface IFrameSchema

The `IFrameSchema` describes a defined period and frequency for generating historical data within the backtest. Think of it as setting the rules for how your backtest will slice up the data – specifying a unique name, an optional note for yourself, the timeframe (like daily or hourly), the start and end dates of the period you’re testing, and even optional functions that get called at certain points in the process. Each `IFrameSchema` represents a distinct backtest configuration within your larger framework. They’re created and registered to provide a structured way to manage your backtesting scenarios.

## Interface IFrameParams

The `IFrameParams` interface defines the configuration you pass when setting up a core component within the backtest-kit framework. It's all about providing the necessary environment for a piece of your trading system to operate correctly.

Specifically, it includes a `logger` property – this is how you provide a way for that component to report what it’s doing, which is really helpful for debugging and understanding how your backtest is running. Think of it as giving your trading logic a voice to explain its actions.

## Interface IFrameCallbacks

This interface helps you respond to events happening within the backtest-kit framework’s timeframe generation process. Specifically, it lets you hook into what happens after the system creates a set of timeframes for your backtesting. You’re given the newly generated array of dates, the start and end dates of the timeframe, and the interval used (like daily, weekly, etc.). This allows you to perform actions like verifying the timeframes are what you expect or logging this information for debugging.

## Interface IFrame

The `IFrames` interface is a core component that helps manage the timing of your backtesting simulations. Think of it as the engine that provides the sequence of dates and times your trading strategy will be evaluated against. 

It has a crucial method, `getTimeframe`, which you can use to create a list of timestamps for a specific trading symbol. This list of timestamps will be evenly spaced apart, based on the interval you've set up for your backtest. This is how your strategy 'sees' the market data as it progresses through time during the backtest.

## Interface IExecutionContext

The `IExecutionContext` interface holds important information about the current trading environment. Think of it as a package of details passed around to let your strategies and exchanges know what's going on. It tells you which trading pair you’re working with, like “BTCUSDT,” and the precise date and time the operation is happening. Crucially, it also indicates whether you're running a backtest – a simulation of past market data – or operating in a live trading environment. This context is vital for making informed decisions and ensuring your code behaves correctly in different situations.

## Interface IExchangeSchema

This interface describes how backtest-kit connects to different trading venues. Think of it as a blueprint for each exchange you want to use. It defines how the framework gets historical price data (candles), and how it correctly formats trade quantities and prices to match the specific rules of that exchange. You provide the implementation details for fetching candles and formatting trade information, while `exchangeName` uniquely identifies your exchange setup.  You can also add optional notes for your own documentation and configure callbacks for specific events like receiving candle data.

## Interface IExchangeParams

The `IExchangeParams` interface defines the information you need to give when setting up an exchange within the backtest-kit framework. Think of it as the initial configuration for how your trading simulation will interact with data.

It requires a `logger` to help you keep track of what's happening during the backtest – useful for debugging and understanding your strategy's decisions.  You also need to provide an `execution` context, which tells the exchange things like which symbol you're trading, the time period you're simulating, and whether it's a backtest or a live trading scenario. This ensures that the exchange operates within the correct environment.

## Interface IExchangeCallbacks

The `IExchangeCallbacks` interface lets you hook into events happening when the backtest kit is pulling data from an exchange. Think of it as a way to be notified when new candlestick data arrives. Specifically, the `onCandleData` property is a function you can provide; this function will be called whenever candlestick data is fetched, giving you the symbol, timeframe (interval), start date, number of candles requested, and the actual data received. You can use this to monitor data flow or perform custom processing as the data comes in.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with a simulated or real exchange. It lets you retrieve historical and future candle data, essential for recreating trading scenarios. You can request candles for a specific trading symbol and time interval, allowing you to analyze past price movements or peek into potential future prices during backtesting.

This interface also handles the tricky process of formatting trade quantities and prices to match the exchange’s specific rules, ensuring your simulated orders are valid. Finally, it provides a convenient way to calculate the VWAP (Volume Weighted Average Price), a common indicator used by traders, based on recent trading activity.

## Interface IEntity

This interface, `IEntity`, serves as the foundation for anything you want to save and retrieve from your backtest-kit data storage. Think of it as the starting point for representing data that needs to stick around, like historical prices or order information. Any class that implements `IEntity` is expected to be able to be persistently stored and loaded. It’s the common ground for all your data objects.

## Interface ICandleData

The `ICandleData` interface represents a single bar of price data, like you'd see in a chart. Each candle contains information about the opening price, the highest price reached, the lowest price touched, the closing price, and the volume traded during that specific time interval. The `timestamp` property tells you exactly when that candle began, represented as a Unix timestamp in milliseconds. This data is fundamental for tasks like calculating VWAP and running backtests to evaluate trading strategies.

## Interface DoneContract

This interface describes what's passed when a background process, either a backtest or live execution, finishes running. It's a way to know when things are done and to get some details about what just happened.

You'll see this object when using `Live.background()` or `Backtest.background()`. 

It tells you which exchange was used, the name of the strategy that ran, whether it was a backtest or a live trade, and the trading symbol involved. Think of it as a notification with key details about the completed task.


## Interface BacktestStatistics

The `BacktestStatistics` interface holds all the key performance metrics calculated during a backtest. It provides a detailed snapshot of how your trading strategy performed.

You’ll find a list of all closed trades with their individual details in `signalList`, along with the total number of trades executed (`totalSignals`). It breaks down the results by counting winning trades (`winCount`) and losing trades (`lossCount`).

To understand overall profitability, you can check the `winRate` (percentage of winning trades), `avgPnl` (average profit per trade), and `totalPnl` (cumulative profit). Risk assessment is covered by `stdDev` (volatility) and `sharpeRatio` (risk-adjusted return), which are both ways to understand how consistently and efficiently your strategy generates profits. `annualizedSharpeRatio` provides a yearly perspective on your Sharpe Ratio. The `certaintyRatio` helps gauge the ratio of average wins to losses. Lastly, `expectedYearlyReturns` offers an estimate of yearly profits based on average trade duration. All numeric values are reported as null if the calculation isn't reliable due to potential issues like division by zero.
