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

This function lets you plug in your own logging system for the backtest-kit framework. It’s useful if you want to send log messages to a specific place, like a file, a database, or a custom monitoring tool. When you provide your logger, all internal framework messages will be routed through it.  The logger will automatically include helpful context information alongside each message, such as the strategy name, exchange, and trading symbol, making it easier to understand what's happening during backtesting. You'll need to create a logger that conforms to the `ILogger` interface.

## Function setConfig

This function lets you adjust how backtest-kit operates by modifying its global settings. You can tweak things like the data fetching behavior or how results are calculated. The `config` parameter allows you to selectively change only the settings you need, rather than providing a complete configuration every time. Use the `_unsafe` flag cautiously, primarily for testing scenarios, as it bypasses important checks and could lead to unexpected results.

## Function listWalkers

This function provides a way to see all the different trading strategies or "walkers" currently set up within your backtest-kit environment. It essentially gives you a list of all the available strategies you can use. This is really handy if you want to understand what's going on, generate documentation about your strategies, or even build a user interface that dynamically adjusts based on the available strategies. It returns a promise that resolves to an array containing the details of each registered walker.

## Function listStrategies

This function lets you see a complete list of all the trading strategies that have been set up within the backtest-kit framework. Think of it as a way to take inventory of your strategies – it provides a clear overview of what’s available. It’s really handy for things like checking your work, creating documentation, or even building user interfaces that dynamically display your strategies. The function returns a promise that resolves to an array of strategy schema objects, giving you all the details about each strategy.

## Function listSizings

This function lets you see all the different sizing strategies currently in use within your backtesting environment. Think of it as a way to peek under the hood and view the configurations that dictate how your trades are sized. It returns a list of these sizing schemas, which is really helpful for understanding how your system is making decisions and for creating tools that can display or manage these settings. Essentially, it gives you a complete picture of the sizing rules being applied.

## Function listRisks

This function lets you see all the risk assessments your backtest is considering. It gathers all the risk configurations that you've set up using the `addRisk()` function. Think of it as a way to check what risks your trading strategy is prepared for – great for making sure everything is set up correctly, understanding your system's logic, or creating tools that automatically display these risk settings. The result is a list of risk schemas, allowing you to inspect each one individually.

## Function listOptimizers

This function gives you a peek at all the optimization strategies your backtest-kit setup knows about. Think of it as a way to see what tools are available to fine-tune your trading models. It returns a list, and each item in the list describes one optimizer, essentially telling you what kinds of adjustments it can make. This is helpful for understanding how your system is configured or for creating interfaces that let users choose and experiment with different optimizers.

## Function listFrames

This function gives you a peek under the hood, letting you see all the different data structures, or "frames," that your backtest kit is using. It returns a list describing each frame, which is helpful if you're trying to understand how your data is organized, generate documentation, or create tools that work with these frames. Think of it as a way to inventory all the different data "views" available for your trading strategy. You can use this to see exactly what data your strategy will be working with.

## Function listExchanges

This function lets you see all the different exchanges your backtest-kit setup knows about. Think of it as a quick way to check which data sources are available for your trading strategies. It returns a list of exchange details, which can be helpful when you’re troubleshooting, creating documentation, or building user interfaces that need to react to different exchange types. The result is a promise that resolves to an array containing information about each registered exchange.

## Function listenWalkerProgress

This function lets you keep track of how a backtest is progressing. It allows you to subscribe to events that are triggered after each strategy finishes running within a `Walker.run()` execution. 

The events are delivered one at a time, even if your callback function takes some time to process them, ensuring they are handled in the order they arrive. To prevent any potential issues, the framework uses a queue to make sure your callback function runs sequentially, preventing concurrent executions. You provide a function (`fn`) that will receive these progress updates as events. When you're done listening for these updates, the function will return another function that you can use to unsubscribe.

## Function listenWalkerOnce

This function lets you set up a temporary listener for walker events. You tell it what kind of event you're interested in using a filter – a function that checks each event. 

Once an event matches your filter, the provided callback function will be executed just once, and then the listener automatically stops listening. It's a convenient way to react to a specific event happening within a walker’s progress without needing to manually manage subscriptions. You give it a way to identify the event you want and what you want to do when it appears, and it handles the rest. 

The function returns a function that, when called, unsubscribes the listener.


## Function listenWalkerComplete

This function lets you be notified when the backtest kit has finished running all of your strategies. It’s like setting up a listener that gets triggered once the entire testing process is done. The notification you receive contains all the results from the backtesting. Importantly, the processing of this notification happens in a controlled way, ensuring that even if your notification handling involves asynchronous tasks, those tasks won't run at the same time and potentially cause issues. It provides a way to reliably get the final results after all strategies have been tested. You can unsubscribe from these notifications when you no longer need them.

## Function listenWalker

The `listenWalker` function lets you track the progress of your backtesting simulations. It’s like setting up a notification system that gets triggered after each strategy finishes running within the backtest. 

You provide a function as input, and this function will be called whenever a strategy completes. Importantly, these calls happen one after another, even if your callback function itself takes some time to process—this ensures things stay organized and prevents unexpected issues. Think of it as a reliable way to monitor what’s happening in your backtest and respond to each strategy’s outcome in a controlled manner.


## Function listenValidation

This function lets you keep an eye on any issues that pop up during risk validation. It's designed to catch errors that happen when your trading signals are being checked for potential problems. 

Think of it as a way to receive notifications whenever something goes wrong during that crucial validation process. The errors are delivered one at a time, even if your notification handling involves some extra steps or asynchronous operations. This ensures a controlled and ordered way of dealing with any validation failures, making debugging and monitoring much easier. You provide a function that will be called whenever a validation error occurs, and this function handles the details of the error.

## Function listenSignalOnce

This function lets you set up a listener that reacts to specific signals, but only once. You provide a filter to define which signals you’re interested in, and a function to execute when a matching signal arrives.  Once that signal is received and your function runs, the listener automatically stops listening. Think of it as a one-time alert system for your trading strategy—perfect for reacting to a specific event and then forgetting about it. It handles the subscription and unsubscription for you, keeping your code clean and simple.

## Function listenSignalLiveOnce

This function lets you temporarily tap into live trading signals, but only to catch a single event that matches your criteria. Think of it as setting up a quick alert.

You provide a filter – a rule that defines which signals you’re interested in.  When a live signal comes in, it checks if it meets your filter. If it does, the provided callback function runs just once with the signal details. 

After that single execution, the subscription automatically stops, so you don't need to manage unsubscriptions yourself. This is great for testing or getting a one-off notification without being subscribed indefinitely. 

It only works with signals generated during a `Live.run()` execution.


## Function listenSignalLive

This function lets you tap into the live trading signals generated by backtest-kit. It's designed for getting updates as trades happen in a running simulation. Think of it as setting up a listener that gets notified whenever a new signal is produced.

You provide a function that will be called with each signal event. Importantly, these events are handled one at a time, in the order they arrive, ensuring a predictable flow.

It only works with signals from a Live.run() execution, so you're getting real-time updates from a running backtest. The function returns another function, which you can call later to unsubscribe from receiving those live signals.

## Function listenSignalBacktestOnce

This function lets you temporarily "listen in" on the signals generated during a backtest, but only for a single event that meets your criteria. You provide a filter – a way to specify which signals you’re interested in – and a callback function that will run just once when a matching signal arrives. Once that single event is processed, the listener automatically stops, preventing it from interfering with other parts of your code. Think of it as a quick and clean way to react to a specific signal during a backtest run. It’s useful for tasks like logging a particular trade or performing a calculation based on a specific event.


## Function listenSignalBacktest

This function lets you tap into the flow of a backtest as it's running. You provide it a function that will be called whenever a signal event happens during the backtest. Think of it as setting up an observer to react to what's going on. It's specifically designed to work with events generated by `Backtest.run()`, so you won't get signals from other sources. The events are handled one at a time, in the order they occur, ensuring you see them sequentially. The function returns another function that, when called, will unsubscribe you from these backtest signals.

## Function listenSignal

This function lets you listen for updates from your trading strategy – think of it as setting up a notification system for what’s happening in your backtest. Whenever your strategy produces a signal (like opening a trade, closing a trade, or just being idle), this function will call a callback you provide. 

It’s designed to handle these signals in a reliable way: even if your callback function takes some time to process a signal, the system ensures signals are handled one after another, preventing any conflicts or unexpected behavior. You provide a function that will receive these signal updates, and in return, you’re given a way to unsubscribe from these notifications when you no longer need them.


## Function listenRiskOnce

This function lets you react to specific risk-related events just once. Think of it as setting up a temporary listener—it waits for an event that matches your criteria, runs a function you provide when it finds one, and then stops listening. You give it a filter that defines what kind of risk event you're interested in, and a function that will be executed when that event happens. This is helpful if you need to react to a particular risk condition and don't want to keep listening afterward. The function returns a way to stop the listening process if needed.

## Function listenRisk

This function lets you be notified when a trading signal is blocked because it violates your risk rules. Think of it as a safety net – you’re only alerted when something triggers a risk rejection. It ensures you don’t get bombarded with notifications for signals that are perfectly fine, keeping things clean and focused on potential issues. The notifications are handled one at a time, even if your response is a complex, asynchronous operation, guaranteeing order and preventing unexpected behavior. You provide a function that gets called whenever a risk validation fails, and this function returns another function that you can call to unsubscribe from these notifications later.

## Function listenPerformance

This function lets you monitor how quickly your trading strategies are running. It's like setting up a listener that gets notified whenever a performance metric changes during the backtesting process. 

Think of it as a way to profile your code and find areas that might be slowing things down. The information is delivered to you sequentially, even if the function you provide needs to do some asynchronous work. This ensures that your performance data is always processed in the order it's generated.

You provide a callback function that will receive these performance events, allowing you to analyze and optimize your strategy's execution speed. The listener can be unsubscribed, effectively stopping these performance notifications.

## Function listenPartialProfitOnce

This function lets you react to specific partial profit levels being hit in your backtesting strategy, but only once. You tell it what conditions you’re looking for – for example, a particular profit percentage being reached – and provide a function to run when that condition is met. Once the condition is true and your function runs, the listener automatically stops listening, so you don't have to worry about managing subscriptions manually. It's perfect for handling one-off actions based on profit milestones.

The first input, `filterFn`, defines exactly which profit events you want to watch for. The second input, `fn`, is the action you want to perform when a matching profit level is detected.

## Function listenPartialProfit

This function lets you track your trading progress by getting notified when your profits reach certain milestones, like 10%, 20%, or 30% gains. It's like setting up checkpoints to see how your trades are performing. The function ensures these notifications are handled one at a time, even if your processing takes a bit of time, to avoid any unexpected issues. You simply provide a function that will be called whenever a partial profit level is reached, and it handles the rest.

## Function listenPartialLossOnce

This function lets you react to specific partial loss events, but only once. You tell it what kind of loss event you're looking for using a filter – essentially a test to see if the event matches your criteria. When an event passes that test, a callback function you provide is executed.  Critically, once the callback runs, the function automatically stops listening, ensuring it only triggers once for a given condition. It's great for situations where you need to wait for a particular loss to happen and then take action, but don't want to keep monitoring afterwards.

You provide a function (`filterFn`) that checks each event to see if it's the one you're interested in. You also provide another function (`fn`) that gets executed when a matching event is found.

## Function listenPartialLoss

This function lets you keep track of when your backtest reaches certain loss levels, like losing 10%, 20%, or 30% of its starting value. It’s useful for understanding how your trading strategy performs under different loss scenarios.

The function provides a way to subscribe to these "partial loss" events, and importantly, it ensures that these events are handled one at a time, even if your callback function takes some time to complete. This sequential processing helps prevent unexpected behavior and keeps things running smoothly. You provide a function that gets called whenever a loss level is reached, and this function will receive details about the event. When you no longer need to listen for these events, the function returns another function which you can call to unsubscribe.

## Function listenOptimizerProgress

This function lets you keep track of how your backtest optimizer is doing as it runs. It provides updates on the progress, specifically concerning data source processing. You give it a function that will be called whenever an update is available, and this function ensures that updates are handled one at a time, even if your callback function takes some time to complete. Think of it as a way to see a live status report of your optimization process. The function you provide receives an event object containing details about the progress. When you’re done listening, the function returns another function that you can call to unsubscribe.

## Function listenExit

This function lets you monitor for serious, unrecoverable errors that can halt the backtest-kit framework's operations, like those occurring within background tasks. It's designed to catch critical issues that would otherwise stop the process entirely. When a fatal error happens, the provided callback function will be executed, ensuring errors are handled in the order they occur, even if the callback itself involves asynchronous operations. The function utilizes a queuing mechanism to prevent the callback from running concurrently, ensuring stability and predictable behavior. To use it, you simply provide a function that will receive the error details when a fatal error occurs.

## Function listenError

This function lets you register a listener that gets notified whenever a recoverable error occurs during your backtest or trading strategy’s execution. Think of it as a safety net that catches issues like failed API calls so your program doesn't crash. When an error happens, the provided callback function will be executed, allowing you to handle the problem and keep the backtest running. These errors are processed one at a time, in the order they happen, even if your error handling function takes some time to complete.

## Function listenDoneWalkerOnce

This function lets you set up a listener that gets notified when a background task finishes, but only once. You provide a filter – a condition – that determines which finishing tasks you're interested in. Once a task matches your filter, the provided callback function runs, and the listener automatically stops listening, so you don't get repeated notifications. It’s perfect for actions you only need to perform a single time after a background process completes.

The filter function helps narrow down which completion events you're interested in. The callback function you provide will be executed just one time when a matching completion event occurs. After that execution, the listener is removed.


## Function listenDoneWalker

This function lets you keep track of when background tasks within the backtest-kit framework finish. Think of it as setting up a listener that gets notified when a long-running process, initiated with `Walker.background()`, is done.

The notification you receive contains information about the completed task. Importantly, even if your notification handler is an asynchronous function, the framework ensures these notifications are processed one at a time, in the order they occur, preventing any unexpected clashes.

Essentially, this lets you reliably know when those background tasks are fully completed and allows you to react accordingly, safely and sequentially.

To stop listening for these completion events, the function returns another function that you can call.


## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running within the backtest-kit framework. It's designed for situations where you only need to know about a specific completion event once.

You provide a filter – a way to identify which completion events you're interested in – and a function to execute when a matching event occurs. Once that event happens and your function runs, the subscription automatically stops, so you don't have to worry about manually unsubscribing. This makes it perfect for actions like logging a specific completion or updating a UI element a single time. 


## Function listenDoneLive

This function lets you listen for when background tasks within the backtest-kit framework finish running. It's especially helpful when you're dealing with asynchronous operations within those tasks.  

Think of it as setting up a notification system; whenever a background process is done, the function you provide will be called. The events are delivered in the order they finish, and even if your callback function itself takes time to execute, it will be handled one after another, preventing any conflicts. The return value of this function is another function that you can call to unsubscribe from these completion notifications.


## Function listenDoneBacktestOnce

This function lets you be notified when a background backtest finishes, but in a special way – it only runs your callback once and then stops listening. 

You provide a filter function to specify which backtest completions you're interested in. Only when a backtest finishes and meets the criteria of your filter function will your callback be executed. 

Think of it as setting up a temporary alert that goes off only for specific backtest results, and then quietly disappears afterward. This is useful if you just need a single piece of information from a backtest completion and don't want to keep listening for more. 

The function returns a function that you can call to stop listening before the backtest completes.


## Function listenDoneBacktest

This function lets you get notified when a backtest finishes running in the background. Think of it as setting up a listener that waits for the backtest to complete. When the backtest is done, the function you provide will be called with information about the finished backtest. Importantly, even if your function takes some time to run (like if it's doing something asynchronous), the backtest-kit makes sure that the notifications are handled one at a time, in the order they happened. 

You're essentially setting up a way to react to the backtest finishing, ensuring that your response is processed reliably. It returns a function that you can call to unsubscribe from these notifications if you no longer need them.


## Function listenBacktestProgress

This function lets you keep an eye on how your backtest is running. It’s like setting up a notification system so you know what’s happening behind the scenes during the backtesting process.  You provide a function that will be called whenever there's an update on the backtest's progress.  Importantly, even if your notification function takes some time to process the information, the updates will be handled one after another to avoid any confusion. This gives you a reliable way to monitor and potentially react to the backtest's evolution. The function itself returns another function that you can use to unsubscribe from these progress updates whenever you need to.

## Function getMode

This function tells you whether the trading framework is running in backtest mode or live trading mode. It returns a promise that resolves to either "backtest" or "live", letting you adapt your code based on the environment it's operating in. Essentially, it's a quick way to check if you're simulating trades or actually trading with real money.

## Function getDefaultConfig

This function gives you a set of default settings for the trading framework. Think of it as a starting point – it provides all the preset values for various configuration options. It's a handy way to explore what settings are available and what their initial values are, helping you understand how to customize the framework to your needs. The returned settings are read-only, meaning you can view them but not directly modify them.

## Function getDate

The `getDate` function provides a simple way to retrieve the current date within your trading strategy. It's designed to work seamlessly whether you’re running a backtest or live trading. During a backtest, it gives you the date associated with the timeframe you’re currently analyzing. When you’re trading live, it returns the actual, real-time date. This makes it easy to incorporate date information into your trading logic, like calculating performance metrics or setting time-based conditions.

## Function getConfig

This function lets you peek at the global settings used by the backtest-kit framework. It provides a snapshot of values like slippage percentages, fee amounts, signal lifetimes, and retry counts for fetching historical data. Importantly, it returns a copy of these settings, so you can look at them without changing the actual framework configuration. Think of it as a read-only window into how the backtesting process is set up.

## Function getCandles

This function allows you to retrieve historical price data, also known as candles, for a specific trading pair. You tell it which symbol you're interested in, like "BTCUSDT" for Bitcoin against USDT, and the timeframe you want, such as "1h" for one-hour candles. You also specify how many candles you need, and the function will fetch them from the connected exchange, going back from the current time. Essentially, it’s your tool for accessing past price movements to analyze trends or build trading strategies.

## Function getAveragePrice

The `getAveragePrice` function helps you find the Volume Weighted Average Price, or VWAP, for a specific trading pair. It looks at the last five minutes of trading data to calculate this average, considering both the price and the volume traded at each point. Essentially, it gives you an idea of the average price a symbol has traded at, weighted by how much was bought and sold. If there’s no trading volume, it falls back to calculating a simple average of the closing prices instead. To use it, you just need to provide the symbol of the trading pair you're interested in, like "BTCUSDT."

## Function formatQuantity

This function helps you prepare the right amount of assets when placing orders. It takes a trading symbol, like "BTCUSDT", and a numerical quantity and converts it into a string formatted correctly for the specific exchange you're using. This ensures that the quantity you’re sending to the exchange is in the exact format it expects, preventing errors and unexpected behavior. Think of it as a translator for numbers, making sure they’re understood perfectly by the trading platform. You just provide the symbol and the amount, and it handles the formatting details.

## Function formatPrice

This function helps you display prices in a way that matches how the exchange shows them. It takes a trading pair symbol, like "BTCUSDT," and the actual price value as input. The function then uses the exchange's specific formatting rules to ensure the price is displayed with the correct number of decimal places, making your backtest results look more authentic and readable. Essentially, it handles the tricky part of price formatting for you.

## Function dumpSignal

This function helps you save detailed records of your AI trading strategy’s decisions. It creates a folder containing markdown files that document the entire conversation with the LLM, including the initial system prompt and each user message. You’ll also find a file with the final LLM output, along with important signal data like entry price, take profit, and stop loss levels. This is especially useful for debugging and understanding how your AI strategy arrived at its trading decisions. The function uses a unique identifier to name the folder, preventing accidental overwriting of previous logs. You can also specify a custom output directory if you prefer.

## Function addWalker

This function lets you register a "walker" – essentially a component that runs multiple backtests simultaneously and compares their results. Think of it as a way to easily compare how different trading strategies perform against each other using the same historical data. You provide a configuration object describing how the walker should operate, and backtest-kit will then use this walker during strategy comparisons. It’s helpful when you want to evaluate different approaches without needing to run each backtest individually.

## Function addStrategy

This function lets you add a trading strategy to the backtest-kit framework, essentially telling it what trading logic you want to test or run. It takes a configuration object that describes your strategy.

The system will automatically check that your strategy's signals make sense (like having valid prices and timestamps) and help prevent it from sending too many signals at once. If you’re running in live mode, your strategy's data is also saved safely so you don’t lose it if something goes wrong.

The `strategySchema` parameter holds all the details about your trading approach, defining how it makes decisions.

## Function addSizing

This function lets you tell backtest-kit how to determine the size of your trades. Think of it as setting the rules for how much capital you're willing to risk on each trade. You provide a configuration object that outlines the sizing method – whether it's a fixed percentage of your capital, a Kelly Criterion approach, or based on Average True Range (ATR) – along with associated risk parameters and constraints. You can also provide a custom callback to react to sizing calculations. Essentially, this function allows you to define and register your position sizing strategy within the backtesting framework.

## Function addRisk

This function lets you set up the risk management rules for your backtesting system. Think of it as defining how much risk your strategies are allowed to take on at once. You can specify limits on the number of positions across all your strategies, and even create custom checks to make sure your portfolio is behaving as expected—things like correlation analysis or monitoring specific portfolio metrics. Importantly, this risk management setup is shared between all your trading strategies, allowing for a comprehensive view of risk across your entire system. The framework keeps track of all open positions and makes this information available for your custom risk validation functions.

## Function addOptimizer

This function lets you add a custom optimizer to the backtest-kit framework. Think of an optimizer as a tool that creates trading strategies by pulling data, crafting prompts, and generating code. It takes a configuration object that defines how your optimizer works.  The resulting optimizer will produce a fully-formed .mjs file ready for backtesting, complete with all the settings and logic needed for exchange connections, strategy execution, and even integrating large language models.

## Function addFrame

This function lets you tell backtest-kit how to generate the timeframes your backtest will use. Think of it as setting up the calendar for your trading simulation. You provide a configuration object, the `frameSchema`, which specifies the start and end dates for your backtest, the interval (like daily, hourly, etc.) for generating those timeframes, and a way to be notified about events related to timeframe generation. It's a critical step in setting up your backtest environment.

## Function addExchange

This function lets you connect your trading framework to a data source, like a cryptocurrency exchange or a stock market. Think of it as telling the framework, "Hey, I want to use data from this particular exchange!" 

You provide a configuration object that describes how to access the exchange's historical price data and how to format prices and trade quantities. This lets the backtest-kit understand how to fetch and interpret data from that exchange so you can build and test your trading strategies. 

Essentially, it's the foundation for getting your backtest-kit connected to real-world market data.

# backtest-kit classes

## Class WalkerValidationService

This service helps you keep track of your parameter sweeps, often used for optimizing trading strategies or tuning hyperparameters. Think of it as a central place to register and check if your sweep configurations are set up correctly. 

You can add new sweep configurations using `addWalker`, essentially registering them with the system. Before running a sweep, `validate` confirms that the configuration you're referencing actually exists, preventing errors later on. To see all the registered configurations, use `list`. To make things faster, the service remembers its validation results, so it doesn’t have to re-check everything every time.

## Class WalkerUtils

WalkerUtils simplifies working with trading walkers, providing handy tools for running, stopping, and inspecting them. Think of it as a central place to manage your walker operations.

It automatically handles pulling important information like the walker's name and the trading symbol from the walker schema, so you don't have to. The `run` method is the main way to execute a walker comparison, while `background` lets you run comparisons without needing to see the results – perfect for tasks like logging or triggering callbacks.

Need to pause a walker's signal generation? The `stop` method provides a way to do that, cleanly stopping the walker and preventing new signals, all while ensuring existing signals finish properly.  You can also retrieve the walker's results with `getData` or generate a report with `getReport`.  For saving the report, use `dump`, and `list` lets you see the status of all your active walkers.  It’s designed to be a single, convenient source for managing your walkers.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of your trading strategies, or "walkers," in a structured and organized way. Think of it as a central place to define and manage the blueprints for your trading logic.

It uses a system to store these blueprints safely and ensures they are typed correctly. You add new trading strategy blueprints using `addWalker()` and access them later by their assigned names.

The service helps you make sure your strategy blueprints are well-formed before adding them, checking for essential properties and correct data types. 

You can also update existing strategy blueprints with specific changes, rather than replacing them entirely. Finally, you can easily retrieve a specific trading strategy blueprint by its name when you need it.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you automatically generate and save reports about your trading strategies. It listens for updates from your trading simulations (walkers) and organizes the results. Each walker gets its own dedicated storage area to keep things separate. 

The service takes the raw data from your walkers and transforms it into easy-to-read markdown tables that compare the performance of different strategies. These reports are then saved as `.md` files within a logs/walker directory.

You can trigger report generation on demand, or let the service handle it automatically as the walkers progress. The service also provides a way to clear out the accumulated data if you need to start fresh.  Initialization happens automatically when you first use the service, so you don't have to worry about setting anything up manually.

## Class WalkerLogicPublicService

The WalkerLogicPublicService acts as a friendly interface for running your backtesting workflows. It builds on top of a private service, automatically handling important details like the name of your strategy, exchange, frame, and walker. 

Think of it as simplifying how you execute your backtests – you don't have to manually pass around all the context information each time.

The `run` method is your primary way to kick off a comparison for a specific symbol.  It automatically propagates the necessary context so you can focus on the actual backtesting process and analyzing results across all your strategies.

## Class WalkerLogicPrivateService

This service helps you compare different trading strategies against each other. It's designed to orchestrate the backtesting process, giving you updates as each strategy finishes running. 

You provide the symbol you want to backtest, a list of strategies to compare, the metric you're using to evaluate them (like profit or Sharpe ratio), and some context information. The service then runs each strategy one after another. 

As each backtest completes, you’ll receive progress updates in the form of `WalkerContract` objects. This allows you to monitor the comparison in real-time and track which strategy is performing best. Ultimately, the service provides a ranked list of all strategies after they're all finished. 

It relies on other services internally to handle the backtesting logic and formatting results.

## Class WalkerCommandService

The WalkerCommandService acts as a central hub for interacting with the walker functionality within the backtest-kit. Think of it as a convenient access point, especially useful for dependency injection. 

It bundles together various services, including those for handling walker logic, schemas, validations (for strategies, exchanges, frames, walkers, and risks), and a service for strategy schemas. 

The key function, `run`, allows you to execute a walker comparison for a specific trading symbol. When you call `run`, you also provide information about the walker's name, the exchange it uses, and the frame it operates within – this context is crucial for the comparison process.


## Class StrategyValidationService

This service helps you keep track of your trading strategies and make sure they're set up correctly. It acts like a central hub for your strategy configurations, allowing you to register new strategies, check if they exist, and verify that any associated risk profiles are also valid.

You can add strategies to the system using `addStrategy`, which registers them for later use.  To ensure a strategy is ready to be used, `validate` checks for its existence and the validity of its risk profile. If you need to see what strategies you're managing, `list` will return a list of all registered strategy schemas. The service is also designed to be efficient by remembering past validation results.

## Class StrategySchemaService

The StrategySchemaService helps keep track of different trading strategy blueprints. Think of it as a central repository where you define and store the structure of your strategies, ensuring they all follow a consistent format.

It uses a special system to store these blueprints in a type-safe way, meaning the framework understands exactly what each strategy should contain. You add new strategy blueprints using `addStrategy()` and find them again by their name with `get()`.

Before a new blueprint is added, `validateShallow` makes sure it has all the essential components and that they are the correct types, preventing errors down the line.  You can also update existing blueprints with `override` if you need to make changes.

## Class StrategyCoreService

StrategyCoreService acts as a central hub for managing and running trading strategies within the backtest-kit framework. It combines several services to ensure strategies have the information they need, like the symbol being traded and the specific time period.

It helps validate strategies to make sure they're set up correctly and avoids running the same checks repeatedly. You can use it to check if a strategy is currently generating signals, or to see if it has been stopped.

The `tick` function simulates the strategy's response to market data at a particular time, while the `backtest` function runs a quick analysis of past performance using a set of historical price data.  There’s a function to stop strategies from generating new signals, and another to clear out cached strategy data, forcing a fresh start. Essentially, it’s a convenient way to interact with and control trading strategies within the backtest environment.

## Class StrategyConnectionService

This service acts as a central hub for managing and running your trading strategies. It intelligently routes requests to the correct strategy implementation based on the symbol and strategy name you specify. To ensure efficiency, it remembers previously created strategy instances, so you don't have to recreate them every time.

It makes sure your strategies are properly initialized before they start processing data, whether that's real-time ticks or historical backtest candles. You can use it to execute trades, analyze past performance with backtesting, and even stop a strategy from generating new signals.  

If you need to reset a strategy or free up resources, you can clear its cached information, forcing a fresh start the next time it’s needed. It also provides a way to check if a strategy is currently stopped, allowing you to monitor its status. Finally, it has internal mechanisms to track pending signals, which is useful for managing stop-loss and time-based conditions.

## Class SizingValidationService

This service helps you keep track of your position sizing strategies and makes sure they’re set up correctly before your backtests run. Think of it as a central place to register your sizing methods – like fixed percentage, Kelly Criterion, or ATR-based – and confirm they are available for use. 

Adding a sizing strategy involves registering it with the service, and you can validate that it exists before proceeding with calculations. The service remembers previous validations to speed things up. If you need to see all the sizing strategies you’re using, you can retrieve them as a list.

## Class SizingSchemaService

The SizingSchemaService helps you keep track of your sizing schemas in a reliable and type-safe way. It acts like a central repository where you can store and retrieve these schemas.

It uses a special registry to ensure the schemas are structured correctly. You can think of it as adding schemas using `register` and updating them with `override`. If you need to get a schema back, you use `get` to retrieve it by its name. 

The service also has a built-in validator to check if your schemas have all the necessary components before they're added.

## Class SizingGlobalService

The SizingGlobalService helps determine how much of an asset to trade, acting as a central hub for sizing calculations. It relies on other services to handle the complexities of position sizing, managing the process internally for strategies and providing a way to do sizing calculations. 

You can think of it as a manager that orchestrates the position sizing process. 

It keeps track of a logger for recording events, a connection service for interacting with sizing data, and a validation service for ensuring sizing requests are valid. 

The core function, `calculate`, takes parameters outlining risk and trade specifics and returns the calculated position size.

## Class SizingConnectionService

The SizingConnectionService acts as a central hub for handling position sizing calculations within the backtest kit. It’s designed to route sizing requests to the correct sizing method, making sure the right calculation logic is applied.

It uses a clever system to remember which sizing methods are already loaded, so it doesn’t have to recreate them every time you need them – this speeds things up.  When you need a specific sizing method, you tell the service the name of that method, and it finds or creates the corresponding sizing object.

The `calculate` function is your main way to get position sizes; it takes sizing parameters and the sizing method name and figures out the right size based on your configured approach – whether that's a fixed percentage, Kelly criterion, or something based on ATR. If a strategy doesn't have sizing configured, the sizing name will simply be an empty string.

## Class ScheduleUtils

This class provides helpful tools for understanding and monitoring your scheduled trading signals. Think of it as a way to keep an eye on how your signals are being processed and delivered. 

It lets you easily retrieve statistics about signals waiting to be executed for a specific trading symbol and strategy, such as how many signals are queued, canceled, and how long they’re waiting. You can also generate readable markdown reports that summarize this data, making it simpler to identify potential issues or bottlenecks. 

Finally, you can save these reports directly to a file for later review or sharing. It's designed to be used easily as a single, readily available tool within your backtesting framework.

## Class ScheduleMarkdownService

This service helps you keep track of how your trading strategies are performing by automatically generating reports about scheduled and cancelled signals. It listens for signal events and organizes them by strategy, creating detailed markdown tables summarizing each event. You'll get useful statistics like cancellation rates and average wait times, all saved in reports.

The service manages its data in isolated storage for each combination of symbol and strategy, ensuring that reports are specific and accurate.  You can retrieve the accumulated data or generate full reports on demand. It also provides a way to clear out all stored data, or just data for a specific strategy and symbol.

Importantly, the service automatically initializes itself when you first use it, subscribing to live signal events to start collecting data.


## Class RiskValidationService

This service helps you keep track of and confirm that your risk management setups are correct. It acts as a central place to register different risk profiles, like ensuring a specific risk assessment is defined.

You can use it to add new risk profiles, check if a profile exists before using it in your trading strategies, and get a complete list of all registered profiles. The service also remembers previous validation results to work faster. It’s like a safety net for your risk management, making sure everything is in order.

## Class RiskUtils

The RiskUtils class helps you analyze and report on risk rejections within your backtesting system. It acts as a central point to access data collected about rejected trades.

You can use it to get summary statistics for specific symbols and strategies, giving you an overview of rejection patterns. It also allows you to create detailed markdown reports that present the rejected trade events in a well-formatted table, including important details like the position, exchange, price, and reason for rejection.

Finally, RiskUtils simplifies exporting these reports to files, automatically creating the necessary directory structure and naming the file based on the symbol and strategy. This makes it easy to keep track of and share your risk rejection data.

## Class RiskSchemaService

This service helps you organize and manage different risk profiles, ensuring they are consistent and well-defined. It acts like a central repository for these risk profiles, keeping track of them in a safe and predictable way.

You can add new risk profiles using the `addRisk()` function (represented by the `register` property), and easily retrieve them later by their names with the `get()` function.  Before a risk profile is officially stored, the `validateShallow()` method checks its basic structure to make sure it's complete and has the necessary information.

If you need to update an existing risk profile, the `override()` function lets you make changes to specific parts of it without replacing the entire profile.  The service keeps track of everything internally with a secure storage system, and provides logging through the `loggerService` for troubleshooting.

## Class RiskMarkdownService

The RiskMarkdownService helps you automatically create and save reports detailing risk rejections in your trading system. It keeps track of every rejection event, organizing them by the trading symbol and strategy being used. You're able to generate nicely formatted markdown tables that summarize these rejections, along with overall statistics like the total number of rejections and breakdowns by symbol or strategy.

The service is designed to be easy to integrate – it listens for rejection events and automatically saves reports to a designated directory.  You can also request specific data or reports for individual symbol-strategy combinations. The service initializes itself automatically when you first start using it, subscribing to the necessary events. It also provides a way to clear out all collected data or just data for a specific symbol and strategy if needed.

## Class RiskGlobalService

This service handles risk-related operations, acting as a central point for validating risk limits and interacting with the underlying risk connection service. It's a critical component used internally by trading strategies and the public API.

The service keeps track of opened and closed signals, communicating with a risk management system to ensure trades adhere to defined limits. It also validates risk configurations and caches the results to avoid unnecessary repeated checks.

You can clear risk data, either for all risk instances or for a specific one identified by its name. The service provides methods to register new signals (when a trade is opened), remove signals (when a trade is closed), and to generally clean up risk data as needed. It also has a logger to track validation activity.

## Class RiskConnectionService

The RiskConnectionService acts as a central hub for managing risk checks during trading. It intelligently directs risk-related operations to the correct risk implementation, making sure your trading strategies adhere to defined risk limits.

It uses a clever caching system, memoization, to store and reuse risk implementations, boosting performance and reducing overhead. When you need to check if a signal is permissible based on risk rules, this service routes the request to the right place.

You can register signals with the risk management system to keep track of open positions, and then later remove those signals when they are closed. The service also allows you to clear the cached risk implementations when needed, providing flexibility in how you manage your risk configurations. 




The `checkSignal` function is key for determining if a trading signal can be executed, performing validations like drawdown and exposure limits. If a signal is rejected, the risk system will notify you through an event.

## Class PositionSizeUtils

This class offers helpful tools for determining how much of your capital to allocate to a trade. It provides several different position sizing methods, like fixed percentage, Kelly Criterion, and ATR-based sizing. Each of these methods is implemented as a static function, so you can easily use them without creating an instance of the class.

When using these methods, the framework will check to make sure the information you provide matches the sizing method you're trying to use, helping prevent errors. Essentially, it streamlines the process of calculating your position size based on various strategies and risk management principles.

## Class PersistSignalUtils

This utility class helps manage how trading signals are saved and restored, particularly for strategies running in live mode. It ensures that signal data is reliably stored and retrieved, even if there are unexpected interruptions.

The class automatically handles creating storage instances for each strategy, making it simple to keep track of signals.  You can even plug in your own custom storage mechanisms if the default isn't what you need.

When a strategy starts, `readSignalData` fetches any previously saved signals so it can pick up where it left off. Conversely, `writeSignalData` saves the current signal state when changes are made, ensuring no data is lost.  The saving process is designed to be safe even if the program crashes mid-save.

Finally, you can extend the persistence capabilities by registering your own adapter using `usePersistSignalAdapter`, which gives you more control over how the data is stored.

## Class PersistScheduleUtils

This class helps manage how scheduled signals are saved and loaded, especially for trading strategies. It ensures that signal information isn't lost, even if there's a system crash.

The system uses a clever approach – it creates separate storage areas for each strategy, which makes things more organized and efficient. You can also customize how data is stored by plugging in your own storage adapter.

When a strategy needs to load its scheduled signals, this class retrieves the data. When a strategy updates a signal, the class saves the updated data. The saving process is designed to be very reliable, ensuring that data isn't corrupted. 

Essentially, it handles the behind-the-scenes work of keeping your trading strategies’ scheduled signals safe and accessible.

## Class PersistRiskUtils

This class helps manage how active trading positions are saved and restored, especially for different risk profiles. It’s designed to be reliable, even if there are unexpected interruptions.

It keeps track of storage locations for each risk profile and allows you to plug in your own ways of storing data. The process of saving and loading positions is handled carefully to prevent data loss, ensuring a consistent state.

The `readPositionData` method retrieves saved position information for a specific risk profile; if no positions were previously saved, it returns an empty record. The `writePositionData` method ensures that position changes are saved to disk safely and reliably.

You can also customize how positions are stored by registering a custom adapter with the `usePersistRiskAdapter` method, allowing you to adapt the system to different storage needs.

## Class PersistPartialUtils

This utility class helps keep track of your partial profit and loss data, ensuring it's saved reliably even if things go wrong. It cleverly uses a system that remembers where each symbol's data is stored, avoiding unnecessary reloads.

You can customize how this data is saved using adapters, allowing for flexibility in storage methods.  The class handles writing and reading partial data to disk, making sure these operations are done safely and without potential corruption. When your system needs to recover partial data, it uses `readPartialData` to load it, and `writePartialData` to safely save changes.  You can also register your own persistence adapter with `usePersistPartialAdapter` to tailor the storage mechanism.

## Class PerformanceMarkdownService

The PerformanceMarkdownService helps you understand how your trading strategies are performing over time. It constantly monitors events related to your strategies and gathers key metrics like average returns, minimum values, maximum values, and percentiles.

This service organizes performance data separately for each trading symbol and strategy you use, preventing them from getting mixed up. You can then request these collected statistics at any time to see a summarized view of how things are going.

Furthermore, it automatically generates easy-to-read markdown reports that detail performance analysis and highlight potential bottlenecks. These reports are saved to your logs directory, allowing for a clear record of your strategy’s history.

The service is designed to be initialized only once, ensuring smooth operation from the start. You can also clear all stored performance data when needed, giving you a clean slate for testing or new analysis.

## Class Performance

The Performance class offers tools to analyze how your trading strategies are performing. It lets you gather overall statistics for a specific trading symbol and strategy. You can get a detailed breakdown of performance metrics, including counts, durations, averages, and volatility measures, giving you a comprehensive view of your strategy's behavior.

The class also generates easy-to-read markdown reports that visually represent your strategy’s performance. These reports highlight time spent on different operations, present detailed statistics in a table format, and help pinpoint potential bottlenecks in your code.

Finally, you can easily save these performance reports to disk, creating a record of your strategy's progress and enabling comparisons over time. The reports are saved as markdown files, making them simple to share and review.

## Class PartialUtils

The PartialUtils class helps you analyze and report on partial profit and loss data collected during backtesting or live trading. It’s like a central hub for understanding smaller, incremental gains and losses, rather than just the overall result.

You can use it to grab summary statistics, like the total number of profit and loss events, giving you a quick overview of how your strategy is performing.  It also allows you to generate detailed markdown reports that present these partial profit/loss events in a nicely formatted table, showing things like the action taken (profit or loss), the symbol traded, the strategy used, and the price at the time.

Finally, you can easily export these reports to a file, with the filename automatically created based on the symbol and strategy name. This lets you keep a record of your partial profit/loss performance for later review. The data itself is managed behind the scenes by the PartialMarkdownService and stored in ReportStorage.

## Class PartialMarkdownService

The PartialMarkdownService helps you keep track of and report on your trading performance in a user-friendly way. It listens for profit and loss events related to your trading strategies and automatically organizes this information. 

It creates detailed markdown reports, essentially tables, that break down each profit and loss event, allowing you to easily review what happened.  You can request statistics like the total number of profit and loss events. The service then saves these reports as markdown files, ready for analysis or sharing.

Each trading symbol and strategy combination gets its own dedicated storage area, ensuring your data stays organized. It handles creating the necessary directories if they don't already exist.  The service sets itself up automatically when you first use it, so you don’t need to worry about manual configuration. There's also a way to completely clear the accumulated data if you need to start fresh.

## Class PartialGlobalService

This service acts as a central point for managing and tracking partial profit and loss information within the trading system. It's designed to be injected into your trading strategies, providing a consistent way to handle these events.

Think of it as a layer between your strategy and the underlying connection service; it logs all partial operations globally before passing them on. This makes it easier to monitor and debug your trading activity.

The service relies on other components, like a logger and connection service, which are provided by the dependency injection container. It also includes validation services to ensure your strategy and associated risks are correctly configured.

Key functions include `profit` and `loss`, which handle reaching new profit or loss levels, and `clear`, which resets the partial state when a signal closes. Each of these functions logs activity at the global level before delegating the work to the connection service.

## Class PartialConnectionService

This service helps track partial profits and losses for your trading signals. It acts like a central manager, creating and handling individual records for each signal. 

Think of it as a system where each trading signal gets its own dedicated area to store its partial profit/loss information. It remembers these records, so you don't have to create them every time.

The service intelligently creates these records as needed, keeping track of them and handling events related to profit and loss. When a signal is finished, it cleans up the record to keep things tidy and prevent unnecessary memory usage. It's designed to work alongside other components in your trading system, ensuring efficient and organized profit/loss tracking.

## Class OutlineMarkdownService

The OutlineMarkdownService helps create documentation for your trading strategies, particularly useful when you're using AI for optimization. It automatically organizes information into markdown files, making it easy to review how your strategy developed. 

It keeps track of key elements like the initial system prompts, user inputs, and the final LLM output, storing them in a structured directory under `./dump/strategy/{signalId}/`. This service is designed to avoid accidentally deleting previous results by skipping directory creation if it already exists.

The service relies on a logger service injected through dependency injection, and its primary function is the `dumpSignal` method. This method takes a signal ID, conversation history, signal data, and an optional output directory to generate and save the documentation files.

## Class OptimizerValidationService

This service acts like a central record-keeper for your optimizers, ensuring they're properly registered and available for backtesting. It keeps track of all known optimizers and their associated details. 

Adding an optimizer to this registry makes it known to the system and ready for validation. The system prevents you from accidentally registering the same optimizer twice.

When you need to confirm that an optimizer is valid for use, this service checks against its internal list – and it remembers previous checks to make the process faster. You can also request a complete list of all registered optimizers if you need a summary of what’s available. 


## Class OptimizerUtils

This set of tools helps you work with strategies generated by your optimizer. 

You can use `getData` to retrieve information about your strategies, essentially pulling together all the details and preparing it for use. 

`getCode` lets you create the actual code for your strategy, combining everything needed to run it.

Finally, `dump` simplifies the process of saving your generated strategy code to a file, automatically organizing it into the right directory and giving it a clear, descriptive filename.

## Class OptimizerTemplateService

The OptimizerTemplateService acts as a central hub for creating the code snippets needed to run your trading strategies using backtest-kit. It's designed to work with large language models (LLMs), specifically through integration with Ollama.

It handles various code generation tasks, including creating initial banner sections, crafting prompts for the LLM, and generating the final configuration files for different components. You can think of it as pre-building much of the structure for your automated trading experiments.

This service provides several key features: it can analyze data across multiple timeframes (like 1-minute, 5-minute, and hourly intervals), formats the LLM’s output into structured JSON for easy signal processing, supports debugging by saving information to a specific directory, and incorporates CCXT exchange integration. A “Walker” feature allows for comparing different strategies.

Specifically, it generates code for:

*   **Walker configurations:** Comparing multiple strategies against each other on a test timeframe.
*   **Strategy configurations:** Incorporating LLM analysis and signal generation across timeframes.
*   **Exchange configurations:** Using CCXT for Binance with standard formatting.
*   **Frame (timeframe) configurations:** Defining the timeframe for backtesting.
*   **Launchers:** Running the Walker with progress tracking and completion handling.
*   **Debug helpers:** Saving LLM conversations and results for analysis.
*   **Text generation:** Using a deepseek model for market analysis.
*   **JSON output:**  Generating trading signals in a specific JSON format, including position details (wait, long, or short), explanations, price targets, and estimated durations.

The service can be customized through configuration, allowing you to adjust certain aspects of the generated code.

## Class OptimizerSchemaService

The OptimizerSchemaService helps keep track of your optimizer configurations, ensuring they're set up correctly. Think of it as a central place to register and manage different optimizer setups.

It validates new configurations as you add them, making sure essential details like the optimizer's name, training range, data source, and prompt retrieval method are all present. 

You can also update existing configurations by partially overriding them—it merges new information with what's already there. Need to fetch a specific configuration?  It provides a straightforward way to retrieve it by its name. The service relies on a ToolRegistry to permanently store these configurations.

## Class OptimizerGlobalService

This service acts as a central point for interacting with optimizers, ensuring everything is done correctly and safely. It keeps track of what's happening, verifies that the optimizer you're trying to use actually exists, and then passes the request on to another service to handle the actual work.

You can use this service to retrieve data related to your optimizers, get the complete code for a trading strategy, or save that code directly to a file. Think of it as a gatekeeper, making sure everything runs smoothly and securely.

Here's a quick look at what it offers:

*   **Data Retrieval:** It can fetch the data needed to build your trading strategies.
*   **Code Generation:** It generates the complete code for your trading strategies.
*   **File Saving:** It can save the generated code directly to a file on your system.

Before it does anything, it confirms the optimizer you've specified is valid, preventing errors and ensuring reliable operation.

## Class OptimizerConnectionService

The OptimizerConnectionService helps you easily work with different optimizers without creating new connections repeatedly. It remembers optimizer instances, creating them only once and reusing them later to save time and resources. 

It combines your custom templates with default templates to ensure you have a complete and consistent setup. You can inject your own logger to monitor what’s happening. 

To actually do the optimization work, it relies on the ClientOptimizer. 

The `getOptimizer` method is your main tool for accessing these optimizers, and it automatically manages the caching process.

The `getData` method helps you collect and organize data to build your strategies. 

`getCode` generates the complete code you need to run your strategies. 

Finally, `dump` simplifies saving your strategy code to a file.


## Class LoggerService

The LoggerService is designed to make logging in your backtesting strategies easy and consistent. It provides a central place for logging messages, automatically adding helpful context like the strategy name, exchange, and frame. You can use its `log`, `debug`, `info`, and `warn` methods to record different types of messages.

If you don't configure a logger, it falls back to doing nothing, ensuring your backtest runs smoothly regardless. You have the flexibility to provide your own custom logger implementation using the `setLogger` method to tailor the logging behavior to your specific needs. The service manages helpful context information using the `methodContextService` and `executionContextService` properties.

## Class LiveUtils

LiveUtils provides tools to simplify running and managing live trading operations. Think of it as a helper class for getting your trading strategies running in real-time.

It uses a special pattern – a singleton – meaning there's only one instance of this class available, making it easy to access from anywhere in your code.

The `run` function is the core of the class; it's an infinite generator that handles live trading for a specific symbol and strategy, and automatically saves progress so it can recover from crashes.  You can also run trading in the background with `background` if you just need it to perform actions like saving data or triggering callbacks without actively processing the results.

Need to pause a strategy? The `stop` function gracefully halts it, allowing current trades to finish before stopping completely.  You can also get performance data with `getData`, generate reports with `getReport`, save those reports to a file with `dump`, or check the status of all running strategies with `list`.

## Class LiveMarkdownService

This service helps you automatically create reports about your live trading strategies. It keeps track of everything that happens – from idle periods to when trades are opened, active, and closed – for each strategy you’re running. 

The reports are generated as Markdown tables, making them easy to read and understand. You'll also get key trading statistics like win rate and average profit/loss. These reports are saved to your logs directory, organized by strategy name.

To get started, the service automatically subscribes to trading signals and begins collecting data. You can also manually clear the stored data if needed, either for a specific strategy or all of them. It's designed to be simple – just let it run alongside your strategies and it’s already doing the reporting for you.

## Class LiveLogicPublicService

This service helps manage live trading operations, making it easier to work with your trading strategies. It handles the behind-the-scenes complexity of keeping track of things like the strategy name and the exchange being used, so you don't have to pass those details around constantly.

Think of it as a continuous stream of trading updates – it never stops generating results, providing information about both opening and closing positions.  If something unexpected happens and the process crashes, it can automatically recover and pick up where it left off by restoring saved data.

The `run` function is the main way to interact with this service; it allows you to specify a symbol and context to initiate live trading, and it automatically handles context propagation for you.

## Class LiveLogicPrivateService

This service helps automate live trading by continuously monitoring market data for a specific symbol. It works by running an ongoing loop that checks for trading signals and then streams the results – only showing when a trade is opened or closed. Think of it as a tireless worker constantly watching and reporting on your trading activity.

Because it’s designed to run indefinitely, it's built with a focus on stability. If something goes wrong, it’s designed to recover and resume trading. The streaming approach also makes it memory efficient, as it doesn't store everything at once.

Key parts of this service include the logger for recording events, the strategy core for the trading logic itself, and a context service for managing information during the process.

To start trading, you call the `run` method, providing the symbol you want to trade. It returns an async generator, which allows you to process the results as they become available.

## Class LiveCommandService

This service acts as a central hub for live trading operations within the backtest-kit framework. Think of it as a convenient way to access the core functionality needed to execute trades in real-time. 

It bundles together several key components, like logging, live trading logic, validation services, and schema management, making them available for use. It’s designed to be used in situations where you need to inject these dependencies into other parts of your application.

The most important thing this service provides is the `run` method. This method allows you to start a live trading session for a specific trading symbol, passing along information about the strategy and exchange being used.  It continuously generates results as trades are executed, with built-in safeguards to help it recover from unexpected errors and keep trading going.

## Class HeatUtils

This class, HeatUtils, helps you visualize and understand how your trading strategies are performing. It acts as a central place to gather and present portfolio performance data in a clear, heatmap-style report. 

You can use it to get the raw data behind the heatmap, showing metrics like total profit, Sharpe Ratio, maximum drawdown, and the number of trades for each individual asset within a strategy. 

It also provides a simple way to generate a formatted markdown report that summarizes this data, sorting assets by profitability.  Finally, you can easily save these reports to your hard drive for later review. Think of it as a tool to quickly get a visual overview of your strategies' strengths and weaknesses.

## Class HeatMarkdownService

This service helps you visualize and analyze your backtest results with a portfolio heatmap. It gathers data from closed trades across different strategies and compiles it into a clear, organized report.

Think of it as a dashboard that gives you a quick overview of how each strategy is performing, along with detailed breakdowns for individual assets. It automatically keeps track of key metrics like profit and loss, Sharpe Ratio, and maximum drawdown.

You can easily generate a markdown report summarizing this information, which is great for sharing or documenting your strategies.  The service handles potential math errors gracefully and efficiently stores data for each strategy separately.

It initializes itself automatically when needed, ensuring that the reporting is ready when you are, and it provides a way to clear the accumulated data when you want to start fresh. The service is designed to be integrated with a signal emitter, handling closed trade signals as they come in.

## Class FrameValidationService

The FrameValidationService helps you keep track of your trading timeframes and make sure they're set up correctly. Think of it as a central hub for managing your frame configurations.

You can add new timeframes using `addFrame`, telling the service about their schema. Before you start any trading operations, `validate` lets you check if a specific timeframe actually exists, preventing errors later on. 

To see all the timeframes you're using, the `list` method provides a handy list of all registered frames. The service also remembers validation results to speed things up – it intelligently caches results so it doesn't have to re-validate frequently used frames.

## Class FrameSchemaService

This service acts like a central place to store and manage the blueprints, or schemas, that define how your trading simulations are structured. It uses a special, type-safe storage system to keep things organized and prevent errors.

You can add new schemas using the `register` method, essentially telling the system "here's a new blueprint for a simulation." If you need to update an existing blueprint, the `override` method lets you make changes without replacing the entire thing.  Need to retrieve a blueprint? Just use `get` and provide the name you assigned it.

This service also performs a basic check when you register new schemas, ensuring they have the necessary components before they've been added to the system. It keeps track of everything, helping to keep your backtesting environment consistent and reliable.

## Class FrameCoreService

The FrameCoreService acts as a central hub for handling timeframes within the backtesting process. It relies on other services to manage connections and validate data, and is a core component used behind the scenes. 

Essentially, it's responsible for figuring out the specific dates and times needed to run your backtest – giving you the timeline for your trading simulation. 

You can use its `getTimeframe` method to get these dates for a given trading symbol and timeframe name, allowing you to define precisely what period you're testing.

## Class FrameConnectionService

This service handles connections to different data frames, like historical data sets, making it easy to work with them in your backtesting. It automatically figures out which frame you’re working with based on the current context.

To improve performance, it caches these frame connections so you don't have to recreate them every time.  Think of it like remembering which data set you’ve already opened.

You can request a specific frame using the `getFrame` method, which is memoized for speed.

The `getTimeframe` method lets you retrieve the start and end dates of a backtest, allowing you to precisely control the period of your simulations. When in live mode, there are no frame constraints, meaning the frame name will be empty.

## Class ExchangeValidationService

The ExchangeValidationService helps keep track of your trading exchanges and makes sure they’re properly set up before your backtesting runs. It’s like a central coordinator for your exchanges.

You can use it to register new exchanges using `addExchange()`, providing details about each one.  Before attempting any trading operations, `validate()` checks if an exchange is registered, preventing errors later on. To improve speed, the service remembers the results of these validations, avoiding repeated checks.  If you need a quick overview of all exchanges you're using, `list()` provides a handy collection of their configurations.

## Class ExchangeSchemaService

The ExchangeSchemaService helps you keep track of your exchange configurations in a structured and type-safe way. It acts like a central repository for exchange schemas, allowing you to register new ones and retrieve them later. 

Think of it as a place where you define what a valid exchange looks like, ensuring consistency across your system. You can add new exchange configurations using `addExchange()` and find them again by name using `get()`. 

Before adding a new exchange configuration, `validateShallow()` checks if it has all the necessary components and that they’re the correct types.  If an exchange configuration already exists, you can update parts of it using `override()`. This service relies on a system for managing types to ensure everything stays organized and predictable.

## Class ExchangeCoreService

This service handles interactions with an exchange, incorporating information about the trading environment like the symbol being traded, the specific time, and whether it's a backtest. It's designed to work closely with other core services within the backtesting framework.

It manages connections to the exchange and includes validation capabilities, remembering previous validations to improve efficiency.

You can use it to retrieve historical price data (candles), request future data specifically for backtesting scenarios, calculate average prices, and format price and quantity values, all while taking into account the current trading context. The service’s methods automatically pass context information related to the execution, making it easy to get data relevant to a specific trade.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It automatically figures out which exchange to use based on the current context, so you don’t have to manually specify it each time. 

It keeps a record of the exchanges it's connected to, so getting information from the same exchange doesn't require re-establishing the connection every time – this speeds things up. 

You can use it to fetch historical price data (candles), get the next set of candles after a specific time, retrieve the average price of a cryptocurrency (either from a live exchange or calculated from historical data), and correctly format prices and quantities to match the rules of the specific exchange you're using. Think of it as a smart intermediary that handles the complexities of communicating with various exchanges.

## Class ConstantUtils

This class provides a set of pre-calculated values used for setting take-profit and stop-loss levels, designed around principles similar to the Kelly Criterion and incorporating an exponential decay of risk. These values represent percentages of the total distance to your final take-profit or stop-loss target.

For example, if you’re aiming for a +10% profit, `TP_LEVEL1` (30) means a trigger at +3% profit, while `TP_LEVEL2` (60) activates at +6%, and `TP_LEVEL3` (90) fires near the final target at +9%. Similarly, the stop-loss levels work the same way – `SL_LEVEL1` (40) provides an early warning, and `SL_LEVEL2` (80) ensures a complete exit before significant losses occur. 

You can use these constants directly when configuring your trading strategies to automate profit-taking and risk management.

## Class ConfigValidationService

The ConfigValidationService helps keep your trading strategies mathematically sound by double-checking your configuration settings. It's designed to catch errors and prevent setups that could lead to losses.

It makes sure things like slippage, fees, and profit margins are set up correctly, ensuring that your take profit distances are sufficient to cover costs. The service also verifies that numerical relationships, like minimum and maximum values for stop-loss distances, are consistent. Finally, it checks that time-related settings, like timeouts and retry counts, have positive integer values to avoid unexpected behavior. Essentially, it’s a safety net to help you avoid common configuration mistakes. 

The `validate` function performs these checks, and the `loggerService` property is used for reporting any validation issues.

## Class ClientSizing

This component, ClientSizing, helps determine how much of your capital to allocate to a trade. It’s designed to be flexible, allowing you to use different sizing approaches like a fixed percentage, the Kelly Criterion, or ATR-based sizing. You can also set limits on your position sizes, ensuring you don’t take on too much risk. 

The ClientSizing component receives instructions through parameters, which configure the sizing method and any constraints. The core functionality lies in the `calculate` method, which takes trading parameters and returns the calculated position size. It's a critical piece in your backtesting process, ensuring trades are sized appropriately based on your strategy's rules.

## Class ClientRisk

The ClientRisk component helps manage risk across your trading strategies. It acts as a gatekeeper, ensuring that your strategies don’t violate any pre-defined risk limits like the maximum number of positions you can hold simultaneously.

Think of it as a central authority that all your strategies consult before opening new trades. Multiple strategies can share the same ClientRisk instance, which is useful if you want to analyze risk across your entire portfolio.

It keeps track of all currently open positions, and provides a way to define custom validation rules to implement more sophisticated risk management.  The `checkSignal` method is key here; it evaluates signals to see if they should be allowed.

The ClientRisk component’s lifecycle involves initializing a record of active positions, persisting those positions to disk, and providing methods (`addSignal`, `removeSignal`) that are used to update this record as strategies open and close positions.

## Class ClientOptimizer

The ClientOptimizer handles the process of optimizing trading strategies, working as a central point for gathering information and generating code. It connects to various data sources, handles pagination to retrieve large datasets, and keeps track of the conversation history needed for more complex optimization tasks. 

This component helps build and generate the code for your trading strategies, including all necessary imports and supporting elements. You can think of it as the engine that takes your optimization requests and turns them into functional strategy code.

Furthermore, it allows you to save the generated code directly to files, making it easy to deploy and manage your strategies. It will automatically create the necessary directories if they don’t already exist.


## Class ClientFrame

The ClientFrame helps your backtesting process by creating the timeline of data it needs. Think of it as the engine that produces the sequence of timestamps used to simulate trading. It's designed to avoid repeating work – once it creates a timeline, it remembers it. You can control how far apart those timestamps are, from very frequent (like every minute) to much larger intervals (like every three days).  It also lets you hook in custom functions to verify the timeline data and record events along the way. 

The `getTimeframe` function is its main feature, providing the actual timeframe array for a given trading symbol. This function uses a clever caching mechanism, so it only generates the timeline once for each period.


## Class ClientExchange

The `ClientExchange` class provides a way to interact with an exchange, specifically designed for backtesting scenarios. It handles retrieving historical and future price data (candles) which is crucial for simulating trading strategies. 

You can easily grab past price movements using `getCandles` or look ahead to get future data with `getNextCandles`.  The `getNextCandles` method is particularly helpful when backtesting, allowing you to simulate how a signal would play out over a certain period.

It also has the capability to calculate the Volume Weighted Average Price (VWAP) using the most recent candles, giving you an idea of the average price weighted by trading volume.  If there’s no volume data, it defaults to a simple average of closing prices.

Finally, `formatQuantity` and `formatPrice` methods are available to ensure that quantities and prices are presented in the correct format as required by the exchange. These functions automatically apply the appropriate precision and rounding based on the trading symbol.

## Class BacktestUtils

The BacktestUtils class provides helpful tools to run and manage backtesting processes. It simplifies running backtests and getting information about them.

You can use the `run` method to execute a backtest for a specific symbol and strategy, allowing you to analyze the results step-by-step.  For situations where you just need to run a backtest for things like logging or callbacks without needing to examine the results as they come in, the `background` method allows you to run the backtest in the background.

If you need to halt a backtest mid-execution, the `stop` method can be used to prevent the strategy from generating new signals, allowing current signals to complete. 

To get a summary of how a backtest performed, `getData` retrieves statistical information about closed signals, and `getReport` generates a formatted markdown report.  The `dump` method allows you to save those reports to a file.  Finally, `list` shows you a current view of all backtest instances and their status.  The class is designed to be easily accessible and uses a singleton pattern to ensure consistent access.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create easy-to-read reports about your trading strategies. It automatically tracks closed trading signals, building a record of their performance.

It listens for updates during backtesting and organizes the data based on the trading symbol and the strategy you're using. The service then transforms this information into nicely formatted markdown tables.

You can save these reports directly to your hard drive in a standardized location, making it simple to review and analyze your backtest results. There's also a way to clear the accumulated data if you need to start fresh or clean up old reports. The service automatically sets itself up when you first use it, so you don’t have to worry about complicated initial configurations.

## Class BacktestLogicPublicService

This service helps manage and run backtesting processes, handling the background details of keeping track of things like the trading strategy, exchange, and timeframe. It simplifies things so you don't have to repeatedly pass this information around when running tests. 

Think of it as a layer on top of the core backtesting engine, taking care of the context behind the scenes.

The `run` method is the primary way to execute a backtest. It takes a symbol as input and delivers results as a stream of data, automatically injecting the necessary context information into the underlying functions as it goes.

## Class BacktestLogicPrivateService

This service manages the whole backtesting process, handling the flow from fetching timeframes to processing trading signals. It works by stepping through different time periods, and when a trading signal tells you to buy or sell, it fetches the necessary price data and executes the trading logic. 

Importantly, it doesn't store everything in memory at once; instead, it streams the results as you go, making it efficient for handling large datasets. If you need to stop the backtest early, you can simply interrupt the process.

The service relies on other core services like the frame service (for timeframes), strategy core (for trading logic), exchange core (for market data), method context service and logger service to do its job.

The `run` method is how you kick off a backtest for a specific stock symbol, and it returns a generator that provides the backtest results as they become available.


## Class BacktestCommandService

This service acts as a central hub for running backtests within the system. Think of it as a gateway to the backtesting engine, making it easy to trigger tests and manage the process.

It's designed to be used by other parts of the system, ensuring consistency and making it simpler to integrate backtesting into different workflows. You'll find it handles things like logging and validating data, so you don't have to worry about those details. 

The primary function, `run`, is how you actually start a backtest. You provide a symbol (like a stock ticker) and some context including the strategy, exchange, and frame being used for the test. The function then returns a series of results as the backtest proceeds.


# backtest-kit interfaces

## Interface WalkerStopContract

This interface defines what happens when a Walker needs to be stopped within the backtest-kit framework. Think of it as a notification that a particular trading strategy, running under a specific walker, is being interrupted. The notification includes the trading symbol, the name of the strategy being stopped, and the name of the walker that triggered the stop. This allows you to react to a Walker's stop signal and target specific walkers or strategies when multiple are running at once. It's a way to manage and control the execution of your trading strategies.

## Interface WalkerStatistics

The `WalkerStatistics` interface helps organize and present the results of backtesting strategies. Think of it as a container holding all the data needed to compare different trading approaches. 

It builds upon the `IWalkerResults` interface, adding extra information specifically for comparing strategy performance.

The key piece of data it holds is `strategyResults`, which is simply a list of all the results collected from running each strategy during the backtest. This allows you to easily see and compare how each strategy performed against the others.

## Interface WalkerContract

The WalkerContract helps you keep track of how a trading strategy comparison is progressing. It provides information about each strategy as it finishes testing, letting you know its name, the exchange and frame it's running on, and the symbol it's analyzing. 

You’ll see details like the strategy's performance statistics, the specific metric being optimized, and its current value.  The contract also shows you the best-performing strategy found so far, along with the overall progress of the comparison – how many strategies have been tested and how many remain. Essentially, it's a way to peek into the backtesting process as it unfolds, letting you understand which strategies are shining and how close you are to completion.

## Interface TickEvent

This interface, TickEvent, provides a consistent structure for all tick events generated during backtesting. Think of it as a central hub for all the data you need to understand what's happening in your simulations. 

Each `TickEvent` captures key details, including when it occurred (`timestamp`), what action triggered it (`action`), and the specifics of the trade involved like the symbol being traded (`symbol`), the signal ID (`signalId`), and the position type (`position`). 

For trades that are opened, active, or closed, you'll find information about the open price (`openPrice`), take profit (`takeProfit`), stop loss (`stopLoss`), and progress towards those levels (`percentTp`, `percentSl`). Closed trades also include details like the profit/loss percentage (`pnl`) and the reason for closing (`closeReason`) along with the trade duration. Essentially, this interface gives you a complete picture of each event’s details.

## Interface ScheduleStatistics

The `ScheduleStatistics` object provides a snapshot of how your scheduled signals are performing. It gives you insight into the total number of signals scheduled, opened (activated), and cancelled. You can see the overall cancellation and activation rates to assess the effectiveness of your scheduling logic.

It also breaks down the average wait times for both cancelled and opened signals, which can help you fine-tune your scheduling intervals. The detailed `eventList` provides a complete history of each individual scheduled event.

## Interface ScheduledEvent

This interface holds all the key details about scheduled, opened, or cancelled trading events, making it easy to build reports and analyze performance. 

Each event has a timestamp indicating when it occurred, and a type to clarify whether it was scheduled, opened, or cancelled. You'll find essential information like the trading symbol, a unique signal ID, and the position type involved. 

The interface also includes pricing details such as the scheduled entry price, take profit levels, and stop-loss prices. For cancelled and opened events, it provides the close timestamp and duration, giving you a complete picture of the trade lifecycle.

## Interface RiskStatistics

This data provides a snapshot of risk management performance, detailing instances where trades were rejected due to risk controls. 

You'll find a complete list of the rejected events, each containing all the relevant information about why it was flagged.  It also summarizes the overall number of rejections that occurred. 

Furthermore, the data breaks down rejections to show how they’s distributed across different trading symbols and strategies, giving you insights into potential problem areas.

## Interface RiskEvent

This data structure describes when a trading signal was blocked due to risk management rules. It captures all the relevant details of that rejection, letting you understand why a signal didn't result in a trade.

You’ll find information like the exact time of the event, the trading pair involved (symbol), and the specifics of the signal that was rejected. It also includes the name of the trading strategy and the exchange used, along with the current market price at the time.  The number of active positions and a comment explaining the reason for the rejection are also recorded, offering context for why the signal was deemed unsuitable.

## Interface RiskContract

This interface describes what happens when a trading signal is blocked due to risk management checks. It's designed to help you understand why a signal didn't get executed. 

You’ll find information like the trading pair involved (symbol), the details of the signal itself (pendingSignal), and which strategy tried to execute it (strategyName).  The interface also includes the exchange name, the current market price when the rejection occurred (currentPrice), and the total number of active positions at that time. 

A key piece is the "comment" field, which explains the reason for the rejection, if available. Finally, a timestamp records exactly when the signal was rejected, allowing you to track these events over time. This is useful for creating reports, monitoring risk management effectiveness, or building custom alerts based on rejected signals.

## Interface ProgressWalkerContract

The `ProgressWalkerContract` helps you monitor the progress of long-running backtesting processes. It provides updates as strategies are processed, giving you insight into how much work remains. 

Each update includes the name of the walker, the exchange being used, the frame in use, and the trading symbol involved. You’ll also get the total number of strategies to be tested, the number of strategies already processed, and a percentage indicating overall completion. This lets you track the status of your backtest without constantly checking logs or interrupting the process.

## Interface ProgressOptimizerContract

This interface helps you keep an eye on how your trading strategy optimizer is doing. It provides updates as the optimizer works, letting you know which optimizer is running, the trading symbol involved, and how many data sources it has to process versus how many it has already handled. You'll see a percentage representing the overall completion, ranging from 0% to 100%, so you can easily monitor the progress of long-running optimization tasks.

## Interface ProgressBacktestContract

This interface helps you monitor the progress of your backtesting runs. It provides information about what's happening behind the scenes as your strategy is tested against historical data. You’ll see the name of the exchange and strategy being used, along with the trading symbol being backtested.

The `totalFrames` property tells you the total amount of historical data being used, while `processedFrames` shows how much has already been analyzed. Finally, the `progress` value, expressed as a percentage, lets you easily see how close your backtest is to completion. These properties are emitted during the background execution of a backtest so you can track its status.

## Interface PerformanceStatistics

This object holds a collection of performance data generated by a trading strategy. Think of it as a report card for your strategy, summarizing how it performed.

It includes the strategy's name, the overall number of events recorded, and the total time it took to run.

The `metricStats` property provides a detailed breakdown of performance metrics, categorized by type, so you can see exactly where the strategy excelled or struggled. 

Finally, `events` gives you access to every individual performance record, allowing for in-depth analysis if needed.

## Interface PerformanceContract

The PerformanceContract helps you understand how your trading strategies are performing. It records details about various operations, like order execution or data fetching, so you can pinpoint areas where things might be slow or inefficient.

Each PerformanceContract contains information such as when the operation happened (timestamp), how long it took (duration), what strategy and exchange were involved, and whether it occurred during a backtest or live trading.  The `previousTimestamp` allows you to track how performance changes over time. Think of it as a way to profile your code and find bottlenecks to optimize your trading system.

## Interface PartialStatistics

This interface holds information about the performance of a trading strategy when it’s broken down into smaller, partial trades. It’s useful for understanding how a strategy performs at different milestones, rather than just the overall result.

You’re given a list of individual profit and loss events, each with detailed information. The `totalEvents` property simply tells you how many events occurred in total.  You can also see separate counts of how many times the strategy made a profit (`totalProfit`) and how many times it experienced a loss (`totalLoss`).

## Interface PartialProfitContract

The `PartialProfitContract` represents a signal reaching a profit milestone during trading. It’s used to track how a strategy’s positions are performing as they reach pre-defined profit levels like 10%, 20%, or 30%.

You're given information about which trading pair (`symbol`), strategy (`strategyName`), and exchange (`exchangeName`) the profit event relates to. The complete details of the signal, including the entry price, take profit, and stop loss, are included as `data`.

The `currentPrice` shows the market price when the profit level was hit, and the `level` property tells you exactly which profit percentage was reached. You can also determine if this event is from a backtest simulation (`backtest`) or live trading. Finally, the `timestamp` provides a record of when this profit level was detected, with the timing dependent on whether it's a live or backtest event.

## Interface PartialLossContract

The `PartialLossContract` describes what happens when a trading strategy hits a pre-defined loss level, like a 10% or 20% drawdown. It's a way to keep track of how much a strategy is losing and when those loss levels are triggered.

Each event provides key details like the trading pair involved (`symbol`), the name of the strategy causing the loss (`strategyName`), and the exchange where the trade is happening (`exchangeName`). It also includes all the original signal data (`data`), the current price (`currentPrice`) at the time the loss was detected, and the specific loss level reached (`level`). 

You're told whether the loss is part of a backtest (analyzing historical data) or live trading (`backtest`), and a timestamp (`timestamp`) indicating exactly when the event occurred. It’s designed for systems like reporting services or custom callbacks to monitor strategy performance.


## Interface PartialEvent

This interface describes a simplified record of profit or loss events during a trading simulation or live trading. It collects key details like when the event occurred (timestamp), whether it was a profit or a loss, the trading pair involved (symbol), the name of the strategy used, a unique identifier for the signal that triggered the trade (signalId), the type of position held, the current market price, the profit/loss level that was hit, and whether the event happened during a backtest or live trading. This structured data allows for easy reporting and analysis of trading performance.

## Interface MetricStats

This interface describes the compiled statistics for a specific performance metric. It holds information like the type of metric being tracked, the number of times it was recorded, and key duration-related figures. You'll find details on the total duration, average, minimum, and maximum values, alongside statistics like standard deviation and percentiles (95th and 99th). It also includes wait time data, providing insights into the intervals between events related to this metric. Think of it as a comprehensive summary of how a particular performance aspect behaved during a backtest.

## Interface MessageModel

This `MessageModel` helps track the conversation when using an LLM, like in backtest-kit’s Optimizer. Think of it as a single turn in a chat – it clearly defines who sent the message (whether it's the system, a user, or the LLM itself) and what the message said. The `role` property tells you the sender, and the `content` property holds the actual text of the message. It's essential for building prompts that remember previous interactions and provide context for the LLM.


## Interface LiveStatistics

The LiveStatistics interface gives you a detailed look at how your trading system is performing in real-time. It collects a wide range of data points, including every event that has occurred during trading, from idle periods to signal closures.

You can easily track the total number of events, the number of closed signals, and how many were wins versus losses. Key performance indicators like win rate, average PNL, and total PNL are provided, helping you understand overall profitability.

Beyond simple profit and loss, it also offers more sophisticated metrics such as standard deviation (a measure of volatility), Sharpe Ratio (which considers risk), and expected yearly returns. All numeric values are carefully managed to avoid misleading results if calculations are not safe.


## Interface IWalkerStrategyResult

This interface, `IWalkerStrategyResult`, represents the outcome of running a single trading strategy within a backtesting comparison. It bundles together key information about that strategy's performance. 

You'll find the strategy's name clearly identified.  Detailed statistics about the backtest, such as profit/loss and drawdown, are included through the `stats` property. A specific `metric` value, used to evaluate and compare strategies, is also provided, and it can be null if the metric couldn't be calculated. Finally, a `rank` is assigned, with '1' signifying the top-performing strategy.

## Interface IWalkerSchema

The IWalkerSchema helps you set up and manage A/B tests for your trading strategies within the backtest-kit framework. Think of it as a blueprint that tells the system which strategies to compare against each other and how. 

You'll give it a unique name for identification, and can add a note for your own documentation. It specifies the exchange and timeframe to use for all the strategies in the test.  

The most important part is the `strategies` property, which is a list of the strategy names you want to evaluate. The system then compares these strategies based on a chosen metric, like Sharpe Ratio, which you can customize.  

Finally, you have the option to include callback functions to respond to specific events during the walker's lifecycle.

## Interface IWalkerResults

This interface holds all the information gathered after running a comparison of different trading strategies. It tells you which strategy was tested, the asset it was tested on, and the exchange and timeframe used. You'll find details about the optimization metric used and how many strategies were evaluated in total. Most importantly, it identifies the top-performing strategy and its score, alongside a full set of statistical data related to that best strategy. Think of it as a report card summarizing the entire backtesting comparison process.

## Interface IWalkerCallbacks

This interface lets you tap into what's happening behind the scenes as backtest-kit runs strategy comparisons. Think of it as a way to listen in on the process and react to different events.

You can get notified when a new strategy’s backtest begins with `onStrategyStart`, receiving the strategy’s name and the trading symbol it's using.  When a backtest finishes, `onStrategyComplete` will let you know, along with the final statistics and a key metric. If something goes wrong during a backtest, `onStrategyError` will alert you, providing information about the error that occurred. Finally, `onComplete` is triggered when all the strategies have been tested, giving you access to the overall results.






## Interface IStrategyTickResultScheduled

This interface represents a tick result within the backtest-kit framework, specifically when a trading strategy has generated a "scheduled" signal. Think of it as the system acknowledging it’s waiting for the price to reach a specific entry point based on the signal. 

It includes details like the strategy and exchange names, the trading symbol involved, and the current price at the moment the signal was scheduled. The `signal` property holds the specifics of the scheduled signal itself, giving you access to all the data associated with that particular trading opportunity.  This is a key event in the trading process when you're planning entries based on future price action.

## Interface IStrategyTickResultOpened

This interface represents a signal that's just been created within your trading strategy. It’s a notification you receive when a new trading signal is generated, validated, and saved.

You'll find details about the signal itself, including its unique identifier and all the data associated with it. The interface also tells you which strategy and exchange generated the signal, along with the trading symbol involved (like BTCUSDT) and the price used when the signal was opened. Think of it as a confirmation that a new trade opportunity has been identified and is ready to be acted upon.

## Interface IStrategyTickResultIdle

This interface represents what happens when your trading strategy is in a quiet, inactive state – we call it “idle.” Think of it as a notification that your strategy isn't currently making any trading decisions. 

It tells you which strategy is idle, the exchange it’s connected to, the trading pair (like BTCUSDT), and the current price at the time. You're essentially receiving a snapshot of the market conditions while the strategy is waiting for a trading opportunity. The `action` property clearly indicates this is an idle state, and the `signal` is `null` because no active trade is being managed. This information helps you monitor your strategies and understand when they’re not actively trading.


## Interface IStrategyTickResultClosed

This interface describes what happens when a trading signal is closed, providing a complete picture of the outcome. It includes the reason for the closure, like hitting a take-profit or stop-loss level, or simply expiring due to time. You'll find the final price used for calculations, the exact timestamp of the closure, and a detailed breakdown of the profit or loss, accounting for fees and slippage. The interface also keeps track of which strategy and exchange were involved, along with the symbol being traded, allowing for comprehensive performance analysis. Essentially, it’s the final report card for a closed trading signal.

## Interface IStrategyTickResultCancelled

This interface describes what happens when a scheduled trading signal is cancelled – essentially, it didn't lead to a trade. It’s used to report that a signal was planned, but didn’t result in opening a position, perhaps because it expired or was stopped out before a trade could be made. 

The data includes the signal that was cancelled, the price at the time of cancellation, the exact timestamp when it was cancelled, and information about the strategy, exchange, and symbol involved, which is all useful for tracking and analysis. It’s a way to see signals that didn’t result in action, helping you understand why your strategy isn't always trading.


## Interface IStrategyTickResultActive

This interface describes what happens when a trading strategy is actively monitoring a signal, awaiting either a take profit, a stop loss, or a time expiration. It essentially means the strategy is "in the zone" waiting for a specific event to occur.

The data provides key details about the situation, including the signal being watched, the current price being used for monitoring, and the names of the strategy, exchange, and trading symbol involved. You're also given information about how far along the strategy is toward its take profit or stop loss targets, expressed as percentages. This lets you track the progress and understand the status of an active trade.

## Interface IStrategySchema

The `IStrategySchema` defines the blueprint for your trading strategies within the backtest-kit framework. Think of it as a description of how your strategy works and how it should be used. 

Each strategy needs a unique `strategyName` for identification. You can also add a `note` to explain your strategy’s purpose for other developers.

The `interval` property sets the minimum time between signals, helping to prevent your strategy from generating too many signals too quickly.

The core of your strategy lies within the `getSignal` function. This function calculates and returns a signal based on market data, returning null if no signal is generated or a validated signal object if one is.  It can be configured to either execute immediately or wait for the price to reach a certain level.

You can optionally include `callbacks` to respond to events like trade openings and closures.  The `riskName` and `riskList` properties allow you to associate your strategy with a specific risk profile, enabling more sophisticated risk management.

## Interface IStrategyResult

This interface, `IStrategyResult`, represents a single row in a comparison table when you're evaluating different trading strategies. It holds the name of the strategy being assessed, a comprehensive set of backtest statistics providing detailed performance data, and a numerical value representing the metric you're using to rank and compare strategies. Think of it as a container for all the important information about how a particular strategy performed during a backtest. It's particularly useful for organizing and presenting results when you want to see which strategies are outperforming others based on a specific benchmark.

## Interface IStrategyPnL

This interface holds the results of a trading strategy's profit and loss calculation. It breaks down the performance with key details like the percentage gain or loss experienced. You’ll find the entry price, which has been adjusted to account for transaction fees and slippage, as well as the exit price, also adjusted for these factors. Essentially, it provides a clear picture of the strategy's profitability after considering real-world trading costs.

## Interface IStrategyCallbacks

This interface provides a way to react to various events happening during your trading strategy's lifecycle. Think of it as a set of optional "hooks" that allow your code to be informed about key moments, like when a new trade is opened, when a trade is actively being monitored, or when a trade is closed.

You can provide functions for each event you want to track: `onTick` gives you updates on every price movement, `onOpen` signals a new trade starting, `onActive` indicates a trade is being monitored, and `onIdle` means no trades are currently open.  When a trade finishes, `onClose` provides the final price.  `onSchedule` and `onCancel` are specific to scheduled trades, notifying you when one is created or cancelled respectively. `onWrite` assists with testing, and finally `onPartialProfit` and `onPartialLoss` let you know when a trade is moving in a favorable or unfavorable direction, but hasn't reached its target or stop-loss. You only need to implement the callbacks you're interested in—the rest are optional.

## Interface IStrategy

The `IStrategy` interface outlines the fundamental methods your trading strategies will use within the backtest-kit framework.

The `tick` method is the heart of your strategy’s execution, handling each new price update. It looks for opportunities to generate signals, monitors the VWAP, and checks if any stop-loss or take-profit conditions have been met.

`getPendingSignal` lets you check what, if any, signal your strategy is currently managing for a specific symbol. This is useful for keeping track of open positions and their associated target prices or expiration times.

For quick analysis, the `backtest` method allows you to run your strategy against historical data, giving you a fast way to evaluate its performance.

Finally, the `stop` method provides a way to pause your strategy from creating new signals, which is helpful for safely shutting down a live strategy without abruptly closing existing trades.

## Interface ISizingSchemaKelly

This interface defines how to size your trades using the Kelly Criterion, a method designed to maximize long-term growth. When implementing this schema, you’re essentially telling the backtest framework you want to use a specific multiplier related to the Kelly Criterion formula.  The `kellyMultiplier` property lets you control how aggressively you size each trade – a lower value like 0.25 (the default) represents a more conservative approach, while a higher value would commit a larger portion of your capital.  Think of it as adjusting the aggressiveness of your position sizing based on the signals you're receiving.

## Interface ISizingSchemaFixedPercentage

This schema lets you define a sizing strategy that always uses a fixed percentage of your capital for each trade.  You simply specify the `method` as "fixed-percentage" and then set the `riskPercentage`.  This `riskPercentage` represents the maximum percentage of your total capital you're willing to risk on a single trade, expressed as a number between 0 and 100.  It's a straightforward way to consistently manage your risk exposure.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, serves as the foundation for defining how much of your account your trading strategy will use for each trade. It provides essential settings like a unique name for identification and a place for developers to add notes. You'll also find controls here to limit your position size – setting maximum and minimum percentages of your account, along with absolute size limits. Finally, it allows for optional callbacks, which can be used to react to different stages of the sizing process.

## Interface ISizingSchemaATR

This schema defines how your trading strategy determines the size of each trade using Average True Range (ATR). 

It’s designed to help manage risk by basing your position size on the ATR, which reflects market volatility. 

The `method` is always set to "atr-based" to indicate this specific sizing approach. `riskPercentage` tells the system what percentage of your capital you're willing to risk on a single trade, for example, 1% would be 1.  Finally, `atrMultiplier` controls how far your stop-loss is placed based on the ATR value, allowing you to fine-tune your risk exposure.

## Interface ISizingParamsKelly

This interface, `ISizingParamsKelly`, helps you define how much of your capital to risk on each trade when using the Kelly Criterion. It's primarily used when setting up your trading strategy within backtest-kit.  You're required to provide a logger, which is a way to keep track of what's happening during your backtesting process and help debug any issues.  Think of it as a tool for observing your strategy's behavior.

## Interface ISizingParamsFixedPercentage

This interface, `ISizingParamsFixedPercentage`, defines how much of your capital you're going to risk on each trade when using a fixed percentage sizing strategy. It’s mainly used when you're setting up your trading engine. The key part is providing a `logger` – this helps you keep track of what's happening and debug any issues you might encounter. Think of the logger as a record-keeping tool for your trading process.

## Interface ISizingParamsATR

This interface, `ISizingParamsATR`, helps you define how much of your capital you're going to risk on each trade when using an Average True Range (ATR)-based sizing strategy within the backtest-kit framework. It’s essentially a way to configure your trade sizing.

The `logger` property lets you connect a logging service to your sizing parameters, allowing you to track and debug the sizing decisions being made—helpful for understanding how your strategy is sizing trades.


## Interface ISizingCallbacks

This interface defines functions that get called during the sizing process in your trading strategy. Specifically, `onCalculate` is triggered after the framework determines the size of a position. You can use this function to inspect the calculated quantity and any parameters used, perhaps to log the information or verify that the size makes sense for your strategy. It’s a way to gain visibility into and potentially influence the sizing logic.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate trade sizes using the Kelly Criterion. Think of it as providing the key statistics about your trading strategy. You're telling the system your win rate, which is how often you expect to be right, and your win/loss ratio, representing the average profit compared to the average loss when you're right. By providing these values, the framework can help you determine an optimal trade size that maximizes long-term growth.


## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate trade sizes using a fixed percentage approach. When using this method, you're telling the backtest kit to size your trades based on a fixed percentage of your available capital, triggered when the price hits a specified stop-loss level. It requires you to specify the `method` as "fixed-percentage" and also the `priceStopLoss` which represents the price at which the sizing calculation takes place. Essentially, this lets you automatically determine how much to trade whenever the price reaches your stop-loss target.

## Interface ISizingCalculateParamsBase

This interface defines the fundamental information needed when figuring out how much to trade. 

It includes the trading symbol, like "BTCUSDT", so the calculation knows what asset is involved. It also provides the current account balance, which dictates how much capital you have available. Finally, it specifies the intended entry price for the trade, helping to determine appropriate sizing.

## Interface ISizingCalculateParamsATR

This interface defines the information needed when you're using the Average True Range (ATR) to determine how much of your capital to allocate to a trade. Essentially, it tells the backtest kit that you want to size your trades based on the ATR. You’re providing the specific ATR value you're using for that calculation – a higher ATR typically suggests a larger position size, and vice-versa, helping manage risk by adapting to market volatility.


## Interface ISizing

The `ISizing` interface is a core component for determining how much of an asset your trading strategy should buy or sell. Think of it as the mechanism that figures out your position size. It’s used behind the scenes as your strategy executes trades.

The `calculate` property is the heart of this interface.  It's a function that you'd implement to provide your custom logic for calculating position size, taking into account factors like your risk tolerance and available capital. This function receives parameters detailing the situation and returns a promise that resolves to the calculated position size.

## Interface ISignalRow

This interface, `ISignalRow`, represents a fully formed trading signal ready to be used within the backtest kit. Think of it as the finalized signal after it's been checked and prepared for execution.

Each signal has a unique identifier, `id`, automatically created for tracking. It includes the entry price, `priceOpen`, and specifies the exchange and strategy involved via `exchangeName` and `strategyName`. 

You'll also find details like the creation timestamp (`scheduledAt`), the time the position became pending (`pendingAt`), and the trading symbol, `symbol`. 

Finally, there’s an internal flag, `_isScheduled`, used by the system to mark signals that have been scheduled.

## Interface ISignalDto

This interface, `ISignalDto`, represents the data used to define a trading signal. It's the format you'll use when creating signals within the backtest-kit framework.

Each signal needs a direction – whether you're going long (buying) or short (selling).  A human-readable note is also essential to explain the reasoning behind the signal. 

You'll also specify the entry price (`priceOpen`), the target price to take profits (`priceTakeProfit`), and a stop-loss price to limit potential losses. Keep in mind that take profit and stop-loss prices have specific requirements based on your trade direction – they need to be above the entry price for long positions and below for short positions. Finally, you can estimate how long the signal is expected to remain active (`minuteEstimatedTime`). 

The system automatically generates a unique ID for each signal, so you don't always need to provide one yourself.

## Interface IScheduledSignalRow

This interface, `IScheduledSignalRow`, represents a trading signal that's designed to be executed when the price hits a specific level. Think of it as a signal that's "on hold" until a certain price is reached. It builds upon the basic `ISignalRow` and introduces the concept of a delayed entry based on `priceOpen`.  Once the price matches the defined `priceOpen`, this signal transforms into a regular pending signal ready for execution. A key aspect is the `pendingAt` property, which initially reflects the scheduled time and is later adjusted to the actual time the signal started pending. Essentially, it allows you to define signals that trigger at a target price, not just based on the current market condition.

## Interface IRiskValidationPayload

This interface, `IRiskValidationPayload`, is the data passed to your risk validation functions within the backtest-kit framework. Think of it as a package of information helping you assess whether a trade should be allowed based on risk constraints. 

It includes the signal that's about to be executed (`pendingSignal`), the total number of positions currently open (`activePositionCount`), and a detailed list of those active positions (`activePositions`). This lets you make informed decisions about risk, considering what's already happening in your portfolio.

## Interface IRiskValidationFn

This type defines a function that's responsible for checking if your risk parameters are set up correctly before a backtest runs. Think of it as a safety net—it verifies that things like maximum position sizes or margin requirements are within acceptable limits. If the validation function detects a problem, it will throw an error to stop the backtest and prevent potentially disastrous results. It helps ensure your trading strategies are tested with sensible risk controls in place.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define how to check if your trading strategies are safe and sound. Think of it as setting up rules to make sure your backtesting process doesn't go off the rails.

It has two main parts: a `validate` function that actually performs the risk check, and an optional `note` field to explain what that validation is doing and why it's important. The `note` is really useful for keeping your code clear and understandable, especially when you have multiple risk validations in place.

## Interface IRiskSchema

This interface, `IRiskSchema`, lets you define custom risk controls for your trading portfolio. Think of it as a blueprint for how you want to manage risk at a high level. 

You give each risk profile a unique `riskName` to identify it.  You can also add a `note` to explain the purpose of the risk profile for your own reference. 

The `callbacks` property allows you to hook into specific moments in the risk assessment process, like when a trade is initially rejected or when it's ultimately allowed.  

Most importantly, the `validations` array is where you define the actual rules that determine if a trade is acceptable. These validations can be either functions or pre-defined validation objects, giving you a lot of flexibility in how you express your risk logic.

## Interface IRiskParams

The `IRiskParams` interface defines the settings you provide when setting up the risk management component of backtest-kit. It's essentially a container for configuring how the system handles potential risk issues.

You're required to supply a `logger` which will be used for outputting debugging information – think of it as a way to keep track of what’s happening behind the scenes. 

Crucially, you also specify an `onRejected` callback. This function gets called whenever a trading signal is blocked due to risk constraints. It allows you to react to these rejections, perhaps logging them, sending notifications, or taking other corrective actions, before the system formally acknowledges the rejection.

## Interface IRiskCheckArgs

The `IRiskCheckArgs` interface holds the information needed to decide if a potential trade should be allowed. Think of it as a safety check performed before a trading signal is created. It provides details like the trading pair's symbol, the signal itself, the name of the strategy that wants to execute it, and information about the exchange and current market conditions – including the current price and timestamp. This interface helps ensure that trades align with risk management rules and conditions.

## Interface IRiskCallbacks

This interface lets you define functions that are triggered during the risk assessment process. You can use `onRejected` to respond when a trading signal is blocked because it exceeds risk limits – this is your chance to log the event or take corrective action. Conversely, `onAllowed` fires when a signal successfully passes all the risk checks, allowing you to confirm its viability or record its approval. These callbacks give you granular control and visibility into how risk management impacts your trading signals.

## Interface IRiskActivePosition

This interface, `IRiskActivePosition`, represents a single trading position that's being monitored for risk assessment across different strategies. Think of it as a snapshot of a trade – it tells you which strategy initiated it, on which exchange, and when it was started. The `signal` property holds the details of the trading signal that triggered the position, giving you insight into why the trade was made. Knowing the `strategyName` and `exchangeName` lets you easily track positions and understand their context within the broader trading system. The `openTimestamp` records precisely when the position began, allowing for accurate timing of risk calculations.

## Interface IRisk

The `IRisk` interface is responsible for managing and enforcing your trading risk rules. It's how your backtest kit knows if a trading signal is safe to execute, and keeps track of your open positions.

You'll use `checkSignal` to see if a signal aligns with your defined risk parameters before actually placing a trade. Think of it as a safety check.

`addSignal` lets you inform the system when you open a new position, so it can accurately monitor your risk exposure. Conversely, `removeSignal` is used when you close a position to update the system’s understanding of your current risk. These functions help maintain a clear picture of your overall risk profile during backtesting.

## Interface IPositionSizeKellyParams

The `IPositionSizeKellyParams` interface helps you define the parameters needed to calculate position sizes using the Kelly Criterion. It's all about figuring out how much to bet based on your expected win rate and how much you typically win compared to how much you lose. You're essentially providing the framework with information about your historical performance to help determine appropriate bet sizes. The `winRate` property tells the system the probability of a winning trade, expressed as a number between 0 and 1. The `winLossRatio` represents the average profit you make for each loss, allowing for a more nuanced calculation.

## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed to calculate position sizes using a fixed percentage of your capital. It’s designed to help you consistently risk a specific portion of your funds on each trade.

The `priceStopLoss` property is crucial – it represents the price at which your stop-loss order will be triggered. This value is used in conjunction with your capital and percentage to determine the appropriate position size.

## Interface IPositionSizeATRParams

This section describes the parameters used when calculating position size based on the Average True Range (ATR).  Specifically, it outlines the `atr` property, which represents the current ATR value – a measure of market volatility. You're essentially providing the framework with the ATR value it needs to determine how much to trade.

## Interface IPersistBase

This interface defines the basic building blocks for saving and retrieving data within the backtest-kit framework. Think of it as a foundation for how your trading strategies and related information are stored and loaded.

The `waitForInit` method ensures the storage area is properly set up and any existing data is checked upon the first run. 

`readValue` is how you fetch a specific piece of data, identified by its unique ID. 

You can quickly check if a piece of data exists using `hasValue`.

Finally, `writeValue` is used to save or update data, guaranteeing a consistent and reliable write process.

## Interface IPartialData

This interface, `IPartialData`, represents a small piece of data that can be easily saved and restored. Think of it as a snapshot of essential information for a trading signal. It’s designed to be saved to a persistent storage system, like a database, and then loaded back later.

Specifically, it holds information about the profit and loss levels that have been hit. These levels are stored as arrays of `PartialLevel` objects, because Sets can't be directly saved in common formats like JSON. When this data is loaded back, these arrays are transformed back into Sets to rebuild the complete trading state. It’s a streamlined way to save and load key milestones for a signal’s progress.


## Interface IPartial

This interface, `IPartial`, is responsible for keeping track of how well (or not) your trading signals are performing. It focuses on milestones like reaching 10%, 20%, or 30% profit or loss.

The `profit` method handles positive performance, calculating and announcing new profit levels as they're achieved. Similarly, the `loss` method does the same for negative performance. Both methods avoid repeating announcements by remembering which levels have already been reported.

Finally, `clear` is used to reset the profit/loss tracking when a trading signal finishes, whether it hits a target, a stop-loss, or its time expires. This cleanup ensures that old data doesn't linger and that resources are freed up.

## Interface IOptimizerTemplate

I'm ready to correct the output. Please provide the text containing the disallowed symbols. I'm here to help refine it.

## Interface IOptimizerStrategy

This interface describes the data structure used to represent a trading strategy that was created with the help of an LLM (Large Language Model). It holds all the information that went into building that strategy, providing a complete picture of the process. 

You'll find the trading symbol the strategy applies to, a unique name for easy identification, and a detailed record of the conversation with the LLM—including the initial prompts and the model's responses. Crucially, it also includes the actual strategy description generated by the LLM, which dictates the trading logic. This complete context is really helpful for understanding *why* a particular strategy was created and for debugging or refining it.

## Interface IOptimizerSourceFn

The `IOptimizerSourceFn` is like a helper that feeds data to your backtesting optimizer. Think of it as a function that provides the historical data your optimizer uses to learn and improve trading strategies. It's designed to handle large datasets by fetching data in chunks, which is called pagination. Importantly, each piece of data it provides needs a unique identifier so the optimizer can keep track of everything.

## Interface IOptimizerSource

This interface helps you define where your backtesting data comes from and how it's presented to a large language model. Think of it as setting up a pipeline – you specify the data source's name, a helpful description, and most importantly, a function to actually retrieve the data. 

The `fetch` function is key; it's responsible for grabbing the data, and needs to handle potentially large datasets through pagination (getting data in chunks).

You can also customize how the data is formatted into messages for the LLM. The `user` and `assistant` properties allow you to create custom formatters to tailor the messages, or if you don't provide these, the framework will use default formatting. This gives you flexibility in how the data is presented to the model.

## Interface IOptimizerSchema

This interface outlines the structure for defining how an optimizer works within the backtest-kit framework. Think of it as a blueprint that tells the system how to create and test different trading strategies.

You'll use `rangeTrain` to specify multiple time periods for training different strategy versions; this lets you compare their performance against each other. `rangeTest` defines the timeframe used to evaluate the final strategy's effectiveness.

`source` is an array of data sources—these contribute information to help generate strategies, almost like providing background context. The `getPrompt` function is crucial; it constructs the prompt that’s sent to the language model to create the trading logic, building on the data provided by the sources. 

`template` lets you customize the generated code, while `callbacks` offer a way to monitor the optimizer's progress and potentially intervene. Finally, `note` provides a place for a helpful description of the optimizer’s purpose.


## Interface IOptimizerRange

This interface, `IOptimizerRange`, helps you define specific time periods for backtesting and optimizing your trading strategies. Think of it as setting the boundaries of when your strategy will be tested or trained. You specify a `startDate` and `endDate` to clearly indicate the timeframe. It’s also helpful to add a `note` to give a brief description of the time range, like "2023 Bear Market" to easily identify it later. This makes organizing and understanding your backtesting experiments much easier.

## Interface IOptimizerParams

This interface defines the settings used when creating an optimizer. It includes a logger, which is used for displaying helpful messages during the optimization process. You'll also find a complete template, combining your own settings with some defaults to ensure everything functions correctly. Think of it as the foundation for configuring how your optimization will run.

## Interface IOptimizerFilterArgs

This interface defines the information needed to request specific data from your data source when running optimization. It lets you pinpoint the trading pairs and time periods you want to use for backtesting. You’re essentially telling the system which symbols – like BTCUSDT – and date ranges you're interested in analyzing. The `startDate` and `endDate` properties clearly outline the boundaries of your data window, ensuring you focus on the data relevant to your optimization goals.

## Interface IOptimizerFetchArgs

When you're fetching data for optimization, these arguments tell the system how much data to grab at a time. The `limit` setting specifies how many records to retrieve in each request—the default is 25, but you can adjust it. The `offset` tells the system where to start fetching from, essentially allowing you to paginate through larger datasets. Think of it like saying "give me 25 records, starting from the 50th record."

## Interface IOptimizerData

This interface, `IOptimizerData`, is the foundation for providing data to the backtest kit’s optimization engine. Think of it as a standard format for your data sources.  Each piece of data you provide *must* have a unique ID. This ID helps prevent duplicate data entries, which is crucial when you're working with large datasets that might be fetched in pages. The `id` property holds that unique identifier, ensuring your data is clean and consistent for optimization.


## Interface IOptimizerCallbacks

This interface provides a way to get notified about important events during the optimization process. You can use these notifications to keep track of what's happening, verify that things are working correctly, or perform actions based on these events.

For instance, you're notified when data is fetched from a specific data source, allowing you to log this activity or check the quality of the data received. Similarly, you get notified when strategy code is generated and saved to a file, enabling you to monitor code creation or perform post-write tasks. The interface also gives you a heads-up when the initial data generation for training strategies is complete, and you can use this opportunity to review the strategies themselves. Essentially, it’s a set of hooks that allow you to interact with and monitor the optimization process as it runs.


## Interface IOptimizer

The `IOptimizer` interface lets you interact with the backtest-kit framework to build and export trading strategies. 

You can use `getData` to retrieve data and create strategy information, essentially prepping the system for optimization. This step gathers everything needed to define and evaluate potential strategies.

`getCode` then assembles all the pieces into a complete, runnable trading strategy, ready to be executed. 

Finally, `dump` allows you to save the generated strategy code directly to a file, organizing it neatly with automatic directory creation if necessary. It creates a `.mjs` file containing all the code you need.

## Interface IMethodContext

The `IMethodContext` interface provides essential information to help backtest-kit figure out which specific strategy, exchange, and data frame to use during a backtest or simulation. Think of it as a little package of clues, passed around within the system, that tells it exactly which components are needed for a particular operation. It holds the names of the schema files defining these key elements: the exchange, the trading strategy, and the data frame providing market information. The frame name is intentionally left blank when running in live mode, as it's not needed in that context.

## Interface ILogger

The `ILogger` interface is how different parts of the backtest-kit framework communicate important information about what’s happening. Think of it as a central place to record events, from general happenings to detailed debugging information.

You can use the `log` method for standard event recording. The `debug` method is for very detailed information you'd usually only want to see when troubleshooting. `info` lets you track key events and successes. Finally, `warn` flags potential issues that need looking into but don’t stop the process. Each method allows you to specify a topic and any relevant details you want to capture.

## Interface IHeatmapStatistics

This structure holds key summary data for your portfolio's heatmap. Think of it as a single snapshot of how your entire portfolio performed. 

It provides a breakdown of statistics for each individual symbol you're tracking, listed within the `symbols` array. 

You'll also find overall portfolio figures here, such as the total number of symbols, the total profit and loss (PNL), the Sharpe Ratio representing risk-adjusted return, and the total number of trades executed across the portfolio. This lets you quickly assess your portfolio’s overall health and performance.

## Interface IHeatmapRow

This interface describes a row in a heatmap that visualizes the performance of your trading strategies. Each row represents a specific trading pair, like BTCUSDT, and summarizes key metrics calculated across all strategies using that pair.

You'll find essential performance indicators here, including total profit or loss as a percentage, the Sharpe Ratio for risk assessment, and the maximum drawdown to understand potential downside. 

It also breaks down trading statistics like total trades, win/loss counts, win rate, and average profit/loss per trade. Further details such as win and loss streaks, expectancy, and standard deviation of profit/loss are also provided, giving you a comprehensive view of how each trading pair is performing.

## Interface IFrameSchema

This interface, `IFrameSchema`, describes a specific timeframe you’re using for your backtest. Think of it as defining a “window” of time, including the start and end dates, and how frequently data points (like prices or indicators) will be generated within that window. Each timeframe gets a unique name to identify it, and you can add a note to help remember what it's for.

You'll specify the interval – for example, daily, hourly, or weekly – to control how often the backtest generates data.  The `startDate` and `endDate` properties pinpoint the beginning and end of your backtest period, making sure you’re analyzing the exact time range you intend to.  Finally, you can add optional lifecycle callbacks to run custom code at different stages of the frame’s processing.

## Interface IFrameParams

The `IFramesParams` interface defines the information needed to set up a frame within the backtest-kit trading framework. Think of a frame as a self-contained environment for executing your trading strategies. It includes a `logger` property, which is crucial for observing what's happening inside the frame during backtesting—it allows you to output debugging information and track the execution flow. Essentially, it’s how you’re going to see what your strategy is doing.


## Interface IFrameCallbacks

The `IFrameCallbacks` interface lets you hook into key moments in the backtest-kit’s timeframe generation process. Specifically, the `onTimeframe` function gets called right after the system figures out the time periods it will use for the backtest. Think of it as a notification – you can use this opportunity to inspect the timeframes being used, perhaps to log them for review or to double-check they're what you expect. This allows you to add custom actions or checks during the timeframe setup.

## Interface IFrame

The `IFrames` interface helps create the timeline your backtest will run on. It’s essentially responsible for figuring out exactly *when* each data point in your backtest should be considered. 

The core function here, `getTimeframe`, is how you tell the framework to produce those specific dates and times. You give it a symbol (like "BTCUSDT") and a frame name (like "1h" for one-hour candles), and it returns an array of dates representing those moments in time ready for your backtest to work with. This ensures your trading logic executes at the correct intervals.

## Interface IExecutionContext

The `IExecutionContext` provides important information about the environment your trading strategy is running in. Think of it as a set of parameters passed along to help your code understand the context of its actions. 

It tells you the trading symbol you're working with, like "BTCUSDT".  It also provides the current timestamp, essentially the "now" for your calculations. Crucially, it indicates whether you're in a backtesting scenario (testing historical data) or running live. This lets your strategy adapt its behavior based on the mode of operation.

## Interface IExchangeSchema

This interface describes how backtest-kit interacts with different cryptocurrency exchanges. Think of it as a blueprint for connecting to a specific exchange and getting the data needed for testing trading strategies. 

Each exchange needs to be registered with backtest-kit using this schema. You’ll provide a unique name for the exchange, and optionally, a note for your own documentation. 

The most important part is `getCandles`, which tells backtest-kit how to retrieve historical price data (candles) for a given cryptocurrency pair and time range. You also define functions to properly format quantities and prices according to the exchange's rules to ensure accurate order placement during backtesting. Lastly, you can optionally set up callbacks to handle specific events as candle data arrives.

## Interface IExchangeParams

The `IExchangeParams` interface is like a set of instructions you provide when setting up a simulated trading environment. It tells the system how to handle logging and provides essential information about the trading context, such as the symbol being traded, the timeframe, and whether it's a backtest. Think of the `logger` as a way to keep track of what's happening during the simulation, and the `execution` property ensures the simulation operates within the correct context. These parameters help customize and control the backtesting process.

## Interface IExchangeCallbacks

The `IExchangeCallbacks` interface lets you define functions that your backtest kit can use to react to information coming from an exchange. Specifically, you can provide an `onCandleData` function. This function gets called whenever the backtest kit pulls historical candlestick data – it gives you the symbol, the time interval (like 1 minute or 1 day), the starting date, the number of candles requested, and an array of the actual candlestick data. It's how you can, for instance, process and display that data as it becomes available.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with simulated exchanges. It provides essential functionalities for retrieving historical and future candle data, crucial for simulating trading strategies.

You can use `getCandles` to get past price data, and `getNextCandles` to peek into the future (within the backtest environment, of course!).

The framework also includes handy methods for dealing with exchange-specific precision – `formatQuantity` and `formatPrice` ensure that orders are correctly formatted for the simulated exchange. 

Finally, `getAveragePrice` lets you quickly calculate the VWAP (Volume Weighted Average Price) based on recent trading activity, giving you a sense of the average price over a short timeframe.

## Interface IEntity

This interface, IEntity, serves as the foundation for all objects that are saved and retrieved from storage within the backtest-kit framework. Think of it as a common starting point, ensuring that every persisted object has a consistent structure. It defines the essential characteristics shared by entities that need to be managed within the system.

## Interface ICandleData

This interface describes a single candlestick, the fundamental building block for analyzing price action and running backtests. Each candlestick represents a specific time interval and contains important information about the trading activity during that time. 

You’ll find the exact moment the candle started recorded as a timestamp (in milliseconds), along with the opening price, the highest price reached, the lowest price seen, the closing price, and the total trading volume for that period. This data is crucial for calculations like VWAP and for evaluating trading strategies over time.

## Interface DoneContract

This interface, `DoneContract`, signals that a background task – either a backtest or a live trading run – has finished. Think of it as a notification letting you know when a long-running process is complete. It gives you key details about what just happened, like the exchange used, the name of the trading strategy involved, whether it was a backtest or live execution, and the trading symbol. It's a handy way to track and understand the outcomes of your automated trading processes.

## Interface BacktestStatistics

This interface bundles together key statistics calculated during a backtest. It gives you a complete picture of how your trading strategy performed.

You'll find a list of every completed trade, along with how much profit or loss each generated.  The interface also provides simple counts of winning and losing trades.

From there, it calculates percentages like win rate and average profit per trade. It also provides more advanced metrics, such as standard deviation (a measure of volatility) and the Sharpe Ratio, which considers both profit and risk. The certainty ratio compares average winning trades against average losing trades. Finally, you're given an estimate of potential yearly returns based on trade duration and profit. Keep in mind that some values might be missing (represented as null) if the calculations were unreliable due to data issues.
