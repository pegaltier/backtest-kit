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

## Function setLogger

You can customize how backtest-kit reports information by providing your own logging system. This allows you to direct log messages to a file, a database, or any other destination you prefer. When you set a logger, backtest-kit automatically adds helpful context to each log message, like the strategy name, exchange, and trading symbol, so you can easily understand where the message originated. To do this, simply pass your logger implementation, which needs to conform to the `ILogger` interface, to the `setLogger` function.

## Function setConfig

This function lets you adjust how the backtest-kit framework operates. You can pass in a piece of a configuration object – you don't need to redefine everything, just the parts you want to change.  There's also a special `_unsafe` flag; use this primarily during testing when you need to bypass some of the safety checks the framework normally performs. It allows for more flexible setup during development and testing scenarios.

## Function setColumns

This function lets you customize the columns that appear in your backtest reports, particularly when generating markdown reports. You can adjust how different data points are displayed by providing a configuration object with your desired settings.  The function checks that your custom column definitions are valid, ensuring they fit the expected structure. If you’re working within a testbed environment and need to bypass these validations, you can use the `_unsafe` flag.

## Function listWalkers

This function allows you to see all the trading strategies, or "walkers," that are currently set up and ready to be used within the backtest-kit framework. Think of it as a way to get a complete inventory of your available trading approaches.  It returns a list containing details about each walker, which is helpful for things like checking configurations, generating a list of strategies for a user interface, or simply understanding what's running behind the scenes.  Essentially, it provides a programmatic way to discover all the strategies you’ve added.


## Function listStrategies

This function helps you discover all the trading strategies your backtest-kit setup knows about. It's like a directory listing, providing a collection of strategy definitions. You can use this to see what strategies are available, for example, to display them in a user interface or to verify your configuration. Essentially, it gives you a look under the hood at the strategies registered within the framework.


## Function listSizings

This function lets you see all the sizing strategies currently set up within your backtest-kit environment. Think of it as a way to peek under the hood and understand how your trades will be sized. It returns a list of configurations, each describing how position sizes are determined, which can be helpful for troubleshooting or displaying available sizing options in an application. Essentially, it gives you a clear view of your sizing rules.

## Function listRisks

This function helps you see all the risk configurations that your backtest kit setup is using. It essentially gives you a list of how different risks are defined and handled in your trading strategy. You can use this list to check your settings, create documentation, or build tools that react to your risk parameters. Think of it as a way to peek under the hood and understand exactly what risks your system is prepared to manage.

## Function listOptimizers

This function lets you see a complete list of all the optimizers currently set up within your backtest-kit environment. Think of it as a way to check what optimization strategies are available for use. It's particularly helpful if you’re troubleshooting, documenting your setup, or building a user interface that needs to display a selection of optimizers. The result is a promise that resolves to an array describing each optimizer.

## Function listFrames

This function helps you see all the different data structures, or "frames," that your backtest is using. Think of it as a way to peek under the hood and understand the data being processed. It gives you a list of descriptions, called schemas, for each of these frames, making it easier to debug, create documentation, or build interactive tools around your backtesting system. Essentially, it's a way to get a clear picture of the data landscape within your backtest.

## Function listExchanges

This function lets you see a list of all the trading exchanges that backtest-kit knows about. It's like getting a directory of available connections. You can use this to check if an exchange is properly set up, create documentation about what's supported, or build a user interface that dynamically adjusts based on available exchanges. The result is a promise that resolves to an array describing each exchange.


## Function listenWalkerProgress

This function lets you keep track of how a backtest is progressing. It’s like setting up a notification system that tells you when each trading strategy within the backtest has finished running. 

The notifications arrive one after another, even if your notification handler takes some time to process them – this ensures things don't get out of order. It handles the timing so you don't have to worry about things running at the wrong time. You provide a function that will be called each time a strategy completes, giving you updates along the way. You can unsubscribe from these updates whenever you're done listening.

## Function listenWalkerOnce

This function lets you set up a one-time listener for events happening within a trading simulation. You provide a filter – a condition that determines which events you're interested in – and a function that will execute once when an event matches that filter. After the callback runs, the listener automatically disappears, so you don't need to worry about manually cleaning up. Think of it as a way to react to a specific, fleeting event in your backtest.

Here's how it works:

*   You give it a rule (`filterFn`) that defines which events you want to watch.
*   You provide a function (`fn`) to be executed when an event satisfies the rule.
*   The function will run only once when the rule is met.
*   The listener automatically stops listening after that one execution.

## Function listenWalkerComplete

This function lets you be notified when a backtest run finishes, ensuring all strategies have been tested. It's perfect for triggering follow-up actions or displaying results after the backtest is complete. The notification happens through a callback function you provide. 

Importantly, this function handles the notification in a safe way – it processes callbacks one at a time, even if your callback involves asynchronous operations. This prevents any unexpected issues from callbacks running concurrently. You'll receive an event containing details about the completion.


## Function listenWalker

This function lets you keep an eye on how your backtest is progressing. It's like setting up a notification system that tells you when each strategy finishes running during a backtest.  The good part is that even if the notification you receive requires some processing (like an asynchronous operation), it will be handled one at a time, in the order they come, preventing things from getting out of control. You provide a function that will be called for each strategy's completion, and this function returns another function that you can use to unsubscribe from the notifications later.

## Function listenValidation

This function lets you keep an eye on potential problems during risk validation. Think of it as setting up a listener that will notify you whenever a validation check fails and throws an error. This is incredibly useful for spotting and fixing issues in your trading strategy's risk management. The errors you receive will be processed one after another, guaranteeing order and preventing any chaotic concurrent execution. You provide a function that will be called whenever an error occurs, allowing you to log, monitor, or react to these validation failures.


## Function listenSignalOnce

This function lets you subscribe to signals from your backtest, but with a twist – it only listens once. You tell it what kind of signal you're looking for using a filter, and then provide a function to run when that signal appears. Once the signal matches your filter, the function executes, and the subscription automatically ends, preventing it from running again. Think of it as setting up a temporary listener to react to a specific event and then disappearing. It’s helpful when you need to react to a single, specific trading signal during your backtest.


## Function listenSignalLiveOnce

This function lets you temporarily "listen" for specific trading signals coming directly from a live backtest run. You provide a filter – a condition that determines which signals you’re interested in – and a function that will be executed only once when a signal matches that filter. Once the function runs, the subscription automatically ends, ensuring you don't keep receiving signals unnecessarily. It's perfect for quickly reacting to a specific event during a live simulation without a permanent subscription.


## Function listenSignalLive

This function lets you tap into the live trading signals generated by backtest-kit. Think of it as setting up a listener that gets notified whenever a signal is produced during a live run.  It's designed for when you need to react to signals as they happen, and it guarantees those signals are handled one after another, in the order they arrive. You provide a function that will be called with the signal details, and the function returns another function that you can call to unsubscribe from receiving these live signals later.  Remember, it only works when using `Live.run()`.

## Function listenSignalBacktestOnce

This function lets you temporarily listen for specific signals generated during a backtest run. Think of it as setting up a temporary listener that only cares about certain types of events. You provide a filter—a way to specify which signals you’re interested in—and a function to execute when a matching signal arrives.  Once that function runs, the listener automatically disappears, ensuring you don’t keep processing signals you don’t need anymore. It’s perfect for quickly grabbing a single piece of information from a backtest without ongoing subscription.


## Function listenSignalBacktest

This function lets you tap into the flow of a backtest and react to what's happening as it runs. Think of it as setting up a listener that gets notified whenever a new signal or event occurs during the backtest.

The function you provide will be called with details about each event, allowing you to do things like log data, update a visualization, or perform other actions in response to the backtest's progress. Importantly, these events are handled one at a time, ensuring a predictable sequence.

This listener is specifically designed to work with events generated by `Backtest.run()`, ensuring that you're receiving relevant information from your backtesting process. The function returns a way to unsubscribe from those events.


## Function listenSignal

This function lets you react to changes in your trading strategy. It's like setting up a notification system – whenever your strategy enters an 'idle,' 'opened,' 'active,' or 'closed' state, this function will call a piece of code you provide. Importantly, the events are handled one at a time, even if the code you provide takes some time to run, ensuring things happen in the correct order and preventing conflicts. You give it a function to execute when an event occurs, and it returns another function you can use later to unsubscribe from these notifications.

## Function listenRiskOnce

This function lets you react to a specific risk rejection event just once and then automatically stop listening. Think of it as setting up a temporary alert – you'll only get notified when the condition you define happens, and then the monitoring stops. You provide a rule (the `filterFn`) to identify the event you’re interested in, and a function (`fn`) that will be executed when that event occurs. It's handy for situations where you need to respond to a condition and then don't need to monitor it anymore.


## Function listenRisk

This function lets you monitor and react to situations where trading signals are blocked because they violate risk rules. It's like setting up an alert that only goes off when something goes wrong with your risk settings.

You provide a function that gets called whenever a signal is rejected due to risk constraints. Importantly, you won't receive alerts for signals that *are* allowed, keeping things clean and preventing unnecessary notifications.

The system ensures your callback function is processed one at a time, even if it involves asynchronous operations, so you don't have to worry about timing issues or conflicts. Think of it as a reliable way to stay informed about potential risk problems.


## Function listenPerformance

This function lets you keep an eye on how long different parts of your trading strategy take to run. It works by sending you updates, called "PerformanceContract" events, whenever a significant operation happens. These events are delivered one at a time, even if your callback function takes some time to process them. This ensures you get a clear picture of where your strategy might be slow, allowing you to optimize its performance. Think of it as a way to profile your code and find those little bottlenecks that can slow things down. To use it, simply provide a function that will handle these performance updates.


## Function listenPartialProfitOnce

This function lets you set up a listener that reacts to partial profit events – essentially, when a trade hits a certain profit level. It’s designed to be a one-time deal: you provide a rule (a filter) to determine which profit events you’re interested in, and a function to run when that rule is met.  Once the function runs, the listener automatically stops, preventing it from triggering again. Think of it as a temporary alert for a specific profit target.

You give it two things: a filter to identify the events you want to catch and a function that will be executed when an event passes your filter. The function then returns a way to unsubscribe the listener if needed.


## Function listenPartialProfit

This function lets you keep track of your trading progress as you reach profit milestones, like 10%, 20%, or 30% gains. It sends you notifications whenever these milestones are hit, ensuring that you're always aware of your performance. Importantly, the notifications are handled in a controlled, sequential order, even if the processing of each notification takes some time. You just provide a function that will be called when a milestone is reached, and it takes care of the rest.

## Function listenPartialLossOnce

This function lets you react to specific partial loss events within your backtest, but only once. You provide a filter to define what kind of loss event you're interested in, and a function to execute when that event occurs. Once the event matches your filter, the provided function runs and the subscription automatically ends, so you don't have to worry about cleaning up. It's a handy way to trigger a specific action just once based on a particular loss condition. 

You give it a way to identify the loss events you want to watch for, and then tell it what to do when one of those events happens. After that one time, it stops listening.


## Function listenPartialLoss

This function lets you monitor your trading strategy’s progress regarding potential losses. It sends notifications when your strategy hits predefined loss levels, like 10%, 20%, or 30% of its capital. Importantly, these notifications are handled one at a time, ensuring that your response to a loss level trigger isn't interrupted by other events. You provide a function that gets called whenever a loss level is reached, and this function will be executed in a safe, sequential manner.

## Function listenOptimizerProgress

This function lets you keep an eye on how your optimizer is doing as it runs. It sends updates about the progress, especially when dealing with data sources, so you can track things along the way. The updates come in order, and even if your update handling function takes some time (like if it's doing something asynchronously), it will be processed one at a time to avoid any conflicts. To stop listening for these progress updates, the function returns another function that you can call when you're done.

## Function listenExit

This function lets you be notified when something goes critically wrong and stops the backtest-kit processes like background tasks. Think of it as an emergency alert for your trading system – when these kinds of errors happen, they halt everything.  It handles these serious errors sequentially, making sure they are processed one at a time, even if your response involves asynchronous operations.  You provide a function that will be called when a fatal error occurs, allowing you to handle it gracefully. When you're done needing to listen for these errors, you can unsubscribe from this event using the function it returns.

## Function listenError

This function allows your strategy to gracefully handle errors that might pop up during its execution, like a failed API request. Think of it as setting up an error listener that catches these problems, processes them one by one in the order they occur, and keeps the strategy running smoothly instead of crashing. The callback function you provide will receive the error details when something goes wrong, letting you take appropriate action. It's designed to prevent multiple error handlers from running at the same time, ensuring a controlled and predictable response.

## Function listenDoneWalkerOnce

This function lets you react to when a background task within your backtest completes, but only once. You provide a filter to specify which completion events you're interested in – it only triggers your callback when the event matches your filter. Once the callback runs, it automatically stops listening, so you don't have to worry about manually unsubscribing. Think of it as a one-time notification system for specific background task finishes.

## Function listenDoneWalker

This function lets you be notified when a background task within the backtest-kit framework finishes. Think of it as setting up a listener for when something is done running in the background. 

It guarantees that your notification code will run one step at a time, even if your code needs to do something asynchronous, so you won't have unexpected issues with multiple things happening at once. You provide a function that will be called when the background task is complete, and this function returns another function to unsubscribe from the listener when you no longer need it.

## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running within your backtest. You provide a filter – a way to select which completed tasks you're interested in – and a function to execute when a matching task is done.  Critically, it only runs your function once and then automatically stops listening, so you don't have to worry about managing the subscription yourself. Think of it as a brief notification system for specific background job completions.

## Function listenDoneLive

This function lets you monitor when background tasks run by Live are finished. It's useful for knowing when a long-running operation has completed. You provide a function that will be called whenever a background task finishes, and this function will handle the results in the order they come. To ensure things don't get chaotic, it makes sure your function runs one at a time, even if it's an asynchronous process. When you’re done listening, you can unsubscribe from these events by calling the function that `listenDoneLive` returns.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but only once. You provide a filter to specify which backtest completions you're interested in, and then a function that will be run when a matching backtest is done. After that function runs, the listener automatically disappears, so you don’t have to worry about cleaning it up. It’s a simple way to get notified about a specific backtest completion and then forget about it. 

Here's how it works:

*   You give it a test – a `filterFn` – that determines if a completed backtest should trigger your reaction.
*   You also give it the action – a `fn` – that should be taken when a backtest passes your test.
*   The function returns another function which you can use to remove the listener if needed.

## Function listenDoneBacktest

This function lets you be notified when a background backtest finishes running. It's designed to handle the completion signal in a safe and orderly way, making sure your code doesn't run into issues due to timing.  Essentially, you provide a function that gets called once the backtest is done, and this function guarantees that your callback will be executed one at a time, even if it involves asynchronous operations. It's a reliable way to respond to backtest completion events.


## Function listenBacktestProgress

This function lets you keep tabs on how a backtest is progressing. It’s like setting up a notification system that calls your provided function whenever a progress update is available during the backtest's background execution. Importantly, these updates happen one after another, even if your function takes some time to process each one, ensuring things don't get out of order. You’ll get a `ProgressBacktestContract` object with each update, containing the details of the progress. When you're done listening, the function returns another function that you can call to unsubscribe.

## Function getMode

This function lets you easily check whether your code is running in backtesting or live trading mode. It returns a simple promise that resolves to either "backtest" or "live", allowing your scripts to adapt their behavior based on the environment.  Think of it as a quick way to know if you're simulating trades or actually trading real money. This is helpful for things like logging, data handling, and risk management.

## Function getDefaultConfig

This function provides you with a set of default settings used by the backtest-kit trading framework. Think of it as a starting point for your configurations – you can examine the values to understand what's possible and how things are set up by default. It returns a read-only object, meaning you can look at the settings, but you can't change them directly through this function. It's a handy way to get a feel for the configurable options before you start customizing your own setup.

## Function getDefaultColumns

This function gives you a peek at the standard column setup used for creating reports. It provides a set of pre-defined column configurations for different data types, like closed trades, heatmap rows, live ticks, and performance metrics.  Think of it as a blueprint – you can examine these default settings to understand what columns are available and how they're typically structured if you're customizing your reporting. It returns an object containing arrays of column models, each defining how specific data should be displayed in your reports.

## Function getDate

This function, `getDate`, helps you find out the current date being used within your trading strategy. It’s useful for making decisions based on the date, whether you're running a backtest or trading live. When backtesting, it gives you the date associated with the historical data point you're currently analyzing. If you’re trading in a live environment, it returns the actual, real-time date.

## Function getConfig

This function lets you peek at the framework's global settings. It gives you a snapshot of things like slippage percentages, fee amounts, and time limits for signal generation. The important thing is, it provides a copy of these settings so you can look at them without changing the actual configuration. Think of it as reading the rulebook without being able to edit it.

## Function getColumns

This function gives you a look at the columns that will be used to create your trading reports. Think of it as getting a snapshot of how your data will be organized and displayed. It provides details for various report sections – backtesting results, heatmaps, live data, partial fills, performance metrics, risk analysis, scheduled events, walker P&L, and strategy outcomes. Importantly, this function returns a copy, so you can examine the column settings safely without changing the actual configuration.

## Function getCandles

This function lets you retrieve historical price data, or "candles," for a specific trading pair like BTCUSDT. You tell it which pair you're interested in, how frequently the data should be grouped (like every minute, every hour, etc.), and how many candles you want to pull back in time.  It uses the connection to the exchange you’ve set up to get this data. The data returned will be an array of candle objects, each containing information like open, high, low, close prices and the time the candle represents.

## Function getAveragePrice

This function helps you figure out the average price a symbol has traded at, specifically using a method called Volume Weighted Average Price or VWAP. It looks at the last five minutes of trading data – the high, low, and closing prices – to determine this average. If there's no trading volume available, it will fall back to calculating a simpler average based just on the closing prices. You provide the trading pair's symbol, like "BTCUSDT," and it returns the calculated average price.

## Function formatQuantity

This function helps you prepare quantity values to be used when interacting with exchanges. It takes a trading pair symbol, like "BTCUSDT," and a numerical quantity as input. Then, it automatically formats the quantity to match the specific rules of the exchange you’re using, ensuring the correct number of decimal places are applied. This prevents errors and helps with seamless trading. Essentially, it takes care of the messy details of quantity formatting for you.

## Function formatPrice

This function helps you display prices in the correct format for a specific trading pair. It takes the symbol like "BTCUSDT" and the raw price as input. It then uses the exchange's own rules to format the price, ensuring it shows the right number of decimal places according to that exchange’s standards. This function returns a formatted string representation of the price.

## Function dumpSignal

This function helps you save detailed records of your AI trading strategy's decisions. It takes the conversation history with your AI, the signal it generated (like entry price, stop-loss, take-profit), and a unique identifier for that particular trade.

It then creates a neatly organized folder containing markdown files that show you exactly how the AI arrived at that signal. You’ll see the initial system prompt, each user message exchanged with the AI, and finally, the AI's output including the trading signal itself.

This feature is particularly useful for debugging and understanding why your AI is making certain trading choices. It avoids accidentally deleting previous logs by only creating the folder if it doesn't already exist. You can also specify a custom output directory if you prefer to store these logs elsewhere.


## Function addWalker

This function lets you register a "walker" – essentially a system that runs backtests for multiple trading strategies simultaneously and then compares how well they did against each other. You provide a configuration object, `walkerSchema`, which tells the walker how to set up and run these comparisons. Think of it as setting up a competition between your strategies, and the walker is the referee and scorekeeper. It allows for a more comprehensive analysis by evaluating strategies within the same environment and using a standardized metric for comparison.

## Function addStrategy

This function lets you tell backtest-kit about a new trading strategy you've created. Think of it as registering your strategy so the framework knows how to use it. When you register a strategy, the system will automatically check it to make sure it's set up correctly, including verifying the signals it produces and preventing it from sending too many signals too quickly. If you’re running backtest-kit in live mode, it also makes sure your strategy's data can be safely saved even if there are unexpected problems. You provide a configuration object, which defines how your strategy works.

## Function addSizing

This function lets you tell the backtest-kit how to determine the size of your trades. You provide a configuration object that outlines your sizing strategy, specifying things like whether you want to use a fixed percentage of your capital, a Kelly Criterion approach, or an ATR-based method. The configuration also lets you set limits on position sizes, like minimum or maximum amounts, and define callback functions to handle sizing calculations. Essentially, you’re defining the rules for how much capital will be allocated to each trade based on your chosen strategy.

## Function addRisk

This function lets you tell the backtest-kit framework about your risk management rules. Think of it as setting up the guardrails for your trading strategies. You'll define limits like the maximum number of trades you can have running at once, and you can also add more complex checks to make sure your portfolio stays healthy – for example, monitoring correlations between different assets. The great thing is that all your strategies share these risk rules, so you get a complete view of your overall risk exposure.

## Function addOptimizer

This function lets you plug in custom optimizers to the backtest-kit framework. Think of an optimizer as a system that takes data, builds conversations with large language models, and then creates full backtesting setups – complete with exchange settings, strategy logic, and everything needed to run tests. You provide a configuration object that defines how your optimizer works, and the framework handles registering it for use. Essentially, it's how you extend the framework's capabilities to generate unique trading strategies.

## Function addFrame

This function lets you tell backtest-kit about a specific timeframe you want to use for your backtesting, like daily, weekly, or monthly data. Think of it as defining the scope of your backtest – when it starts, when it ends, and how frequently you want to analyze the data. You provide a schema that outlines these details, including when the backtest period begins and concludes, the time interval (e.g., daily, weekly), and a way to handle events related to timeframe generation. Essentially, it’s how you configure the timeline your trading strategy will be evaluated against.


## Function addExchange

This function lets you connect your trading framework to a specific exchange, like Coinbase or Binance. You’ll provide a configuration object that tells the framework how to access historical price data, format prices and quantities correctly, and even calculate things like VWAP (a volume-weighted average price). Essentially, it's how you teach the backtest-kit about the specifics of the market you’re simulating. Think of it as defining the rules of the game for a particular exchange.
