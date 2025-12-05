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

This function lets you plug in your own logging system for backtest-kit. It's a way to control where and how the framework's internal messages are recorded.

When you provide a logger, all log messages generated by backtest-kit will be sent to your logger.  The framework automatically adds helpful context to these messages – things like the strategy name, exchange used, and the trading symbol – so you have all the information you need to debug or monitor your backtesting process.

You simply need to create a logger that conforms to the `ILogger` interface and pass it to this function.

## Function setConfig

This function lets you adjust how backtest-kit operates by modifying its global settings. Think of it as tweaking the overall behavior of the framework. You can change certain parameters to customize your backtesting environment. The `config` parameter lets you selectively override the default settings—you don’t need to provide every setting, just the ones you want to change. It's designed for flexible configuration.

## Function listWalkers

This function lets you see all the different "walkers" that are currently set up within the backtest-kit framework. Think of walkers as the individual steps or components that process data during a backtest. By calling this function, you're essentially getting a list of all those components, along with their configurations. This is really helpful when you're trying to understand how a backtest is structured, troubleshoot any issues, or build tools that adapt to different backtest setups. It returns a promise that resolves to an array of walker schemas.

## Function listStrategies

This function allows you to see all the trading strategies that have been set up within the backtest-kit framework. It returns a list containing details about each strategy, like its configuration and how it operates. Think of it as a way to get an overview of all the strategies you're using, which can be helpful for troubleshooting or creating tools that adapt to different strategies. Essentially, it provides a snapshot of the available strategies.


## Function listSizings

This function lets you see all the sizing configurations that are currently active within the backtest-kit framework. It's like getting a full inventory of how your trades are sized. 

Think of it as a way to check what rules are in place for determining trade sizes.

You can use this to troubleshoot sizing issues, generate documentation, or even build user interfaces that let you interact with these sizing configurations. It returns a list of objects, each representing a sizing schema.

## Function listRisks

This function lets you see all the risk assessments that your backtest system is currently tracking. Think of it as a way to peek under the hood and understand the different potential risks your strategy is considering. It returns a list of these risk configurations, which can be helpful for troubleshooting, generating documentation, or creating user interfaces that need to adapt to the risks being managed. Essentially, it gives you visibility into your risk management setup.

## Function listOptimizers

This function gives you a look at all the different optimization strategies currently set up within your backtest kit. Think of it as a way to see what options are available for tweaking your trading algorithms. It returns a list describing each optimizer, allowing you to understand what each one does and how it’s configured. You can use this information to build tools that let users experiment with different optimization approaches or simply to understand your system’s capabilities. It provides a convenient way to inspect and document the optimizers you're using.

## Function listFrames

This function provides a way to see all the different "frames" your backtest kit is using. Think of frames as the different data sources or views your strategies are looking at – things like price data, volume, or custom indicators. It returns a list describing each frame, giving you insight into what’s available for your trading logic. You can use this to understand your setup or create tools that adapt to different configurations. Essentially, it's a peek under the hood of your trading environment, showing you all the data perspectives your strategies have access to.

## Function listExchanges

This function helps you discover the exchanges your backtest-kit is connected to. It returns a list of exchange configurations, providing details about each one. You can use this information to understand which exchanges are available for backtesting, to generate documentation, or to dynamically create user interfaces. Essentially, it’s a way to see the full picture of your exchange setup.

## Function listenWalkerProgress

This function lets you keep an eye on how your backtesting process is going. It's a way to get updates after each strategy finishes running within a `Walker.run()` execution. The updates you receive will be in the order they happen, and even if your update handling function does some asynchronous work, the updates will still be processed one at a time to prevent any issues with multiple things happening at once. You provide a function as input, and that function will be called whenever a strategy completes, giving you information about its progress. The function you provide will also return a function that you can use to unsubscribe to these progress updates later.

## Function listenWalkerOnce

This function lets you set up a listener that reacts to specific changes happening within a trading simulation, but only once. You provide a condition – a filter – that defines what kind of change you’re interested in. When that condition is met, a function you specify will run. After that single execution, the listener automatically stops itself, so you don't have to worry about managing subscriptions. It’s a handy way to wait for something particular to happen during a backtest.

You give it two things: first, a filter function to identify the changes you want to track. Second, the function that should be executed when the filter finds a matching change.

## Function listenWalkerComplete

This function lets you be notified when the backtest-kit has finished running all of your strategy tests. Think of it as a signal that the entire backtesting process is done. When you subscribe to these completion events, the results will be passed to your provided function. Importantly, even if your function takes some time to process these results (like if it's doing asynchronous operations), the next completion event will still wait in line, ensuring events are handled one at a time. This helps prevent unexpected behavior from running too many things at once.

The function you provide will receive an object containing the aggregated results from all the strategies that were tested.

## Function listenWalker

This function lets you keep an eye on how your backtest is progressing. It allows you to subscribe to events that are triggered after each strategy finishes running within a `Walker`. Think of it as a notification system; after each strategy completes, this function will call your provided code. Importantly, it handles events in order, and makes sure your code runs one step at a time, even if your code itself takes some time to complete. You provide a function that gets called for each event, and this `listenWalker` function returns another function that you can use to unsubscribe from these notifications later.

## Function listenValidation

This function lets you keep an eye on potential problems when your trading strategies are being checked for risks. It's like setting up an alert system – whenever a risk validation check fails and throws an error, this function will notify you. The notification is delivered through a callback function you provide. Importantly, these notifications are handled one at a time, even if your callback involves some processing that takes a bit of time. This ensures a controlled way to debug and monitor your risk validation process. You provide a function that will be called whenever an error occurs during this validation, and that function will receive details about the error.

## Function listenSignalOnce

This function helps you react to a specific trading signal just once and then stop listening. Think of it as setting up a temporary listener that only fires when a particular condition is met. 

You provide a filter – a way to describe exactly what kind of signal you're looking for – and a function to run when that signal arrives. The function will execute only once and then automatically remove itself from listening, so you don’t have to worry about cleaning up. This is handy when you need to react to a single event and then move on. 

The filter helps you narrow down the signals you care about, and the provided function handles the event when it's triggered.

## Function listenSignalLiveOnce

This function lets you temporarily listen for specific signals coming from a live trading simulation. You provide a filter – a rule to determine which signals you’re interested in – and a function to execute when a matching signal arrives. It’s designed for one-time use: once the callback function runs, it automatically stops listening and unsubscribes, ensuring you don't continue receiving signals unnecessarily. Think of it as a quick, targeted way to react to a single event during a live backtest. 

It only works with signals generated during a `Live.run()` execution. 

You provide two things: a filter that decides which signals you want to see, and the code that will run when a matching signal is found.

## Function listenSignalLive

This function lets you tap into the live trading signals generated by backtest-kit. Think of it as setting up a listener to receive updates as the simulation runs. It provides a callback function that gets triggered each time a signal event occurs during a `Live.run()` execution. Importantly, these events are processed one after another, ensuring order is maintained – it’s designed for situations where you need to handle events in a specific sequence. To use it, you provide a function that will be called with each new trading signal.

## Function listenSignalBacktestOnce

This function lets you set up a listener that reacts to specific signals generated during a backtest. Think of it as a temporary alert system for your backtesting process. You tell it what kind of signals you're interested in – perhaps only signals that meet a certain condition – and it will trigger your custom function once it sees one. Once that single event has been handled, the listener automatically shuts itself off, so you don't have to worry about managing subscriptions. It’s a simple way to react to one particular event during a backtest and then be done.

The first argument, `filterFn`, defines which signals will trigger the action. The second, `fn`, is the function that will run when a matching signal is received.

## Function listenSignalBacktest

This function lets you tap into the flow of a backtest and get notified whenever a trading signal is generated. It’s like setting up a listener that gets triggered with each tick result during a backtest run.  The signals you receive come directly from the `Backtest.run()` process. Importantly, these signals are handled one at a time, in the order they happen, ensuring you won't miss anything and can process them reliably.  You provide a function that will be called for each signal, allowing you to react to the backtest's decisions as they happen. This subscription is temporary and returns a function that you can use to unsubscribe later.

## Function listenSignal

This function lets you set up a listener that gets notified whenever your trading strategy generates a signal. Think of it as subscribing to updates about what your strategy is doing – whether it's idle, opening a position, actively trading, or closing one. 

The important thing to know is that these notifications are handled in order, and the processing is done sequentially. This ensures that even if your callback function does something that takes time, like making an API call, everything is processed one step at a time, preventing any conflicts.

You provide a function as an argument, and this function will be called with data about each signal event. The function you provide will also return a function you can call to unsubscribe from the signals.


## Function listenPerformance

This function lets you keep an eye on how your trading strategies are performing in terms of speed and efficiency. It essentially sets up a listener that will notify you whenever a performance metric is recorded during strategy execution. Think of it as a way to profile your code and pinpoint areas that might be slowing things down. The listener ensures that these performance updates are handled one at a time, even if the function you provide to handle them takes a bit of time to complete. You give it a function that will receive these performance reports, and it returns another function that you can use to unsubscribe from these updates later.

## Function listenPartialProfitOnce

This function lets you set up a one-time alert for when a specific partial profit condition is met during your backtesting. You provide a filter – a rule that defines what you’re looking for – and a function to execute when that rule is triggered. Once the filter matches an event, your function runs, and the alert automatically turns off, ensuring it only acts once. It's great for things like automatically saving data or triggering a specific action when a certain profit level is reached. 

The function returns a way to stop listening to the partial profit events, allowing you to manually unsubscribe if necessary.


## Function listenPartialProfit

This function lets you keep track of your trading progress as you reach certain profit levels, like 10%, 20%, or 30% gains. It's like setting up a listener that gets notified each time your trade hits a profit milestone. The good thing is that these notifications are handled in order, one at a time, even if the code you provide to handle the notification takes some time to complete. This ensures that things happen in a predictable sequence and avoids any unexpected behavior due to multiple processes running at the same time. You simply provide a function that will be called whenever a partial profit is reached, and this function will be executed safely and sequentially.

## Function listenPartialLossOnce

This function lets you set up a one-time alert for specific partial loss events in your trading strategy. You provide a condition – a filter – that determines which loss events you’re interested in. Once an event matches that condition, a provided callback function will be executed just once, and then the listener automatically stops listening. Think of it as setting a single trigger for a particular loss scenario. 

It's particularly helpful if you only need to react to a specific type of loss once, like if you want to take a single action when a loss exceeds a certain threshold. 

The first argument defines the criteria for the event you're looking for. The second argument is the action to take when the event happens.

## Function listenPartialLoss

This function lets you keep track of how much your trading strategy has lost along the way. It will notify you whenever your losses hit certain milestones, like 10%, 20%, or 30% of your initial capital. 

Importantly, the notifications happen in order, and any code you put inside the callback function will be executed one step at a time, even if it involves asynchronous operations. This ensures that your loss tracking logic runs reliably and avoids any issues caused by multiple processes running simultaneously. You provide a function that will be called with information about the partial loss event.

## Function listenOptimizerProgress

This function lets you keep track of how your backtest optimization process is going. It provides updates as the optimizer works through its data, letting you monitor its progress. The updates are given to you in a specific order, even if your monitoring code takes some time to process each update. To use it, you provide a function that will receive these progress reports, and the function will return another function to unsubscribe from these updates when you no longer need them.

## Function listenExit

This function lets you be notified when something goes seriously wrong and stops the backtest-kit processes, like Live, Backtest, or Walker. It's for those critical errors that completely halt execution – unlike regular errors that can be handled and recovered from. When a fatal error occurs, the provided function will be called to handle it. To ensure smooth operation, errors are processed one at a time, even if your error handling function involves asynchronous actions. This lets you gracefully respond to these critical situations and potentially prevent data loss or unexpected behavior. You're essentially setting up a safety net for your trading framework.

## Function listenError

This function lets you set up a way to catch and deal with errors that happen during your trading strategy's execution, but aren't severe enough to stop everything. Think of it as a safety net for occasional hiccups, like a temporary problem connecting to a data source. 

When an error occurs, the provided function will be called to handle it, allowing your strategy to keep running smoothly.  The errors are handled one at a time, in the order they happen, even if your error handling function takes some time to complete. This ensures everything stays organized and prevents unexpected behavior from happening too quickly. You basically tell backtest-kit "Hey, if something goes wrong, run *this* function to fix it, and keep going!"

## Function listenDoneWalkerOnce

This function lets you react to when a background task within your trading strategy finishes, but only once. You provide a filter – a condition that determines which completion events you're interested in – and then a callback function that gets executed when a matching event occurs.  Once the callback runs, the subscription is automatically removed, so you don't have to worry about cleaning up manually. It's a handy way to trigger actions or update your system after a background process completes, ensuring it only happens once for a specific event.


## Function listenDoneWalker

This function lets you be notified when a background task within the backtest-kit framework finishes. Think of it as setting up a listener that gets triggered when a specific operation completes. The listener you provide will be called whenever a background task concludes, and it guarantees that these notifications are handled one at a time, even if your notification process takes some time. It’s useful for tracking the progress of longer-running operations without blocking the main process. You pass in a function that will be executed when the task finishes, and this function itself returns another function that you can use to unsubscribe from these notifications later.

## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running, but only once. You provide a filter to specify which completed tasks you’re interested in, and a function to execute when a matching task finishes. Once that function has run, the subscription automatically stops, preventing further callbacks. It's useful for situations where you need to perform an action immediately after a background process completes, and don't want to keep listening for more events.

You define a condition (`filterFn`) to determine which completed tasks are relevant to you. Then, you provide a callback function (`fn`) that will be called only once when a task matches that condition. After that single execution, the listener is automatically removed, so you don’t have to worry about manual cleanup.


## Function listenDoneLive

This function lets you monitor when background tasks within the backtest-kit framework finish running. It’s like setting up a notification system for completed background processes. Whenever a background task is done, the function you provide will be called. The key thing is that these completion notifications are handled in the order they occur, and even if your notification function needs to do some asynchronous work, it won't interfere with other notifications. You give it a function to run when a task is complete, and it returns a function you can use to unsubscribe from these notifications later.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but only once. It's like setting up a single, temporary listener.

You provide a filter that determines which backtest completions you're interested in, and a function to execute when a matching backtest is done. Once that function runs, the listener automatically disappears – you don't need to manually unsubscribe.

Think of it as a way to run a specific action, like logging a result or updating a display, only when a particular backtest concludes. The filter ensures you only react to the backtests that matter to you.

## Function listenDoneBacktest

This function lets you be notified when a backtest, run in the background, has finished. It's like setting up a listener to catch the "backtest done" signal. When the backtest concludes, the function you provide will be executed. Importantly, even if your function performs asynchronous operations, the notifications will be handled one at a time to ensure things stay organized and avoid unexpected issues. You’re essentially subscribing to a notification that gets delivered after the backtest completes its work. The function you give it allows you to react to the finished backtest.

## Function listenBacktestProgress

This function lets you keep an eye on how your backtest is running. It sets up a listener that gets notified as the backtest progresses, particularly during background processing. The updates you receive will be in the order they happen, and even if your callback function takes some time to process each update, the events are handled one after another to avoid any chaos. You provide a function that will be called with details about the backtest's current state, allowing you to track its advancement.

## Function getMode

This function tells you whether the trading framework is currently running a backtest or operating in a live trading environment. It's a simple way to check the context of your code – for example, to adjust parameters or logging based on whether you're analyzing historical data or actively trading. The function returns a promise that resolves to either "backtest" or "live", providing a clear indication of the current mode.

## Function getDate

This function, `getDate`, helps you retrieve the current date within your trading strategy. It's all about knowing what date you're working with. When running a backtest, it gives you the date associated with the specific historical timeframe you're analyzing. If you're running in live trading mode, it returns the actual, real-time date. Essentially, it provides a reliable way to understand the date context of your trades, whether you're looking back in time or trading live.

## Function getCandles

This function retrieves historical price data, specifically candles, for a given trading pair. Think of it as pulling up charts – you tell it which asset you're interested in (like BTCUSDT), how often you want the data (every minute, every hour, etc.), and how many data points you need. It uses the data feeds already set up within the backtest-kit framework to get this information.  You provide the symbol, the timeframe (like a 5-minute interval), and the number of candles you want back in time. The result is an array of candle data, each candle representing a specific time period's open, high, low, and close prices.


## Function getAveragePrice

This function helps you figure out the average price of a trading pair, like BTCUSDT. It does this by looking at the recent trading activity – specifically the last five one-minute candles. It calculates a Volume Weighted Average Price, giving more weight to prices where more trading happened.

If there wasn't any volume data available, it's a simpler calculation using just the closing prices. You just need to provide the symbol you're interested in, and it will return the calculated average price.

## Function formatQuantity

This function helps you prepare quantity values correctly for trading. It takes a trading symbol, like "BTCUSDT," and a raw quantity number, then formats it to match the rules of the specific exchange you're using. This ensures the quantity you submit for orders has the right number of decimal places, avoiding potential errors or rejections. Essentially, it handles the exchange-specific formatting for you, making sure your quantities are in the expected format.

## Function formatPrice

This function helps you display prices in a way that matches the specific exchange you're working with. It takes a trading pair symbol like "BTCUSDT" and a raw price value as input. The function then uses the exchange's own rules to format the price correctly, ensuring the right number of decimal places are shown. Essentially, it makes sure your displayed prices look consistent with how the exchange itself presents them.

## Function addWalker

This function lets you register a "walker" – essentially a tool that runs backtests for different trading strategies simultaneously and then evaluates how they performed against each other. Think of it as setting up a controlled experiment for your strategies. You provide a configuration object, the `walkerSchema`, which tells the framework how to run these comparative backtests. This lets you easily see which strategies are outperforming others under the same conditions.

## Function addStrategy

This function lets you add a trading strategy to the backtest-kit framework. Think of it as registering a new trading plan that the system will use for testing or live trading. When you add a strategy, the framework automatically checks it to ensure the signals are valid and logically sound – things like making sure prices and stop-loss orders make sense, and that signals aren't sent too frequently. In live mode, the strategy's state is also safely stored so you don't lose progress even if something goes wrong.

You'll pass in a configuration object, called `strategySchema`, which contains all the details about how your strategy operates.

## Function addSizing

This function lets you tell backtest-kit how to determine the size of your trades. Think of it as defining your risk management rules. You provide a configuration object that outlines things like whether you want to size based on a fixed percentage of your capital, a Kelly Criterion approach, or using Average True Range (ATR).  The configuration also specifies parameters like the percentage of risk you're comfortable with, and constraints to keep your position sizes within reasonable limits. By registering this sizing configuration, the framework will use it to calculate appropriate trade sizes during backtesting.

## Function addRisk

This function lets you set up how your trading system manages risk. Think of it as defining the boundaries for how much your strategies can trade simultaneously and adding extra checks to ensure everything stays within acceptable limits. It allows you to create rules, like maximum position sizes or custom validations, that apply across all your trading strategies, helping to prevent excessive risk exposure. This centralized risk management system keeps track of all active positions so you can implement sophisticated checks and decide whether trading signals should be allowed or rejected.

## Function addOptimizer

This function lets you add a custom optimizer to the backtest-kit framework. Think of an optimizer as a tool that automatically generates trading strategies based on your data and rules. It gathers information, creates a conversational history with that data, crafts prompts, and then builds a complete backtest script – essentially a ready-to-run .mjs file – containing all the necessary components like exchange settings, trading strategies, and logic for analyzing data across different timeframes. You provide a configuration object to tell the framework how your optimizer works.

## Function addFrame

This function lets you tell backtest-kit how to generate the timeframes it will use for backtesting. Think of it as defining the "look" of your backtest – specifying the start and end dates, and the frequency of the data (like daily, weekly, or hourly). You're essentially providing a blueprint for how your backtest will slice up the historical data.  The `frameSchema` object holds all these crucial details, so backtest-kit knows exactly when and how to pull data for your trading strategies.

## Function addExchange

This function lets you tell backtest-kit about a new data source, like a cryptocurrency exchange or stock market. Think of it as introducing the framework to where it will get its price data. You’re essentially providing the framework with a blueprint—an `exchangeSchema`—that describes how to fetch historical price information, how to format prices and quantities, and how to calculate things like VWAP (Volume Weighted Average Price).  This is a core step in setting up your backtesting environment, as it connects the framework to the real-world data it needs.

# backtest-kit classes

## Class WalkerValidationService

The WalkerValidationService helps ensure your trading strategies, or "walkers," are correctly set up and follow the expected structure. Think of it as a quality control system for your strategies.

You can use it to register the blueprint, or schema, for each walker. This lets the service know what data it should expect.

The service allows you to add walker schemas, validate if a specific walker exists and conforms to its schema, and retrieve a list of all registered walkers. This makes it easier to catch errors early and maintain a consistent structure across your trading system.


## Class WalkerUtils

WalkerUtils provides helpful tools for running and managing walker comparisons, which are used to evaluate trading strategies. It simplifies the process of executing these comparisons and accessing their results.

The `run` method lets you easily execute a walker comparison for a specific trading symbol, automatically handling some of the underlying setup. You can also run comparisons in the background with `background` when you only need the side effects, like logging or triggering callbacks, without needing to see the progress.

If you need the complete results after a comparison, `getData` fetches them for you. For a nicely formatted overview, `getReport` generates a markdown report summarizing the comparisons. Finally, `dump` allows you to save that report directly to a file on your system. Think of WalkerUtils as a convenient assistant for managing your walker-based strategy evaluations.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of different walker schema definitions in a structured and type-safe way. Think of it as a central place to store and manage these schema blueprints.

It uses a special registry to store the schemas, making sure they are organized and easy to work with. You can add new schema definitions using the `addWalker()` function, and retrieve them later by their assigned name using the `get()` function.

Before a new schema is added, the `validateShallow()` function quickly checks to make sure it has all the necessary components and that they're of the expected types. 

If you need to update an existing schema, you can use the `override()` function to apply changes without replacing the entire definition. Essentially, it allows you to modify parts of a schema.

## Class WalkerMarkdownService

This service helps you automatically create and save reports about your trading strategies, specifically tailored for each walker (a testing environment). It listens for updates from the walker and keeps track of how each strategy is performing.

The service organizes the results for each walker separately, using a special storage system that prevents interference between different walkers. You can request data or generate full markdown reports for individual walkers, symbols, and metrics.

Reports are saved as markdown files, making them easy to read and share. The service takes care of creating the necessary directories to store these reports.

You can clear out the accumulated data, either for a single walker or for all of them. The service also handles initialization automatically, so you don’t have to worry about setting it up manually.

## Class WalkerLogicPublicService

WalkerLogicPublicService helps manage and run your trading strategies in a structured way. It essentially acts as a layer on top of the internal WalkerLogicPrivateService, making it easier to execute backtests while automatically passing important information like the strategy name, exchange, and frame details. Think of it as a helpful assistant that ensures everything runs smoothly and consistently.

You can use it to compare different walkers for a particular trading symbol. It handles the complexities of setting up the backtesting environment and passing the necessary context, so you can focus on analyzing the results. It automatically executes backtests across all your strategies, simplifying the process of evaluating their performance.

## Class WalkerLogicPrivateService

This service helps you compare different trading strategies against each other, like a referee in a competition. It manages the process of running each strategy, keeping track of how they're performing along the way. 

Think of it as orchestrating a series of backtests – it handles running each one and giving you updates as they finish. You provide the symbol you want to test, the strategies to compare, the metric you're using to judge them (like profit or drawdown), and some context information. 

The service sequentially runs each strategy and provides progress updates, showing you how each one is doing. At the end, it returns a complete set of results, ranked according to your chosen metric, so you can easily see which strategies performed best. It relies on other services internally to handle the actual backtesting and formatting of results.

## Class WalkerCommandService

WalkerCommandService acts as a central point to interact with the core walker functionality within the backtest-kit. Think of it as a convenient gateway for accessing various validation and execution services. 

It simplifies dependency management by wrapping the WalkerLogicPublicService and providing access to related services like schema and validation components.

The `run` method is the primary way to trigger a walker comparison. You provide a symbol and context information (like the names of the walker, exchange, and frame) to initiate the comparison process and receive results.


## Class StrategyValidationService

The StrategyValidationService helps you make sure your trading strategies are set up correctly before you start backtesting. It keeps track of your strategy definitions, allowing you to register them and then validate that they exist and have the necessary risk profiles. Think of it as a quality control checkpoint for your strategies. 

You can add strategies using `addStrategy`, providing a name and a description of the strategy’s structure. The `validate` function then checks if a strategy is registered and its risk profile is properly defined.  If you need to see what strategies you've registered, the `list` function provides a simple way to get a list of all schemas.


## Class StrategySchemaService

The StrategySchemaService helps keep track of your trading strategies and their underlying structures. Think of it as a central place to define and manage how your strategies are built.

It uses a special type-safe storage system to ensure your strategy definitions are consistent and well-formed. You can add new strategy blueprints using `addStrategy()` and easily find them later by their name.

Before a strategy is officially registered, it's checked to make sure it has all the essential parts and the right data types – this is done by the `validateShallow` function.

You can also update existing strategy definitions using the `override` function to make changes without completely recreating the strategy. Finally, the `get` function lets you retrieve a strategy's definition by its name when you need it.

## Class StrategyGlobalService

StrategyGlobalService acts as a central hub for managing and executing trading strategies within the backtest-kit framework. It’s designed to streamline operations by automatically providing necessary context like the trading symbol, timestamp, and backtest settings to the strategies themselves.

This service relies on several other components to function, including services for connecting to strategies, validating configurations, and handling logging. It’s primarily used internally, but provides functions for checking signal status, running quick backtests, and stopping strategy signal generation.

To improve efficiency, the validation process is cached, meaning strategies aren't repeatedly validated unless the symbol or strategy configuration changes.  You can also clear the cached strategy to force a fresh start. It helps in orchestrating and executing strategies efficiently and consistently during backtesting and live trading.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub for managing and executing trading strategies. It intelligently routes requests to the correct strategy implementation based on the symbol and strategy name you specify. To improve performance, it keeps track of the strategy instances it's using, so it doesn't have to recreate them every time.

Before you can use a strategy, you’re expected to ensure it is initialized. The service also offers methods for live trading (`tick`) and historical analysis (`backtest`).

You can pause a strategy's signal generation using `stop`, or completely reset a strategy’s state and resources by clearing its cached instance with `clear`. This is particularly useful if you need to re-initialize a strategy or free up resources.

## Class SizingValidationService

The SizingValidationService helps ensure your trading strategy uses valid sizing rules. Think of it as a gatekeeper for your order sizes.

You can add sizing rules, each with its own schema, using the `addSizing` method. These schemas define how much to trade based on various factors.

The `validate` method checks if a sizing rule exists and, if you specify, it can also check the sizing method being used. 

If you need to see what sizing rules are currently registered, the `list` method gives you a list of them. This service helps keep your sizing consistent and prevents unexpected behavior in your backtesting or live trading.

## Class SizingSchemaService

The SizingSchemaService helps you keep track of how you determine trade sizes – essentially, the rules for deciding how much to buy or sell. It uses a system to store these sizing rules in a type-safe way, preventing errors.

You can add new sizing rules using `register` and update existing ones with `override`.  To get a sizing rule back, just use `get` and provide the name you gave it when you added it. The service also includes checks to make sure new sizing rules are structured correctly before they’re added to the system.

## Class SizingGlobalService

The SizingGlobalService is a central component for determining how much to trade, essentially calculating your position sizes. It works hand-in-hand with the SizingConnectionService and SizingValidationService to make sure your trades align with your risk management rules. 

Think of it as the brains behind sizing – it takes parameters and uses them to figure out the right amount to buy or sell. This service is used both internally within the backtest-kit system and also accessible through the public API. 

It has a logger to track what's happening, and the `calculate` method is the key function; you provide it with sizing parameters and context, and it returns the calculated position size.

## Class SizingConnectionService

The `SizingConnectionService` acts as a central hub for all your position sizing calculations within the backtest kit. Think of it as a dispatcher, directing sizing requests to the right sizing method based on its name. 

It intelligently manages these sizing methods, creating them only when needed and remembering them for future use to avoid unnecessary work. This makes the sizing process efficient. 

You can request a specific sizing method through the `getSizing` function, and the `calculate` function handles the actual position size computation, taking into account risk parameters and the selected sizing method. If you don't have any specific sizing configured, you can use an empty string for the sizing name.

## Class ScheduleUtils

ScheduleUtils is a handy tool to keep an eye on your scheduled trading signals. It helps you track signals waiting to be processed, any that were cancelled, and provides insights into how efficiently your scheduling is working. 

You can easily get statistics about signals for a specific trading symbol and strategy to understand performance. It also creates a clear, readable markdown report summarizing everything that's happening with your scheduled signals. Finally, you can save these reports directly to a file for later review or sharing. Think of it as a central place to monitor and understand your scheduling operations.

## Class ScheduleMarkdownService

This service helps you automatically create and save reports detailing your scheduled trading signals. It keeps track of when signals are scheduled and cancelled, organizing the data by strategy and the asset being traded.

The service listens for signal events and builds up a record of each event. It then turns this data into nicely formatted markdown tables, providing statistics like cancellation rates and average wait times. These reports are saved as `.md` files, making them easy to read and analyze.

You can retrieve the accumulated data, generate reports for specific assets and strategies, or clear the data if needed. The service also handles the initial setup automatically, subscribing to the signal events so you don’t have to worry about it.


## Class RiskValidationService

The RiskValidationService helps you ensure your trading strategies adhere to predefined risk guidelines. Think of it as a gatekeeper that verifies your strategy's risk profile matches what's expected.

You can add custom risk schemas, defining what constitutes acceptable risk for a particular situation. The service then validates your trading activities against these defined schemas. 

It provides a way to list all the risk schemas you've registered, allowing you to review and manage your risk definitions. Essentially, it helps you maintain consistent and controlled risk management within your backtesting environment.

## Class RiskSchemaService

The RiskSchemaService helps you organize and manage your risk schemas in a structured and safe way. It acts as a central place to store and retrieve these schemas, ensuring they're consistent and well-defined.

You can add new risk profiles using the `addRisk()` functionality (represented by the `register` property), and easily find them again later by their assigned name using the `get()` method.

Before a new risk profile is added, it’s checked to make sure it has the necessary components and data types using `validateShallow`, preventing errors down the line.

If you need to update an existing risk profile, you can use the `override()` method to make targeted changes, without having to replace the entire schema. The service uses a special system (`ToolRegistry`) to keep track of everything in a type-safe manner, reducing the chance of mistakes.

## Class RiskGlobalService

The RiskGlobalService acts as a central hub for managing risk-related operations within the backtest-kit framework. It works closely with a RiskConnectionService to ensure that trading decisions adhere to predefined risk limits.

This service keeps track of open and closed signals, notifying the risk management system whenever a new trade is opened or an existing one is closed. It also performs validation checks on risk configurations and caches those validations to optimize performance. 

You can clear all risk data, or specifically clear data associated with a particular risk instance by providing a risk name. This helps in resetting and managing risk profiles as needed. The service logs its activities, providing valuable insights into the risk management process.

## Class RiskConnectionService

The `RiskConnectionService` acts as a central hub for managing risk checks within your trading system. It makes sure that risk calculations are sent to the right risk management component based on a name you provide.

Think of it as a dispatcher – when a trading signal needs to be checked against risk limits, this service figures out which specific risk checker should handle it.  It remembers which risk checker is responsible for each name, so it doesn't have to recreate them every time, which speeds things up.

You can register signals (when a trade is opened) and deregister them (when a trade is closed) to keep the risk system up-to-date.  If you need to refresh the risk checkers, a `clear` function is available. Strategies that don't have specific risk configurations will use an empty string for their risk name. The service relies on other services to handle logging and defining the structure of risk configurations.

## Class PositionSizeUtils

This class provides helpful tools for figuring out how much of an asset to trade, based on different strategies. It offers pre-built calculations for common position sizing techniques, like using a fixed percentage of your account, applying the Kelly Criterion, or basing the size on Average True Range (ATR). 

Each sizing method is a function that takes information like your account balance, the asset's price, and other relevant data as input. These functions validate the input data to ensure it's appropriate for the chosen sizing method. 

You don't create instances of this class directly; instead, you access its sizing methods directly to calculate position sizes. Essentially, it simplifies the process of determining your trade size by providing ready-to-use calculations.

## Class PersistSignalUtils

This utility class helps manage how trading signals are saved and loaded, particularly for strategies running in live mode. It’s designed to make sure your signal data remains consistent, even if your system crashes unexpectedly.

It automatically handles storing signal data separately for each trading strategy. You can even plug in your own custom storage methods if the built-in options aren’t quite what you need.

The `readSignalData` function retrieves previously saved signal information.  The `writeSignalData` function makes sure signal changes are safely saved to disk.

If you want to use a different way of persisting data, the `usePersistSignalAdapter` function lets you register a custom adapter to handle the storage.

## Class PersistScheduleUtils

This class helps manage how scheduled signals are saved and loaded for your trading strategies. It's designed to be robust, ensuring that your strategies don't lose their state even if something unexpected happens.

The system keeps track of storage locations separately for each strategy, making it easier to organize things. You can even customize how signals are persisted using your own storage adapters.

When your strategy needs to load previously saved scheduled signals, `readScheduleData` retrieves them. If no signal data is found, it returns nothing. Conversely, `writeScheduleData` saves signal information to disk in a way that prevents data corruption if there's a crash.

Finally, `usePersistScheduleAdapter` allows you to integrate your own custom storage solution for even more control over the persistence process.

## Class PersistRiskUtils

This class, PersistRiskUtils, helps manage how active trading positions are saved and loaded, especially for different risk profiles. Think of it as a safe keeper for your trading data, ensuring it's stored reliably even if something unexpected happens.

It keeps track of where to store this data, and you can even customize how it’s stored by using different adapters. The `readPositionData` function retrieves previously saved positions for a specific risk profile, and if nothing’s been saved yet, it returns an empty record. Conversely, `writePositionData` saves the current positions to disk, making sure the process is safe and won't result in corrupted data. 

You can also plug in your own storage method using `usePersistRiskAdapter`, if the default isn't exactly what you need. This class is essential for keeping track of your active trades consistently.

## Class PersistPartialUtils

This class, PersistPartialUtils, helps keep track of partial profit and loss data, ensuring it's saved reliably even if there are unexpected interruptions. It essentially manages where this data is stored for each trading symbol.

It uses a special system for making sure the data isn't corrupted when saving—it writes to the storage atomically, meaning the entire write happens as one complete action.

You can even customize how the data is stored by providing your own persistence adapter. This allows you to use different storage methods beyond the default.

The `readPartialData` function retrieves any previously saved partial data, while `writePartialData` saves the current state. These are vital for restoring and updating the system's memory of how trades are progressing.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing by gathering and analyzing key metrics. It listens for performance events as they happen and keeps track of statistics for each strategy you’re using. 

You can request aggregated performance data for a specific trading symbol and strategy to see things like average results, the best and worst outcomes, and percentile values. The service also creates detailed markdown reports that include an analysis of bottlenecks to help you identify areas for improvement. 

These reports are automatically saved to your logs directory. You have the option to clear all accumulated performance data if needed, and the service makes sure it only initializes once during startup. A logger service is used to output debugging information, and it uses a special system to manage storage for each unique combination of trading symbol and strategy.

## Class Performance

The Performance class helps you understand how your trading strategies are performing. It provides tools to collect and analyze performance data, allowing you to pinpoint areas for improvement.

You can retrieve aggregated statistics for specific symbols and strategies to see key metrics like total duration, average time spent, and volatility. 

The class can also generate comprehensive markdown reports that visualize performance bottlenecks and present detailed statistics in an easy-to-read format. These reports help you quickly identify where your strategy is taking the most time.

Finally, it allows you to save these reports directly to your hard drive, making it simple to track progress and share your findings.

## Class PartialUtils

This class offers tools for examining the details of partial profit and loss events, giving you insights into how your trading strategy is performing. It acts as a central place to gather and display this information, allowing you to analyze partial profits and losses for specific symbols.

You can use it to get summarized statistics like the total number of profit and loss events. It can also produce nicely formatted markdown reports, creating tables showing each individual event with details like action, signal ID, position, price, and timestamp.

Finally, you can easily save these reports to a file so you can review them later or share them. The reports are saved in markdown format, named after the symbol being analyzed (e.g., BTCUSDT.md).

## Class PartialMarkdownService

The PartialMarkdownService helps you track and report on small gains and losses (partial profits and losses) in your trading system. It keeps a record of these events for each symbol you trade, organizing them so you can easily see how they're adding up. 

You can think of it as a tool that automatically creates reports in a readable markdown format, showing you the details of each partial profit or loss. It keeps the data separate for each symbol, and allows you to generate statistics, create reports, and save them as files on your computer.

This service takes care of automatically setting itself up to listen for these profit/loss events, and you generally don't need to worry about manually initializing it. You can also clear the accumulated data if you need to start fresh. The system uses a logger to help with debugging, and it uses a special storage mechanism to ensure that data is handled safely and separately for each trading symbol.

## Class PartialGlobalService

This service acts as a central hub for managing partial profit and loss tracking within your trading system. Think of it as a middleman – it receives requests related to profit, loss, and clearing partial states, logs those actions for monitoring, and then passes them on to the underlying connection service to handle the actual work. 

It's designed to be injected into your trading strategies, providing a standardized way to deal with these partial state changes. The `loggerService` property allows you to easily track what’s happening, and the `partialConnectionService` handles the core logic.

The `profit` and `loss` functions process updates to profit or loss levels, while `clear` handles situations where a signal closes and the partial state needs to be reset. Each function ensures that a log entry is created before forwarding the request for centralized monitoring.

## Class PartialConnectionService

The PartialConnectionService manages how your trading system tracks partial profits and losses for each signal. It's designed to keep things organized and prevent memory issues.

Essentially, it creates a dedicated record (called a ClientPartial) for each unique signal you're tracking. These records are stored in a smart cache, so it doesn't create a new one every time – it reuses existing records for efficiency.

You interact with this service to report profits, losses, or to clear a signal's record when it's finished.  When a signal reaches a profit or loss, this service takes care of updating the associated ClientPartial and letting other parts of your system know. When a signal is closed, it cleans up the record, ensuring a clean and efficient system. This service works behind the scenes, so you don't have to worry about manually creating or cleaning up these records.


## Class OptimizerValidationService

The OptimizerValidationService helps ensure your trading optimizers are properly registered and available for use within the backtest-kit framework. It acts as a central registry, keeping track of all the optimizers you're using.

Adding an optimizer to this service lets you register its details, and it makes sure you don't accidentally register the same optimizer twice.  

You can use the `validate` function to quickly check if an optimizer is registered, and this check is optimized to be fast even if you're doing it frequently. 

If you need to see a list of all the registered optimizers, the `list` function provides that information. It essentially provides a catalog of all your available optimizers.

## Class OptimizerUtils

The OptimizerUtils provides tools to work with strategies created by your optimization processes. You can use it to retrieve data about your strategies, generate the actual code that will execute them, and save that code to files. 

Specifically, `getData` allows you to get information about your strategies, like their performance metrics and configuration.  `getCode` then takes that information and constructs the complete code for the strategy, ready to be run. Finally, `dump` lets you save the generated strategy code directly to a file on your system, creating the necessary directory structure if it doesn’t already exist, and naming the file according to a standard format.

## Class OptimizerTemplateService

This service acts as a foundation for creating code snippets used in backtesting and optimization processes. It handles the generation of various code blocks, including those for data fetching, strategy definition, exchange configuration, and launching the optimization process. 

It’s designed to work with the Ollama LLM, enabling features like multi-timeframe analysis and structured JSON output for trading signals. You can partially customize its behavior through configuration settings.

The service provides code templates for:

*   **Initial setup:** Generates a starting point with imports and constants.
*   **User and assistant prompts:** Creates messages for LLM interactions, helping guide the conversation and acknowledge data.
*   **Strategy comparison (Walker):** Produces code for comparing different trading strategies against each other.
*   **Individual strategy definition:** Generates the code for a single strategy, incorporating LLM insights.
*   **Exchange configuration:** Sets up the connection to a cryptocurrency exchange (using CCXT and Binance).
*   **Timeframe configuration:** Creates code to define the timeframes used in the analysis.
*   **Launching the optimization process:** Generates the code to run the optimization and monitor its progress.
*   **Debugging:**  Includes a function to save conversations and results to a debug folder.
*   **Text and JSON output:** Provides helpers for generating text analysis and structured trading signals in JSON format, following a predefined schema which includes details like position, note, entry/target/stop prices, and expected duration.

## Class OptimizerSchemaService

This service helps you organize and manage the configurations for your optimizers within the backtest-kit framework. It keeps track of your optimizer schemas, ensuring they are properly set up and consistent.

When you want to add a new optimizer configuration, you use the `register` function; it makes sure the necessary details like the optimizer's name and data sources are present.  If you need to adjust an existing configuration, the `override` function lets you modify specific parts of it without completely replacing the original.

Need to find a specific optimizer's settings? The `get` function retrieves it by name. The `validateShallow` function provides a quick check to ensure your optimizer's basic structure is correct, and it looks at fields like the optimizer name, training range, data source and prompt retrieval method. Internally, it uses a registry to store these configurations securely.

## Class OptimizerGlobalService

The OptimizerGlobalService acts as a central hub for interacting with optimizers, ensuring everything is handled correctly before any action is taken. Think of it as a gatekeeper that logs operations and verifies that the optimizer you're trying to use actually exists.

It relies on other services for specific tasks – a logger to keep track of what's happening, a connection service to manage the optimizer itself, and a validation service to confirm its existence.

If you need to retrieve data related to an optimizer, like its metadata, `getData` is your go-to method.  For generating the complete code that executes the strategy, use `getCode`. And finally, `dump` allows you to save the generated strategy code directly to a file. Before any of these actions, the service double-checks that the optimizer you're referencing is valid.

## Class OptimizerConnectionService

OptimizerConnectionService helps you work with different optimizers in a streamlined way. It keeps track of optimizer instances, so you don't have to create new ones repeatedly, which speeds things up. 

This service combines your custom configurations with default settings to create the right optimizer setup. It also allows you to inject a logger for debugging.

The `getOptimizer` method is the key to getting an optimizer – it either finds a cached one or creates a new one based on the optimizer's name.

`getData` pulls together all necessary data and turns it into useful strategy information.  `getCode` assembles complete, runnable code for your strategies. Finally, `dump` lets you save that generated code directly to a file.

## Class LoggerService

The LoggerService helps you keep your trading framework logs organized and informative. It's designed to provide consistent logging across your strategies, exchanges, and backtesting processes. You can think of it as a central hub for all your logging needs.

It automatically adds important details to each log entry, like the name of your strategy, the exchange being used, and even the specific timeframe. This context makes it much easier to understand what's happening when things go wrong.

If you don't configure a specific logger, it will default to a "do nothing" logger, meaning no logs will be generated. However, you can easily customize it by providing your own logger implementation through the `setLogger` function. The service also manages the automatic injection of method and execution contexts, streamlining the logging process even further.

## Class LiveUtils

The LiveUtils class offers helpful tools for running and monitoring live trading sessions. It acts as a central point for interacting with the live trading system, simplifying common tasks.

The `run` method is your primary way to kick off live trading; it creates an ongoing stream of trading results and automatically recovers from crashes by saving and reloading the trading state.

Need to run a live trading session in the background without directly handling the results? The `background` method lets you do just that, perfect for tasks like triggering callbacks or saving data to a database.

You can also retrieve performance statistics using `getData` or generate a detailed markdown report of trading activity with `getReport`. Finally, `dump` allows you to easily save these reports to a file for later review. This class provides a streamlined way to manage and observe your live trading operations.

## Class LiveMarkdownService

The LiveMarkdownService helps you track and analyze your trading strategies in real-time by creating detailed reports. It listens to every tick and records important events like when a strategy is idle, opens a trade, is active, or closes a position.

You’ll get automatically generated markdown tables that break down each event with all the relevant information. It also provides useful trading statistics like win rate and average profit/loss.

Reports are saved as markdown files in the logs/live directory, organized by strategy name, making it easy to review performance. The service handles the directory creation for you.

The `init` function sets everything up initially, ensuring that the service starts listening to trading signals and is automatically called when first used. You can also clear out the accumulated data for a specific strategy or all strategies if needed.

## Class LiveLogicPublicService

This service helps orchestrate live trading, making it easier to manage the context needed for your strategies. Think of it as a convenient layer on top of the core live trading logic.

It automatically handles things like knowing which strategy and exchange you're working with, so you don't have to pass those details around constantly. It provides an endless stream of trading results (both buy and sell signals) as it runs.

If something goes wrong and the process crashes, it can recover the state from disk and pick up where it left off. The `run` method is the main way to start the live trading process for a specific symbol.


## Class LiveLogicPrivateService

This service helps manage live trading by continuously monitoring market data and executing strategies. Think of it as an engine that keeps running, constantly checking for trading opportunities.

It operates using an infinite loop, grabbing the current time and evaluating the strategy to see if any trades need to be opened or closed.  Instead of sending you a huge batch of data, it streams the important changes – only when trades are actually opened or closed – making it efficient for your system.

If something goes wrong and the process crashes, it automatically recovers and picks up where it left off, ensuring continuous trading. The `run` method is the main entry point, and you give it a symbol (like "AAPL") to trade. It returns a stream of results that you can process one by one.


## Class LiveCommandService

This service provides a way to connect your trading strategies with the live market, acting as a central hub for several crucial components. Think of it as a convenient package, simplifying how you inject dependencies related to live trading into your application. 

It bundles together essential services like logging, logic handling, validation (for strategies, exchanges, and risk), and schema management. 

The core functionality is the `run` method, which allows you to kick off live trading for a specific asset (like a stock or cryptocurrency).  It continuously streams trading results – both opened and closed positions – and importantly, includes automatic recovery if things go wrong, so your trading doesn't abruptly stop due to unexpected errors.


## Class HeatUtils

HeatUtils simplifies creating and managing portfolio heatmaps within the backtest-kit framework. It’s designed to give you a clear visual representation of how your strategies are performing across different assets. 

You can easily retrieve aggregated statistics for a specific strategy, which includes detailed information about each symbol's performance, such as total profit/loss, Sharpe ratio, maximum drawdown, and trade count. 

The class allows you to generate a nicely formatted markdown report that presents this data in a table, sorted by total profit. You can also save this report directly to a file on your computer. It handles creating the necessary directories if they don't already exist, so you don’t have to worry about that.


## Class HeatMarkdownService

This service helps you visualize and analyze your trading performance with a portfolio heatmap. It gathers information from closed trades, organizing it by strategy and individual symbols. 

You can think of it as a reporting tool that automatically builds tables showing key metrics like total profit/loss, Sharpe Ratio, and maximum drawdown for each strategy and each asset you're trading. It’s designed to handle unusual or missing data gracefully, preventing errors.

The service keeps track of data for each strategy separately, and provides functions to retrieve the data, generate markdown reports, and even save those reports to disk. It also initializes automatically when you first use it, so you don't need to worry about setup. Finally, you can clear the accumulated data if you need to start fresh or want to free up resources.

## Class FrameValidationService

This service helps ensure your trading frames are set up correctly within the backtest-kit. Think of it as a quality control system for your data structures.

You can use it to register the expected structure of each frame – essentially, telling the service what data you expect to see.  The `addFrame` method is how you register these expected structures.

The `validate` method checks if a particular frame actually conforms to the registered schema. It's a quick way to catch errors early on. 

If you need to see what frames are currently registered, the `list` method gives you a list of all the schemas you've added. The service uses a `loggerService` to report any validation issues.

## Class FrameSchemaService

The FrameSchemaService acts as a central place to store and manage the blueprints, or schemas, that define the structure of your trading data frames. It uses a system that ensures type safety, making sure your schemas are consistent. 

You can add new schemas using the `register` method, and update existing ones with `override`. If you need to access a specific schema, the `get` method allows you to retrieve it by name. 

Before a schema is added, it's checked for essential properties with `validateShallow`, preventing errors later on. The service keeps track of everything internally and provides a straightforward way to work with your frame schemas.

## Class FrameGlobalService

This service handles the behind-the-scenes work of getting the timeframes your backtest needs. It relies on a connection to your data source and a way to validate the data it receives. 

Think of it as the engine that produces the sequence of dates your trading strategy will be tested against. 

The `getTimeframe` method is the main function you'd be interested in; it takes a symbol (like "BTCUSDT") and a timeframe name (like "1h" for one-hour candles) and returns an array of dates representing those time periods. It's the core of time-based backtesting.

## Class FrameConnectionService

The FrameConnectionService acts as a central hub for handling different trading frames, like minute, hourly, or daily data. It intelligently directs requests to the correct frame implementation based on the currently active trading context.

To improve efficiency, the service remembers previously created frame instances, so it doesn't need to recreate them every time you need them.

You can get a specific frame using `getFrame`, providing its name, and the service will provide you with a ready-to-use frame object. 

The `getTimeframe` method is helpful during backtesting; it allows you to define the start and end dates for your historical data analysis. It fetches those timeframe boundaries from your frame configuration. In live trading, there aren't specific frames, so the frameName will be an empty string.

The service relies on other components, including a logger, schema service, and method context service, to function correctly.

## Class ExchangeValidationService

The ExchangeValidationService helps ensure your trading strategies are compatible with different exchanges. Think of it as a central registry for exchange details. 

You can add exchange schemas to it using the `addExchange` method, specifying the exchange's name and its structure. 

To confirm an exchange is properly registered, use the `validate` method.  If you need to see all the exchanges currently registered, the `list` method provides a simple way to retrieve them. The `loggerService` property offers access to logging functionality, and `_exchangeMap` stores the exchange schemas internally.

## Class ExchangeSchemaService

The ExchangeSchemaService helps you keep track of the information about different exchanges you're working with in your backtesting system. It acts as a central place to store and manage these exchange details in a safe and organized way.

You can add new exchange schemas using `addExchange()`, and retrieve them later by their name using `get()`. Before adding an exchange, `validateShallow()` checks if it has all the necessary information. 

If you need to update an existing exchange schema, `override()` lets you modify specific parts of it without having to redefine the whole thing. Think of it as a way to keep your exchange definitions consistent and up-to-date.

## Class ExchangeGlobalService

The ExchangeGlobalService acts as a central hub for interacting with an exchange, making sure operations always have the right context – things like the trading symbol, the specific time, and whether it’s a backtest or live trading scenario. It combines a connection to the exchange with tools for managing this context.

Inside, it has components to handle logging, connecting to the exchange, managing execution context, and validating exchange settings. The validation process is designed to be efficient, only running when necessary.

The service offers methods for retrieving historical candle data, fetching future candle data (specifically for backtesting), calculating average prices, and formatting prices and quantities – all while incorporating the relevant execution context. This makes it a crucial part of the backtesting and live trading logic.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It handles the complexities of routing your requests to the correct exchange implementation behind the scenes, so you don't have to manage that directly. 

It remembers which exchange implementations it has already created, which speeds things up when you need to use them repeatedly. This service provides a consistent way to fetch historical candle data, get the next batch of candles based on your backtest or live trading timeline, retrieve the current average price, and format prices and quantities to match the specific requirements of each exchange. Essentially, it simplifies your interactions with various exchanges, ensuring that your requests are properly formatted and handled.

## Class ConstantUtils

This class provides a set of pre-calculated constants designed to help you manage your take-profit and stop-loss levels in a trading strategy. These values are based on the Kelly Criterion and incorporate a system of exponential risk decay, aiming for a balanced approach to risk management. 

The constants represent percentages of the total distance between your initial entry point and your ultimate take-profit or stop-loss targets. For example, `TP_LEVEL1` is set at 30%, meaning it triggers when the price reaches 30% of the way to your final take-profit goal.  `TP_LEVEL2` is 60%, and `TP_LEVEL3` is 90%, allowing for incremental profit-taking along the way.

Similarly, `SL_LEVEL1` (40%) and `SL_LEVEL2` (80%) provide levels to automatically adjust your stop-loss, helping to protect your capital and reducing potential losses as the market moves against you.  These constants give you a quick and easy way to incorporate a structured, risk-aware strategy into your trading system.

## Class ClientSizing

This component handles determining how much of your capital to use for each trade. It provides several different sizing methods, like fixed percentages, the Kelly Criterion, and using Average True Range (ATR) to account for volatility. You can also set limits on the minimum and maximum position sizes, as well as a maximum percentage of your capital that can be used.

It's designed to be flexible, allowing you to add your own validation and logging steps to the sizing process. Essentially, it takes the signals from your trading strategy and translates them into concrete trade sizes. 

The `calculate` method is the core of the sizing logic, taking parameters related to the trade and returning the calculated position size.

## Class ClientRisk

This class helps manage risk for your trading portfolio, especially when using multiple strategies at once. Think of it as a safety net that prevents your strategies from taking on too much risk simultaneously.

It tracks all open positions across your strategies, allowing for a broader view of your portfolio's risk exposure. The `ClientRisk` class can enforce limits, such as a maximum number of concurrent positions.

You can also create custom risk checks to implement more complex validation rules, accessing all currently open positions to make informed decisions. The system prevents signals from being executed if they violate these configured limits.

This class handles the loading and saving of position data, ensuring it’s initialized correctly and persists between sessions (unless you're running in backtest mode). When a strategy wants to open or close a position, it communicates with this class to make sure it’s allowed to proceed. The `addSignal` and `removeSignal` methods are used to register and unregister those position changes.

## Class ClientOptimizer

The `ClientOptimizer` helps you run optimization processes, acting as a bridge between your optimization service and the actual data and code generation. It gathers data from various sources, handles pagination to manage large datasets, and keeps track of conversation history for use with LLMs.

This class is responsible for building the strategy code itself, combining imports, helper functions, the core strategy logic, and everything needed for execution. You can request the complete code as a string or ask it to generate and save the code to a file, automatically creating necessary directories if they don’t already exist.

The `ClientOptimizer` also lets you monitor the progress of the optimization process, providing updates as data is fetched and code is generated. It works in conjunction with `OptimizerConnectionService` to create and manage optimization instances.

## Class ClientFrame

The ClientFrame is responsible for creating the timeline of data your backtest uses – essentially, it figures out when each trade or calculation should happen. It makes sure this timeline isn’t recalculated unnecessarily by remembering previous results, which speeds things up considerably. 

You can tell it how far apart each data point should be, ranging from one minute to three days. 

It also lets you hook in your own functions to check the data it generates or to keep track of what’s happening during the timeline creation. This component works closely with the core backtesting engine to drive the historical simulation. 

The `getTimeframe` method is the key here - it's what actually produces the array of dates that define your backtest's period, and it uses caching to optimize performance.

## Class ClientExchange

This class provides a way to interact with an exchange, specifically designed for backtesting scenarios. It allows you to retrieve historical and future candle data, which is essential for simulating trading strategies. You can fetch past data to analyze how a strategy would have performed, and look ahead to get data needed for signal duration during backtesting. 

It also includes a function to calculate the VWAP, a volume-weighted average price, which can be helpful for understanding price trends and executing orders. Finally, it provides convenient methods to format quantities and prices to match the exchange's specific requirements. All of these functions are optimized for efficient memory usage.

## Class BacktestUtils

The BacktestUtils class offers helpful tools for running and analyzing backtests within the framework. It's designed to be easily accessible throughout your code.

The `run` method allows you to execute a backtest for a specific trading symbol, providing logging and context information to guide the process.  You'll get back a stream of results as the backtest progresses.

For situations where you just want to trigger a backtest without needing to see the results directly, the `background` method runs the backtest in the background, useful for tasks like logging or callbacks.

Need summaries of past performance? `getData` retrieves statistical information about previously completed backtests for a specific symbol and strategy.  `getReport` generates a nicely formatted markdown report summarizing the results of those backtests. Finally, `dump` lets you save these reports directly to a file.

## Class BacktestMarkdownService

This service is designed to automatically create detailed reports about your backtesting results. It keeps track of closed trading signals for each strategy you use, neatly organizing them for analysis. 

The service listens for updates during your backtest and gathers information about each closed trade. It then transforms this information into easy-to-read markdown tables, which are saved as files. You can think of it as an automated way to document your trading experiments.

You can trigger report generation for specific symbol and strategy combinations, or clear all accumulated data when you're finished. The service also handles the initial setup, so you don’t have to worry about manually subscribing to events – it does that automatically when you first start using it. It keeps data separate for each symbol and strategy, preventing interference between different tests.

## Class BacktestLogicPublicService

This service simplifies running backtests by automatically managing the context needed by your strategies. Think of it as a helper that takes care of passing along information like the strategy's name, the exchange being used, and the timeframe, so you don't have to worry about it in your code. 

It works by wrapping another internal service and injecting this context behind the scenes. You give it a symbol to backtest, and it returns a stream of results – each one representing the outcome of a trading decision. It’s designed to make your backtesting process cleaner and easier to manage. 

The `run` method is the core of this service, handling the entire backtest execution and providing results as a stream.

## Class BacktestLogicPrivateService

This service helps orchestrate the backtesting process, especially when dealing with a lot of data. It breaks down the backtest into smaller steps, pulling timeframes and processing signals one at a time.

Think of it as a pipeline: it retrieves the necessary data, handles signals (opening and closing positions), and then streams the results back to you in a continuous flow rather than building up a massive list in memory. 

You can easily stop the backtest process early if you need to, just by interrupting the stream.

The service relies on other services like the frame service to get the timeframes, and it needs to know about your trading strategy and exchange to function correctly. 

The `run` method is the main entry point – you provide the symbol you want to backtest and it returns an asynchronous generator that yields the results as closed signals.

## Class BacktestCommandService

The BacktestCommandService acts as a central point for accessing backtesting capabilities within the system. Think of it as a helper that makes it easy to inject dependencies and interact with the core backtesting logic. 

It bundles together several key services, like those for handling strategy schemas, risk validation, and interactions with the backtest logic itself. 

The main function you'll use is `run`, which allows you to execute a backtest for a specific trading symbol. When you run a backtest, you provide information about the strategy, exchange, and data frame you want to use. The `run` method then returns the backtest results step-by-step.


# backtest-kit interfaces

## Interface WalkerContract

The WalkerContract helps you track the progress of your backtest kit as it compares different trading strategies. It provides updates on each strategy's completion, including its name, the exchange and frame it's being tested on, and the symbol it's trading.

You’re given key performance statistics for each strategy, along with the specific metric being optimized and its current value.  The contract also keeps track of the best-performing strategy seen so far, along with its metric value, and lets you know how many strategies have been tested versus the total number you’re running.  Essentially, it’s your window into the comparison process, letting you see how the strategies are stacking up as they're evaluated.

## Interface TickEvent

This interface, TickEvent, brings together all the data you need to understand what's happening in your backtest. Think of it as a single, consistent package of information for every tick event – whether it’s the start of a trade, a trade that’s actively running, or a trade that’s finished.

Each TickEvent has a timestamp, clearly marking when it occurred.  You'll find details about the action being taken: idle, opened, active, or closed. For trades that are active, you'll see the trading pair's symbol, the signal ID, the type of position, and any associated notes.  Opened and active trades also provide the open price, take profit, and stop loss levels.  When a trade closes, you're provided with the profit and loss percentage, the reason for closing, and the total duration of the trade. This centralized data makes it much easier to analyze and generate reports on your trading activity.

## Interface ScheduleStatistics

This interface holds all the key statistics related to how your scheduled signals are performing. It lets you see a complete picture of events, whether they were scheduled or cancelled.

You'll find a detailed list of all scheduled and cancelled events in the `eventList` property. The `totalEvents` tells you the total number of signals, while `totalScheduled` and `totalCancelled` give you the individual counts. 

The `cancellationRate` is a really important metric – it shows you the percentage of signals that were cancelled, and a lower rate generally indicates better performance.  Finally, `avgWaitTime` helps you understand how long cancelled signals were waiting before being cancelled, which can highlight potential bottlenecks in your system.

## Interface ScheduledEvent

This interface holds all the important details about scheduled and cancelled trading signals, making it easy to generate reports and analyze performance. Each event, whether it was planned or later cancelled, is represented with a timestamp indicating when it occurred. You’ll find information like the trading symbol, a unique signal ID, and the type of position that was opened.

It also includes details about the price at which the trade was intended to enter, the take profit and stop loss levels, and, if the event was cancelled, the time and duration of the position. The current market price at the time of the event is also recorded for context. Essentially, it’s a complete package of data for understanding how and when signals were handled.

## Interface ProgressWalkerContract

The `ProgressWalkerContract` provides updates as a background process, like a backtesting run, is happening. It lets you monitor how many strategies are being evaluated, what exchange and frame are being used, and the overall progress of the operation. You'll see the name of the walker, the exchange, the frame, and the symbol being traded. The information includes the total strategies to be processed, the number already completed, and a percentage representing how far along the process is. Essentially, it's a way to peek into what’s happening behind the scenes during a backtest or similar analysis.

## Interface ProgressOptimizerContract

This interface lets you keep tabs on how an optimizer is doing while it's running. It provides updates on the optimizer's name, the trading symbol it's working with, and the overall progress. 

You're given the total number of data sources the optimizer needs to handle, and a counter showing how many have already been processed. Finally, a percentage value tells you exactly how far along the optimizer is, ranging from 0% to 100%. This allows you to monitor and potentially react to the optimizer’s execution in real-time.

## Interface ProgressBacktestContract

This interface helps you keep an eye on how your backtest is running. It provides updates as the backtest progresses, letting you know which exchange and strategy are being tested, and the trading symbol involved. You’ll see information about the total number of historical data points being analyzed, how many have already been processed, and the overall percentage of completion. This allows you to monitor the backtest’s advancement and estimate its remaining duration.

## Interface PerformanceStatistics

This interface bundles together all the key performance data collected during a backtest. It helps you understand how a trading strategy performed. 

You'll find the strategy's name, the total number of events that triggered performance recording, and the total time it took to calculate these statistics. 

The `metricStats` property is a crucial element; it breaks down the statistics by specific metric types, allowing for detailed analysis. Finally, the `events` array holds all the individual performance events captured, providing raw data for even deeper investigation.

## Interface PerformanceContract

This interface helps you keep track of how long different parts of your trading system take to execute. Think of it as a way to profile your code and find areas that might be slowing things down. Each time a significant action happens – whether it's part of your trading strategy or interacting with an exchange – a `PerformanceContract` is created. 

It captures when the action started (`timestamp`), how long it took (`duration`), and important context like the name of your strategy, the exchange being used, and the trading symbol involved.  The `previousTimestamp` allows you to see the time difference between successive events, offering a clearer picture of performance trends. Knowing if the event happened during a backtest or live trading is also included to distinguish different performance characteristics.

## Interface PartialStatistics

This interface helps you track the results of your trading strategy as it makes partial adjustments. It gathers key information about each profit and loss event, storing them as a list of detailed events. You'll also find the total count of all events, the number of profitable trades, and the number of losing trades. Think of it as a snapshot of performance when breaking down a trade into smaller steps.

## Interface PartialProfitContract

This interface represents a notification when a trading strategy hits a partial profit milestone. Think of it as a record of when a trade has reached, say, a 20% profit.

It provides key information about the event, including the trading symbol (like BTCUSDT), the full details of the signal that triggered the trade, the price at which the profit level was achieved, and the specific profit level reached (10%, 20%, etc.).

You’re also told whether the event occurred during a backtest (historical data) or live trading. 

A timestamp tells you exactly when this profit level was detected, whether it was from a live tick or a backtest candle. This is helpful for tracking and analyzing strategy performance.

## Interface PartialLossContract

This interface describes what happens when a trading strategy experiences a partial loss, like hitting a -10%, -20%, or -30% drawdown. It's a way to keep track of how much a strategy is losing and when those loss levels are triggered.

Each event includes details like the trading pair involved, all the information about the specific trade, the current price at the time of the loss, and the percentage loss level that was reached.  You’re also told if the event came from a backtest (historical data) or a live trading session. The timestamp indicates exactly when the loss level was detected – either the moment of a live tick or the end of the candle in a backtest.  These events are useful for generating reports or for custom alerts based on drawdown levels. The loss level itself is represented as a positive number, with 20 representing a -20% loss.

## Interface PartialEvent

This interface, `PartialEvent`, is designed to provide a consistent way to track profit and loss milestones during trading, whether you're running a test or live trading. It collects key details about each event, like when it happened (`timestamp`), whether it's a profit or loss (`action`), and which asset was involved (`symbol`). You’ll also find information about the signal that triggered the trade (`signalId`), the position type (`position`), the price at the time of the event (`currentPrice`), and the profit/loss level that was reached (`level`). A flag indicates whether the event occurred during a backtest or in a live trading environment (`backtest`).

## Interface MetricStats

This interface holds the compiled statistics for a particular performance metric, like order execution time or fill latency. It bundles together several key measurements to give you a complete picture of how that metric behaved during your backtest.

You'll find details like the total number of times the metric was recorded, the total time it took across all those instances, and then a breakdown of more descriptive statistics. These include the average, minimum, and maximum values, along with a measure of how spread out the data is (standard deviation). Percentiles like the 95th and 99th will help you understand the duration observed in the vast majority of cases.  Finally, it includes timing information related to the wait time between events, revealing patterns in how long things take to happen sequentially.

## Interface MessageModel

This `MessageModel` represents a single turn in a conversation with an LLM, like a question you ask or a response you receive. It’s a core building block used within the backtest-kit framework, particularly in the Optimizer, to structure prompts and keep track of the ongoing conversation history. Each message has a `role`, which tells you who sent it – whether it's a system instruction, your input as the user, or the LLM’s reply.  The `content` property simply holds the actual text of that message.

## Interface LiveStatistics

This interface provides a collection of statistical data reflecting your live trading performance. You're given a detailed event list, along with counts for total events, closed signals, and breakdowns of winning and losing trades. Key performance indicators like win rate, average PNL, and total PNL are included, allowing you to easily gauge profitability. Volatility is measured through standard deviation, and the Sharpe Ratio and annualized Sharpe Ratio offer insights into risk-adjusted returns. Finally, the certainty ratio and expected yearly returns offer further dimensions for evaluating your trading strategy. All numerical values are carefully managed to avoid unsafe calculations.

## Interface IWalkerStrategyResult

This interface represents the outcome of running a trading strategy within the backtest framework. Each strategy run generates a result containing its name, a detailed set of performance statistics, a key metric value used for comparison, and a rank reflecting its overall performance relative to other strategies being tested. The rank indicates how well the strategy performed—a lower rank number signifies a better result. This structure allows for clear and organized comparison of different strategies.

## Interface IWalkerSchema

The IWalkerSchema defines how you set up A/B testing for different trading strategies within your backtest. Think of it as a blueprint for comparing how various strategies perform against each other. 

You’ll give each test a unique identifier with `walkerName`, and can add a helpful note with `note` for your own records.  The `exchangeName` specifies which exchange all the strategies in the test will use, and `frameName` determines the timeframe used for analysis.

Crucially, the `strategies` property lists the names of the strategies you want to compare – these strategies must have been registered beforehand. You can also select a `metric` like Sharpe Ratio to optimize, and optionally provide `callbacks` for specific events during the testing process.

## Interface IWalkerResults

The `IWalkerResults` object holds all the information gathered after a complete run of the strategy optimization process. It tells you which strategy walker was used, what symbol was being tested, and on what exchange and timeframe. 

You'll find details about the optimization metric used, the total number of strategies that were evaluated, and, most importantly, the name of the best-performing strategy found. 

It also stores the actual metric value achieved by that best strategy, along with the full set of statistics detailing its performance. This gives you a complete picture of the optimization results.

## Interface IWalkerCallbacks

This interface provides a way to hook into the backtest-kit's strategy comparison process. Think of it as a set of optional event listeners you can use to monitor and react to what’s happening during the backtesting.

You can use `onStrategyStart` to know when a new strategy’s testing begins, providing its name and the trading symbol.  `onStrategyComplete` lets you be notified when a strategy’s testing is finished, along with key performance statistics and a calculated metric. If a strategy encounters a problem during testing, `onStrategyError` will alert you with details about the error. Finally, `onComplete` is called once all strategy tests are finalized, and it provides access to the overall results of the entire comparison.


## Interface IStrategyTickResultScheduled

This interface represents a scheduled trading signal that your strategy has generated. It's used when your strategy's `getSignal` function returns a signal that includes a price target, and the framework is now waiting for the actual price to reach that target.

Essentially, it's a notification that a trade is "on hold" pending price action.

The `action` property confirms this is a scheduled signal, while the `signal` property holds the details of that signal itself. You'll also find the strategy and exchange names, the trading symbol, and the price at which the signal was initially generated – all for tracking and analysis purposes.

## Interface IStrategyTickResultOpened

This interface represents the data you receive when a new trading signal is created within your backtesting strategy. Think of it as a notification that a signal has just been generated and is ready to be used. 

It provides key information about the signal, including the strategy that created it, the exchange it’s associated with, the trading symbol (like BTCUSDT), the current price when the signal was opened, and the signal data itself. The `action` property simply tells you that this is a signal opening event, helping to differentiate it from other signal-related events. This information is crucial for monitoring your strategy's performance and debugging any issues.


## Interface IStrategyTickResultIdle

When a trading strategy isn't actively giving signals, it enters an "idle" state, and this `IStrategyTickResultIdle` interface describes what that looks like. It confirms that no action is being taken ("idle") and that there's no signal currently active.  The interface also includes helpful information like the name of the strategy, the exchange being used, the trading symbol (like BTCUSDT), and the current price at the time the strategy was idle. This data can be useful for monitoring strategy behavior and understanding when it's not making trades.

## Interface IStrategyTickResultClosed

This interface, `IStrategyTickResultClosed`, represents what happens when a trading signal is closed, giving you a complete picture of the outcome. It bundles together all the essential data related to the closure, including the original signal parameters, the final price at which the trade was closed, and the reason for the closure – whether it was due to a time limit expiring, a take-profit being reached, or a stop-loss being triggered. 

You’ll also find detailed profit and loss information here, factoring in fees and slippage, alongside the names of the strategy and the exchange used. Finally, it specifies the trading symbol, making it easy to identify exactly which asset was traded. This is the go-to data structure when you want to examine a closed trade in detail.


## Interface IStrategyTickResultCancelled

This interface describes what happens when a scheduled trading signal is cancelled. It’s used to communicate that a signal didn't result in a trade being placed, perhaps because it was deactivated or triggered a stop-loss before an entry could be made. 

The record contains details about the cancelled signal itself, including the signal row data, the final price at the time of cancellation, and timestamps for when the cancellation happened. You’ll also find information to identify the strategy and exchange involved in the cancellation, alongside the symbol being traded. Essentially, it provides a clear log of why a planned action didn’t proceed.


## Interface IStrategyTickResultActive

This interface represents a tick result in the backtest-kit framework when a trading signal is actively being monitored. It signifies that the system is waiting for a trade to be closed, either through a Take Profit (TP), Stop Loss (SL), or time expiration. 

The `action` property simply confirms that the signal is in the "active" state. 

You're given the `signal` data – the details of the trade – alongside the `currentPrice`, which is used to track the VWAP price relevant to the active trade.  For reference, the `strategyName`, `exchangeName`, and `symbol` properties provide context about which strategy, exchange, and trading pair are involved in this active monitoring.

## Interface IStrategySchema

This interface, `IStrategySchema`, describes how you define and register your trading strategies within the backtest-kit framework. Think of it as the blueprint for how your strategy will generate trading signals. 

Each strategy needs a unique `strategyName` to be recognized. You can also add a `note` to provide helpful documentation for yourself or others. 

The `interval` property helps regulate how frequently your strategy attempts to generate signals, preventing overwhelming the system.

The core of the strategy is the `getSignal` function. This is where your trading logic resides, determining whether to buy, sell, or do nothing. It takes a symbol and a timestamp as input and returns a signal, or nothing if no action is needed. It's also cleverly designed to handle price-based signals, waiting for a price to reach a certain level.

You can also provide optional `callbacks` to react to certain events like when a trade opens or closes. Finally, a `riskName` allows you to associate your strategy with a particular risk profile for more comprehensive risk management.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the result of a profit and loss calculation for a trading strategy. It gives you a clear picture of how much your strategy gained or lost, taking into account realistic factors like trading fees and slippage – those little costs that always eat into profits.

The `pnlPercentage` tells you the profit or loss as a percentage, making it easy to compare performance across different strategies or time periods.  You'll see a positive number for gains and a negative number for losses.

The `priceOpen` property shows the actual price at which your strategy entered a trade, factoring in those fees and slippage.  Similarly, `priceClose` displays the exit price after those adjustments are applied, letting you see the true realized price.

## Interface IStrategyCallbacks

This interface provides a way to hook into different stages of a trading strategy's lifecycle. You can register functions to be executed when specific events occur, like when a new signal is opened, becomes active, or is closed.

Here’s a breakdown of the events you can react to:

*   **onTick:** This function gets called with every tick, giving you a continuous stream of market data.
*   **onOpen:** Triggered immediately after a signal has been validated and is being opened for trading.
*   **onActive:** This gets invoked while a signal is being actively monitored.
*   **onIdle:** Notifies you when there are no active signals being monitored.
*   **onClose:** Called when a signal is closed, providing the closing price.
*   **onSchedule:** This event signifies the creation of a scheduled signal, used for delayed entries.
*   **onCancel:** Happens when a scheduled signal is canceled before a position is opened.
*   **onWrite:** Used for persisting signal data, primarily for testing purposes.
*   **onPartialProfit:**  Alerts you when a position has reached a partial profit level, but hasn't hit the target price.
*   **onPartialLoss:** Signals that a position has encountered a partial loss, but the stop-loss hasn't been triggered. 

By implementing these callbacks, you gain granular control and visibility into your strategy’s behavior.

## Interface IStrategy

The `IStrategy` interface outlines the essential functions a trading strategy needs to function within the backtest-kit framework.

The `tick` method represents a single step in the strategy's execution, handling things like VWAP updates, signal generation, and checking for take profit or stop-loss conditions.

`getPendingSignal` lets you check if a strategy has an active signal waiting to be acted upon. This is helpful for keeping track of pending orders and their conditions.

The `backtest` method allows for quick simulations using historical data to see how a strategy would have performed. It runs through the candle data, recalculates VWAP, and evaluates potential take profit/stop-loss triggers.

`stop` provides a way to pause a strategy's signal generation. This doesn't immediately close existing positions but prevents new signals from being created, useful for controlled shutdowns.

## Interface ISizingSchemaKelly

This interface defines how to size trades using the Kelly Criterion, a method for determining optimal bet sizes based on expected return. When implementing this sizing schema, you're essentially telling the backtest-kit how aggressively you want to size your trades. The `kellyMultiplier` property controls this aggression – a lower number, like the default of 0.25, signifies a more conservative quarter Kelly approach, while higher values increase the size of each trade relative to your account balance. This parameter allows you to fine-tune your risk management within the backtest framework.

## Interface ISizingSchemaFixedPercentage

This schema lets you define a trading strategy where the size of each trade is based on a fixed percentage of your available capital. It's straightforward to use - you simply specify a `riskPercentage`, which represents the maximum percentage of your capital you're willing to risk on each individual trade. This percentage is used to calculate the trade size automatically. The `method` property is always set to "fixed-percentage" to identify this specific sizing approach.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, provides a foundational structure for defining how much of your account to use for each trade. Think of it as a blueprint for sizing your positions. 

It includes essential properties like `sizingName`, which is a unique identifier for this sizing strategy, and a `note` field for developers to add clarifying information. You’ll also find settings to control position size: `maxPositionPercentage` limits the maximum exposure as a percentage of your total account value, while `minPositionSize` and `maxPositionSize` define absolute minimum and maximum position sizes.  Finally, `callbacks` allows you to hook into different points in the sizing process if you need to customize it further.

## Interface ISizingSchemaATR

This schema helps you define how much of your capital to risk on each trade using the Average True Range (ATR) as a key factor. 

It lets you specify a `riskPercentage`, which is the portion of your available capital you're willing to risk on each individual trade, expressed as a percentage. 

You also use an `atrMultiplier` to calculate the stop-loss distance, essentially scaling the ATR value to determine how far away your stop should be from the entry price. This helps dynamically adjust your stop-loss based on market volatility.


## Interface ISizingParamsKelly

This interface, `ISizingParamsKelly`, helps you control how much capital your trading strategy uses for each trade when using the Kelly Criterion. It's designed for the `ClientSizing` component within backtest-kit.

You're required to provide a `logger` object, which is used to output debugging information and track the sizing calculations. This allows you to monitor and understand how your strategy's size is being determined. Think of it as a way to peek under the hood and ensure the sizing is behaving as expected.

## Interface ISizingParamsFixedPercentage

This interface, `ISizingParamsFixedPercentage`, helps you define how much of your capital you're going to use for each trade when using a fixed percentage sizing strategy. It's all about controlling your risk.

You'll use it when setting up your trading system using `ClientSizing`. 

The `logger` property is important; it's where you can connect a logging service to help you monitor and debug your sizing calculations—essential for understanding what your system is doing.

## Interface ISizingParamsATR

This interface defines the settings you can use when your trading strategy determines how much to trade based on the Average True Range (ATR). It’s all about controlling the sizing of your trades using ATR as a key indicator.

The `logger` property lets you hook in a logging service, which is useful for debugging and understanding how the ATR-based sizing is behaving. This helps you track what's happening under the hood and make adjustments if necessary.

## Interface ISizingCallbacks

This interface lets you tap into the sizing process of your backtest. Specifically, `onCalculate` is a function you provide that gets called immediately after the framework determines how much to buy or sell. Think of it as a notification; it’s handy if you want to see the calculated size for debugging, or to make sure it aligns with your expectations. You'll receive the planned quantity and some additional parameters related to the sizing calculation.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate position sizes using the Kelly Criterion. 

Think of it as a recipe for determining how much of your capital to risk on each trade. 

You’re essentially providing the framework with your win rate – the percentage of profitable trades – and your average win-loss ratio, which represents how much you typically make compared to how much you lose on a single trade. These two values are crucial inputs for the Kelly Criterion formula to calculate an optimal bet size.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate trade sizes using a fixed percentage of your capital. It's a straightforward way to determine how much to trade based on a predetermined percentage. You're required to specify the method used, which must be "fixed-percentage," and you also need to provide a `priceStopLoss` value. This `priceStopLoss` represents the price level at which you’ll place a stop-loss order.

## Interface ISizingCalculateParamsBase

This interface provides the foundational information needed for any sizing calculation within the backtest-kit framework. Think of it as the basic set of data shared by all strategies when determining how much to trade.

It includes the trading symbol – like "BTCUSDT" – so the system knows which asset is involved. You'll also find the current account balance, which is essential for risk management. Finally, it provides the planned entry price, which helps calculate the size of the position.

## Interface ISizingCalculateParamsATR

This interface defines the information needed to calculate trade sizes using an ATR (Average True Range) based method. When you're using the ATR sizing approach within backtest-kit, you're essentially telling the system you want to determine your position size based on the current ATR value. The `method` property must be set to "atr-based" to indicate you're using this specific sizing technique, and the `atr` property holds the actual ATR value that will be factored into the sizing calculation.

## Interface ISizing

The `ISizing` interface is all about figuring out how much to trade – essentially, the size of your positions. It’s a core part of how backtest-kit executes trading strategies.

The key piece of this interface is the `calculate` function. This function takes in a set of parameters that define your risk profile and market conditions, and it returns a number representing the position size it recommends. Think of it as the engine that translates your risk tolerance and market data into concrete trading amounts.

## Interface ISignalRow

This interface, `ISignalRow`, represents a complete trading signal ready for use within the backtest-kit framework. Think of it as the finalized version of a signal after it's been checked and prepared. Each signal gets a unique identifier, a universally recognized code, ensuring it’s easily tracked throughout the trading process.

It contains all the critical information you need, from the initial entry price and the exchange used to execute the trade, to the name of the strategy that generated it.  You'll also find a timestamp marking when the signal was originally scheduled and another indicating when it became an active, pending position.  The `symbol` property clearly identifies the trading pair, like "BTCUSDT," and an internal flag notes whether the signal was initially scheduled.


## Interface ISignalDto

The `ISignalDto` represents a trading signal, essentially a set of instructions for making a trade. It defines what information is needed to create a signal, like whether you should buy ("long") or sell ("short"), your reasoning for the trade, the entry price, and target prices for taking profit and limiting losses. A unique ID will automatically be generated for each signal. The `minuteEstimatedTime` property lets you specify how long you expect the trade to last before it expires.

## Interface IScheduledSignalRow

This interface, `IScheduledSignalRow`, represents a signal that’s waiting for the market to reach a specific price before being triggered. Think of it as a signal that’s "on hold" until a certain price level is hit. It builds upon the basic `ISignalRow` structure.

When the market price reaches the `priceOpen` value, this scheduled signal transforms into a regular pending signal. Importantly, the `pendingAt` time will initially match the `scheduledAt` time and later updates to the actual time the signal started pending. The `priceOpen` property defines that crucial target price.

## Interface IRiskValidationPayload

This structure holds the information needed to evaluate risk, specifically focusing on your active positions. Think of it as a snapshot of what's currently happening in your portfolio. It includes the total number of positions you're holding and a detailed list of each active position, giving you all the details you need for risk assessment. Having this data allows your risk validation functions to make informed decisions about your trading strategy.

## Interface IRiskValidationFn

This defines a special function that helps ensure your trading strategies are set up correctly and safely. Think of it as a safety check – it examines the risk parameters you're using (like how much capital you're risking) and verifies they meet certain conditions. If those conditions aren't met, the function will raise an error, stopping your backtest and letting you know there’s a problem before things go wrong. It’s designed to prevent potentially disastrous trades during your testing phase.


## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define rules to make sure your trading strategies are safe and sound. It's all about setting up checks on your risk parameters. 

You'll use the `validate` property to write a function that actually performs the risk validation – this is where you put the logic to examine your parameters.  The `note` property is a handy place to add a short explanation of why you're doing this validation, making it easier to understand later. Think of it as adding a helpful comment for yourself and anyone else using your code.

## Interface IRiskSchema

The `IRiskSchema` interface helps you define and manage risk controls for your trading strategies. Think of it as a blueprint for how you want to protect your portfolio. 

Each schema has a unique `riskName` to easily identify it, and you can add a `note` to explain its purpose for other developers.  

You can optionally provide `callbacks` for events like when a trade is rejected or allowed, giving you more control over the risk management process.  

Most importantly, the `validations` array is where you put the custom rules that determine whether a trade is acceptable, allowing you to build sophisticated risk logic. This array holds functions or pre-defined risk validation objects that enforce your specific constraints.

## Interface IRiskParams

The `IRiskParams` interface defines the information needed when setting up a risk management system within the backtest-kit framework. Think of it as the blueprint for configuring how risk is handled during your trading simulations. 

It primarily focuses on providing a way to log important events and debugging information. Specifically, it requires a `logger` – a service that allows you to record messages and track what’s happening during your backtesting process. This helps you understand and troubleshoot your trading strategies.

## Interface IRiskCheckArgs

The `IRiskCheckArgs` interface holds the data needed to determine if a trading strategy should be allowed to generate new signals. Think of it as a safety check performed before a trade is even considered. 

It provides essential information like the trading pair's symbol, the name of the strategy making the request, the exchange being used, the current price, and a timestamp. This data allows you to implement custom risk management rules and ensure trades align with your overall strategy and risk tolerance. It's a straightforward way to validate conditions before the trading process begins.

## Interface IRiskCallbacks

This interface provides a way to get notified about what's happening during your trading strategy's risk assessment. You can use it to react to signals that either pass or fail the risk checks. Specifically, the `onRejected` callback gets triggered when a trading signal is blocked because it violates your defined risk limits, giving you a chance to log the event or adjust your strategy. Conversely, `onAllowed` is called whenever a signal successfully passes all risk checks, indicating it's considered safe to execute.

## Interface IRiskActivePosition

This interface, `IRiskActivePosition`, represents a single trading position that's being tracked by the risk management system within backtest-kit. Think of it as a snapshot of a trade, providing key information about it. 

You'll see details like the signal that triggered the trade (`signal`), the name of the strategy that initiated it (`strategyName`), the exchange where the trade occurred (`exchangeName`), and when the position was first opened (`openTimestamp`). It's designed to allow for comparing and analyzing positions across different trading strategies simultaneously.

## Interface IRisk

The `IRisk` interface is a core component for managing risk within your backtesting strategies. It helps ensure your trades stay within defined risk boundaries and keeps track of your open positions.

You'll use the `checkSignal` method to see if a potential trade aligns with your risk rules – it’s essentially a gatekeeper for your signals. 

The `addSignal` function lets you inform the system when you open a new position, so it can monitor it. Conversely, `removeSignal` tells the system when a position is closed, allowing it to update risk metrics. These functions provide a way to register and deregister signals/positions, aiding in position tracking and risk assessment.

## Interface IPositionSizeKellyParams

This interface, `IPositionSizeKellyParams`, helps you calculate position sizes based on the Kelly Criterion. It defines the key inputs needed for this calculation. You'll provide a `winRate`, representing the likelihood of a winning trade as a number between 0 and 1.  Additionally, you’re expected to specify a `winLossRatio`, which reflects the average profit compared to the average loss for your trades. These parameters work together to determine how much of your capital to allocate to each trade.

## Interface IPositionSizeFixedPercentageParams

This interface defines the settings needed for a trading strategy that uses a fixed percentage of your capital for each trade, but includes a stop-loss price to help manage risk. Specifically, it lets you specify the `priceStopLoss`, which is the price at which you're willing to cut your losses on a trade. It’s a simple way to control how much of your capital you're risking per trade, tying it to a specific price point.

## Interface IPositionSizeATRParams

This interface, `IPositionSizeATRParams`, defines the necessary information when calculating your trade size based on the Average True Range (ATR). It focuses solely on the ATR aspect, omitting the specific method used for sizing. The `atr` property holds the actual ATR value, which is a key input for determining how much of an asset you’re going to trade. This value represents the average range between high and low prices over a specified period, giving you a sense of market volatility.

## Interface IPersistBase

This interface defines the basic operations for saving and retrieving data. Think of it as the foundation for how your backtesting framework interacts with storage – whether that’s a file system, database, or other persistence layer.

It provides methods to check if data already exists, read existing data based on a unique identifier, and write new data.  The `waitForInit` method handles setting up the initial storage location and ensures it's done only once.  Writing data is done in a way that guarantees it's saved completely and reliably, preventing data corruption. It essentially provides a standardized way to manage the data that your backtest needs to function.

## Interface IPartialData

This interface, `IPartialData`, represents a simplified snapshot of trading data designed for saving and loading. Think of it as a way to preserve key information about a signal’s progress, such as the profit and loss levels it has encountered. The `profitLevels` property stores an array of levels reached in the positive, while `lossLevels` keeps track of the levels experienced on the negative side. It's built to be easily saved and restored, transforming sets of data into arrays so they can be handled by systems that work with JSON.

## Interface IPartial

This interface, `IPartial`, is responsible for keeping track of how a trade is performing, specifically noting when it hits certain profit or loss milestones like 10%, 20%, or 30%. It's used by the trading system to let you know when a trade reaches these key levels.

When a trade is making money, the `profit` method calculates the current profit level and sends out notifications for any new milestones reached. Similarly, when a trade is losing money, the `loss` method does the same, tracking loss levels. To prevent repeated notifications, it only sends events for previously unseen levels.

Finally, when a trade closes, whether due to a target price being hit, a stop-loss trigger, or time expiration, the `clear` method cleans up the tracked data, removes the trade's information from the system's memory, and saves any necessary changes to storage.

## Interface IOptimizerTemplate

This interface helps create code snippets and messages for interacting with large language models (LLMs) within the backtest-kit framework. It's like a blueprint for building different parts of your trading system.

The `getJsonDumpTemplate` method allows you to create a debugging tool that outputs data in a structured format.

Several methods generate the initial setup – `getTopBanner` creates the foundational code with necessary imports.  Then, `getUserMessage` and `getAssistantMessage` craft the conversational prompts for your LLM.

You can use `getWalkerTemplate`, `getExchangeTemplate`, `getFrameTemplate`, and `getStrategyTemplate` to build the core components of your trading simulation: configuring the walker, exchange, timeframe, and strategies.

The `getLauncherTemplate` produces code to actually run your walker and listen for trading events. Finally, `getTextTemplate` and `getJsonTemplate` provide easy ways to format output from your LLM, whether that’s free-form text or structured JSON data.

## Interface IOptimizerStrategy

This interface, `IOptimizerStrategy`, bundles all the information used to create a trading strategy, making it easy to understand the context behind it.  You'll find the `symbol` – the trading pair the strategy is designed for – alongside a `name` which is a unique identifier for referencing it.  The `messages` property holds the entire conversation history with the LLM, including your prompts and the AI's responses, offering a complete picture of how the strategy was developed. Finally, the `strategy` property contains the actual generated strategy logic, which is the output from the `getPrompt()` function.

## Interface IOptimizerSourceFn

The `IOptimizerSourceFn` is like a reliable pipeline that feeds data to your trading strategy optimization process. It's designed to deliver data in chunks – think of it as providing results in pages – so you don't have to load everything at once. Crucially, each piece of data it provides needs to have a unique identifier, helping the optimizer keep track of everything and avoid confusion. This function is responsible for ensuring your optimizer has the training data it needs to learn and improve.

## Interface IOptimizerSource

This interface, `IOptimizerSource`, lets you connect your backtesting data to the LLM conversation process. Think of it as a way to tell the system where to get the data it needs and how to present it.

You provide a unique name for the data source so you can easily refer to it during testing and logging. The `fetch` function is the key—it's the actual code that retrieves the backtest data, and it should handle getting data in batches (pagination). 

You can also tailor the messages sent to the LLM using optional `user` and `assistant` functions. These formatters allow you to customize how the data is presented to the LLM, potentially improving the quality of its responses. If you don’t provide them, the system uses built-in templates to format the messages. A short description (`note`) can be added to provide context.

## Interface IOptimizerSchema

This interface defines the structure for configuring an optimizer within the backtest-kit framework. Think of it as a blueprint for how the system will generate and test trading strategies.

It lets you specify a unique name for your optimizer, making it identifiable within the system. You’re also able to define training periods - multiple ranges actually - to create different versions of a strategy for comparison. There's also a designated testing range to validate how well the generated strategies perform.

The configuration includes data sources that feed information into the strategy generation process, and a crucial function (`getPrompt`) that crafts the prompts used to generate strategies from the conversation history.  You can even customize the strategy generation process by providing your own template overrides or setting up lifecycle callbacks for monitoring purposes.

## Interface IOptimizerRange

This interface, `IOptimizerRange`, helps you define specific time periods for backtesting and optimization. Think of it as setting the boundaries for your data – when your trading strategy will be tested or trained. 

You're essentially providing a start date and an end date, both inclusive, to tell the system exactly which historical data to use.  

It’s helpful to include a descriptive note alongside each time range, so you can easily remember what the period represents (like "2023 bear market" or "2024 Q2 rally").

## Interface IOptimizerParams

This interface defines the settings needed to create an Optimizer. Think of it as a blueprint for configuring how your optimization process will run.

It includes a logger, which is essential for tracking what's happening during the optimization – helping you debug and understand the results.

You also provide a complete template, which contains all the methods needed to run your trading strategy and analyze its performance; it’s built from your specified strategy and some default settings.

## Interface IOptimizerFilterArgs

This interface defines the information needed to request specific data from your historical data source when optimizing trading strategies. It allows you to pinpoint the exact trading pair, like "BTCUSDT", and the start and end dates for the data you want to use. Think of it as telling the system, "I need data for Bitcoin against USDT, from this date to that date." This helps ensure you're backtesting your strategies using the right historical information.

## Interface IOptimizerFetchArgs

This interface defines the information needed when fetching data for optimization, like when you're trying out different trading strategies. It's designed to work with data sources that provide results in chunks.

Think of it as a way to request data in smaller pieces, instead of trying to load everything at once.  The `limit` property tells the system how many records to retrieve in each request, and `offset` dictates how many records to skip over before starting the retrieval. This lets you navigate through large datasets efficiently, for example, if you’re testing a strategy over a long period of historical data.

## Interface IOptimizerData

This interface, `IOptimizerData`, acts as the foundation for all data that feeds into the backtest kit's optimization process. Think of it as a contract ensuring all data sources provide a way to identify each individual data point. Every data source must give each piece of data a unique identifier, represented by the `id` property. This `id` is really important because it allows the system to avoid processing the same data multiple times, especially when dealing with large datasets that might be fetched in chunks or pages.

## Interface IOptimizerCallbacks

These callbacks let you keep an eye on what's happening during the optimization process and make sure everything is working as expected. 

The `onData` callback gets triggered once the optimization framework has gathered all the data needed for your strategies. This is a good place to check the data or write it to a log.

When the code for your strategies is ready, the `onCode` callback is invoked, giving you a chance to inspect or record the generated code.

If you're saving your generated strategy code to a file, the `onDump` callback will notify you when that file writing is complete, so you can log it or do other tasks.

Finally, `onSourceData` lets you know when data has been successfully pulled from a data source, including the source name, data itself, and the date range it covers – which is helpful for data validation or logging.

## Interface IOptimizer

The `IOptimizer` interface provides tools to build and export trading strategies. Think of it as a way to automatically create trading code based on historical data. 

The `getData` method is your starting point; it gathers data and prepares it for strategy generation. It essentially collects all the necessary information and organizes it into a format suitable for the optimization process.

`getCode` then takes that prepared data and generates the complete trading strategy code, ready to be executed. 

Finally, `dump` lets you save the generated code directly to a file, so you don't have to copy and paste it manually – it handles creating the file and directory structure for you.

## Interface IMethodContext

The `IMethodContext` interface provides essential information about the environment your trading logic is running in. Think of it as a little package that travels alongside your code, telling it which exchange, strategy, and frame configurations to use. This context is automatically managed by the backtest-kit framework, so you generally don't need to create it yourself. The `exchangeName` tells the system which exchange to connect to, `strategyName` identifies the strategy being executed, and `frameName` specifies the frame—it’s often blank when you’re trading live. Essentially, it ensures that your trading algorithms are using the right settings for the specific scenario.


## Interface ILogger

The `ILogger` interface provides a way for different parts of the backtest-kit framework to record important information. Think of it as a central place to track what's happening within your trading system.

It offers several logging methods: `log` for general events, `debug` for very detailed troubleshooting information, `info` for standard operational updates, and `warn` for potential issues that need to be looked into. These methods help you understand how your agents, sessions, and other components are behaving, making debugging and monitoring much easier. By using these logging functions, you can keep a clear record of your system’s lifecycle, tool calls, policy checks, and any errors that might occur.

## Interface IHeatmapStatistics

This interface defines the structure for presenting aggregated statistics about a portfolio's performance, visualized as a heatmap. It organizes data across all the assets held within the portfolio, providing a consolidated view.

The `symbols` property is the core of the structure—it's an array containing detailed statistics for each individual symbol within the portfolio. You'll also find overall portfolio metrics such as the total number of symbols tracked, the overall profit and loss (PNL), a Sharpe Ratio indicating risk-adjusted return, and the total number of trades executed. These high-level metrics offer a quick understanding of the portfolio’s general health.


## Interface IHeatmapRow

This interface represents a row of data in a portfolio heatmap, specifically focusing on a single trading symbol like BTCUSDT. It provides a consolidated view of how different strategies performed on that symbol.

You'll find key metrics here, such as the total percentage profit or loss generated, a measure of risk-adjusted return (Sharpe Ratio), and the largest percentage drop experienced (Max Drawdown). 

It also details the volume of trading activity with the total number of trades, win/loss counts, and win rate. For a deeper analysis, there are statistics about average profit and loss per trade, how spread out the results are (standard deviation), and consecutive win/loss streaks. Finally, expectancy, a forward-looking metric, is included to understand the long-term potential based on win/loss characteristics.

## Interface IFrameSchema

This interface describes the blueprint for how your backtest data is structured, essentially defining the time periods and frequencies you're analyzing. Think of it as setting the stage for your trading strategy's test run. 

You’re defining a unique name for each frame so you can easily identify it.  There's space to add a note for your own reference. 

The `interval` property dictates how frequently timestamps are generated, like every minute, hour, or day.  `startDate` and `endDate` specify the backtesting period, including both the beginning and ending dates.

You can also attach optional lifecycle callbacks to a frame, allowing you to execute custom code at specific points during the backtest process.

## Interface IFrameParams

The `IFrameParams` interface defines the information needed to set up a trading frame within the backtest-kit framework. Think of it as the initial configuration for your trading environment. It builds upon `IFrameSchema` and importantly includes a `logger` – a tool for tracking what's happening during your backtesting process, allowing you to debug and understand your strategy's behavior. This logger helps you monitor the trading frame's internal workings.

## Interface IFrameCallbacks

This section describes the `IFrameCallbacks` interface, which lets you hook into key moments in how backtest-kit creates and manages the timeframes used for testing. Specifically, the `onTimeframe` property allows you to provide a function that gets called whenever a new set of timeframes is generated. This is a great spot to verify that the timeframes being created are what you expect, or simply to record information about the timeframe generation process. You can access the specific dates, start and end dates, and the interval used to create the timeframe set within the provided function.

## Interface IFrame

The `IFrames` interface is a core part of how backtest-kit manages time during simulations. Think of it as the engine that creates the sequence of moments your trading strategies will experience. 

It provides a method called `getTimeframe`, which is used to build an array of specific dates and times. You give it a financial instrument (like a stock symbol) and a name for the timeframe (e.g., "daily", "hourly"), and it returns a list of timestamps that represent that timeframe. These timestamps are carefully spaced according to the settings you've provided for your backtest.

## Interface IExecutionContext

The `IExecutionContext` interface holds essential information about the current environment your trading strategy is running in. Think of it as a package of details passed along to give your code context. It tells your strategy what trading pair it's dealing with (the `symbol`), the current time (`when`), and whether it's a backtest simulation or a live trade (`backtest`). This interface makes it easy to adapt your code based on the specific conditions, allowing it to react differently during backtesting versus real-time trading.

## Interface IExchangeSchema

This interface outlines how to connect backtest-kit to different data sources, like crypto exchanges or brokerages. When you add a new exchange, you’re essentially providing this schema to tell backtest-kit where to get historical price data and how to handle trade sizes and prices correctly.

The `exchangeName` is a unique identifier you assign to the exchange. The `note` field is for your own reference - a little description for your records. 

The core of the schema is `getCandles`, which defines how to retrieve historical price data (candles) for a specific trading symbol and time period.  `formatQuantity` and `formatPrice` ensure that trade sizes and prices are displayed in the exchange's expected format, considering its precision rules.  Finally, `callbacks` lets you hook into certain events, like when new candle data arrives.

## Interface IExchangeParams

The `IExchangeParams` interface helps you set up how your exchange interacts with the backtest-kit framework. Think of it as a blueprint for configuring your exchange's behavior. 

It requires you to provide a `logger` which is a tool for recording debugging information—anything you want to see happening under the hood. You’re also expected to supply an `execution` object. This object provides essential information like the trading symbol, the time period you’re analyzing, and whether you're performing a backtest or live trading. This context helps the exchange operate correctly within the backtest environment.

## Interface IExchangeCallbacks

This interface lets you hook into events happening when the backtest-kit framework gets candle data from an exchange. The `onCandleData` property is the main way to do this – think of it as a notification that new candlestick data has arrived. You're given the symbol, the time interval (like 1 minute or 1 day), the start date and limit of the data requested, and then an array containing the actual candle data itself. This is useful if you need to react to incoming data in real-time or perform custom processing as it arrives.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with different cryptocurrency exchanges. It provides methods for retrieving historical and future candle data, which is crucial for simulating trading strategies. You can use it to fetch past price movements and even look ahead (within the backtest environment) to predict future price action.

The `getCandles` method lets you grab historical candle data for a specific cryptocurrency and time interval.  `getNextCandles` allows you to look forward in time, which is useful for testing strategies that require anticipating future prices. 

The framework also handles the specifics of each exchange by letting you format order quantities and prices correctly with `formatQuantity` and `formatPrice`. Finally, the `getAveragePrice` method provides a simple way to calculate the VWAP (Volume Weighted Average Price) based on recent trading activity, giving you a sense of the current market price.

## Interface IEntity

This interface, IEntity, serves as the foundation for all data objects that are saved and retrieved from storage within the backtest-kit framework. Think of it as the common ancestor for all your custom data models. It establishes a basic structure that ensures consistency across different entity types, making it easier to manage and work with your trading data. If you're creating a new data object that needs to be persisted, it should implement this interface.

## Interface ICandleData

This interface represents a single candlestick, the fundamental building block for analyzing price movements. Each candlestick holds information about a specific time interval, detailing when it began (timestamp), the opening price, the highest and lowest prices reached, the closing price, and the total trading volume during that period. It’s a core data structure used in backtesting strategies and calculating indicators like VWAP. Think of it as a snapshot of market activity over a defined timeframe.

## Interface DoneContract

This interface lets you know when a background task, whether it’s a backtest or a live trade execution, has finished running. It provides key details about what just completed, such as the exchange used, the name of the trading strategy, whether it was a backtest or a live execution, and the symbol being traded. Think of it as a notification package delivered when a process is done, giving you context about the work that's been accomplished. You’re getting important information like the exchange, strategy, and symbol involved, all neatly bundled together.

## Interface BacktestStatistics

This interface provides a collection of key statistics summarizing the performance of a backtest. You'll find a detailed list of all the trades that were closed, along with the total number of trades executed. It breaks down the results into winning and losing trades, and calculates the win rate – the percentage of profitable trades.

The interface also gives you the average profit (or loss) per trade and the total profit across all trades. To understand the risk involved, it provides the standard deviation, a measure of volatility, and the Sharpe Ratio, which factors in both return and risk. The annualized Sharpe Ratio adjusts this for a yearly perspective. You're also provided with the certainty ratio, indicating the balance between winning and losing trade sizes, and an estimate of expected yearly returns based on trade duration and profit. Remember that any statistic marked as "null" wasn't reliably calculated due to data limitations.
