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

## Function warmCandles

This function helps speed up backtesting by pre-loading historical price data. It fetches candles (which are essentially OHLCV data points) for a specified date range and stores them persistently, so they don't need to be downloaded again during a backtest run.  Think of it as preparing the data ahead of time. You give it a starting date and an ending date, and the function will download all the necessary candles for that period and save them for later use. This is particularly useful for long backtesting periods or when dealing with large datasets.

## Function validate

This function helps make sure everything is set up correctly before you start running tests or optimizations. It checks if all the things your trading strategy relies on – like exchanges, trading frames, strategies themselves, risk management rules, sizing methods, and walkers – actually exist and are properly registered.

You can tell it to check just specific parts, or if you leave it blank, it will go through and validate *everything*. Think of it as a quick safety check to catch any configuration errors early on and avoid unexpected problems during your backtesting process. The validation results are saved for later use, so it doesn't have to repeat the same checks over and over.

## Function stopStrategy

This function lets you pause a trading strategy's signal generation. It’s useful when you need to intervene or temporarily halt trading activity.

Essentially, it prevents the strategy from creating new trading signals, but any existing signals will finish their lifecycle. The system will gracefully stop, either when it's idle or after a signal has closed, depending on whether you’re running a backtest or a live trading session.

You just need to provide the symbol of the trading pair you want to stop the strategy for.

## Function shutdown

This function provides a way to properly end a backtesting session. It sends a signal to all parts of the backtest system, letting them know it's time to clean up and prepare to finish. Think of it as a gentle way to stop the backtest, ensuring everything is saved and closed correctly, especially useful when you need to interrupt a running test. It’s helpful when responding to signals like pressing Ctrl+C to stop a test.

## Function setLogger

You can now control where and how backtest-kit logs its information. This function lets you plug in your own logging system – maybe you want to send logs to a file, a database, or a custom monitoring tool. When you provide a logger, any internal messages from the framework will be sent through it, along with helpful context like the trading strategy name, exchange, and the asset being traded. This makes it much easier to debug and monitor your backtesting process.



ILogger interface is not defined in this example.

## Function setConfig

This function lets you adjust how the backtest-kit framework operates. Think of it as tweaking the environment for your trading simulations. You can modify specific settings to override the default values, allowing you to customize things like data handling or execution behavior. If you're working in a testing environment and need to bypass certain validations, there's a flag you can use for that too.

## Function setColumns

This function lets you customize the columns that appear in your backtest reports, like the ones generated for markdown. Think of it as a way to tweak the report's layout and what information is displayed. You can change the definitions of existing columns, tailoring them to show exactly what you need. There's a safety check to make sure your changes are valid, but if you're working in a testing environment where you need maximum flexibility, you can bypass that check with a special flag.

## Function overrideWalkerSchema

This function lets you tweak an existing strategy's walker configuration – think of it as customizing how the strategy explores different trading scenarios. You can selectively change parts of the walker's settings without having to redefine the whole thing. It's useful when you want to experiment with a strategy’s exploration process or compare it with slightly different walker setups. You provide a partial configuration, and the function merges it with the existing walker, leaving the rest untouched.

## Function overrideStrategySchema

This function lets you modify a trading strategy that's already been set up in the backtest-kit framework. Think of it as a way to fine-tune an existing strategy without completely rebuilding it. You provide a partial configuration – just the pieces you want to change – and the framework updates the original strategy, leaving everything else untouched. It’s a convenient way to adjust settings or add new options to a strategy after it's initially defined.

## Function overrideSizingSchema

This function lets you tweak existing position sizing rules within the backtest kit. Think of it as a way to make small adjustments – you provide only the parts of the sizing schema you want to change, and the rest stays as it was. It’s useful when you need to fine-tune sizing behavior without completely redefining a sizing strategy. The function returns a promise that resolves to the updated sizing schema.


## Function overrideRiskSchema

This function lets you tweak an existing risk management setup within the backtest-kit framework. Think of it as a way to make small adjustments to a larger risk profile you’ve already defined. It doesn't replace the entire configuration; instead, you just specify the parts you want to change, and the rest of the original settings remain in place. This is helpful when you want to refine your risk management without starting from scratch. You provide a partial configuration object, and it returns a modified risk schema.

## Function overrideFrameSchema

This function lets you tweak existing timeframe configurations used during backtesting. Think of it as making small adjustments to a pre-defined schedule – you can change specific parts of it, like the interval length or data fields, without having to recreate the entire timeframe setup from scratch. It's useful for refining your backtesting environment based on specific needs or testing different interval lengths. You provide a partial configuration, and it updates the existing timeframe with just the changes you specify, keeping everything else the same.

## Function overrideExchangeSchema

This function lets you modify a trading exchange's data source configuration that's already set up within the backtest-kit framework. Think of it as a way to tweak an existing exchange – perhaps you want to adjust the data frequency or change a specific parameter.  It only updates the parts of the exchange configuration you provide; anything you don't specify stays the same. This is useful for making small adjustments without completely reconfiguring an exchange. You give it a piece of the exchange's settings, and it returns the updated exchange schema.

## Function overrideActionSchema

This function lets you tweak how your action handlers work without having to completely re-register them. Think of it as a way to make small adjustments to existing handlers, like changing how they respond to events or updating the logic they use. Only the parts of the action handler you specify will be changed, leaving everything else untouched. This is especially helpful when you need to modify handler behavior for different environments, dynamically switch between handler implementations, or fine-tune actions without needing to alter the core strategy. You simply provide a partial configuration object, and the framework updates the existing action handler accordingly.

## Function listenWalkerProgress

This function lets you track the progress of a backtest as it runs. It provides updates after each strategy within the backtest has finished. You'll get these updates as events, processed one at a time, even if your callback function takes some time to complete. Think of it as a way to monitor the backtest's execution step-by-step, ensuring that updates are handled safely and in the correct order. To use it, you simply provide a function that will be called whenever a progress update is available.

## Function listenWalkerOnce

This function lets you temporarily "listen" for specific progress updates from a trading simulation. You provide a filter – essentially a rule – to identify the updates you're interested in. Once an update matches your rule, the provided callback function runs just once, and then the listener automatically stops. Think of it as setting up a temporary alert to react to a particular event within the backtest. It's a handy way to wait for a specific condition to be met during a simulation without continuously monitoring for updates.


## Function listenWalkerComplete

This function lets you be notified when a backtest run finishes. It's designed to handle events even if your notification process takes some time, ensuring things happen in the order they're received. Essentially, you provide a function that gets called when the backtest is complete, and this system makes sure that function runs one at a time, preventing any potential issues with multiple processes happening simultaneously. You’ll receive a specific event object containing information about the completed backtest.

## Function listenWalker

The `listenWalker` function lets you keep track of how a backtest is progressing. It's like setting up a notification system that tells you when each trading strategy finishes running within a backtest.  Importantly, these notifications are handled one at a time, even if the notification processing itself takes some time. This ensures a predictable order and avoids unexpected issues caused by multiple things happening at once. You give it a function that will receive updates on the walker's progress, and it returns a function you can use to unsubscribe later.

## Function listenValidation

This function lets you keep an eye on potential problems during risk validation. It's like setting up an alert system that notifies you whenever a validation check encounters an error. Any errors that happen during these checks will trigger the alert, and these alerts will be handled one at a time, in the order they occurred, so you can investigate them methodically. You provide a function that will receive details about the error, allowing you to log it, report it, or take other corrective actions. When you're done monitoring, you can unsubscribe from these alerts using the function it returns.

## Function listenSyncOnce

This function lets you temporarily listen for specific signal synchronization events and react to them just once. Think of it as setting up a temporary listener that only runs once when a particular condition is met. 

It’s particularly helpful when you need to quickly coordinate with something outside of your backtest, like an external data feed or system. 

You provide a filter to specify which events you're interested in and a function to handle them.  If that handling function involves asynchronous operations, like promises, the backtest will pause until those operations finish before continuing to ensure everything stays synchronized. The function returns a way to unsubscribe from the listener when you’re done.

## Function listenSync

This function lets you tap into events that happen when signals are being synchronized, like when an order is about to be placed or closed. It’s especially helpful if you need to coordinate with other systems, like a brokerage or data provider, that might take some time to respond. 

The function you provide will be called whenever a synchronization event occurs. If your function returns a promise, backtest-kit will pause processing signals until that promise resolves, ensuring everything stays in sync. This means that if something goes wrong in your function, it can prevent new positions from being opened or closed until the issue is resolved.

## Function listenStrategyCommitOnce

This function lets you monitor strategy management events, but only for a specific instance. You provide a filter to identify the exact event you’re interested in, and then a function to run when that event occurs. Once the event is detected and your function executes, the monitoring stops automatically, which is handy for single, targeted actions. It's a simple way to react to a particular strategy change and then move on.

## Function listenStrategyCommit

This function lets you keep an eye on what's happening with your trading strategy. It's like setting up an alert system that notifies you whenever certain actions are taken, such as canceling scheduled orders, closing positions, or adjusting stop-loss and take-profit levels. The cool thing is that these notifications are processed one at a time, ensuring things happen in the order they’re received, even if your notification handling code takes some time. You provide a function that will be called whenever one of these events occurs, allowing you to react to changes in your strategy's behavior. When you’re done listening, the function returns another function that you can use to unsubscribe.

## Function listenSignalOnce

This function lets you listen for specific trading signals and react to them just once. You provide a filter—a way to describe the exact signal you're waiting for—and a function that will run when that signal arrives. Once the signal matches your filter and the function runs, the listener automatically stops, so you won’t be bothered by future signals. This is a handy way to ensure an action happens only when a particular condition is met.

You define how to identify the signal you're interested in, and then tell it what to do when that signal arrives. The listener handles the details of watching for that signal and unsubscribing afterward.


## Function listenSignalLiveOnce

This function lets you temporarily listen for specific trading signals coming from a live strategy execution. You provide a filter – essentially a rule – that determines which signals you're interested in, and a callback function that gets executed only once when a matching signal arrives. Think of it as setting up a temporary listener that automatically cleans up after itself. It’s perfect for capturing a single piece of information from a running strategy without long-term subscriptions.


## Function listenSignalLive

This function lets you listen for real-time trading signals coming from a live trading execution. It’s useful when you need to react to events as they happen, like updating a user interface or triggering other actions.

When you call `listenSignalLive`, you provide a function (named `fn` in the code) that will be called whenever a new trading signal is generated. 

Importantly, this only works with signals produced by `Live.run()`, and the events are handled one after another to ensure order.

The function returns another function, which you can call later to unsubscribe from these live signals, stopping the event processing.


## Function listenSignalBacktestOnce

This function lets you tap into the backtesting process and react to specific events, but only once. You provide a filter to determine which events you're interested in, and a function to execute when a matching event occurs. Once that function runs, the subscription is automatically removed, preventing further executions. It's perfect for one-off actions like logging a specific signal or validating data during a backtest run.

## Function listenSignalBacktest

This function lets you tap into the flow of a backtest and receive updates as it runs. It's designed for situations where you need to react to events happening during the backtest process, like changes in price or signals generated. 

Think of it as setting up a listener that gets called whenever a signal event occurs. Importantly, these events are handled one at a time, so you don't have to worry about juggling multiple updates at once. It only works when a backtest is actively running using `Backtest.run()`. 

You provide a function (`fn`) that will be executed each time a signal is received, giving you access to information about the event. When you’re finished listening, the function returns another function that you can use to unsubscribe and stop receiving these updates.

## Function listenSignal

This function lets you listen for updates from your trading strategy. It’s a way to get notified whenever your strategy changes state – whether it's idle, has opened a position, is actively trading, or has closed a position.

The key thing to know is that these updates are handled one at a time, even if the function you provide to handle them takes some time to complete. This helps prevent things from getting messy by ensuring that updates are processed in the order they come in.

You provide a function (`fn`) that will be called whenever a signal event happens, and this function will receive details about the event. The function you provide will return a function that can be called to unsubscribe from the signal.


## Function listenSchedulePingOnce

This function helps you react to specific events that happen periodically, but only once. You tell it what kind of event you're looking for using a filter, and then provide a function that should run when that event appears. Once your function runs, the listener automatically stops, so you don't have to worry about managing subscriptions. It's handy for situations where you need to respond to a particular event just one time and then move on.

The `filterFn` lets you specify exactly which events you care about. The `fn` is the code that will be executed when a matching event is found.

## Function listenSchedulePing

This function lets you keep an eye on scheduled signals as they wait to become active. Think of it as receiving a little "ping" every minute while a signal is being monitored. You can use these pings to track the signal's progress or implement your own custom checks. It’s all about allowing you to respond to events happening behind the scenes with scheduled signals. The function gives you a way to set up a listener that gets called with information about each ping, and it returns a function you can use to unsubscribe from those pings later.

## Function listenRiskOnce

This function lets you react to specific risk rejection events just once. You provide a filter – a way to identify the exact type of event you're interested in – and a callback function that will run when that event occurs. Once the event is processed by the callback, the listener automatically stops, ensuring it doesn't trigger again. It's perfect for situations where you need to respond to a particular risk condition only one time.

You define what events you care about with the `filterFn`, and what you want to do when one of those events happens with the `fn`. The function handles the subscription and unsubscription automatically for you.

## Function listenRisk

This function lets you monitor when your trading signals are being blocked because of risk constraints. It’s designed to avoid overwhelming you with notifications – you'll only receive alerts when a signal is *rejected* due to a risk issue, not when it's approved.  The function provides a guarantee that these notifications are handled one at a time, in the order they arrive, even if your callback takes some time to complete. To use it, you provide a function that will be called whenever a risk rejection event occurs, and it returns a function to unsubscribe from these events later.


## Function listenPerformance

This function lets you monitor how quickly your trading strategies are executing. It's like setting up a listener that gets notified whenever a performance measurement is taken during a backtest. 

You provide a function that will be called with details about each performance event, such as how long specific operations took. This is really helpful for spotting slowdowns or areas where your strategy could run more efficiently.

The listener ensures events are processed one at a time, even if your callback function takes some time to complete, ensuring reliable timing information.  It provides a way to observe and optimize your strategy’s performance.


## Function listenPartialProfitAvailableOnce

This function lets you set up a one-time alert for when a specific profit level is reached in your backtest. You provide a filter – essentially, a rule that defines what conditions need to be met – and a function to run. Once an event matches your filter, the function runs just once and then the alert automatically disappears, so you don’t have to worry about managing it. Think of it as a "wait for this exact profit condition and then do this *one* thing" kind of tool.


## Function listenPartialProfitAvailable

This function lets you keep track of your trading progress as you reach profit milestones like 10%, 20%, or 30% gain. It sends you notifications when these milestones are hit, and importantly, ensures that these notifications are handled one at a time, even if the process takes a little time. Think of it as getting updates on your progress, delivered in an orderly fashion, so you can react accordingly. You provide a function that will be called with details of each profit milestone reached, and the function returns a way to stop listening for these updates later.

## Function listenPartialLossAvailableOnce

This function lets you set up a listener that reacts to specific partial loss events in your trading backtest. You provide a filter – essentially, a rule to identify the events you're interested in – and a callback function that will be executed *only once* when an event matching your filter occurs. After that one execution, the listener automatically stops, so you don't need to worry about manually unsubscribing. 

It’s a really handy way to respond to a particular loss situation just once during your backtest, then move on.

Here's a breakdown of what you provide:

*   **`filterFn`**: This is your condition; it tells the listener what kind of loss events to look for.
*   **`fn`**: This is the action – the code that runs just once when an event meets your filter condition.

## Function listenPartialLossAvailable

This function lets you keep track of how much your trading strategy has lost, at key milestones like 10%, 20%, and 30% loss levels. It's like setting up alerts to tell you when your strategy hits significant loss points. The important thing is that it handles these alerts one at a time, even if your alert logic takes some time to process. You provide a function that gets called when a loss milestone is reached, and the function returns another function you can use to stop listening for these events.

## Function listenExit

This function lets you monitor for really serious errors that can halt your backtest or live trading processes. Think of it as an emergency alert system for your trading framework. These aren't the little hiccups you can recover from – these are the kinds of errors that force everything to stop.

The function gives you a way to react to these critical failures, and it makes sure that your response is handled carefully, one at a time, to avoid creating further problems. It's designed to catch errors from background processes, ensuring you're notified when something goes dramatically wrong. You provide a function that will be called when a fatal error occurs, and it returns a function to unsubscribe from these notifications.

## Function listenError

This function helps you catch and deal with errors that happen during your trading strategy's execution, especially those that don't stop the entire process. Think of it as a safety net for potential hiccups like failed API requests. When an error occurs, it's sent to the function you provide, allowing you to log it, retry the action, or take other corrective measures without interrupting your strategy’s progress. Importantly, these errors are handled one at a time, in the order they occur, ensuring a predictable and controlled response.

## Function listenDoneWalkerOnce

This function lets you set up a listener that reacts to when background tasks within the backtest-kit framework finish. Think of it as a way to be notified when a specific process is complete.  It’s designed to only run your code once – after the first matching event – and then automatically stops listening, so you don't need to worry about manually unsubscribing. You provide a filter function to specify which completion events you're interested in, and then a callback function that gets executed when a matching event occurs.

## Function listenDoneWalker

This function lets you monitor when background tasks within a Walker complete. It's particularly useful if you need to know when a series of asynchronous operations have finished. 

Think of it as setting up a listener that gets notified when a background process is done. The notifications are handled one at a time, even if the function you provide takes some time to execute, preventing any potential issues with running things simultaneously. You simply give it a function to run when a background task finishes, and it returns a function you can use to unsubscribe from those notifications later.

## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running within your backtest. You provide a filter – a way to decide which completed tasks you’re interested in – and a callback function that will be executed only once when a matching task finishes.  Think of it as setting up a single, temporary listener that gets automatically removed after it runs. It’s useful for actions you only need to perform once when a specific background task completes.

## Function listenDoneLive

This function lets you keep track of when background tasks using Live.background() finish running. It’s like setting up a listener that gets notified when a task is done.

The listener you create receives events in the order they happen, ensuring that even if your callback function takes some time to process, everything remains organized. 

To prevent unexpected issues, the system uses a queuing mechanism to make sure your callback runs one at a time. You provide a function (`fn`) that will be called whenever a background task completes, and this function returns another function that you can use to unsubscribe from these completion events later.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but in a special way: it only runs your code *once* and then automatically stops listening. You provide a filter – a check that determines which backtest completions you care about – and a function that will be executed when a matching backtest finishes. Think of it as setting up a temporary listener that cleans up after itself. This is handy for things like triggering a single notification or processing a specific result without needing to manage ongoing subscriptions.

## Function listenDoneBacktest

This function lets you be notified when a background backtest finishes running. It's really useful if you want to do something after a backtest completes, like updating a progress bar or displaying results.

The function takes a callback – a piece of code you want to run when the backtest is done. This callback receives information about the completed backtest.

Importantly, the callbacks are handled one at a time, even if your callback code involves some asynchronous operations, ensuring things are processed in the order they come. This helps prevent unexpected issues from multiple callbacks trying to run simultaneously. You can unsubscribe from these events when you no longer need them by using the value returned from this function.

## Function listenBreakevenAvailableOnce

This function lets you react to a specific breakeven protection event just once and then automatically stop listening. You provide a filter to define exactly which events you're interested in, and a function to run when that event occurs. Once the event matches your filter, the function executes your callback and quietly unsubscribes, so you don't need to manually manage the subscription. It’s a clean way to handle situations where you only need to respond to a breakeven condition a single time.


## Function listenBreakevenAvailable

This function allows you to be notified whenever a trade's stop-loss automatically moves to breakeven. This happens when the trade has made enough profit to cover the costs associated with it, essentially protecting your initial investment. You provide a function that will be called whenever this breakeven event occurs, and the system makes sure these notifications are handled one at a time, even if your provided function takes some time to complete. This helps prevent any issues that could arise from multiple callbacks happening simultaneously.

## Function listenBacktestProgress

This function lets you keep an eye on how a backtest is progressing. It provides updates during the background calculations of a backtest, so you can monitor its status. The updates are delivered one at a time, even if your code takes some time to process each update, ensuring a reliable flow of information. Think of it as subscribing to a stream of progress reports from your backtest. You provide a function that will be called whenever a progress update is available.

## Function listenActivePingOnce

This function lets you set up a temporary listener for active ping events. It's designed to react to a specific condition—you provide a filter that determines which events you’re interested in. Once an event matches your filter, the provided callback function runs exactly once, and then the listener automatically stops, so you don’t have to worry about cleaning it up yourself. Think of it as a way to wait for something specific to happen and then take action, without a lingering subscription.


## Function listenActivePing

This function lets you keep an eye on what's happening with your active trading signals. It sends you updates every minute about the signals that are currently pending, allowing you to build logic that reacts to these changes. Think of it as a way to monitor the lifecycle of your signals and adjust your strategies accordingly.  The updates are delivered in the order they're received, and the system ensures that your callback function is processed one at a time, even if it takes some time to complete. To use it, you provide a function that will be called whenever a new active ping event occurs, receiving details about that event.

## Function listWalkerSchema

This function lets you see all the different trading strategies (walkers) that are currently set up and ready to use within the backtest-kit framework. Think of it as a way to peek under the hood and understand what options you have available. It gives you a list of details about each strategy, making it helpful for things like troubleshooting or creating tools that automatically display available strategies. Basically, it's a handy tool to discover the range of trading approaches incorporated into your system.


## Function listStrategySchema

This function lets you see all the trading strategies currently set up in your backtest-kit environment. It essentially provides a list of all the strategy blueprints you've added. Think of it as a quick way to check what strategies are available for testing or to display them in an application. It's great for making sure everything is configured correctly or for building tools that automatically manage your trading strategies.

## Function listSizingSchema

This function lets you see all the sizing strategies currently set up within your backtest environment. Think of it as a way to peek under the hood and understand how your order sizes are being determined. It provides a list of configurations, giving you valuable information for troubleshooting, creating documentation, or building custom user interfaces that adapt to your sizing rules. Essentially, it helps you examine and manage your sizing logic.

## Function listRiskSchema

This function lets you see all the risk schemas that are currently set up within your backtest. Think of it as a way to peek under the hood and get a list of all the risk configurations you've defined. It’s handy if you’re trying to figure out what's going on, need to generate documentation, or want to create a user interface that displays these risk settings. The function returns a promise that resolves to an array containing details about each registered risk schema.

## Function listFrameSchema

This function allows you to see a complete picture of all the different types of data structures, or "frames," that your backtesting system understands. Think of it as a way to inventory all the data formats your trading strategies will be working with.  It returns a list of these frame schemas, which is helpful when you're trying to understand your system's data flow, build tools that interact with it, or troubleshoot unexpected behavior. You can use it to see exactly what kinds of data your strategies will process.

## Function listExchangeSchema

This function lets you see all the different exchanges your backtest-kit setup knows about. Think of it as a way to check which data sources are connected and ready to be used for backtesting. It returns a list, and each item in that list describes an exchange – essentially, it's a snapshot of how each exchange is configured. You might use this to verify your setup, create a helpful menu in your application, or simply understand what exchanges are available for your trading strategies.


## Function hasTradeContext

This function helps you determine if your backtest environment is ready for trading actions. It essentially checks if both the execution and method contexts are active. Think of it as a gatekeeper – it ensures that you're in a state where you can safely use functions like retrieving historical candle data or formatting prices, which are essential for any trading logic. If this function returns `true`, you’re good to go; otherwise, you might need to wait for the environment to fully initialize.

## Function getWalkerSchema

This function helps you find out what a particular trading strategy, or "walker," is expecting in terms of data and behavior. Think of it as looking up the blueprint for a specific strategy. You give it the name of the strategy, and it provides you with a detailed description of its requirements, letting you understand exactly what kind of information it needs to work correctly. The name you provide must be a recognized identifier for a registered trading strategy within the system.

## Function getTotalPercentClosed

This function helps you understand how much of a trading position you still have open. It tells you the percentage of the original position that hasn't been closed, with 100 meaning the entire position is still active and 0 meaning it’s completely closed. It’s clever enough to handle situations where you’ve built up a position through multiple smaller buys (Dollar-Cost Averaging) and then closed it partially. It figures out whether it's running in a backtesting environment or a live trading situation without you needing to tell it. You simply provide the symbol of the trading pair you’re interested in to get the percentage.

## Function getTotalCostClosed

This function helps you figure out the total cost of your currently open position for a specific trading pair. It calculates the cost basis in dollars, and importantly, it takes into account any dollar-cost averaging (DCA) that occurred when you partially closed the position.  You don't need to worry about whether you're in backtest mode or live trading; the function automatically adjusts based on the current environment. To use it, simply provide the symbol of the trading pair you're interested in.


## Function getTimestamp

This function, `getTimestamp`, gives you the current time. It’s handy for tracking when events happen in your trading strategies. During backtesting, it tells you the timestamp for the specific historical period being analyzed. When running live, it provides the actual, real-time timestamp.

## Function getSymbol

This function lets you find out which asset you're currently trading. It's a simple way to check the symbol, like "AAPL" or "BTCUSDT", that your backtest or trading strategy is focused on. The function returns a promise that resolves to the symbol as a string, so you can use it to dynamically adjust your code based on the asset being traded.

## Function getStrategySchema

This function helps you understand the structure of a trading strategy you're using. It takes the strategy's name as input and gives you back a detailed blueprint outlining what inputs it expects, what outputs it produces, and how it's generally organized. Think of it as a way to peek inside a strategy and see its inner workings, without actually running it. It’s useful for validating your strategy configurations or building tools that interact with strategies programmatically. The name you provide must exactly match the registered strategy's identifier.

## Function getSizingSchema

This function helps you find the specific rules and calculations used for determining how much to trade, based on a name you provide. Think of it as looking up a pre-defined trading strategy. You give it a name, and it returns the details of that sizing strategy. This lets you access and potentially work with the sizing logic without needing to recreate it yourself. The name you give must be one that's already registered within the backtest-kit system.


## Function getScheduledSignal

This function helps you find out what scheduled signal your trading strategy is currently using. It takes the trading pair’s symbol as input, like "BTCUSDT". The function will then look for a scheduled signal associated with that symbol. If a signal is found, it returns detailed information about it. If no signal is currently scheduled for that symbol, it will tell you by returning null. Importantly, it figures out whether it's running a backtest or a live trade automatically.

## Function getRiskSchema

This function helps you access pre-defined structures for managing risk within your trading strategies. Think of it as a way to grab a template that tells you what information you need to track for a specific type of risk. You provide the name of the risk you're interested in, and it returns the schema associated with that name. This schema outlines the data points you’ll be working with when assessing and controlling risk.

## Function getRawCandles

The `getRawCandles` function lets you retrieve historical candle data for a specific trading pair. You can easily fetch candles by specifying the symbol and the time interval, like "BTCUSDT" and "1h".

It’s designed to be flexible, letting you control how many candles you get and the date range they cover. You can provide a start and end date, just an end date with a limit, or just a limit to fetch candles from the past.

Importantly, the function ensures fairness in backtesting by avoiding look-ahead bias – it respects the time at which your strategy is being evaluated. 

Here's a quick rundown of what you can provide:

*   **Symbol:** The trading pair (e.g., "BTCUSDT").
*   **Interval:** The timeframe for the candles (e.g., "1m", "1h", "4h").
*   **Limit:**  How many candles you want to retrieve.
*   **Start Date (sDate):** The beginning of the date range (in milliseconds).
*   **End Date (eDate):** The end of the date range (in milliseconds).



The function handles calculating a sensible limit or start date based on the parameters you provide, and always validates that the end date is not in the future.

## Function getPositionPnlPercent

This function helps you understand how profitable your current trading position is. It calculates the unrealized percentage profit or loss based on the difference between your entry price and the current market price. 

It considers factors like partial position closures, dollar-cost averaging (DCA), potential slippage, and trading fees to give you a more accurate picture.

If you don't currently have a pending signal open, the function will return null.  It figures out whether it's running in a backtest or live trading environment and automatically retrieves the current market price for you. You simply need to provide the trading pair symbol you're interested in.

## Function getPositionPnlCost

This function helps you understand how much money you've potentially gained or lost on a trade that's still open. It figures out the unrealized profit and loss, expressed in dollars, for a specific trading pair. The calculation considers factors like the percentage change in price, the initial investment cost, and even accounts for partial trades, dollar-cost averaging, slippage, and fees to give you a realistic view. If there's no active trade in progress, it will return null. The function cleverly adapts to whether you're running a backtest or a live trade and automatically retrieves the current market price for accurate calculations. You just need to provide the symbol of the trading pair you're interested in.

## Function getPositionPartials

This function lets you peek at the history of partial profit and loss closings for a specific trading pair. It provides a list of events detailing how much of the position was closed, at what price, and what the cost basis was at the time. If there's no active signal, it will tell you by returning null. And if you haven't executed any partial closes yet, you'll get an empty list. You’ll find useful information like the execution price and the cost basis at the time of each partial close, helping you understand how your trading strategy is performing. The function requires you to specify the trading pair symbol to retrieve this information.

## Function getPositionPartialOverlap

This function helps you avoid accidentally closing partial positions twice at roughly the same price. It checks if the current market price falls within a small range around any previously executed partial close prices for a given trading pair. 

Think of it like ensuring you're not triggering the same closing action repeatedly when the price fluctuates slightly. 

The function takes the trading symbol and the current price as input, and optionally allows you to customize the acceptable range around the partial close price. It returns true if the current price falls within this acceptable range, and false otherwise, indicating that a partial close is likely safe to proceed with. If no partials have been executed, it also returns false.

## Function getPositionLevels

This function helps you see the prices at which you've entered a trade using dollar-cost averaging (DCA). It gives you a list of prices, starting with the original price you bought at, and including any additional prices you added through subsequent buys. If there's no active trade setup, it will tell you by returning null. If you only made one purchase, it will just return the original price. You need to provide the symbol of the trading pair (like BTCUSDT) to get this information.

## Function getPositionInvestedCount

This function, `getPositionInvestedCount`, lets you check how many times a particular trade has been adjusted using dollar-cost averaging (DCA). It tells you how many buy orders have been placed as part of a single trading signal.

A return value of 1 indicates the initial trade, while higher numbers represent subsequent DCA entries triggered by `commitAverageBuy()`. If no trading signal is currently active, the function will return null.

It automatically figures out whether it's running a backtest or a live trade for you, so you don’t need to worry about setting that manually.  You simply provide the symbol of the trading pair, like "BTCUSDT", to get the count.

## Function getPositionInvestedCost

This function helps you figure out how much money you've invested in a particular trading pair, like BTC/USD. It calculates the total cost based on all the times you've bought into that position. 

Essentially, it adds up the costs associated with each purchase you've made. 

If you haven't started a trade or there’s no pending signal, it will return null to indicate that. 

It automatically adjusts to whether you're running a backtest or live trading.

You just need to provide the trading pair’s symbol to get the information.

## Function getPositionEntryOverlap

This function helps you avoid accidentally creating multiple DCA entries for the same price level. It checks if the current market price falls within a small range around your existing DCA entry prices, essentially creating a buffer zone. 

You provide the trading symbol and the current price, and optionally, you can customize the size of this buffer zone.  If the current price is within that buffer, the function returns true, signaling that you should probably skip creating another DCA entry.  If no DCA entries exist, it returns false, meaning you’re safe to proceed. This is a useful tool for keeping your DCA strategy clean and preventing unintended orders.

## Function getPositionAveragePrice

This function helps you understand the average price at which you entered a position for a particular trading pair. It calculates a weighted average, considering any previous buys (DCA) and partial closes you might have made. Think of it as showing you your effective entry price, taking into account all the buying and selling activity.

If you haven't entered any trades for that symbol yet, the function will tell you that by returning null. The function figures out whether it's being used in a backtesting environment or a live trading scenario without you having to specify. 

You just need to provide the symbol of the trading pair you're interested in, like 'BTCUSDT'.

## Function getPendingSignal

This function helps you check if your trading strategy currently has a pending order waiting to be filled. It takes the symbol of the trading pair (like "BTCUSDT") as input and returns information about that pending signal, if one exists. If there isn't a pending signal, it will tell you by returning null. It cleverly figures out whether it's running a backtest or a live trade without you needing to specify.

## Function getOrderBook

This function lets you retrieve the order book for a specific trading pair, like BTCUSDT. It pulls data directly from the exchange you're connected to. You can specify how many levels of the order book you want to see; if you don't specify, it will default to a reasonable maximum depth. The timing of this request is handled automatically based on the current environment, whether you're backtesting or trading live.

## Function getNextCandles

This function helps you retrieve future candles for a specific trading pair and time interval. It’s like asking the exchange for the next set of candles, but ensuring they are after the current time the backtest is using. You provide the symbol like "BTCUSDT", the interval such as "1m" or "1h", and the number of candles you want to get. The function then promises to return an array of candle data.

## Function getMode

This function tells you whether the backtest-kit framework is currently running in backtest mode or live trading mode. It returns a promise that resolves to either "backtest" or "live", allowing your code to adjust its behavior based on the environment it's operating in. Think of it as a simple way to know if you’re testing historical data or actively making trades.

## Function getFrameSchema

This function lets you look up the structure and properties of a specific trading frame that's been set up in your backtest. Think of it as checking what kind of data a particular frame is expected to handle. You give it the name of the frame you're interested in, and it returns a detailed description of that frame's schema. This is helpful for understanding how to work with different frames and ensuring your code interacts with them correctly. It’s a way to peek under the hood and see exactly what’s going on within a frame.


## Function getExchangeSchema

This function lets you grab the details of a specific exchange that backtest-kit knows about. Think of it as looking up the blueprint for how a particular exchange works – things like how orders are placed, what data is available, and so on. You simply provide the name of the exchange you're interested in, and it returns a structured description of that exchange. This is helpful for understanding the expected data format and limitations of each exchange within your backtesting environment.

## Function getDefaultConfig

This function gives you a starting point for configuring the backtest-kit. It provides a set of default values for various settings that control how the framework behaves, like how often it checks prices, limits on signal generation, and options for managing orders. Think of it as a template – you can look at these values to understand what you can adjust and what the sensible defaults are before you customize things for your specific backtesting needs. You'll find settings here that manage things like candle fetching, signal handling, and notification limits.

## Function getDefaultColumns

This function gives you the standard column setup used for creating reports. Think of it as a template showing you all the possible columns and how they're pre-configured when generating backtest reports, heatmap visualizations, and other output. It’s a handy way to understand the available options and their default settings before you customize your own column configurations. You can look at the returned object to see what’s possible.

## Function getDate

This function, `getDate`, simply tells you what the current date is within your trading environment. If you're running a backtest, it will give you the date associated with the specific historical timeframe you're examining. When you're trading live, it will provide the actual, current date. It's a handy way to keep track of time during your simulations or real-time trading.

## Function getContext

This function provides a way to access details about the current operation being performed within the backtest-kit framework. Think of it as a peek behind the curtain – it gives you information like where the code is running and what's happening at that moment. The information it returns is wrapped up in a special object called `IMethodContext`, which holds various pieces of data about the execution environment. You can use this to understand the context surrounding a particular piece of code.


## Function getConfig

This function lets you peek at the framework's global settings. It gives you a snapshot of values controlling things like candle fetching, slippage percentages, maximum signal lifetimes, and limits on notifications. Importantly, this isn’t the actual configuration file; it's a copy, so you can look at the settings without accidentally changing them. Think of it as a read-only view of how the backtest is currently set up.

## Function getColumns

This function lets you peek at the columns that are being used to build your backtest reports. Think of it as getting a snapshot of how your data will be displayed. It provides configurations for various report sections like closed trades, heatmaps, live data, partial fills, breakeven points, performance metrics, risk events, scheduling, strategy events, synchronization, walker profit/loss, and walker strategy results. Importantly, the returned configuration is a copy, so you can look at it without worrying about accidentally changing the actual settings used by backtest-kit.

## Function getCandles

This function lets you retrieve historical price data, like open, high, low, and close prices, for a specific trading pair. Think of it as pulling up a chart for a particular cryptocurrency or stock. You tell it which symbol you're interested in (like "BTCUSDT" for Bitcoin against USDT), how frequently you want the data (every minute, every hour, etc.), and how many data points you need. The function then goes to the connected exchange and gets that information for you, working backward from the current time.

## Function getBreakeven

This function helps you determine if a trade has reached a breakeven point, meaning it's made enough profit to cover the initial costs. It checks if the current price of an asset has moved sufficiently in a profitable direction to offset transaction fees and potential slippage. You simply provide the asset's symbol and the current market price, and the function returns true if the breakeven has been achieved. It figures out whether you’re running a backtest or a live trading scenario automatically.


## Function getBacktestTimeframe

This function helps you find out the historical dates available for backtesting a specific trading pair, like BTCUSDT. It returns an array of dates, representing the timeframe that the backtest kit has data for. You provide the symbol of the trading pair you’re interested in, and it gives you back a list of dates to work with. This is useful for understanding how far back you can run simulations for a particular asset.

## Function getAveragePrice

This function helps you figure out the average price a symbol has traded at recently, specifically using a method called Volume Weighted Average Price, or VWAP. It looks at the last five minutes of trading data – the high, low, and closing prices – to determine this average. 

If there's no trading volume available, it falls back to a simpler calculation, just averaging the closing prices instead. You simply provide the trading pair symbol, like "BTCUSDT", and it returns the calculated average price.

## Function getAggregatedTrades

This function helps you retrieve a list of combined trades for a specific trading pair, like BTCUSDT. It pulls this data directly from the exchange the backtest kit is connected to.

You can request all trades within a certain timeframe—roughly the last hour—or specify a `limit` to get just a specific number of recent trades. Think of it as a way to get a snapshot of trading activity for a given symbol. The function automatically handles getting the necessary number of trades, even if it means going back further in time to reach your desired limit.


## Function getActionSchema

This function helps you find the details of a specific action within your backtest kit setup. Think of it like looking up the blueprint for a particular trade. You give it the name of the action you're interested in, and it returns a structured description – what data it needs, what it does, and other important information. This is useful when you want to understand or programmatically work with the different actions your trading strategy uses.

## Function formatQuantity

This function helps you make sure the amounts you're using for trading look correct for the specific exchange you're connected to. It takes a trading pair, like "BTCUSDT", and the raw quantity you want to trade, and then formats it to follow the exchange's rules for decimal places. This ensures your orders are valid and avoids issues caused by incorrect formatting. Basically, it's a simple way to keep your trade amounts looking professional and compliant.

## Function formatPrice

This function helps you display prices in a way that follows the specific rules of the trading exchange you're using. It takes a symbol like "BTCUSDT" and a raw price number as input. Then, it automatically figures out how many decimal places to show, based on the exchange's guidelines, and returns the price as a formatted string. This ensures your price displays look consistent and accurate.

## Function dumpMessages

This function helps you save all the details of a backtest run into organized markdown files, making it easier to review and understand what happened. It creates a folder named after the unique identifier of your backtest result within a designated output directory, like `./dump/strategy` by default. Inside that folder, you'll find a summary of the system prompt and result data, plus individual files for each user message and the corresponding LLM output.  If a folder with the result ID already exists, it skips the process to avoid accidental data loss. The function also checks if user messages are very long (over 30KB) and will warn you if they are, so you can investigate potential issues.


## Function commitTrailingTakeCost

This function lets you change the trailing take-profit to a specific price. It simplifies the process by automatically calculating the percentage shift needed based on the original take-profit distance. The framework handles figuring out if you're running a backtest or a live trade, and it also gets the current market price for you. Essentially, you tell it the symbol and the target price, and it adjusts the trailing take-profit accordingly. 

It's a handy shortcut for setting an absolute take-profit value while still leveraging the trailing take-profit functionality.


## Function commitTrailingTake

This function lets you fine-tune your take-profit levels for pending trade signals, specifically using a trailing stop approach. It’s designed to make sure your take-profit consistently moves based on the original distance you set, preventing small errors from building up over time. Think of it as an easy way to adjust your take-profit, but be aware that it only makes changes that make your stop more conservative – it won't aggressively move your take-profit further out.

When dealing with long positions, it always brings your take-profit closer to your entry price. Conversely, for short positions, it moves the take-profit further away from your entry price. 

The function automatically adapts to whether you're in backtesting mode or live trading, simplifying the process. You tell it the symbol you're trading, the percentage adjustment you want to make to the original take-profit distance, and the current market price.


## Function commitTrailingStopCost

This function lets you change the trailing stop-loss price to a specific value you choose. It simplifies the process by automatically calculating how much the percentage shift needs to be adjusted based on the original stop-loss distance. It handles whether you're running a backtest or a live trade, and it gets the current price to help with the calculation, so you don’t have to worry about those details. You just provide the symbol and the new stop-loss price you want.

## Function commitTrailingStop

This function lets you fine-tune the trailing stop-loss for your trading signals. Think of it as adjusting how far your stop-loss is from your entry price to protect profits. 

It's really important to remember that this adjustment is always based on the *original* stop-loss distance you set initially, not any adjustments that have already been made. This helps avoid errors that can creep in if you adjust the stop-loss multiple times.

The function intelligently handles adjustments – if you try to move the stop-loss in a direction that isn’t beneficial (closer to your entry for a long position, for example), it won't make the change. It will always prioritize tightening the stop-loss (protecting profit) when possible.

You specify the symbol you’re trading, the percentage by which you want to adjust the original stop-loss distance (a negative value moves it closer to your entry, a positive value moves it further away), and the current market price to assess whether the stop-loss has been triggered. The function then decides if the adjustment is valid and makes the change, returning true if successful.


## Function commitPartialProfitCost

This function lets you automatically close a portion of your position when you've made a certain profit, measured in dollars. It's designed to be a simple way to lock in gains as your trade moves towards its target profit level. 

Essentially, it takes a dollar amount you want to close out and figures out what percentage of your position that represents. The system will make sure the price is moving in a favorable direction (towards your take profit) before executing the partial close.

It handles the details of getting the current price and knowing whether it’s running in a backtesting environment or a live trading environment, so you don't have to worry about those settings. You just need to specify the symbol you're trading and the dollar amount you want to commit.


## Function commitPartialProfit

This function lets you automatically close a portion of your open trade when it’s in profit, gradually moving you closer to your take profit target. You tell it which trading pair you're working with and what percentage of the position you want to close. It smartly figures out whether it's running in a backtesting environment or a live trading situation, so you don't have to worry about that. Essentially, it helps you secure profits as your trade moves in the right direction. 

For example, if you have a long position and the price is rising, this function can close a set percentage of your trade, locking in some gains.


## Function commitPartialLossCost

This function helps you automatically close part of your position to limit losses, specifically when the price is moving in a direction that would trigger your stop-loss. It simplifies the process by taking a dollar amount you want to close, and it figures out the percentage of your position that represents.  You just tell it the symbol you're trading and the dollar amount you want to close, and it handles the rest, including getting the current price and adjusting for whether you're in backtest or live trading mode. Think of it as a shortcut for managing your risk and protecting your capital.


## Function commitPartialLoss

This function lets you partially close an open position when the price is moving in a direction that would trigger your stop-loss. It's designed to automatically handle whether you're running a backtest or a live trade. You provide the symbol of the trading pair and the percentage of your position you want to close, like closing 25% of your holdings. Think of it as a way to reduce your risk when the market is moving against you, gradually exiting your position.

## Function commitClosePending

This function helps you finalize a pending order, essentially closing an open position without interrupting your trading strategy. Think of it as a way to manually acknowledge and complete a closing signal that’s already been generated. It doesn't interfere with any planned future signals or the overall strategy’s function; it simply ensures the closing action is registered. You can also optionally include a unique identifier to help track when a close was specifically requested. This function automatically figures out whether it's being used in a backtesting environment or a live trading scenario.

## Function commitCancelScheduled

This function lets you cancel a previously scheduled trading signal without interrupting your strategy's normal operation. Think of it as removing a signal that was waiting to be triggered by a specific price – it won't impact any signals that are already active or prevent your strategy from creating new ones. You can optionally provide a cancellation ID to keep track of your own cancellation requests. It works seamlessly whether you're running a backtest or a live trading session, automatically adapting to the environment it's in.

## Function commitBreakeven

This function helps automate risk management during trading. It shifts your stop-loss order to the entry price – essentially making your position risk-free – once the price moves favorably enough to cover any transaction fees and a small buffer. Think of it as automatically protecting your profits. The function handles the specifics, calculating the required price movement based on preset percentages for slippage and fees and automatically retrieves the current price. You just need to specify the trading pair symbol you want to apply this to.

## Function commitAverageBuy

This function lets you add a new "average buy" order to your trading strategy. Think of it as contributing to a gradual accumulation of a position, often used in Dollar Cost Averaging (DCA). It automatically figures out the current market price and adds it to the existing record of buys for the specific trading pair. The function also keeps track of the average price you've paid for the asset and broadcasts a signal that a new buy has been committed. You can optionally specify a cost for the buy order.

## Function commitActivateScheduled

This function lets you manually trigger a scheduled signal before the price actually hits the target you set. It's useful when you want to act on a signal a little bit sooner than planned.

Essentially, you're giving the strategy a heads-up that you want the signal to be activated. The strategy will then apply the signal on the following price update.

You provide the symbol of the trading pair you're working with. You can also include an optional activation ID to help you keep track of when you manually activated a signal. The function automatically figures out whether it’s running in backtesting or live trading mode.

## Function checkCandles

The `checkCandles` function is a utility tool that makes sure your historical price data (candles) are properly aligned with the expected time intervals. It's like a quality control check for your data, ensuring everything is in sync before you start backtesting or live trading. This function dives deep, reading the raw data directly from your persistent storage – it bypasses any intermediary layers. If you suspect your candle data might be out of alignment, running `checkCandles` can help identify and potentially fix the issue. You'll pass in a set of parameters to configure how the check is performed.

## Function addWalkerSchema

This function lets you register a "walker" which is essentially a tool for comparing different trading strategies against each other. Think of it as setting up a competition between your strategies using the same historical data.  You provide a configuration object – the `walkerSchema` – that tells the system how to run these comparisons, specifying how the strategies will be evaluated and measured. This is a key step in conducting more sophisticated backtesting and understanding which strategies perform best relative to one another.

## Function addStrategySchema

This function lets you tell backtest-kit about a new trading strategy you've created. Think of it as registering your strategy so the framework knows how to handle it. When you register a strategy, the system will automatically check that the signals it produces are valid – things like ensuring prices and stop-loss levels make sense. It also helps prevent issues like signal overload and makes sure your strategy can safely persist its data even if there's an unexpected interruption during live trading. You provide a configuration object, which defines the details of your trading strategy.

## Function addSizingSchema

This function lets you tell backtest-kit how you want to determine the size of your trades. It’s essentially registering a plan for how much capital to allocate to each trade based on certain rules and parameters. You provide a sizing schema, which outlines things like the method you'll use (like fixed percentage, Kelly criterion, or ATR-based sizing), the specific risk levels you're comfortable with, and any limits you want to place on the size of your positions. This helps the framework accurately simulate your trading strategy's behavior.

## Function addRiskSchema

This function lets you set up how your trading strategies manage risk. Think of it as defining the rules of engagement to prevent overexposure.

You can specify limits on how many trades can be active at once, and even build in your own checks to ensure your portfolio stays balanced and safe, maybe looking at correlations between assets.

The system can also notify you when a trade is blocked due to these risk rules, giving you a chance to adjust your approach.

Crucially, this risk management applies to all your strategies working together, so you get a holistic view and prevent unintended consequences.

## Function addFrameSchema

This function lets you tell backtest-kit how to generate the timeframes it will use for your backtesting. Think of it as defining the overall scope and frequency of your historical data. You provide a configuration object that specifies things like the start and end dates of your backtest, the interval (e.g., daily, hourly) for the timeframes, and a function to handle events related to timeframe creation. Essentially, it sets up the backbone for the historical data your trading strategies will be evaluated against.


## Function addExchangeSchema

This function lets you tell backtest-kit about a new exchange you want to use for your trading strategies. Think of it as registering a data source – you're essentially saying, "Hey, I'm using this exchange, and here's how it works."  The exchange needs to provide historical price data (candles), handle how prices and quantities are displayed, and can even calculate VWAP (a volume-weighted average price) based on recent trades. You give it a configuration object that describes how to access and interpret data from that specific exchange.

## Function addActionSchema

This function lets you tell backtest-kit about special tasks you want it to perform during a backtest. Think of these tasks as "actions" that happen when certain events occur, like a trade signal being generated or a profit target being hit. You can use these actions to keep track of what’s happening, send notifications, update external systems, or even trigger completely custom logic. 

Essentially, you're defining a blueprint for these actions, specifying how they should behave and what data they should receive. Each time a backtest runs, backtest-kit creates a new action based on this blueprint to handle the events of that specific strategy and timeframe. This allows for flexible integration with things like state management libraries, notification services, and data analytics tools.
