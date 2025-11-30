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

You can now customize how backtest-kit reports its activities by providing your own logging mechanism. This function lets you plug in a logger that adheres to the `ILogger` interface, and all internal messages will be routed through it. Importantly, the logger will automatically receive context information like the strategy name, exchange, and the symbol being traded, making debugging and monitoring much easier. Essentially, it's a way to tailor the framework's output to your specific needs and preferences.

## Function setConfig

This function lets you tweak the core settings of the backtest-kit framework. You can adjust things like the data fetching behavior or how results are handled, without needing to redefine the entire configuration from scratch. Think of it as a way to fine-tune the framework’s behavior to better suit your specific backtesting needs. You provide a configuration object, and only the parts you specify will be updated, leaving the rest at their default values. This allows for easy customization while keeping things manageable.

## Function listWalkers

This function lets you see a complete list of all the trading strategies, or "walkers," that have been set up within the backtest-kit framework. Think of it as a way to inventory all the different trading approaches you're using. It’s especially helpful if you want to understand what's happening behind the scenes, create documentation, or build a user interface that adapts to the available strategies. The result is a promise that resolves to an array of schemas, each describing a walker.

## Function listStrategies

This function lets you see a complete inventory of all the trading strategies currently set up within the backtest-kit framework. Think of it as a way to get a clear view of what strategies are available for testing or analysis.  It pulls in all the strategy definitions you’ve previously added using `addStrategy()`.  This is really handy if you want to build tools to display these strategies or ensure everything is configured correctly. The function returns a list of strategy schemas, giving you access to details about each strategy.

## Function listSizings

This function gives you a peek at all the sizing rules currently in use within the backtest-kit framework. Think of it as a way to see all the different ways your trades are being sized – how much of an asset you’re buying or selling. It's handy when you're checking if your sizing rules are set up correctly, creating documentation, or building user interfaces that need to reflect these configurations. The function returns a list of these sizing schemas, allowing you to inspect and understand how your trades are being sized.

## Function listRisks

This function lets you see all the risk assessments your backtest kit is set up to handle. It pulls together all the risk configurations you’re using, giving you a complete picture of how risks are being evaluated. Think of it as a way to inspect your risk management setup – helpful for checking things out, generating documentation, or creating user interfaces that adapt to different risk types. The result is a list of risk schemas, each describing a particular type of risk and how it’s being assessed.

## Function listFrames

This function helps you discover what kinds of data frames your backtest kit is working with. It provides a simple way to see a list of all the data structures, or "frames," that have been set up for trading. Think of it as a quick inventory of your data – it's handy for understanding what's happening behind the scenes, creating helpful documentation, or even building tools that automatically adjust to different data formats. It gives you a promise that resolves to an array of frame schemas.

## Function listExchanges

This function lets you see a complete list of exchanges your backtest-kit setup recognizes. It’s like a directory of all the trading venues your framework is aware of. You can use it to verify that your exchanges are correctly configured, generate documentation, or build user interfaces that adapt to the available exchanges. The function returns a promise that resolves to an array of exchange schemas.

## Function listenWalkerOnce

This function lets you set up a listener that reacts to events happening within a trading simulation, but only once. It’s perfect when you need to wait for a particular condition to be met, like a specific order being filled or a certain data point becoming available. 

You tell it what kind of event you're looking for with a filter – a little test to see if the event matches your criteria. When an event passes that test, a function you provide will run. Once that function has been executed, the listener automatically stops listening, so you don't have to worry about cleaning up subscriptions. 

It takes two parts: a way to identify which events you care about, and a function to execute when the right event occurs.

## Function listenWalkerComplete

This function lets you get notified when a backtest run finishes. It's perfect for situations where you need to react to the overall results of a test, like saving data or triggering further analysis.  The important thing to know is that even if your notification code takes some time to run (like if it involves asynchronous operations), the framework will make sure things happen one at a time, in the order they were received. You provide a function that will be called when the testing is done, and this function returns another function that you can use to unsubscribe from the notifications later.


## Function listenWalker

This function lets you keep an eye on how your backtest is progressing. It's like setting up a listener that gets notified after each strategy finishes running within the `Walker.run()` process. You provide a function that will be called with information about the completed strategy, and this listener guarantees that your function is executed one at a time, even if it involves asynchronous operations, ensuring a smooth and predictable flow of information. It's a great way to track progress and potentially perform actions based on the results of each strategy.

## Function listenValidation

This function lets you keep an eye on potential issues during the risk validation process. It essentially signs you up to receive notifications whenever a validation check throws an error. Think of it as setting up an alert system for problems that might pop up while your trading strategies are being assessed. The errors you receive will be delivered one at a time, in the order they occurred, even if your notification process needs to do some extra steps. This ensures a controlled and predictable way to debug and track validation failures. You provide a function that will be called whenever a validation error happens, and this function will receive the error object as an argument.

## Function listenSignalOnce

This function lets you temporarily listen for specific trading signals. You provide a filter – a condition that must be met – and a callback function. Once a signal matches your filter, the callback will run just once, and then the function automatically stops listening. Think of it as setting up a short-term alert for a particular market condition; you only care about it happening once. It's a handy way to react to a specific, one-off signal without needing to manage subscriptions yourself.

The `filterFn` defines what signals you're interested in, and the `fn` is what you want to happen when that signal appears.

## Function listenSignalLiveOnce

This function lets you quickly react to a single, specific signal coming from a live trading simulation. Think of it as setting up a temporary listener that only cares about one particular event. 

You provide a filter – essentially, a rule – to determine which signals you're interested in. Then, you provide a function that will execute once when a matching signal arrives. After that single execution, the listener automatically stops listening, so you don't have to worry about manually unsubscribing. It's designed for situations where you need to respond to a signal just once during a live run.


## Function listenSignalLive

This function lets you hook into a live trading simulation to receive updates as they happen. Think of it as setting up a listener that gets notified whenever a trading signal is generated during a live backtest. The system will deliver these signal updates to your provided function one at a time, ensuring they are processed in the order they occur. It’s important to remember that you'll only get events from a `Live.run()` execution; it’s specifically designed for observing live trading behavior. The function returns another function that, when called, will unsubscribe you from receiving these live signal updates.

## Function listenSignalBacktestOnce

This function lets you set up a listener that reacts to specific events generated during a backtest. Think of it as a temporary alert system for your trading strategy's performance.

You provide a filter – a rule to determine which events you’re interested in – and a function to execute when a matching event occurs.  The listener will only be triggered once for the first matching event during the backtest run.  After that single execution, it automatically stops listening and cleans itself up, so you don't have to worry about manually unsubscribing. It’s great for quick checks and confirmations during backtesting.


## Function listenSignalBacktest

This function lets you tap into the stream of data generated during a backtest. It's like setting up a listener that gets notified whenever a signal is produced. 

You provide a function, and this function will be called repeatedly with information about each signal generated by the backtest. This is useful if you want to react to signals as they happen or process them in a specific way. 

Importantly, the signals are delivered one at a time, ensuring they are processed in the order they were created during the backtest run. This function is specifically designed to work with data from `Backtest.run()`.


## Function listenSignal

This function lets you listen for trading signals – things like when a strategy is idle, a trade is opened, a position is active, or a trade is closed. It’s a way to react to what's happening in your backtest.  Importantly, the signals are processed one after another, even if your reaction involves some asynchronous operations. This ensures things happen in a predictable order and prevents unexpected behavior from multiple things running at the same time. You provide a function that will be called whenever a signal event occurs, and that function receives information about the event. The function you provide will return a function that can be used to unsubscribe.

## Function listenProgress

This function lets you keep an eye on what's happening during a backtest, especially when you're using background tasks. It allows you to register a function that gets called whenever the backtest makes progress. Importantly, even if your progress update function takes time to run (like if it's doing something asynchronous), the updates will be processed one after another, ensuring a clean and orderly flow of information. You provide a function that will be notified with progress details, and this function returns another function that you can call to stop listening for progress events.

## Function listenPerformance

This function lets you monitor how quickly your trading strategies are running. It acts like a listener, sending you updates on the timing of different operations as they happen. Think of it as a way to profile your code and pinpoint any slow areas that might be holding back your trading performance. The updates you receive are processed one at a time, even if the function you provide takes some time to complete, ensuring things don't get messy with overlapping processing. You just give it a function to handle these performance updates, and it will notify that function whenever a relevant event occurs.

## Function listenError

This function lets you tap into errors that occur during background tasks within your backtesting or live trading environment. Specifically, it listens for errors that happen when using `Live.background()` or `Backtest.background()`.

When an error occurs, the provided callback function will be executed. Importantly, even if your callback function involves asynchronous operations, errors are handled in the order they occur and processed one at a time, ensuring reliable error management. It's a straightforward way to keep track of and respond to unexpected issues happening in the background. You give it a function to call when errors happen, and it returns a function you can use to stop listening.

## Function listenDoneWalkerOnce

This function lets you set up a listener that gets notified when a background task within the backtest kit finishes, but only once. You provide a filter to specify which completed tasks you're interested in – it only triggers the callback for those that match your criteria.  Once the callback runs, it automatically removes itself from listening, ensuring it doesn't keep running unexpectedly. It's perfect for actions you only need to perform a single time when a specific background task concludes. 

The first argument is a filter function – think of it as a rule for selecting the events you want to hear about. The second argument is the function that gets called with the information about the completed task.

## Function listenDoneWalker

This function lets you track when a background task within the backtest-kit framework finishes. Think of it as a way to be notified when a process, started with `Walker.background()`, is done. The notification happens even if the task involves asynchronous operations, and it guarantees that the notification processing happens one after another, in the order they occurred. To use it, you provide a function that will be called when the background task completes, and it returns another function which you can call to unsubscribe from the events.


## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running within the backtest-kit framework, but only once. You provide a filter to specify which finishing tasks you're interested in, and then a function that will be executed when a matching task completes. Once the function runs, the subscription is automatically removed, so you don’t have to worry about cleaning up. Think of it as setting up a temporary alert that only goes off for a specific type of finished background job.


## Function listenDoneLive

This function lets you monitor when background tasks run by Live are finished. It’s useful for knowing when a process has completed and needs further attention. When a background task is done, the function will call the callback you provide, ensuring that even if your callback takes some time to run, events are handled one at a time, in the order they arrive. This helps prevent issues that can arise from multiple callbacks running simultaneously. The function returns an unsubscribe function so you can easily stop listening when it's no longer needed.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but in a special way – only once. You provide a filter to decide which completed backtests you're interested in, and then give it a function to run when a matching backtest is done.  Once that function has run, it automatically stops listening, so you don't have to worry about cleaning up. It's perfect for situations where you need to perform a one-time action after a specific backtest completes, like logging a final result or updating a UI element.


## Function listenDoneBacktest

This function lets you be notified when a background backtest finishes running. Think of it as subscribing to an alert that goes off when the backtest is done. The function you provide will be called when the backtest completes, and it handles events in the order they arrive. Importantly, even if your callback function involves asynchronous operations, the events will be processed one at a time to ensure things don't get out of order. It’s a reliable way to know when the backtest is fully finished and you can move on to the next step.


## Function getMode

This function tells you whether the trading framework is running in backtest or live mode. It's a simple way to check if you're simulating trades or actually executing them with real money. The function returns a promise that resolves to either "backtest" or "live," giving you a clear indication of the current environment. This is useful for conditional logic within your trading strategies, so you can behave differently depending on the mode.

## Function getDate

This function, `getDate`, simply tells you what the current date is. It's useful for understanding the context of your trading logic. When you're backtesting, it will give you the date associated with the specific historical timeframe you're analyzing. If you’re running live, it provides the actual, real-time date.

## Function getCandles

This function helps you retrieve historical price data, also known as candles, for a specific trading pair. Think of it as requesting a chart of past prices. 

You tell it which trading pair you’re interested in, like "BTCUSDT" for Bitcoin against USDT, and how frequently you want the data – for example, every minute ("1m") or every hour ("1h"). You also specify how many candles you want to pull back in time. 

It uses the underlying exchange's built-in tools to get this data, so the exact available intervals and how far back you can go depend on the exchange you’re connected to. The data is returned as an array of candle objects, each containing information like open, high, low, close prices, and timestamp.

## Function getAveragePrice

This function helps you figure out the average price of a trading pair, like BTCUSDT. It calculates what's called a Volume Weighted Average Price, or VWAP, which considers both the price and how much was traded. The VWAP is based on the last five minutes of trading data, specifically using the high, low, and closing prices of each minute. 

If there's no trading volume available, the function simply calculates the average of the closing prices instead. You just need to provide the trading pair's symbol as input.

## Function formatQuantity

This function helps you ensure your trading quantities are formatted correctly for the specific exchange you're using. It takes the trading pair symbol, like "BTCUSDT," and the raw quantity you want to trade, and returns a properly formatted string. This formatting takes into account the exchange's rules for decimal places, which is crucial for placing valid orders. Using this function prevents issues caused by incorrect quantity formatting.


## Function formatPrice

This function helps you display price values correctly for different trading pairs. It takes a symbol like "BTCUSDT" and a numerical price as input. It then uses the specific rules of the exchange associated with that symbol to format the price string, ensuring the right number of decimal places are shown. This makes sure your displayed prices are accurate and consistent with the exchange's standards.

## Function addWalker

This function lets you register a 'walker' within the backtest-kit framework. Think of a walker as a specialized tool that runs multiple strategy backtests simultaneously, allowing you to easily compare how different strategies perform against each other using the same data. You provide a configuration object, known as a `walkerSchema`, which tells the walker how to execute these comparative backtests and which metrics to use for the evaluation. Essentially, it's how you set up the engine for comparing your trading strategies in a consistent and repeatable way.


## Function addStrategy

This function lets you add a trading strategy to the backtest-kit framework. Think of it as registering your trading plan so the system knows how to execute it. The framework will automatically check your strategy’s setup to make sure everything makes sense – things like price data, take profit/stop loss rules, and the timing of your signals. It also handles rate limiting to prevent signal overload and makes sure your strategy's data survives even if the system crashes, especially when you're running live tests. You provide a configuration object, called `strategySchema`, to define how your strategy works.

## Function addSizing

This function lets you tell the backtest kit how to determine the size of your trades. Think of it as defining your risk management rules. You provide a configuration object, which outlines things like whether you're using a fixed percentage of your capital, a Kelly Criterion approach, or something based on Average True Range. 

The configuration also includes specifics, like how much risk you’re willing to take, how to calculate the position size, and any limits you want to set on the size of your positions. Essentially, it’s how you instruct the system to manage your capital during the backtest.

## Function addRisk

This function lets you set up how your trading strategies manage risk within the backtest-kit framework. Think of it as defining the guardrails for your automated trading. You provide a configuration that specifies limits on how many trades can be open at once, and allows you to add your own custom checks to ensure your portfolio stays healthy and doesn’t take on excessive risk. It's designed so that multiple strategies can share the same risk management rules, providing a holistic view of your overall risk exposure. The framework keeps track of all active positions and makes that data available to your custom validation functions, letting you enforce sophisticated risk controls.

## Function addFrame

This function lets you tell backtest-kit how to create the timeframes it will use for testing your trading strategies. Think of it as defining the "look" of your backtest – specifying the start and end dates, the interval (like daily, hourly, or weekly), and how to handle events during timeframe creation. You provide a configuration object describing these details, and backtest-kit then uses that information to generate the timeframes for your backtest. Essentially, you're telling the system what period and resolution you want to analyze.


## Function addExchange

This function lets you tell backtest-kit about a new data source for trading, like a cryptocurrency exchange or a stock market. Think of it as connecting backtest-kit to a specific place where it can pull historical price information. You provide a configuration object that tells the framework how to fetch candles (price data over time), how to format prices and quantities, and how to calculate a common trading indicator called VWAP. By registering an exchange, you're essentially expanding backtest-kit's knowledge of available markets and enabling it to simulate trading strategies on that exchange.

# backtest-kit classes

## Class WalkerValidationService

The WalkerValidationService helps ensure your trading strategies are set up correctly by verifying the structure of your trading logic, often referred to as "walkers." 

Think of it as a quality control system for your trading code. You register the expected structure of each walker using its schema, and then use the service to check if your actual trading logic matches that structure. 

You can add new walker schemas, validate existing ones against a given data source, and retrieve a complete list of all registered schemas. This helps catch errors early and ensures consistency across your backtesting environment.

## Class WalkerUtils

WalkerUtils simplifies running and managing walker comparisons, acting as a helpful assistant for your backtesting process. It provides easy access to the underlying walker execution engine, automatically handling details like identifying the exchange and timeframe used.

You can use the `run` function to execute a walker comparison for a specific trading symbol and get results as they come in. If you just want to run a comparison in the background for things like logging or callbacks without needing the results themselves, the `background` function is perfect.

The `getData` function allows you to retrieve the compiled results from all strategy comparisons, while `getReport` generates a formatted markdown report summarizing those comparisons. Finally, `dump` provides a convenient way to save that report directly to a file on your system. Think of WalkerUtils as your go-to tool for streamlining your walker-related tasks.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of your trading strategies' blueprints, also known as walker schemas. It acts like a central place to store and manage these blueprints in a way that prevents errors thanks to TypeScript's type safety. 

You can add new blueprints using `addWalker()` and easily find them later by their names using `get()`. If a blueprint already exists, you can update parts of it with `override()`. Before adding a new blueprint, `validateShallow()` makes sure it has all the essential components in the correct format. This service relies on a logging system (`loggerService`) to keep you informed about what's happening.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you create reports summarizing the performance of your trading strategies during backtesting. It listens for updates as your strategies run and collects the results. These results are then organized into easy-to-read markdown tables that compare the strategies side-by-side. The service automatically saves these reports as markdown files, making it simple to review and analyze your backtest outcomes.

The service uses a clever storage system, ensuring each backtest ("walker") has its own isolated set of results. You can clear the accumulated results for a specific backtest or clear everything at once.

It’s designed to be straightforward to use: it initializes itself automatically when needed, subscribing to the relevant backtest events. You don't need to worry about manually setting things up.

## Class WalkerLogicPublicService

The WalkerLogicPublicService acts as a central point for coordinating and running your trading strategies, making it easier to manage the context they operate within. Think of it as a helpful manager that automatically passes along important information like the strategy name, exchange, frame, and walker name to the underlying systems.

It relies on two other services: one for handling the core walker logic and another for managing the schemas.

The `run` method is your primary tool for executing backtests. You provide a symbol (like a stock ticker) and a context object, and it takes care of running the comparison across all strategies, automatically handling the contextual details. This simplifies the process of setting up and running backtests by reducing the amount of information you need to manually provide.

## Class WalkerLogicPrivateService

This service helps you compare different trading strategies against each other. It essentially acts as an orchestrator, managing the execution of each strategy and providing updates along the way. 

Think of it as running a series of backtests, one after another, and getting progress reports after each one finishes. It keeps track of the best performing strategy as it goes and provides a final, ranked result showing how each strategy performed. 

To use it, you provide the trading symbol, a list of strategies you want to compare, the metric you’re using to evaluate them (like profit or Sharpe ratio), and some context information like the exchange and data frame being used. The service then handles the complexity of running each backtest and presenting the results in an organized fashion. 

It works closely with other services internally, particularly the public backtest logic service, to perform the actual backtesting.


## Class WalkerCommandService

The WalkerCommandService acts as a central hub for interacting with the core walker functionality within the backtest-kit. It provides a straightforward way to access various validation and logic services, making it easy to incorporate walker operations into your application.

Think of it as a simplified interface for managing and executing walkers, handling the underlying complexities behind the scenes.

It exposes a single method, `run`, which is the primary way to initiate a walker comparison. You provide the symbol you want to analyze along with context details like the walker, exchange, and frame names, and it returns a stream of results. This allows you to easily compare different walkers and configurations for a given asset.

## Class StrategyValidationService

The StrategyValidationService helps ensure your trading strategies are correctly defined and compatible with the backtest framework. It keeps track of registered strategy schemas, essentially blueprints for how a strategy should look. 

You can add strategy schemas to the service, allowing it to check their validity. When you want to run a backtest, this service verifies that the specified strategy exists and that its risk profile is properly set up. 

If you need to see what strategies are currently registered, you can request a list of all schemas. Think of it as a central place to manage and check the foundations of your trading strategies.

## Class StrategySchemaService

The StrategySchemaService helps you keep track of your trading strategy blueprints. It acts like a central repository where you can store and manage the definitions of your strategies. 

You can add new strategy definitions using `addStrategy()` and then easily find them again by their names using `get()`. It's designed to be type-safe, ensuring your strategy definitions are consistent. 

Before adding a strategy, `validateShallow` checks to make sure it has all the necessary parts and they’re the right types, preventing errors down the line. If you need to update a strategy's details, the `override` function lets you make changes to existing definitions without replacing the entire thing.

## Class StrategyGlobalService

This service acts as a central hub for working with trading strategies, streamlining their operation within the backtesting environment. It connects the core strategy logic with information about the market symbol, the specific time, and whether it’s a backtest or live trading scenario.

Essentially, it manages and validates strategies, offering methods to check their status at a given time and run quick backtests using historical data. There are also functions to stop a strategy from producing new signals and to clear its cached data, ensuring a fresh start when needed. The whole point is to simplify how strategies are used and keep things running efficiently.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub for managing and executing different trading strategies. It figures out which specific strategy to use based on the current context, and keeps track of those strategies so it doesn't have to recreate them every time. 

Think of it as a traffic controller, routing requests to the right strategy implementation. It remembers which strategies it’s already set up, making things faster and more efficient. 

Before running any live trades or backtests, it makes sure the chosen strategy is properly initialized. The `tick()` method handles live trading, while `backtest()` lets you test a strategy against historical data. You can also pause a strategy using `stop()` or completely clear its setup from memory with `clear()`, which forces a fresh start.

## Class SizingValidationService

The SizingValidationService helps ensure your trading strategies are using the sizing methods you expect. Think of it as a quality control system for how much capital your strategy will use on each trade.

You can add different sizing strategies, like fixed percentages or Kelly criterion, using the `addSizing` method, associating a name and a specific configuration for each. The `validate` method then lets you check if a sizing exists and confirm it's configured appropriately. 

Need to know what sizings are currently registered? The `list` method returns all the sizing schemas you’ve added, giving you a quick overview of your sizing setup. The `loggerService` property allows for logging, and `_sizingMap` internally manages the registered sizings.

## Class SizingSchemaService

This service helps you keep track of your sizing schemas, which are essentially blueprints for how much to trade. It uses a type-safe way to store these schemas, ensuring consistency and reducing errors.

You can add new sizing schemas using the `register` method, and update existing ones with the `override` method.  If you need to use a sizing schema, the `get` method allows you to retrieve it by name.

Before a sizing schema can be registered, it goes through a quick check using `validateShallow` to make sure it has all the necessary components and that they are of the correct types.  This helps catch potential issues early on.




The service itself relies on a logger (`loggerService`) to help with debugging and understanding what's happening, and uses a private registry (`_registry`) to store all your sizing schemas.

## Class SizingGlobalService

This service handles the calculations needed to determine how much of an asset to trade. It’s designed to work behind the scenes, used by the trading system and its public tools. 

Essentially, it takes your risk parameters and figures out the appropriate position size. It relies on other services to help with this process, including one for connecting to sizing data and another for validating the sizing. 

You won’t typically interact with this directly, but it's a core part of how the trading framework determines trade sizes. 

It has properties for logging and managing connections, and a main `calculate` function that does the sizing work.

## Class SizingConnectionService

The SizingConnectionService acts as a central hub for calculating trade sizes. It directs sizing requests to the correct sizing method, allowing your strategies to use different approaches for determining how much to trade. 

Think of it as a smart router – you tell it which sizing method you want to use (like "fixed-percentage" or "kelly-criterion"), and it handles the details of calling the right implementation.  The service remembers which sizing methods you're using to avoid unnecessary setup and make things faster.

It has a `calculate` function that you'll primarily use to get the position size, providing details about the sizing method and the overall context. You don't need to worry about the underlying sizing logic; this service takes care of it for you. If a strategy doesn't have any sizing configured, the sizingName will be an empty string.

## Class ScheduleUtils

This class helps you keep track of and report on how your trading strategies are generating signals over time. It acts as a central place to gather information about scheduled signals, including those that are cancelled. 

Think of it as a tool for monitoring your strategies' signal generation process. You can easily get statistics like cancellation rates and average wait times.

The class also creates formatted reports in Markdown, which you can use to analyze your strategies' performance and identify potential issues. 

You can save these reports directly to a file. It's designed to be easy to use and provides a single point of access to signal scheduling information. You can clear the data entirely, or just for a specific strategy if needed.

## Class ScheduleMarkdownService

This service automatically generates reports about scheduled and cancelled trading signals, helping you understand how your strategies are performing over time. It keeps track of all signal events for each strategy you're using.

The service listens for signal events and organizes them, then creates easy-to-read markdown tables summarizing the signal activity.  You'll also get useful statistics like cancellation rates and average wait times.  These reports are saved as `.md` files within the `logs/schedule/` directory, one file per strategy.

To get started, the service automatically initializes when first used.  You can also retrieve statistical data, generate full reports, or clear the accumulated data for a specific strategy or all strategies.  The `getStorage` property manages isolated data storage for each strategy, preventing interference between them.

## Class RiskValidationService

The RiskValidationService helps you ensure your trading strategies adhere to predefined risk guidelines. Think of it as a gatekeeper for your trading logic. 

You start by defining your risk schemas – what constitutes a valid risk profile for your system – using the `addRisk` method. These schemas act as blueprints for acceptable risk levels.  

The `validate` method then checks if a particular trading scenario aligns with a defined risk schema. If not, it flags the issue. 

If you need to see all the risk schemas you’ve registered, the `list` method provides a convenient way to retrieve them. The service uses a logger to report any validation problems.

## Class RiskSchemaService

The RiskSchemaService helps you keep track of your risk schema definitions in a safe and organized way. It acts like a central repository for these schemas, ensuring they are consistently structured and accessible. 

You can add new risk profiles using the `addRisk()` function (represented as `register` here) and retrieve them later by their name using `get()`.  If a schema already exists, you can update parts of it with `override()`.  Before a new risk schema is added, `validateShallow()` checks that it has all the necessary components and the correct data types. The service uses a tool to manage these schemas in a type-safe manner.

## Class RiskGlobalService

This service helps manage and enforce risk limits during trading. It sits between your strategies and the underlying risk management system, ensuring that trades align with predefined rules.

It utilizes a connection service to interact with the risk management system and includes a validation service for checking risk configurations. It keeps track of open and closed signals, registering them with the risk management system to monitor activity.

You can clear all risk data or selectively clear data for a particular risk instance. The validation process is optimized to prevent repeated checks for the same risk settings. The service also provides logging for validation actions.


## Class RiskConnectionService

The `RiskConnectionService` acts as a central hub for handling risk checks within your trading system. It intelligently directs risk-related operations to the correct implementation based on a provided name, ensuring that the right rules are applied. To improve performance, it remembers previously used risk implementations, so it doesn't have to recreate them every time.

You can retrieve a specific risk implementation using the `getRisk` function, which creates one if it doesn't already exist. The `checkSignal` function is your go-to for determining if a trade should be allowed, validating factors like drawdown and exposure limits.

If you’re registering a new trade, use `addSignal`. When a trade closes, `removeSignal` lets the risk system know. Lastly, `clear` helps you refresh the system by clearing out cached risk implementations, useful when you need to make sure you're using the latest rules. Strategies without risk configuration will use an empty string as the risk name.

## Class PositionSizeUtils

This class provides helpful tools for figuring out how much of an asset to trade, based on different strategies. It's designed to make position sizing easier and safer.

Inside, you'll find several methods for calculating position size. One method calculates size by using a fixed percentage of your account balance. Another uses the Kelly Criterion, a more complex approach that considers your win rate and win/loss ratio. Finally, there’s a method based on the Average True Range (ATR), which uses volatility to determine size.

Each of these methods is designed to be used with specific information, and the system will check to make sure you're providing the right details. This helps prevent errors and ensures your position sizing is calculated correctly.

## Class PersistSignalUtils

This class provides tools for reliably storing and retrieving signal data, ensuring your trading strategies maintain their state even if things go wrong. It's designed to work behind the scenes, especially for strategies running in live mode where persistent data is crucial.

The system automatically manages storage instances for each strategy, and you can even plug in your own custom storage solutions if the built-in options don't quite meet your needs. Data reads and writes are handled carefully to prevent data loss or corruption, and the process is designed to be crash-safe.

When a strategy needs to load or save its signal data, this utility class takes care of the low-level details, allowing the strategy itself to focus on trading. The `readSignalData` method retrieves existing data, and `writeSignalData` securely saves new data to disk.

## Class PersistRiskUtils

This class helps manage how active trading positions are saved and loaded, particularly for different risk profiles. Think of it as a secure vault for your trading state.

It intelligently keeps track of where to store this data, creating dedicated storage areas for each risk profile. You can even plug in your own custom storage solutions to tailor the persistence to your specific needs.

When your trading system restarts, this class retrieves the saved positions, bringing everything back to where it left off. It ensures that changes to your positions are saved reliably, even if the system encounters unexpected interruptions. 

ClientRisk utilizes this class to retrieve and update the trading position data by using functions like `readPositionData` and `writePositionData`. You can also define your own persistence adapter via `usePersistRiskAdapter`.

## Class PerformanceMarkdownService

This service helps you keep track of how your trading strategies are performing. It listens for performance data, organizes it by strategy, and then calculates important statistics like average, minimum, maximum, and percentiles. 

The service automatically creates a separate storage area for each strategy, preventing data from one strategy impacting another. You’ll find the results summarized in easy-to-read markdown reports that pinpoint performance bottlenecks. These reports are saved to your logs directory. 

The `track` function is the key to feeding performance data into the system, and the `getData` function allows you to retrieve the calculated statistics.  You can also generate reports directly with `getReport` or save them to a specific file location using `dump`.  To reset all recorded performance data, use the `clear` function. Finally, the `init` function sets everything up by subscribing to performance events – this happens automatically, but only once.

## Class Performance

The Performance class helps you understand how your trading strategies are performing. It provides tools to gather and analyze performance data, making it easier to identify areas for improvement.

You can retrieve detailed statistics for a specific strategy using `getData`, which gives you metrics like count, duration, averages, and percentiles to understand performance trends. `getReport` creates a user-friendly markdown report that visually summarizes performance, highlighting potential bottlenecks and areas for optimization.  You can also save these reports to disk using `dump`, ensuring you have a record of your strategy's performance over time. Finally, `clear` allows you to reset the accumulated performance data when you want to start fresh or when dealing with multiple strategies.

## Class LoggerService

The `LoggerService` helps keep your backtesting logs organized and informative. It's designed to provide consistent logging throughout the framework, automatically adding useful context like which strategy, exchange, and timeframe a log message relates to, as well as details about the traded symbol and time.

If you don't specify a logger, it defaults to a "do nothing" logger, which is useful during development.

You can customize the logging by providing your own logger implementation through the `setLogger` method.  This allows you to direct logs to a file, a console, or any other destination. The service also has properties that manage context and the underlying logger. You can use `log`, `debug`, `info`, and `warn` methods to record different levels of log messages, all automatically enhanced with the relevant context.

## Class LiveUtils

The LiveUtils class offers helpful tools for live trading operations within the backtest-kit framework. Think of it as a central place to start and manage your live trading processes.

The `run` function is the main entry point, providing an endless stream of trading results – opened, closed, or cancelled – for a specific symbol, and it automatically handles potential crashes by restoring the process from saved data. 

You can also run a live trade in the background with `background`, which is useful if you just need it to trigger certain actions or update persistent data without needing to directly process the trading results yourself. 

To get a quick overview of how a strategy is performing, `getData` provides statistical information, while `getReport` creates a detailed markdown report of all trading events. Finally, `dump` allows you to easily save these reports to a file for later review.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create reports of your live trading activity. It keeps track of everything that happens during your strategy's execution – from idle periods to when trades are opened, active, and closed.

The service generates nicely formatted markdown tables detailing these events, along with useful trading statistics like win rate and average profit/loss. It saves these reports as `.md` files in a `logs/live` directory, organized by strategy name, making it easy to review your strategy's performance over time.

To get started, the service needs to be initialized, which typically happens automatically when you first use it. You provide it with your strategy’s tick data through the `onTick` callback, and it handles the rest. You can also clear the accumulated data if you want to start fresh. Each trading strategy gets its own dedicated storage for its report data, keeping things separate and organized.

## Class LiveLogicPublicService

This service handles the core of live trading, making it easier to manage and ensuring your strategies run smoothly. It acts as a wrapper around the private logic service, automatically passing along important information like the strategy name and exchange used – you don’t have to manually include this in every function call.

Think of it as a continuous stream of trading events, constantly running and providing updates on opened, closed, and canceled signals.  If something goes wrong and the process crashes, it automatically recovers and picks up where it left off by restoring the trading state from a saved file. The service continuously progresses in real-time using the current timestamp.

You start the trading process for a specific symbol using the `run` function, which takes the symbol and context as input. The function returns an infinite async generator, providing a continuous flow of trading results.

## Class LiveLogicPrivateService

This service handles the ongoing process of live trading, designed to keep running continuously. It acts as the central coordinator, constantly checking for new trading signals and managing the execution of strategies.

Think of it as an always-on monitor, regularly checking the status of your trading strategies. It uses an infinite loop to keep track of what's happening and streams results – only when a trade opens or closes – to avoid overwhelming you with unnecessary data. 

If something goes wrong and the process crashes, it will automatically recover, ensuring your strategies pick up where they left off. This whole process delivers results in a way that's easy to work with, using an asynchronous generator that provides a steady stream of information about your trading activity. It's designed to be memory-efficient and resilient, keeping your live trading operation running smoothly.

## Class LiveCommandService

This service provides a straightforward way to access the live trading features within the backtest-kit framework. Think of it as a central hub for managing live trading operations, making it easy to integrate into your application. 

It’s designed to work with dependency injection, meaning it's flexible and can be used in various project setups. The service relies on other components like validation services and a live logic service to handle the complexities of live trading.

The key function, `run`, is what actually kicks off the live trading process for a specific symbol.  It continuously generates results - like opened, closed, or cancelled trades – and is built to automatically recover from crashes, ensuring a more resilient trading experience. Essentially, it's an ongoing, self-recovering stream of trading events.


## Class HeatUtils

This class, HeatUtils, helps you visualize and understand your backtest results using heatmaps. Think of it as a handy tool for quickly creating reports that show how different assets performed within a specific trading strategy.

It gathers performance data—like total profit/loss, Sharpe Ratio, maximum drawdown, and trade counts—for each symbol used in a strategy. It then organizes this information into a clear, easy-to-read markdown table, sorted by profitability.

You can request this data using `getData` to access the underlying statistics, or use `getReport` to generate a complete markdown report.  The `dump` function lets you save these reports directly to a file on your computer, so you can share them or keep a record of your backtest performance. It's designed to be easy to use—just ask for a strategy name, and it handles the rest.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and analyze your trading performance across different strategies. It collects data about closed trades and turns it into clear, understandable reports. Think of it as a dashboard that shows you how each strategy is doing, with key metrics like profit, risk (Sharpe Ratio and Max Drawdown), and the number of trades executed.

It organizes this information separately for each strategy, creating isolated storage so you can easily compare their results.  You can request the raw data programmatically, generate a nicely formatted Markdown report, or even save the report directly to a file. 

To start using it, simply let it listen to your signal emitter, and it will automatically begin gathering data. You can clear the data at any time – either for a single strategy or for all strategies.

## Class FrameValidationService

This service helps ensure your trading frames – the structured data you’re working with – are set up correctly and consistently. Think of it as a quality control system for your data. 

You can use it to register the expected structure of each frame using `addFrame`. This lets the service know what kind of data to expect. 

The `validate` function then checks if a frame exists and is correctly formatted, helping you catch errors early on. 

Finally, `list` provides a simple way to see all the frame schemas you've registered, giving you an overview of your data structure setup.

## Class FrameSchemaService

The FrameSchemaService helps you keep track of the structures your backtesting framework uses, ensuring everything is consistent and avoids unexpected errors. It acts like a central repository for defining the expected format of your data frames.

It uses a special system for type-safe storage, making it less likely you'll accidentally store something that doesn't fit the expected structure. 

You can add new frame definitions using the `register` method, updating existing ones with `override`, and fetching them by name with `get`. Before a frame is stored, it performs a quick check to make sure the basic shape is correct, helping you catch issues early.

## Class FrameGlobalService

This service helps manage and generate the timeframes used for backtesting. It works closely with the connection service to fetch data and a validation service to ensure the data is usable. Think of it as the engine that provides the sequence of dates you’re testing your trading strategy against. 

The `getTimeframe` method is its key function; you can use it to get a list of dates for a specific trading symbol and timeframe (like daily, hourly, etc.) to power your backtest. It fetches these dates, ensuring they’re in the correct order and ready for analysis.

## Class FrameConnectionService

The FrameConnectionService acts as a central hub for handling interactions with different historical data frames. It automatically directs requests to the correct frame implementation based on the active method context, essentially figuring out which frame you're working with. 

To improve performance, it keeps a cache of these frame implementations, so it doesn’t have to recreate them every time you need one. This service also implements the `IFrames` interface and manages backtest timeframes, defining the start and end dates for your analysis. 

When running live, there's no frame involved, so the frame name will be empty. 

The `getFrame` method is how you get a ClientFrame instance, and it’s memoized, meaning it caches results for efficiency. The `getTimeframe` method allows you to retrieve the start and end dates associated with a specific symbol and frame, ensuring your backtests are confined to a defined period.

## Class ExchangeValidationService

The ExchangeValidationService helps ensure your trading strategies are compatible with different exchanges. It acts as a central place to register and verify the structure of data coming from various exchanges.

You can think of it like a librarian for exchange data – it keeps track of what formats each exchange uses. 

The service lets you add new exchanges and their associated schemas, and then validates that data from those exchanges conforms to the expected format. You can also retrieve a list of all the exchanges that have been registered with the service. This helps catch errors early and makes sure your backtesting is accurate.

## Class ExchangeSchemaService

This service helps you keep track of different exchange configurations in a safe and organized way. It acts like a central repository for your exchange schemas, ensuring they are consistent and properly structured.

You can add new exchange configurations using the `addExchange` method and retrieve them later by their name. Before a new exchange configuration is added, it's checked to make sure it has all the necessary parts and is set up correctly.

If you need to update an existing exchange configuration, you can do so by providing just the changes you want to make. The service also uses a special tool to keep track of all the exchange configurations, preventing errors and ensuring type safety.

## Class ExchangeGlobalService

This service helps manage interactions with an exchange, providing a central point for fetching data and formatting information. It combines exchange connection details with details about the current trading environment, like the symbol being traded and the timeframe.

The service keeps track of logging and validation activities to help with troubleshooting and ensure configurations are correct. 

You can use it to retrieve historical candle data, and, when in backtest mode, it can also fetch future candle data to simulate trading scenarios. It also offers methods for calculating average prices and formatting prices and quantities, all while taking into account the trading environment.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently routes your requests to the correct exchange implementation based on the current context, making it easy to switch between exchanges without changing your code. 

It keeps track of previously used exchanges to improve performance, avoiding the need to repeatedly create connections. 

You can use it to retrieve historical price data (candles), get the next set of candles to move your backtest or live trading forward, and fetch the current average price. It also handles formatting prices and quantities to ensure they comply with each exchange's specific rules. Essentially, it simplifies the complexities of interacting with various exchanges by providing a unified and efficient interface.

## Class ClientSizing

This class, ClientSizing, helps determine how much of your capital to allocate to a trade. It’s designed to be flexible, allowing you to use different sizing strategies like fixed percentages, Kelly Criterion, or Average True Range (ATR) based calculations.

You can also set limits on the minimum and maximum position sizes, and control the maximum percentage of your capital that can be used for any single trade.  The system allows for callbacks, which lets you add your own custom validation steps or log sizing calculations. 

Essentially, this component helps ensure your trading strategy adheres to your desired risk management rules when deciding how much to buy or sell. The `calculate` method is the core function, taking parameters and returning the calculated position size.

## Class ClientRisk

The ClientRisk class is designed to manage risk at the portfolio level, preventing trading signals from exceeding predefined limits. It acts as a central point for controlling how many positions are open across different strategies and allows for custom risk checks. Multiple trading strategies can share the same ClientRisk instance, enabling a holistic view of risk across your entire portfolio. 

Internally, it keeps track of all active positions and utilizes a single initialization process to ensure accuracy, skipping this step when running backtests. The `checkSignal` function is crucial, evaluating signals based on these risk limits and providing access to position information for custom validation. When a signal is opened or closed, the `addSignal` and `removeSignal` methods are used to update the record of active positions.

## Class ClientFrame

The `ClientFrame` is responsible for creating the timeline of data your backtest will run on. Think of it as the engine that generates the sequence of timestamps representing each moment in your historical data. 

It cleverly avoids repeating its work by caching the generated timelines, making backtesting faster. You can customize the time intervals – from one-minute bars to three-day intervals – to match your data’s granularity.  

The `ClientFrame` also lets you add your own checks and record events as the timeline is built.  It’s a core part of how the backtesting process moves through time, driven by the `BacktestLogicPrivateService`.

The `getTimeframe` function is the key to getting this timeline, producing an array of dates for a specific symbol and using a caching mechanism to keep things efficient.


## Class ClientExchange

This class, `ClientExchange`, handles interactions with an exchange to retrieve data and prepare information for trading. It's designed to be efficient, using prototype functions to conserve memory.

You can use it to fetch historical candle data, looking back from a specific point in time. It also allows you to get future candle data, which is particularly useful during backtesting when you need to simulate trading conditions.

The class can also calculate the VWAP, or Volume Weighted Average Price, based on recent trading activity.  This is helpful for understanding price trends.

Finally, it provides tools to format quantities and prices, ensuring they're compatible with the exchange’s requirements. These formatting functions help prepare your orders correctly.

## Class BacktestUtils

BacktestUtils provides helpful tools to run and analyze backtest simulations within the trading framework. Think of it as your assistant for evaluating trading strategies.

The `run` method is the primary way to execute a backtest, allowing you to easily run simulations for a specific trading symbol and keep track of the results.  If you just want to trigger a backtest without needing the results immediately, the `background` method lets you run it in the background, perfect for things like logging or triggering callbacks.

To get an overview of how a strategy performed, `getData` gathers statistical information about closed signals.  You can also generate a detailed markdown report of a strategy’s performance using `getReport`, and finally, the `dump` function will save this report directly to a file on your system. It’s designed to be a central point for managing backtesting tasks.

## Class BacktestMarkdownService

This service helps you create readable reports about your backtesting results. It keeps track of closed trades for each strategy you're testing, and then organizes that information into nicely formatted markdown tables. These reports are saved as `.md` files in a `logs/backtest` directory, making it easy to review and analyze your strategy’s performance.

The service listens for signals as your backtest runs, specifically focusing on closed trades. You provide it with a `loggerService` for debugging, and it uses a special storage system to keep each strategy’s data separate. 

You can retrieve detailed statistics, generate the complete markdown report, or save the report directly to disk. It’s designed to be straightforward to integrate – you just need to make sure you call the `tick` function from your strategy's `onTick` callback.  The service handles the heavy lifting of report generation and storage, letting you focus on developing and analyzing your trading strategies. The `init` function automatically sets everything up the first time you use it. You can also clear out all accumulated data if you want to start fresh.

## Class BacktestLogicPublicService

The `BacktestLogicPublicService` helps you run backtests in a straightforward way. It handles the behind-the-scenes management of context, like the strategy name, exchange, and frame, so you don't have to pass them around repeatedly. Think of it as a convenient wrapper that simplifies the process.

It uses a `loggerService` and `backtestLogicPrivateService` to work, and its core function is `run`. `run` lets you specify a symbol you want to backtest, and it automatically streams results to you as an asynchronous generator.  You can iterate over these results, and the framework takes care of making sure all the relevant context information is available during the backtest.

## Class BacktestLogicPrivateService

This service handles the behind-the-scenes coordination of backtesting your trading strategies. It works by efficiently processing data in a streaming fashion, meaning it doesn't build up large arrays in memory – ideal for backtesting long periods. 

The process starts by getting the available timeframes, then it goes through each one, simulating the trading environment. When a trading signal tells your strategy to open a position, the service fetches the necessary historical price data (candles) and runs the backtest logic. It then intelligently skips ahead in time until the signal tells the strategy to close the position. 

The backtest results, representing closed trades, are delivered as a stream of data – an asynchronous generator – allowing you to process them one by one. You can even stop the backtest early if needed.

To kick things off, you’ll call the `run` method, specifying the trading symbol you want to backtest. This method sets everything in motion and provides the stream of results. The service relies on other global services for accessing things like logging, strategy data, exchange data, frames and method context.

## Class BacktestCommandService

This service acts as a central hub for launching and managing backtests within the framework. Think of it as a convenient starting point to initiate backtesting processes. 

It bundles together several other services – like those handling logging, schema validation, risk assessment, and the core backtesting logic – making it easy to inject these dependencies and manage them. 

The main function you'll use is `run`, which takes a symbol (like a stock ticker) and some context information (like the strategy, exchange, and frame names) to start a backtest and provide results. This allows you to easily kick off backtesting with the right setup.

# backtest-kit interfaces

## Interface WalkerContract

The `WalkerContract` represents a notification about a strategy's progress during a backtest comparison. Think of it as a checkpoint letting you know when a strategy finishes its evaluation and how it stacks up against the others.

Each notification includes details like the walker’s name, the exchange and frame being used, the symbol being tested, and, crucially, the name of the strategy that just finished running.

You'll also get key performance metrics—like the backtest statistics, a specific metric value used for optimization, and the overall best metric value seen so far.  It keeps track of how many strategies have been tested and the total number that are planned. This information allows you to monitor the comparison process and understand how different strategies are performing relative to each other.

## Interface TickEvent

The TickEvent object holds all the essential details about a trade event, bringing together information from different actions into a single, standardized format. It's designed to make generating reports and analyzing your backtesting results much easier.

You’re going to find key data like the exact time the event occurred (timestamp), the type of action taken (idle, opened, active, or closed), and the trading symbol involved. For trades that are active or have been completed, you're also provided with information about the signal used (signalId, note), the position type, and prices such as the opening price, take profit, and stop loss. Closed trades include additional data about their performance, like the profit and loss percentage (pnl) and the reason for closing, as well as the trade’s duration.

## Interface ScheduleStatistics

This object gives you a breakdown of what's happening with your scheduled trading signals. 

It lets you see every event – when signals were scheduled and when they were cancelled – along with overall counts for all events, just scheduled signals, and cancelled signals. 

You'll also find the cancellation rate, which tells you the percentage of signals that were cancelled, and the average wait time before a signal was cancelled. These numbers are crucial for understanding how reliable your scheduling is and identifying potential issues.

## Interface ScheduledEvent

This interface holds all the key details about scheduled and cancelled trading events, making it easy to generate reports and analyze performance. Each event, whether it was planned or later cancelled, will have a timestamp indicating when it occurred. You'll find the trading symbol, a unique signal ID, and the type of position involved (like long or short). 

The interface also provides information about the intended trade, including the planned entry price, take profit level, and stop-loss price. If an event was cancelled, you'll see the time it was closed and how long it ran. It's a central place to gather all the information you need to understand what happened with each signal.

## Interface ProgressContract

This interface helps you monitor the progress of your backtesting runs. When you're running a backtest in the background, it sends updates about how far along the process is.

Each update includes the name of the exchange and strategy being used, the trading symbol, the total number of historical data points the backtest will cover, how many of those data points have already been processed, and a percentage indicating overall completion. Think of it as a progress bar for your backtesting. 


## Interface PerformanceStatistics

This section describes the `PerformanceStatistics` object, which neatly bundles together all the key data about a trading strategy's performance. It holds the strategy's name, a count of all performance events tracked, and the total time the strategy took to run.  Crucially, it also organizes statistics by metric type within the `metricStats` property, letting you easily analyze different aspects of your strategy’s behavior. Finally, a list of all raw performance events (`events`) is included for detailed inspection if needed.

## Interface PerformanceContract

This interface helps you keep track of how your trading strategies are performing. It captures key data points during execution, like when an operation started and finished, and how long it took. You’re able to see metrics broken down by strategy name, the exchange used, and the symbol being traded. A timestamp is recorded for each event, along with the timestamp of the previous event, which allows you to calculate durations and spot trends. Finally, it indicates whether the metric originates from a backtest or live trading environment.

## Interface MetricStats

This object holds a collection of statistics gathered for a particular metric, like execution time or wait duration. It essentially provides a snapshot of how that metric performed over a series of events. 

You'll find basic counts and totals within, giving you a sense of the volume of data recorded. There are also detailed measurements like average, minimum, and maximum durations, helping you understand the range of values. 

To get a better feel for the distribution, you’re provided with statistics like standard deviation, median, and percentiles (95th and 99th). If the metric represents wait times between events, you're given average, minimum, and maximum wait times as well. Each piece of information contributes to a comprehensive understanding of the metric's behavior.

## Interface LiveStatistics

The `LiveStatistics` interface provides a collection of key performance indicators derived from your live trading activity. It tracks everything from the raw event data to sophisticated risk-adjusted return metrics. You’ll find a detailed history of all trading events in the `eventList`, along with the total number of events processed.  It breaks down wins and losses, calculating the win rate and average PNL to show overall profitability.  More advanced metrics like standard deviation, Sharpe Ratio, and annualized Sharpe Ratio help you understand the volatility and risk-adjusted returns of your strategy.  The certainty ratio and expected yearly returns offer further insight into your strategy’s consistency and potential long-term performance. All numerical values are carefully managed; they're set to null if the calculation might be unreliable due to factors like division by zero or encountering invalid data.

## Interface IWalkerStrategyResult

This interface, `IWalkerStrategyResult`, represents the outcome of running a single trading strategy within a broader comparison. It holds key information about that strategy's performance. You’ll find the strategy's name clearly listed, along with a detailed set of backtest statistics describing how it performed. A calculated metric value, used to compare it against other strategies, is also included, and it will be null if the metric couldn't be computed. Finally, the `rank` property tells you where this strategy stands in the overall ranking, with a rank of 1 being the top performer.

## Interface IWalkerSchema

The IWalkerSchema lets you set up A/B tests comparing different trading strategies. Think of it as a blueprint for your experiment.

You give each test a unique name (walkerName) and can add a note to describe it. 

It specifies which exchange and timeframe (frameName) all the strategies in the test will use. Crucially, you list the names of the strategies you want to compare (strategies).

You choose a metric like Sharpe Ratio (metric) to determine which strategy performs best. Finally, you can include optional callbacks (callbacks) to execute code at certain points during the backtest process.

## Interface IWalkerResults

The `IWalkerResults` object holds all the information gathered after a backtest walker has compared multiple trading strategies. It tells you which strategy was tested, the trading symbol and exchange used, and the timeframe considered. You’ll find details about the optimization metric, the total number of strategies evaluated, and, most importantly, identifies the best-performing strategy. This object also provides the performance score (bestMetric) of that top strategy, along with the full statistics report for it, so you can see exactly how it performed.

## Interface IWalkerCallbacks

This interface lets you hook into the backtest process, allowing you to respond to different stages of the testing cycle. 

You can use `onStrategyStart` to get notified when a new strategy and symbol pairing begins its backtest. 

`onStrategyComplete` fires when a particular strategy's testing is finished, providing you with statistics and a metric value for analysis.

Finally, `onComplete` is triggered when all the backtests are finished, giving you access to the complete set of results. This is helpful for overall summary or post-processing of all tests.

## Interface IStrategyTickResultScheduled

This interface represents a tick result within the backtest-kit framework, specifically when a strategy has generated a scheduled signal. Think of it as a notification that a trade plan is set up and waiting for the market to move in the anticipated direction. It includes details like the strategy’s name, the exchange being used, the symbol being traded (like BTCUSDT), and the current price at the time the signal was scheduled. 

You’ll see the `action` property set to "scheduled" to confirm this type of tick result. Crucially, it also provides access to the `signal` object itself, which contains all the information about the specific trade plan that's been put in place. This helps track the status of scheduled trades and allows for further processing within your backtesting system.


## Interface IStrategyTickResultOpened

This interface describes what happens when a new trading signal is created within your backtesting strategy. It's the information you receive right after a signal has been validated and saved.

You'll get this result when a signal is "opened," providing details such as the strategy's name, the exchange being used, the symbol being traded (like BTCUSDT), and the current price at the time the signal was created. Importantly, it includes the newly generated signal data itself, so you have all the information you need to track and analyze the signal's lifecycle.

## Interface IStrategyTickResultIdle

This interface describes what happens when your trading strategy is in an idle state – meaning it's not currently generating any trading signals. 

It gives you key information about this idle period, including the strategy's name, the exchange being used, and the specific trading symbol involved. You’ll also find the current price at the time of the idle state, helping you track market conditions. The `action` property confirms the state is "idle," and the `signal` property is explicitly set to `null` to indicate there’s no active trading suggestion. Essentially, it's a record of when your strategy isn't actively trading, providing useful context for analysis and debugging.


## Interface IStrategyTickResultClosed

This interface describes the outcome when a trading signal is closed, providing a complete picture of what happened and how it performed. It includes all the key information about the closed signal, like its original parameters and the final price at which it was closed. You'll find details about why the signal closed – whether it was due to a time limit, a take-profit order, or a stop-loss trigger.

Critically, it provides a profit and loss (PNL) calculation, showing the net gain or loss after factoring in fees and slippage. The interface also records the strategy and exchange names, along with the symbol being traded, making it useful for tracking and analysis. Essentially, this provides a final report card for each closed trading signal.


## Interface IStrategyTickResultCancelled

This interface represents a tick result indicating that a scheduled signal was cancelled. Think of it as a notification that a planned trade didn't happen – perhaps the signal never triggered, or it was stopped before a position could be opened.

It includes details about why the signal was cancelled, such as the original signal itself (`signal`), the price at the time of cancellation (`currentPrice`), and when the cancellation occurred (`closeTimestamp`).  You’ll also find information for tracking purposes like the strategy name, the exchange used, and the trading symbol. Essentially, it’s a record of a missed opportunity.

## Interface IStrategyTickResultActive

This interface represents a tick event within a trading strategy where a signal is currently active and being monitored. Think of it as the framework’s way of saying, "Hey, we're watching this signal closely!" 

It contains information about the signal itself, the current price being used for monitoring (typically VWAP), and details like the strategy’s name, the exchange being used, and the trading symbol.  Essentially, it’s a snapshot of the state while the strategy is waiting for a specific event like a take-profit, stop-loss, or time expiration related to that signal. The `action` property confirms that the signal is indeed "active" in this state.

## Interface IStrategySchema

This interface, `IStrategySchema`, is how you tell backtest-kit about your trading strategy. It essentially describes how your strategy generates buy and sell signals. 

You’re required to give each strategy a unique `strategyName` so the system knows which strategy is which. You can also add a `note` for yourself or anyone else using the strategy—it's purely for documentation purposes.

The `interval` property controls how often your strategy can generate signals, acting as a throttling mechanism. 

The heart of the schema is the `getSignal` function. This is where your trading logic lives; it takes a symbol (like 'BTCUSDT') and returns a signal, or `null` if no signal is present. You can even use priceOpen to build scheduled signals.

You can also hook into key moments in your strategy's lifecycle using optional `callbacks` for things like when a position is opened or closed.

Finally, the `riskName` allows you to categorize your strategy for risk management purposes.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, neatly packages the results of a trading strategy's performance. It gives you a clear picture of how much your strategy gained or lost, presented both as a percentage and as the actual entry and exit prices used in the calculations. The prices you see have already been adjusted to account for typical trading costs like fees and slippage, so you're getting a more realistic view of your strategy's profitability. You can use `pnlPercentage` to quickly gauge the overall success, while `priceOpen` and `priceClose` provide the specific prices used for those trades.

## Interface IStrategyCallbacks

This interface provides a way to hook into the key events of your trading strategy within the backtest-kit framework. Think of these callbacks as notification points that let your code react to what's happening in the simulation.

You can listen for every tick of the market with the `onTick` callback, receiving the symbol and tick result.  Specific events like opening a new signal (`onOpen`), the signal being actively monitored (`onActive`), or entering an idle state (`onIdle`) also trigger callbacks.

When a signal is closed, `onClose` provides the final closing price. If you're using scheduled signals for delayed entries, `onSchedule` lets you react to their creation, and `onCancel` handles situations where a scheduled signal is cancelled. Finally, `onWrite` is called when data is written for persistence during testing. Each callback gives you the relevant data to respond and potentially adapt your strategy based on these lifecycle events.

## Interface IStrategy

The `IStrategy` interface outlines the fundamental methods a trading strategy utilizes within the backtest-kit framework.  At its core, `tick` represents a single step in the strategy's execution, handling things like VWAP calculations and checking for potential trading signals, while ensuring these checks are managed efficiently. The `backtest` function allows for quick historical simulations using candle data, enabling you to assess how your strategy would have performed in the past by looping through historical data and evaluating it. Lastly, `stop` provides a way to pause signal generation, useful for safely shutting down a live strategy without immediately closing any existing trades.

## Interface ISizingSchemaKelly

This interface defines how to size your trades using the Kelly Criterion, a popular method for maximizing growth. It's particularly useful if you're building a trading strategy and want to systematically manage your bet sizes based on your expected returns.

When implementing this schema, you’re essentially specifying that your sizing strategy will use the Kelly Criterion formula. The `kellyMultiplier` property determines how aggressively you're applying the criterion – a lower multiplier (like the default 0.25) is more conservative, while a higher one risks more capital per trade. Think of it as controlling how much of your capital you're willing to risk on each trade based on the strategy's predicted edge.

## Interface ISizingSchemaFixedPercentage

This schema defines a simple way to size your trades by using a fixed percentage of your capital for each position. It's great when you want to consistently risk a specific portion of your funds on every trade. The `method` property is always set to "fixed-percentage" to identify this sizing strategy.  The `riskPercentage` property specifies the percentage of your capital you're willing to risk; for example, a value of 1 would mean risking 1% of your capital on each trade.

## Interface ISizingSchemaBase

This interface, ISizingSchemaBase, defines the fundamental structure for sizing configurations within the backtest-kit framework. Think of it as a blueprint for how much of your account you're willing to risk on a trade. 

It includes key properties like `sizingName`, a unique identifier for easy recognition, and a `note` field for developers to add helpful explanations. You’ll also find settings for controlling position size: `maxPositionPercentage` limits risk as a percentage of your account, while `minPositionSize` and `maxPositionSize` set absolute limits on the number of units you'll trade. Finally, `callbacks` provide a way to customize the sizing process with optional lifecycle functions.


## Interface ISizingSchemaATR

This schema defines how to size your trades using the Average True Range (ATR). It’s all about letting the volatility of the market, as measured by the ATR, dictate your position sizes.

You'll specify a `riskPercentage` which represents the maximum percentage of your account you’re willing to risk on each trade. The `atrMultiplier` then determines how far your stop-loss will be placed based on the ATR value – a higher multiplier means a wider stop. 

Essentially, this approach automatically adjusts your trade size to account for market volatility, helping to manage risk effectively.

## Interface ISizingParamsKelly

This interface defines the settings you can use when determining how much to trade using the Kelly Criterion method. It's specifically used when setting up the sizing parameters for your trading strategies. 

You’re required to provide a logger, which allows you to see helpful debugging messages related to the sizing calculations – very useful for understanding how much your strategy is planning to trade. Think of it as a way to peek into the sizing process and make sure everything is working as expected.

## Interface ISizingParamsFixedPercentage

This interface, `ISizingParamsFixedPercentage`, helps you define how much of your capital you want to use for each trade when using a fixed percentage sizing strategy.  It's part of the backtest-kit framework and specifically used when creating a `ClientSizing` object. You'll need to provide a `logger` – this is a service that allows you to output debugging information and track what's happening behind the scenes as your backtest runs. Think of it as a way to see how your sizing strategy is working.

## Interface ISizingParamsATR

This interface, `ISizingParamsATR`, defines the settings you’re going to use when determining how much of an asset to trade based on the Average True Range (ATR). It’s part of the backtest-kit framework and helps you control your trading strategy's sizing. The `logger` property is particularly useful - it's a tool for providing debugging information so you can understand how your sizing calculations are working. Think of it as a way to monitor and troubleshoot your trading decisions.

## Interface ISizingCallbacks

This interface, `ISizingCallbacks`, provides a way to hook into the position sizing process within the backtest kit. It lets you react to events that happen during size calculation, giving you opportunities to observe what’s happening or check that the results are reasonable. Specifically, the `onCalculate` property is a function that gets called right after the system determines how much to trade. You can use this to log the calculated quantity, examine the parameters used in the calculation, or perform validation checks on the size before it’s used to execute trades.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate trade sizes using the Kelly Criterion. 

Essentially, you provide the win rate – representing the percentage of winning trades – and the average win-loss ratio, which tells you how much you win on average for each winning trade compared to how much you lose on a losing one. These two values work together to determine the optimal amount of capital to allocate to each trade to maximize long-term growth. You’re telling the system what your historical performance looks like so it can help you decide how much to risk.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate trade size using a fixed percentage of your capital. It's simple: you specify the `method` as "fixed-percentage" to indicate you're using this sizing strategy, and then provide a `priceStopLoss` value, representing the price at which you’d place a stop-loss order. Think of it as telling the backtest kit, "I want to risk this percentage of my capital, and I’m using this price for my stop-loss."

## Interface ISizingCalculateParamsBase

This interface defines the fundamental information needed for calculating how much of an asset to trade. It includes the trading symbol, like "BTCUSDT", which identifies the asset pair. You're also given access to the current account balance, which dictates the maximum possible trade size. Finally, it provides the planned entry price, crucial for determining the cost of the trade. This base interface ensures all sizing calculations have access to these essential data points.

## Interface ISizingCalculateParamsATR

This interface defines the information needed when you're calculating trade sizes using the Average True Range (ATR) method. Essentially, you’re telling the backtest kit that you want to size your trades based on the ATR. You’ll need to provide the `method`, which must be "atr-based", and the current `atr` value itself—this number represents the current volatility as measured by the ATR.

## Interface ISizing

The `ISizing` interface defines how a trading strategy determines how much of an asset to buy or sell. It’s a crucial piece of the backtest-kit framework, responsible for translating your risk preferences and account details into concrete position sizes.

The core of this interface is the `calculate` function. This function takes a set of parameters describing the current market conditions, your risk tolerance, and your account balance, and then returns a promise that resolves to the calculated position size. Think of it as the engine that converts abstract risk goals into a specific number of shares or contracts.

## Interface ISignalRow

The `ISignalRow` interface represents a finalized signal ready for use in backtesting and trading. Think of it as a complete signal package, automatically assigned a unique ID. It contains all the necessary information to execute a trade, including the entry price, the exchange to use, the strategy that generated it, and timestamps indicating when it was created and went pending. The `symbol` property tells you which trading pair is involved (like BTCUSDT). There’s also an internal flag, `_isScheduled`, used by the system to track signals that have been scheduled.

## Interface ISignalDto

The `ISignalDto` represents the data used to define a trading signal. Think of it as a blueprint for telling the backtest-kit exactly what trade to execute. 

It includes basic information like the trade direction – whether you're going long (buying) or short (selling). You’re also expected to provide a description of why you're making the trade.

Crucially, it specifies the entry price, the price you're aiming to take profit at, and the stop-loss price to limit potential losses. The framework checks to make sure the take profit and stop loss prices make sense based on the trade direction.

Finally, `minuteEstimatedTime` indicates how long you anticipate the trade will last before it expires. The framework will automatically assign a unique ID if one isn't provided.

## Interface IScheduledSignalRow

This interface, `IScheduledSignalRow`, represents a trading signal that's waiting for a specific price to be reached before it's executed. Think of it as a signal on hold – it's not acted upon immediately.

It builds upon the `ISignalRow` interface and is designed for delayed entries. The signal remains in this "scheduled" state until the market price reaches the `priceOpen` value you're targeting.

At that point, it transforms into a standard pending signal.  A key characteristic is the `pendingAt` property, which initially reflects the time the signal was scheduled, and then gets updated to the actual time it began waiting.

The `priceOpen` property defines the target price that triggers the signal's activation.


## Interface IRiskValidationPayload

This data structure holds information used when evaluating risk. It combines the arguments you provide with details about your current portfolio. Specifically, it tells you how many positions are currently open and provides a list of those active positions, detailing each one. This lets your risk validation functions understand the state of your trades before making decisions.

## Interface IRiskValidationFn

This type defines a function used for validating risk-related parameters within the backtest-kit framework. Think of it as a gatekeeper ensuring your risk settings are reasonable before a trading simulation begins. The function takes risk parameters as input and its job is to check if those parameters meet your desired criteria. If something's off – maybe a position size is too large or a drawdown limit is too strict – the function should throw an error to stop the backtest and alert you to the problem. Essentially, it’s a way to build in checks and balances to maintain the integrity of your backtesting process.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define rules to check if your trading strategies are behaving responsibly. Think of it as setting up guardrails for your backtesting. 

It has two main parts: `validate` and `note`. 

The `validate` property holds the actual logic – a function – that performs the risk check.  It receives the risk parameters and should return a boolean indicating whether the check passed.

The `note` property is optional; it's a simple text description that explains what the validation is designed to do, making your code easier to understand and maintain.

## Interface IRiskSchema

This interface, `IRiskSchema`, lets you define and manage risk controls for your backtesting strategies. Think of it as a blueprint for how your portfolio will handle risk – it’s how you tell the system what constraints to apply.

Each `IRiskSchema` has a unique `riskName` so you can easily identify it. You can also add a `note` to explain what the risk profile does for future developers.

You can optionally specify `callbacks` to react to specific events, like when a trade is rejected or allowed.

The core of the schema lies in the `validations` array.  This is where you define the actual rules and checks that will be applied to your trades – custom logic to keep your portfolio behaving as expected. It’s a list of functions or pre-defined validation objects that enforce your risk management rules.

## Interface IRiskParams

The `IRiskParams` interface defines the information needed when setting up the risk management component of your backtesting system. Think of it as the configuration for how your system will handle risk.

It primarily focuses on providing a way to log important events and debug information, utilizing a `logger` property that should be an `ILogger` object. This helps you keep track of what's happening during your backtesting process and troubleshoot any issues.

## Interface IRiskCheckArgs

The `IRiskCheckArgs` interface holds the information needed to decide whether a new trade should be allowed. Think of it as a gatekeeper – it’s used *before* a trading signal is even generated to make sure conditions are suitable for opening a position. It bundles essential details like the trading pair's symbol ("BTCUSDT" for example), the name of the strategy wanting to trade, the exchange being used, the current price of the asset, and the current time. Essentially, it's a collection of data pulled directly from the client strategy context to inform a risk assessment.

## Interface IRiskCallbacks

This interface lets you define functions that your backtest kit trading framework will call when it detects specific risk-related events. Think of it as a way to get notified about what's happening with your risk management. 

You can provide an `onRejected` callback, which will be triggered when a trading signal fails a risk check – essentially, the framework is telling you something could be risky. 

Alternatively, the `onAllowed` callback lets you celebrate when a signal successfully passes all your risk checks, confirming it’s safe to proceed. These callbacks give you a way to observe and potentially react to your risk assessment process in real time.

## Interface IRiskActivePosition

This interface describes a single, active trading position that's being monitored for risk management across different trading strategies. Think of it as a snapshot of a position—it tells you which strategy created it, which exchange it's on, and when it was opened.  The `signal` property holds the specifics of the signal that triggered the trade. It’s designed to provide a clear view of each position's origin and timeline for comprehensive risk analysis.

## Interface IRisk

The `IRisk` interface helps manage and control the risk involved in your trading strategies. Think of it as a gatekeeper, ensuring your signals don't violate any predefined risk boundaries.

It allows you to check if a potential trading signal is permissible given your risk limits using the `checkSignal` function. This function takes parameters defining the signal and evaluates it against your established risk rules.

You also have functions to keep track of open and closed positions. `addSignal` lets you register when a new position is opened, while `removeSignal` handles when a position is closed, maintaining an accurate picture of your exposure. These functions record details like the symbol traded, the strategy name, and a risk identifier.

## Interface IPositionSizeKellyParams

The `IPositionSizeKellyParams` interface helps you calculate position sizes using the Kelly Criterion, a strategy for maximizing growth rate. It defines the necessary inputs for this calculation. You'll need to provide the `winRate`, which represents the probability of winning a trade as a number between 0 and 1. Also, you’ll specify the `winLossRatio`, reflecting the average profit you make on winning trades compared to the average loss on losing trades. These two values together allow the framework to determine an appropriate size for your trades based on the Kelly Criterion.

## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed to calculate position sizes using a fixed percentage of your account balance. It's all about consistently risking a set portion of your funds with each trade. 

The key piece of information you'll provide is the `priceStopLoss`, which represents the price level where you'll place a stop-loss order to limit potential losses. This value helps determine the size of the position you'll take.

## Interface IPositionSizeATRParams

This interface defines the parameters needed to calculate your position size using an ATR (Average True Range) method. It's all about figuring out how much to trade based on the volatility indicated by the ATR. The `atr` property simply represents the current ATR value, which is a key piece of information in this calculation. Think of it as the market's recent average price fluctuation – the higher the ATR, the wider your potential trade size might be.

## Interface IPersistBase

This interface provides the fundamental building blocks for saving and retrieving data within the backtest-kit framework. Think of it as the core layer for interacting with your data storage, whether that's a file system or a database. 

The `waitForInit` method helps ensure everything is set up correctly the first time, preparing the storage area and checking for any existing data issues. `readValue` lets you fetch a specific piece of data, identified by its unique ID. Before you try to read something, `hasValue` is useful for quickly checking if the data actually exists. Finally, `writeValue` is the method to use when you need to save data, ensuring the writing process is handled reliably.

## Interface IMethodContext

The `IMethodContext` interface provides essential information for backtest-kit to function correctly. Think of it as a little package that travels around, telling the system which specific configurations – like your exchange, strategy, and frame – it should be using.  It holds the names of these configurations: `exchangeName`, `strategyName`, and `frameName`.  If you're running a live trade, the `frameName` will be empty, otherwise it specifies the frame to use. This context helps ensure that the right components work together seamlessly during your backtesting or live trading.

## Interface ILogger

The `ILogger` interface provides a way for different parts of the backtest-kit framework to record information about what’s happening. Think of it as a central place to leave notes about the system’s activities – everything from initialization to errors.

You can use the `log` method for general events, `debug` for detailed troubleshooting information (like what's happening internally during tool calls), `info` for routine confirmations like successful actions or validations, and `warn` to flag potential issues that might need to be investigated. Each method helps track different levels of detail, making it easier to understand and debug the trading system's behavior.

## Interface IHeatmapStatistics

This structure holds the overall performance metrics for your portfolio's heatmap. It provides a quick summary of how all your assets are performing together.

You'll find details like the number of symbols you're tracking, the total profit or loss across the whole portfolio, and key performance indicators like the Sharpe Ratio. It also includes the total number of trades executed across all symbols. The `symbols` property breaks down the individual performance of each asset within your portfolio.

## Interface IHeatmapRow

This interface represents a row of data in a portfolio heatmap, providing a snapshot of performance for a specific trading pair like BTCUSDT. It bundles key statistics across all strategies used for that symbol, giving you a clear picture of how it's been performing.

You'll find metrics here like total profit or loss percentage, the Sharpe Ratio which assesses risk-adjusted returns, and the maximum drawdown, indicating the largest decline experienced.  It also details the number of trades, broken down by wins and losses, along with the win rate and average profit/loss per trade.

Other important figures include standard deviation of profits, profit factor, and streaks of wins or losses. Finally, expectancy provides an estimate of long-term profitability based on win/loss data.


## Interface IFrameSchema

The `IFrameSchema` defines the structure for how backtest-kit organizes and generates data for your trading simulations. Think of it as the blueprint for a specific time period and frequency of data.  Each schema has a unique name to identify it, and you can add a note to explain its purpose. 

Crucially, it specifies the `interval` – like daily, hourly, or minute-by-minute – that determines how frequently timestamps are generated during the backtest. It also sets the `startDate` and `endDate` to clearly outline the backtest’s timeframe. Finally, you can add optional callbacks to hook into key moments in the frame’s lifecycle.

## Interface IFrameParams

The `IFrameParams` interface defines the information needed to set up a trading frame within the backtest-kit framework. Think of it as the configuration that tells the frame how to operate. It builds upon the `IFrameSchema`, adding a crucial element: a `logger`. 

The `logger` property is a key part, providing a way to track what's happening inside the frame – essentially, it’s a tool for debugging and understanding the frame's behavior. You’re expected to provide an instance of an `ILogger` when creating a `ClientFrame`.

## Interface IFrameCallbacks

This section describes the `IFrameCallbacks` interface, which provides a way for you to react to events happening during the creation of timeframes within the backtest-kit framework. It allows you to tap into the process of generating those timeframe arrays, letting you inspect them or perform actions based on the start and end dates, as well as the interval used. Specifically, the `onTimeframe` property lets you define a function that gets called immediately after a set of timeframes is generated; you might use this for verifying the timeframe creation or simply logging the timeframe data.

## Interface IFrame

The `IFrames` interface helps manage and generate the timeframes your backtest will use. Think of it as the tool that provides the sequence of dates your trading strategy will evaluate. 

The core function, `getTimeframe`, is what actually creates these date sequences. You give it a symbol (like "BTCUSDT") and a name for the timeframe (like "1h" for hourly data), and it returns an array of timestamps representing that timeframe. These timestamps are carefully spaced to match the interval you’ve chosen for your backtest.

## Interface IExecutionContext

The `IExecutionContext` interface provides essential information about the environment your trading strategy is running in. Think of it as a package of details passed along to give your code context. It tells you which trading pair – like BTCUSDT – is being analyzed, what the current timestamp is, and crucially, whether you're running a backtest or trading live. This context is automatically provided to functions like getting historical data or handling price updates, so you don't have to explicitly manage these details yourself. It simplifies the process of adapting your code between testing and real-world trading scenarios.


## Interface IExchangeSchema

The `IExchangeSchema` acts as a blueprint for connecting to different trading venues within backtest-kit. Think of it as defining how the framework talks to a specific exchange like Binance or Coinbase. 

You provide an `exchangeName` – a unique identifier for your connection – and can add a helpful `note` for your own documentation.

The crucial part is `getCandles`, which tells backtest-kit exactly how to retrieve historical price data for a given trading pair and time range.  It’s the function that fetches the candles.

`formatQuantity` and `formatPrice` are important for ensuring your orders are correctly formatted to meet the exchange’s requirements – handling things like decimal places. 

Finally, `callbacks` lets you hook into certain events, like when new candle data arrives. This allows you to react to changes and potentially adjust your strategy.

## Interface IExchangeParams

The `IExchangeParams` interface helps you set up your exchange connection within the backtest-kit framework. It's the information you provide when creating an exchange object. 

You're expected to supply a `logger` to help track what's happening during your backtesting – useful for debugging and understanding the process. 

Also, it needs an `execution` object, which holds important details about the testing environment, like the symbol being traded, the time period, and whether the test is a backtest or a live execution. This context helps the exchange function correctly within the backtest-kit system.

## Interface IExchangeCallbacks

The `IExchangeCallbacks` interface lets you define functions that your backtesting system can call when it receives data from an exchange. Think of it as a way to react to new information as it arrives.

Specifically, the `onCandleData` function is triggered whenever the backtest kit retrieves candlestick data. You're given the symbol (like "BTCUSDT"), the time interval (like 1-minute or 1-day), a timestamp indicating when the data was fetched, how many data points were requested, and the actual array of candlestick data. This allows you to perform custom actions based on the received data, like updating visualizations or logging events.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with a simulated or real cryptocurrency exchange. It lets you retrieve historical and future price data, which is crucial for testing trading strategies. You can request candles (price bars) for a specific cryptocurrency and time interval, going back in time or looking ahead for backtesting purposes.

This interface also provides tools to properly format trade quantities and prices according to the exchange’s specific rules. Lastly, it calculates the Volume Weighted Average Price (VWAP) – a commonly used indicator – based on recent trading activity, which can be useful for assessing market trends.

## Interface IEntity

This interface, `IEntity`, serves as the foundation for any data that your backtest kit framework stores persistently. Think of it as the common blueprint for things like trades, orders, or accounts – anything that needs to be saved and retrieved later. It establishes a basic structure that all persistent objects will adhere to, ensuring consistency across your data models.

## Interface ICandleData

This interface describes a single candlestick, which is a standard way to represent price data over a specific time interval. Each candlestick contains information about the opening price, the highest price, the lowest price, the closing price, and the volume traded during that period. The `timestamp` tells you exactly when the candle began, measured in milliseconds since the Unix epoch. This data is the foundation for many trading strategies and calculations within the backtest-kit framework, particularly useful for things like calculating the volume-weighted average price.

## Interface DoneContract

This interface represents the information provided when a background task, whether it’s a backtest or a live trade execution, finishes running. 

It contains key details about what just happened, like the name of the exchange used, the strategy that ran, and whether it was a backtest or a real-time operation. You’ll also find the trading symbol involved, which clarifies the specific asset being traded. Think of it as a notification package letting you know a background process has concluded and providing context about that process.

## Interface BacktestStatistics

The `BacktestStatistics` interface holds all the key performance numbers calculated after a backtest run. It gives you a detailed view of how your trading strategy performed. 

You’ll find information like the total number of trades executed, how many were winners and losers, and the overall win rate.  The interface also includes metrics to assess profitability, such as average P&L per trade and total cumulative P&L. 

To understand the risk involved, you can look at volatility through standard deviation and the Sharpe Ratio, both adjusted for annualization. A new metric, Certainty Ratio, helps gauge the consistency of winning versus losing trades. Finally, `expectedYearlyReturns` estimates potential yearly gains based on trade characteristics. Note that any calculation that could lead to unreliable numbers like dividing by zero will be represented as null.
