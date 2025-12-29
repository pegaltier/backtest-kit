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

This function, `validate`, helps you double-check that everything is set up correctly before you start running backtests or optimizations. It makes sure all the things your strategies and other components rely on – like exchanges, frames, and sizing methods – actually exist and are properly registered within the system.

You can tell it to validate specific parts, or if you leave it blank, it'll check *everything*. It’s like a quick health check for your trading setup, and it remembers the results so it doesn't have to repeat the work every time. Think of it as a way to catch errors early and prevent unexpected problems during your tests.

## Function setLogger

You can now control how backtest-kit reports its activities. This function lets you provide your own logging mechanism, like writing to a file, sending logs to a central server, or integrating with existing logging infrastructure. The framework will automatically include helpful details in each log message, such as the trading strategy name, the exchange being used, and the specific symbol being traded, giving you more context for debugging and analysis. Just give it an object that follows the `ILogger` interface, and the framework will handle the rest.

## Function setConfig

This function lets you adjust the overall settings for your backtesting environment. Think of it as fine-tuning how the backtest-kit operates. You can selectively change certain configuration values – you don’t need to provide everything all at once. There's also a special flag, `_unsafe`, which allows you to bypass some checks, typically used when working in a testing environment.

## Function setColumns

This function lets you customize the columns displayed in your backtest reports, like the ones generated for markdown. Think of it as tweaking the layout of your report to highlight the data that matters most to you.  You can change how different metrics are presented, overriding the default settings.  It’s important to know that the system checks your changes to make sure they are valid, but there's an option to bypass this check if you’re working in a test environment and need maximum flexibility.

## Function listWalkers

This function lets you see all the different "walkers" that are currently set up within the backtest-kit framework. Think of walkers as individual components that perform specific tasks during a backtest.  It provides a simple way to get a list of these walkers, which is helpful for understanding how your backtest is configured or for creating tools that interact with them programmatically. Essentially, it gives you a peek behind the scenes to see the registered walkers and their configurations.

## Function listStrategies

This function allows you to see all the trading strategies that are currently set up and ready to be used within the backtest-kit framework. Think of it as a way to get a complete inventory of your available strategies. It returns a list containing details about each strategy, which can be helpful for troubleshooting, creating documentation, or building user interfaces that adapt to the strategies you’ve defined. Essentially, it provides a straightforward way to understand what strategies are at your disposal.


## Function listSizings

This function lets you see all the sizing strategies that are currently set up within your backtest environment. It essentially provides a list of all the different ways your trading system is configured to handle order sizes. You can use this to double-check your settings, generate documentation, or even build tools that automatically adjust sizing based on the available options. Think of it as a way to peek under the hood and understand how your system determines how much to buy or sell.


## Function listRisks

This function lets you see all the risk assessments your backtest kit is using. It gathers all the risk configurations you’ve previously defined and presents them in a clear list. Think of it as a way to inspect your risk management setup – it's perfect for troubleshooting or generating a display of your current risk settings. Essentially, it provides a comprehensive overview of how your backtest evaluates potential risks.


## Function listOptimizers

This function lets you see all the optimization strategies currently set up within your backtest kit. Think of it as a way to get a quick overview of what's available for optimizing your trading strategies. It returns a list detailing each optimizer, allowing you to inspect them for debugging purposes or to dynamically display optimization options in a user interface. Essentially, it provides a way to understand the optimization landscape within your backtest environment.


## Function listFrames

This function allows you to see all the different data structures, or "frames," that your backtest kit is using. Think of it as a way to get a complete inventory of the data formats being handled in your trading simulations.  It's a handy tool for understanding what’s going on behind the scenes, creating helpful displays, or ensuring everything is set up correctly. The result is a list describing each frame, letting you know what data each one holds and how it's organized.


## Function listExchanges

This function lets you see a complete list of the exchanges your backtest-kit setup is using. It’s a handy way to confirm that all your exchanges are correctly registered, especially when you're setting things up or troubleshooting. The result is an array of information describing each exchange, which you can use for various purposes like creating a menu of available exchanges or checking for specific configurations. Think of it as a quick inventory of your trading environments.

## Function listenWalkerProgress

This function lets you keep track of how a backtest is progressing. It provides updates after each trading strategy finishes running within the backtest. The updates are delivered in the order they happen, and the system handles the processing of these updates sequentially, even if your update handling code takes some time. This ensures that updates are processed reliably without issues from running things at the same time. You provide a function that will be called with information about the progress, and the function returns another function that you can call to stop listening for these updates.

## Function listenWalkerOnce

This function lets you set up a listener that reacts to changes happening within a trading simulation, but only once. You provide a condition – a filter – to specify what kind of change you’re interested in, and a function to run when that condition is met. Once the condition is met and your function has run, the listener automatically stops, so you don't need to worry about cleaning it up. Think of it as a temporary alert system for specific events within your backtest.

It's useful when you need to respond to a particular situation, like a specific trade being executed or a certain metric reaching a threshold, and then you don't need to monitor anymore. 

The `filterFn` determines if the event should trigger your callback function `fn`.

## Function listenWalkerComplete

This function lets you be notified when a backtest run finishes. It's especially useful if you're dealing with asynchronous operations within your completion handler, as it ensures those operations happen one after another, preventing any conflicts. You provide a function that will be called when the backtest completes, and this function will return another function that you can use to unsubscribe from these notifications later. The event you receive will contain information about the completed backtest.

## Function listenWalker

This function lets you track the progress of a backtest as it runs. It calls a function you provide after each strategy within the backtest has finished executing. The function will be called in the order that the strategies complete, and it handles any asynchronous operations within the callback sequentially to avoid issues with concurrent processing. Think of it as getting notified after each strategy is done, one at a time. You give it a function to run when an event happens, and it returns a function you can use to unsubscribe later.

## Function listenValidation

This function lets you keep an eye on potential problems during risk validation. It’s like setting up a listener that gets notified whenever a validation check throws an error. This is super helpful for spotting and fixing issues as they happen, especially when dealing with asynchronous processes.  The listener guarantees that errors are handled one at a time, ensuring stability and order. You provide a function that will be called whenever a validation error occurs.

## Function listenSignalOnce

This function lets you set up a listener that will react to specific events but only once. You provide a filter that defines which events you're interested in, and a function that will be executed when a matching event occurs. After that single execution, the listener automatically stops, which makes it great for situations where you need to wait for something to happen just one time. It's a clean way to handle single-occurrence events within your trading strategy.

## Function listenSignalLiveOnce

This function lets you temporarily listen for specific trading signals coming from a live backtest. You provide a filter that defines which signals you're interested in, and a callback function that will run *once* when a matching signal arrives.  Once the callback has executed, the listener automatically stops listening, ensuring you don’t get any more signals unexpectedly. It’s perfect for quickly reacting to a single event during a live simulation.


## Function listenSignalLive

This function lets you tap into the live trading signals generated by backtest-kit. Think of it as subscribing to a stream of updates as your strategy executes. 

It provides a way to react to the strategy's actions in real-time, like when it places an order or updates its positions. 

Crucially, these signals are processed one at a time, ensuring that you receive them in the order they happen. This is particularly useful when dealing with events that need to be processed sequentially. 

You give it a function that will be called whenever a new signal event arrives, and it returns a function that you can use to unsubscribe later when you're done listening. Remember, it only works with signals generated by `Live.run()`.

## Function listenSignalBacktestOnce

This function lets you tap into the signals generated during a backtest run, but with a twist – it's a one-time listener. You provide a filter to specify which signals you're interested in, and a function to handle those signals. Once the matching signal arrives, your function runs, and the listener automatically stops, ensuring it doesn't interfere with subsequent backtest executions. Think of it as a quick, focused reaction to a specific event within your backtest.


## Function listenSignalBacktest

This function lets you tap into the flow of a backtest to react to what’s happening. It's like setting up a listener that gets notified whenever a signal is generated during a backtest run.

Think of it as a way to observe the backtest's progress and do something with the data, like logging it, displaying it, or triggering another action.

The important thing to know is that these notifications happen one after another, in the order they were created. You’ll only receive these events when you’re actually running a backtest using the `Backtest.run()` function. To stop listening, the function returns a function that you can call to unsubscribe.

## Function listenSignal

This function lets you register a listener that gets notified whenever your trading strategy produces a signal, like when it decides to buy, sell, or hold an asset.  It ensures that these notifications are processed one at a time, even if your listener function needs to do some asynchronous work, preventing any potential conflicts.  You provide a function that will be called with details about the signal event (idle, opened, active, or closed), and this `listenSignal` function returns another function that you can call later to unsubscribe from those notifications.

## Function listenRiskOnce

This function lets you set up a listener that reacts to risk-related events, but only once. You provide a filter – a rule that determines which events you're interested in – and a function to execute when a matching event occurs. After that function runs once, the listener automatically stops itself, which is perfect if you need to respond to a specific risk condition just one time and then move on. It’s a clean way to react to single occurrences of risk events within your trading strategy.

## Function listenRisk

This function lets you react whenever your trading strategy's signals are blocked because they violate risk constraints. Think of it as a notification system specifically for when your risk management system says "no." It only sends alerts when a signal is rejected, so you won’t be bombarded with unnecessary messages for signals that are perfectly fine.  The messages are delivered one at a time, ensuring that any processing your code does on these alerts happens in a controlled order, even if that processing involves asynchronous operations. To stop listening for these risk rejection events, the function returns another function you can call.


## Function listenPingOnce

This function lets you react to specific ping events, but only once. You provide a filter to identify the events you're interested in, and a function to execute when a matching event arrives. After that one execution, the listener automatically stops, so you don't have to worry about cleaning up. It's a handy way to wait for a certain ping condition to occur and then respond.

You give it two things: a filter that checks if a ping event is what you want, and a function that does something when that event happens. The function will run just once when a matching ping comes through.


## Function listenPing

The `listenPing` function lets you keep an eye on signals that are waiting to be activated within the backtest-kit framework. It's like setting up a little observer that gets notified every minute while a signal is in this "waiting" phase. This is incredibly useful if you need to track the progress of a signal's activation or implement your own custom monitoring checks during this time. You provide a function that will be called each time a ping event occurs, giving you access to details about the signal. When you're done observing, the function returns another function that you can use to unsubscribe and stop receiving those ping events.

## Function listenPerformance

This function lets you keep an eye on how your trading strategies are performing in terms of speed and efficiency. It essentially sets up a listener that gets triggered whenever a strategy executes a task and records performance data. Think of it as a way to spot any slow parts in your code – maybe a particular calculation or data fetch is taking longer than it should.

The listener function you provide will receive these performance snapshots, and it’s designed to handle them even if your function takes some time to process. Importantly, it guarantees that these snapshots are processed one at a time, preventing any issues that could arise from trying to handle them all at once. This helps you pinpoint where your strategies might be struggling to run smoothly.


## Function listenPartialProfitOnce

This function lets you set up a one-time alert for when a specific partial profit condition is met during your backtest. You provide a filter – essentially, a rule – that describes the profit level you’re looking for. When that condition is met, a function you specify will run just once, and then the alert automatically disappears. It's perfect if you need to react to a particular profit target just one time and don't want to keep listening afterward. 

You give it two things: first, the rule to identify the profit you're interested in, and second, the action you want to take when that profit is reached.


## Function listenPartialProfit

This function lets you keep track of your trading progress as you reach profit milestones, like 10%, 20%, or 30% gains. It sends you notifications whenever these milestones are hit. The key thing is that these notifications are handled one at a time, even if the process of handling them takes some time – this ensures everything stays organized and prevents conflicts. You provide a function that will be called with details about each partial profit event.

## Function listenPartialLossOnce

This function lets you react to specific partial loss events—think of it as setting up a temporary alert. You provide a filter that describes the exact loss conditions you’re interested in, and a function to execute when that condition is met. The beauty is that it automatically unsubscribes after the callback runs just once, so you don't have to worry about managing subscriptions. It’s perfect when you need to respond to a certain loss happening just one time and then move on.

It takes two parts: a filter to narrow down the events you care about and a function that will be called when a matching event occurs. After that function runs, the subscription stops.

## Function listenPartialLoss

This function lets you keep an eye on how much your trading strategy is losing during a backtest. It sends you notifications when the losses hit certain milestones, like 10%, 20%, or 30% of the initial capital. The important thing is that these notifications are handled one at a time, even if the code you provide to handle them takes some time to run, ensuring things stay in order. You provide a function that gets called whenever a loss milestone is reached, and this function returns another function which you can use to unsubscribe from these notifications later.


## Function listenOptimizerProgress

This function lets you keep track of how your optimizer is doing as it runs. It will send you updates as the optimizer processes data, ensuring that each update is handled one at a time, even if the update needs some extra time to process. Think of it as a way to get progress reports from your optimizer, delivered in a controlled and sequential manner. You provide a function that will be called with each progress update, and this function will return another function you can use to unsubscribe from these progress reports later.

## Function listenExit

This function lets you be notified when a critical error occurs that will halt the backtest or live trading process. Think of it as an emergency alert – it's for situations so severe they stop everything.  It's different from handling regular errors because these are problems that can't be recovered from. The notifications are handled in the order they happen, and your code to respond to the error will run safely, one step at a time, even if it involves asynchronous operations. To use it, you provide a function that will be called when a fatal error happens, and it returns a function to unsubscribe from these notifications later.

## Function listenError

This function lets you set up a system to catch and handle errors that happen during your trading strategy's execution, but aren't critical enough to stop everything. Think of it as a safety net for issues like temporary API problems.

When an error occurs, this function will call your provided function, allowing you to log it, retry the operation, or take other corrective actions. Importantly, it handles these errors in a controlled way, ensuring that they're processed one at a time and don't disrupt the overall flow of your backtest. You define the specific action to take when an error pops up by providing a function as input.

## Function listenDoneWalkerOnce

This function lets you react to when a background process within your backtest finishes, but only once. You provide a filter – a way to specify which completion events you're interested in – and then a function that will be executed when a matching event occurs. Once that function has run, the subscription automatically stops, so you don't have to worry about cleaning it up yourself. Think of it as setting up a temporary listener that fires only once for a specific type of completion.


## Function listenDoneWalker

This function lets you keep track of when background tasks within a Walker finish running. It’s like setting up a notification system – whenever a background task is done, the function will call a piece of code you provide.  

Importantly, even if the code you provide takes some time to run (like if it's doing something asynchronous), the notifications will be handled one at a time, in the order they come. This prevents things from getting messy and ensures a more predictable flow. You get back a function that you can call to unsubscribe from these notifications when you no longer need them.

## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running within your backtest. Think of it as setting up a listener that waits for a specific type of completion signal from a background process.  You can use a filter to specify exactly which completion events you’re interested in – it’s like saying, "Only notify me when *this* specific background task is done."  Once the matching event occurs, the function will run your provided callback function just once, and then automatically stop listening, keeping your code clean and efficient. This is useful for actions you only want to take once a particular background process is finished.


## Function listenDoneLive

This function lets you listen for when background tasks run by Live finish processing. It’s useful if you need to react to the completion of those tasks.  The events are delivered one at a time, even if the function you provide to handle them takes some time to run, ensuring things happen in the order they're received. It also prevents multiple callbacks from running at the same time. You give it a function that will be called when a task finishes, and it returns another function you can use to unsubscribe from those events later.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but only once. You provide a filter to specify which backtest completions you're interested in, and a function to run when a matching backtest is done.  The function automatically takes care of stopping the listening process after it runs your function once, so you don't have to manage subscriptions manually. Think of it as a one-time notification system for backtest completions. 

It's helpful when you need to perform a single action based on a specific backtest's outcome and don't want to be bothered by subsequent completions.


## Function listenDoneBacktest

This function lets you be notified when a background backtest finishes running. It's designed to handle the completion smoothly, even if the notification process involves asynchronous operations.  You provide a function (`fn`) that will be called when the backtest is done, and it will execute that function one at a time to avoid any unexpected conflicts. Think of it as a reliable way to know when your backtest has fully completed and you can move on to the next step.

## Function listenBacktestProgress

This function lets you keep an eye on how a backtest is running. It sends updates as the backtest performs calculations, giving you a progress report. Importantly, these updates are handled one at a time, even if your progress-checking code takes some time to process each update. You provide a function that will be called with each progress update, and the function returns another function that you can call to stop listening.

## Function hasTradeContext

This function simply tells you if the trading environment is ready for you to execute actions. It confirms that both the execution context and the method context are currently active. You'll need this to be true before you can use important functions like getting candle data or formatting prices—basically, before interacting with the exchange in a meaningful way. Think of it as a quick check to ensure everything is set up correctly before you proceed.

## Function getMode

This function tells you whether the backtest-kit is running in backtest mode, where you're analyzing historical data, or in live mode, where it's actually trading. It returns a simple indication – either "backtest" or "live" – so you can adjust your code's behavior depending on the environment. This helps ensure your trading logic works correctly regardless of whether you're testing or actively trading.

## Function getDefaultConfig

This function gives you a starting point for configuring your backtesting environment. It provides a set of preset values for various settings, like how often to check for new signals, retry limits when fetching data, and default slippage/fee percentages. Think of it as a template—you can copy these values and then customize them to fine-tune your trading strategies. It's a great way to understand all the options available and what reasonable defaults look like.

## Function getDefaultColumns

This function provides a quick way to get the standard column setup used for generating reports. Think of it as a template—it shows you all the column types (like performance metrics, risk events, and strategy results) that are typically included and how they're structured by default. It's a great resource to understand the possibilities when you're customizing your report's appearance. You can look at this configuration to see what columns exist and how they are defined initially.

## Function getDate

This function, `getDate`, gives you the current date within your trading strategy. It's a simple way to know what date your code is operating on. When you're running a backtest, it will return the date associated with the specific historical timeframe you’re analyzing. If you're running live, it will provide the current, real-time date.

## Function getConfig

This function lets you peek at the settings that control how backtest-kit operates. It provides a snapshot of all the global configuration values, like how often it checks for new signals, retry settings for fetching data, and limits on signal lifespans.  Importantly, it returns a copy of the configuration, so you can look at the values without accidentally changing the system's core settings. Think of it as a read-only view into the framework's operational parameters.

## Function getColumns

This function gives you a look at how your backtest reports are structured, specifically which data columns are being used. It provides details on columns for closed trades, heatmaps, live data, partial fills, performance metrics, risk events, scheduled events, walker signals, and strategy results. Importantly, it provides a copy of the column configuration, so you can examine it safely without changing anything. Think of it as a peek behind the curtain to see exactly what data is being presented in your reports.

## Function getCandles

This function lets you retrieve historical price data, like open, high, low, and close prices, for a specific trading pair. You tell it which trading pair you're interested in (like BTCUSDT), how frequently you want the data (every 1 minute, 5 minutes, hourly, etc.), and how many data points you need. It pulls this data from the connected exchange and returns it to you as a list of candle data objects. Think of it as requesting a historical chart for a particular asset.

## Function getAveragePrice

This function helps you determine the Volume Weighted Average Price, or VWAP, for a specific trading pair like BTCUSDT. It looks at the most recent five minutes of trading data to figure this out. 

Essentially, it considers both the price and the volume of each trade to give you a more representative average price. If there's no trading volume recorded, it falls back to calculating a simple average of the closing prices instead. You just need to provide the symbol of the trading pair you’re interested in to get the VWAP.

## Function formatQuantity

This function helps you prepare the right amount of assets for a trade, ensuring it adheres to the specific rules of the exchange you're using. It takes a trading symbol like "BTCUSDT" and a raw quantity number as input. Then, it automatically figures out how many decimal places are needed based on that symbol, so you don’t have to worry about manually calculating it. This function takes care of the formatting for you, making sure your orders are valid and accepted by the exchange.


## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes a symbol like "BTCUSDT" and a raw price number as input. Then, it automatically formats the price to use the right number of decimal places based on the exchange's specific rules. This ensures that your displayed prices are always accurate and consistent with the exchange's standards, removing the guesswork about how many decimal places to show.

## Function dumpSignal

This function helps you save detailed logs from your AI trading strategies, making it easier to understand and debug their decisions. It takes the signal ID, the conversation history with the LLM, and the final signal generated as input. 

The function then organizes this information into a set of markdown files, including the initial system prompt, each user message, and the LLM’s final output along with signal data. These files are placed in a directory named after the signal ID.

To prevent accidental data loss, the function will only create the directory if it doesn't already exist. You can specify a custom output directory if you want to store these logs elsewhere, otherwise, they'll be saved under a "dump/strategy" folder. It’s perfect for AI strategies needing a clear record of their reasoning and the signals they produce.


## Function addWalker

This function lets you register a "walker" which is a powerful tool for comparing different trading strategies against each other. Think of it as setting up a system to run several backtests simultaneously, using the same historical data for a fair comparison. You provide a configuration object, `walkerSchema`, to define how the walker should operate, specifying details about the strategies and the metric used to evaluate their performance. Essentially, it streamlines the process of benchmarking multiple strategies to see which ones perform best.

## Function addStrategy

This function lets you tell backtest-kit about a new trading strategy you’ve created. Think of it as registering your strategy so the framework knows how to use it during backtesting or live trading. When you register a strategy, the framework automatically checks it to make sure the signals it generates are valid and consistent – things like prices, take profit/stop loss calculations, and timestamps all get verified. It also helps prevent your strategy from sending too many signals too quickly, which can cause problems. And if you're running in live mode, it makes sure your strategy’s data is saved safely even if something unexpected happens. You'll need to provide a configuration object that defines how your strategy works, this object conforms to the `IStrategySchema` interface.

## Function addSizing

This function lets you tell backtest-kit how to determine the size of your trades. It’s how you set the rules for how much capital you’ll allocate to each position. You provide a configuration object that specifies things like whether you want to use a fixed percentage, a Kelly Criterion, or something based on Average True Range (ATR) to calculate your position size.

The configuration also includes details about risk tolerance – things like how much of your capital you’re willing to risk per trade and multipliers for methods like the Kelly Criterion and ATR.  You can even set limits on the minimum and maximum position sizes or restrict the total percentage of your capital used in any one position. Finally, you can specify a callback function to be executed during the sizing calculation process.

## Function addRisk

This function lets you set up how your trading strategies manage risk. Think of it as defining the guardrails for your trading system. You can specify limits on the number of positions your strategies can hold at once, and even create custom checks to ensure your portfolio stays healthy – for example, tracking correlations between assets. The cool thing is, these risk rules are shared between all your strategies, allowing for a more coordinated and comprehensive risk assessment. This helps prevent your strategies from taking on too much risk individually, and makes sure they’re all working together safely. You can also define callbacks that trigger when a trade is rejected or approved based on these risk rules.


## Function addOptimizer

This function lets you tell the backtest-kit system about a new way to automatically generate trading strategies. Think of it as adding a recipe to the framework – this recipe outlines how the system will collect data, interact with a language model, and create the code for a complete trading strategy. The optimizer essentially builds a whole backtest setup, including all the necessary components like exchange settings, trading rules, and the logic to analyze data across different timeframes.  It then packages everything up into a single file ready to be run.  You provide a configuration object that tells the system how your optimizer works.

## Function addFrame

This function lets you tell backtest-kit about a new timeframe you want to use for your backtesting. Think of it as registering a new way to slice up your historical data. You provide a configuration object that describes the start and end dates for your backtest, the interval (like daily, hourly, etc.) you want to use, and a function that will actually generate those timeframes. Essentially, it's how you define how your backtest will be broken down into individual trading periods. The `frameSchema` object holds all this important information.

## Function addExchange

This function lets you tell backtest-kit about a new data source, like a cryptocurrency exchange or a stock market. Think of it as introducing the framework to where it will pull price data from. You provide a configuration object that defines how to fetch historical candle data, how to format prices and quantities, and how to calculate things like VWAP (Volume Weighted Average Price). Basically, it's how you connect backtest-kit to the specific market you want to test your trading strategies against.

