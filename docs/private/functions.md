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

## Function writeMemory

This function lets you store data in a persistent memory space, essentially creating a named container for your trading logic. You provide a bucket name, a unique ID within that bucket, the actual data you want to store (which can be any object), and a brief description to help you remember what's in there. It’s designed to be used within a trading signal – if no signal is active, it won't save the data and will instead display a warning. The system smartly figures out whether it's running a backtest or live trading environment, adapting accordingly.

The data you store is linked to the signal's context, providing a way to maintain state and information across different parts of your backtesting or live trading process.


## Function warmCandles

This function helps prepare your backtesting environment by pre-loading historical candle data. It downloads and stores all the candles for a specified period, from a starting date (`from`) to an ending date (`to`), using a particular time interval. This pre-loading step is useful because it avoids repeatedly fetching the same data during a backtest, which can significantly speed up the process.  You provide parameters to define the date range and interval for the candles you want to cache. Essentially, it’s a way to ensure your backtest has quick access to the historical data it needs.


## Function validate

The `validate` function helps make sure all the pieces of your trading setup are correctly registered before you start any tests or optimizations. 

It checks that the names of things like exchanges, trading strategies, and risk management components all exist where they're supposed to.

You can tell it to validate specific parts of your setup, or just let it check everything to be completely sure. 

The results of these checks are saved to improve how quickly the validation runs if you run it again. Think of it as a final check before things get underway!


## Function stopStrategy

This function allows you to halt a trading strategy's signal generation. It effectively pauses the strategy, preventing it from creating any new trading signals. Existing, active signals will still run to completion. The system will gracefully stop the backtest or live trading session at a convenient point, such as when it’s idle or after the current signal finishes. You don't need to specify whether you're in backtest or live mode – it figures that out automatically based on the environment it's running in. You simply provide the trading pair's symbol to tell it which strategy to stop.

## Function shutdown

This function provides a way to cleanly end a backtest run. It sends out a signal that tells all parts of the backtest to prepare for stopping, allowing them to finish any important tasks like saving data or closing connections. Think of it as a polite way to tell the backtest to wrap up, making sure everything is in order before it exits. It's especially useful when you need to stop the backtest process, like when you press Ctrl+C.

## Function setLogger

You can now control how backtest-kit reports its internal activity by providing your own logger. This lets you direct log messages to a file, a database, or any other logging system you prefer. The framework automatically includes useful details like the strategy name, exchange, and symbol along with each log message, giving you valuable context. Just make sure your custom logger conforms to the `ILogger` interface.


## Function setConfig

This function lets you adjust how the backtest-kit framework operates, allowing you to fine-tune its behavior.  You can change specific settings within the framework by providing a configuration object, which can include just the parts you want to modify, rather than having to redefine everything.  There’s a flag you can use to bypass certain safety checks, primarily intended for use in testing environments where strict validation isn't always necessary. Essentially, it gives you control over the underlying settings of the backtest-kit system.


## Function setColumns

This function lets you customize the columns that appear in your backtest reports, like those generated for markdown output. You can modify the existing column configurations or add entirely new ones to tailor the reports to your specific needs. It's a powerful way to control what data is displayed and how it's organized.  

If you're working in a testbed environment, you might need to use the `_unsafe` flag to bypass some validation checks – but generally, the system ensures your column definitions are structurally sound.

## Function searchMemory

The `searchMemory` function lets you find relevant memory entries based on a search query. It’s designed to quickly retrieve information associated with a signal, using a technique called BM25 to rank the results by how well they match your query.

It automatically figures out if you're running a backtest or live trading and pulls the necessary information, like the trading symbol and signal ID, from the system.  If there isn't a signal currently active, it will alert you and simply return nothing.

The function returns an array of results, each containing the memory's ID, a score indicating how closely it matches your query, and the content of the memory itself. You can specify the type of data stored in the memory to improve type safety.

## Function runInMockContext

This function lets you execute a piece of code as if it were running within a specific trading environment, but without actually needing a full backtest running. Think of it as a sandbox for your code where you can access things like the current timeframe or exchange details.

You can customize this environment by providing values for the exchange name, strategy name, frame name, symbol, whether it's a backtest or live mode, and the relevant timeframe. If you don’t provide these, it will default to a simple setup useful for testing live-like scenarios.

It’s especially handy for writing tests or scripts that rely on context-specific information without needing the overhead of a complete backtest setup. Just pass in the function you want to run, and it will execute within the defined context, returning whatever the function produces.

## Function removeMemory

This function helps you clean up data related to past signal calculations. Specifically, it removes a "memory" entry associated with a particular signal. 

It finds the relevant symbol and signal ID automatically from where it's being run. 

If there isn't a signal to clean up, it'll let you know with a warning and do nothing. The function adapts its behavior depending on whether you're running a backtest or a live trading session.

To use it, you need to provide the name of the data bucket and the ID of the memory entry you want to remove.


## Function readMemory

The `readMemory` function lets you retrieve data stored in memory related to a specific trading signal. Think of it as a way to access previously saved information needed for calculations or decisions. 

It takes an object containing the bucket name (where the data is stored) and the memory ID (the specific data you're looking for). 

This function automatically adapts to whether you’re running a backtest or a live trading session, making it versatile. If no signal is active, you'll get a warning and a null value back, so be sure something is active before attempting to read.


## Function overrideWalkerSchema

The `overrideWalkerSchema` function lets you adjust an existing walker configuration, which is used for comparing different trading strategies. Think of it as a way to tweak a previously defined plan, but only changing the parts you specify. It takes a partial configuration – just the changes you want to make – and returns a complete, updated walker schema. This is useful when you want to experiment with slight variations on a tested strategy without rebuilding everything from scratch.


## Function overrideStrategySchema

This function lets you modify a trading strategy that's already set up within the backtest-kit framework. Think of it as making targeted adjustments – you can update specific settings without needing to redefine the entire strategy. 

You provide a partial configuration object, which tells the framework exactly which parts of the strategy you want to change, and the rest stays as it was originally defined. This is helpful for fine-tuning a strategy or applying small updates.


## Function overrideSizingSchema

This function allows you to adjust an existing position sizing strategy without replacing it entirely. Think of it as making targeted changes to a sizing schema that's already in place. 

You provide a partial sizing configuration – only the settings you want to modify need to be included. 

The original sizing schema will remain mostly intact, with only the provided fields being updated. This is useful for fine-tuning your sizing logic without rewriting everything.


## Function overrideRiskSchema

This function lets you modify a risk management configuration that’s already set up in the system. Think of it as a way to fine-tune an existing setting – you can update specific parts of the configuration without having to rebuild the entire thing.  You just provide the details you want to change, and the function applies those changes, leaving the rest of the configuration untouched.  This is useful when you need to adjust aspects of your risk management rules without a complete overhaul. The input is a partial configuration, meaning you only specify the properties you want to update.

## Function overrideFrameSchema

This function lets you modify an existing timeframe configuration used in backtesting. Think of it as fine-tuning a timeframe – you can change specific settings without rebuilding the entire timeframe definition. It’s particularly useful when you need to adjust a timeframe's properties after it’s already been set up. The function accepts a partial configuration object, meaning you only need to provide the settings you want to change; everything else stays the same. This provides a flexible way to experiment with different timeframe setups without starting from scratch.

## Function overrideExchangeSchema

This function lets you modify how the backtest-kit interacts with a specific exchange's data. Think of it as a way to tweak an existing exchange’s settings without rebuilding it from scratch. You can change just the parts you need, like the data frequency or symbol mapping, while keeping the rest of the exchange's configuration intact. It's useful if you want to adapt an exchange schema to your specific needs without a complete overhaul. You provide a partial configuration object, and the function merges it with the original exchange schema.


## Function overrideActionSchema

This function lets you tweak existing action handlers within the backtest-kit framework without completely replacing them. Think of it as a way to make targeted adjustments. You can change specific parts of an action handler's setup, like its logic or callbacks, while leaving the rest untouched. This is helpful when you need to adapt behavior based on the environment (like development versus production) or simply want to experiment with different approaches without altering the core strategy. The function takes a partial configuration object, and it merges that with the existing handler's configuration.

## Function listenWalkerProgress

This function allows you to monitor the progress of a backtest run. 

It sets up a listener that gets triggered after each strategy finishes during the backtest. 

The listener will be called with information about the completed strategy. 

Importantly, the callback function you provide will be executed one at a time, even if it's an asynchronous function, ensuring a smooth and predictable flow of information. To stop listening, simply call the function returned by `listenWalkerProgress`.

## Function listenWalkerOnce

The `listenWalkerOnce` function lets you temporarily monitor the progress of a trading strategy's walker component. It's designed to react to a specific event happening just once. You provide a filter function that defines which events you're interested in, and a callback function that will be executed when a matching event is detected. Once that single event triggers the callback, the listener automatically stops listening, freeing up resources. This is perfect for situations where you need to wait for a certain condition to be met within the walker's process. 

It takes two arguments: a function that decides which events to listen for, and the function to execute once a matching event is found.  The function returns a function which, when called, unsubscribes the listener.


## Function listenWalkerComplete

This function lets you listen for when the backtest walker finishes running all its strategies. It’s useful if you need to know when the entire backtesting process is complete. 

The function gives you a callback that gets triggered when the walker is done. Importantly, even if your callback does something that takes time (like an asynchronous operation), the events will be processed one at a time in the order they came in, ensuring a predictable sequence. It also manages the order of the events to prevent any unexpected issues caused by multiple events happening simultaneously. To stop listening, the function returns another function that you can call to unsubscribe.

## Function listenWalker

This function lets you keep track of what's happening as a trading strategy runs within a backtest. It provides updates after each strategy finishes executing.

Think of it as a way to monitor the progress of your backtest, receiving information about each strategy as it completes.

Importantly, the updates are handled one at a time, even if your monitoring code takes some time to process each one, ensuring nothing gets missed or overlaps. The function returns another function that you can use to unsubscribe from these updates when you no longer need them.

## Function listenValidation

This function lets you keep an eye on potential problems during risk validation. It's like setting up a listener that gets notified whenever an error occurs while checking signals. This is really helpful for spotting and fixing issues during testing or live trading.

The errors are handled in the order they happen, even if your error handling code takes some time to run. To prevent unexpected behavior, the process is designed to run things one at a time. You give it a function that will be called when an error occurs, and it returns another function that you can use to stop listening.


## Function listenSyncOnce

This function lets you listen for specific synchronization events and react to them just once. Think of it as setting up a temporary listener that only fires when a particular condition is met. 

It’s particularly useful when you need to coordinate with other systems, because it waits for your callback function to finish before continuing with the backtest.  You can specify what events you're interested in with a filter function.  If your function returns a promise, the backtest will pause until that promise resolves, ensuring everything is synchronized. Once the callback has run, the listener is automatically removed, so you don't have to worry about cleanup.

## Function listenSync

This function lets you react to events as they happen during trading signal synchronization, like when a signal is about to be opened or closed. It's particularly helpful if you need to coordinate with other systems or processes.  The key is that any pending trading actions will pause until your function finishes executing – this ensures everything stays in sync. You provide a function that will be called whenever a synchronization event occurs, and that function can even handle asynchronous operations. A warning parameter is available but currently undefined. The function returns another function which when called will unsubscribe you from the event listener.

## Function listenStrategyCommitOnce

This function allows you to temporarily "listen" for specific strategy changes within your backtest. You provide a filter – essentially a rule – to identify the exact events you're interested in. When an event matches that rule, a callback function you define will run just once. After that single execution, the listener automatically stops, so you don't have to worry about cleaning it up. It's perfect for reacting to a one-time event like the initial setup of a strategy.

The filter determines which events trigger the callback.
The callback function then processes the specific event it matches.


## Function listenStrategyCommit

This function lets you keep an eye on what's happening with your trading strategies. It allows you to register a callback function that will be triggered whenever certain actions occur, like when a scheduled trade is cancelled, a trade is closed, or adjustments are made to stop-loss or take-profit levels. The callback function will receive information about the specific event that triggered it.

Importantly, these events are handled in the order they come in, and even if your callback function does some work asynchronously, the framework ensures that it completes before the next event is processed. This prevents conflicts and makes sure everything runs smoothly. You can unsubscribe from these events when you no longer need them by returning a function from `listenStrategyCommit`.


## Function listenSignalOnce

This function lets you temporarily listen for specific signal events from your trading strategy. You provide a filter that defines which events you’re interested in, and a function to execute when a matching event occurs.  The function automatically stops listening after that one event, which is handy if you only need to react to a particular condition once. Think of it as a quick, temporary subscription to a specific signal.


## Function listenSignalLiveOnce

This function lets you subscribe to live trading signals, but with a twist: it only delivers one event and then automatically stops listening. Think of it as a quick, single-use subscription. You provide a filter to specify which signals you're interested in – only signals matching that filter will trigger the callback function you define. This is especially helpful for things like taking a single snapshot of data from a live trading simulation. Once the event is received and the callback executed, the subscription is automatically cancelled, preventing further processing of signals.


## Function listenSignalLive

The `listenSignalLive` function allows you to receive real-time updates from a live trading strategy execution.  It’s designed for when you need to react to signals as they happen during a live run.  You provide a function that will be called each time a new signal is generated, with the signal data being passed as an argument.  Importantly, these signals are processed one after another, guaranteeing order, and they are only available when the trading strategy is actively running with `Live.run()`. This function returns a cleanup function that can be called to unsubscribe from the signals.


## Function listenSignalBacktestOnce

This function lets you temporarily hook into the backtesting process to react to specific events. You provide a filter—essentially a rule—to determine which events you're interested in. Once an event matches your filter, a callback function you provide will run just once, and then the connection is automatically closed. It's a clean way to observe a single event during a backtest run without lingering subscriptions.


## Function listenSignalBacktest

This function lets you tap into the flow of a backtest and react to what’s happening as it runs. It's like setting up an observer that gets notified whenever the backtest generates a signal event.

You provide a function that will be called with each event—essentially, you’re defining what you want to do with each notification. These events come directly from a `backtest.run()` execution, ensuring they are tied to the actual testing process.

Importantly, the events are handled one at a time, in the order they arrive, so your reaction function will be executed sequentially. This allows for predictable and controlled responses to the backtest's progress. When you no longer need to listen for these events, the function returns another function that you can call to unsubscribe.

## Function listenSignal

The `listenSignal` function lets you tap into all the signals generated during a backtest, such as when a trade is idle, opened, active, or closed. It's a convenient way to monitor what's happening with your trading strategy. 

Importantly, the events are processed one at a time, in the order they arrive, even if the function you provide to handle them takes some time to complete. This ensures that your callback function won't run concurrently with other events, preventing potential issues. 

You provide a function as an argument to `listenSignal`; this function is then called each time a signal event occurs, giving you access to detailed information about that event. The `listenSignal` function itself returns a function that you can call to unsubscribe from these signals later.


## Function listenSchedulePingOnce

This function lets you react to specific ping events, but only once. It’s like setting up a temporary listener that will trigger a function when a particular condition is met.

The `filterFn` helps you define exactly which ping events you're interested in – only those that match your criteria will trigger the callback. Once the callback function has run once for a matching event, the listener automatically stops listening, so you don’t have to worry about managing the subscription yourself. This is perfect for situations where you need to react to something happening just one time. 

You provide a function that determines which events are relevant (`filterFn`) and another function that handles the event when it's matched (`fn`). The result is a function that you can call to unsubscribe the listener.

## Function listenSchedulePing

The `listenSchedulePing` function lets you receive updates about scheduled signals as they're being monitored, specifically while they're waiting to become active. Think of it as a heartbeat signal – it sends a notification every minute to let you know the scheduled signal is still being watched. You provide a function that gets called with each of these updates, allowing you to implement custom monitoring or track the progress of the scheduled signal's lifecycle. This subscription can be cancelled by the function it returns.

## Function listenRiskOnce

The `listenRiskOnce` function lets you monitor risk rejection events and react to them, but only once. Think of it as setting up a temporary listener that waits for a specific condition to be met, performs an action, and then disappears. You provide a filter to determine which events you’re interested in, and a function to execute when that event occurs. Once the event is processed, the listener automatically stops listening, ensuring you don't get repeatedly triggered by the same condition.

This is a great way to handle situations like waiting for a particular risk level to be triggered before initiating a specific action, and then cleaning up the listener afterwards. 

It returns a function that you can call to stop the listener early if you need to.

## Function listenRisk

This function lets you be notified whenever a trading signal is blocked because it fails a risk check. 

Think of it as a way to react to situations where your trading strategy would violate your risk rules.

It's designed to be efficient – you'll only receive these notifications when a risk validation *fails*, not when everything is working as expected. 

The notifications are handled in the order they arrive, and your callback function will be executed one at a time, even if it's a complex or time-consuming operation. This ensures that risk management isn't bypassed by asynchronous code.

To use it, you provide a function that will be called with the details of the rejected risk event. The function you provide will also return a function to unsubscribe from the risk rejection event.

## Function listenPerformance

This function lets you keep an eye on how long different parts of your trading strategy take to run. It listens for "performance events" – basically snapshots of timing data collected during the execution of your strategy.

Think of it as a way to profile your code and pinpoint slow areas that might be hurting your backtesting results. The callback function you provide will be called whenever a performance event happens, allowing you to log, analyze, or react to these events.

A key feature is that the callbacks are processed one at a time, even if they're asynchronous, ensuring reliable and sequential event handling. This queued approach prevents issues from multiple callbacks running simultaneously.


## Function listenPartialProfitAvailableOnce

This function lets you set up a one-time alert based on your trading strategy's profit levels. It listens for specific events indicating a partial profit has been reached, but only triggers your callback function once and then stops listening. Think of it as a quick, targeted notification for a particular profit condition you’re watching.

You provide a filter to define exactly what events should trigger the notification, and then a function to execute when that specific event occurs. After the function runs once, the subscription is automatically canceled, preventing further callbacks. This is handy for situations where you only need to react to an event once.

The filter function determines which events are of interest, and the callback function handles the actual action when the event happens.


## Function listenPartialProfitAvailable

This function lets you be notified when a trade hits specific profit milestones, like 10%, 20%, or 30% gain. It ensures that when a profit milestone is reached, your code receives an event. Importantly, it handles these events one at a time to prevent any issues if your code takes a bit of time to process each notification. You provide a function that gets called with details about the trade and the profit level reached. The function you provide also returns a cleanup function that can be used to unsubscribe.


## Function listenPartialLossAvailableOnce

This function lets you react to specific changes in your trading account’s partial loss level, but only once. You provide a rule – a filter – to identify the exact events you’re interested in, and a function that will be run when that event occurs. Once the event matches your rule, the provided function executes and the listener automatically stops listening. It's great for responding to a particular loss condition just one time, then moving on.

You define what conditions trigger the reaction with the `filterFn`, and the function you want to execute when that condition is met with `fn`.

## Function listenPartialLossAvailable

This function lets you monitor your trading strategy's losses as they happen. It will notify you when the loss level hits specific milestones, like 10%, 20%, or 30% loss. 

Crucially, the events are handled in the order they occur, even if your callback function takes some time to complete.  To ensure things run smoothly and avoid problems from too many things happening at once, it uses a system that processes these notifications one after another.

You simply provide a function that will be called each time a milestone is reached, and this function will receive information about the event.  When you’re done listening, you can unsubscribe using the function that’s returned.

## Function listenMaxDrawdownOnce

This function lets you react to specific maximum drawdown events in your backtest, but only once. You provide a condition – a filter – to define which drawdown events you’re interested in, and a function that will be executed when that condition is met. Once the condition is met and the function runs, the listener automatically stops listening, making it perfect for scenarios where you need to respond to a particular drawdown situation and then move on. It’s designed for one-time reactions to drawdown occurrences.

You essentially tell it "listen for drawdown events that meet this criteria, and when you find one, do this action, and then stop listening."

## Function listenMaxDrawdown

The `listenMaxDrawdown` function allows you to monitor and react to changes in maximum drawdown levels as a trading strategy or simulation progresses. It sets up a listener that will notify you whenever a new maximum drawdown is reached.

This is particularly helpful if you need to adjust your strategy based on drawdown milestones, or if you want to implement risk management rules that respond to drawdown changes.

The listener works by queuing up events so that your callback function is executed one at a time, even if your callback involves asynchronous operations. This ensures events are processed in the order they occur and avoids potential issues caused by simultaneous execution. To stop listening, the function returns a cleanup function that you can call to unsubscribe.

## Function listenHighestProfitOnce

This function lets you set up a temporary listener that reacts to specific, high-profit trading events. You provide a condition – a filter – that determines which events you're interested in. Once an event meets that condition, a function you specify will run once to handle it. After that single execution, the listener automatically stops listening, so it's perfect for scenarios where you need to react to something specific and then move on.

It's a convenient way to wait for a particular profit opportunity to arise and then take action without needing to manage the subscription manually.

**Parameters:**

*   `filterFn`:  A test that determines whether an event should trigger the callback.
*   `fn`: The function that will be called once when an event passes the filter.

## Function listenHighestProfit

This function lets you be notified whenever a trading strategy hits a new peak profit level. It's like setting up an alert system for your most successful moments.

The function will call your provided callback whenever that happens, ensuring the events are processed one at a time, even if your callback takes some time to complete. 

This is handy for things like recording achievements or adjusting your strategy based on how well it's performing.

To use it, you simply give it a function that will handle each "highest profit" notification. The function returns another function that you can call later to unsubscribe from the events.

## Function listenExit

This function lets you be notified when a serious, unrecoverable error occurs during background processes like live trading, backtesting, or data walking. 

Think of it as an emergency alert for your trading system – these are the errors that halt everything.

Unlike the regular error listener, this one signals events that cause the whole process to stop.

It ensures events are handled one after another, even if your response involves asynchronous operations. This prevents issues that could arise from multiple callbacks running at the same time. To use it, provide a function that will be executed when a critical error happens. The function will receive an error object to help diagnose the problem.


## Function listenError

This function allows you to monitor and respond to errors that occur during your trading strategy's execution, particularly those that are designed to be handled and don't halt the entire process. Think of it as a safety net for potential hiccups like temporary API connection problems.

You provide a function that will be called whenever such an error happens, and it ensures these errors are handled one at a time in the order they arise. This prevents unexpected behavior caused by multiple errors firing simultaneously. The function you provide is automatically unsubscribed when you no longer need to listen for these errors.


## Function listenDoneWalkerOnce

This function lets you react to the completion of background tasks within the backtest-kit framework, but only once. You provide a filter to specify which completion events you're interested in, and a function that gets executed when a matching event occurs.  Critically, after that one execution, the subscription is automatically removed, so you won't be notified again. Think of it as a short-lived listener for a specific event. It helps keep your code clean by automatically handling the cleanup of the subscription.


## Function listenDoneWalker

This function lets you listen for when a background task within the backtest-kit framework finishes. Think of it as a way to know when something is done running behind the scenes.

It provides a way to react to the completion of these background tasks, ensuring that any actions you take in response happen one at a time, even if those actions involve asynchronous operations. This helps prevent issues that can arise from things happening simultaneously.

You provide a function that will be called when a task is complete, and this function will receive information about the finished task. The function you provide will be executed sequentially. 


## Function listenDoneLiveOnce

This function lets you react to when a background task, started with `Live.background()`, finishes. 

It's designed for situations where you need to know when something is done, but you only need to react once.

You provide a filter – a way to specify which completed tasks you’re interested in – and a function to run when a matching task finishes.  The function will automatically unsubscribe itself after the callback is executed once, so you don't need to worry about cleaning up your subscription. Think of it as a temporary listener that only fires once for a specific event.


## Function listenDoneLive

This function allows you to monitor when background tasks initiated by `Live.background()` finish running. It provides a way to be notified about the completion of these asynchronous operations as they happen. Importantly, the notifications are delivered in the order they occur, and your callback function (the `fn` you provide) will be executed one at a time, even if it involves asynchronous operations itself, ensuring sequential processing. Think of it as a way to react to each completed background task reliably and in sequence.

To stop listening for these events, the function returns another function which you should call when you no longer need the notifications.

## Function listenDoneBacktestOnce

This function lets you listen for when a background backtest finishes, but in a special way: it only runs your code *once* and then automatically stops listening. You provide a filter – a way to specify exactly which backtest completions you're interested in. When a backtest finishes and matches your filter, your provided callback function gets executed just one time, handling the event. After that, it stops listening, so you don't have to manage the subscription yourself. 

It's really handy for tasks like cleaning up resources or triggering a specific action only after a single background backtest concludes.


## Function listenDoneBacktest

This function lets you be notified when a background backtest finishes running. It's like setting up a listener that waits for a specific task to complete.

When the backtest is done, the function you provide will be called. Importantly, these notifications happen one at a time, even if your function takes some time to execute – this ensures things don't get jumbled up.

You provide a function that will be executed when the backtest is complete. The function receives information about the event. 
The function you provide returns a function that can unsubscribe from the backtest done events.

## Function listenBreakevenAvailableOnce

This function allows you to temporarily monitor breakeven protection events and react to them just once. You provide a filter to specify which events you’re interested in, and a function to execute when a matching event occurs.  After the callback runs once, the monitoring automatically stops, so you don't need to worry about cleaning up subscriptions. It's perfect for situations where you need to respond to a particular breakeven condition just one time.

For example, you could use it to trigger a specific action once the breakeven price reaches a certain level.


## Function listenBreakevenAvailable

This function lets you get notified whenever a trade's stop-loss is automatically moved to the entry price, essentially protecting your profits. It's triggered when a trade has gained enough profit to cover any transaction costs associated with it. These notifications are handled one at a time, even if the callback you provide takes a while to complete, ensuring things don't get out of order. You provide a function that will be called each time this event occurs, and the function receives details about the trade that reached breakeven. The function you give will also return a function to unsubscribe from the event.

## Function listenBacktestProgress

This function lets you monitor the progress of a backtest as it runs. You provide a function that will be called whenever a progress update is available.

The updates are delivered one at a time, even if your callback function takes some time to complete. This helps prevent issues that could arise if many updates were processed simultaneously.

Think of it as a way to get periodic snapshots of how the backtest is doing while it's working. The function returns another function which you can call to unsubscribe from the updates.


## Function listenActivePingOnce

This function lets you temporarily listen for specific active ping events and react to them just once. You provide a filter to define which events you're interested in, and a function to run when a matching event occurs. Once that first event is processed, the listener automatically stops, ensuring you don’t keep reacting to events you've already handled. Think of it as a quick, one-time alert for a particular condition.


## Function listenActivePing

This function allows you to be notified whenever there's a change in active ping signals. Think of it as subscribing to updates on what signals are currently active.

These updates happen every minute and give you insight into the lifecycle of your signals.

It's a way to react to changes in your trading signals dynamically.

Crucially, the updates are handled one at a time, ensuring that any processing you do (even if it's asynchronous) won’t interfere with other updates. You just provide a function that will be called with the details of the ping event each time an update occurs.


## Function listWalkerSchema

This function gives you a complete list of all the different "walkers" that are set up within the backtest-kit system. Think of walkers as modular components that analyze and process data during a backtest. You can use this to see exactly what's happening under the hood, generate documentation, or even build custom interfaces to interact with your trading strategies. It essentially provides a snapshot of all registered walkers.

## Function listStrategySchema

This function lets you see a complete list of all the trading strategies that have been set up in your backtest-kit environment. Think of it as a way to check what strategies are available for testing. It's really helpful if you’re trying to figure out what’s going on behind the scenes, building a way to display your strategies, or just generally exploring your setup. The results are provided as a list of strategy schemas, giving you details about each strategy.


## Function listSizingSchema

This function helps you see all the different ways your trading strategies are sized up for trades. It pulls together all the sizing configurations you've previously set up using `addSizing()`. Think of it as a way to get a complete overview of how your trading decisions are scaled – great for troubleshooting, understanding how your system works, or creating helpful displays. It returns these configurations as a list you can work with.

## Function listRiskSchema

This function allows you to see all the risk schemas that are currently set up in your backtest. Think of it as a way to get a complete inventory of the risk configurations you've defined. It's handy for checking what's in place, generating documentation, or building user interfaces that need to display this risk information. The result is a list, with each item describing one registered risk schema.

## Function listMemory

This function helps you see all the stored memories related to a specific data bucket. It essentially shows you what information has been saved and associated with a particular signal. 

It automatically figures out whether you’re in a backtesting or live trading environment.

The function needs one input: the name of the data bucket you want to inspect. 

If there’s no active signal to look at, it will let you know with a message, and you’ll get back an empty list.


## Function listFrameSchema

This function provides a way to discover all the different data structures, or "frames," that your backtest kit is using. Think of it as a catalog of the different data layouts you're working with. It returns a list of these frame schemas, allowing you to inspect their structure and contents.  This can be valuable when you’re troubleshooting, generating documentation, or creating tools that need to understand the various data formats involved in your trading strategies.  Essentially, it's how you find out what types of data your backtest kit is handling.


## Function listExchangeSchema

This function helps you discover all the exchanges that your backtest-kit setup recognizes. It returns a list containing information about each exchange, like what kind of data it expects and how it's structured. Think of it as a way to see what trading platforms your backtest-kit knows about. You might use this to make sure everything is set up correctly, to build a dropdown menu of exchanges in a user interface, or to understand what data formats are expected. It essentially provides a comprehensive overview of the exchanges registered within your backtest-kit environment.


## Function hasTradeContext

This function helps you determine if you’re in a situation where you can actually execute trades. It essentially verifies that all the necessary conditions—both the execution context and the method context—are present. If both are active, it means you're ready to use functions like retrieving historical data (candles), calculating prices, formatting values, or accessing date information within the trading process. Think of it as a quick check to make sure you're in the right environment before trying to perform actions related to a trade.


## Function hasNoScheduledSignal

This function checks if there's currently a scheduled trading signal for a specific trading pair, like BTC-USD or ETH-BTC. It returns `true` if no such scheduled signal exists, and `false` if one is active. Think of it as the opposite of a function that *would* check for a scheduled signal – this one confirms there isn't one. This is particularly useful when you’re building the logic to generate new trading signals because you want to make sure you aren't accidentally creating signals on top of existing ones. The function figures out whether it's running in a backtesting environment or a live trading scenario automatically.


## Function hasNoPendingSignal

This function helps you determine if a trading signal is currently waiting for a chance to be executed for a specific asset, like BTC/USDT. It returns `true` when no such signal exists – essentially, nothing is pending. Think of it as the opposite of checking for a pending signal; it's useful when you want to make sure you aren't accidentally generating a new signal when one is already in place. This function cleverly adapts to whether your system is running a backtest or live trading, so you don’t have to worry about that distinction. You simply provide the symbol of the trading pair you're interested in.

## Function getWalkerSchema

This function lets you look up the configuration details for a specific trading strategy, or "walker," within the backtest-kit system. Think of it as checking what settings are available for a particular strategy. You provide the name of the strategy you're interested in, and it returns a structured definition describing how that strategy is configured. This definition tells you what parameters it uses and what kind of data it expects.


## Function getTotalPercentClosed

This function helps you understand how much of your position remains open for a specific trading pair. It gives you a percentage value: 100 means you haven't closed any part of the position, while 0 means it’s completely closed. 

The function smartly handles situations where you’ve added to your position over time using dollar-cost averaging (DCA), considering partial closures accurately. 

It automatically determines whether it's running in a backtesting or live trading environment.

You just need to provide the trading pair symbol, such as "BTCUSDT," to get the percentage.

## Function getTotalCostClosed

This function helps you figure out how much you've spent on a specific trading pair, like BTC/USD. It looks at all your past transactions, even if you've closed parts of your position along the way – that’s useful if you’ve been buying a little bit at a time (dollar-cost averaging). The function smartly adapts to whether you’re running a test backtest or a live trading session, making it flexible for different scenarios. To use it, you just need to tell it which trading pair you’re interested in.

## Function getTimestamp

The `getTimestamp` function gives you the current time. 

It’s handy for knowing exactly when a calculation or trade is happening.

If you're running a backtest, it will provide the timestamp associated with the historical data being analyzed. Otherwise, it gives you the actual, current time.


## Function getSymbol

This function simply retrieves the trading symbol currently being used within the backtest environment. It's like asking "what are we trading right now?" and it returns that information as a promise that resolves to a string representing the symbol. You can use this when you need to know which asset the backtest is currently focused on.

## Function getStrategySchema

This function lets you access the blueprint, or schema, for a specific trading strategy that's been set up within the backtest-kit framework. Think of it as looking up the detailed definition of how a particular strategy operates. You provide the strategy's unique name, and it returns a structured object outlining all its components and how they’re expected to work – things like input parameters, data requirements, and execution logic. This is useful for understanding, validating, or programmatically manipulating strategies.


## Function getSizingSchema

This function helps you access pre-defined strategies for determining how much of your capital to allocate to each trade. Think of it as looking up a specific recipe for trade sizing. You provide a name that identifies the sizing strategy you want, and it returns the detailed configuration for that strategy. This configuration outlines how the strategy will calculate trade size based on factors like account balance and volatility.


## Function getScheduledSignal

This function allows you to retrieve the currently planned or active trading signal for a specific asset. Think of it as checking what the strategy is set to do next. 

It's designed to work whether you're running a test backtest or a live trading session, automatically adjusting based on the environment.

If there isn't a scheduled signal for the specified asset at the moment, it will simply return nothing (null).

You just need to provide the trading pair's symbol to use this function and it will handle the rest.

## Function getRiskSchema

This function lets you fetch details about a specific risk assessment type that's been set up in the system. Think of it as looking up the blueprint for how a certain type of risk is evaluated. You provide the name, or identifier, of the risk you're interested in, and the function returns a structured description outlining how that risk is measured and managed. It helps ensure consistent risk analysis across different scenarios.


## Function getRawCandles

This function allows you to retrieve historical candle data for a specific trading pair and timeframe. You can control how many candles you get and the time period they cover. 

The function prioritizes accuracy and avoids looking into the future by respecting the current execution context.

You can specify a start and end date along with a limit for the number of candles, or just a limit, in which case the function will automatically determine the time range. 

It's designed to be flexible, letting you fetch candles based on a starting date, an ending date, a limit on the number, or a combination of these. The end date must always be within a valid range.

Here's a breakdown of what the parameters do:

*   `symbol`: The trading pair you're interested in, like "BTCUSDT".
*   `interval`: The time frame for each candle, such as "1m" for one-minute candles or "1h" for one-hour candles.
*   `limit`:  How many candles you want to retrieve.
*   `sDate`: The starting date for your data, given in milliseconds.
*   `eDate`: The ending date for your data, given in milliseconds.

## Function getPositionPnlPercent

This function helps you understand how your trading strategy is performing in real-time. It calculates the unrealized profit or loss as a percentage, taking into account factors like partial trades, dollar-cost averaging, slippage, and trading fees. 

Essentially, it tells you how much money you've potentially gained or lost on your open positions, considering all the nuances of trading. If no trades are currently open, it will return null. The function intelligently adapts to whether you're running a backtest or live trading and automatically gets the current market price. You just need to provide the symbol of the trading pair, like "BTCUSDT".

## Function getPositionPnlCost

This function helps you understand how much profit or loss you're currently holding on a trade. It calculates the unrealized profit or loss in dollars for a specific trading pair, based on the difference between your purchase price and the current market price. 

The calculation considers various factors like partial closes, dollar-cost averaging, slippage, and fees to provide a more accurate picture of your position. 

If you don't have an open position for that trading pair, it will return null. The function automatically determines if it's running in a backtest or live environment and retrieves the current market price for you. You simply need to provide the symbol of the trading pair you're interested in.


## Function getPositionPartials

getPositionPartials helps you understand how your trading strategy has been closing out positions incrementally. It provides a list detailing each partial profit or loss event that has occurred for a specific trading symbol.

Think of it as a history of how much of your position has been closed, at what price, and what the cost basis was at that point.

If no signal is active, or if no partial closes have happened, it will return an empty list rather than nothing at all. This function uses the symbol you provide to track these partial events.


## Function getPositionPartialOverlap

This function helps prevent accidentally closing your position partially at the same price multiple times. It checks if the current market price falls within a small range around any previously established partial close prices.

Essentially, it’s a safety measure to avoid redundant trades.

You provide the trading symbol and the current price. Optionally, you can specify a custom tolerance range (a “ladder”) to define how close the current price needs to be to a previous partial close price before it's considered a potential duplicate. If no previous partial closes exist, it will return false.

## Function getPositionMaxDrawdownTimestamp

This function helps you find out when a specific trading position experienced its biggest loss. It tells you the exact timestamp – a numerical representation of the date and time – marking the point where the position's value dipped the lowest.

If there aren't any active trading signals related to that position, the function will return nothing.

To use it, you need to provide the symbol of the trading pair (like 'BTCUSDT').

## Function getPositionMaxDrawdownPrice

getPositionMaxDrawdownPrice helps you understand the potential downside risk of a specific trading position. 

It calculates and returns the lowest price your position experienced while it was open. 

Essentially, it shows you how far "in the red" your position went at its worst point.

If there's no active trading signal for the given symbol, the function will return null, indicating it can't calculate a drawdown. You provide the symbol, like "BTCUSDT", to specify which position's drawdown you want to know.


## Function getPositionMaxDrawdownPnlPercentage

This function lets you check the maximum drawdown expressed as a percentage of profit/loss for a specific trading symbol. It essentially tells you how far in the red your position went at its lowest point, relative to its profits.

If there isn't an active signal for that symbol, the function will return null, meaning the data isn't available.

You provide the trading symbol (like 'BTC-USDT') as input to get this drawdown percentage.

## Function getPositionMaxDrawdownPnlCost

This function helps you understand the financial impact of a trade’s most significant downturn. Specifically, it calculates the profit and loss (in the currency of the traded asset) at the exact point when the position experienced its lowest value. Think of it as pinpointing the cost incurred during the worst moment for that particular trade. 

It only works if there’s an active trading signal for the specified asset. If not, it won't provide a result and will return null. You just need to provide the symbol, like "BTC-USDT", to get the data.


## Function getPositionMaxDrawdownMinutes

This function helps you understand how far back in time your position experienced its biggest loss. It tells you the number of minutes that have passed since the lowest point of your position's value. Think of it as a way to gauge how long ago things got really tough for your trade.

The value will be zero if the lowest point just occurred. 

If there’s no open trade currently, the function won’t have any data to work with and will return null.

You’ll need to provide the trading pair symbol (like "BTCUSDT") to know which position's drawdown you're interested in.


## Function getPositionLevels

getPositionLevels allows you to retrieve the prices at which your position was built up through dollar-cost averaging (DCA). It gives you a history of the prices used for each buy order related to a specific trading pair.

If no trade is in progress, the function will return null. If a trade started but no additional DCA buys were made, you'll get an array containing only the original entry price. Otherwise, the array will list the original price and all subsequent prices used when committing to average your buy.

To use it, simply provide the trading pair symbol (like 'BTCUSDT') to see the relevant price levels.


## Function getPositionInvestedCount

getPositionInvestedCount helps you track how many times you've added to a position using a dollar-cost averaging (DCA) strategy. It tells you the number of DCA entries made for the current signal – a value of 1 means it’s the initial investment, and it increases each time you commit to a new average buy. If there isn't a pending signal, the function will return null. This function intelligently adapts to whether you’re in a backtest or a live trading environment. To use it, simply provide the trading pair symbol, like "BTCUSDT".


## Function getPositionInvestedCost

This function helps you figure out how much money you’ve put into a particular trade. It calculates the total cost basis, in dollars, for the current pending signal. 

Think of it as adding up all the costs associated with buying into the trade – specifically, the costs that were set when the trade was initially committed. 

If there isn’t a pending signal currently, the function will return null. It automatically adapts to whether you’re running a backtest or a live trading session, so you don’t need to worry about that. To use it, you simply provide the symbol of the trading pair you're interested in, like "BTC-USDT".

## Function getPositionHighestProfitTimestamp

This function helps you find out exactly when a specific trading position reached its highest profit point. It looks at a particular trading pair, like BTC/USDT, and tells you the timestamp – a precise date and time – when that position was at its most profitable. If there's no record of a potential trading signal for that symbol, the function will let you know by returning null. Essentially, it's a way to pinpoint moments of peak performance for your trades.

## Function getPositionHighestProfitPrice

This function helps you find the highest price achieved while you were in a profitable position. It starts by remembering the price you entered the trade at.

For long positions, it continuously updates to track the highest price seen above your entry price, essentially aiming for the take-profit level.  Short positions work similarly, but track the lowest price seen below your entry price.

The function returns this peak profit price and will always have a value because it’s initialized with the entry price when a position is opened. You give it the symbol of the trading pair you’re interested in to get the relevant data.


## Function getPositionHighestProfitMinutes

This function tells you how long ago a trading position reached its highest profit point. Think of it as measuring how far a position has fallen from its best performance. 

It returns the number of minutes that have passed since that peak profit was achieved.

The value will be zero if the function is called at the very moment the peak profit was recorded. 

If there's no active trading signal for the specified symbol, the function will return null. You need to provide the symbol of the trading pair (like 'BTCUSDT') to use this function.

## Function getPositionHighestProfitBreakeven

This function checks if a trading position could have reached its breakeven point based on the highest profit achieved. It analyzes the trading data to determine if the highest price reached was high enough for the position to break even.

Essentially, it’s a way to validate the potential profitability of a trade.

If there's no active trading signal for a specific symbol, the function will return null, indicating there's nothing to evaluate.

You'll need to provide the trading pair symbol as input, for example "BTCUSDT".


## Function getPositionHighestPnlPercentage

This function helps you understand how well a specific trade performed. It looks at a trading position—like buying and selling Bitcoin—and tells you the highest percentage profit it ever achieved during its lifetime. Essentially, it shows you the peak of the trade's success. 

If there's no trading signal associated with the position, the function will return null, meaning there's no data to analyze. You just need to provide the trading pair's symbol, like 'BTCUSDT', to get this information.

## Function getPositionHighestPnlCost

This function helps you understand the financial history of a specific trading pair. It tells you the total cost (in the quote currency, like USD or EUR) that was incurred when the position reached its highest profit point. 

Think of it as finding out how much it initially cost to get to the peak profitability of a trade.

If there's no trading signal associated with the position, the function will return null. 

You'll need to provide the symbol of the trading pair you're interested in, such as "BTC-USD".

## Function getPositionEstimateMinutes

This function helps you understand how long a trading position might last. It calculates the estimated duration in minutes for a pending signal. 

Essentially, it tells you how long the system expects a trade to be open before it automatically closes due to a time limit.

If there’s no pending signal, it will return null. 

You provide the trading symbol (like BTCUSDT) to get the estimated duration for that specific pair.

## Function getPositionEntryOverlap

This function helps ensure you don't accidentally create overlapping or duplicate DCA entries. It checks if the current price is close to a price level you’ve already set up for a Dollar-Cost Averaging (DCA) strategy. 

Essentially, it prevents you from buying the same price range multiple times.

The function will return `true` if the current price falls within a small range around one of your existing DCA levels, meaning an overlap is detected. If there are no previously defined levels, it will return `false`. 

You can adjust how close is considered "too close" using the `ladder` parameter, which lets you control the tolerance percentage.

## Function getPositionEntries

This function lets you see the details of how a position was built, whether it was a single trade or a series of DCA (Dollar Cost Averaging) buys. It gives you a list of each price and the amount spent at each step of building up that position. If there's no active trade being built, it won't return anything. If the trade was just one initial purchase, it will return a list containing only that single entry. You provide the trading symbol (like "BTC/USD") to specify which position's history you're looking for.

## Function getPositionEffectivePrice

This function helps you understand the average price at which you've acquired a position for a specific trading pair. It calculates a weighted average, considering any previous partial closes and any subsequent DCA (Dollar-Cost Averaging) entries. If no open position exists, it will return null. The calculation uses a special method called a harmonic mean, which gives more weight to lower prices, providing a more accurate reflection of your overall cost basis. This function works seamlessly whether you’re running a backtest or a live trading strategy.

It takes the symbol of the trading pair as input, for example, "BTCUSDT".


## Function getPositionDrawdownMinutes

getPositionDrawdownMinutes tells you how much time has passed since your current trading position reached its best possible price. 

Think of it as a measure of how far your position has fallen from its highest point.

The number represents the minutes elapsed—it starts at zero when the position hits its peak profit and increases as the price declines.

If there's no active signal for the specified trading pair, the function will return null. 

You’ll need to provide the symbol of the trading pair, such as 'BTCUSDT', to get this drawdown information.

## Function getPositionCountdownMinutes

This function helps you figure out how much time is left before a trading position needs attention. 

It calculates the countdown in minutes until a position's estimated expiration.

If a position isn't actively pending, the function will return null, indicating no countdown is currently in effect.

You provide the trading symbol (like "BTCUSDT") to determine the countdown for that specific position. 

The countdown will never be a negative number; it will always be zero or a positive value representing the remaining time.

## Function getPendingSignal

This function lets you check if a trading strategy has an open, pending signal. It gives you details about that signal, if one exists, including information like its type and parameters. If no signal is pending, it will simply return nothing. You provide the trading pair symbol, like "BTCUSDT", to specify which asset you're checking for. It works whether you're running a backtest or a live trade without needing to specify which mode it is.


## Function getOrderBook

This function lets you retrieve the order book for a specific trading pair, like BTCUSDT. 

It pulls data from the exchange you're using.

You can optionally specify how many levels of the order book you want to see; if you don't provide a number, it defaults to a maximum depth.

The function accounts for timing, adjusting its behavior based on whether you're in a backtesting or live trading environment.


## Function getNextCandles

This function helps you retrieve future candles for a specific trading pair and time interval. It's designed to get candles that come *after* the current time in your backtest or trading environment, ensuring you're looking ahead rather than at historical data. You simply provide the symbol (like "BTCUSDT"), the candle interval (such as "1m" for one-minute candles), and the number of candles you want to retrieve.  The function then uses the underlying exchange's methods to find those future candles.


## Function getMode

This function tells you whether the trading framework is currently running in backtest mode or live mode. It returns a promise that resolves to either "backtest" or "live," allowing your code to adapt its behavior based on the environment it's operating in. This is useful for things like displaying different user interfaces or using different data sources.

## Function getFrameSchema

The `getFrameSchema` function helps you find the blueprint for a specific data frame within your backtest setup. Think of it like looking up the definition of a particular type of data – it gives you the structure and expected contents. You provide the name of the frame you're interested in, and the function returns a detailed description of what that frame should look like, including the types of data it holds. This is useful for validating your data or understanding the expected format for a particular part of your trading strategy.

## Function getExchangeSchema

This function helps you get the specific details and structure for a particular cryptocurrency exchange that backtest-kit knows about. Think of it as looking up the blueprint for how a certain exchange works within the testing environment. You provide the name of the exchange you’re interested in, and it returns a description of how that exchange is modeled, outlining things like the available markets and data formats it expects. It’s a useful way to understand the technical requirements for using a particular exchange in your backtesting scenarios.


## Function getDefaultConfig

This function provides a set of predefined settings used by the backtest-kit trading framework. Think of it as a starting point for your own configurations – it gives you a clear picture of all the available options and their initial values. You can use these default values as a guide when customizing the framework to fit your specific trading strategies and needs. It's a handy way to understand what's possible and how the system is set up out of the box.

## Function getDefaultColumns

This function gives you a peek at the standard column setup used when creating markdown reports. It provides a pre-configured object outlining all the columns that are typically included, like those for strategy performance, risk metrics, and event details. Think of it as a template—you can examine it to understand the structure and available options for customizing your reports before you actually build them. The returned object is read-only, so it can't be modified directly.

## Function getDate

This function allows you to retrieve the current date within your trading strategy. 

It's context-aware, meaning the date it provides depends on whether you're running a backtest or live trading. 

During a backtest, it will give you the date associated with the timeframe you're analyzing.  When you're trading live, it returns the actual current date.


## Function getContext

This function provides a way to access the surrounding environment of your trading logic. Think of it as a peek behind the curtain – it gives you information about where and how your code is running within the backtest-kit framework. The result is a special object holding details about the current method's execution.

## Function getConfig

This function provides access to the core settings that control how backtest-kit operates. It gathers various parameters influencing things like data fetching, signal generation, order management, and reporting. Think of it as a snapshot of the framework's internal rules and limits. This snapshot is a copy, so any changes you make won't affect the actual running configuration. It's useful for understanding the framework’s behavior or for checking what values are currently in effect.

## Function getColumns

This function provides access to the column configurations used for generating reports within the backtest-kit framework. It essentially gives you a snapshot of how your data will be displayed in reports, covering areas like closed trades, heatmap data, live ticks, partial fills, breakeven events, performance metrics, risk events, scheduled tasks, strategy events, synchronization events, maximum profit, maximum drawdown, walker profit and loss, and strategy results. This is useful if you want to understand how your data is being structured and presented, or if you need to examine the column definitions themselves. Importantly, it provides a copy, so changes you make won’t affect the core configuration.

## Function getCandles

This function helps you get historical trade data from a trading exchange. You tell it which trading pair (like BTCUSDT) you're interested in and how many trades back you want to see. The function then pulls that trade history from the exchange and provides it to you in an organized way. Essentially, it’s like requesting a log of all the transactions that occurred for a specific asset over a certain time.

## Function getBreakeven

This function helps determine if a trade has become profitable enough to cover its costs. It examines the current price of a trading pair and compares it to a calculated threshold, which accounts for potential slippage and trading fees. Essentially, it tells you if the price has moved sufficiently in a positive direction to break even on the initial investment. The function automatically adapts to whether it’s being used in a backtesting simulation or a live trading environment.

You provide the trading pair's symbol and the current price as input. It will then return `true` if the price has exceeded the breakeven point, and `false` otherwise.


## Function getBacktestTimeframe

This function helps you find out the dates that your backtest is using for a specific trading pair, like BTCUSDT. It returns a list of dates that define the timeframe for the backtest of that symbol. You simply provide the symbol of the trading pair you’re interested in, and it will give you the dates used in the backtest. This is useful for understanding the scope and period covered by your backtest results.


## Function getAveragePrice

This function helps you find the VWAP, or Volume Weighted Average Price, for a specific trading pair. It looks at the last five minutes of trading data, considering both the price and the volume of each trade.

Essentially, it calculates a price that reflects how much trading activity has occurred at different price points. If there's no trading volume data available, it falls back to calculating a simple average of the closing prices instead.

To use it, just provide the symbol for the trading pair you're interested in, like "BTCUSDT". The function then returns a promise that resolves to the calculated average price.

## Function getAggregatedTrades

This function retrieves a list of aggregated trades for a specific trading pair, like BTCUSDT. It pulls this data directly from the exchange you're connected to. 

If you don't specify a limit, it will gather trades from within the last window of time. 

If you *do* provide a limit, the function will fetch enough trades to meet that number, moving backwards in time to get them. This is useful if you only need a certain number of trades for analysis or calculations.

## Function getActionSchema

This function helps you find the details about a specific action your trading strategy uses. Think of it as looking up the blueprint for how that action should be executed. You give it the action's name, and it returns a description of what that action involves, including the data it requires. It's like checking the specifications to make sure everything is set up correctly.


## Function formatQuantity

This function helps you display the correct quantity of a trading pair, making sure the number of decimal places aligns with the specific exchange's requirements. It takes the trading pair symbol, like "BTCUSDT," and the numerical quantity you want to display. The function then handles the details of formatting that quantity correctly, so you don't have to worry about manually calculating the right number of decimals. Think of it as a convenient way to present quantities consistently with how the exchange itself would display them.


## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes a symbol like "BTCUSDT" and a raw price number, then formats the price to match the specific rules of the exchange. This ensures the displayed price has the right number of decimal places, which is important for clarity and accuracy when presenting trading data. Essentially, it takes care of the formatting details so you don't have to.


## Function dumpText

The `dumpText` function allows you to save textual data related to a specific trading signal. Think of it as a way to record observations or insights connected to a particular signal’s activity. 

It automatically figures out which signal it's associated with, so you don't need to provide that information directly. 

If there isn't an active signal available, it will notify you, but won't save the data. You provide the data itself—what you want to save—along with a descriptive name (`dumpId`) and an explanation of what the text represents (`description`). This helps keep things organized and understandable later on.


## Function dumpTable

This function helps you display data in a structured table format, specifically tied to a signal being tracked. 

It takes an array of objects, each representing a row in your table, and presents them neatly. 

The function automatically figures out the column names by looking at all the keys used in your data. It also intelligently pulls the signal identifier from the current process, so you don't have to specify it directly. If there’s no signal being tracked, it will let you know with a warning instead of proceeding.

## Function dumpRecord

The `dumpRecord` function lets you save a piece of data – think of it as a record of information – associated with a specific trading signal. It's designed to help you keep track of details related to a particular signal's activity.

It automatically figures out which signal it belongs to, so you don't have to specify that directly. If no signal is currently active, it'll just let you know with a warning and won't save anything.

You provide a record, which is essentially a collection of key-value pairs, and a descriptive message about what that record represents. This function helps organize and preserve important data points linked to your trading signals.

## Function dumpJson

The `dumpJson` function lets you save complex data structures as formatted JSON within your backtest. It automatically associates this JSON data with the current trading signal. 

If a signal isn't actively being processed, it will notify you but won't proceed with saving the data. 

You'll provide a name for the data (bucketName), a unique identifier (dumpId), the actual data as a JavaScript object, and a description to explain what the JSON represents. The function then takes care of the rest, ensuring the JSON is stored correctly linked to the signal.


## Function dumpError

The `dumpError` function helps you record and track errors related to specific trading signals. It sends an error description, along with a bucket and dump ID, to a storage location. 

It automatically figures out the signal it’s connected to, so you don't have to manually specify it. If there isn't a signal currently being processed, it will let you know with a warning instead of trying to save the error information. Essentially, this provides a way to systematically log and understand errors that happen during your backtesting or live trading.


## Function dumpAgentAnswer

This function helps you save a complete record of an agent's conversation. It takes all the messages exchanged, along with a description, and stores them with a unique identifier.

Essentially, it's like creating a snapshot of a conversation within the backtest-kit system.

The function automatically figures out which signal the conversation belongs to, so you don't have to specify it directly. If no signal is active, it'll let you know with a warning but won’t save anything.

You provide the function with a data object containing the bucket name, the dump ID, the messages themselves, and a brief explanation of what the dump represents.


## Function commitTrailingTakeCost

This function helps you update the trailing take-profit price to a specific level. It's a shortcut for setting the take-profit, calculating the necessary percentage shift from the original take-profit distance. The system figures out whether it's running in a backtest or live environment, and it automatically determines the current market price to make the calculation. You simply provide the trading pair symbol and the new, desired take-profit price.

## Function commitTrailingTake

The `commitTrailingTake` function lets you dynamically adjust your take-profit levels for open trades. It's specifically designed to handle trailing take-profits, which automatically move the take-profit point as the price moves favorably.

It's really important to remember that this function always bases its calculations on the *original* take-profit distance you set initially, not any adjustments made along the way. This keeps things accurate and prevents errors from building up over time.

If you’re making multiple adjustments, the function prioritizes more conservative take-profit distances, meaning it only updates the take-profit if the new setting is closer to your entry price. For long positions, that means the take-profit can only move closer to your entry. For short positions, the take-profit can only move further away. 

You control the adjustment size using the `percentShift` parameter, which ranges from -100 to 100.

The function automatically adapts to whether it's running in a backtesting or live trading environment. It takes the trading pair symbol, percentage adjustment, and current price as inputs.

## Function commitTrailingStopCost

This function lets you change the trailing stop-loss price for a specific trading pair to a fixed amount. It's a simpler way to adjust the stop-loss than manually calculating the percentage shift, as it handles the details of converting the absolute price to the correct percentage. The function figures out whether it's being used in a backtest or a live trading environment, and it also automatically retrieves the current price to make the calculation accurate. You just need to provide the symbol of the trading pair and the desired new stop-loss price. 


## Function commitTrailingStop

The `commitTrailingStop` function lets you fine-tune the distance of your trailing stop-loss order. Think of it as a way to dynamically adjust how far your stop-loss is from your entry price, but with a crucial rule: it always calculates changes based on the *original* stop-loss distance you set initially.

This is important because it avoids small errors from adding up over time, which could lead to unexpected behavior. 

If you want to tighten your stop-loss (move it closer to your entry), you use a negative percentage shift. To widen it (give it more breathing room), use a positive percentage shift.

Keep in mind, if you adjust the stop-loss, the system only makes changes if the new stop-loss distance actually provides better protection - it won't move your stop-loss in a direction that would decrease your potential profit. For long positions, your stop-loss can only move further away from the entry price, and for short positions, it can only move closer.

The function handles whether you're in a backtest or live trading environment automatically.

You provide the symbol of the trading pair, the percentage adjustment you want to apply, and the current market price to evaluate the new stop-loss distance.


## Function commitPartialProfitCost

This function helps you automatically close a portion of your trade when it's profitable. You specify the dollar amount you want to recover as profit, and the system handles the rest, calculating the necessary percentage of your position to close. 

It's designed to work seamlessly whether you’re backtesting or live trading, and it automatically gets the current price to determine the correct execution. Think of it as a shortcut for taking profits incrementally.

To use it, you'll need to provide the trading pair symbol and the desired dollar amount to close. Remember, the price has to be moving in a favorable direction toward your take profit target.


## Function commitPartialProfit

The `commitPartialProfit` function lets you automatically close a portion of your open trade when the price moves favorably towards your take profit target. It allows you to secure some profits along the way.

You specify the trading symbol and the percentage of the position you want to close, like 25% or 50%.

The function handles whether it's running in a backtesting simulation or a live trading environment, so you don't have to worry about that. 


## Function commitPartialLossCost

This function helps you partially close your trading position when the price is moving in a direction that would trigger your stop-loss. It simplifies the process by allowing you to specify the dollar amount you want to close, and it automatically calculates the percentage of your position that represents. It handles the technical details of figuring out whether you're in a backtest or live trading environment and also retrieves the current price to make the calculation accurate. You provide the symbol of the trading pair and the dollar amount you want to close, and the function takes care of the rest.


## Function commitPartialLoss

This function lets you automatically close a portion of an open trade when the price is trending in a way that approaches your stop-loss level. 

Essentially, it's a way to reduce your risk by partially exiting a position when things aren't going your way.

You specify the trading symbol and the percentage of the trade you want to close, and the function handles whether it's running in a backtesting environment or a live trading scenario.

It's important to remember that this function only works when the price is moving in the direction of your stop-loss, meaning it's triggering a response to potential losses.


## Function commitClosePending

This function lets you manually close an existing pending order within your trading strategy, without interrupting the strategy's normal operation. It's useful when you need to intervene and close a position that's already in the process of being executed. Think of it as a way to manually cancel a pending order. It won't affect any future signals the strategy generates, or any signals already scheduled. You can optionally provide a close ID to help track the reason for the closure, especially helpful when moving between backtesting and live trading. The framework automatically recognizes whether you're in a backtest or a live trading environment.

## Function commitCancelScheduled

This function lets you cancel a previously scheduled trading signal without interrupting your overall strategy. Think of it as a way to retract a planned action.

It specifically targets signals that are waiting for a price to trigger them – it won't affect any signals already in action or prevent the strategy from generating new signals.

You can optionally provide a cancellation ID to help you keep track of cancellations, especially useful if you're managing many scheduled signals. The framework automatically adjusts its behavior based on whether it's running a backtest or a live trade.

## Function commitBreakeven

This function helps manage your trades by automatically adjusting the stop-loss order. It moves the stop-loss to the original entry price once the trade has reached a certain profit level, essentially eliminating risk. This level is calculated to account for potential slippage and trading fees, ensuring the move happens only when the profit is truly secured. The function handles whether it's running in a backtest or live environment and gets the current price for you, simplifying the process. You just need to specify the trading pair symbol for the trade you want to manage.

## Function commitAverageBuy

The `commitAverageBuy` function lets you add a new purchase to your dollar-cost averaging (DCA) strategy. It essentially records a buy order at the current market price and adds it to the history of your position. The function automatically calculates and updates the average purchase price for the position, helping you track your overall cost. It also sends out a signal indicating a new average buy has been committed, so other parts of your system can react. You only need to provide the trading symbol; the function takes care of getting the price and handling whether you're in a backtest or live trading environment. You can optionally specify a cost value, although its purpose isn't explicitly described.

## Function commitActivateScheduled

This function lets you trigger a pre-planned trading signal before the expected price. 

Think of it as a way to manually say "okay, execute this order now" instead of waiting for a specific price point.

It's useful when you want to adjust your strategy based on external information or just react faster than the standard logic.

You specify which trading pair you're working with, and optionally include an activation ID to keep track of when you manually triggered the signal. The system automatically handles whether it’s running a backtest or a live trade.


## Function checkCandles

The `checkCandles` function ensures your historical candle data is properly aligned with the expected time intervals. It's a utility for verifying the integrity of your data, directly accessing files stored for persistence. If your trading strategy relies on specific timeframes, this function helps guarantee those intervals are consistent, preventing unexpected behavior in your backtests. Think of it as a health check for your historical data.


## Function addWalkerSchema

The `addWalkerSchema` function lets you register a "walker," which is a way to compare the performance of different trading strategies against each other using the same historical data. Think of it as setting up a structured experiment where you're testing multiple strategies and then looking at how they stack up based on a chosen performance measurement. You provide a configuration object, the `walkerSchema`, to define how the walker should run its comparisons.

## Function addStrategySchema

This function lets you tell the backtest-kit about a new trading strategy you've built. Think of it as registering your strategy so the framework knows how to use it.

When you register a strategy, the framework checks to make sure it's set up correctly, including verifying the signals it produces and preventing it from sending signals too frequently. 

It also ensures that your strategy’s data can be safely saved even if something unexpected happens during a live trade.

You provide a configuration object describing your strategy’s rules and logic.

## Function addSizingSchema

This function lets you tell the backtest-kit framework how to determine the size of your trades. Think of it as registering a plan for how much capital you want to allocate to each trade.

You provide a sizing configuration, which details things like your risk tolerance, the method you'll use to calculate position size (like a percentage of your capital, or a more sophisticated Kelly criterion), and any limits on how large a position you want to take. 

Essentially, it’s how you instruct the backtest-kit on how to manage risk and determine position sizes during a backtest.


## Function addRiskSchema

This function lets you define how your trading strategies will manage risk. Think of it as setting up the rules of engagement to prevent overexposure and ensure stability. 

You can specify limits on the total number of positions your strategies can hold simultaneously. 

It also allows for more complex risk checks beyond simple position limits – things like analyzing portfolio diversification or looking at correlations between assets. 

Furthermore, you can set up actions that happen when a trading signal is rejected or approved based on these risk checks.

Importantly, multiple strategies can share a single risk management system, so you get a complete view of your overall risk exposure and can apply cross-strategy constraints. The system keeps track of all active positions to inform these risk assessments.

## Function addFrameSchema

This function lets you tell the backtest-kit about a new timeframe you want to use. Think of it as registering a way to generate the specific dates and intervals your backtest will run on, like daily, weekly, or monthly data. 

You provide a schema object which details the start and end dates for your backtest, the frequency of the intervals (e.g., daily, weekly), and a function that will be called when timeframes are generated. It's how you customize the time period and resolution of your historical data analysis.


## Function addExchangeSchema

This function lets you tell the backtest-kit framework about a new data source for trading. Think of it as registering where the historical price data for an exchange comes from. 

You'll provide details about the exchange, including how to fetch historical candles (price data over time), how to format prices and trade sizes, and how to calculate a common indicator called VWAP (Volume Weighted Average Price). Essentially, it helps the system understand and use data from a specific trading platform.


## Function addActionSchema

This function lets you register a custom action within the backtest-kit framework. Think of actions as a way to hook into significant events happening during your backtesting process, like when a signal is generated or a profit is taken.

You can use these actions to do things like update state in a tool like Redux, send notifications to Slack or Telegram, log events, track performance metrics, or trigger other custom logic.

Each action gets created specifically for a particular strategy and timeframe combination, and it receives all the relevant data generated during that run, giving you a lot of context to work with.

To use it, you pass in a configuration object describing how the action should behave.
