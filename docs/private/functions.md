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

This function helps make sure everything is set up correctly before you run any tests or optimizations. It checks that all the things your backtest relies on – like exchanges, strategies, and sizing methods – actually exist and are registered. 

You can tell it specifically which things to check, or just let it verify everything. It's a quick way to catch configuration errors early on and save you from headaches later. The checks are also remembered for future use, so the process is efficient.

## Function stop

This function lets you pause a trading strategy, effectively halting it from creating any new trade signals. It's useful when you need to intervene or temporarily suspend the automated trading process.  The current ongoing trade will finish its lifecycle, but no new trades will be initiated. The system will gracefully stop either at a moment of inactivity or when the current trade concludes, adapting to whether you’re running a backtest or a live trading session.  You simply provide the trading symbol you want to pause.

## Function setLogger

You can customize how backtest-kit reports its activities by providing your own logger. This function lets you plug in a logger that adheres to the `ILogger` interface, and all internal messages will be routed through it.  The framework automatically adds helpful details to each log, such as the strategy name, the exchange being used, and the trading symbol, making it easier to understand what's happening during backtesting. Essentially, you're providing a central point for capturing and managing backtest-kit's internal logging.


## Function setConfig

This function lets you adjust how backtest-kit operates, allowing you to change default settings to suit your specific backtesting needs.  You can tweak various global parameters by providing a configuration object.  The `config` parameter lets you selectively override only the settings you want to change; you don't have to provide a complete configuration.  There's also an `_unsafe` option, which is generally only used in test environments to bypass certain validations - use it with caution.

## Function setColumns

This function lets you customize the columns that appear in your backtest reports when you generate them. You can tweak things like the labels or how data is displayed for each column. It’s useful if you want reports to look a specific way or highlight certain information. 

You provide a configuration object with the changes you want, and the system will apply them to the reports. The system will check to make sure your changes are valid, but if you’re working in a testing environment and need to bypass these checks, there’s an option to do so.

## Function overrideWalkerSchema

This function lets you adjust how backtest-kit analyzes and compares different trading strategies. Think of it as fine-tuning the evaluation process – you can modify specific parts of a pre-existing walker configuration without having to rebuild the whole thing. It’s useful when you want to change just a few settings to see how they affect the comparison results. You provide a partial configuration, and the function merges it with the original walker, keeping everything else the same.

## Function overrideStrategySchema

This function lets you modify a trading strategy that's already been set up in the backtest-kit framework. Think of it as a way to tweak an existing strategy without having to rebuild it from scratch. You provide a partial configuration – just the bits you want to change – and the function merges those updates with the original strategy’s settings, leaving everything else untouched. It's a handy tool for making small adjustments or adding new features to your strategies over time.

## Function overrideSizingSchema

This function lets you tweak an existing sizing schema – think of it as modifying how much of an asset you trade at a time. It doesn't replace the whole configuration, just the parts you specify.  You provide a partial sizing configuration, and the framework merges it with the existing one, keeping everything else as it was. This is useful when you want to adjust a sizing rule without completely redefining it. The function returns the modified sizing schema.

## Function overrideRiskSchema

This function lets you adjust a risk management setup that's already in place. Think of it as making small tweaks rather than starting from scratch. You provide a portion of the risk configuration you want to change, and it updates the existing configuration, leaving the rest untouched. This is useful for fine-tuning your risk parameters without having to redefine everything.


## Function overrideOptimizerSchema

This function lets you tweak existing optimizer configurations within the backtest-kit framework. Think of it as a way to make small adjustments—you provide a partial configuration, and it merges those changes with the original, leaving everything else untouched. It’s useful when you need to modify an optimizer’s settings without completely redefining it. You’re essentially providing updates to an optimizer’s blueprint.

## Function overrideFrameSchema

This function lets you tweak how your data is organized for backtesting, specifically the timeframe configuration. Think of it as a way to adjust a pre-existing timeframe setup – you can change certain aspects without having to redefine the entire timeframe from scratch. You provide a partial configuration, and it updates the existing timeframe, leaving any parts you don't specify untouched. This is helpful when you need to make small adjustments to your timeframes without completely rebuilding them.

## Function overrideExchangeSchema

This function lets you modify an exchange’s configuration after it’s already been set up within the backtest-kit framework. Think of it as a way to tweak an existing exchange's settings, like updating its data source or trading rules. Only the parts of the exchange configuration you provide will be changed; everything else stays as it was. You give it a partial configuration object, and it returns a new, updated exchange schema.

## Function overrideActionSchema

This function lets you tweak existing action handlers without completely replacing them. Think of it as a way to make small adjustments to how your trading framework responds to specific events. You can use it to update the logic, callbacks, or behavior of a handler, for example, to adapt it to different environments like development or production.  It’s particularly helpful when you want to change things without needing to re-register the entire action handler. You only need to specify the parts you want to change; everything else stays as it was.

## Function listWalkerSchema

This function provides a way to see all the different trading strategies or "walkers" that have been set up within the backtest-kit framework. Think of it as a directory listing of available strategies. It’s handy when you're troubleshooting, creating documentation, or building tools that need to know what strategies are available. The function returns a list containing information about each registered walker.

## Function listStrategySchema

This function lets you see all the different trading strategies that have been set up in your backtest-kit environment. It’s like a catalog of your strategies, giving you a list of their configurations. This is really handy if you're troubleshooting, creating documentation, or want to build a user interface that can automatically adapt to the strategies you're using. It pulls these strategy details from the system’s memory of registered strategies, accessed through the `addStrategy()` function.

## Function listSizingSchema

This function helps you see all the sizing strategies that are currently active in your backtest setup. Think of it as a way to peek under the hood and understand how your trades are being sized. It gathers all the sizing configurations you've previously added and presents them in a list, making it easy to check their settings or display them in a user interface. It's really handy for troubleshooting and understanding exactly how your trades will be sized during a backtest.

## Function listRiskSchema

This function lets you see all the risk schemas that are currently set up in your backtest. Think of it as a way to check what risk parameters are being used for your trading strategies. It's really helpful if you’re troubleshooting something or want to understand how your risk management is configured. The function returns a list of these risk schema configurations, which you can then use to display information or build tools around them.

## Function listOptimizerSchema

This function lets you see a complete list of all the different optimization strategies currently set up within your backtest environment. Think of it as a way to check what options are available for fine-tuning your trading algorithms. It’s really helpful if you're trying to understand how your system is configured or if you're building tools to manage these optimizers. The function returns a promise that resolves to an array, with each element describing one of the registered optimization strategies.

## Function listFrameSchema

This function lets you see a complete list of all the different data structures, or "frames," that your backtest kit is using. Think of it like getting a directory of all the tools in your workshop. It's particularly helpful when you're trying to understand how your system is organized, creating documentation, or building user interfaces that need to know about all available frame types. You can use it to quickly inspect what's been set up.


## Function listExchangeSchema

This function helps you discover all the different exchanges your backtest-kit setup knows about. Think of it as a way to see a list of all the supported trading venues. It's really handy if you're trying to understand your configuration, generate documentation, or build a user interface that needs to display exchange options. The function returns a promise that resolves to an array containing information about each registered exchange.

## Function listenWalkerProgress

This function lets you keep an eye on how your backtest is progressing. It allows you to receive updates after each strategy finishes running within a `Walker`. 

Think of it as setting up a listener that gets notified as your backtest completes each step. Importantly, the updates are handled one at a time, even if your notification code takes some time to process, ensuring things stay in order. You provide a function that will be called with these progress updates. When you're done listening, the function returns another function that you can call to unsubscribe.

## Function listenWalkerOnce

This function lets you watch for specific events happening within a trading simulation, but only once. You tell it what kind of event you're looking for using a filter – a simple test that determines if an event is interesting to you. Once it finds an event that matches your filter, it runs the code you provide (your callback function) just one time and then stops watching. It's really handy when you need to react to a particular situation occurring in your backtest, like a specific price level being reached.


## Function listenWalkerComplete

This function lets you be notified when the backtest process finishes running all your trading strategies. It's like setting up a listener that waits for the entire backtest to complete. Importantly, when the backtest is done, your callback function will be executed, and any asynchronous operations within that function will be handled in a safe, sequential order, preventing any unexpected issues from running things at the same time. You provide a function that will be called when the walker completes, and the function returns a way to unsubscribe from these notifications later if you need to.

## Function listenWalker

This function lets you keep an eye on how a backtest is progressing. It essentially sets up a listener that gets notified after each trading strategy finishes running within the backtest.

The listener function you provide will be called with information about the completed strategy.

Importantly, even if your listener function involves asynchronous operations, the updates will be processed one at a time, ensuring a controlled and predictable flow of information. This helps avoid any unexpected behavior caused by running things simultaneously. When you're done monitoring, the function returns another function you can call to unsubscribe from these updates.

## Function listenValidation

This function lets you keep an eye on any problems that pop up when the system is checking its trading signals for potential risks. Whenever a validation check fails and throws an error, this function will notify you. It's a great way to catch and debug these issues as they happen, making sure your trading system is operating as expected. The errors will be reported one at a time, even if your error handling code takes a little time to process.

## Function listenSignalOnce

This function lets you set up a listener that reacts to specific events, but only once. You provide a filter to define which events you're interested in, and a function to execute when a matching event occurs. After the callback runs once, the listener automatically stops, so you don't have to worry about cleaning it up. Think of it as a way to wait for a particular signal and then react to it, without needing to manage subscriptions yourself. 

It's helpful when you only need to respond to a condition once, such as waiting for a price to reach a certain level before initiating an action.


## Function listenSignalLiveOnce

This function lets you listen for specific trading signals coming from a live trading simulation. You provide a filter – essentially a rule – that determines which signals you're interested in. Then, you give it a function to run when a signal matches your rule. Importantly, this subscription only lasts for one event; once the function runs, it automatically stops listening. It’s perfect for reacting to a single, particular signal during a live run.


## Function listenSignalLive

This function lets you tap into the live trading signals generated during a backtest. Think of it as setting up a listener to receive updates as the backtest progresses. You provide a function that will be called whenever a new signal event occurs. Importantly, these signals are handled one at a time, ensuring they're processed in the order they arrive – this is especially helpful for strategies that rely on a specific sequence of actions. This listener only works when you're actively running a backtest using `Live.run()`.

## Function listenSignalBacktestOnce

This function lets you temporarily "listen in" on the events happening during a backtest run, but only for a single event that meets your specific criteria.  You provide a filter – a way to pick out exactly which events you’re interested in – and a function to run when that event occurs. Once that single event triggers your callback, the listening automatically stops. This is perfect for quickly inspecting a specific situation or verifying something during a backtest without needing to manage ongoing subscriptions.


## Function listenSignalBacktest

This function lets you tap into the backtest process and receive updates as it runs. It’s a way to be notified about what's happening during a backtest, specifically after you've started one with `Backtest.run()`. The updates you receive are processed one at a time, ensuring they happen in the order they occurred during the backtest. You provide a function that will be called with each update, allowing you to react to the backtest's progress. When you're finished listening, the function returns another function that you can call to unsubscribe.

## Function listenSignal

This function lets you react to changes in your trading strategy's state, like when a position is opened, active, or closed. Think of it as setting up a listener that gets notified whenever something significant happens with your trades. It makes sure these notifications are processed one at a time, even if the handling involves asynchronous operations, preventing any unexpected conflicts or race conditions. You provide a function that will be executed whenever a signal event occurs, and this function will receive detailed information about the event.

## Function listenSchedulePingOnce

This function lets you set up a temporary listener for ping events, but only cares about specific types. You provide a test – a `filterFn` – to determine which ping events you're interested in. Once a ping event matches your test, a callback function (`fn`) runs just once, and then the listener automatically stops listening. It's great for situations where you need to react to a particular ping condition and then don't need to monitor anymore.


## Function listenSchedulePing

This function lets you keep an eye on scheduled signals as they wait to be activated. Every minute while a signal is scheduled, a "ping" event is sent out, and you can use this function to register a callback that will be triggered whenever that ping happens. This is useful for checking the status of scheduled signals or implementing your own monitoring procedures. The function returns a way to unsubscribe from these ping events when you no longer need them.

## Function listenRiskOnce

This function lets you temporarily listen for specific risk rejection events and react to them just once. You provide a filter to identify the events you're interested in, and a function to execute when a matching event occurs. After the function runs once, it automatically stops listening, so it's perfect for situations where you need to check for a particular condition and then do something specific without ongoing monitoring. Think of it as setting up a temporary alert that fires only once when a certain risk condition is met.


## Function listenRisk

This function lets you keep an eye on when trading signals are blocked because they violate risk rules. It's like setting up an alert that only goes off when something *doesn't* pass the risk check.

You provide a function that will be called whenever a signal is rejected for risk reasons.  Importantly, this function will only be triggered when a signal is actively blocked, not when it’s approved.

The system ensures these alerts are handled one at a time, in the order they arrive, even if your alert function takes some time to process. This helps prevent issues that might arise from multiple callbacks happening at once.


## Function listenPerformance

This function lets you monitor how quickly your trading strategies are running. It's like adding a little observer that keeps track of the time it takes for different parts of your strategy to execute. 

You provide a function (`fn`) that will be called whenever a performance metric is recorded. This callback receives an event object containing details about the specific operation and its duration.

Importantly, the order of these performance events is preserved, and they are processed one at a time, even if your callback takes a while to run. This makes it great for spotting slow parts of your strategy and optimizing them for better performance. 

The function returns a function you can call to stop listening for these performance updates.

## Function listenPartialProfitAvailableOnce

This function lets you set up a listener that reacts to partial profit levels being reached, but only once. You provide a condition – a filter – to specify exactly when you want to be notified, and then you give it a function to execute when that condition is met.  Once the condition is triggered and your function runs, the listener automatically stops, making it perfect for handling one-off actions based on profit milestones. Essentially, it's a way to react to a specific profit situation and then forget about it. 

It takes two parts: a filter that defines when you want to trigger and a function to run when the filter is met.

## Function listenPartialProfitAvailable

This function lets you keep track of your trading progress as you reach certain profit milestones. It will notify you whenever your trade hits a predefined profit level, like 10%, 20%, or 30% gain. Importantly, these notifications happen in order, and the framework makes sure your code handling them runs one step at a time, even if your code takes some time to process each notification. You provide a function that will be called with information about the profit event, and this function returns another function that you can use to unsubscribe from the notifications later.


## Function listenPartialLossAvailableOnce

This function allows you to set up a listener that reacts to specific partial loss events – think of it as a one-time alert for when certain conditions related to potential losses are met. You provide a filter that defines which events you’re interested in, and a callback function that will execute just once when a matching event occurs.  Once the callback runs, the listener automatically stops, so you don’t need to worry about managing subscriptions. It's great for situations where you need to react to a particular loss scenario only once and then move on. 

It takes two parts: a filter to pinpoint the events you care about, and a function to execute when a matching event happens.  The function returns a way to unsubscribe the listener if you need to stop it manually before it naturally unsubscribes after the single execution.

## Function listenPartialLossAvailable

This function lets you keep track of when your trading strategy reaches certain loss levels, like 10%, 20%, or 30% of its potential. You provide a function that will be called whenever a new loss level is hit. Importantly, the events are handled one at a time, even if your callback function takes some time to complete, preventing any unexpected issues from running things simultaneously. It's a reliable way to monitor and react to your strategy’s performance in terms of potential losses.

## Function listenOptimizerProgress

This function lets you keep an eye on how your trading strategy optimizer is doing. It gives you updates as the optimizer works through its data, allowing you to track its progress. These updates happen one after another, even if the code you provide to handle them needs to do some asynchronous work. Basically, it's a way to get notified about optimizer milestones without worrying about things getting out of order or slowing down other parts of your system. You give it a function that will be called with progress information, and it returns a way to unsubscribe from those updates later.

## Function listenExit

The `listenExit` function lets you be notified when a critical error occurs that will halt a background process, like those used in live trading, backtesting, or data walking.  It's specifically for errors that can't be recovered from and will shut down the current process.  When one of these fatal errors happens, your provided callback function will be called with details about the error. Importantly, these errors are handled in the order they occur, even if your callback function needs to perform asynchronous operations. To ensure things run smoothly, the framework uses a queuing system to prevent multiple callbacks from running at the same time. The function returns an unsubscribe function that you can use to stop listening for exit events.

## Function listenError

This function lets you set up a listener that gets notified whenever your trading strategy encounters a recoverable error – think of it as a safety net for unexpected issues like temporary API problems. Instead of the whole process stopping, the error is caught, and your strategy can keep going.

The listener you provide will be called whenever an error happens, and it handles these errors in the order they occurred, even if your error handling code itself takes some time to complete. To ensure things stay organized and avoid conflicts, it uses a special queuing system to manage the error processing.

You essentially provide a function (`fn`) that will be executed when an error happens, and this function will return a function that allows you to unsubscribe from the error listener.

## Function listenDoneWalkerOnce

This function lets you listen for when a background task within your backtest completes, but only once. You provide a filter – a way to specify which completion events you're interested in – and a callback function that will run when a matching event happens. Once the callback has executed, the listener automatically stops listening, preventing it from triggering again. It's a clean way to react to a specific background task finishing without needing to manage subscriptions manually.


## Function listenDoneWalker

This function lets you be notified when a background process within a Walker finishes. It's particularly useful when you need to perform actions after these background tasks complete, ensuring they happen one after another even if the actions themselves take time. Think of it as setting up a listener that waits for these background jobs to wrap up and then sequentially executes your code in response to each completion. You provide a function that will be called when a background task is done, and the function returns another function that you can call to unsubscribe from these notifications.

## Function listenDoneLiveOnce

This function lets you react to when a background task running within your trading strategy finishes. You provide a filter – a way to specify exactly which completed tasks you’re interested in – and then a callback function that will run only once when a matching task is done. Once that callback has run, the subscription automatically stops, so you don't have to worry about cleaning up. It’s useful for responding to specific background processes without lingering subscriptions.


## Function listenDoneLive

This function lets you keep track of when background tasks run by your Live system have finished. Think of it as a way to get notified when something you started in the background is done. It ensures that the notifications happen one after another, even if the notification itself requires some processing time.  You provide a function that will be called when a background task completes, and this function returns another function that you can use to unsubscribe from those notifications later.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but in a special way – it only runs your code once. You provide a filter to specify which backtest completions you're interested in, and then a function to execute when that specific backtest is done. Once your function has run, the subscription is automatically removed, ensuring you won't be notified again. It's perfect for situations where you need to do something just once after a particular backtest concludes.

Here's a breakdown:

*   **Filtering:** You tell it *which* backtest completions you care about.
*   **One-Time Execution:** Your code runs only once for the matching backtest.
*   **Automatic Unsubscription:**  You don't have to manually remove the subscription; it handles that for you.

## Function listenDoneBacktest

This function lets you react when a backtest finishes running in the background. It's designed for handling events that need to be processed one after another, even if the processing itself takes some time. Think of it as setting up a listener that gets notified when the background backtest is done, ensuring any actions you take based on that completion happen in the correct order. You provide a function that will be executed upon completion, and it returns a function to unsubscribe from the listener when you no longer need it.

## Function listenBreakevenAvailableOnce

This function lets you react to a specific breakeven protection event – but only once. You tell it what kind of event you're looking for using a filter, and then provide a function to execute when that event happens. Once the event is found and your function runs, the listener automatically stops, so you won't get any more notifications. 

Think of it as setting up a temporary alert for a particular breakeven condition.

Here’s how it works:

*   You give it a filter to identify the precise event you need.
*   You provide a function that will run when the matching event occurs.
*   The function automatically unsubscribes after it executes once.

## Function listenBreakevenAvailable

This function lets you keep an eye on when your trades automatically adjust their stop-loss to breakeven. It's useful if you want to protect your profits without constantly monitoring the market. Essentially, it alerts you when the price has moved enough in your favor to cover the costs of the trade, and your stop-loss is automatically moved to your entry price. The alerts are delivered one at a time, ensuring your code handles them in the order they occur, even if your handling logic takes some time to complete. You provide a function that gets called whenever this breakeven event happens, and that function is automatically queued to prevent issues if it’s a more complex process.

## Function listenBacktestProgress

This function lets you monitor the progress of a backtest as it runs. It provides updates during the background calculations, allowing you to track how far along the process is. The updates are delivered one at a time, even if your callback function takes some time to process each update, ensuring things stay in order. Think of it as a way to get real-time glimpses into what's happening behind the scenes during a backtest. You provide a function that will receive these progress updates, and this function returns another function to unsubscribe.

## Function listenActivePingOnce

This function lets you react to specific active ping events and then automatically stop listening. Think of it as setting up a temporary listener that only fires once when a matching event happens. You provide a filter – a rule to determine which events you're interested in – and a function to execute when that event is found. Once the event triggers your function, the listener is automatically removed, so you don't have to worry about cleaning up subscriptions. It’s really handy when you need to wait for a particular condition to be met and then do something, without needing a permanent listener.


## Function listenActivePing

This function lets you keep an eye on active trading signals within the backtest-kit framework. It listens for events that are sent out every minute, giving you information about the status of your signals. Think of it as a way to be notified when a signal becomes active or changes state.

The events are handled one at a time, even if your code needs to do some asynchronous work to process each event. This ensures that everything happens in a controlled and orderly manner, preventing potential issues from multiple events running at the same time. You simply provide a function that will be called whenever a new active ping event occurs, and this function receives details about the event.

## Function hasTradeContext

This function quickly tells you if you're in a state where you can actually execute trading actions. Think of it as a safety check – it confirms that both the execution environment and the trading method are ready. If it returns `true`, you're good to go and can use functions that interact with the exchange, like getting historical price data or formatting order quantities. If it returns `false`, you’ll need to ensure the necessary setup is complete before proceeding.

## Function getWalkerSchema

This function helps you understand the structure of a specific trading strategy or analysis tool within the backtest-kit framework. Think of it as looking up the blueprint for a particular component. You give it the name of the strategy you're interested in, and it gives you back a detailed description of how that strategy is built, including the data it expects and the actions it performs. This is useful for developers building extensions or wanting to deeply understand how a walker operates.


## Function getSymbol

This function lets you find out which asset you're currently trading. It's a simple way to retrieve the symbol, like "BTCUSDT" or "ETHUSD", directly from the trading environment.  Think of it as asking "What am I trading right now?" and getting a clear answer back. It works asynchronously, meaning it might take a moment to get the symbol, so you'll receive it in a promise.

## Function getStrategySchema

This function helps you understand the structure of a trading strategy you're using. It fetches the blueprint, or schema, for a specific strategy by its name. Think of it like looking up the ingredients list for a recipe – it tells you what information the strategy expects and how it's organized. You give it the strategy's name, and it returns a detailed description of that strategy's requirements. This is useful for validating your strategy setup or programmatically working with strategy configurations.


## Function getSizingSchema

This function helps you find the specific rules for how much to trade based on a chosen name. Think of it as looking up a predefined strategy for determining your position size. You give it a name, and it returns the detailed configuration associated with that sizing strategy. This allows you to easily access and utilize different sizing approaches within your backtesting setup. Essentially, it's a lookup tool for your sizing plans.


## Function getRiskSchema

This function helps you access pre-defined templates for managing risk in your trading strategies. Think of it as looking up a specific blueprint for how to calculate and track a particular type of risk, like volatility or drawdown. You provide the name of the risk you're interested in, and the function returns the corresponding schema which details exactly how that risk should be handled. This simplifies ensuring consistency and accuracy when analyzing your backtest results.

## Function getOrderBook

This function lets you retrieve the order book for a specific trading pair, like BTCUSDT. It pulls this data from the exchange you're connected to. 

You can optionally specify how many levels of the order book you want to see – if you don’t provide a depth, it will default to a predefined maximum. 

The function is designed to work with both backtesting and live trading environments, allowing the exchange to handle the timing of the data request appropriately.


## Function getOptimizerSchema

This function helps you find out the structure and requirements of a particular trading optimizer within the backtest-kit framework. Think of it as a way to get a blueprint for how to set up and use a specific optimizer. You provide the name of the optimizer you're interested in, and the function returns a description of its expected schema, detailing the properties and data types it needs. This is useful for ensuring your optimizer configurations are valid and compatible.


## Function getMode

This function lets you check whether your trading strategy is running in backtest mode, simulating historical data, or in live mode, actually trading. It returns a simple indication – either "backtest" or "live" – so you can adjust your logic accordingly. This is useful for things like displaying different interfaces or adjusting risk management based on the environment. You'll get this information as a promise that resolves to a string.

## Function getFrameSchema

This function lets you find out the structure of a particular frame within the backtest-kit system. Think of it as looking up a blueprint – you give it the name of a frame, and it gives you back the information describing what data it expects and how it's organized. This is useful when you're building tools or visualizations that need to interact with the data inside these frames. You'll need to know the specific frame name you’re interested in to use this function.

## Function getExchangeSchema

This function helps you find the specific details needed to interact with different cryptocurrency exchanges within the backtest-kit framework. Think of it as looking up the blueprint for a particular exchange. You provide the exchange's name, and it returns a structured description outlining things like the available markets, order types, and data formats that exchange uses. This schema information is crucial for correctly configuring and simulating trades. It’s how the backtest-kit knows how to communicate with and interpret data from each supported exchange.


## Function getDefaultConfig

This function gives you a starting point for setting up your backtesting environment. It returns a set of predefined values for various settings, like how often the system checks for new signals, limits on slippage and fees, and parameters controlling candle data retrieval. Think of it as a template – you can look at these defaults and customize them to fine-tune your trading strategies. It's a handy way to understand all the configuration options available and what they're set to by default before you start making your own adjustments.

## Function getDefaultColumns

This function gives you a peek into the standard column setup used when creating markdown reports. It essentially provides a blueprint of all the columns – from those displaying strategy results and heatmaps to those showing live data and risk metrics – and how they're typically configured. Think of it as a handy reference guide to understand what columns you can use and what their default settings look like when building your backtest reports. It's a great starting point for customizing your reporting experience.

## Function getDate

This function, `getDate`, gives you access to the current date being used within your backtest or live trading environment.  Think of it as a way to know exactly what date your calculations or strategies are referencing. When you're running a backtest, it provides the date for the timeframe you’re currently analyzing. If you're trading live, it pulls the actual, real-time date. It’s a simple way to synchronize your code with the time context of your trading activity.

## Function getContext

This function lets you peek inside the current method being run within the backtest-kit framework. Think of it as a way to check what's happening behind the scenes. It returns an object with details about the environment of the current method, allowing you to access information like the current time step or other relevant data. Essentially, it provides a window into the current execution.

## Function getConfig

This function lets you peek at the framework's global settings. It gives you a snapshot of values like candle counts, slippage percentages, retry delays, and other important parameters that control how the backtest runs. Importantly, the configuration you receive is a copy, so you can look at it without worrying about accidentally changing the actual running settings. Think of it as a read-only window into the core parameters of your backtesting environment.

## Function getColumns

This function lets you peek at the column definitions used for generating reports within the backtest-kit framework. It gives you a snapshot of how data is organized for things like the backtest results, heatmap visualizations, live data displays, and performance metrics. Importantly, it provides a copy, so any changes you make won't affect the original configuration. Think of it as a way to understand what's being shown in your reports without risking any unintended adjustments.

## Function getCandles

This function lets you retrieve historical price data, or "candles," for a specific trading pair like BTCUSDT. You tell it which trading pair you’re interested in, how frequently the data should be grouped (like every minute, every hour, etc.), and how many candles you want to pull back in time.  It connects to the exchange you've set up in backtest-kit and grabs the data. The data returned is an array of candle objects, each containing open, high, low, close prices, and the time of the candle.

## Function getBacktestTimeframe

This function helps you find out the time period used for backtesting a specific trading pair, like Bitcoin against USDT. It takes the trading pair's symbol as input, such as "BTCUSDT," and returns a list of dates representing the backtest timeframe. Essentially, it tells you what historical data is being used to simulate trades for that particular symbol during a backtest. You can use this to verify the data range being used in your backtesting process.

## Function getAveragePrice

This function helps you figure out the average price a symbol has traded at, using a method called VWAP. It looks at the most recent five minutes of trading data to determine this average.

Specifically, it considers the high, low, and closing prices of each minute, calculates a "typical price" for each, and then weights those prices by the volume traded at each price.

If there's no trading volume available, it falls back to simply averaging the closing prices instead.

To use it, you just need to provide the trading symbol you're interested in, like "BTCUSDT".

## Function getActionSchema

This function helps you understand the structure of a specific trading action within the backtest-kit framework. It lets you look up a registered action, like a `buy` or `sell` order, and get details about what data it expects and what it returns.  Think of it as checking the blueprint for a particular action before you use it. You provide the name of the action you’re interested in, and the function gives you a schema describing its requirements and outputs. This is useful for validating your data or understanding how actions work internally.

## Function formatQuantity

This function helps you prepare quantity values correctly for trading. It takes a trading symbol, like "BTCUSDT", and a number representing the quantity you want to trade. Then, it automatically adjusts the quantity to match the specific formatting rules of the exchange you're using, ensuring the right number of decimal places are applied. This simplifies the process of submitting orders and avoids potential errors related to incorrect quantity formats.

## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes the symbol of the trading pair, like "BTCUSDT", and the raw price value as input. The function then formats the price based on the specific rules of the exchange you're using, ensuring that the right number of decimal places are shown. This avoids manual calculations and guarantees consistent price formatting.

## Function dumpSignalData

This function helps you save detailed logs from your AI trading strategies, making it easier to understand and debug how they're making decisions. It takes the conversation history with the LLM, along with the trading signal it generated, and organizes it into markdown files.

Think of it as creating a nicely formatted report that includes the initial instructions given to the AI, each user query, and the AI’s final response along with the trading details like target price and stop loss.

The function automatically creates a folder to store these files, and it won't overwrite any existing reports, which is great for keeping track of different strategy runs. You can specify a custom folder for these logs, or it will default to a folder named "dump/strategy" in your project. The name of the folder is based on a unique identifier assigned to the trading result.

## Function commitTrailingTake

This function helps refine your take-profit orders as the market moves. It's designed to adjust the distance of your take-profit, but crucially, it always bases its calculations on the *original* take-profit you set when the trade was initially placed. This prevents small errors from building up over time.

Think of it as fine-tuning your target – a negative percentage shift will bring your take-profit closer to your entry price, making it more cautious, while a positive shift moves it further out.

Importantly, it only makes changes that move your take-profit *closer* to your entry point. It won’t make it more aggressive; it prioritizes tightening your take profit. This means for long positions, it only lowers the take profit and for short positions, it only raises the take profit. 

The function knows whether it’s running in a backtest or a live trading environment automatically. You just need to provide the symbol you’re trading, the percentage shift you want to apply, and the current market price to help it determine any necessary adjustments.

## Function commitTrailingStop

This function lets you fine-tune your trailing stop-loss orders, helping you protect your profits as the market moves. It’s designed to adjust the distance of your stop-loss based on a percentage change relative to the original stop-loss you set when you entered the trade. 

Importantly, it always calculates adjustments from that initial stop-loss distance, so you avoid errors building up with repeated changes. You can tighten or loosen your stop-loss using negative or positive percentage shifts respectively.

The system smartly prevents you from accidentally making your stop-loss worse; it only adjusts if the new stop-loss provides better protection. For long positions, it only allows you to move your stop-loss higher, and for short positions, it only allows you to move it lower. It also handles the difference between backtesting and live trading automatically.

You’ll need to provide the symbol you’re trading, the percentage shift you want to apply, and the current market price to evaluate.

## Function commitSignalPromptHistory

This function helps keep track of the conversation history used for generating trading signals. It takes a symbol and a list of messages as input, and adds helpful information about the trading context to the beginning of the message list. Specifically, it adds system prompts related to the backtest mode, strategy name, exchange name, and frame name, followed by the user’s prompt. This ensures that the signal generation process has all the necessary context. The symbol is included primarily to aid in debugging.

## Function commitPartialProfit

This function lets you automatically close a portion of your open trade when it's making progress towards your target profit. It’s designed to help you lock in some gains along the way. You specify which trading pair you're dealing with and what percentage of the trade you want to close. The system will only execute this if the price is moving in a direction that would bring you closer to your overall take profit goal. It handles whether it's running in a simulated backtest or a live trading environment without you needing to worry about it.

## Function commitPartialLoss

This function lets you automatically close a portion of an open trade when the price moves in a direction that's unfavorable, essentially heading towards your stop-loss. It's designed to help you manage risk by reducing your exposure when things aren't going as planned. You specify which trading pair you’re working with and what percentage of the position you want to close, like closing 25% or 50% of your holdings. The function intelligently adapts to whether you're running a backtest or a live trade, so you don't have to worry about setting that up manually.


## Function commitCancel

This function lets you cancel a previously scheduled trading signal without interrupting your strategy's normal operation. Think of it as pausing a signal instead of stopping everything. It's useful when you want to temporarily hold off on a trade, perhaps because you've changed your mind or want to wait for a different market condition. You can optionally provide a unique ID to track your cancellation requests. Importantly, cancelling a signal doesn't impact any trades already in progress or prevent your strategy from generating new signals – it just removes the one you're canceling from the queue. The system automatically adapts to whether it's running a backtest or live trading.

## Function commitBreakeven

This function helps manage your trading risk by automatically adjusting your stop-loss order. It essentially moves your stop-loss to the entry price – meaning you're no longer at risk – once the price has moved favorably enough to cover any transaction fees and a small buffer.  The threshold for this movement is based on a combination of slippage and fee considerations.  It takes care of figuring out whether you're in a backtesting or live trading environment and retrieves the current price for you. You simply need to provide the trading symbol (like BTC/USDT) to use it.

## Function addWalkerSchema

This function lets you register a "walker" which is essentially a tool for comparing how different trading strategies perform against each other. Think of it as setting up a system to run multiple backtests at once and see which strategy comes out on top based on a defined measure. You provide a configuration object, called `walkerSchema`, that tells the framework how to run and evaluate these strategy comparisons. It's all about streamlining the process of analyzing and contrasting various trading approaches.

## Function addStrategySchema

This function lets you tell backtest-kit about a new trading strategy you’ve created. Think of it as registering your strategy so the framework knows how to use it. When you register a strategy, backtest-kit will check it to make sure the signals it generates are valid – checking things like prices, take profit/stop loss logic, and timestamps. It also helps prevent signal spam by controlling how often signals are sent and ensures your strategy's data can safely persist even if something unexpected happens during live trading. You provide the framework with a configuration object that describes your strategy to complete the registration.

## Function addSizingSchema

This function lets you tell the backtest-kit system how to determine the size of your trades. Think of it as defining your risk management rules. You provide a sizing schema, which specifies things like whether you want to use a fixed percentage of your capital, a Kelly Criterion approach, or something based on Average True Range (ATR) to calculate position sizes.  It also allows you to set limits on how big or small your positions can be and even provides a way to react to calculations as they happen. Essentially, it’s how you teach the framework your personal approach to position sizing.


## Function addRiskSchema

This function lets you set up how your trading strategies manage risk. Think of it as defining the guardrails for your trading system. You can specify limits on how many positions can be open at once and implement custom checks to ensure your portfolio remains healthy – maybe looking at correlations between assets or tracking key metrics. The great part is that multiple trading strategies can use the same risk configuration, allowing for a holistic view of risk across your entire portfolio. The system keeps track of all active positions, which your custom risk checks can then analyze.

## Function addOptimizerSchema

This function lets you tell backtest-kit about a new optimizer you want to use. Think of an optimizer as a system that automatically creates trading strategies for you, pulling data from different places and using large language models to generate ideas. It takes a configuration object that describes how your optimizer works, like where to get data, what prompts to use, and how to build the final trading code. The result is a complete file ready to be used within the backtest-kit environment.

## Function addFrameSchema

This function lets you tell backtest-kit about a new timeframe you want to use for your backtesting. Think of it as registering a way to create the historical data your strategies will trade against.  You provide a configuration object that describes how the timeframe should be generated, including the start and end dates of your backtest, the interval (like daily, hourly, or minute), and a function that will be called to actually create those timeframes. Basically, it's the key to defining the data your backtest will operate on.

## Function addExchangeSchema

This function lets you tell backtest-kit about a new data source for trading, like a specific exchange. Think of it as registering where the framework should pull historical price data from. You provide a configuration object that defines how the exchange works, including how it formats prices and how to calculate things like VWAP. Essentially, it's how you integrate a new exchange into the backtesting environment.

## Function addActionSchema

This function lets you plug in custom actions to your backtest. Think of actions as automated responses to events happening during your trading simulation—like when a trade hits a profit target or when a signal is generated. You can use these actions to do things like log events, send notifications, or even trigger other processes.  Essentially, it's a way to extend the backtest kit's functionality to handle specific situations or integrate with external services. The configuration object you provide describes what triggers the action and what it should do.
