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

This function helps ensure your trading setup is correct before you run any tests or optimizations. It checks that all the different components you're using – like exchanges, trading strategies, and risk management systems – are properly registered and ready to go.

You can tell it to validate specific parts of your setup by providing a list of the components you want to check, or you can let it validate everything at once for a thorough check. The results of these checks are saved for later use, making the process faster each time. Think of it as a final quality control step before your backtesting begins.

## Function stop

This function lets you halt a specific trading strategy for a particular symbol. Think of it as pausing a strategy without completely resetting it. It prevents the strategy from creating any new trading signals, but any existing signals will finish their process naturally. The system will stop the strategy at a suitable point, either when it’s idle or after a current signal has closed, adapting to whether you're running a backtest or a live trade. You simply provide the symbol you're trading and the name of the strategy you wish to stop.

## Function setLogger

You can now control how backtest-kit reports its activities by providing your own logging mechanism. This lets you send log messages to a file, a database, or any other destination you prefer. The framework will automatically include useful information like the strategy name, exchange, and trading symbol with each log message, making it easier to understand what's happening during your backtests. To do this, simply provide an object that implements the `ILogger` interface to the `setLogger` function.

## Function setConfig

This function lets you adjust the overall settings for the backtest-kit framework. Think of it as tweaking the environment in which your trading strategies will run. You can pass in only the settings you want to change; it doesn't require you to redefine the entire configuration. There's also a special flag, `_unsafe`, which you would only use in testing situations when you need to bypass certain safety checks – use this carefully!

## Function setColumns

This function lets you customize the columns that appear in your backtest reports, like those generated for markdown. You can adjust things like column names, formatting, and how data is displayed. It's useful if you want to create reports tailored to specific needs or analyses.  The function validates your changes to make sure they are structurally correct, but there's an "unsafe" option you can use if you absolutely need to bypass these validations, typically within a testing environment.

## Function listWalkers

This function gives you a peek at all the different trading strategies (walkers) that are currently set up within the backtest-kit framework. It's like getting a directory of all your available strategies, presented as a list of structured data. This is super handy if you're trying to understand what's going on behind the scenes, create tools to manage your strategies, or simply want to see what options are available. The result is a promise that resolves to an array detailing each walker’s configuration.


## Function listStrategies

This function lets you see all the trading strategies currently set up within your backtest-kit environment. It's like a directory listing for your strategies, providing you with details like their names and configurations.  You can use this to quickly check what strategies are available, help in building user interfaces that display these strategies, or simply use it for troubleshooting. The function returns a list of strategy schemas, which contain information about each strategy.

## Function listSizings

This function lets you see all the different sizing strategies that are currently set up within your backtest environment. It’s like getting a complete inventory of how your positions are being sized.  You can use this to check if your sizing rules are configured correctly, to understand the available options, or to build tools that adapt to these different sizing methods. The function returns a promise that resolves to an array of sizing schema objects, each describing a sizing configuration.

## Function listRisks

This function lets you see all the risk assessments your backtest is using. It gathers all the risk configurations you've set up and returns them in a neat list. Think of it as a way to inspect what your backtest considers risky, helpful for troubleshooting or creating tools to understand your risk profiles. It's a straightforward way to get a complete view of your risk setup.


## Function listOptimizers

This function lets you see a complete list of all the optimization strategies currently set up within your backtest environment. Think of it as a way to check what options are available for fine-tuning your trading algorithms. It’s handy if you're trying to understand how your system is configured, creating tools to manage optimizers, or just ensuring everything is working as expected. The result is a list describing each registered optimizer, providing information about their configuration.


## Function listFrames

This function lets you see all the different data structures, or "frames," that your backtest-kit system is using. Think of it as getting a catalog of all the ways your data is organized. It returns a list describing each frame, allowing you to inspect them, understand your system's design, or even build tools that adapt to the frames you’re using. Essentially, it's a way to explore the internal organization of your backtesting environment.

## Function listExchanges

This function helps you discover all the different trading exchanges your backtest-kit setup knows about. It essentially gives you a list of available exchanges, each described by its schema. Think of it as a way to see what trading platforms you're able to simulate and analyze. You can use this information to check your configuration, generate helpful documentation, or create user interfaces that dynamically adapt to the exchanges you support.

## Function listenWalkerProgress

This function lets you keep track of how a backtest is progressing. It allows you to register a callback function that will be notified after each strategy finishes running during a backtest. The updates are delivered one at a time, even if your callback function involves asynchronous operations, ensuring things don’t get mixed up. Think of it as a way to get notified as each part of your backtest completes, letting you monitor its overall progress. To stop listening for these progress updates, the function returns another function that you can call to unsubscribe.

## Function listenWalkerOnce

This function lets you temporarily listen for specific updates as a backtest progresses. You provide a filter – a way to identify the exact updates you're interested in – and a function that will be executed once an update matches your filter. After that single execution, the listener automatically stops, so you don't have to worry about cleaning up subscriptions. It's a handy way to react to a particular condition occurring during a backtest, like waiting for a certain trade to be completed. 

Essentially, it’s a “wait for this, then do something” mechanism.


## Function listenWalkerComplete

This function lets you be notified when a backtest run finishes, providing a way to react to the overall completion of your strategy testing. It ensures that any actions you take in response to the completion happen one at a time, even if your response involves asynchronous operations. Think of it as a reliable signal that all your backtests are done, guaranteeing a controlled and orderly response. You simply provide a function that will be called when the backtest is complete, and this function will handle the event.

## Function listenWalker

This function lets you keep an eye on how a backtest is progressing. It’s like setting up a listener that gets notified whenever a strategy finishes running during a backtest. 

The key is that the updates you receive are handled one at a time, even if your notification code takes some time to process. This ensures things don't get messy with multiple processes happening simultaneously. 

You give it a function to call whenever a strategy completes, and it returns another function you can use to unsubscribe from these updates later.


## Function listenValidation

This function lets you keep an eye on potential problems during risk validation. Whenever a validation check fails and throws an error, this function will notify you.  It's a great way to catch and debug issues in your validation logic. Importantly, the errors are handled one at a time, ensuring a smooth and predictable process even if your error handling code itself takes some time to run. To use it, you provide a function that will be called whenever a validation error occurs.

## Function listenSignalOnce

This function lets you set up a listener that reacts to specific signals, but only once. You tell it what kind of signal you're looking for using a filter function – think of it as a rule. Once a signal matches that rule, the provided callback function runs, and then the listener automatically stops, so you won't get any more notifications. This is perfect when you need to react to a specific event just one time. 

It takes two parts: a filter that checks what signals you're interested in, and a function that will handle the signal when it’s found. The function returns a way to cancel the listener if needed.


## Function listenSignalLiveOnce

This function lets you temporarily tap into live trading signals, but only to receive one specific event. It's perfect for quickly grabbing a piece of data from a running strategy without being tied to ongoing updates. You provide a filter that determines which signals you’re interested in, and a function to handle that single, filtered signal. Once the signal matches your filter, the provided function runs, and the subscription automatically ends, ensuring you don't get any more unwanted notifications.


## Function listenSignalLive

This function lets you tap into a stream of live trading signals coming from a running backtest. It's like setting up a listener that gets notified whenever a signal is generated. 

The function takes a callback – a piece of code you provide – that will be executed for each signal event.  Crucially, these events are handled one after another, ensuring they're processed in the order they arrive.

Keep in mind this listener only works when you’re actively running a backtest with `Live.run()`.  It provides a way to react to signals as they happen during a simulation.  The function returns another function that you can call to unsubscribe from receiving these signals when you're done.

## Function listenSignalBacktestOnce

This function lets you react to specific signals generated during a backtest run, but only once. Think of it as setting up a temporary listener that's automatically removed after it fires. You provide a filter to specify which signals you're interested in, and a function to execute when a matching signal arrives. It's perfect for quick checks or actions based on a single, specific event within your backtest. The listener only works during the `Backtest.run()` execution.

## Function listenSignalBacktest

This function lets you tap into the backtest process and react to what’s happening. It’s like setting up an alert system for your trading strategy's performance during a simulation. 

You provide a function that will be called whenever a signal event occurs during a `Backtest.run()` execution. These events are handled one at a time, ensuring that they are processed in the order they are generated, which is helpful for any logic you might need to perform based on the sequence of events. It gives you a way to observe and potentially respond to the backtest as it unfolds.


## Function listenSignal

This function lets you react to changes in your trading strategy's status, like when it enters an idle state, opens a position, is actively trading, or closes a position. It's a simple way to be notified of these key events. Importantly, it handles these events one at a time, even if your reaction code takes some time to complete. This ensures that things happen in a predictable order and prevents unexpected conflicts. You provide a function that will be called whenever a signal event occurs, and the function returns another function that allows you to unsubscribe.

## Function listenRiskOnce

This function lets you react to specific risk rejection events, but only once. Think of it as setting up a temporary alert – it listens for a particular condition related to risk, triggers a callback function when that condition is met, and then quietly stops listening. This is perfect when you need to perform an action based on a single instance of a risk rejection, like adjusting your strategy after a certain threshold is breached. You provide a filter to define what event you're interested in and a function to execute when that event happens. Once the event is processed, the listener automatically removes itself, preventing repeated executions.

## Function listenRisk

This function lets you keep an eye on when your trading signals are being blocked because they violate risk rules. Think of it as a notification system that only alerts you when something goes wrong – it won’t bother you with signals that are perfectly fine.

The `listenRisk` function gives you a way to react to these rejections, one at a time, ensuring that your response is handled in the order they occur.  It uses a special queuing mechanism to avoid any issues from running things at the same time.

You provide a function that will be called whenever a signal is rejected due to risk. This allows you to adjust your strategy or take corrective action when necessary. The function you provide will be executed in a safe, sequential manner.

## Function listenPingOnce

This function lets you react to a specific ping event just once and then automatically stop listening. Think of it as setting up a temporary alert – you specify a condition (using `filterFn`) and a function (`fn`) to run when that condition is met, and then the system takes care of stopping the listening process after it executes once. It’s great when you need to wait for a particular ping to happen and then do something specific without continuously monitoring. You provide a function to identify the ping you're interested in, and another function that handles the event when it occurs.

## Function listenPing

This function lets you keep an eye on signals that are waiting to be activated. It sends out a "ping" every minute while a signal is in this waiting period. Think of it as a gentle nudge to let you know the signal is still there and being monitored. 

You provide a function that gets called each time a ping is received, and you can use this to do things like track how long a signal has been waiting or run some custom checks. When you’re done listening for these pings, the function returns another function that you can call to unsubscribe.


## Function listenPerformance

This function lets you keep an eye on how quickly your trading strategies are running. It's like having a performance monitor that reports on the timing of different operations. You give it a function that will be called whenever a performance event happens, and it handles the details of tracking and reporting those events for you. Importantly, the reports will be processed one after another, even if your callback function takes some time to complete, ensuring a consistent view of the performance data. This is great for finding slowdowns and optimizing your strategy’s speed.

## Function listenPartialProfitOnce

This function lets you set up a one-time alert for when a specific partial profit condition is met during your backtest. You provide a filter that defines what condition you're looking for, and a function to run when that condition happens.  Once the condition is found and your function runs, the alert automatically goes away – it’s perfect for reacting to a particular profit milestone just once. Think of it as a single, focused trigger for your trading logic.


## Function listenPartialProfit

This function lets you keep track of your trading progress as you reach different profit milestones, like 10%, 20%, or 30% gains. It’s a way to be notified about these achievements during a backtest or live trade. The important thing is that the notifications happen one after another, even if the function you provide needs a little time to process each one, ensuring things run smoothly and avoid any unexpected issues. You give it a function that will handle each profit milestone notification, and it gives you back a way to unsubscribe later when you no longer need those notifications.

## Function listenPartialLossOnce

This function lets you set up a listener that reacts to specific partial loss events—think of it as a temporary alert for when something particular happens with your trading positions. You provide a filter, which defines what kind of loss event you're interested in, and a callback function, which will be executed just *once* when that event occurs. After the callback runs, the listener automatically stops, so you don’t have to worry about cleaning it up. It's perfect for situations where you need to respond to a single, specific loss condition and then move on.


## Function listenPartialLoss

This function lets you be notified whenever your trading strategy experiences a specific level of loss, like 10%, 20%, or 30% of its capital. It's designed to handle these notifications in a reliable order, even if your notification code takes some time to run. Think of it as a way to react to drawdown milestones in a controlled and sequential manner, ensuring that any actions you take are processed one after another. You provide a function that will be called each time a loss level is reached, and this function will execute without interrupting other operations.

## Function listenOptimizerProgress

This function lets you keep an eye on how your optimizer is doing as it runs. It sends updates about the progress, specifically related to data source processing. The updates are delivered in the order they happen, and importantly, even if your callback function takes some time to process each update, the updates will still be handled one at a time to avoid any conflicts. Think of it as getting periodic status reports during the optimization process. To use it, you simply provide a function that will be called with each progress update. When you’re done listening, the function returns another function which you can call to unsubscribe.

## Function listenExit

This function lets you be notified when something really bad happens that stops the backtest-kit from running, like issues with background processes. It’s designed for errors that are so critical they halt everything. The notification you receive will include details about the error, and it's guaranteed that these notifications are handled one at a time, even if the notification process itself takes some time. Think of it as a safety net for the most serious problems in your backtesting environment. To use it, you provide a function that will be called when a fatal error occurs. The function you provide will be responsible for handling the error.

## Function listenError

This function lets you set up a way to catch and deal with errors that happen during your trading strategy's run, but aren't critical enough to stop everything. Think of it as a safety net for things like temporary API connection problems.

When an error occurs, the provided function will be called to handle it. Importantly, these errors are processed one at a time, in the order they happen, even if the function you provide takes some time to complete. This ensures things stay stable and prevents a cascade of issues. You can unsubscribe from these error notifications when you no longer need them.

## Function listenDoneWalkerOnce

This function lets you react to when a background task within your backtest completes, but only once. You provide a filter—a way to specify which completed tasks you're interested in—and a callback function that will be executed just one time when a matching task finishes.  After that single execution, the subscription is automatically removed, so you won't get any more notifications. It's a convenient way to handle specific background task completions without ongoing subscriptions.


## Function listenDoneWalker

This function lets you keep track of when background tasks within a Walker are finished. It’s particularly useful if you need to perform actions after these tasks complete, ensuring they happen in the order they were initiated. Think of it as a way to listen for signals that a process is done, with the added benefit of preventing multiple processes from running your response code at the same time, maintaining a predictable order. You provide a function that will be called when a background task finishes, and this function returns another function that you can use to unsubscribe from these completion events later.

## Function listenDoneLiveOnce

This function lets you react to when background tasks finish running within your backtest. You specify a filter – a condition that must be met for the event to trigger your callback – and then provide a function to execute when that filtered event occurs. The really handy part is that it automatically stops listening after your callback runs just once, ensuring you don't get repeatedly triggered. Think of it as a temporary notification system for specific background task completions.


## Function listenDoneLive

This function lets you keep track of when background tasks initiated by Live are finished. Think of it as a way to be notified when something you asked Live to do in the background is done. Importantly, the notifications happen one at a time, even if the function you provide takes a while to run – this ensures things don't get messy with multiple things happening at once. You give it a function that will be called when a background task completes, and it returns another function that you can use to unsubscribe from these notifications later if you need to.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but in a special way: it only runs your code once and then stops listening. You provide a filter – a test – to decide which backtest completions should trigger your code. Once the filter matches a completed backtest, your callback function runs, and the listener automatically unsubscribes, so you don't keep getting notifications. It's a clean way to handle a single event without ongoing subscriptions.


## Function listenDoneBacktest

This function lets you react when a background backtest finishes running. Think of it as subscribing to a notification that tells you when a backtest is done. Importantly, the notifications are handled in the order they arrive, and any code you put inside your reaction function will run one step at a time, even if it's complex or asynchronous. It's a reliable way to know when a backtest is complete and do something with the results.

## Function listenBacktestProgress

This function lets you keep an eye on how your backtest is running. It gives you updates as the backtest progresses, allowing you to monitor its status. These updates are handled one at a time, even if the update information requires some processing, ensuring everything stays in order. Essentially, you provide a function that will be called with progress information whenever the backtest needs to report its state.

## Function hasTradeContext

This function helps you determine if your code is running within a valid trading environment. It essentially verifies that both the execution context and the method context are present. If it returns true, it means you're in a state where you can safely use functions that interact with the exchange, like fetching historical data or formatting prices. Think of it as a safety check before calling potentially risky functions related to trading.

## Function getMode

This function tells you whether the backtest-kit framework is currently running a simulation (backtest) or operating in a live trading environment. It’s a simple way to check the context of your code – for example, you might want to disable certain features during backtesting to avoid unexpected behavior. The function returns a promise that resolves to either "backtest" or "live", clearly indicating the operational mode.


## Function getDefaultConfig

This function gives you a ready-made set of settings to use as a starting point for your backtesting setup. It provides a collection of predefined values for various parameters, like how often to check for new signals, retry attempts when fetching data, and limits on signal lifetimes. Think of it as a template—you can look at what’s included and adjust the settings to match your trading strategy or experiment with different configurations. It's a helpful way to understand all the available options and their initial settings.

## Function getDefaultColumns

This function provides a handy way to see the standard columns used for generating reports within the backtest-kit framework. Think of it as a peek at the default layout for your backtesting results – you'll find columns for things like strategy performance, risk metrics, and even scheduled events.  It gives you a blueprint of what's possible, allowing you to understand the available column types and how they're initially configured before you start customizing your own report layouts. The returned object is read-only, so you can't directly change the defaults using this function; instead, use it as a reference for creating your own configurations.

## Function getDate

This function, `getDate`, simply gives you the current date. It's helpful for knowing what date your calculations are based on. If you're running a backtest, it will return the date associated with the historical data you're analyzing. Otherwise, in a live trading environment, it will provide the actual current date.

## Function getConfig

This function lets you peek at the framework's global settings. Think of it as a way to see how the backtesting environment is set up, like slippage percentages or retry delays. It's designed to be read-only – you can look at the values but you shouldn't try to change them directly using this function. This helps keep things predictable and prevents unexpected behavior in your backtests.

## Function getColumns

This function lets you peek at the column configurations used to build reports within backtest-kit. It provides a snapshot of the columns being used for backtest results, heatmap data, live trading ticks, partial events, performance metrics, risk assessments, scheduled tasks, walker signals, and strategy outcomes.  Think of it as a way to see exactly what data is being displayed in your reports. Importantly, it returns a copy so you can examine the structure without changing the underlying configurations.

## Function getCandles

This function allows you to retrieve historical price data, also known as candles, for a specific trading pair. You tell it which trading pair you're interested in, like "BTCUSDT" for Bitcoin against USDT, and how often you want the data, such as every minute or every hour.  The function then fetches a specified number of candles, going back in time from the present. It relies on the underlying exchange to provide this historical data. Essentially, it's your window into past price action.


## Function getAveragePrice

This function, `getAveragePrice`, helps you determine the Volume Weighted Average Price, or VWAP, for a specific trading pair like BTCUSDT. It looks at the recent trading activity – specifically the last five one-minute candles – to figure out this average price. The calculation involves considering the high, low, and closing prices of those candles along with the volume traded at each price. If there's no trading volume available, the function will instead provide a simple average of the closing prices. You just need to provide the symbol of the trading pair you are interested in.

## Function formatQuantity

This function helps you display the correct quantity of an asset when placing orders. It takes the trading pair symbol, like "BTCUSDT", and the raw quantity as input. Then, it automatically adjusts the quantity to match the specific formatting rules of the exchange you're using, ensuring you're showing the right number of decimal places for that particular asset. Think of it as a convenient way to avoid those annoying errors caused by incorrect quantity formatting.

## Function formatPrice

This function helps you display prices in the correct format for a specific trading pair. It takes the symbol like "BTCUSDT" and the raw price as input. Then, it automatically handles the number of decimal places needed based on the exchange’s rules, making sure the price looks right when you show it to users. You don't have to worry about figuring out the exact formatting yourself; this function does it for you.


## Function dumpSignal

This function helps you save detailed records of your AI trading strategy's decision-making process. It takes the conversation history with the AI, the trading signal it generated, and creates a set of markdown files to document everything. 

You’ll get a file showing the initial instructions given to the AI, separate files for each user message and the AI’s responses, and a final file containing the generated trading signal (like the entry price, stop loss, and take profit levels). This makes it much easier to debug and understand why your AI made specific trading choices.

The function also automatically creates a directory to hold these files, using a unique identifier for each trading result. Importantly, it won’t overwrite existing data, so you can safely run your strategy multiple times without losing previous records. You can also specify a custom output directory if you want to organize your logs in a particular location.


## Function cancel

This function lets you cancel a previously scheduled signal for a specific trading strategy, without interrupting the strategy's overall operation. Think of it as removing a future instruction—the strategy won't execute that particular signal anymore. It's useful if you want to change your mind about a trade before it happens. 

You specify the symbol (like "BTCUSDT") and the name of the strategy you want to modify. Optionally, you can provide a cancellation ID to help you keep track of which cancellation requests you've made. This function works whether you're backtesting or running the strategy live.


## Function addWalker

This function lets you register a "walker," which is essentially a way to run multiple strategies against the same historical data and see how they stack up against each other. Think of it as setting up a competition between your trading strategies. You provide a configuration object that tells the walker how to execute these tests and how to measure their success. This allows for a more comprehensive comparison beyond just evaluating a single strategy in isolation.

## Function addStrategy

This function lets you tell backtest-kit about a new trading strategy you've created. Think of it as registering your strategy so the framework knows how to use it. When you add a strategy, the system will check to make sure everything is set up correctly – things like the prices you’re using, how your take-profit and stop-loss orders work, and that the timing is accurate. It also helps prevent signals from being sent too rapidly and, importantly, ensures your strategy's data is safely stored even if something unexpected happens during live trading. You provide the strategy's configuration details when you call this function.

## Function addSizing

This function lets you tell backtest-kit how to determine the size of your trades. Think of it as setting up the rules for how much capital you’ll allocate to each trade based on your risk tolerance and strategy. You provide a sizing configuration that outlines the method used – whether it's a fixed percentage of your capital, a more complex Kelly Criterion approach, or something based on Average True Range (ATR). The configuration also includes specifics like the percentage of risk you’re comfortable with, constraints on the minimum and maximum trade sizes, and potentially a custom function to fine-tune the sizing calculations. Basically, it's how you define your position sizing strategy within the framework.

## Function addRisk

This function lets you tell backtest-kit how to manage risk within your trading system. You provide a configuration that sets limits on how many trades can be active at once and allows you to build in custom checks to ensure your portfolio stays within acceptable boundaries.  Think of it as defining the guardrails for your strategies.  Multiple trading strategies will share this risk configuration, so you can easily see how they interact and avoid unintended consequences. The system keeps track of all open positions, making it possible to write sophisticated validation rules based on the overall portfolio.

## Function addOptimizer

This function lets you register a custom optimizer within the backtest-kit framework. Think of an optimizer as a system that creates trading strategies for you, pulling data from various sources and using a large language model to generate prompts and ultimately, executable code. It essentially automates the process of building a complete backtesting environment, including all the necessary components like exchange settings, trading strategies, and analysis logic, all packaged into a single file. By providing an optimizer schema, you're telling the framework how to build these automated strategies.

## Function addFrame

This function lets you tell backtest-kit about a new timeframe you want to use for your backtesting. Think of it as defining a specific period and frequency (like daily, hourly, or even minute-by-minute) for your historical data. You provide a configuration object that outlines the start and end dates of your backtest, the desired interval, and a way to handle events related to that timeframe. Essentially, you're setting the stage for how your backtest will slice up and analyze the data.

## Function addExchange

This function lets you tell backtest-kit about a new data source for trading – think of it as adding a new stock exchange to the system. You'll provide a configuration object that describes how to fetch historical price data, how to format prices and quantities, and how to calculate a common trading indicator called VWAP. Essentially, you're teaching the framework where to get the data and how to interpret it for your backtesting strategies. This is a crucial step to enable backtest-kit to work with your specific trading platform or data feed.
