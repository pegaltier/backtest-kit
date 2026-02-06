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

This function helps you make sure everything is set up correctly before you start any backtesting or optimization runs. It checks if all the exchanges, strategies, risk models, sizing methods, and other components you're using are properly registered in the system.

You can tell it to validate specific parts of your setup, or if you leave it blank, it'll check everything. This validation process is also designed to be efficient, remembering the results so it doesn’t have to re-check things unnecessarily. Think of it as a quick health check for your trading environment.

## Function stopStrategy

This function lets you pause a trading strategy. It effectively tells the strategy to stop creating new buy or sell signals for a specific trading pair. Any existing signals that are already active will finish their process as usual. The system will then halt the backtest or live trading session at a safe point, like when it's idle or after a signal has completed. It handles whether you're in a backtesting environment or live trading automatically. You simply need to provide the symbol of the trading pair you want to stop the strategy for.

## Function setLogger

You can now control how backtest-kit reports information during its runs. This function lets you plug in your own logging system, like sending logs to a file, database, or a custom analytics platform. The framework will automatically add useful details to each log message, such as the trading strategy name, exchange being used, and the symbol being traded, so you have context for debugging and analysis. Just provide an object that fulfills the `ILogger` interface, and all internal messages will be routed through it.

## Function setConfig

This function lets you adjust how the backtest-kit framework operates. You can use it to change certain default settings, like how data is handled or how orders are processed. It’s like fine-tuning the engine of your trading strategy. The `config` parameter lets you specify only the settings you want to change, leaving the rest at their defaults. There's also an `_unsafe` option which is primarily for test environments; use it with caution as it bypasses important checks.

## Function setColumns

This function lets you customize the columns displayed in your backtest reports, like the ones generated as markdown. You can tweak the default column definitions to show exactly the data you want to see. The framework checks that your changes are structurally sound, but if you're working in a testing environment, you can bypass these checks using the `_unsafe` flag. Essentially, it's a way to personalize your report's appearance and information.


## Function overrideWalkerSchema

This function lets you tweak an existing walker schema, which is important when you're comparing different strategies. Think of it as making targeted adjustments to a pre-built configuration rather than starting from scratch. You only need to specify the parts of the walker schema you want to change; everything else stays as it was. It's a handy way to experiment with different settings without completely reconfiguring the walker.

## Function overrideStrategySchema

This function lets you modify a trading strategy that’s already set up within the backtest-kit framework. Think of it as a way to make small adjustments to an existing strategy without completely rebuilding it. You provide a partial configuration – only the settings you want to change – and the function updates the original strategy, leaving the rest of its settings untouched. This is useful for things like tweaking parameters or adding new configuration options after a strategy has been initially defined.

## Function overrideSizingSchema

This function lets you tweak existing position sizing rules within the backtest framework. Think of it as a way to fine-tune how much capital is allocated to trades—it doesn't replace the original sizing setup entirely, but rather adjusts specific parts of it. You provide a partial configuration object, and only the fields you specify will be modified, leaving the rest of the sizing schema untouched. This gives you precise control without having to redefine the entire sizing strategy.

## Function overrideRiskSchema

This function lets you tweak an existing risk management setup within the backtest-kit framework. Think of it as a way to make small adjustments rather than creating a whole new risk profile. You provide a partial configuration—just the parts you want to change—and it updates the existing configuration, leaving everything else untouched. It's useful for fine-tuning your risk parameters without having to redefine everything from scratch.

## Function overrideFrameSchema

This function lets you adjust how your backtest handles different timeframes, like changing the size of a candlestick. It’s useful when you want to tweak a timeframe's settings without completely redefining it.  You provide a partial configuration – just the bits you want to change – and the function merges those changes with the existing timeframe setup. Think of it as a targeted update, leaving everything else untouched.

## Function overrideExchangeSchema

This function lets you modify an already set up data source for an exchange within the backtest-kit framework. Think of it as making small adjustments to an existing exchange’s setup instead of starting from scratch. You provide a portion of the exchange's configuration – only the parts you want to change – and the framework will update the existing exchange, leaving everything else untouched. It's useful when you need to tweak things without redoing the entire exchange definition.

## Function overrideActionSchema

This function lets you tweak an action handler’s settings without having to completely re-register it. Think of it as a quick way to make small adjustments, like changing how a specific event is handled. Only the parts you specify will be updated, leaving the rest of the handler's configuration untouched. This is handy for things like updating event logic, adapting callbacks for different environments, or even switching handler implementations on the fly, all while keeping your core strategy the same. You provide a partial configuration object, and it merges with the existing action handler.

## Function listWalkerSchema

This function gives you a peek into all the different ways your backtest-kit framework is set up to handle data. It essentially lists all the "walkers" – the processes that transform and analyze your trading data – that have been added to the system. You can use this information to understand how your backtest is configured, create helpful documentation, or even build user interfaces that adapt to the available data processing options. Think of it as a directory of all the active data processing steps in your backtest.

## Function listStrategySchema

This function lets you peek behind the scenes and see all the trading strategies that are currently set up within the backtest-kit framework. It's like getting a directory listing of your strategies, showing you exactly what's available. You can use this to check what's been registered, create helpful documentation, or even build a user interface that dynamically displays the available strategies. Essentially, it provides a way to manage and understand your strategy configurations.


## Function listSizingSchema

This function lets you see all the sizing strategies currently set up within the backtest-kit framework. Think of it as a way to peek under the hood and find out how your positions are being sized for trades. It returns a list of configurations, so you can examine them to make sure they’re working as expected, create documentation, or even build tools that dynamically adjust sizing based on these settings. Essentially, it gives you a complete inventory of your sizing rules.

## Function listRiskSchema

This function lets you see all the risk configurations that are currently being used within your backtest. It's like a quick inventory of how your backtest is assessing and managing risk. You can use this to check your setup, generate documentation, or even build tools that adjust based on the risk schemas in place. Essentially, it provides a list of all the risk schemas that have been added using `addRisk()`.

## Function listFrameSchema

This function gives you a peek behind the scenes of your backtest-kit setup. It essentially lists all the different "frames" – think of them as reusable building blocks – that you've defined and registered within your trading framework. This is incredibly helpful if you're trying to understand how your backtest is structured, build tools to visualize your system, or simply double-check that everything's set up correctly.  It returns a list containing information about each registered frame.

## Function listExchangeSchema

This function allows you to see a complete list of all the exchanges that your backtest-kit setup recognizes. Think of it as a directory of available exchanges, providing details about each one. It's particularly helpful when you're troubleshooting your setup, creating documentation, or building user interfaces that need to adapt to different exchange configurations. The information is returned as a promise that resolves to an array of exchange schema objects.

## Function listenWalkerProgress

This function lets you track the progress of your backtesting simulations. It's designed to receive updates after each strategy finishes running within a `Walker`. These updates are delivered in the order they happen, and importantly, even if your update handling code takes some time (like performing asynchronous operations), the process is carefully managed to avoid any problems caused by running things at the same time. You provide a function that will be called with the progress information, and this function returns another function you can use to unsubscribe from these updates when you no longer need them.

## Function listenWalkerOnce

This function lets you watch for specific changes happening within a trading simulation, but only once. You tell it what kind of change you're interested in using a filter – essentially, a rule to identify the events you want to see. Once an event matches that rule, a provided function will run and then the listener automatically stops, so you don’t have to worry about managing subscriptions. This is great when you need to react to a particular situation just one time.

It takes two things: first, the rule (filterFn) to decide which events to watch for, and second, the action (fn) to perform when the rule is met. The function returns a function that you can call to stop the listener early if needed.

## Function listenWalkerComplete

This function lets you get notified when a backtest run finishes, ensuring all strategies have been tested. It’s useful for triggering actions after a full backtest is complete.  The notifications are handled in order, and even if your notification code takes time to run (like making API calls), it won’t interfere with other notifications. Think of it as a reliable way to know when everything is done and ready for the next step. You simply provide a function that will be called when the backtest is complete, and this function returns another function to unsubscribe from the event.

## Function listenWalker

This function lets you track the progress of a backtest as it runs. It essentially listens for updates after each trading strategy finishes within the backtest process. 

You provide a function that will be called with information about each completed strategy – think of it as getting notified one by one as strategies conclude. 

Importantly, the notifications happen in the order they occur during the backtest, and even if your notification function does some work (like calculations) asynchronously, it's handled in a safe, sequential manner to prevent issues. It allows you to monitor and react to the backtest's progression without potentially interfering with its execution.


## Function listenValidation

This function lets you keep an eye on potential problems during your risk validation checks. Whenever a validation check fails and throws an error, this function will notify you. It's a great way to catch and debug those errors as they happen. Importantly, the notifications happen one at a time, even if your error handling function takes some time to run – this helps prevent things from getting out of control. You provide a function that will be called whenever an error occurs, and this function will return another function to unsubscribe from these notifications later.

## Function listenStrategyCommitOnce

This function lets you react to specific changes in your trading strategies, but only once. Think of it as setting up a temporary listener that does its job and then disappears. You tell it what kind of strategy event you're interested in using a filter, and then you provide a function that will run just one time when that event happens. It’s perfect for situations where you need to take action based on a single, specific strategy commitment. The function returns a way to stop the listener if you need to cancel it early.

## Function listenStrategyCommit

This function lets you keep an eye on what's happening with your trading strategies. It's like setting up a notification system that tells you when certain actions are taken, such as signals being canceled, positions being closed, or stop-loss and take-profit levels being adjusted. The notifications come one after another, ensuring that they're handled in the order they occur, even if your notification handling code takes some time to process. Think of it as a way to react to strategy changes as they happen, giving you a clear understanding of your trades' evolution. You provide a function that gets called whenever one of these events occurs, allowing you to build custom responses to them.

## Function listenSignalOnce

This function lets you react to a specific signal event just *once* and then automatically stop listening. Think of it as setting up a temporary alert – you're waiting for a particular condition to be met within your trading strategy’s data, and when it happens, you want to do something specific, and then you're done. You provide a filter that defines what conditions trigger the reaction, and a callback function that gets executed when the filter matches. After the callback runs, the listener is automatically removed, so you don’t have to worry about cleaning it up yourself.

## Function listenSignalLiveOnce

This function lets you temporarily listen for specific trading signals coming from a live simulation. You provide a filter that describes which signals you're interested in, and a function that will be executed once a matching signal arrives.  Think of it as setting up a temporary listener – it runs once, handles the signal, and then automatically stops listening. It’s useful for things like reacting to a single, specific market condition during a live backtest run. Only signals generated during a `Live.run()` execution will be picked up.

## Function listenSignalLive

This function lets you tap into the live trading signals generated by backtest-kit. Think of it as setting up a listener that gets notified whenever a signal is produced during a live run. Importantly, it only works with signals from `Live.run()`. The signals arrive one at a time, in the order they're generated, so you can be sure you're processing them sequentially. You provide a function that will be called each time a new signal is available; that function will receive the signal data. When you're done listening, the function returns another function that you can call to unsubscribe and stop receiving signals.


## Function listenSignalBacktestOnce

This function lets you listen for specific signals generated during a backtest, but only once. You provide a filter to define which signals you're interested in, and a function to execute when a matching signal arrives. Once that one signal is processed, the listener automatically stops, so you don’t need to worry about manually unsubscribing. It’s perfect for quick, single-use actions based on backtest events.


## Function listenSignalBacktest

This function lets you tap into the backtest process and react to signals as they happen. Think of it as setting up an observer that gets notified whenever a signal is generated during a backtest run. The signals are delivered one at a time, ensuring events are handled in the order they occur. To start receiving these signals, you provide a function that will be called with the signal data for each event. When you're finished listening, the function returns another function that you can call to unsubscribe.

## Function listenSignal

This function lets you tap into the stream of signals generated by your trading strategy. Think of it as setting up a listener that gets notified whenever your strategy changes state – whether it's idle, opening a position, actively trading, or closing one. 

The function provides a way to receive these signals one after another, even if your handling code involves asynchronous operations. It makes sure signals are processed in the order they arrive and prevents multiple signals from being handled at the same time, ensuring a reliable and predictable flow of information. You provide a function (`fn`) that will be called with the signal data each time a state change occurs. The function returns another function that you can call to unsubscribe from the signal listener.

## Function listenSchedulePingOnce

This function lets you react to specific ping events and then automatically stop listening. Think of it as setting up a temporary listener that only fires once when a particular condition is met. You provide a filter to define which events you’re interested in and a function to run when the event occurs. Once the event happens, the listener disappears, so you don't have to worry about cleaning it up yourself. It’s handy when you need to respond to something just once and then move on.


## Function listenSchedulePing

This function lets you keep an eye on signals that are waiting to be activated – those in a "scheduled" state. It sends out a "ping" every minute while a signal is being monitored, giving you a regular update. You can use this to build custom monitoring systems or just track how long a signal has been waiting. The function you provide will be called with details about each ping event, allowing you to react to these updates in your own way. When you're finished, the function returns another function that you can call to unsubscribe from these ping events.

## Function listenRiskOnce

This function lets you set up a listener that reacts to risk rejection events, but only once. You provide a filter – a rule that determines which events you're interested in – and a function to execute when a matching event occurs. Once that event is processed, the listener automatically stops, making it perfect for situations where you need to respond to a specific risk condition just one time and then move on. It's a clean way to handle one-off risk events without lingering subscriptions.

## Function listenRisk

This function lets you be notified whenever a trading signal is blocked because it violates a risk constraint. It's like having an alert system specifically for when your risk rules kick in. Importantly, you'll only receive notifications for rejected signals, not those that are approved, which helps keep things clean and avoids unnecessary messages. The notifications are delivered one after another, even if your processing takes some time, and ensures that they are handled in the order they arrive. You provide a function that will be called whenever a risk rejection occurs, and this function returns another function that you can use to stop listening to those notifications.

## Function listenPerformance

This function lets you monitor how quickly your trading strategies are executing. It essentially sets up a listener that gets notified whenever a performance metric is recorded during your strategy's run. Think of it as a way to keep an eye on the timing of different operations within your code.

The information it provides can be invaluable for finding slow parts of your strategy – those performance bottlenecks that might be dragging down your overall results. 

Importantly, the callbacks you provide are handled in a special queue, ensuring that they run one at a time, even if they involve asynchronous operations. This prevents issues and ensures data consistency when you're analyzing performance. You provide a function (`fn`) that will be called with the performance data whenever an event is triggered.


## Function listenPartialProfitAvailableOnce

This function lets you set up a one-time alert for when a specific profit condition is met in your backtest. You provide a filter – essentially, a rule – that defines the exact profit situation you're looking for. When that situation arises, a callback function you specify will run just once, and then the alert automatically disappears. It's a quick way to react to a particular profit event without continuously monitoring.


## Function listenPartialProfitAvailable

This function lets you keep track of your trading progress as you reach profit milestones. It will notify you when your trade hits certain profit levels, like 10%, 20%, or 30% gain. 

The important thing is that these notifications are handled in order, one at a time, even if the code you provide to handle them takes some time to run. This makes sure things don't get messed up by running multiple notifications simultaneously.

You simply give it a function that will be called whenever a partial profit milestone is reached, and it will take care of the rest. When you're done listening for these events, the function returns another function you can call to unsubscribe.

## Function listenPartialLossAvailableOnce

This function lets you set up a listener that reacts to specific partial loss events, but only once. You provide a filter to define which events you're interested in – essentially, you tell it "I only care about these types of loss situations." Then, you give it a function to run when a matching event happens. Once that event is processed, the listener automatically stops, so you don't have to worry about managing subscriptions. It’s a handy way to respond to a particular loss condition and then move on. 

It takes two parts: a filter to specify the events you want to observe, and a function that will be executed when a matching event occurs. The function will be called only one time and then the listener will be automatically removed.

## Function listenPartialLossAvailable

This function lets you keep track of when your trading strategy hits certain loss milestones, like 10%, 20%, or 30% loss. It's designed to make sure these updates happen in order, even if the callback you provide takes some time to process. Think of it as setting up a listener that tells you "You've now reached 20% loss" and guarantees that information arrives reliably and in the correct sequence.  You give it a function that will be called whenever a loss level is reached, and it returns a function you can use to unsubscribe from those updates later.

## Function listenExit

This function lets you be notified when the backtest-kit framework encounters a serious, unrecoverable error that stops the background processes like live trading or backtesting. Think of it as an emergency alert system for your code.

These aren't the typical errors you might handle with other error listeners; these are the big ones that mean something went fundamentally wrong.

The function ensures errors are handled one at a time, even if your error handling code takes some time to complete. This avoids potential conflicts and ensures consistent error processing. To stop listening for these critical errors, the function returns a cleanup function you can call.

## Function listenError

This function lets you set up a listener that will be notified whenever your trading strategy encounters a recoverable error, like a problem connecting to an API. Instead of stopping everything, these errors are handled and your strategy keeps running. The errors are reported in the order they happen, and even if your error handling code takes some time to complete (like making another request), the system ensures things are processed one at a time to avoid any conflicts. You provide a function that will be called whenever such an error occurs, and this function will receive the error details. The function will return a function that you can call to unsubscribe from listening to errors.

## Function listenDoneWalkerOnce

This function lets you react to when background tasks within your trading strategy finish, but only once. You provide a filter to specify which completion events you’re interested in, and a function to run when a matching event happens. Once that function has been executed, the subscription automatically stops, so you don't have to worry about managing it manually. It's a simple way to get notified about specific background task completions and then move on.

Here’s a breakdown:

*   You define a condition (`filterFn`) to identify the relevant completion events.
*   You provide a function (`fn`) that will be executed when a matching event occurs.
*   The subscription is automatically removed after the function runs once.

## Function listenDoneWalker

This function lets you be notified when a background process within your backtest completes. Think of it as setting up a listener for when a specific task finishes. It makes sure these completion notifications happen one after another, even if the notification itself requires some asynchronous processing. You provide a function that will be called when the background process is done, and this function returns another function that you can use to unsubscribe from these notifications later.

## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running within your backtest. Think of it as a way to be notified when a specific process completes, but only once. You provide a filter to identify which completed tasks you're interested in, and then a function that gets called when a matching task finishes. Once that function runs, the subscription automatically stops, ensuring you won't be bothered by further completion events. It's a clean way to handle single, time-sensitive actions related to background processes.


## Function listenDoneLive

This function lets you be notified when background tasks run by the Live system are finished. It's designed to handle these finishing events in a predictable order, even if the function you provide takes some time to complete. Think of it as setting up a listener that gets triggered when a background process is done, ensuring that any actions you take in response happen one after another. You provide a function that will be executed when the background task completes. The function you provide will be executed sequentially, preventing multiple executions at once.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but only once. You provide a filter – a way to specify which backtest completions you're interested in – and a function to run when a matching backtest is done. Once your function has run, the subscription automatically stops, so you won't be notified again. It’s a simple way to perform a single action after a specific backtest completes without needing to manage subscriptions manually. 

You give it two things:

*   A filter to select the backtest completions you care about.
*   The code you want to run when a matching backtest finishes.



The function returns a way to unsubscribe the listener.

## Function listenDoneBacktest

This function lets you be notified when a background backtest finishes running. It's useful if you need to do something after a backtest completes, like updating a user interface or saving results. The function gives you a callback that gets triggered when the backtest is done, and it handles the callback execution in a safe, sequential way, even if your callback involves asynchronous operations. Think of it as a reliable way to know when a long-running backtest is finished, ensuring that any subsequent actions are handled correctly. You provide a function that will be executed when the backtest concludes, and it returns a function you can call to unsubscribe from these notifications.

## Function listenBreakevenAvailableOnce

This function lets you set up a listener that waits for a specific breakeven condition to be met, and then reacts once. You provide a filter to define exactly what condition you're looking for, and a function to execute when that condition appears.  Once the condition is found and your function runs, the listener automatically stops, so you don't need to worry about cleaning up. It's a handy way to react to a single, specific breakeven event and then move on.


## Function listenBreakevenAvailable

This function lets you be notified whenever a trade's stop-loss automatically moves to breakeven, which means the profit has covered the costs of the trade. Think of it as a signal that your trade is doing well enough to protect your initial investment. When this happens, a `BreakevenContract` object is sent to your provided function. To keep things orderly, your function will be called one after another, even if it takes some time to process each event.

## Function listenBacktestProgress

This function lets you keep an eye on how your backtest is running. It's like setting up a listener that gets notified as the backtest progresses, sending you updates along the way. These updates are delivered one at a time, even if the information needs some processing before it's fully handled. It ensures that these updates are managed safely and in order. You provide a function that will be called with each progress event, allowing you to react to the backtest's status.

## Function listenActivePingOnce

This function lets you react to specific active ping events just once. You provide a filter – a way to identify the events you're interested in – and a callback function that will be executed when a matching event occurs. Once the callback runs, the listener automatically stops, ensuring you only respond to that initial event. It's a handy way to wait for a particular condition to be met within the active ping stream and then take action.


## Function listenActivePing

This function lets you keep an eye on what’s happening with active trading signals. It essentially provides a notification every minute about the status of pending signals. You can use this to build systems that react to changes in those signal states, like automatically adjusting your trading strategies. The important thing to know is that these notifications are handled in order, and the function makes sure only one notification is processed at a time, even if your notification handling takes some time. To use it, you simply provide a function that will be called with the signal details whenever a new ping event occurs.

## Function hasTradeContext

This function simply tells you if the system is ready for trading actions. It verifies that both the execution and method contexts are available. Think of it as a check to ensure you're in a state where you can safely use functions that interact with the exchange, like fetching candle data or formatting prices. If this function returns `true`, it means you're good to go! If it's `false`, you might be setting up or cleaning up, and you shouldn’t attempt those exchange interactions just yet.


## Function getWalkerSchema

This function helps you understand the structure of a specific trading strategy, or "walker," within the backtest-kit framework. Think of it as a way to peek inside how a particular strategy is built. You give it the name of the strategy you're interested in, and it gives you back a detailed description of its components and how they fit together. This description is in the form of a schema, which defines the expected data types and structure. It’s useful for developers who want to extend or debug existing strategies or create new ones.

## Function getSymbol

This function lets you find out which asset you're currently trading. It’s a simple way to retrieve the symbol, like "BTCUSDT," within your backtest or trading strategy. It returns a promise that resolves to the symbol as a string. Think of it as a quick lookup to know exactly what you're working with.

## Function getStrategySchema

This function helps you understand the structure of a trading strategy you’re using. It essentially fetches a blueprint, or schema, that describes what inputs a strategy expects and how it’s organized. You give it the name of the strategy, and it returns a detailed description of that strategy's configuration. This is useful for validating strategy configurations or dynamically generating user interfaces for setting strategy parameters. Think of it like looking up the specifications for a particular type of tool – it tells you exactly what it needs to work properly.

## Function getSizingSchema

This function helps you find the specific rules and logic used to determine how much of an asset to trade. Think of it as looking up a pre-defined trading strategy for sizing your positions. You provide a name, which acts like a unique label for that strategy, and the function returns a detailed description of how that strategy works. It's a quick way to understand the sizing approach being used in your backtest.

## Function getRiskSchema

This function helps you access the details of a specific risk measure you've defined within your backtesting system. Think of it as looking up a blueprint for how a particular risk calculation should be performed. You simply provide the unique name you gave to that risk measure, and the function returns a structured description of it. This description outlines things like the inputs required and how the risk is calculated.

## Function getRawCandles

This function lets you retrieve historical candle data for a specific trading pair and time interval. You can control how many candles you get and the date range you're interested in.  It’s designed to ensure fairness in backtesting by preventing you from accidentally looking into the future.

You have several options for specifying the date range and number of candles. You can provide a start date, an end date, and a limit, just an end date and a limit, or even just a limit to get candles back from the current time. The function automatically handles calculating dates when you only provide a partial set of parameters.

Here’s a breakdown of what you can do:

*   Specify a symbol like "BTCUSDT" and a time interval like "1h" to get the data you need.
*   Use `limit` to fetch a specific number of candles.
*   Define `sDate` and `eDate` to narrow down the date range.
*   If you don't specify a start date, the function will fetch candles backward from the end date.

## Function getOrderBook

This function lets you retrieve the order book for a specific trading pair, like BTCUSDT, from the exchange you're connected to. You can specify how many levels of the order book you want to see; if you don't, it will default to a reasonable depth. The function takes into account the timing of your backtest or live trading environment, allowing the exchange to handle the timing details appropriately. Essentially, it gives you a snapshot of the current buy and sell orders for a given pair.

## Function getNextCandles

This function helps you retrieve future candles for a specific trading pair and timeframe. Think of it as asking for the next few candles that will be available, based on the current time within the backtest environment. You provide the symbol, like "BTCUSDT," the interval like "5m" (for 5-minute candles), and how many candles you want. The function then uses the underlying exchange connection to fetch those candles, ensuring they're positioned correctly within your backtesting timeline.


## Function getMode

This function tells you whether the backtest-kit is running in backtest mode or live trading mode. It’s a simple way to check the environment your code is operating in, allowing you to adjust behavior accordingly. The function returns a promise that resolves to either "backtest" or "live," giving you a clear indication of the current operational context. You can use this information to conditionally execute different logic based on whether you're simulating trades or actively trading.

## Function getFrameSchema

This function helps you understand the structure of a particular trading frame within backtest-kit. Think of it as a way to peek at the expected data format for a frame you’re working with.  You give it the name of the frame you're interested in, and it returns a description outlining what data fields that frame should contain. This is really useful for validating your data and ensuring everything aligns with the framework’s expectations, preventing potential errors during backtesting. The name you provide must correspond to a frame already registered within the system.

## Function getExchangeSchema

This function helps you get information about a specific cryptocurrency exchange that backtest-kit knows about. Think of it as looking up the details – like how orders work, what symbols are available – for a particular exchange. You give it the name of the exchange you're interested in, and it returns a structured description of that exchange's features. This description is useful for configuring your trading strategies and ensuring they interact correctly with the exchange you're simulating.

## Function getDefaultConfig

This function provides you with a set of default settings used by the backtest-kit framework. Think of it as a starting point for your configurations – it lays out all the possible settings you can adjust and shows you what their typical values are. You can look through these defaults to understand the various options you have for controlling how the backtesting process works, from candle retrieval to order management and signal generation. It returns a snapshot of these settings that you can inspect and use as a base for your own customized configurations.

## Function getDefaultColumns

This function gives you a peek at the standard column setup used for generating reports. It provides a ready-made configuration with pre-defined columns for things like strategy performance, risk, and scheduling. Think of it as a template—you can look at it to understand the possibilities and default settings for report columns before customizing them for your own needs. It's a handy way to explore the column options and how they're structured.

## Function getDate

This function, `getDate`, lets you find out what the current date is within your trading strategy.  It's designed to work differently depending on whether you're running a backtest or trading live. When backtesting, it gives you the date associated with the specific historical timeframe your strategy is analyzing. If you’re running a live trading strategy, it provides the actual, current date and time. Basically, it’s a handy tool to know exactly when your strategy is making decisions.

## Function getContext

This function gives you access to important details about where your code is running within the backtest-kit framework. Think of it as a way to peek under the hood and understand the specifics of the current task. It returns an object containing information about the environment the code is executing in, which can be really useful for more complex strategies or debugging. You can use it to access things like the current time period or other relevant data.

## Function getConfig

This function allows you to see the current settings that backtest-kit is using. Think of it as a way to peek under the hood and understand how the system is configured. It provides a snapshot of all the global configuration options, ensuring that you're looking at the values without accidentally changing them. You can use this to check things like retry counts for fetching candle data, or limits on signal generation.

## Function getColumns

This function lets you see the setup for the columns used when generating reports. It gives you a snapshot of how the data is organized for backtests, heatmaps, live data, partial fills, breakeven points, performance metrics, risk events, scheduled events, strategy events, walker P&L, and walker strategy results. The information returned is a copy, so any changes you make won't affect the original configuration. Think of it as a way to peek under the hood and understand how your data is being displayed.

## Function getCandles

This function helps you retrieve historical price data, also known as candles, for a specific trading pair like BTCUSDT. You tell it which pair you're interested in, how frequent the data should be (like every minute, every hour), and how many data points you want to pull back in time. It then uses the connected exchange to get that data and presents it to you in a structured format. Think of it as requesting a historical chart of a specific asset.

## Function getBacktestTimeframe

This function helps you find out the exact date range being used for a backtest of a specific trading pair, like BTCUSDT. It returns a list of dates representing the start and end points of the backtesting period for that symbol. You can use this to confirm you're testing against the intended historical data. Essentially, it tells you what dates the backtest kit is working with for a particular cryptocurrency or asset.

## Function getAveragePrice

This function helps you figure out the average price of a trading pair, like BTCUSDT. It uses a method called VWAP, which takes into account not just the price but also how much of that asset was traded. 

Specifically, it looks at the last five minutes of trading data to calculate this average. If there's no trading volume to consider, it simply averages the closing prices instead. You just need to tell it which trading pair you're interested in, and it will return the calculated average price.

## Function getActionSchema

This function helps you find the details of a specific action that's been set up in your trading strategy. Think of it like looking up a recipe – you give it the name of the action (like "buy" or "sell"), and it gives you back all the information needed to understand how that action works, including what inputs it expects. It's useful when you need to programmatically inspect or validate actions within your backtest. The action name is a unique identifier for each registered action.

## Function formatQuantity

This function helps you ensure your trade quantities are formatted correctly for the exchange you're using. It takes a trading symbol like "BTCUSDT" and a raw quantity number, and then uses the exchange's specific rules to format that quantity into a string. This is particularly important because different exchanges require different numbers of decimal places for their trade sizes, and this function handles that for you, avoiding potential errors when placing orders. It essentially translates your internal quantity value into a format the exchange understands.


## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes a symbol like "BTCUSDT" and a raw price number as input, and then formats the price to match the specific rules of that exchange, ensuring the right number of decimal places are shown. Essentially, it cleans up the price data for user-friendly presentation. It returns a string representing the formatted price.

## Function commitTrailingTake

This function lets you tweak the trailing take-profit level for a pending trade. It's designed to prevent errors by always basing the calculation on the original take-profit distance you set when the trade was initially planned. Think of it as fine-tuning your exit strategy – you can make it more conservative (move the take-profit closer to your entry price) or more aggressive (move it further out).

Importantly, the function won’t make changes that would move your take-profit *away* from a more conservative position. For long trades, it only allows you to move the take-profit closer to your entry price, and for short trades, it only allows you to move it further.

You provide the symbol of the trading pair, the percentage shift you want to apply to the original take-profit, and the current market price to ensure the adjustment is appropriate. The function handles whether it’s running in backtesting or live trading mode automatically.

## Function commitTrailingStop

This function helps you manage your trailing stop-loss orders, ensuring they dynamically adjust based on market movement. It's designed to refine the distance of your stop-loss from the original entry price, not the currently adjusted stop-loss.

Think of it as a way to automatically tighten or loosen your stop-loss, either to protect profits or give your trade more breathing room. A negative shift brings the stop-loss closer to your entry, while a positive shift moves it further away.

Importantly, the system is smart about updates. It won't change your stop-loss distance unless the new adjustment offers better protection for your investment, always striving for a more favorable outcome.  For long positions, it will only allow a higher stop-loss; for short positions, it only allows a lower one, preventing it from moving against you. This function works seamlessly in both backtesting and live trading environments. 

You'll need to provide the trading symbol, the percentage adjustment you want to make, and the current market price to check.


## Function commitPartialProfit

This function lets you automatically close a portion of your open trade when it's moving towards your target profit. It's helpful for securing gains along the way. You specify the trading symbol and the percentage of the position you want to close, for example, closing 25% of your position. The function smartly figures out if it's running in a backtesting simulation or a live trading environment. It only executes the partial close if the price is trending in the direction of your take profit, ensuring you're truly making a profit before closing a part of the trade.

## Function commitPartialLoss

This function lets you partially close an open position when the price is trending in a losing direction, effectively moving towards your stop-loss level. It's a way to reduce risk and potentially limit losses on a trade. You specify the trading symbol and the percentage of the position you want to close, with that percentage needing to be between 0 and 100. The framework automatically handles whether it's running in backtesting or live trading mode, so you don’t have to worry about that.

## Function commitClosePending

This function lets you manually close a pending order that your trading strategy has already set up, without interrupting the strategy’s normal operation. Think of it as a way to manually intervene in an open position. It’s useful if you want to adjust your strategy’s actions mid-backtest or during live trading. Importantly, this action doesn't halt the strategy itself or affect any future signals; your strategy will keep running and generating signals as planned. You can optionally provide a close ID to keep track of this manual closure if needed.

## Function commitCancelScheduled

This function lets you cancel a previously scheduled trading signal without interrupting your strategy's overall operation. Think of it as removing a signal from the queue – it's no longer waiting to be triggered, but your strategy keeps running and can generate new signals. It’s useful if you need to adjust your plans mid-backtest or in a live trading environment. You can optionally provide a cancellation ID to help track where the cancellation request originated. Importantly, this action doesn't affect any currently active signals or halt your strategy.

## Function commitBreakeven

This function helps manage your trading risk by automatically adjusting your stop-loss order. It moves the stop-loss to the original entry price once the price has moved favorably enough to cover any transaction fees and a small buffer. This essentially turns your position into a risk-free one at that point. The function takes care of the details – it figures out whether you’re in a backtesting or live trading environment and gets the current price for you, making it easy to implement. You just need to provide the trading pair symbol to use the function.

## Function commitActivateScheduled

This function lets you trigger a scheduled signal to activate before the price actually hits the specified priceOpen level. Think of it as a way to manually say, "Okay, I want this signal to fire now." It's useful for scenarios where you want to proactively respond to a scheduled event.  The function takes the symbol of the trading pair and, optionally, an ID to help you track when you manually activated the signal.  The signal will then activate on the next market update. The framework automatically knows if it's running a backtest or a live trade.

## Function addWalkerSchema

This function lets you add a "walker" to your backtest kit setup. Think of a walker as a tool that runs multiple strategy tests against the same historical data, allowing you to directly compare how different strategies perform. You provide a configuration object, called `walkerSchema`, to define how this comparison should be carried out, specifying details like the strategies to compare and the metric you want to use for evaluation. Essentially, it's how you set up the infrastructure for comparing different trading strategies side-by-side.

## Function addStrategySchema

This function lets you tell backtest-kit about a new trading strategy you've created. Think of it as registering your strategy with the system so it knows how to work with it. When you register a strategy, backtest-kit will automatically check it to make sure everything is set up correctly, like confirming signal data and timing makes sense. It also helps prevent issues where signals arrive too frequently, and ensures your strategy can handle unexpected problems when running in real-time. You provide a configuration object, which describes how your strategy should behave.

## Function addSizingSchema

This function lets you tell backtest-kit how to determine the size of your trades. It's how you define your risk management strategy. You provide a configuration object that specifies things like whether you want to use a fixed percentage of your capital per trade, a Kelly Criterion approach, or something based on Average True Range (ATR). The configuration also includes limits on how large your positions can be, and even allows you to hook in custom logic for calculating position sizes. Essentially, it's a way to customize how your trading system manages risk.

## Function addRiskSchema

This function lets you set up how your trading strategies manage risk. Think of it as defining the boundaries within which your strategies can operate. 

You can use it to limit the total number of trades happening at once across all your strategies, ensuring you don't overextend yourself.

It also allows for more complex risk checks – beyond just position limits – such as analyzing correlations between assets or tracking portfolio-level metrics.

Finally, you can even define what happens when a trading signal is blocked due to risk constraints, either by rejecting it entirely or finding alternative solutions.

Because multiple strategies share this risk configuration, it allows for a holistic view of your overall risk exposure and coordinated risk management.

## Function addFrameSchema

This function lets you tell backtest-kit about a new timeframe generator you've created. Think of it as registering a way to create the sequences of time periods your backtesting will use.  You provide a configuration object that defines how these timeframes are generated, including the start and end dates for your backtest, the interval (like daily, hourly, etc.), and a function to handle any events that happen during timeframe generation. By registering these timeframes, backtest-kit knows how to build the data sequences it will use to simulate trading.

## Function addExchangeSchema

This function lets you tell backtest-kit about a new data source for trading, like Coinbase or Binance. You provide a configuration object describing how to fetch historical price data, format the prices and quantities used in your strategies, and even calculate things like VWAP (a volume-weighted average price). Essentially, it's how you connect the framework to the actual market data it needs to run your backtests. Think of it as adding a new trading venue to the system's knowledge base.

## Function addActionSchema

This function lets you tell backtest-kit about a specific action you want it to perform during a backtest or live trading. Think of actions as little automated tasks that happen based on what’s going on in your trading strategy. You can use them to send notifications to a messaging service like Telegram or Discord when certain events occur, log detailed information about your trades, or trigger other custom logic. 

Essentially, you’re defining a blueprint for how the framework should respond to different events within your strategy. Each action gets a unique chance to run for every step of your strategy, giving it access to all the relevant details like signal generation, profit/loss updates, and more. The `actionSchema` parameter is where you provide the details of that action, telling the framework what to do and when.
