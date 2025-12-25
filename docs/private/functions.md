---
title: private/functions
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


# backtest-kit functions

## Function validate

This function helps you make sure everything is set up correctly before you start running tests or optimizations. It checks that all the components you're using – like your exchanges, trading strategies, and risk management systems – are properly registered within the framework. 

You can specify which components to check, or let it check everything for a complete verification. The system remembers the results of these checks, so it doesn't have to repeat them unnecessarily. Think of it as a quick health check for your trading setup. It's a good practice to run this before kicking off any backtests to catch potential errors early.

## Function setLogger

This function lets you plug in your own logging system to backtest-kit. It’s a way to customize how the framework reports information, like strategy execution details or exchange activity. When you provide a logger, all the framework’s internal messages will be sent to it, automatically including useful context such as the strategy name, exchange used, and the trading symbol. This makes it easier to monitor and debug your backtesting process. You’ll need to create a logger that adheres to the `ILogger` interface.

## Function setConfig

This function lets you adjust how backtest-kit operates by changing its core settings. You can tweak things like the default data source or how orders are handled. It’s designed to let you override the standard setup, and if you're running tests and need to bypass certain checks, there's an option for that too. Think of it as fine-tuning the engine before your backtesting begins.

## Function setColumns

This function lets you customize the columns that appear in your backtest reports, like those generated for markdown. It lets you change how the data is displayed, overriding the default settings.  You provide a configuration object with the changes you want, and the system checks to make sure everything is structurally sound. There's also a special flag to skip those checks, which is only needed in certain testing scenarios.

## Function listWalkers

This function lets you see all the trading strategies, or "walkers," that are currently set up in your backtest environment. It gives you a list of their configurations, which is helpful if you want to understand what's running, create a tool to display them, or just double-check everything is as it should be. Think of it as a way to peek behind the curtains and see the blueprint of your automated trading system. You'll get back a list describing each walker.

## Function listStrategies

This function gives you a way to see all the trading strategies that are currently set up within your backtest-kit environment. It essentially provides a list of all the strategies you’ve added, allowing you to inspect their configurations or use that information to build tools that interact with them. Think of it as a handy tool for understanding what's running and making sure everything is as expected. It returns a promise that resolves to an array of strategy schemas, which contain details about each strategy.

## Function listSizings

This function lets you see all the sizing strategies that are currently set up within your backtest environment. It gathers all the sizing configurations you’ve added using `addSizing()` and presents them in a neatly organized list. Think of it as a way to check what sizing rules are in play or to build tools that need to know about all available sizing options. It’s a handy tool for understanding your system's behavior or creating user interfaces that adapt to the configured sizing schemes.


## Function listRisks

This function lets you see all the risk assessments that have been set up within your backtest. It gathers all the risk configurations you've previously defined using `addRisk()`. This is helpful if you’re trying to understand how your system is evaluating risk, create tools to display these risk assessments, or just double-check your setup. The function returns a list of these risk configurations, allowing you to inspect them programmatically.

## Function listOptimizers

This function lets you see all the different optimization strategies currently set up within your backtest kit. Think of it as a way to check what tools are available to automatically find the best trading parameters. It returns a list describing each optimizer, giving you information about their configuration and what they can do. This is helpful if you're trying to understand how your system is set up or want to create a user interface to manage different optimization runs.

## Function listFrames

This function gives you a peek at all the different data structures, or "frames," that backtest-kit understands. It's like getting a catalog of all the building blocks it uses to process data. You can use this to see what kind of information is available, to help with troubleshooting, or even to build tools that interact with the framework in a flexible way. The result is a list describing each frame.


## Function listExchanges

This function lets you discover all the exchanges your backtest-kit setup knows about. It returns a list describing each exchange, like its name and supported markets. Think of it as a way to see what trading venues your framework is configured to work with. It's handy for checking your configuration, building interfaces that adapt to different exchanges, or just understanding what's available.


## Function listenWalkerProgress

This function lets you track the progress of your backtesting simulations. It provides updates after each strategy finishes running within the backtest.  You give it a function that will be called with details about the completed strategy, and it ensures these updates happen one at a time, even if your function takes some time to process. Think of it as a way to get notified as your backtest progresses, with a guarantee that the notifications are handled in order and without causing conflicts. The function returns another function you can call to stop listening for these progress updates.

## Function listenWalkerOnce

This function lets you temporarily watch for specific progress updates from a trading simulation. It’s like setting up a temporary alert – you provide a rule (the `filterFn`) that defines what kind of update you're looking for, and a function (`fn`) that will run exactly once when that update happens.  After it runs once, the alert automatically disappears, so you don't have to worry about managing the subscription yourself. This is handy when you just need to react to a single, particular event during the backtest.

You give it two things: a filter to decide which events matter and a function to run when a matching event occurs.  The function you provide will only execute once when the filter matches an event, and then the subscription stops automatically.


## Function listenWalkerComplete

This function lets you be notified when a backtest run finishes, ensuring all strategies have been tested. It's like setting up a listener that waits for the entire testing process to conclude. The important thing is that when the testing is done, your code (the callback function you provide) will run, and it will run one step at a time, even if it involves asynchronous operations. This guarantees order and prevents unexpected conflicts. You give it a function to execute, and it gives you back a way to unsubscribe from these notifications later.

## Function listenWalker

The `listenWalker` function lets you keep an eye on how a backtest is progressing. It's like setting up a notification system that tells you when each trading strategy finishes running within a backtest.

You provide a function (`fn`) that will be called for each strategy, and `listenWalker` takes care of making sure these calls happen one at a time, even if your notification function needs to do some processing before continuing. This prevents any potential issues caused by multiple strategies being handled simultaneously. The notifications are delivered in the order they occur during the backtest execution.

## Function listenValidation

This function lets you keep an eye on potential problems during risk validation checks within your backtest. It’s like setting up an alert system; whenever a validation check encounters an error, this function will notify you.  The errors are handled one at a time, ensuring things run smoothly even if your notification process takes some time. You provide a function that gets called when an error occurs, allowing you to debug or track these validation issues.

## Function listenSignalOnce

This function lets you set up a listener that reacts to specific events, but only once. Think of it as setting a one-time alert – you define what kind of event triggers it, and when that event happens, your code runs, and then the listener automatically disappears.  It’s perfect for situations where you need to wait for a particular condition to be met and then perform a single action, without needing to manage the subscription yourself. You provide a filter to specify which events you're interested in, and a function to execute when a matching event occurs.

## Function listenSignalLiveOnce

This function lets you quickly react to specific trading signals coming from a live simulation. It's designed for situations where you need to take action based on a signal just once and then stop listening. You provide a filter – a condition that determines which signals you're interested in – and a function to execute when a matching signal arrives.  The function takes care of subscribing and unsubscribing automatically, so you don't have to worry about cleaning up the subscription manually.  Think of it as a temporary listener that responds to a single event.


## Function listenSignalLive

This function lets you tap into the flow of live trading signals generated by backtest-kit. Think of it as setting up a listener that gets notified whenever a new signal is produced during a live run.

Importantly, it only works with signals coming from `Live.run()`. The signals are delivered one at a time, ensuring they're processed in the order they arrive.

You provide a function – your "callback" – that will be executed each time a new signal arrives. This callback receives a special object containing information about the signal. When you're done listening, the function returns another function that you can use to unsubscribe, effectively stopping the signal delivery.


## Function listenSignalBacktestOnce

This function lets you set up a listener that reacts to specific signals generated during a backtest. It’s designed for situations where you only need to process a signal once and then stop listening. You provide a filter – a test that determines which signals you’re interested in – and a function to execute when a matching signal arrives.  The listener will automatically unsubscribe after it has triggered the provided function once, ensuring it doesn’t continue to run unnecessarily. This is handy for things like logging a specific event or performing a single calculation based on a signal.


## Function listenSignalBacktest

This function lets you tap into the stream of data generated during a backtest run. It's designed to handle events, like trade signals, one at a time, ensuring they're processed in the order they arrive. You provide a function that will be called whenever a signal event occurs, and that function receives details about the event. Think of it as setting up a listener to be notified about what's happening during your backtest. The function returns another function that can be called to unsubscribe from the signal events.


## Function listenSignal

This function lets you set up a listener that gets notified whenever your trading strategy produces a signal – whether it's entering a trade (opened), being active, closing a trade, or going idle.  The key thing is that these signals are handled one at a time, in the order they happen, even if your callback function takes some time to process them.  You provide a function as input, and this function will be called whenever a new signal event occurs. When you’re done listening, the function returns another function that you can use to unsubscribe, so you don't keep getting those signal updates.

## Function listenRiskOnce

This function lets you set up a temporary listener for risk rejection events, but with a twist – it only triggers once. You provide a filter to specify which risk events you’re interested in, and then a function that will run exactly one time when a matching event occurs. Once that single event is processed, the listener automatically stops, so you don't have to worry about cleaning it up yourself. It's perfect for situations where you need to react to a specific risk condition just once and then move on.

Here's a breakdown:

*   You give it a "filter" – essentially, a rule to determine which events should be considered.
*   You also provide a function that will be executed when the filter matches an event.
*   The listener handles itself – it activates, triggers your function once, and then shuts down.


## Function listenRisk

This function lets you be notified whenever a trading signal is blocked because it violates your risk rules. It's designed to be efficient – you only receive notifications when a signal is actually rejected, preventing a flood of updates. The notifications are handled one at a time, ensuring that your code can process them safely, even if your callback function takes some time to complete. Essentially, it's a reliable way to keep track of risk-related issues without being overwhelmed. You provide a function that will be called whenever a risk rejection occurs, and the function returns another function to unsubscribe from these events.

## Function listenPerformance

This function lets you keep an eye on how quickly your trading strategies are running. It acts like a listener, notifying you whenever a performance metric is recorded during the strategy's execution.  You provide a function (`fn`) that will receive these performance updates – it’s a great way to pinpoint slow parts of your code and optimize for speed.  The updates are delivered one at a time, even if your callback function takes some time to process them, ensuring things stay organized and prevent issues caused by multiple callbacks running at once. Think of it as a way to add a performance monitoring system to your backtesting setup.

## Function listenPartialProfitOnce

This function lets you set up a one-time alert for when a specific partial profit level is hit in your trading backtest. You provide a condition – a filter – that defines what triggers the alert, and a function to run when that condition is met. Once the condition is met and the function runs, the alert automatically goes away, so you won't get repeatedly notified. This is handy if you only need to react to a certain profit level once.

It takes two pieces of information: a way to identify the specific partial profit level you're looking for, and what you want to do when that level is reached. The function then takes care of listening for that level, running your action, and then silently stopping itself.


## Function listenPartialProfit

This function lets you monitor your trading strategy's progress as it makes profits. It sends notifications whenever your strategy hits certain profit milestones, like 10%, 20%, or 30% gain. 

The notifications are handled one at a time, even if your handling function takes some time to complete, ensuring things don't get out of order. This helps keep track of your strategy's profitability in a reliable way.

You provide a function that will be called whenever a partial profit is reached; this function receives information about the event. The function you provide will return a function that can be called to unsubscribe from these partial profit notifications.

## Function listenPartialLossOnce

This function lets you set up a listener that reacts to partial loss events, but only once. You provide a condition – a filter – to specify what kind of loss event you're interested in. Once an event matches your condition, the provided callback function will be executed, and the listener will automatically stop listening. It’s handy for situations where you need to respond to a specific loss scenario just one time and then ignore further occurrences. You define both the condition and the action to take when that condition is met.

## Function listenPartialLoss

This function lets you keep track of how much your trading strategy has lost along the way. It sends you notifications whenever your losses hit certain milestones, like 10%, 20%, or 30% of your initial capital. The important thing is that these notifications will be delivered in the order they happen, even if your notification handler takes some time to process each one. To make sure things don't get chaotic, it also makes sure that your notification code runs one step at a time. You provide a function that will be called each time a partial loss event occurs, and this function returns another function that you can use to unsubscribe from the event later.

## Function listenOptimizerProgress

This function lets you keep an eye on how your trading strategy optimizer is doing. It sends updates as the optimizer works, so you can track its progress. These updates are sent in the order they happen, and even if your update handling code takes a little time, it will still run smoothly without getting blocked. Think of it as getting little progress reports as your optimization runs. You give it a function that will be called with each progress report. When you're done watching, you can unsubscribe using the function it returns.

## Function listenExit

The `listenExit` function lets you react to severe errors that will abruptly stop your backtest or live trading processes. Think of it as an emergency alert for critical issues. This isn't for minor hiccups you can recover from; these are problems that halt everything. The errors you receive will be handled in the order they occur, and the function makes sure your response is processed safely, one at a time. You provide a function that will be called when such a critical error happens, giving you a chance to log it, clean up resources, or take other necessary actions. When you're finished listening, the function returns another function that you can call to unsubscribe.

## Function listenError

This function lets your strategy react to errors that happen during its execution, but aren’t critical enough to stop everything. Think of it as a safety net for things like temporary API problems – your strategy can catch the error, handle it, and keep running. The errors are dealt with one at a time, ensuring that your error handling logic isn’t overwhelmed, even if errors pop up quickly.  You provide a function that will be called whenever such an error occurs, giving you a chance to log it, retry the operation, or take other corrective actions. The function also returns an unsubscribe function, allowing you to stop listening to these errors when it’s no longer needed.

## Function listenDoneWalkerOnce

This function lets you react to when a background task within the backtest-kit framework finishes, but only once. You provide a filter to specify which completion events you're interested in, and a function to be executed when a matching event occurs. Once that function runs, the subscription is automatically removed, so you won't receive any further notifications. It’s a convenient way to handle a single completion event and then clean up after yourself.


## Function listenDoneWalker

The `listenDoneWalker` function lets you be notified when background tasks within a Walker are finished. Think of it as setting up a listener that gets triggered when a background process completes.  It guarantees that these notifications happen one after another, even if the notification itself involves some asynchronous work. This makes it perfect for situations where you need to reliably track the progress of these background operations and react to their completion in a controlled sequence. You simply provide a function that will be called when a Walker background task finishes.

## Function listenDoneLiveOnce

This function lets you monitor when a background task initiated by `Live.background()` finishes, but it only runs your code once and then stops listening. You provide a filter function to specify which completed tasks you’re interested in – it determines when your callback gets triggered. Once the filter condition is met and the callback is executed, the subscription is automatically cancelled, preventing further notifications. Think of it as setting up a single, targeted alert for a specific background job completion.

## Function listenDoneLive

This function lets you keep track of when background tasks initiated through `Live.background()` finish running. It's like setting up a notification system for those tasks. The notifications will be delivered one at a time, in the order they completed, even if your notification handling involves asynchronous operations. This ensures that processing happens sequentially and avoids any potential conflicts from running callbacks simultaneously. You provide a function that will be called when a background task is done, and this function returns another function which you can call to unsubscribe from these notifications later.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but only once. You provide a filter to specify which backtest completions you're interested in, and then a function that will run when a matching backtest is done. Once that function has executed, the listener automatically stops, so you don't have to worry about managing subscriptions yourself. It's a simple way to get notified about specific backtest completions and then clean up afterward. 

Here’s how it works:

1.  You give it a filter – a check to see if a completed backtest meets certain criteria.
2.  You give it a function – this is what will actually *do* something when a matching backtest finishes.
3.  It listens for backtest completion events, applies your filter, and calls your function once a match is found. 
4.  After the function runs once, the listener stops listening.

## Function listenDoneBacktest

This function lets you be notified when a background backtest finishes running. It's a way to react to the completion of a backtest that’s happening in the background, like when you don't want to block the main process. The function will call your provided code when the backtest is done, making sure the order of completion events is respected and that your code runs safely, even if it involves asynchronous operations. Essentially, you give it a function to run after a background backtest, and it handles the details of making sure it runs correctly and in the right order.


## Function listenBacktestProgress

This function lets you keep an eye on how a backtest is running. It gives you updates as the backtest progresses, and these updates are delivered one at a time, even if your update handling code takes some time to complete. Think of it as a way to get notified about the backtest's status, ensuring that progress information is processed reliably. You provide a function that will receive these progress updates, and the function returns another function which you can call to unsubscribe from these updates.

## Function hasTradeContext

This function quickly tells you if you’re in a situation where you can actually execute trading actions. Think of it as a check to make sure everything is ready – both the environment for executing trades and the specific method you're trying to use – are properly set up. It returns a simple "yes" or "no" to let you know if it's safe to proceed with tasks like fetching historical price data or calculating trade sizes. Essentially, it verifies that all the necessary pieces are in place before you try to do something related to a trade.

## Function getMode

This function lets you check whether the trading framework is running in backtest mode, which is for testing strategies against historical data, or live mode, where actual trades are being placed. It returns a promise that resolves to either "backtest" or "live", giving you a straightforward way to adapt your code based on the environment it's operating in. You can use this information to enable or disable certain features, log different information, or adjust your strategy's behavior.


## Function getDefaultConfig

This function gives you a starting point for configuring your backtesting environment. It provides a set of pre-defined settings, like how often to check prices or the maximum lifespan of a trading signal. Think of it as a template; you can use these default values as they are, or customize them to fine-tune your backtest. It's a useful way to understand all the adjustable parameters within the system and what their standard values are.

## Function getDefaultColumns

This function provides a quick look at the standard column setups used for creating reports within the backtest-kit framework. It gives you a snapshot of what columns are typically displayed – things like strategy performance, risk metrics, and walker data – and how they're configured by default. Think of it as a template or example to guide you if you want to customize your report's columns. It's a great way to understand what options are readily available before you start building your own custom reports.


## Function getDate

This function, `getDate`, provides a simple way to retrieve the current date within your trading strategy. Think of it as a built-in way to know what date your code is operating on. When running a backtest, it will give you the date associated with the specific historical timeframe you're analyzing. If you're running your strategy live, it will return the actual, real-time date. It's a handy tool for time-based logic in your trading algorithms.

## Function getConfig

This function lets you peek at the overall settings that control how backtest-kit operates. Think of it as a way to see the rules of the game without changing them. It provides values for things like how often the system checks for new signals, retry counts when fetching data, and limits on signal lifespans. The returned configuration is a copy, so you can look at it safely without worrying about accidentally messing up the system's core settings.

## Function getColumns

This function gives you a look at the columns being used to build reports in backtest-kit. Think of it as a way to see what data is being tracked and displayed. It provides different sets of column configurations for various parts of the system, like closed trades, heatmaps, live data, performance metrics, and risk analysis. Importantly, it returns a copy of the configurations, so you can examine them without accidentally changing how the reports are generated.

## Function getCandles

This function lets you retrieve historical price data, like open, high, low, and close prices, for a specific trading pair. You tell it which trading pair you're interested in (like "BTCUSDT"), how often you want the data (every minute, every hour, etc.), and how many data points you need.  It pulls this data directly from the exchange you're connected to. The data will go back from the present moment. Basically, it’s your tool for looking at past price movements to help you understand trends or test trading strategies.

## Function getAveragePrice

This function, `getAveragePrice`, helps you figure out the average price of a trading pair, like BTCUSDT. It determines this average by looking at the volume traded at different price points, essentially calculating a Volume Weighted Average Price, or VWAP.  Specifically, it uses data from the most recent five 1-minute candles to do this calculation, taking into account the high, low, and closing prices alongside the trading volume. If there's no volume data available, it simply calculates the average of the closing prices instead. To use it, you just need to provide the symbol of the trading pair you're interested in.

## Function formatQuantity

This function helps you ensure that the quantity you're sending to an exchange is formatted correctly. It takes a trading symbol, like "BTCUSDT," and a raw quantity number as input. It then applies the specific formatting rules of that exchange to get the quantity into the precise format it expects, handling things like the correct number of decimal places. This prevents errors and makes sure your orders are processed smoothly.


## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes a symbol like "BTCUSDT" and a raw price number as input. It then uses the specific rules of that exchange to format the price with the right number of decimal places, making sure it looks accurate and consistent with how the exchange shows prices. Essentially, it handles the details of price formatting so you don't have to.

## Function dumpSignal

This function helps you save detailed records of your AI trading strategy’s decision-making process. It takes the conversation history between your strategy and the AI, along with the resulting trading signal, and organizes it into easy-to-read markdown files. These files create a clear trail of how the AI arrived at a particular trade, including the prompts, responses, and the final signal details like take profit and stop loss levels. 

The function automatically generates a folder named after a unique signal identifier, containing files for system prompts, individual user messages, and the final LLM output with signal data. It’s designed to be a debugging tool for AI-powered strategies, allowing you to review and analyze the logic behind each trade. If the folder already exists, it won't overwrite anything to preserve past analyses. You can specify an output directory, but if you don't, it will default to a "dump/strategy" folder.


## Function addWalker

This function lets you register a "walker" – essentially a tool that runs multiple trading strategies against the same historical data and then compares how well they did. Think of it as setting up a contest between your strategies to see who comes out on top. To use it, you provide a configuration object describing how the walker should operate, telling it things like what data to use and how to measure success. This allows for a standardized and reproducible comparison of different trading approaches.

## Function addStrategy

This function lets you add a new trading strategy to the backtest-kit framework. Think of it as registering your strategy so the system knows how to use it.  When you add a strategy, the framework automatically checks to make sure it's set up correctly, including confirming the signal data makes sense and preventing it from sending too many signals at once.  If you're running in live mode, it also ensures your strategy’s information is safely saved even if something unexpected happens. You provide a configuration object, `strategySchema`, that defines how your trading strategy operates.

## Function addSizing

This function lets you tell backtest-kit how to determine the size of your trades. It essentially sets up the rules for deciding how much capital to allocate to each position based on your risk tolerance and trading strategy. You provide a configuration object detailing the sizing method you want to use, such as fixed percentage, Kelly Criterion, or ATR-based sizing. The configuration also includes details like risk percentages, multipliers, and constraints to control the position size and ensure it aligns with your overall strategy. Think of it as defining the "how much" part of your trading plan.

## Function addRisk

This function lets you set up how your trading strategies manage risk within the backtest-kit framework. Think of it as defining the rules of the road for your trading – it helps prevent you from taking on too much risk at once. You can specify limits on the number of positions you hold across all your strategies and even create custom checks to ensure your portfolio is healthy.  Because multiple strategies share the same risk configuration, it allows for a holistic view of your risk exposure. The system keeps track of all active positions, which can be used by your custom validation logic.

## Function addOptimizer

This function lets you plug in custom optimizers to power your backtesting process. Think of an optimizer as a system that automatically generates trading strategies based on data and potentially, large language models. It gathers information, crafts prompts, and then creates a complete backtesting file ready to run, complete with all the necessary configurations and logic to analyze your strategies. To use it, you'll provide a configuration object that defines how your optimizer operates.

## Function addFrame

This function lets you tell backtest-kit about a new timeframe you want to use for your backtesting. Think of it as defining a specific period and frequency for your trading data – for example, you might add a frame for daily data from January 1st to December 31st.  It takes a configuration object that outlines the start and end dates, the interval (like daily, weekly, or monthly), and a function that handles any special events related to timeframe generation. Essentially, it’s how you customize the data slices your backtest will analyze.

## Function addExchange

This function lets you tell backtest-kit about a new data source for trading, like a specific cryptocurrency exchange. Think of it as adding a new market to your simulation. You provide a configuration object that describes how to fetch historical price data, how to display prices and quantities, and how to calculate a common trading indicator called VWAP. By registering the exchange, backtest-kit can then use its data when you're building and testing your trading strategies.
