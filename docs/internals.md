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

You can now customize how backtest-kit reports information during backtesting. The `setLogger` function lets you provide your own logging system. This is useful if you want to send logs to a specific file, database, or monitoring service. When you set a logger, all the internal components of backtest-kit will use it to display messages, and they'll automatically include helpful details like the strategy name, exchange used, and the specific asset being traded.

To use it, simply pass in an object that follows the `ILogger` interface.

## Function listWalkers

This function lets you see all the different trading strategies (walkers) that are currently set up in your backtest environment. It provides a list of their configurations, which can be helpful if you're trying to understand what's going on, create documentation, or build tools to manage your strategies. Think of it as a way to peek behind the curtain and see the blueprints of all your active trading approaches. It returns a promise that resolves to an array containing details about each registered walker.

## Function listStrategies

This function gives you a way to see all the trading strategies that backtest-kit knows about. It returns a list of strategy descriptions, which you can use to understand what strategies are available, check for errors in your setup, or even build a user interface that lets someone choose a strategy to run. Think of it as a way to peek under the hood and see the strategies at your disposal.

## Function listSizings

This function lets you see all the sizing configurations currently set up in your backtest kit. Think of it as a way to peek under the hood and understand how your trades are being sized. It gathers all the sizing rules you've added and presents them in a structured list, which is helpful for verifying your setup or creating tools to manage sizing strategies. You can use this information to build displays that show your sizing rules, or to check that your rules are being applied as intended.

## Function listRisks

This function lets you see a complete list of the risk configurations your backtest kit is using. Think of it as a way to peek under the hood and understand how your trading strategy is being protected. It returns a promise that resolves to an array of risk schemas, giving you details about each risk profile. This is handy for checking if your risk settings are correct, creating helpful documentation, or building interfaces that adapt to different risk setups.

## Function listFrames

This function lets you see all the different "frames" that your backtest kit is using. Think of frames as different perspectives or data sets you're looking at when analyzing your trades. It returns a list describing each frame, allowing you to understand what data is available and how it's structured. This is particularly helpful if you’re troubleshooting, creating documentation, or building a user interface that needs to display frame information.

## Function listExchanges

This function allows you to see a complete list of the exchanges that your backtest-kit framework is currently configured to use. Think of it as a way to check what trading venues your system knows about. It's incredibly helpful when you're setting things up, need to understand the available data sources, or want to build tools that interact with these exchanges. The result is a simple list of exchange definitions that you can then use in your code.

## Function listenWalkerOnce

This function lets you set up a temporary listener for walker events. You provide a filter – a rule to identify the specific events you're interested in – and a callback function that will be executed only once when a matching event occurs. After that single execution, the listener automatically disappears, making it great for situations where you need to react to a particular walker condition just once and then move on. It simplifies waiting for specific events without cluttering your code with ongoing subscriptions.


## Function listenWalkerComplete

This function lets you be notified when the backtest process finishes running all your strategies. It's like setting up a listener that gets triggered once the entire backtesting journey is complete. The information about the results of the backtest will be passed to your provided function. To ensure things don't get chaotic, your callback function will be executed one after another, even if it involves some asynchronous operations. This guarantees that the results are handled in the order they were generated.


## Function listenWalker

This function lets you keep an eye on how your backtest is progressing. It provides updates after each strategy finishes running within a Walker. You'll receive these updates as `WalkerContract` events. The system makes sure these updates are handled one at a time, even if your handling function takes some time to complete, ensuring everything stays in order. To use it, simply provide a function that will be called with each progress event. This function will then be returned so you can unsubscribe.

## Function listenValidation

This function lets you keep an eye on any problems that pop up during the risk validation process, like when checking signals. It's a way to catch errors and get notified about them as they happen. 

Whenever a validation check fails and throws an error, this function will call the callback you provide.  The errors are handled one at a time, even if your callback uses asynchronous operations.  Essentially, it’s a simple way to debug and monitor the health of your risk validation routines. 

You provide a function as input—that's the function that will be called when a validation error occurs. The function receives an `Error` object as an argument, providing details about the failure.

## Function listenSignalOnce

This function lets you set up a listener that reacts to specific trading signals, but only once. Think of it as a temporary alert – it waits for a condition you define, triggers a function when that condition is met, and then stops listening. It's handy when you need to perform an action based on a single, unique signal event. You provide a filter to identify the signals you're interested in, and a function to execute when the filter matches. After that one execution, the listener automatically stops itself.

## Function listenSignalLiveOnce

This function lets you temporarily listen for specific trading signals coming from a live simulation. Think of it as setting up a short-term alert. 

You provide a filter – essentially, a rule – to determine which signals you’re interested in.  Then, you give it a function that will execute once when a matching signal arrives.  After that single execution, the function automatically stops listening, so you don't have to worry about manually unsubscribing. It's perfect for quickly reacting to a particular signal during a live backtest.


## Function listenSignalLive

This function lets you hook into the live trading signals generated by backtest-kit. Think of it as setting up a listener that gets notified whenever a signal is produced during a live run. The signals are delivered one at a time, ensuring they are processed in the exact order they occur. You provide a function that will be called for each signal, and this function receives information about the signal as a `IStrategyTickResult`. When you're done listening, the function returns another function you can call to unsubscribe and stop receiving signals. It’s specifically designed for use with `Live.run()`.

## Function listenSignalBacktestOnce

This function lets you set up a listener that reacts to specific signals generated during a backtest. Think of it as a temporary alert system. You tell it what kind of signal you're interested in – like a buy or sell – using a filter, and then provide a function that will run exactly once when that signal occurs.  Once the function runs, the listener automatically stops listening, so you don't have to worry about cleaning up. It’s designed for actions you only need to perform once during a backtest run. You only receive events coming from `Backtest.run()`.


## Function listenSignalBacktest

This function lets you tap into the backtest process and react to the signals generated during a backtest run. Think of it as setting up a listener that gets notified whenever a signal is produced. Importantly, these signals only come from the `Backtest.run()` execution.

The listener function you provide (`fn`) will be called with an `IStrategyTickResult` object, which contains the information about the signal. Because the processing is queued, signals are handled one after another in the order they're received, allowing for predictable and sequential reactions to the backtest data. To stop listening, the function returns another function which can be called to unsubscribe.

## Function listenSignal

This function lets you hook into the trading signals generated by backtest-kit. Think of it as setting up a listener that gets notified whenever a strategy changes state – whether it’s going idle, opening a position, actively trading, or closing one. 

The cool thing is that it handles these notifications in a controlled way; even if your callback function takes time to process (like if it’s performing some asynchronous operation), the framework makes sure signals are handled one at a time, in the order they arrive, preventing any unexpected issues from multiple signals firing at once.

You provide a function as input, and this function will be called with the relevant signal data whenever an event occurs. The function you provide will also return a function that you can use to unsubscribe from the signals.

## Function listenProgress

This function lets you keep an eye on how your backtest is running. It provides updates as your backtest performs background tasks, letting you track its progress step by step. Importantly, these progress updates are delivered in the order they happen, and even if your callback function takes some time to process, everything will be handled one after another. Think of it as a way to get a continuous stream of information about what's happening behind the scenes during your backtest. You simply provide a function that will be called with progress information, and this function will manage the delivery of those updates.


## Function listenPerformance

This function lets you keep an eye on how your trading strategies are performing in terms of speed and efficiency. It's like setting up a listener that gets notified whenever a performance metric changes during your strategy's run. You provide a function that will be called with these performance updates, and this allows you to pinpoint any slow operations or areas where your code could be optimized. Importantly, the updates are processed one at a time, even if your callback function itself takes some time to complete, ensuring everything stays in the correct order. This is a handy tool for diagnosing performance issues and improving your strategy's responsiveness.

## Function listenError

This function allows you to be notified whenever an error occurs during background tasks within your backtesting or live trading environment. It’s like setting up an error log specifically for operations running in the background, ensuring you don't miss any issues happening outside of your main code flow. When an error pops up in a background process, this function will call your provided callback. Importantly, even if your callback involves asynchronous operations, the errors are handled one at a time, in the order they occur, to prevent any unexpected interference. You can think of it as a reliable way to keep track of any problems happening behind the scenes. 

The function returns a function that you can call later to unsubscribe from these error notifications.


## Function listenDoneWalkerOnce

This function lets you react to when a background task within a trading strategy finishes, but only once. You provide a filter to specify which finishing events you're interested in, and a callback function that will be executed when a matching event occurs. After the callback runs once, the subscription automatically stops, so you don’t have to worry about managing it yourself. It’s a convenient way to respond to specific background task completions and then move on. 

The `filterFn` determines which events trigger the callback, acting like a gatekeeper for the event stream. The `fn` is what gets called to handle the event that passes the filter.

## Function listenDoneWalker

This function lets you monitor when background tasks within the backtest-kit framework finish running. Think of it as setting up a listener that gets notified when a process completes. The listener will be triggered when a `Walker.background()` operation is done. Importantly, the notifications happen one at a time, even if the function you provide to handle the completion takes some time to run – this ensures a predictable order of events. To use it, you provide a function that will be executed when the background task is complete. The function you provide will be called with a `DoneContract` object containing details about the finished task. When you no longer need to listen for these completion events, you can use the function returned by `listenDoneWalker` to unsubscribe.

## Function listenDoneLiveOnce

This function lets you react to when a background task within a live trading session finishes, but only once. You can specify a filter to only trigger the reaction when certain conditions are met. Once the filter matches and the background task is complete, the provided function will execute, and the subscription will automatically stop listening for further events. It’s a convenient way to handle a single, specific completion event without needing to manually unsubscribe.

## Function listenDoneLive

This function lets you keep track of when background tasks run by the Live system are finished. Think of it as setting up a listener that gets notified when a task is done. Importantly, the notifications are handled one at a time, even if the function you provide to handle them takes some time to complete – this ensures things don't get out of order. You give it a function to execute when a task finishes, and it returns another function that you can call to unsubscribe from these completion notifications later.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but only once. It’s useful if you need to perform a single action after a backtest completes, such as updating a UI or saving results. 

You provide a filter – a function that decides which backtest completions you’re interested in.  Then, you give it a callback function, which will be executed just one time when a matching backtest finishes. After that callback runs, the subscription automatically stops, so you don't need to worry about cleaning it up. It’s a clean and simple way to handle one-off backtest completion actions.


## Function listenDoneBacktest

This function lets you be notified when a background backtest finishes running. It's a way to react to the completion of a backtest process without blocking the main program. The notification happens when the `Backtest.background()` function is done. The order of completion events is preserved, and even if your notification function does something that takes time (like an asynchronous operation), it will be handled one at a time, ensuring things happen in the right sequence. You provide a function that will be called when the backtest is complete, and this function returns another function that you can call to unsubscribe from the notifications.

## Function getMode

This function tells you whether the backtest-kit is currently running a backtest or operating in live trading mode. It's a simple way to check the context of your code – are you analyzing historical data or actively making trades? The function returns a promise that resolves to either "backtest" or "live," providing a clear indication of the current operating environment. Use this to adjust your logic based on the execution mode.

## Function getDate

This function, `getDate`, simply retrieves the current date. When you're running a backtest, it gives you the date associated with the timeframe you're analyzing. If you're running in live mode, it returns the actual, current date and time. It's a handy way to know what date you're working with during your trading simulations or live executions.

## Function getCandles

This function lets you retrieve historical price data, specifically candlesticks, for a particular trading pair. Think of it as pulling up charts for a specific cryptocurrency or asset.

You specify the symbol, like "BTCUSDT" for Bitcoin against USDT, the time interval for the candles (e.g., "1m" for one-minute candles, "1h" for one-hour candles), and how many candles you want to see. 

The function then reaches out to the connected exchange to fetch that historical data and returns it to you as a list of candle data points. It’s a core way to access the price history needed for backtesting and strategy development.


## Function getAveragePrice

This function helps you find the Volume Weighted Average Price, or VWAP, for a specific trading pair like BTCUSDT. It looks at the last five minutes of trading data to figure this out.

The calculation involves finding the typical price for each minute (based on high, low, and closing prices) and then weighting those prices by the volume traded.

If there's no trading volume available, it will instead give you the simple average of the closing prices. 

You just need to provide the symbol of the trading pair you're interested in to get the VWAP.

## Function formatQuantity

This function helps you prepare the right amount of a cryptocurrency or asset for a trade, ensuring it conforms to the specific rules of the exchange you’re using. It takes the trading pair symbol – like "BTCUSDT" – and the raw quantity you want to trade. The function then automatically handles the correct number of decimal places needed for that particular pair, so you don’t have to worry about manual calculations. It returns a formatted string ready for use in your trading orders.

## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes a symbol like "BTCUSDT" and a raw price number, then uses the exchange's specific rules to format the price into a human-readable string. This ensures the displayed price has the right number of decimal places, as dictated by the exchange you're using, making your output look professional and accurate. Essentially, it handles the tricky part of formatting prices according to each exchange's standards.

## Function addWalker

The `addWalker` function lets you register a custom walker, which is essentially a tool for comparing how different trading strategies perform against each other. Think of it as setting up a system that runs backtests for several strategies simultaneously, using the same historical data. This allows for a direct comparison of their performance based on a metric you define. You provide a configuration object, the `walkerSchema`, which dictates how the walker will execute and analyze the backtests.

## Function addStrategy

This function lets you add a trading strategy to the backtest-kit framework. Think of it as registering your trading logic so the system knows how to execute it. When you add a strategy, the framework automatically checks to make sure it's set up correctly, including validating the signals and ensuring it doesn't generate too many signals at once.  If you’re running the backtest in live mode, the strategy's settings are also saved safely, so they persist even if something unexpected happens. You provide the strategy's configuration details as an object, defining how the strategy should behave.

## Function addSizing

This function lets you tell the backtest-kit how to determine the size of your trades. It's how you configure the framework to decide how much capital to allocate to each position based on factors like your risk tolerance and the volatility of the asset. You provide a sizing schema, which outlines the method used for sizing (like fixed percentage, Kelly Criterion, or ATR-based), sets risk parameters, defines size limits, and can even include a callback function to be executed during the sizing calculation. Essentially, it’s a central piece for controlling your risk management within the backtesting process.

## Function addRisk

This function lets you set up how your trading system manages risk. Think of it as defining the boundaries for how many trades can be active at once and adding your own custom checks to ensure things stay safe. 

It’s a central way to control risk across all your trading strategies, allowing them to share the same risk management rules. The system keeps track of all open positions, which you can then use in your custom risk validation checks. This helps prevent overexposure and ensures your strategies work together safely. You provide a configuration object that outlines these risk parameters.

## Function addFrame

This function lets you tell backtest-kit how to generate the timeframes it will use for your backtesting simulations. Think of it as defining the schedule for your backtest – specifying the start and end dates of your historical data, and how frequently you want to generate new timeframes (like every minute, hour, or day). You provide a configuration object that details this schedule, and backtest-kit uses that to create the series of timeframes needed to run your tests. Essentially, it sets up the timeline for your backtesting analysis. 

The `frameSchema` object holds all the specifics about when and how those timeframes should be created.

## Function addExchange

This function lets you connect your trading data source – like Binance, Coinbase, or your own custom data feed – to the backtest-kit framework. Think of it as telling the framework where to get the historical price information it needs to run simulations. 

You provide a configuration object that defines how the framework should interact with your exchange, including how to fetch historical candlestick data and format prices. This registration step is essential before you can start backtesting any strategies. It's how the framework knows where to look for the data it requires.

# backtest-kit classes

## Class WalkerValidationService

The WalkerValidationService helps ensure your trading strategies are built correctly by verifying the structure of your custom trading logic, called "walkers." Think of it as a safety net that catches potential errors early on.

You use it to register the expected structure (a schema) for each walker you create.  It allows you to add new walker schemas, validate that a specific walker exists and conforms to its registered schema, and retrieve a complete list of all walkers you've registered. This service is valuable for catching configuration issues and keeping your backtesting environment stable.


## Class WalkerUtils

WalkerUtils helps you easily run and manage your trading walker comparisons. It simplifies the process of executing walkers, automatically handling details like the exchange and frame names from the walker's configuration. You can think of it as a helper class for running your automated trading strategies.

The `run` method lets you execute a walker for a specific trading symbol, giving you access to the comparison results as they come in. If you just need to kick off a walker and don’t need to monitor its progress, the `background` method is perfect for running it in the background without yielding any results – great for things like logging or triggering other actions.

Need to retrieve the final results? `getData` gives you all the data from the walker comparisons. Want a formatted report? `getReport` generates a markdown report summarizing the results. Finally, `dump` allows you to save that report directly to a file. It’s designed to be easy to use and integrated into your workflows.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of your trading strategies’ data structures in a safe and organized way. Think of it as a central place to define and manage the blueprints for your strategies.

It uses a special system to ensure that the structures you define are consistent and prevent errors. You add new strategy blueprints using `addWalker()`, and you can easily find them again by name using `get()`.

If you need to update a blueprint, you can use `override()` to make targeted changes. Before adding a new blueprint, `validateShallow()` checks to make sure it's properly formed and has all the essential parts. Essentially, this service is all about keeping your strategy data structures well-defined and error-free.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you automatically create and save reports about your trading strategies' performance. It listens for updates from your trading simulations and neatly organizes the results for each strategy. These results are then presented in easy-to-read markdown tables, allowing you to compare different strategies side-by-side.

The service uses a clever system to remember the data for each simulation separately, ensuring your results don't get mixed up. You can customize where these reports are saved, or clear out the accumulated data if you need to start fresh. The service initializes itself automatically when you first use it, so there's nothing special you need to do to get started.

## Class WalkerLogicPublicService

The WalkerLogicPublicService acts as a central hub for managing and running your backtesting workflows. It simplifies things by automatically passing along important information like the strategy name, exchange, frame, and walker name between different parts of your system. 

Think of it as a layer on top of the private WalkerLogic service, making it easier to keep track of what's happening in your tests.

You interact with this service primarily through the `run` method. This method takes a symbol (like a stock ticker) and context information and kicks off the comparison process for all your strategies, ensuring everything runs within a consistent environment. It returns a generator that allows you to step through the results as they become available.

## Class WalkerLogicPrivateService

This service handles the complex process of comparing different trading strategies, often referred to as a "walker" comparison. It’s designed to orchestrate the backtesting of multiple strategies against the same historical data.

Think of it as a conductor managing an orchestra: it ensures each strategy (like an instrument) plays its part, providing updates as they finish.  It keeps track of the best performing strategy as things progress. 

The `run` method is the main entry point; you give it a symbol (like a stock ticker), a list of strategy names to compare, the metric you'll use to judge performance (like profit or Sharpe ratio), and some context about the environment (exchange, timeframe, name of the walker).  The `run` method then backtests each strategy one after another, giving you intermediate results as each one concludes and ultimately delivers a final ranked list of strategies. 

It relies on other services internally – `backtestLogicPublicService` for the actual backtesting and `backtestMarkdownService` for generating reports, for example – to accomplish its task.

## Class WalkerGlobalService

WalkerGlobalService acts as a central access point for walker functionality within the backtest-kit framework. Think of it as a convenient helper, managing dependencies and providing a straightforward way to interact with the core walker logic. 

It bundles together essential services, like a logger and the public interface to the walker logic itself, making it easy to incorporate into your projects using dependency injection. 

The primary function, `run`, allows you to execute comparisons for a specific trading symbol.  When you call `run`, you provide details like the symbol's name and the specific context (walker name, exchange, and frame) to tailor the comparison. It returns a stream of results allowing you to process them sequentially.

## Class StrategyValidationService

This service helps ensure your trading strategies are set up correctly before you start backtesting. It keeps track of your strategies and their associated configurations. 

You can add strategy definitions to the service, essentially registering them for validation. The `validate` function then checks if a strategy exists and confirms that its risk profile is appropriately defined. 

If you need to see what strategies you've registered, the `list` function provides a quick way to get a list of all the strategy schemas currently known to the service. Essentially, it’s a central place to manage and confirm your strategies are ready for testing.

## Class StrategySchemaService

This service helps you keep track of your trading strategy blueprints, ensuring they're structured correctly and easy to find. It acts like a central repository for your strategy definitions.

You can add new strategy blueprints using `addStrategy()`, and later retrieve them by name when you need them.  Before a strategy is added, the system checks it to make sure it has all the essential parts and types it needs. 

If a strategy already exists, you can update parts of it using the `override` function to make changes without replacing the whole definition.  The system keeps a record of all registered strategies, allowing you to easily manage and reuse them in your backtesting framework.

## Class StrategyGlobalService

StrategyGlobalService acts as a central hub for interacting with your trading strategies, providing a convenient way to execute them within a controlled environment. It’s designed to seamlessly integrate your strategies with the necessary context, like the trading symbol, the exact time, and whether you're running a backtest.

It essentially combines two other services: one for managing the strategy connection and another for providing the execution context.

You can use it to check how a strategy is performing at a specific moment in time (using `tick`), or to run a quick backtest against historical candle data (`backtest`).  Need to pause a strategy from creating new signals? Use `stop`.  If you need to reset a strategy, forcing it to reinitialize, `clear` is your tool. This service primarily manages the connections and doesn't directly deal with the strategy's internal logic.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub for managing and executing trading strategies. It intelligently routes requests to the correct strategy implementation based on the current context, making sure the right strategy handles each operation.

To optimize performance, it keeps a record of strategy instances, so it doesn't have to recreate them every time they’re needed.  Before any trading operations, it ensures the strategy has been properly initialized.

You can use the `tick` method to process live trading data and the `backtest` method to evaluate how a strategy would have performed historically.  There are also methods to pause signal generation (`stop`) and to completely clear a strategy from memory (`clear`) for advanced control and resource management.

## Class SizingValidationService

The SizingValidationService helps you make sure your trading strategies are using valid sizing methods. It allows you to register different sizing approaches, like fixed percentages or Kelly criterion, and then check if they're properly set up.

You can add sizing schemas to the service, each defining how much capital to risk on a trade. 

The `validate` function checks if a sizing exists and can also verify the chosen sizing method. Finally, the `list` function provides a way to see all the sizing schemas that have been registered with the service. 


## Class SizingSchemaService

This service helps you keep track of your sizing strategies, ensuring they're all set up correctly. It acts like a central store for these strategies, using a system that helps prevent errors by making sure the types of data are what you expect. 

You can add new sizing strategies using `register`, or update existing ones with `override` to make adjustments.  If you need to use a sizing strategy, `get` lets you retrieve it by name. The service also has some internal tools to check if your sizing strategies are structured properly before they’re saved.

## Class SizingGlobalService

This service handles the crucial task of determining how much of an asset to buy or sell in your trading strategy. It uses a connection to a sizing engine to perform these calculations. 

Think of it as a central hub for all position sizing decisions, internally used by the backtest-kit framework and also accessible for your own custom logic.

The `calculate` method is the main way to interact with the service.  You provide it with the necessary parameters, like risk tolerance and capital, and it returns the calculated position size. The `loggerService` and `sizingConnectionService` are internal components used by the service to perform its tasks.

## Class SizingConnectionService

The SizingConnectionService acts as a central hub for calculating position sizes within your trading strategy. It directs requests to the right sizing implementation based on a provided name, ensuring the correct method is used. 

To improve efficiency, it remembers previously used sizing configurations, so it doesn't have to recreate them every time. This memoization significantly speeds up the process.

The service handles position sizing calculations, taking into account risk parameters and the chosen sizing method, which could be things like fixed percentages, the Kelly Criterion, or ATR-based sizing. If your strategy doesn't require sizing, the sizingName will simply be an empty string. 

You interact with the service primarily through its `getSizing` method to retrieve sizing instances and `calculate` to perform the size calculation itself.

## Class RiskValidationService

The RiskValidationService helps ensure your trading strategies are considering potential risks. 

It lets you define different types of risks and the criteria they should meet. You can add risk profiles, each with its own set of rules, and then validate whether a particular situation meets those requirements. 

The service keeps track of all the risks you've defined, allowing you to easily view them and manage them. Essentially, it’s a way to proactively check for and handle potential issues before they impact your backtesting results. You can add new risks, validate existing ones, and get a complete list of all defined risks.

## Class RiskSchemaService

This service helps you keep track of your risk schema definitions in a safe and organized way. Think of it as a central place to store and manage the blueprints for how you assess and manage risk.

It uses a system that ensures type safety, meaning it helps prevent errors by making sure the data you're working with is in the expected format. You add new risk profiles using `addRisk()`, and then you can easily find them again by name using `get()`.

If you need to update an existing profile, the `override()` function allows you to make changes without replacing the whole definition.  Before you add a new profile, `validateShallow()` checks to make sure it has all the essential pieces in place. This service keeps things neat, prevents mistakes, and makes managing your risk schemas much easier.

## Class RiskGlobalService

This service manages risk checks and signal registration for trading strategies. It acts as a middleman, connecting to a risk connection service to ensure trades adhere to defined risk limits. 

You're primarily interacting with this through its methods: `checkSignal` verifies whether a trade should be allowed, `addSignal` informs the system when a trade is initiated, and `removeSignal` notifies the system when a trade is closed. The service keeps track of open signals and communicates these events to the underlying risk management system. It also leverages a logger service for tracking and debugging purposes.

## Class RiskConnectionService

This service acts as a central hub for handling risk checks during trading. It intelligently directs risk-related operations to the correct risk management component based on a name identifier.

It remembers previously used risk management components (memoization) to speed things up. You tell it which risk rules to use by providing a name, and it handles the rest.

The `getRisk` property is how you access a specific risk management component – it creates one if it doesn’t exist yet and then reuses it later.

The `checkSignal` method determines whether a trade should be allowed, performing checks like portfolio drawdown and exposure limits.

There are also methods, `addSignal` and `removeSignal`, for tracking opened and closed trades within the risk management system. These ensure accurate risk assessment as your positions change.

## Class PositionSizeUtils

This class offers helpful tools for figuring out how much of an asset to trade in your backtests. Think of it as a calculator for position sizing, allowing you to apply different strategies.

It provides specific methods for common sizing techniques, like fixing a percentage of your account at risk, using the Kelly Criterion to optimize for growth, and basing the size on the Average True Range (ATR). Each method takes the relevant information – like account balance, entry price, and stop-loss levels – to determine the appropriate position size. 

The class ensures that the information you provide aligns with the sizing method you choose, helping prevent errors in your calculations.  You don't need to create an instance of the class; instead, you'll directly use the provided methods.

## Class PersistSignalUtils

The `PersistSignalUtils` class helps manage how trading signals are saved and restored, particularly for strategies running in live mode. It acts as a central place to handle signal persistence and ensures data integrity, even if there are unexpected interruptions.

Think of it as a smart keeper of your strategy's signal history. Each strategy has its own private storage, and you can even swap out the default storage mechanism with a custom adapter if needed.

When a strategy starts up, `readSignalData` is used to retrieve any previously saved signals.  If no signal is found, it simply returns nothing. When a strategy takes action and wants to save that new action, `writeSignalData` is employed to write the signal data to disk. This write process is done in a special, safe way to prevent data corruption if something goes wrong during the save operation. 

Finally, `usePersistSignalAdapter` allows you to provide your own way of storing signal data if the default method isn't suitable.

## Class PersistRiskUtils

This utility class helps manage how trading positions are saved and restored, particularly for different risk profiles. It’s designed to ensure a safe and reliable way to keep track of your active positions, even if something unexpected happens.

The class automatically handles saving and retrieving position data for each risk profile, and it can be customized to use different storage methods. It reads in existing position data when needed, like when initializing the system, and writes changes to disk to protect against data loss.

When you need to save new positions or remove existing ones, this class makes sure the updates are written safely, preventing potential corruption. You can also plug in your own custom storage solutions if the built-in methods don’t quite fit your needs.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing by gathering and analyzing their metrics. It listens for performance data, keeps track of it separately for each strategy, and then calculates things like average performance, highest and lowest results, and percentiles. 

You can easily get aggregated statistics for a specific strategy to see its overall performance. It also creates readable markdown reports that highlight potential bottlenecks, and can save these reports directly to your logs folder.

The service needs to be initialized once to start collecting data. You can clear all the collected performance data if needed, either for a specific strategy or globally. Each strategy gets its own dedicated storage space to keep its performance information separate.

## Class Performance

The Performance class helps you understand how your trading strategies are doing. It lets you gather overall performance stats for each strategy, giving you a clear picture of their efficiency. 

You can request detailed performance data, broken down by different actions within your strategies, including things like how often they occur, how long they take, and how much they vary.  This data includes not just averages, but also things like minimum and maximum durations, and percentiles to help pinpoint any unexpected slowdowns.

The class also generates easy-to-read markdown reports that visually represent the performance data, including breakdowns of time spent on different operations and tables of key statistics.  These reports can be saved to disk for later review, and the default location is within a "logs/performance" directory.

Finally, you can easily reset the collected performance metrics to start fresh if needed.

## Class LoggerService

The `LoggerService` helps you keep your trading logs organized and informative. It provides a central place for logging messages from your backtesting strategies and other parts of the framework.

You can customize where these logs go by providing your own logger, or it will default to a basic "no-op" logger if you don't set one. It automatically adds useful information to your log messages, like the name of the strategy, the exchange, and the current trading frame, so you don't have to manually include them. 

You'll find methods for logging general messages (`log`), debug information (`debug`), important details (`info`), and potential problems (`warn`), all with this automatic context injection. Setting a custom logger is simple using the `setLogger` method, giving you full control over where and how your logs are stored.

## Class LiveUtils

The LiveUtils class offers tools to manage live trading processes, making it easier to run and monitor your strategies. It’s designed to be a central point for handling live operations, automatically recovering from crashes so your trading doesn’t lose progress. 

You can use the `run` method to kick off a live trading session for a specific symbol, which will continuously generate results – think of it as an ongoing stream of data. The `background` method lets you run a live trade without needing to process the results directly; perfect for things like logging or persisting data in the background.

For insights into performance, `getData` gathers statistics from your live trades, while `getReport` creates a handy markdown summary. Finally, `dump` allows you to easily save those reports to a file for later review.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create detailed reports about your trading strategies. It keeps track of everything that happens – from idle periods to opened, active, and closed trades – for each strategy you’re running. 

These reports are generated as markdown tables, making them easy to read and analyze. You’ll also get key trading statistics like win rate and average profit/loss (PNL). 

The service saves these reports to files, neatly organized in a `logs/live/{strategyName}.md` directory. It’s designed to be simple to use; it automatically subscribes to trading signals and creates reports without needing manual configuration. You can clear the collected data if needed, either for a specific strategy or all of them. It ensures that initialization only occurs once.

## Class LiveLogicPublicService

The `LiveLogicPublicService` acts as a central hub for managing live trading operations. It simplifies the process by automatically handling the necessary context, like the strategy and exchange names, so you don't have to pass them repeatedly to different functions.

Think of it as a continuous stream of trading updates – it runs indefinitely, giving you a constant flow of information about opened, closed, and cancelled signals.  

If something goes wrong and the process crashes, it's designed to recover and pick up where it left off by restoring its state.  It's built to keep pace with real-time trading, using the current date and time to ensure accurate progression.  You essentially tell it which symbol to trade, and it takes care of the rest, automatically propagating context and managing the ongoing trade lifecycle.

## Class LiveLogicPrivateService

This service handles the behind-the-scenes work of live trading, making it easy to monitor and react to market changes. It continuously checks for new trading signals, stepping through time in real-time. You're getting a stream of trading results – only the ones that involve opening or closing positions are sent to you, so you don't get overwhelmed with unnecessary information.

The process is designed to be robust, automatically recovering if it crashes, ensuring uninterrupted trading. It's also efficient in how it uses memory because it streams the data instead of storing everything at once. Think of it as an always-on system, constantly watching and responding to the market. This service is essentially a tireless worker, focused on delivering only the important trading events.

## Class LiveGlobalService

The LiveGlobalService helps manage live trading operations within the backtest-kit framework. Think of it as a central hub that simplifies accessing and coordinating live trading functionality. It’s designed to be used with dependency injection, making it easy to integrate into different parts of your application.

Inside, it uses other services like `LiveLogicPublicService` to handle the core trading logic, and validation services to ensure your strategy and exchange settings are correct. 

The key feature is the `run` method.  It’s a special, continuous process that simulates live trading for a specific asset (like a stock or cryptocurrency). This `run` function is an infinite generator, which means it keeps running until you explicitly stop it, and it’s built to recover automatically if things go wrong, preventing interruptions to your live trading. You provide the asset symbol and context information (strategy name, exchange name) to tell it what to trade and where.

## Class HeatUtils

This class, `HeatUtils`, makes it easy to generate and save portfolio heatmaps, which visually represent how your trading strategies performed. It acts as a helper, providing a simplified way to access and organize performance data.

You can use `getData` to retrieve detailed statistics for a specific strategy, breaking down performance metrics for each symbol you traded.

`getReport` allows you to create a formatted markdown report displaying this data in a clear, organized table sorted by profit.

Finally, `dump` lets you save that report directly to a file on your computer, creating any necessary folders along the way, so you can share or review it later. Think of it as a one-stop shop for visualizing your strategy's performance.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and analyze the performance of your trading strategies. It gathers data from closed trades across all your symbols and strategies, allowing you to see overall portfolio health and detailed breakdowns for each individual symbol.

You can think of it as a live dashboard that automatically updates as trades are closed.  It calculates key metrics like total profit and loss, Sharpe Ratio, and maximum drawdown, making it easier to understand how your strategies are performing.

The service provides a handy way to generate readable markdown reports – basically formatted tables – to share your results or keep a historical record.  It's designed to handle tricky math situations gracefully, so you won't see unexpected errors.

The service automatically organizes data separately for each strategy, ensuring that information doesn’t get mixed up.  It's designed to be simple to use; the `init` function handles the initial setup, and the `tick` function processes incoming trade information. You can also clear out the accumulated data when you need to start fresh.

## Class FrameValidationService

The FrameValidationService helps you ensure your trading framework's data structures are consistent and correct. Think of it as a quality control system for your data.

You start by telling the service what your data "frames" should look like – essentially, defining their structure using frame schemas. The `addFrame` method lets you register these schema definitions.

When you have data you want to use, the `validate` method checks if that data matches the expected frame schema. If it doesn't, you'll get alerted to potential problems.

You can also get a handy list of all the frame schemas you've registered using the `list` method, which is useful for understanding your framework's data structure at a glance. The `loggerService` property provides logging functionality for debugging and monitoring. The `_frameMap` property is used internally to store frame schemas.

## Class FrameSchemaService

The FrameSchemaService helps you organize and manage the blueprints for your trading frames. Think of it as a central place to store and update the definitions of what a frame looks like – ensuring everyone is on the same page.

It uses a special registry system to keep track of these frame blueprints in a type-safe manner. You can add new frame definitions using `register`, or update existing ones with `override`.  If you need to look up a frame definition, you can easily retrieve it by name using `get`.

Before a frame is added, it's checked to make sure it has the essential building blocks defined correctly, thanks to the `validateShallow` property. This helps prevent errors down the line.

## Class FrameGlobalService

The FrameGlobalService helps manage the timeframes used in backtesting. Think of it as a central point for figuring out what dates and times your trading strategy will be evaluated against. It relies on a FrameConnectionService to actually fetch the timeframe data.  The `getTimeframe` method is its main function - give it a ticker symbol and it returns an array of dates that will be used during the backtest. This service is designed to be a behind-the-scenes helper for the core backtesting logic.

## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing different "frames" of data used in backtesting. Think of a frame as a specific period of time with defined start and end dates – like a week of trading data. 

It intelligently routes requests to the correct frame implementation based on the current context, avoiding the need to manually specify which frame to use each time.  To speed things up, it caches these frame instances, so frequently accessed frames are readily available.

You can retrieve a `ClientFrame` instance for backtesting using `getFrame`, which creates it if it doesn't already exist.  

To control the scope of your backtest, `getTimeframe` lets you fetch the start and end dates associated with a specific trading symbol, allowing you to focus on particular periods. When running in live mode, there are no frame constraints, and the `frameName` will be empty.

## Class ExchangeValidationService

This service helps ensure your trading exchanges are set up correctly within the backtest-kit framework. Think of it as a quality control checkpoint for your exchange configurations.

You can use it to register the structure (schema) of different exchanges you’re working with, allowing the system to verify their setup. It provides methods to add new exchange configurations, check if a specific exchange is registered, and retrieve a full list of all registered exchanges. The `addExchange` method lets you define the expected format of data coming from an exchange, and `validate` confirms that an exchange actually exists within the system.  Finally, `list` provides a way to see all exchanges you've added for inspection or management.

## Class ExchangeSchemaService

The ExchangeSchemaService helps keep track of information about different cryptocurrency exchanges in a structured and reliable way. It acts as a central place to store and manage these exchange details, ensuring consistency and preventing errors.

Think of it as a library where you can add new exchange information and easily look up existing ones by their name. When adding a new exchange, it checks that all the necessary details are present and of the correct type. You can also update existing exchange information with just the parts that need changing. The service uses a special type-safe system to make sure everything stays organized and predictable.

## Class ExchangeGlobalService

This service helps your backtesting and live trading logic interact with an exchange. It combines access to the exchange connection with information about the current trading conditions, like the symbol being traded, the timestamp, and backtest parameters. 

Think of it as a bridge between your trading strategies and the exchange's data.

Here's what you can do with it:

*   **Get historical candle data:** Retrieve past price movements for a specific symbol and timeframe.
*   **Retrieve future candles (for backtesting only):**  Simulate future market conditions during backtesting.
*   **Calculate average price:** Determine the volume-weighted average price (VWAP).
*   **Format prices and quantities:**  Ensure prices and quantities are displayed correctly based on the exchange's conventions and current conditions. Each of these functions takes into account the trading environment (backtest or live).

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently directs your requests – like fetching candles or getting average prices – to the correct exchange implementation based on the current context.

To make things efficient, it caches these exchange connections, so you don't have to repeatedly establish them. This caching is managed so that connections are created only when needed and reused afterwards.

You can retrieve historical price data (candles), fetch the next set of candles based on the current timestamp, get the current average price, and ensure your prices and quantities are formatted correctly to match the specific rules of the exchange you's using. The service handles these details for you, making it easier to work with multiple exchanges in your trading strategies.

## Class ClientSizing

The ClientSizing class helps determine how much of an asset to trade based on various factors. Think of it as the engine that figures out your position size.

It offers several sizing methods, like fixing a percentage of your capital, using the Kelly Criterion, or basing it on Average True Range (ATR).  You can also set limits on how large a position can be, ensuring you don’t overextend yourself. 

The class allows for custom validation and logging through callbacks, giving you greater control and insight into the sizing process.  Essentially, it takes inputs like account balance and price data, applies your chosen sizing method and constraints, and returns the suggested position size. The `calculate` method is the core function that performs this calculation.

## Class ClientRisk

The ClientRisk component helps manage risk for your trading portfolio, making sure your strategies don't overstep predefined boundaries. It acts as a central control point, sharing its risk checks across multiple strategies to analyze potential conflicts.

Think of it as a gatekeeper – it verifies signals before trades are executed, preventing you from exceeding limits like the maximum number of concurrent positions. It also allows you to define your own custom risk checks, giving you maximum flexibility.

Internally, it keeps track of all open positions, updating them periodically and using a special system to ensure this tracking happens only once. The `checkSignal` function is key: it's how the risk rules are applied to each potential trade, taking into account all active positions and allowing for custom validation logic.  When a signal is opened or closed, `addSignal` and `removeSignal` methods are triggered to update the record of active trades.

## Class ClientFrame

The `ClientFrame` is the engine that produces the timelines your backtesting runs use. It creates arrays of timestamps, effectively building the sequence of moments in time your trading strategies will be evaluated against. To avoid unnecessary work, it remembers previously generated timelines and reuses them.

You can control how spaced out these timelines are, setting the interval from one minute to three days. 

Furthermore, you can hook into the process to verify the generated timelines or log events as they happen.

The `getTimeframe` method is what actually creates and retrieves these timeline arrays for a specific trading symbol.  It remembers what it's generated so it doesn’t rebuild things repeatedly.

## Class ClientExchange

This class provides a way to interact with an exchange, specifically designed for backtesting scenarios. It handles retrieving historical and future candle data, enabling you to simulate trading strategies across different time periods. You can pull candles backwards from a specific point in time using `getCandles`, or look ahead to fetch future candles with `getNextCandles`. 

The class also calculates the Volume Weighted Average Price (VWAP) using the last five one-minute candles to help analyze price trends. Finally, it offers functions to correctly format quantities and prices to match the exchange's specific requirements, ensuring your orders are placed accurately. The whole class is built for efficiency, reusing functions to minimize memory usage.

## Class BacktestUtils

This utility class, `BacktestUtils`, provides helpful tools to manage and analyze backtesting runs within the framework. Think of it as a central place to kick off backtests and gather information about their performance.

The `run` function is your primary way to start a backtest for a specific symbol, sending along information about the strategy, exchange, and timeframe.  It gives you results as they come in, allowing you to monitor progress or react to intermediate findings.

If you just need to run a backtest for something like logging or triggering a callback and don't care about the intermediate results, `background` is perfect. It handles everything behind the scenes.

To understand how a strategy performed overall, `getData` retrieves statistical information from all its completed backtest runs. `getReport` then takes that data and crafts a nicely formatted markdown report you can easily read and share. Finally, `dump` lets you save that report directly to a file on your computer for safekeeping or later review.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create readable reports about your backtest results. It listens for trading signals during a backtest and quietly keeps track of how those signals performed, specifically focusing on signals that have closed. 

Think of it as a recorder that collects data on your strategy's closed trades. It organizes this data into markdown tables, making it easy to see exactly how each signal did. These reports are saved as `.md` files in a `logs/backtest` folder, one file per strategy.

The service uses a clever storage system, so each strategy gets its own separate set of data. You can clear this data if you need to start fresh, either for a specific strategy or for all strategies at once. It also has an initialization process that sets everything up automatically when you first use it.

## Class BacktestLogicPublicService

The `BacktestLogicPublicService` helps you run backtests in a clean and organized way. It simplifies the process by automatically managing important details like the strategy name, exchange, and frame, so you don’t have to keep passing them around in your code.

Think of it as a helper that sits between your backtesting logic and the underlying engine.  It takes care of setting up the environment for you.

The core functionality is the `run` method which lets you start a backtest for a specific trading symbol. This method returns a stream of results as it goes, giving you ongoing information about how the backtest is performing. The beauty is that it seamlessly passes all the necessary context to the functions it calls, making your code easier to read and maintain. You won't have to worry about providing context explicitly when using functions like `getCandles` or `getSignal`.


## Class BacktestLogicPrivateService

This service manages the core backtesting process, acting as a conductor for all the different components. It efficiently handles the sequence of events – retrieving timeframes, processing ticks, and executing trades based on incoming signals. 

Think of it as a pipeline: it pulls data, performs calculations, and streams the results (closed trades) as they happen, avoiding the need to store everything in memory at once.  

The `run` method is the main entry point. When you call it with a symbol, it kicks off the backtest and provides a stream of backtest results, allowing you to process them incrementally. You can even stop the backtest early by interrupting this stream. 

The service relies on several other global services for things like logging, strategy management, exchange data, and timeframe data.

## Class BacktestGlobalService

The BacktestGlobalService acts as a central hub for running backtests within the system, making it easy to access key backtesting capabilities. Think of it as a convenient way to manage and coordinate the different components involved in a backtest. It provides access to services that handle validation and logic, and importantly, offers a `run` method. 

The `run` method is your primary tool for initiating backtests. You give it a symbol (like a stock ticker) and some context details, such as the strategy, exchange, and frame names you want to use.  The `run` method then performs the backtest and gives you backtest results one at a time. It’s designed to be used when you need to inject dependencies for testing or when you want a streamlined way to execute a backtest and process its output.

# backtest-kit interfaces

## Interface WalkerContract

The `WalkerContract` represents updates as your backtesting framework evaluates different trading strategies. Think of it as a notification you receive each time a strategy finishes being tested and its performance is assessed within a comparison. 

It provides information about the testing process, including the name of the walker, the exchange and timeframe used, the specific symbol being analyzed, and the strategy that just completed its run.

You'll also see key performance indicators like the backtest statistics, a calculated metric value (which might be invalid), the metric being optimized, and the current best performance observed across all strategies tested so far. 

Finally, it lets you know how many strategies have been tested and the total number planned, giving you a sense of how far along the comparison is.

## Interface TickEvent

The TickEvent interface holds all the data you need to understand what happened during a trade. It represents a single event in the trading process, whether it’s an idle state, opening a position, an active trade, or closing it out. 

Think of it as a comprehensive record – it includes the exact time the event occurred, the action type (idle, opened, active, closed), and relevant details like the trading symbol, signal ID, and position type. When a trade is opened or actively running, you’ll find information like the open price, take profit level, and stop loss.  For closed trades, the record contains key information such as the profit and loss percentage (PNL), the reason for closing, and the trade duration.

## Interface ProgressContract

This interface provides updates on how a backtest is progressing. Think of it as a report card during a long-running backtest, especially when using background processing. 

It tells you which exchange and strategy are being tested, the trading symbol involved, and important numbers like the total number of historical data points the backtest will use, how many it's already gone through, and the overall percentage of completion. This allows you to monitor the backtest's status and get an estimate of how much longer it will take to finish. The `exchangeName`, `strategyName`, and `symbol` identify the specific test being run, while `totalFrames` and `processedFrames` give you concrete numbers to track progress. Finally, `progress` expresses that progress as a percentage, making it easy to understand.

## Interface PerformanceStatistics

This section describes the `PerformanceStatistics` object, which holds a summary of how a trading strategy performed. It contains the strategy's name, the total number of performance events logged, and the overall time spent calculating these statistics. 

You’ll find a breakdown of statistics grouped by metric type within the `metricStats` property, allowing you to analyze performance across different areas. Finally, the `events` property provides access to all the individual, raw performance events recorded, which you can use for more detailed investigation.

## Interface PerformanceContract

This interface helps you keep tabs on how your trading strategies are performing. It records key performance data, like how long different operations take. You can use this information to pinpoint areas where your strategy might be slow or inefficient, and ultimately optimize its performance.

Each performance record includes a timestamp to show when the operation occurred, and a `previousTimestamp` to measure the time elapsed between events. It also details what kind of operation was performed (`metricType`), which strategy was running, and which exchange and symbol were involved. A flag indicates whether the measurement came from a backtest or a live trading environment.

## Interface MetricStats

This interface holds all the key statistics calculated for a particular type of performance metric during a backtest. Think of it as a single report card for one specific measurement, like order execution time or fill latency.

It includes basic information like the total number of times a metric was recorded, the total duration across all those recordings, and simple averages and extremes (minimum, maximum).

You'll also find more detailed statistics here, like the standard deviation, median, and various percentiles (95th and 99th) which give a better sense of the distribution of values.

Finally, there's information related to wait times – specifically, the average, minimum, and maximum time between events that trigger the metric. This helps understand the timing aspects of your trading strategy.

## Interface LiveStatistics

The `LiveStatistics` interface provides a collection of key performance indicators derived from your live trading activity. It essentially gives you a snapshot of how your trading strategy is performing in real-time.

You're provided with a detailed `eventList` that logs every trade action, from idle periods to opening, active, and closed positions, giving you full transparency into the process.  The `totalEvents` count provides a simple tally of all actions taken. It breaks down those actions further by counting total closed signals, wins, and losses.

Several key metrics are available to assess performance including win rate (expressed as a percentage), average profit/loss per trade, total cumulative profit/loss, and volatility measured by standard deviation.  You're also provided with risk-adjusted performance metrics like the Sharpe Ratio and annualized Sharpe Ratio.  Finally, the certainty ratio and expected yearly returns offer further insight into the strategy's reliability and potential long-term profitability. Note that any metric marked as "null if unsafe" means the calculation couldn't be reliably performed.

## Interface IWalkerStrategyResult

This interface represents the outcome of running a single trading strategy within a backtest comparison. It bundles together essential information about that strategy’s performance. You'll find the strategy's name clearly identified, alongside a set of statistics detailing its backtest results, such as profit and loss.  A key metric value, used to compare the strategy against others, is also included. Finally, the `rank` property tells you how the strategy performed relative to the rest – a rank of 1 indicates the top performer.

## Interface IWalkerSchema

The Walker Schema lets you set up A/B tests across different trading strategies within backtest-kit. Think of it as a blueprint for comparing how various strategies perform against each other. 

You’re essentially defining a group of strategies you want to test, along with the exchange and timeframe to use for all of them. Each Walker needs a unique name to identify it, and you can add a note to explain what the test is about. 

The `strategies` property is crucial – it lists the names of the strategies you've already registered within the framework.  You’ll also specify a metric like Sharpe Ratio that the Walker will optimize for. Optionally, you can define callbacks to hook into specific events during the Walker’s lifecycle, giving you more control and insights.

## Interface IWalkerResults

This object holds all the information collected after running a comparison of different trading strategies. It tells you which strategy was tested, the asset it was tested on, and the exchange and timeframe used. 

You'll find details like the optimization metric, the total number of strategies evaluated, and most importantly, the name of the best-performing strategy alongside its metric score. It also includes the full statistical breakdown for that top-performing strategy, giving you a complete picture of its performance.

## Interface IWalkerCallbacks

The `IWalkerCallbacks` interface provides a way to be notified about what's happening during the backtesting process. Think of it as a notification system that lets your code react to different stages of the testing.

You can use `onStrategyStart` to know when a particular strategy is beginning its backtest, useful for logging or displaying progress. `onStrategyComplete` is triggered once a strategy finishes testing, giving you the final statistics and a key performance metric. Finally, `onComplete` signals the end of the entire testing run, providing access to all the accumulated results. 


## Interface IStrategyTickResultScheduled

This interface represents a special kind of tick result, indicating that a trading signal has been created and is currently "scheduled." It means the framework is waiting for the price to reach a specific level outlined in the signal before initiating a trade.

You'll see this result when your strategy's `getSignal` function returns a signal that includes a target entry price.

The information provided includes details like the strategy and exchange names, the trading symbol (like "BTCUSDT"), the current price at the time the signal was scheduled, and the signal itself, which contains the price levels the system is monitoring. Essentially, it's a snapshot of the conditions that led to a signal being placed on hold.

## Interface IStrategyTickResultOpened

This interface describes what happens when a new trading signal is created within your backtesting strategy. It's a notification that a signal has been validated and saved, giving you information about the trade that's just begun. You'll receive this result when a signal is opened.

The `action` property confirms that this is an "opened" signal. The `signal` property contains all the details of the newly created signal, including a unique identifier. You’ll also get the name of the strategy, the exchange being used, the trading symbol (like "BTCUSDT"), and the current price at the time the signal was opened – useful for understanding the context of the trade.

## Interface IStrategyTickResultIdle

This interface, `IStrategyTickResultIdle`, represents what happens in your backtest when your trading strategy isn't actively making any decisions – it’s in an “idle” state.  It tells you that no signal is present, and provides key information about the market conditions at that moment. You'll see this result whenever your strategy isn’t triggered to buy or sell.

The data included helps you track when your strategy is idle, including the strategy and exchange being used, the trading symbol (like "BTCUSDT"), the current price, and the strategy’s name.  This is useful for analyzing periods of inactivity and understanding why your strategy wasn't taking action.

## Interface IStrategyTickResultClosed

This interface represents the result when a trading signal is closed, providing a complete picture of what happened and the resulting profit or loss. It includes details like the reason for closing the signal – whether it was due to reaching a take-profit target, hitting a stop-loss, or simply expiring – alongside the final price used for calculations.

You'll find the original signal parameters, the profit and loss breakdown including fees and slippage, and identifiers for the strategy and exchange involved. It’s essentially a snapshot of the signal’s lifecycle and the financial outcome of its closure. The `currentPrice` allows you to understand the closing price used for profit/loss calculations, while `closeReason` explains why the signal ended.

## Interface IStrategyTickResultCancelled

This interface describes what happens when a scheduled trading signal is cancelled. It’s used to represent a situation where a signal doesn't result in a trade being placed, perhaps because it was cancelled before a position could be opened or because it triggered a stop-loss.

The `action` property will always be "cancelled," clearly indicating the type of result. 

You're also given the details of the cancelled signal itself via the `signal` property, allowing you to understand why the trade didn’t happen.  The `currentPrice` and `closeTimestamp` provide context for when the signal was cancelled. 

Finally, properties like `strategyName`, `exchangeName`, and `symbol` are included so you can easily track which strategy and trading pair were involved.

## Interface IStrategyTickResultActive

This interface describes the state of a trading strategy when it's actively monitoring a signal, waiting for a trade to be triggered by a take profit, stop loss, or time expiration. It represents a moment where the strategy isn't actively executing trades, but is carefully observing market conditions based on a specific signal. 

Here's a breakdown of what each property tells you:

*   **action: "active"**: This confirms that the strategy is in an "active" monitoring state.
*   **signal**: This holds the details of the signal that's currently being watched.
*   **currentPrice**:  This shows the current price used as a reference point for the monitoring process, usually a VWAP.
*   **strategyName**: This identifies the specific strategy that's in this state.
*   **exchangeName**: This indicates which exchange the strategy is operating on.
*   **symbol**: This specifies the trading pair being monitored, for example, "BTCUSDT".

## Interface IStrategySchema

This interface, `IStrategySchema`, acts as a blueprint for defining your trading strategies within the backtest-kit framework. Think of it as a way to tell the system *how* your strategy makes trading decisions. 

You’ll use it to register your strategy, giving it a unique name for identification. You can also add a note to help yourself or other developers understand the strategy’s purpose.

The `getSignal` function is the heart of your strategy; it’s where you write the logic that determines when to buy or sell.  The `interval` property allows you to control how often your strategy can generate signals. You can make your strategy wait for a specific price level by providing `priceOpen` in `getSignal`, or have it execute immediately.

Furthermore, `callbacks` let you define actions to be taken when a trade is opened or closed. Finally, `riskName` provides a way to categorize your strategy for risk management purposes.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the outcome of a trading strategy’s profit and loss calculation. It provides key details about how much your strategy gained or lost. 

The `pnlPercentage` tells you the profit or loss expressed as a percentage – a positive number means you made money, a negative number indicates a loss. 

You're also given the `priceOpen`, which is the initial entry price of your trade, but importantly, it's been adjusted to account for fees and slippage that would realistically impact your execution. Similarly, `priceClose` shows the final exit price after factoring in those same adjustments.

## Interface IStrategyCallbacks

This interface lets you hook into different stages of your trading strategy’s lifecycle. Think of it as a way to listen for specific events related to your signals – when they're first opened, while they're active, when there's nothing happening, or when they’re closed.

You can define functions to be called on each tick, giving you a constant stream of data.  When a new signal is validated and ready to trade, the `onOpen` function is triggered.  The `onActive` callback provides information while a signal is being actively monitored.  If no signals are currently being tracked, the `onIdle` function lets you know.  When a signal is finally closed, `onClose` provides the closing price.

For signals scheduled for future entry, `onSchedule` notifies you when they're created, and `onCancel` is called if a scheduled signal doesn't open a position and is instead cancelled. These callbacks provide valuable opportunities for logging, visualization, or performing other actions based on your strategy's needs.

## Interface IStrategy

The `IStrategy` interface outlines the fundamental methods any trading strategy using backtest-kit should have. At its heart is the `tick` method, which represents a single execution cycle, checking for new trading signals and managing potential take-profit and stop-loss triggers.  You can also run a quick backtest using the `backtest` method, feeding it historical candle data to see how your strategy would have performed. If you need to pause a strategy's signal generation, the `stop` method provides a way to do so, preventing new signals from being created without prematurely closing existing positions.

## Interface ISizingSchemaKelly

This interface defines how to size trades using the Kelly Criterion, a popular method for maximizing growth rate. When implementing sizing strategies, you're essentially telling the backtest-kit how much of your capital to risk on each trade. The `method` property confirms you're using the Kelly Criterion.  The `kellyMultiplier` controls the aggressiveness of the sizing; a lower value (like the default of 0.25) means you’re risking a smaller portion of your capital per trade, while a higher value means you're risking more. Think of it as a tuning knob to adjust how aggressively your strategy sizes its positions.

## Interface ISizingSchemaFixedPercentage

This schema defines a simple way to size your trades – it always uses a fixed percentage of your available capital for each trade. You specify that percentage with the `riskPercentage` property, which represents the maximum percentage of your capital you're willing to risk on a single trade. The `method` property is set to "fixed-percentage" to identify this specific sizing approach. Essentially, it ensures consistent risk exposure with each trade by always using the same percentage for sizing.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, acts as the foundation for defining how much of your account to use for each trade. It provides core settings like a unique name for easy identification and a place for developer notes. 

You'll find controls here to manage your risk: setting a maximum percentage of your account that can be used for a single trade, and defining both minimum and maximum absolute sizes for positions. Finally, it offers optional callbacks that let you add custom logic at different points in the sizing process.

## Interface ISizingSchemaATR

This schema defines how your trading strategy determines the size of each trade based on the Average True Range (ATR). 

The `method` is always set to "atr-based" to indicate that this sizing approach is being used. 

`riskPercentage` specifies what portion of your capital you're willing to risk on a single trade, expressed as a number from 0 to 100. 

`atrMultiplier` controls how the ATR value is used to calculate the stop distance; a higher multiplier results in a wider stop.


## Interface ISizingParamsKelly

This interface, `ISizingParamsKelly`, helps define how much to trade based on the Kelly Criterion. It’s used when setting up your trading strategy within backtest-kit. You'll provide a logger to help you track what's happening during your backtesting process. This logger will provide debugging information, allowing you to understand and refine your strategy's sizing decisions.

## Interface ISizingParamsFixedPercentage

This interface, `ISizingParamsFixedPercentage`, helps you define how much of your capital to use for each trade when you're backtesting a trading strategy. It’s designed to be used when you want to consistently risk a fixed percentage of your total funds on every trade.  The main piece of information it provides is a `logger`, which is a service to help you track what's happening during the backtest and diagnose any potential problems. Using the logger helps you understand how your sizing strategy is working and catch any unexpected behavior.

## Interface ISizingParamsATR

This interface defines the settings you use when determining how much of your capital to allocate to a trade based on the Average True Range (ATR). It’s primarily used when setting up your trading strategy's sizing logic.  You’re required to provide a logger object, which helps you keep track of what's happening behind the scenes and helps with debugging. Think of it as a way to monitor and understand how your sizing calculations are working.

## Interface ISizingCallbacks

The `ISizingCallbacks` interface lets you hook into the sizing process within backtest-kit. Specifically, the `onCalculate` property allows you to be notified whenever the framework determines how much of an asset to trade. This is a chance to inspect the calculated size, log it for review, or even confirm that the size makes sense based on your strategy’s logic. You're essentially getting a notification each time the system decides on a trade size.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate trade sizes using the Kelly Criterion. To use this calculation, you'll need to specify the method as "kelly-criterion".  You also need to provide your win rate, represented as a number between 0 and 1, and the average win/loss ratio you're observing in your trading. These inputs help determine an optimal bet size that balances potential growth with risk management.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate trade sizes using a fixed percentage approach. It's used when you want to risk a set percentage of your capital on each trade. The `method` property must be set to "fixed-percentage" to indicate this sizing method is being used. You also need to specify the `priceStopLoss` which represents the price at which your stop-loss order will be triggered, and which is used in the sizing calculation.

## Interface ISizingCalculateParamsBase

This interface, `ISizingCalculateParamsBase`, provides the core data needed when determining how much of an asset to trade. It holds essential information like the trading symbol, your current account balance, and the price at which you intend to enter the trade. Think of it as the foundation for calculating your position size, ensuring your strategies have access to fundamental account and market details. It's a shared base for various sizing calculations within the backtest-kit framework.

## Interface ISizingCalculateParamsATR

This interface defines the information needed when you're sizing your trades using an ATR (Average True Range) based approach. It requires you to specify that you’re using the "atr-based" method, and most importantly, it needs the current ATR value itself, which is a number. Think of it as telling the system "I want to size my position based on the ATR, and here's what that ATR value currently is."

## Interface ISizing

The `ISizing` interface is the core of how backtest-kit determines how much of an asset your strategy should buy or sell. Think of it as the logic that translates your risk preferences into actual trade sizes.

It has a single, important method called `calculate`. This method receives information about the current market conditions and your strategy's risk settings. It then figures out the appropriate position size – essentially, how many shares or contracts to trade – and returns that number. This calculation happens asynchronously, meaning it might involve some processing time.

## Interface ISignalRow

This interface, `ISignalRow`, represents a finalized signal ready to be used within the backtest kit. Think of it as the standard format a signal takes shape after it's been checked for correctness. Each signal will have a unique ID, automatically created to easily track it.

It also contains key information about the signal: the entry price, the exchange to use, the strategy that generated it, the exact time it was created, and the symbol being traded, like "BTCUSDT". This standardized structure ensures that all signals are consistent and can be processed reliably.

## Interface ISignalDto

The `ISignalDto` represents the data used to define a trading signal. Think of it as a blueprint for a trade – it tells the backtesting system what to do and when. 

You're defining a signal’s direction ("long" for buying, "short" for selling), the entry price, and crucial risk management details like take profit and stop loss levels. These levels need to be set up appropriately: take profit should be higher than the entry price for long positions and lower for short positions, and stop loss should be the opposite. 

There’s also a "note" field for adding a description to the signal to remind you why you’re making that trade. Finally, `minuteEstimatedTime` indicates how long you anticipate holding the position before it expires. An automatically generated ID is assigned to each signal.

## Interface IScheduledSignalRow

The `IScheduledSignalRow` represents a signal that's waiting for a specific price to be hit before it's executed. Think of it as a signal with a price condition – it won't trigger until the price reaches a predetermined level, `priceOpen`.  This allows for delayed entry based on price targets. Once the price matches the `priceOpen` value, this scheduled signal transforms into a regular pending signal, ready to be acted upon. The key piece of information for a scheduled signal is the `priceOpen`, which defines the target price that must be reached.

## Interface IRiskValidationPayload

This interface defines the information passed to functions that assess risk. Think of it as a package containing details about your current trading activity. It includes the total number of positions you're holding and a detailed list of those positions, outlining what you own and where. This data helps risk management functions make informed decisions about your portfolio’s stability.

## Interface IRiskValidationFn

This defines a function that’s designed to check if your risk parameters—things like maximum position size or leverage—are set up correctly before a trade can happen. Think of it as a safety check to prevent potentially disastrous trades. The function will examine the risk settings and, if something seems off or violates your defined rules, it will stop the process by throwing an error. This helps to ensure your backtesting runs with safe and reasonable risk levels.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define rules to check the safety of your trades. Think of it as setting up guardrails to ensure your trading strategy doesn't take on too much risk. 

It has two key parts: a `validate` function where you put the actual logic to perform the risk check, and a `note` field which is like a little explanation for yourself or other developers to understand what that validation is doing. The `note` is optional, but it's a good idea to use it to clarify the purpose of your risk validation.

## Interface IRiskSchema

This interface, `IRiskSchema`, lets you define and register custom risk controls for your backtesting environment. Think of it as a way to set up your portfolio's guardrails. 

You give each risk control a unique `riskName` so you can easily identify and manage it. A helpful `note` allows you to document the purpose of the risk control for yourself or other developers.

You can also specify optional `callbacks` to be triggered at different points in the risk assessment process, like when a trade is initially rejected or when a trade is ultimately allowed.

The core of the `IRiskSchema` lies in its `validations` array.  This is where you define the actual rules and checks that will be applied to your trades to ensure they align with your risk management strategy. You can use either pre-built validation functions or create your own custom validations.

## Interface IRiskParams

The `IRiskParams` interface defines the information needed when setting up a risk management component within the backtest-kit framework. Think of it as the blueprint for how your risk controls will behave. It primarily focuses on providing a logger, which helps you keep track of what's happening during your backtesting process and helps debug any unexpected behavior. This logger allows you to see important messages and warnings as your simulation runs.

## Interface IRiskCheckArgs

The `IRiskCheckArgs` interface holds the information needed to perform a risk check before a trading strategy generates a signal to open a position. Think of it as a gatekeeper – it makes sure the conditions are right for a trade to happen. It gathers basic details like the trading pair (symbol), the name of the strategy making the request, the exchange being used, the current price, and a timestamp. This information allows the risk check to ensure the trade aligns with pre-defined rules and constraints before anything happens.

## Interface IRiskCallbacks

This interface defines functions that can be used to receive notifications about risk assessments during trading. 

You can provide callbacks to be triggered when a trading signal is blocked due to risk limits—the `onRejected` function handles this. Conversely, the `onAllowed` function lets you know when a signal has successfully cleared all risk checks and is permitted for execution. These callbacks are valuable for monitoring and auditing your risk management processes.

## Interface IRiskActivePosition

This interface, `IRiskActivePosition`, describes a trading position that's being actively monitored by the risk management system. Think of it as a snapshot of a trade, telling you who initiated it (the `strategyName`), where it's being executed (`exchangeName`), when it started (`openTimestamp`), and the details of the signal that prompted the trade (`signal`). It’s all about providing a clear picture of what's happening across different trading strategies for a comprehensive risk assessment. 

It allows you to link individual positions back to their originating strategy and understand the context of each trade.

## Interface IRisk

The `IRisk` interface helps you manage and control the risk involved in your trading strategies. Think of it as a gatekeeper that decides whether a trading signal is safe to execute, considering predefined risk limits. 

It offers three main functions:

*   `checkSignal`: This function lets you evaluate a potential trade against your risk parameters. It returns a boolean indicating whether the trade is permissible.
*   `addSignal`: When you open a new trade (or position), you register it with this function. This tells the system you’re actively involved in a trade and need to track its risk.
*   `removeSignal`: When a trade is closed, you use this function to tell the system the trade is no longer active, so it can remove the associated risk tracking. 

Essentially, `IRisk` provides a way to ensure your trading activities stay within acceptable risk boundaries and helps keep track of open and closed trades.

## Interface IPositionSizeKellyParams

The `IPositionSizeKellyParams` interface defines the information needed to calculate position sizes using the Kelly Criterion. It helps you determine how much capital to allocate to a trade based on your expected performance. 

Specifically, you'll need to provide the `winRate`, which represents the percentage of winning trades you anticipate, and the `winLossRatio`, which describes your average profit compared to your average loss on each trade. These two values work together to help size your positions responsibly.


## Interface IPositionSizeFixedPercentageParams

This interface defines the settings you'll use when your trading strategy uses a fixed percentage of your capital to size each trade, and you want to include a stop-loss price. Specifically, it lets you specify the price at which your stop-loss order will be placed. Think of this as the level where you want to limit potential losses on a trade. This parameter is essential for risk management within your backtesting setup.

## Interface IPositionSizeATRParams

This interface defines the settings needed to calculate your position size using an Average True Range (ATR) approach. Specifically, you're telling the backtest kit how much the ATR currently is. This value helps determine how much capital you're going to allocate to a trade, essentially scaling your position based on market volatility.

## Interface IPersistBase

This interface defines the fundamental actions for managing data storage within the backtest-kit framework. It provides core functions for reading, writing, and checking for the existence of data.

Before you start interacting with your data, `waitForInit` sets up the storage location and makes sure everything is ready, only running this setup once. 

`readValue` lets you retrieve a specific piece of data based on its unique identifier.  If you just want to know if something exists, `hasValue` quickly checks without retrieving the entire data. 

Finally, `writeValue` saves your data securely, ensuring that the entire write operation happens correctly.

## Interface IMethodContext

This interface, `IMethodContext`, acts like a little guide for your backtesting code. It holds the names of the strategy, exchange, and frame you're working with. Think of it as a way to keep track of which specific components your code should be interacting with during a backtest. The `frameName` property is especially useful – it’s left blank when you're running in live mode, letting your code know it's not dealing with historical data. It's automatically passed around by the backtest-kit framework to ensure your code always has the right context.

## Interface ILogger

The `ILogger` interface provides a way for different parts of the backtest-kit framework to record what's happening. Think of it as a central place to keep track of events, from basic information to detailed debugging data.

You can use the `log` method for general purpose messages about what's going on. The `debug` method is for very detailed information, usually helpful when you're trying to figure out a problem. `info` messages give you a summary of the system's activity, like successful actions or validations. Finally, `warn` lets you note anything that might be a potential issue.

Essentially, the `ILogger` helps you monitor, understand, and debug what your trading system is doing.

## Interface IHeatmapStatistics

This structure helps you understand the overall performance of your portfolio when visualizing it with a heatmap. It gathers key statistics across all the assets you've included. 

You'll find a list of individual symbol statistics organized into the `symbols` array, letting you drill down into the details of each asset. 

Alongside this, you get the total number of symbols you're tracking (`totalSymbols`), the combined profit and loss for the entire portfolio (`portfolioTotalPnl`), a measure of risk-adjusted return called the Sharpe Ratio (`portfolioSharpeRatio`), and the total number of trades executed across all symbols (`portfolioTotalTrades`).


## Interface IHeatmapRow

This interface describes the performance statistics gathered for a specific trading symbol, like BTCUSDT, across all the strategies you're using. It provides a snapshot of how that symbol performed, giving you key figures such as total profit or loss, the risk-adjusted return (Sharpe Ratio), and how much the value fluctuated (maximum drawdown).

You’ll also find details on the trading activity itself, including the total number of trades, how many were wins versus losses, and the win rate. It breaks down the average profit per winning trade, the average loss per losing trade, and streaks of wins and losses. Finally, it calculates expectancy, a measure of what you can expect to make per trade based on your win rate and average trade sizes.

## Interface IFrameSchema

The `IFrameSchema` defines a specific timeframe within your backtesting environment. Think of it as setting the rules for a particular slice of time you want to analyze – its start and end dates, and how frequently data points (like prices) will be generated within that period. 

Each schema has a unique name to identify it, and you can add a note for yourself to explain its purpose. The `interval` property dictates the granularity of data, like daily, hourly, or even minute-by-minute.  You're also able to specify start and end dates that delineate the backtest period. Lastly, optional lifecycle callbacks can be attached to the frame to trigger custom logic at different stages.


## Interface IFrameParams

The `IFrameParams` interface defines the information needed to set up a core component of the backtest-kit framework, essentially the environment where your trading strategies will run. Think of it as the configuration details for this testing environment.  It builds upon the `IFrameSchema` which holds the basic structure and adds a `logger` property. This `logger` allows you to easily track what's happening inside the frame, providing helpful debugging information as your strategies are being tested.

## Interface IFrameCallbacks

The `IFrameCallbacks` interface lets you hook into important moments within the backtest-kit's timeframe generation process. Specifically, the `onTimeframe` property provides a way for your code to be notified when a new set of timeframes is created. This is incredibly helpful if you want to keep an eye on what timeframes are being used, perhaps for debugging or verifying that the data looks correct. You can use it to log the generated timeframes, perform checks on their validity, or generally gain more insight into how the backtest is structured around time.

## Interface IFrame

The `IFrame` interface helps to define and manage the time periods used in your backtesting simulations. Think of it as the mechanism that figures out exactly *when* your trading strategies will be tested.

Specifically, the `getTimeframe` function is the key part; it's responsible for producing a list of dates or timestamps for a given trading symbol. This list dictates the sequence of moments your strategy will be evaluated against historical data, ensuring consistent spacing based on the interval you've set up. It essentially provides the backbone for scheduling and executing your backtesting process.

## Interface IExecutionContext

The `IExecutionContext` interface holds important details about the current trading environment. Think of it as a little packet of information passed around to your strategies and exchanges during operations. It tells your code things like which trading pair you're working with (the `symbol`), the precise current timestamp (`when`), and whether it's a backtest or a live trading session (`backtest`). This information is automatically provided through the `ExecutionContextService`, so you don't have to worry about manually passing it around.

## Interface IExchangeSchema

This interface describes how backtest-kit interacts with a specific cryptocurrency exchange. Think of it as a blueprint for connecting to a data source and understanding its quirks. 

Each exchange you want to use will need its own implementation of this interface. It defines how backtest-kit retrieves historical candle data (price and volume over time), how it handles quantity formatting (like ensuring you're trading the correct number of coins), and how it presents prices accurately. 

You’re essentially telling backtest-kit where to get the data and how to interpret it. There’s a unique identifier for each exchange, and you can add notes for yourself to remember important details about the connection. You can also provide optional callbacks to react to events as candle data becomes available.

## Interface IExchangeParams

This interface, `IExchangeParams`, sets up the fundamental information needed when creating an exchange within the backtest-kit framework. Think of it as a way to configure how your exchange interacts with the backtesting environment. It requires a logger to help you track what's happening during the backtest and an execution context that provides key details about the environment, like the trading symbol and the timeframe you're testing. Essentially, it establishes the foundation for your exchange's behavior within the backtest simulation.

## Interface IExchangeCallbacks

This interface lets you listen for incoming candlestick data from an exchange. If you want your backtest to react to new price data as it arrives, you can provide functions that match these callbacks. Specifically, `onCandleData` is triggered whenever the backtest kit retrieves candlestick information – you're given the symbol, the interval (like 1 minute or 1 day), the starting date, the number of candles requested, and the actual candle data itself. This lets you build real-time visualizations or other dynamic elements during your backtest simulations.

## Interface IExchange

The `IExchange` interface defines how your backtesting framework interacts with an exchange. It allows you to retrieve historical and future candle data, essential for simulating trading strategies.

You can use `getCandles` to pull past candle data, and `getNextCandles` to look ahead and see what future candles might look like – a crucial feature for backtesting.

The `formatQuantity` and `formatPrice` methods ensure that order quantities and prices are correctly formatted to match the exchange’s specific precision rules.

Finally, `getAveragePrice` provides a simple way to calculate the VWAP (Volume Weighted Average Price) based on recent candle data, a common indicator used in trading.

## Interface IEntity

This interface, `IEntity`, serves as the foundation for all data objects that are stored and managed within the backtest-kit framework. Think of it as the common ancestor for things like trades, orders, and account snapshots – it ensures they all share a consistent structure.  If you're creating your own custom data types to be used with backtest-kit, this is the interface you’re likely to implement to ensure compatibility. It's a simple starting point for building your data model.

## Interface ICandleData

This interface represents a single candlestick, which is a common way to organize price data for trading. Each candlestick contains information about the opening price, the highest price reached, the lowest price touched, the closing price, and the volume traded during a specific time interval. The `timestamp` tells you exactly when that time interval began. This data is crucial for backtesting trading strategies and calculating indicators like VWAP.

## Interface DoneContract

The DoneContract interface signals when a background process, whether it's a backtest or a live trade execution, has finished running. It provides key details about what just completed, like the name of the exchange used, the strategy that ran, whether it was a backtest or live execution, and the trading symbol involved. Think of it as a notification package letting you know when something has finished and giving you a summary of the run. This allows you to react to the completion of background tasks and potentially trigger subsequent actions.

## Interface BacktestStatistics

This interface holds all the key statistics calculated after running a backtest. It's your go-to source for understanding how your trading strategy performed. 

You'll find a detailed list of every closed trade (`signalList`), along with the total number of trades executed (`totalSignals`). It tracks how many trades were profitable (`winCount`) and how many resulted in losses (`lossCount`). 

Several performance metrics are provided, including the win rate, which shows the percentage of winning trades. The average PNL per trade (`avgPnl`) and the cumulative PNL across all trades (`totalPnl`) give you a clear picture of profitability. 

To gauge risk, you're provided with the standard deviation of returns (volatility) and the Sharpe Ratio (a measure of risk-adjusted return), with annualized versions as well. The certainty ratio helps assess the difference between winning and losing trades, while the expected yearly returns provide an estimate of yearly profitability based on trade duration. All numerical values are reported as null if the calculation isn't reliable.
