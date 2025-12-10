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

This function lets you plug in your own logging system for backtest-kit. It’s a way to see exactly what's happening within the framework, like what strategy is running, which exchange it's using, and the trading symbol. You provide your own logger that follows the `ILogger` interface, and all the framework's internal messages will be routed through it, automatically including helpful context information. This allows for highly customized and detailed logging during backtesting.

## Function setConfig

This function lets you adjust the core settings of the backtest-kit trading framework. Think of it as fine-tuning how the entire system operates. You can pass in a configuration object with only the settings you want to change – you don't need to redefine everything. It’s a promise-based function, meaning it will complete its setup process before continuing to the rest of your backtesting code. You're essentially customizing the environment for your trading strategies.

## Function listWalkers

This function lets you see all the different types of data processing steps (walkers) that are currently set up in your backtesting environment. It returns a list describing each walker, allowing you to understand the sequence of operations being applied to your data. Think of it as a way to inspect the architecture of your trading strategy’s data flow. You can use this information to verify your setup, generate documentation, or even build tools that automatically adapt to different trading strategies.

## Function listStrategies

This function lets you see all the trading strategies that have been set up in your backtest-kit environment. It gives you a list of strategy descriptions, which is handy for understanding what strategies are available, for creating tools to display them, or just for checking things out while you're developing. Essentially, it’s a way to discover and inspect the strategies your system knows about. The function returns a promise that resolves to an array of strategy schemas.

## Function listSizings

This function lets you see all the different sizing strategies that are currently active within the backtest-kit framework. Think of it as a way to peek under the hood and see how your trades are being sized. It returns a list of sizing configurations, each describing how order sizes are calculated. This is really helpful for understanding your backtesting setup, troubleshooting issues, or even building tools to visualize your sizing rules.

## Function listRisks

This function helps you see all the risk configurations that your backtest kit is using. Think of it as a way to peek under the hood and understand how your trading system is assessing and managing risk. It gives you a list of all the risk schemas that you've previously registered, which can be incredibly helpful for troubleshooting, generating documentation, or building user interfaces that adapt to your risk setup. Basically, it's a simple way to get a complete overview of your risk profile.


## Function listOptimizers

This function helps you discover the optimizers currently set up within your backtest-kit environment. It provides a list of all registered optimizers, essentially telling you what optimization strategies are available for use. Think of it as a way to see what choices you have when configuring your trading strategy's optimization process. This is especially helpful if you're exploring different optimization options or want to build tools that automatically adjust optimization parameters.

## Function listFrames

This function gives you a look at all the different "frames" your backtest kit is using. Think of frames as the different data views your strategies operate on – like price data, volume, or custom indicators.  It returns a list detailing each frame, letting you see exactly what's been set up. This is really helpful if you’re trying to figure out how your system is configured, building tools to display your frames, or just generally troubleshooting. It's essentially a way to inspect the structure of your data views.


## Function listExchanges

This function helps you discover all the exchanges that your backtest-kit framework knows about. It fetches a list of exchange configurations, essentially telling you what trading venues are available for your simulations. Think of it as a way to see what data sources and market connections are set up. You can use this information to check your setup, generate documentation, or create user interfaces that adapt to the available exchanges. It returns a promise that resolves to an array of exchange schemas.

## Function listenWalkerProgress

This function lets you keep track of how your backtesting process is going. It's like getting updates after each strategy finishes running within a `Walker.run()` execution.

You provide a function (`fn`) that will be called with details about the progress. The important thing is that these updates are delivered one at a time, even if your provided function needs to do some asynchronous work. This ensures that updates are processed in the order they occur, preventing any potential conflicts or unexpected behavior due to multiple processes happening at once. The function returns an unsubscribe function that you can use to stop receiving progress updates.

## Function listenWalkerOnce

This function lets you temporarily listen for events happening within a process, but only once a specific condition is met. You provide a filter – essentially a rule – that defines which events you're interested in. When an event matches that rule, a callback function you specify will run just once, and then the listener automatically stops. It’s a neat way to react to a particular event happening within a longer process without constantly monitoring everything. 

The `filterFn` determines which events you want to see. 
The `fn` is the action you want to take when the event matches the filter. 


## Function listenWalkerComplete

This function lets you get notified when a backtest run finishes, ensuring all strategies have been tested. It’s like setting up a listener for the final signal from the testing process. The callback function you provide will be executed once the testing is complete. Importantly, even if your callback involves asynchronous operations, it will be handled one at a time to keep things orderly and prevent unexpected issues. You're essentially signing up to receive the results in a controlled, sequential manner. The function itself returns a way to unsubscribe from these completion notifications later on.

## Function listenWalker

This function lets you keep an eye on how your backtest is progressing. It provides updates after each strategy finishes running within the backtest. 

Think of it as a notification system – you give it a function, and it will call that function whenever a strategy completes. Importantly, even if your function takes some time to process the updates (like if it’s doing some calculations), the updates will be handled one at a time, in the order they come.

You pass a function that will be called with information about the completed strategy. When you're done monitoring the backtest, the function returns another function that you can use to unsubscribe from these updates.

## Function listenValidation

This function lets you keep an eye on any problems that pop up during the risk validation process – those checks that make sure your trading strategies are behaving as expected. Whenever a validation check fails and throws an error, this function will notify you. 

It's great for spotting and fixing issues with your signals or risk management.  The errors you receive will be processed one at a time, in the order they happen, even if your error handling code takes some time to run. This ensures that errors are handled in a predictable and controlled manner. You provide a function that will receive these errors, and this function returns another function that you can use to unsubscribe from receiving them.

## Function listenSignalOnce

This function lets you temporarily listen for specific trading signals. You provide a filter – a way to describe exactly which signals you're interested in – and a function that will run *only once* when a matching signal arrives. After that single execution, the listener automatically stops, making it perfect for situations where you need to react to something specific and then move on. Think of it as setting up a temporary alarm that goes off just once. 

It takes two parts: a filter to identify the signals you want to catch, and a function to handle those signals when they occur. The function you provide will be executed just a single time when a signal passes your filter, then the listening stops.

## Function listenSignalLiveOnce

This function lets you listen for specific trading signals coming from a live backtest run. It's designed to react to just one particular event, then stop listening. 

You provide a filter – a way to identify the exact type of signal you’re interested in – and a function that will be executed when that signal is received. Once the signal matches your filter and the function runs, the subscription is automatically cancelled, so you won't receive any further events. It’s useful for tasks like immediately capturing a single data point or triggering a one-off action based on a live signal.


## Function listenSignalLive

This function lets you hook into the live trading signals generated by backtest-kit. Think of it as subscribing to a stream of updates from your running strategy.  It gives you a way to react to each signal as it’s produced during a live run, like when using `Live.run()`.  The signals are delivered one at a time, ensuring that your code handles them in the order they're generated. You provide a function that will be called with each signal, and the function returns another function used to unsubscribe.

## Function listenSignalBacktestOnce

This function lets you temporarily "listen" for specific signals generated during a backtest. Think of it as setting up a quick alert for a particular kind of event. You provide a filter – a rule to identify the signals you’re interested in – and a function that will execute once when a matching signal appears. After that single execution, the listener automatically turns itself off, so you don’t have to worry about managing subscriptions. It's useful for quickly checking a condition during a backtest run without needing a full-blown subscription. The function returns a cleanup function to manually unsubscribe. 


## Function listenSignalBacktest

This function lets you tap into the backtesting process and react to what's happening as the backtest runs. It's like setting up an observer that gets notified whenever a signal is generated. You provide a function – your callback – and it will be called with the signal data as the backtest progresses. Importantly, these signals are handled one at a time, ensuring a reliable and ordered flow of information from the backtest execution. You're essentially subscribing to receive updates on each tick result during the backtest.

## Function listenSignal

This function lets you tap into the trading signals generated by backtest-kit. Think of it as setting up a listener to be notified whenever a trade changes state – whether it’s idle, opened, active, or closed. The key thing is that these notifications are handled one at a time, even if your callback function takes some time to complete. This ensures things happen in the correct order and prevents unexpected issues caused by trying to process multiple signals simultaneously. You simply provide a function that will be called with the relevant trade data each time a new signal is available.

## Function listenPerformance

This function lets you keep an eye on how quickly your trading strategies are running. It provides performance data as it executes, helping you pinpoint areas that might be slowing things down. Think of it as a way to profile your code and see where improvements can be made. The data is delivered to your callback function in the order it’s generated, and the system ensures your callback is handled one step at a time, even if it’s doing something complex asynchronously. To use it, you provide a function that will be called with performance event details whenever relevant metrics are available.

## Function listenPartialProfitOnce

This function lets you set up a listener that reacts to partial profit events, but only once. You provide a condition – a filter – that determines which events you're interested in. Once an event matches that condition, the provided callback function runs, and then the listener automatically stops listening. It's handy when you need to react to a specific profit level just one time and then move on.

The function takes two pieces of information: a filter that defines the conditions for the event and a function that will be executed when a matching event occurs. The filter function checks each event to see if it meets your criteria, and the callback function handles the event once it's found. After that single execution, the listener is automatically removed.

## Function listenPartialProfit

This function lets you keep track of your trading progress by being notified when your profits reach certain milestones, like 10%, 20%, or 30% gains. It's like setting up a system to receive updates as your trades become more successful.  The updates are handled one at a time, ensuring things run smoothly even if the notification process takes a bit of time. You provide a function that will be called each time a profit milestone is reached, and this function will receive details about the event. The function you provide will be executed sequentially, guaranteeing order.

## Function listenPartialLossOnce

This function lets you set up a one-time alert for specific partial loss events within your trading strategy. Think of it as saying, "I want to react to a particular kind of loss, but only once." It takes a filter—a way to identify the exact loss condition you're looking for—and a callback function that will run when that condition is met. Once the callback runs, the subscription automatically stops, preventing repeated actions. It’s a clean way to handle infrequent, time-sensitive loss scenarios. You provide the criteria for what loss event to watch for and what action to take when it happens.

## Function listenPartialLoss

This function lets you be notified whenever your backtest reaches a specific loss level, like 10%, 20%, or 30% of its initial capital. It's designed to handle these notifications in a reliable way, ensuring that events are processed one after another, even if your notification code takes some time to complete. You provide a function that will be called with details about the loss event, and this function returns another function you can use to stop listening for those notifications. Essentially, it provides a way to keep track of your backtest’s performance and react to significant loss milestones.

## Function listenOptimizerProgress

This function lets you keep an eye on how your optimizer is doing as it runs. It sends updates about the optimizer's progress, which you can use to display information or track its status. The updates are delivered one after another, even if your update handling function takes some time to complete. To stop receiving these updates, the function returns a function that you can call to unsubscribe. You provide a function that will be called with each progress event, allowing you to react to the optimizer's actions as they happen.

## Function listenExit

This function allows you to be notified when a serious error occurs that halts the backtest-kit framework's background processes – things like Live, Backtest, or Walker. It's for those critical errors that completely stop what's running.

Unlike other error listeners, this one deals with problems that aren't recoverable and will bring the entire process to a stop.  The errors are handled in the order they happen, and even if your error handling function takes some time to complete, it won't interfere with other queued error events.

To use it, you provide a function that will be called when a fatal error happens, and this function receives an `Error` object containing details about the issue. The function you provide will return another function that you can call to unsubscribe from these fatal error notifications.

## Function listenError

This function lets you set up a listener that's notified whenever a recoverable error happens during your trading strategy's execution. Think of it as a safety net – it catches problems like failed API requests, but allows your strategy to keep running instead of crashing. 

The listener you provide gets called whenever such an error occurs. Importantly, errors are handled one after another in the order they happen, even if your listener function itself takes some time to process the error (like if it's performing an asynchronous operation).  A built-in mechanism ensures that your listener function doesn't run concurrently, preventing potential issues.


## Function listenDoneWalkerOnce

This function lets you react to when a background task in your backtest completes, but only once. Think of it as setting up a single, temporary alert for a specific type of finished task. You provide a filter to specify which finished tasks should trigger your alert, and then a function that will run once when that filtered event occurs. After it runs once, the alert is automatically removed, so you don't have to worry about cleaning up. It's useful for actions that need to happen only once after a background process finishes.


## Function listenDoneWalker

This function lets you be notified when a background task within your backtest simulation finishes. Think of it as setting up a listener to get a signal when a particular process is done. The signal includes information about the completed process. Importantly, the notifications are handled one at a time, ensuring things happen in the order they're received, even if the notification processing itself involves asynchronous operations. This guarantees a reliable sequence of events during your backtesting.




You provide a function that will be called with details of the completed task. The function you provide will be unsubscribed automatically when the listener is no longer needed.

## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running within the backtest-kit framework. You provide a filter – a way to specify which finishing tasks you're interested in – and a callback function. 

Once a background task completes and matches your filter, the callback function will be executed just once, and then the subscription automatically stops. It's a convenient way to respond to specific background task completions without needing to manage ongoing subscriptions.

## Function listenDoneLive

This function lets you tap into when background tasks within your backtest are finished running. It's particularly useful when you're dealing with tasks that might take some time and you need to react to their completion in a controlled way. 

Essentially, you provide a function that will be called whenever a background task finishes, and this function will be executed one after another, even if it’s an asynchronous operation. This helps to ensure things happen in the order they should, preventing unexpected behavior. The function you provide returns another function to unsubscribe from these completion events.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but only once. You provide a filter to specify which backtest completions you're interested in, and then a function that will be executed just once when a matching backtest finishes. After that single execution, the listener is automatically removed, so you don’t need to worry about cleaning it up. Think of it as setting up a temporary notification for a specific backtest outcome. 

It's useful for actions you only want to perform once when a backtest concludes, like displaying a final result or triggering a follow-up process. 

The `filterFn` lets you tailor the notification to specific backtest conditions, and the provided function `fn` is the code that will run upon that single backtest completion.

## Function listenDoneBacktest

This function lets you get notified when a backtest finishes running in the background. Think of it as setting up a listener that waits for the backtest to complete. When the backtest is done, the function you provide will be called, allowing you to react to the results. Importantly, even if your reaction involves some asynchronous processing, these notifications happen one after another, in the order they occurred, to keep things organized and prevent any unexpected issues from happening at the same time. You're essentially setting up a reliable way to be informed about the backtest's conclusion.


## Function listenBacktestProgress

This function lets you keep an eye on how your backtest is running. It’s like setting up a notification system that tells you about the progress as the backtest performs calculations. 

You provide a function that will be called whenever a progress update is available. Importantly, even if your function takes a little time to process each update, the updates will be handled one after another to avoid any conflicts. This makes it a reliable way to monitor long-running backtests. 

The function returns another function that you can use to unsubscribe from these progress updates whenever you no longer need them.

## Function getMode

This function tells you whether the trading framework is currently running a backtest or operating in live trading mode. It's a simple way to check the environment your strategies are running in, allowing you to adjust behavior accordingly. The function returns a promise that resolves to either "backtest" or "live", providing a clear indication of the running mode. You can use this information to conditionally execute code or adjust parameters based on the environment.

## Function getDate

This function, `getDate`, provides a simple way to retrieve the current date within your trading strategy. Think of it as a reliable way to know what date your code is operating on. When running a backtest, it will tell you the date associated with the specific historical timeframe you're analyzing. If you're running your strategy live, it will return the actual, real-time date. It's helpful for things like implementing date-based logic or displaying information to the user.

## Function getCandles

This function lets you retrieve historical price data, or "candles," for a specific trading pair. Think of it as pulling up a chart of how a cryptocurrency or stock has performed over time. 

You specify which trading pair you’re interested in, the time interval for the candles (like every minute, every hour, etc.), and how many candles you want to see. 

The function then goes to the exchange you're connected to and grabs the data. The candles are retrieved starting from the most recent time available on the exchange.

## Function getAveragePrice

This function helps you figure out the average price a symbol has traded at recently. It calculates what’s called a Volume Weighted Average Price, or VWAP, which gives more weight to prices where more trading happened. The calculation uses the last five minutes of trading data, specifically looking at the high, low, and closing prices of each minute. 

If there's no trading volume available, it simply calculates the average of the closing prices instead. To use it, you just need to provide the trading pair's symbol, like "BTCUSDT".

## Function formatQuantity

The `formatQuantity` function helps you ensure the quantity you're using for trading aligns with the specific rules of the exchange you're connected to. It takes the trading pair symbol, like "BTCUSDT", and the raw quantity value as input. This function then applies the exchange's formatting rules to correctly represent the quantity, including handling the right number of decimal places.  Using this function ensures your orders are submitted in a way the exchange understands and avoids potential errors due to incorrect formatting.

## Function formatPrice

This function helps you display prices correctly for different trading pairs. It takes the trading symbol, like "BTCUSDT," and the raw price as input. Then, it automatically formats the price to match the specific rules of the exchange, ensuring the correct number of decimal places are shown. This simplifies displaying price data in a user-friendly way.

## Function dumpSignal

This function helps you save detailed logs of your AI trading strategy’s decision-making process. It takes the conversation history with the LLM, along with the resulting trade signal, and neatly organizes them into markdown files.

Think of it as creating a snapshot of the AI’s reasoning, which is incredibly useful for debugging and analyzing why a trade was taken. It generates files detailing the system prompt, each user message, and the final LLM output along with the trade signal data.

You can specify where these log files should be saved, or it will default to a "dump/strategy" folder. The function is designed to be safe, skipping the output if the directory already exists, so you won’t lose any previous logs. The directory name is based on a unique identifier you provide, like a UUID, making it easy to track different trading results.

## Function addWalker

This function lets you register a "walker" which is like a special tool for comparing different trading strategies against each other. Think of it as setting up a system where multiple strategies run on the same historical data, and the walker then evaluates how well each strategy performed. You provide a configuration object, the `walkerSchema`, to define how this comparison should happen. This allows for a structured and standardized way to analyze and contrast different trading approaches.

## Function addStrategy

This function lets you register a trading strategy within the backtest-kit framework. Think of it as telling the system about a new way you want to trade. 

The system will automatically check that your strategy's signals make sense—things like ensuring price data is valid and that stop-loss and take-profit orders are logical. 

It also handles preventing excessive signals and, if you're running live tests, ensures your strategy’s data is safely stored even if something unexpected happens.

You provide a configuration object describing your strategy as input to this function.

## Function addSizing

This function lets you tell the backtest-kit how to determine the size of your trades. It’s essentially a way to define your risk management strategy. You provide a configuration object that outlines how position sizes are calculated, including details like the sizing method you’re using (fixed percentage, Kelly Criterion, or ATR-based), the risk parameters involved, and any constraints you want to put on the size of your positions. Think of it as setting the rules for how much capital you’re willing to risk on each trade. This helps ensure your trading strategy is managed responsibly and aligns with your overall risk tolerance.

## Function addRisk

This function lets you set up how your trading system manages risk. Think of it as defining the guardrails for your automated trading.

You can specify limits like the maximum number of trades allowed at once across all your strategies.

It also allows you to create custom checks, going beyond simple limits – things like analyzing how your different strategies interact or looking at broader portfolio metrics.

The system uses this risk configuration to assess every trading signal, potentially rejecting signals that would push your trading beyond safe parameters. This ensures all strategies benefit from the same risk management rules.


## Function addOptimizer

This function lets you tell the backtest-kit framework about a new optimizer you want to use. An optimizer is essentially a system that takes data, builds a conversation with an LLM, and creates a complete, runnable backtesting strategy. It handles all the heavy lifting of setting up the testing environment, including defining exchanges, strategies, and how data is analyzed across different timeframes.  You provide a configuration object that describes how this optimizer should work, and the framework will register it for use in your backtesting process.

## Function addFrame

This function lets you tell backtest-kit how to generate the timeframes it will use for testing your strategies. Think of it as defining the schedule for your backtest – specifying the start and end dates, and how frequently data points should be created. You're essentially providing the framework with the blueprint for creating the sequence of time periods it needs to run your tests. The `frameSchema` you provide contains all the necessary details, like the start and end dates of your backtest and the interval between data points.

## Function addExchange

This function lets you tell backtest-kit about a new exchange you want to use for testing. Think of it as introducing the framework to your data source – whether it's Binance, Coinbase, or your own custom data feed. You provide a configuration object that describes how to access historical price data, how to display prices and quantities, and how to calculate the Volume Weighted Average Price (VWAP). Essentially, it sets up the framework to understand and work with data from that specific exchange.

# backtest-kit classes

## Class WalkerValidationService

The WalkerValidationService helps ensure your trading strategies are set up correctly by checking that the configurations for your trading "walkers" – those components that execute trades – are valid. 

Think of it as a quality control system. You register the expected structure of each walker using its schema, and then the service can verify that your actual walker configurations match those expectations. 

You can add walker schemas to the service, validate individual walkers against their schemas, and get a complete list of all registered walker schemas to keep track of everything. It helps prevent errors and makes your backtesting process more reliable.

## Class WalkerUtils

The WalkerUtils class offers a simple way to work with and manage your trading walkers. It streamlines the process of running walkers, collecting results, and generating reports, abstracting away some of the more complex underlying operations.

You can easily run a walker comparison for a specific symbol using the `run` method, which handles things like automatically figuring out the walker's name and logging its progress.  If you just want a walker running in the background for tasks like logging or triggering callbacks, without needing to see its progress updates, the `background` method is a great option.

Need to halt a walker's signal generation? The `stop` method provides a safe way to do so, ensuring existing signals finish normally and preventing new ones from being created.  You can also retrieve the results of walker comparisons with `getData` and create easy-to-read markdown reports with `getReport`.  The `dump` method saves these reports directly to your disk, and `list` provides a quick overview of all your active walker instances and their status.  The `_getInstance` property is an internal mechanism for managing individual walker instances, ensuring each symbol-walker combination operates independently.

## Class WalkerSchemaService

The WalkerSchemaService helps you keep track of your trading strategies' structures in a safe and organized way. It's like a central repository where you store the blueprints for your trading logic, ensuring they all follow a consistent format.

You can register new strategy blueprints using `addWalker()`, and easily find them later by their names using `get()`. Before registering a new blueprint, `validateShallow()` checks it to make sure it has all the necessary parts and they’ve been defined correctly. 

If you need to update an existing strategy's blueprint, `override()` lets you make changes without replacing the entire thing. This service leverages a special system for storing these blueprints in a type-safe way, which means it helps prevent errors.

## Class WalkerMarkdownService

This service is designed to automatically create and save detailed reports about your backtesting strategies. It listens for updates from your trading simulations, carefully tracking the results of each strategy.

It organizes these results, storing them separately for each trading strategy you're running. You can then request these results, or have the service generate a formatted Markdown report containing a comparison of all your strategies.

The service is responsible for saving these reports as Markdown files, creating the necessary folders if they don't already exist.  It handles the initial setup automatically, but you can also clear out the collected data if needed, either for a specific strategy or all of them.

## Class WalkerLogicPublicService

The WalkerLogicPublicService helps you manage and run your trading strategies, simplifying the process by automatically passing along important information like the strategy name, exchange, frame, and walker name. Think of it as a helper that makes sure your strategies have the data they need without you having to explicitly provide it every time.

It works alongside the WalkerLogicPrivateService and WalkerSchemaService, acting as a convenient interface.  You can use the `run` method to execute comparisons for a specific trading symbol; this runs backtests across all defined strategies and handles the context automatically. It’s designed to streamline your backtesting workflow.

## Class WalkerLogicPrivateService

This service helps you compare different trading strategies against each other. Think of it as a coordinator that runs each strategy one after another and keeps you updated on their progress. 

It works by executing each strategy using a separate service and then providing you with ongoing updates about how each strategy is performing.  You'll get feedback as each strategy finishes, allowing you to monitor the comparison in real-time.

Finally, it delivers a complete report ranking all the strategies based on their performance, so you can easily see which ones did the best. 

To use it, you provide the trading symbol, a list of strategies to compare, the metric you want to use for evaluation (like profit or Sharpe ratio), and some context information about the trading environment.


## Class WalkerCommandService

The WalkerCommandService acts as a central hub for interacting with the core walker functionality within the backtest-kit. Think of it as a simplified gateway, making it easier to manage dependencies and access different parts of the system.

It bundles together several essential services, including those responsible for logging, handling the logic of the walker itself, managing schemas, and validating different components like strategies, exchanges, and frames.

The `run` method is the primary way to kick off a walker comparison. You provide a symbol (like a stock ticker) and context information – specifying the walker, exchange, and frame names – and it will generate a sequence of results for analysis. This allows you to test and compare different trading approaches.

## Class StrategyValidationService

The `StrategyValidationService` helps ensure your trading strategies are set up correctly before you start backtesting. It keeps track of your strategy definitions, making sure they exist and have the necessary risk profiles.

You can add your strategy definitions to the service using `addStrategy`, essentially registering them for later validation.  The `validate` function then checks if a specific strategy exists and if its associated risk profile is properly defined. If you need to see all the strategies currently registered, `list` provides a convenient way to get a list of them. The service relies on a logger for reporting and a risk validation service to confirm risk parameters are valid.

## Class StrategySchemaService

This service acts as a central place to store and manage the blueprints, or schemas, that define your trading strategies. Think of it as a library of strategy templates. 

It uses a special system to keep track of these schemas in a type-safe way, ensuring everything is structured correctly. You can add new strategy schemas using the `addStrategy` function (represented here as `register`), and retrieve them later by their assigned names using the `get` function.

Before a strategy schema is officially added, it undergoes a quick check (`validateShallow`) to make sure it has all the necessary pieces and that those pieces are the right types. If you need to update an existing strategy's blueprint, the `override` function lets you make partial changes.

## Class StrategyGlobalService

StrategyGlobalService acts as a central hub for managing and interacting with trading strategies within the backtest framework. It combines the functionality of connecting to strategies with the ability to inject necessary information like the trading symbol, timestamp, and backtest settings.

It keeps track of strategy validations to avoid unnecessary checks and logs those activities. You can use it to retrieve pending signals for a specific symbol, which is helpful for monitoring things like take profit, stop loss, and time expiration. It also allows you to determine if a strategy has been stopped.

To run a quick backtest against a set of historical candle data, you can utilize the `backtest` function. When you need to prevent a strategy from generating new signals, the `stop` function will handle that. Finally, the `clear` function helps refresh a strategy's internal state by removing it from the cache, ensuring you're working with the latest version.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub for interacting with your trading strategies. It intelligently routes requests to the correct strategy implementation based on the symbol and strategy name you specify. To improve performance, it keeps a record of these strategies, so it doesn't have to recreate them every time you need to use them.

This service ensures your strategies are properly initialized before any trading operations are performed, whether you're running live ticks or backtesting historical data. You can retrieve the currently active pending signal for a strategy, check if it’s been stopped, and clear the cached strategy instance to force a fresh start. The `stop` function halts a strategy's signal generation, and the `clear` function lets you reset a strategy's state and release associated resources. Essentially, it simplifies the process of managing and executing your trading strategies.

## Class SizingValidationService

The SizingValidationService helps ensure your trading strategies are using valid sizing methods. Think of it as a quality check for how much capital your strategy is allocating to each trade. 

You can add different sizing rules—like fixed percentage, Kelly Criterion, or ATR-based sizing—by using the `addSizing` method, specifying a name and a schema for each. The `validate` method lets you check if a sizing method exists and, optionally, verifies its configuration. 

If you need to see all the sizing methods you've registered, the `list` method provides a simple way to retrieve them. It's all about ensuring your sizing configurations are correct and consistent within your backtesting framework.

## Class SizingSchemaService

The SizingSchemaService helps you keep track of your sizing schemas in a structured and type-safe way. It uses a registry to store these schemas, making it easy to manage them.

You can add new sizing schemas using the `register` method, update existing ones with `override`, and retrieve them by name with `get`. Before a schema is added, it's quickly checked to make sure it has all the necessary parts thanks to the `validateShallow` process. This service simplifies the process of working with sizing schemas within your backtesting framework.

## Class SizingGlobalService

This service handles the logic for determining how much of an asset to buy or sell in your trading strategies. Think of it as the engine that figures out your position sizes based on your risk tolerance and other factors. 

It uses a connection service to get the necessary data and a validation service to ensure your sizing requests are valid. 

The core functionality is the `calculate` method, which takes your sizing parameters and a context (like a sizing name) and returns the calculated position size. This service is designed to be used internally by the backtest-kit framework, and also provides a public API for your strategies to leverage.

## Class SizingConnectionService

The SizingConnectionService helps manage how position sizes are calculated within your trading strategy. It acts as a central point, directing sizing requests to the correct sizing implementation based on a name you provide.

Think of it as a smart router – you tell it which sizing method you want to use (like fixed percentage or Kelly Criterion), and it handles finding and using the right tool for the job.  It’s also designed to be efficient, remembering previously used sizing methods so it doesn’t have to recreate them every time.

This service allows you to specify sizing methods explicitly and provides a way to calculate position sizes while incorporating risk management considerations. The `calculate` function is how you actually trigger the size calculation. For strategies that don't need specific sizing configurations, the sizing name will be an empty string.

## Class ScheduleUtils

The `ScheduleUtils` class helps you keep track of and understand how your scheduled trading signals are performing. It's designed to make it easier to monitor things like how many signals are queued, cancelled, and how long they're waiting. 

Think of it as a central place to gather information about your scheduled signals, providing helpful statistics and reports. You can use it to see how things are going for a specific trading symbol and strategy. 

It offers methods to retrieve data, generate formatted markdown reports for analysis, and even save these reports directly to a file. The class is set up to be easily used throughout your project.

## Class ScheduleMarkdownService

This service automatically generates and saves reports about scheduled and cancelled signals for your trading strategies. It keeps track of these events, creating detailed markdown tables that show exactly when signals were scheduled or cancelled and providing useful statistics like cancellation rates and average wait times.

The service listens for signal events and organizes the data per strategy, ensuring each strategy's reports are kept separate. You can retrieve the accumulated statistics or request a full report in markdown format for a specific trading symbol and strategy. It also has a convenient `dump` function to save these reports directly to disk, creating the necessary folders if they don’t already exist. 

To get started, the service handles its own initialization, so you don’t need to worry about setting anything up.  You can also clear the stored data if you need to reset or clean up old reports.

## Class RiskValidationService

The RiskValidationService helps you ensure your trading strategies adhere to specific risk guidelines. Think of it as a system for defining and enforcing rules about potential risks. 

You start by adding risk schemas – essentially, blueprints for what a valid risk profile looks like – using the `addRisk` function. Then, when you want to check if a particular risk profile is valid, you use the `validate` function to confirm it matches the defined schema. 

If you need to see all the risk schemas you've registered, the `list` function provides a handy way to view them. The `loggerService` property allows integration with your logging system, while `_riskMap` is used internally to manage the registered risk schemas.

## Class RiskSchemaService

The RiskSchemaService helps you organize and manage your risk schemas in a safe and structured way. Think of it as a central place to store and update your risk profiles.

It uses a special type-safe storage system to keep everything organized and prevent errors. You can add new risk profiles using `addRisk()` and easily find them later by their names.

The service includes checks to make sure your risk profiles have the necessary information before they are registered.  If you need to make small changes to an existing profile, you can update it with `override`. And, of course, you can retrieve any registered risk profile using its name with the `get` method.

## Class RiskGlobalService

This service helps manage and enforce risk limits within the backtest-kit framework. It acts as a central point for validating risk configurations and interacting with a risk connection service.

The service keeps track of opened and closed signals, registering them with the risk management system so limits can be properly monitored. It also has a feature to clear risk data, either for a specific risk instance or all data at once.

Validation of risk configurations is handled efficiently by memoization, preventing unnecessary repeated checks. The service also provides logging to keep track of validation activity. 




The main components you'll find here are the logger, the connection to the risk system, and the risk validation logic itself.  You can use it to check if a trade signal is allowed based on configured limits, add a signal when a trade is opened, or remove it when the trade is closed.

## Class RiskConnectionService

The RiskConnectionService acts as a central point for handling risk checks in your backtesting system. It intelligently directs risk-related operations to the specific risk implementation that’s configured for a particular strategy.

Think of it as a smart router: when your strategy needs to check if a trade is allowed based on risk limits, this service figures out which risk checker to use and makes the call. It keeps track of these risk checkers (memoization) to speed things up, so it doesn't have to recreate them every time.

The service provides methods for checking signals, adding new signals to the risk system, removing closed signals, and clearing the cached risk checkers when they're no longer needed. If your strategy doesn’t have any risk configuration, you’d use an empty string as the risk name.

## Class PositionSizeUtils

This class provides helpful tools for determining how much of your capital to allocate to a trade. It offers pre-built calculations for several popular position sizing strategies.

You’ll find methods for fixed percentage sizing, which allocates a predetermined percentage of your balance to each trade.  There’s also a Kelly Criterion implementation, a more complex method that considers win rates and win/loss ratios to optimize for long-term growth. Finally, an ATR-based sizing method is available, using Average True Range to estimate volatility and size positions accordingly.

Each method takes into account specific inputs relevant to its calculation and includes validation steps to ensure the inputs align with the chosen sizing approach.  Essentially, this class simplifies the process of figuring out your trade size.

## Class PersistSignalUtils

This class, PersistSignalUtils, helps manage how trading signals are saved and restored, ensuring your strategies remember their state even if things go wrong. Think of it as a reliable memory for your trading bots.

It provides a way to safely store signal data for each strategy, using a system that automatically handles creating storage locations. You can even customize how this data is stored by plugging in your own storage solutions. 

When a strategy starts up, this class is responsible for loading any previously saved signal information. When a strategy changes its signal, this class makes sure that change is saved in a way that prevents data loss, even if the system crashes. This is achieved through atomic file writes. 

If you want to use a different way to store this data, you can register a custom adapter to control the storage mechanism.

## Class PersistScheduleUtils

This class helps keep track of your trading strategy's scheduled signals – those signals that are planned to execute at a specific time – so they aren't lost if something unexpected happens. Think of it as a reliable memory for your strategy's future actions.

It automatically manages how these signals are stored for each strategy, using a special storage system that's tailored to avoid data loss. You can even customize this storage system if you need something specific.

The `readScheduleData` function lets you retrieve those planned signals when your strategy starts up again, ensuring everything is back on track. Conversely, `writeScheduleData` makes sure those planned signals are safely saved whenever they change, using a technique that helps prevent errors if there’s a sudden interruption.

Finally, you have the option to plug in your own storage methods if the built-in ones don’t quite meet your needs with `usePersistScheduleAdapter`.

## Class PersistRiskUtils

This utility class helps manage and save the details of your active positions, particularly when dealing with different risk profiles. It's designed to keep things reliable, especially if your application encounters problems.

It automatically handles storing these position details for each risk profile, using a clever technique to avoid repeatedly creating storage instances. You can even plug in your own custom storage methods if needed. 

The class ensures that when you add or remove signals affecting your positions, the changes are saved securely to disk, using techniques to prevent data loss if something goes wrong.  It's a key part of how ClientRisk keeps track of your active positions and restores them when needed, making sure your trading setup is persistent even after interruptions. Finally, you have the flexibility to register a custom adapter for advanced persistence scenarios.

## Class PersistPartialUtils

This utility class, `PersistPartialUtils`, helps manage and save partial profit/loss information for your trading strategies, ensuring that data isn't lost even if something goes wrong. It cleverly uses a memoized storage system, meaning it remembers which storage instances it's using for different symbols to avoid unnecessary creation. 

You can even customize how the data is stored by registering your own persistence adapter. When you need to load previously saved data, `readPartialData` will retrieve it, returning an empty object if nothing's been saved yet. Conversely, `writePartialData` securely saves changes to the partial data, using special techniques to prevent data corruption in case of crashes. These save operations are done atomically, ensuring the data remains consistent.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing by gathering and analyzing key metrics. It listens for performance events and organizes them by strategy and trading symbol. You can then request aggregated statistics like average returns, minimum values, and percentiles. It’s capable of producing easy-to-read markdown reports detailing performance, including potential bottlenecks, and saving them to your logs directory. 

The service keeps track of performance data separately for each trading symbol and strategy combination, ensuring isolated and accurate analysis. It's designed to be initialized only once to avoid unnecessary overhead. You can clear the accumulated data whenever you need to start fresh. It utilizes a logger to output debugging information and a memoized function to manage storage efficiently.

## Class Performance

The Performance class helps you understand how well your trading strategies are doing. It provides tools to collect performance data, analyze where time is being spent, and create easy-to-read reports.

You can retrieve detailed performance statistics for a specific trading symbol and strategy, giving you a breakdown of metrics like duration, average time, and volatility. 

Need a visual summary? The `getReport` method generates a Markdown report highlighting time distribution, detailed statistics, and percentile analysis to pinpoint performance bottlenecks.  Finally, you can save these reports directly to your file system using the `dump` method.

## Class PartialUtils

The PartialUtils class is your go-to for understanding how your trading strategy is performing based on partial profit and loss data. Think of it as a reporting tool that takes information gathered during backtesting or live trading and presents it in a clear, organized way.

It lets you pull out key statistics like the total number of profit and loss events.  You can also generate a nicely formatted Markdown report which will present each event as a row in a table, including details such as the action taken (profit or loss), the symbol traded, the strategy used, the position size, and the timestamp.

Finally, it has a handy function to automatically save that report to a file on your disk, so you can easily review it later. The filename will be based on the symbol and strategy you’re analyzing.

## Class PartialMarkdownService

This service helps you keep track of your partial profits and losses, creating easy-to-read reports. It listens for profit and loss events, organizing them by the trading symbol and strategy used.  You can then generate markdown reports summarizing these events, complete with detailed information and overall statistics.  These reports are automatically saved to disk, allowing you to review your performance over time. The service handles the storage for each symbol and strategy separately, preventing data from getting mixed up. It also automatically initializes itself when you first use it, and provides a way to completely clear all accumulated data when needed.

## Class PartialGlobalService

This service acts as a central hub for managing partial profit and loss tracking within your trading system. Think of it as a gatekeeper that sits between your trading strategies and the underlying connection layer. It ensures that all profit and loss calculations are logged and handled consistently.

The system injects this service into your trading strategies, allowing for easy monitoring and centralized control. It relies on other services for tasks like validating strategy configurations and retrieving schema information.

Key functions include recording and processing profit and loss events, as well as clearing those records when a trade concludes. Each action is first logged at a global level before being passed on to the connection layer to handle the actual details. This design provides a clear and manageable flow for tracking partial gains and losses in your backtesting environment.

## Class PartialConnectionService

This service manages the tracking of partial profits and losses for each trading signal. It acts like a central hub, ensuring that each signal has its own dedicated record to hold this information.

It cleverly remembers previously created records, avoiding unnecessary creation. When you need to record a profit or loss, it either retrieves an existing record or creates a new one, automatically setting up the necessary tools for logging and event notifications.

When a trading signal is closed, the service handles clearing out the profit/loss data and cleans up the related record to keep things tidy and prevent memory issues. It’s designed to work seamlessly with the broader trading strategy and the system’s logging and event handling.

## Class OutlineMarkdownService

This service helps create readable documentation files for your trading strategies, especially useful when debugging or analyzing how an AI-powered system is making decisions. It automatically organizes information from your AI's conversations and outputs into a clear folder structure. 

The service automatically saves system prompts, user inputs, and the final LLM output as individual markdown files within a dedicated directory for each strategy. This makes it easy to review the entire process, step-by-step. It’s designed to prevent accidental overwriting of previous results by only creating files if the directory doesn's already exist. The main function is `dumpSignal`, which handles the creation of these files based on signal data, conversation history, and the designated output directory.

## Class OptimizerValidationService

This service helps keep track of your optimizers, making sure they exist and are properly registered within your backtesting system. It essentially acts as a central record of all the optimizers you're using. 

You can add optimizers to this registry using the `addOptimizer` method, and it makes sure you don't accidentally register the same optimizer twice.  If you need to verify that an optimizer is registered, the `validate` method provides a quick and efficient way to do so - it even remembers previous checks to speed things up. Finally, `list` allows you to see all the optimizer schemas that are currently registered. This can be helpful for understanding what optimizers are available or for debugging.

## Class OptimizerUtils

This section provides helpful tools for working with your trading strategies, particularly when you’re using an optimizer. 

You can use `getData` to retrieve all the information about your strategies, including how they performed during training. It essentially gathers the data needed to understand your strategies’ behavior.

`getCode` lets you generate the full code for your trading strategy, ready to be executed. Think of it as taking all the pieces and assembling them into a runnable program.

Finally, `dump` allows you to save that generated strategy code directly to a file, creating the necessary folders and naming the file in a clear, organized way so you can easily find and use it.

## Class OptimizerTemplateService

This service acts as a central hub for creating the code snippets that drive the backtest-kit optimizer. It leverages an LLM, specifically through Ollama, to generate various parts of the trading strategy code.

It handles several key areas, including crafting the initial setup code (the "top banner"), constructing prompts for the LLM to analyze data and generate trading signals, and generating code for comparing different strategies (using a "Walker").

The service also provides code for configuring exchange connections (like Binance through CCXT), defining the timeframe for analysis, and launching the trading process. Debugging is simplified with built-in helpers for saving conversations and results.

Finally, it manages the formatting of the trading signals themselves, providing a standardized JSON schema that includes details like position, explanation, entry/exit prices, and estimated duration. The service can be customized to some extent when setting up the optimizer.

## Class OptimizerSchemaService

This service helps you manage and keep track of different optimizer configurations. Think of it as a central place to store and organize how your backtesting strategies are set up. 

It lets you register new optimizer setups, making sure they have the essential information before they're added to the system. You can also retrieve existing setups by name when you need them.

If you need to adjust an existing setup, it offers a convenient way to partially update it, combining your changes with the original configuration. It validates the basic structure of your optimizer setups to prevent errors. This service uses a tool registry for securely storing these configurations.

## Class OptimizerGlobalService

This service acts as a central hub for working with optimizers, ensuring everything runs smoothly and safely. Think of it as a gatekeeper – it handles logging, makes sure the optimizer you're trying to use actually exists, and then passes the request on to another service to do the actual work.

Inside, you’ll find components responsible for logging activities and validating optimizers.

The `getData` function lets you retrieve data and generate strategy details, while `getCode` crafts complete, runnable strategy code. Finally, `dump` generates and saves strategy code to a file, simplifying the process of creating and storing your strategies.

## Class OptimizerConnectionService

This service helps manage connections to optimizers, making it easy to use them repeatedly without creating new connections each time. It keeps a record of optimizer instances, so getting one is quick and efficient. 

It combines any custom templates you provide with default templates to create the final configuration. You can inject a logger to get insights into what's happening. The service ultimately passes the work of running the optimizer to a dedicated client.

To get an optimizer instance, use `getOptimizer`, which also provides ways to clear or control the caching process. `getData` pulls information and prepares it into strategy metadata, while `getCode` produces the actual code you can run. Finally, `dump` allows you to easily save the generated code to a file.

## Class LoggerService

The LoggerService helps you keep your trading backtests organized and easy to understand by providing a consistent way to record what’s happening. Think of it as a centralized logging system that automatically adds helpful information to your messages. 

It's designed to work with any logging system you prefer; you can plug in your own implementation through the `setLogger` method. If you don't provide one, it will default to a basic "no-op" logger. The service then adds extra details to your log messages, such as the name of the trading strategy, the exchange being used, the specific timeframe, the asset being traded, the time of the event, and whether it's a backtest or not. 

The `log`, `debug`, `info`, and `warn` methods are your primary tools for logging messages at different severity levels, and they all include this automatic context injection. The `methodContextService` and `executionContextService` properties are internal components managing the context data.

## Class LiveUtils

The LiveUtils class simplifies running and managing live trading sessions within the backtest-kit framework. Think of it as a central hub for live trading operations, providing a convenient and robust way to execute strategies.

It offers a way to start live trading for a specific symbol and strategy, which runs continuously and automatically recovers from crashes to prevent data loss. You can also initiate a background trading process, perfect for situations where you want live trading to perform actions like saving data or triggering callbacks without needing to directly process the results.

To control live trading, you can stop a strategy from generating new signals, allowing existing trades to complete naturally. The class also provides tools for monitoring the status of live trading instances, retrieving statistical data, generating reports, and saving those reports to disk. Essentially, it gives you comprehensive control and insights into your live trading activities.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically generate reports about your trading strategies as they run. It listens to every trade event – from when a strategy is idle to when a trade is opened, active, or closed – and organizes that information. 

It then turns this data into easy-to-read Markdown tables showing the details of each trade, and it also calculates key statistics like win rate and average profit/loss. These reports are saved as files, making it simple to review your strategy’s performance over time. 

The service is designed to be self-managing; it automatically sets itself up to receive trade events and generates reports without requiring a lot of manual configuration. You can also clear the stored data or force a report dump if needed.

## Class LiveLogicPublicService

This service helps manage live trading, simplifying the process by automatically handling things like the strategy and exchange being used. It acts as a convenient layer on top of another core service.

Think of it as a continuous stream of trading signals—it runs forever, providing opened and closed signals as they happen. You don't need to manually pass information about your strategy or exchange into functions; it's all handled for you.

If something goes wrong and the process crashes, it’s designed to recover and continue from where it left off by saving its state. You can start trading and let it run, knowing it's resilient and automatically configured.


## Class LiveLogicPrivateService

The `LiveLogicPrivateService` helps manage live trading by continuously monitoring market data and executing strategies. It operates as an infinite loop, constantly checking for new signals and actions. 

Think of it as a tireless worker that streams trading results – only showing you when a position is opened or closed, not when things are just running normally.  It uses an asynchronous generator to deliver this information efficiently, meaning it sends data only as needed. 

If something goes wrong and the process crashes, it automatically recovers the trading state, ensuring continuity.  You provide the symbol you want to trade, and it takes care of the rest, providing a stream of real-time trading updates. It also leverages services for logging and managing the context of the trading method.

## Class LiveCommandService

This service acts as a central hub for managing live trading operations within the backtest-kit framework. It provides a straightforward way to access key components like logging, live trading logic, validation services, and strategy schema management.

Think of it as a simplified interface for triggering and overseeing live trading sessions. The `run` method is the main entry point; it initiates a live trading sequence for a specific trading symbol, passing along important information about the strategy and exchange being used.  

Crucially, `run` operates as an ongoing, resilient process—an infinite generator—meaning it’s designed to handle unexpected interruptions and automatically recover from crashes, ensuring continuous trading execution.

## Class HeatUtils

This class is your helper for creating and saving portfolio heatmaps within backtest-kit. Think of it as a convenient way to visualize how your trading strategies performed across different assets. It gathers statistics automatically, so you don't have to manually calculate things like total profit, Sharpe ratio, or maximum drawdown for each symbol. 

You can easily get the raw data for a specific strategy using `getData`, which gives you a breakdown per symbol along with overall portfolio metrics.  `getReport` transforms this data into a nicely formatted markdown table sorted by profitability, perfect for sharing results. Finally, `dump` saves that report to a file on your computer, creating any necessary folders to keep things organized. It’s designed to be a simple, single point of access for all your heatmap needs.

## Class HeatMarkdownService

This service helps you visualize and understand the performance of your trading strategies using a portfolio heatmap. It automatically gathers information about closed trades from your signal emitter and organizes it for easy analysis.

You can think of it as a reporting tool that provides key metrics like total profit/loss, Sharpe Ratio, and maximum drawdown, both for individual assets and for your entire portfolio. It creates clear markdown tables to summarize the data, making it simple to spot trends and evaluate strategy effectiveness.

The service is designed to be straightforward to use. It initializes itself automatically, stores data separately for each strategy, and offers functions to retrieve data, generate reports, save those reports to files, and clear the accumulated data when needed. It handles potentially problematic math values so you don't have to worry about errors in your reports.

## Class FrameValidationService

The FrameValidationService helps you make sure your trading strategies are using the right data structures, called frames. Think of it as a quality control system for your data.

You initially set up the service, and then you register the expected structure of each frame – essentially telling it what a valid "frame" should look like.

You can then use the service to check if a frame exists and conforms to its registered schema, flagging any discrepancies.

The service keeps track of all the registered frame schemas, and you can request a list of them whenever needed. This is helpful for understanding what frames your system expects.

## Class FrameSchemaService

This service acts as a central place to store and manage the structure of your trading frames – think of it as a library of blueprints for how your backtest data is organized. It uses a special type-safe system to keep track of these blueprints, making sure everything stays consistent and avoids errors.

You can add new frame blueprints using the `register` method, or update existing ones with the `override` method.  If you need to get a specific blueprint, the `get` method allows you to retrieve it by its name.  Before a new blueprint is added, it's quickly checked to make sure it has all the necessary components using a validation process. 


## Class FrameGlobalService

This service manages the generation of timeframes needed for backtesting. It works closely with a connection service to fetch the data and a validation service to ensure the timeframes are correct. 

Think of it as the engine that provides the sequence of dates and times your trading strategies will be tested against. 

Specifically, the `getTimeframe` method is your key tool, allowing you to request a timeframe array for a particular trading symbol and timeframe name (like 'minute', 'hour', or 'daily'). This method handles the complexities of fetching and validating that timeline for you.

## Class FrameConnectionService

This service acts as a central hub for working with different trading frames, like daily, weekly, or monthly data. It automatically figures out which frame implementation to use based on the current trading context.

The service keeps track of frame instances for efficiency, so it doesn't have to recreate them every time you need them. Think of it as a smart organizer for your frame data.

You can get a specific frame by name, and it manages the timeframe boundaries – the start and end dates – for backtesting purposes. This helps limit your backtest to a defined period.

It relies on other services, like the logger, frame schema, and method context services, to function correctly. 

The `getTimeframe` method lets you get the start and end dates for a specific symbol and frame, ensuring your backtests are focused on the dates you need.

## Class ExchangeValidationService

The ExchangeValidationService helps ensure your trading strategies are compatible with different exchanges. It’s like a central registry for exchange information, letting you define and check the expected data formats for each one. 

You can add new exchanges and their associated data structures to the service using `addExchange`. The `validate` function allows you to test if an exchange is properly registered and its data conforms to the defined schema. If you need to see which exchanges are currently recognized, the `list` function provides a handy way to retrieve that information. The `loggerService` property is for internal logging purposes, and the `_exchangeMap` holds the exchange schemas.

## Class ExchangeSchemaService

This service helps you keep track of information about different cryptocurrency exchanges, ensuring everything is structured correctly. It uses a type-safe system to store these exchange details.

You can add new exchanges using the `addExchange` function, and retrieve them later by their names using the `get` function. Before adding an exchange, the system checks to make sure it has all the necessary information with `validateShallow`. 

If you need to update an existing exchange’s details, you can use the `override` function to make partial changes.  The `loggerService` helps keep track of what's happening.

## Class ExchangeGlobalService

The ExchangeGlobalService acts as a central hub for interacting with exchanges, making sure the right information is available for each operation. It combines exchange connection details with information about the specific trading scenario, like the symbol being traded, the time period, and whether it’s a backtest or live execution.

It handles tasks like validating exchange configurations, which it remembers to avoid repeating unnecessary checks.

The service provides methods for retrieving historical and future candle data, calculating average prices, and formatting price and quantity information. These methods all incorporate the context of the trading execution, ensuring accuracy and consistency. Essentially, it streamlines exchange interactions by injecting the necessary context into each operation.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently routes your requests to the correct exchange implementation based on the context of your operation. 

Think of it as a smart switchboard – you tell it what you want to do (like fetch candles or get the average price), and it automatically connects you to the right exchange. 

To make things efficient, it remembers (caches) the connections to exchanges so it doesn’t have to create new ones every time.

It also handles the details of formatting prices and quantities to ensure they comply with each exchange’s specific rules. This means you don't need to worry about those details yourself, making your code cleaner and less error-prone.

It relies on other services to understand which exchange to use and track the current time for fetching data.


## Class ConstantUtils

This class provides pre-calculated percentages that help define take profit and stop loss levels for your trading strategies. These values are based on the Kelly Criterion and a risk decay model, designed to optimize profit capture while managing risk.

Think of these as guideposts for your trading:

*   **TP_LEVEL1 (30):** A first opportunity to lock in a small portion of your profits, roughly 3% of the total profit target.
*   **TP_LEVEL2 (60):** Secures a larger portion of the potential profit, about 6% of the total, while allowing the trade to potentially continue.
*   **TP_LEVEL3 (90):** A final chance to exit most of the position, leaving a minimal amount exposed.
*   **SL_LEVEL1 (40):** An early warning sign that the trade might be going wrong, allowing you to reduce your risk.
*   **SL_LEVEL2 (80):** Your last resort to exit the trade and prevent a significant loss.

Essentially, these constants provide a framework for strategically managing your take profit and stop loss points within a trading strategy.

## Class ClientSizing

This component, ClientSizing, helps determine how much of your capital to allocate to a trade. It's designed to be flexible, offering several common sizing strategies like fixed percentages, the Kelly Criterion, and ATR-based sizing. You can also set limits on the minimum and maximum position sizes, along with a percentage cap to prevent overly large positions.

The ClientSizing class takes a set of parameters to configure its behavior, and provides a `calculate` method that actually performs the sizing calculation based on the current market data and your chosen strategy. This helps ensure that your trading positions are consistent with your risk management plan.

## Class ClientRisk

ClientRisk helps manage risk across your trading strategies, preventing trades that might violate your configured limits. It essentially acts as a safety net, ensuring your portfolio stays within acceptable boundaries.

This component tracks active positions across all strategies, giving you a holistic view of your risk exposure. You can define maximum position limits, and ClientRisk will prevent signals from being executed if they would cause those limits to be exceeded.  It also allows you to add your own custom validation rules, letting you tailor risk management to your specific needs, accessing all currently open positions during validation.

Several strategies can share the same ClientRisk instance, enabling cross-strategy risk analysis.  The system initializes position tracking and persists it to disk to maintain state, although it skips this in backtest environments. Signals are registered when a position is opened and removed when a position is closed, keeping the active position map updated. The `checkSignal` method is the core of the validation process, evaluating each signal and triggering callbacks to indicate whether it’s allowed.

## Class ClientOptimizer

This class helps manage the optimization process for your trading strategies. It's responsible for gathering data from various sources, building the necessary history for interacting with LLMs, and generating the final code for your strategies. 

It works by collecting data, often in batches, and then uses that data to create strategy metadata. You’ll also find it helps in assembling conversation histories used when working with LLMs to refine your strategies.

The class can generate entire strategy code blocks, complete with all the necessary parts to make them executable.  It also has a handy `dump` function that lets you save this generated code directly to a file, creating the necessary directory structure if needed. This makes it easy to deploy your optimized strategies.

## Class ClientFrame

The `ClientFrame` is the engine that creates the timelines for your backtesting. It's responsible for generating the sequences of timestamps that your trading strategies will run against. 

It's designed to be efficient; it caches the generated timeframes so it doesn't recreate them unnecessarily. You can adjust how far apart these timestamps are, from one minute to three days. 

The `ClientFrame` also lets you hook in custom logic, like checks to ensure the data is valid or to record events during the timeframe generation. Think of it as the behind-the-scenes worker that feeds your backtest with the historical data it needs. The core method is `getTimeframe`, which produces the array of dates for a specific trading symbol.


## Class ClientExchange

This class provides a way to interact with an exchange, specifically designed for backtesting scenarios. It allows you to retrieve historical and future price data (candles) based on a specific time frame and interval. You can request candles from the past to analyze historical performance, and pull candles from the future to simulate signal execution during a backtest.

It also provides a convenient way to calculate the VWAP (Volume Weighted Average Price) based on recent trading activity, which is useful for understanding price trends. 

Finally, the class handles the complexities of formatting quantities and prices to match the exchange's specific requirements, ensuring your orders are correctly represented. The class is built to be efficient in its use of memory.

## Class BacktestUtils

BacktestUtils provides helpful tools for running and managing backtesting operations within the framework. It simplifies the process of executing backtests and accessing their results.

You can use the `run` method to kick off a backtest for a specific symbol and strategy, and it handles the underlying complexities for you. For scenarios where you only need to trigger a backtest for side effects, like logging or callbacks, the `background` method allows running it in the background.

Need to pause a strategy's signal generation? The `stop` method provides a way to halt a backtest gracefully, letting existing signals complete.

Want to analyze past performance? `getData` retrieves statistical information from completed backtests, while `getReport` generates a user-friendly markdown report. The `dump` function saves these reports directly to your file system. Finally, `list` gives you a quick overview of all currently running backtests and their status.  The `_getInstance` property is an internal detail you shouldn't directly manipulate.

## Class BacktestMarkdownService

This service helps you create readable reports about your backtesting results. It keeps track of closed trading signals for each strategy you're testing, organizing them neatly. 

The service listens for updates during the backtest and gathers information about each closed trade. It then transforms this data into well-formatted markdown tables, making it easy to review performance. You can save these reports directly to your disk, neatly organized by strategy and symbol.

To use it, you simply need to integrate its `tick` method into your strategy's callback mechanism. The service automatically handles initialization, so it's ready to go when needed. You have the option to clear the collected data, either for a specific strategy and symbol combination or for everything.

## Class BacktestLogicPublicService

This service helps you run backtests in a smooth and organized way. It manages the overall backtesting process, automatically handling important details like the strategy name, exchange, and timeframe you've selected. 

Think of it as a helpful assistant that makes sure all the different parts of your backtest – like fetching historical data or calculating signals – are working together with the correct information. 

The `run` function is your main tool here; it starts the backtest for a specific symbol and gives you a stream of results as it progresses. Because of the automatic context management, you don’t have to worry about passing those details with every function call, making your code cleaner and easier to understand. 






## Class BacktestLogicPrivateService

The BacktestLogicPrivateService helps you run backtests in a memory-friendly way by using async generators. Think of it as a pipeline: it gets the timeframes needed for your backtest, then moves through them, processing data as it goes. When a trading signal opens, it fetches the necessary candle data and runs the backtest logic. The service then skips over timeframes until the signal closes, and delivers the result as it completes.  

Crucially, it doesn't store everything in memory at once, instead streaming the results which is ideal for large datasets. You can even stop the backtest early by breaking out of the generator.

The service relies on several other services like a logger, strategy service, exchange service, frame service and method context service to function properly. 

The `run` method is the main entry point – you provide a symbol and it will return an async generator that yields the backtest results as closed signals are processed.

## Class BacktestCommandService

This service acts as a central hub for initiating and managing backtesting processes within the framework. Think of it as a convenient entry point, especially when you're setting up your application and want to inject dependencies easily.

It provides access to core backtesting functionality, relying on other services to handle things like validating your strategy, exchange, and data frames.

The main thing you'll use is the `run` method.  This lets you kick off a backtest for a specific trading symbol and passes along important details about the strategy, exchange, and data frame you want to use. The result of the backtest will be delivered piece by piece allowing you to manage resources and provide feedback to the user.


# backtest-kit interfaces

## Interface WalkerStopContract

This interface defines the information shared when a walker is being stopped. Think of it as a notification that a particular trading strategy, identified by its name and running within a specific walker, is being paused. The notification includes the trading symbol involved, the strategy's name, and the walker's name – allowing you to precisely target which strategies and walkers need to respond to the stop signal. This is particularly useful when you have several strategies running concurrently on the same asset.

## Interface WalkerStatistics

The `WalkerStatistics` interface helps organize and understand the results of backtesting different trading strategies. It's designed to be clear and easy to use, especially when presenting results in reports or dashboards. 

Think of it as a container holding all the information you need to compare how various strategies performed.

The core of this interface is the `strategyResults` property, which is a list of detailed results for each strategy you tested. This list lets you quickly see and compare metrics like profit, drawdown, and other performance indicators for each strategy.

## Interface WalkerContract

The WalkerContract represents progress updates as backtest-kit compares different trading strategies. Think of it as a report card detailing how each strategy performs during the comparison process. Each update you receive through this contract tells you which strategy just finished testing, what exchange and symbol it was tested on, and provides key statistics like its performance metrics. 

You’re also kept in the loop about the overall ranking –  you'll know the current best-performing strategy and its metric value.  The contract also tells you how many strategies have been tested and the total number planned, giving you a sense of how much of the comparison is left to go. It essentially provides a clear picture of the backtesting process as it unfolds.

## Interface TickEvent

This interface, TickEvent, is designed to give you a single, consistent way to access data about every event that happens during a backtest – whether it’s a signal being generated, a trade being opened, or a position being closed. Think of it as a unified record for everything happening in your trading simulation.

Each TickEvent contains key details like when it happened (timestamp), what kind of event it is (action like "opened" or "closed"), and specific information depending on the event type. For instance, opened and active trades will include things like the open price, take profit levels, and stop loss, while closed trades will have information about profit/loss, and the reason for closing. The symbol being traded, the signal ID used, and a note about the signal are also included when relevant. Finally, you're given the duration of the trade, useful for analyzing how long positions are held.

## Interface ScheduleStatistics

This interface holds information about how scheduled signals are performing. It’s designed to help you understand how many signals were scheduled, how many were cancelled, and how often cancellations happen.

You'll find a detailed list of all scheduled and cancelled events broken down individually within the `eventList`.  The `totalEvents` property provides the overall count of all events. Separate counts exist for `totalScheduled` and `totalCancelled` signals.

The `cancellationRate` tells you what percentage of scheduled signals were cancelled, which is a key indicator of efficiency – a lower rate is usually desired. Finally, `avgWaitTime` shows the average time signals waited before being cancelled, expressed in minutes.

## Interface ScheduledEvent

This interface bundles all the details you need when looking at scheduled or canceled trading events, making it easier to generate reports and analyze your backtesting results. It includes the exact time the event occurred, what type of action it was (scheduled or canceled), and the trading symbol involved. 

You’ll find key information about the signal itself, like its ID, position type, and any notes attached to it. Crucially, it also holds price data like the current market price, the intended entry price, take profit levels, and stop loss points. If an event was canceled, you're also given details such as the close timestamp and the duration of the signal.

## Interface ProgressWalkerContract

This interface describes the updates you'll receive as a background process, like analyzing trading strategies, runs. It tells you what’s happening, including the name of the process, the exchange it’s using, and the trading symbol involved.

You’ll see information about the total number of strategies being evaluated and how many have already been processed. Finally, a percentage value indicates how far along the process is, allowing you to monitor its progress in a user-friendly way.

## Interface ProgressOptimizerContract

This interface helps you keep an eye on how your optimization process is going. It provides updates on the optimizer's name, the trading symbol it's working with, and how far along it is. You'll see the total number of data sources the optimizer needs to examine, the count of sources it has already handled, and a percentage indicating overall completion. This allows you to monitor the progress of complex backtesting or optimization runs and get a sense of how much longer they'll take.

## Interface ProgressBacktestContract

This interface describes the information shared during a backtesting run, letting you monitor its progress. It tells you which exchange and strategy are being used, along with the specific trading symbol involved. You'll see how many total data points (frames) the backtest will analyze, and how many have already been processed. Finally, a percentage value indicates the overall completion of the backtest. It's a helpful way to understand how far along the backtest has progressed.


## Interface PerformanceStatistics

This object holds a collection of performance data gathered during strategy backtesting. It provides a way to understand how a trading strategy performed, broken down by its name. 

You'll find the strategy's name here, along with the total number of events processed and the total time it took to run. The `metricStats` property contains detailed statistics for different performance metrics, allowing you to analyze specific areas of performance. Finally, a list of all the individual performance events is included for detailed inspection if needed.


## Interface PerformanceContract

This interface helps you monitor how your trading strategies are performing. It captures important timing information about different operations, allowing you to pinpoint areas that might be slow or inefficient. 

Each event logged through this contract includes details like when it happened, what operation it relates to (e.g., order placement, data retrieval), the name of the strategy and exchange involved, the trading symbol, and whether it's part of a backtest or live trading.  The `previousTimestamp` helps you calculate the time difference between events. This data is incredibly valuable for profiling your strategies and improving their overall speed and effectiveness.

## Interface PartialStatistics

This data structure helps you keep track of how your trading strategy is performing, specifically when it comes to partial profit or loss events. It gives you a breakdown of the key numbers, like the list of all the individual events that happened and how many resulted in profits versus losses. You’ll find the total number of events, a detailed list of each event, and a count of how many were profitable and how many resulted in a loss. This lets you analyze your strategy’s performance at different stages and milestones.


## Interface PartialProfitContract

This interface describes what happens when a trading strategy hits a partial profit milestone, like 10%, 20%, or 30% profit. It's a way to keep track of how your strategy is performing and when it’s taking partial profits.

Each event includes details like the trading symbol (e.g., BTCUSDT), all the original signal information, the current price when the level was reached, and the specific profit level achieved. A flag indicates whether the event came from a backtest (historical data) or a live trade. Finally, a timestamp shows exactly when the level was detected, which is either the moment in live trading or the time of the candle in a backtest. These events are used to generate reports and allow users to monitor strategy performance.

## Interface PartialLossContract

This interface describes what happens when a trading strategy hits a partial loss level, like a -10%, -20%, or -30% drawdown. It’s a way to track how much a strategy is losing and when those loss milestones are reached.

Each event includes important details like the trading symbol involved, all the signal data related to the trade, the current price that triggered the loss, and the specific loss level reached.  You'll also find information about whether the event occurred during a backtest (historical simulation) or during live trading.  A timestamp indicates exactly when the loss level was detected, aligning with either the live tick or the candle's timestamp in backtest mode.

The system ensures that these loss events are only reported once for each level per signal, even if there are significant price drops. Services that generate reports or user callbacks can use these events to monitor strategy performance and understand drawdown patterns.

## Interface PartialEvent

This interface, `PartialEvent`, helps organize and understand the important data points related to profit and loss during a trading simulation or live trade. Think of it as a snapshot of key information whenever a profit or loss level is reached. It includes things like the exact time the event occurred, whether it was a profit or a loss, the trading symbol involved, the name of the strategy used, and the specific level of profit or loss achieved. You’ll also find the current market price at that time, and whether the trade is part of a backtest or a live trading session. This unified structure makes it easier to analyze and report on trading performance. 

It collects data like:

*   The moment the event happened (timestamp)
*   Whether it's a profit or a loss
*   The trading symbol (e.g., BTCUSDT)
*   The name of the strategy that generated the trade
*   A unique identifier for the signal that triggered the trade
*   If the trade is a long or short position
*   The current price of the asset
*   The profit/loss level reached (like 10%, 20%, etc.)
*   Indicates if the data represents a backtest or a live trade

## Interface MetricStats

This object holds a collection of statistical data for a particular performance metric. Think of it as a summary report showing how a specific action or process performed over a series of runs.

It tells you how many times a metric was recorded, the total time it took across all instances, and calculates key statistics like the average, minimum, maximum, and standard deviation. You’re also given percentile information – like the 95th and 99th – to understand the distribution of durations.

Beyond just the duration itself, it also provides insight into wait times – the periods between events – giving a more complete picture of the overall performance. Each property represents a different lens through which to analyze the metric's behavior.

## Interface MessageModel

This `MessageModel` helps keep track of the back-and-forth in your LLM conversations, which is crucial when you’re optimizing trading strategies. Think of it as a single turn in a dialogue – it has a `role` indicating who sent the message (either the system, the user, or the LLM assistant) and `content` which holds the actual text of that message. The optimizer uses these models to build prompts and remember the conversation's flow.

## Interface LiveStatistics

The `LiveStatistics` interface provides a collection of data points to help you understand how your trading strategy is performing in real-time. It gives you access to a detailed history of all trading events, including idle periods, opened positions, active trades, and closed signals.

You can track the total number of events, as well as the number of winning and losing trades. The interface also calculates key performance indicators like win rate, average profit per trade, total profit, and volatility (measured by standard deviation). More advanced metrics such as Sharpe Ratio, annualized Sharpe Ratio, and certainty ratio are available to evaluate risk-adjusted returns. Finally, it estimates expected yearly returns based on trade duration and profitability. All numerical values are carefully handled – if a calculation is unreliable, the value will be null to avoid misleading insights.

## Interface IWalkerStrategyResult

This interface defines what you get back when you run a strategy within the backtest comparison process. Each strategy you test will produce a result like this.

It includes the strategy’s name so you know which strategy the results belong to.

You'll also find detailed statistics about the backtest, providing insight into its performance. 

A key value, the 'metric', represents how well the strategy performed based on your chosen comparison method, and it might be null if the strategy wasn't valid for comparison.

Finally, the 'rank' property tells you where the strategy placed in the overall comparison – the best strategy gets rank 1, the second-best gets rank 2, and so on.

## Interface IWalkerSchema

The IWalkerSchema defines how to set up A/B testing comparisons between different trading strategies. Think of it as a blueprint for how you want to evaluate multiple approaches against each other.

You'll give it a unique name to identify the test setup.  You can also add a note to explain what the test is for.  

To run the test, you'll specify which exchange and timeframe to use for all the strategies involved.  Crucially, you'll list the names of the strategies you want to compare, making sure they’re already registered within the backtest-kit system.

The schema lets you choose the metric used to optimize and judge the strategies – the default is Sharpe Ratio, but you can customize this. Finally, you can include optional callbacks to hook into various stages of the testing process.

## Interface IWalkerResults

This object holds all the information gathered after a complete comparison of different trading strategies. Think of it as a report card for your backtesting process.

It tells you the name of the "walker" that performed the tests, the specific financial instrument (symbol) it analyzed, and the exchange and timeframe used.  You'll also find the optimization metric used, the total number of strategies evaluated, and, most importantly, the name of the strategy that performed the best.  It includes the best metric value achieved and detailed statistics about that top-performing strategy for a more in-depth look at its results.

## Interface IWalkerCallbacks

This interface lets you hook into the backtest process and get notified about key events. You can use it to track the progress of your backtest runs and react to what's happening.

When a new strategy begins testing, the `onStrategyStart` callback will alert you, giving you the name of the strategy and the symbol being tested. Once a strategy's backtest is finished, the `onStrategyComplete` callback will notify you, along with statistics and a specific metric. If a strategy encounters a problem and the backtest fails, the `onStrategyError` callback will let you know. Finally, after all strategies have been tested, the `onComplete` callback will provide the overall results.


## Interface IStrategyTickResultScheduled

This interface describes a specific type of event within the backtest-kit framework, signaling that a trading strategy has generated a signal and is now waiting for the market to move in a favorable direction. Think of it as the system saying, "Okay, the strategy wants to trade, but let's wait for the price to reach a certain level first." 

It includes details like the strategy's name, the exchange being used, the symbol being traded, the current price at the time the signal was generated, and most importantly, the scheduled signal itself, which holds the target price the system is watching.  Essentially, it's a notification that a trade is pending, patiently awaiting confirmation from the market.

## Interface IStrategyTickResultOpened

This interface describes what happens within the backtest-kit framework when a new trading signal is generated and successfully processed. It's a notification that a signal has been created, validated, and saved. 

You’ll see this result when a strategy produces a buy or sell signal that is then created within the system. The `action` property clearly indicates that a new signal has been "opened." 

The details of that signal, including its unique identifier, are provided in the `signal` property. You also get information about which strategy and exchange created the signal, along with the trading pair and the current price at the moment the signal was opened. This helps with tracking and debugging your trading strategies.


## Interface IStrategyTickResultIdle

This interface, `IStrategyTickResultIdle`, represents what happens in your trading strategy when it's not actively making trades – it's in an "idle" state. It provides information about the circumstances surrounding this idle period. You'll see the strategy's name, the exchange it's connected to, the trading symbol (like BTCUSDT), and the current price at the time the strategy went idle. Crucially, the `signal` property will be `null` because no trading signal was present, and the `action` property clearly identifies this as an "idle" event. This helps you track and understand periods where your strategy isn’t taking action.

## Interface IStrategyTickResultClosed

This interface describes the result you get when a trading signal closes. It provides all the important details about the closure, including why it closed (like reaching a take profit or stop loss, or simply expiring). 

You’ll find the completed signal information here, along with the final price used for the calculation, and a timestamp indicating exactly when the signal was closed. Critically, it includes a profit and loss breakdown, so you can understand how much was gained or lost on the trade, accounting for fees and slippage. You also get tracking information like the strategy and exchange names, and the trading symbol. Essentially, this is a complete snapshot of a closed trading signal.

## Interface IStrategyTickResultCancelled

This interface describes what happens when a scheduled trading signal is cancelled – meaning it didn’t result in a trade being placed. This might occur because the signal didn’t trigger, or because it was stopped before a position could be opened.

The data provided includes the signal that was cancelled, the final price at the time of cancellation, a timestamp indicating when the cancellation occurred, and details about the strategy and exchange involved. Think of it as a record showing that a planned action didn't happen and providing context around why.

You’ll find information like the strategy’s name, the exchange used, and the trading symbol included to help you track and analyze these cancellation events. The `action` property confirms that this result signifies a cancelled signal.


## Interface IStrategyTickResultActive

This interface represents a tick result within the backtest-kit framework, specifically when a trade is actively being monitored. It signifies that a signal has been triggered and the system is tracking its progress towards a take profit (TP), stop loss (SL), or time expiration.

The `action` property confirms that the trade is in an "active" state. The `signal` property contains all the details of the signal that initiated the trade. You’ll also find the `currentPrice` – the VWAP price currently being used to monitor the trade's performance. 

For clarity and tracking purposes, the interface includes the `strategyName`, `exchangeName`, and `symbol` of the trade. Finally, `percentTp` and `percentSl` indicate how far the trade has progressed towards its take profit and stop loss targets, respectively.


## Interface IStrategySchema

This defines the blueprint for how a trading strategy works within the backtest-kit framework. Think of it as a recipe that tells the system how to generate buy and sell signals. 

Each strategy needs a unique name so the system knows which one is which.  You can also add a note to help explain the strategy's logic.

The `interval` property controls how frequently the strategy is checked, preventing it from overwhelming the system.

The most important part is `getSignal`, which is the actual code that analyzes market data and decides when to trade. This function takes the symbol and a timestamp, and returns a signal object or nothing if no signal exists. You can even make signals wait for a specific price to be reached.

You can also provide optional callbacks to be notified when a trade is opened or closed.  Finally, there's a `riskName` to connect the strategy to a specific risk profile for managing overall trading risk.

## Interface IStrategyResult

This interface, `IStrategyResult`, represents a single entry used when comparing different trading strategies. Think of it as a row in a table showing how each strategy performed.

Each result holds the strategy's name, letting you easily identify it. 

It also includes comprehensive statistics—everything you're likely to want to know about how the strategy did during the backtest.

Finally, a metric value is stored; this is the number used to rank the strategies against each other, and it might be missing if the strategy didn't produce a valid result.

## Interface IStrategyPnL

This interface, `IStrategyPnL`, represents the result of a profit and loss calculation for a trading strategy. It gives you a clear picture of how your strategy performed, considering both fees and slippage – those little costs that eat into your gains. 

You’ll find the `pnlPercentage` property, which shows your profit or loss as a percentage. A positive number means you made money, and a negative number means you lost.  The `priceOpen` property tells you the price at which your strategy entered a trade, already factored in for fees and slippage. Similarly, `priceClose` gives you the exit price, also adjusted for those same costs.

## Interface IStrategyCallbacks

This interface lets you define what happens at key moments in your trading strategy's lifecycle. Think of it as a way to react to events like a new signal being opened, a position becoming active, or a signal being closed.

You can listen for ticks – the raw price data – with `onTick`.  `onOpen` is triggered when a signal passes validation and a trade is initiated.  `onActive` signals that a position is being monitored.  When no signals are active, `onIdle` lets you know. When a signal is closed, `onClose` provides the closing price.

For strategies using scheduled entries, `onSchedule` fires when a signal is created for later execution, and `onCancel` handles signals that are scheduled but then canceled before a position is opened. 

`onWrite` is a testing hook to simulate writing signals to a persistent storage. 

Finally, `onPartialProfit` and `onPartialLoss` let you respond to situations where the trade is moving in a favorable or unfavorable direction, respectively, but hasn't yet reached the take profit or stop loss levels.

## Interface IStrategy

The `IStrategy` interface outlines the essential methods any strategy will use within the backtest-kit framework.

At its core, the `tick` method is how a strategy processes new market data—it's responsible for checking if a signal should be generated and assessing if any existing take-profit or stop-loss orders need to be adjusted.

The `getPendingSignal` method allows a strategy to look up the details of any currently active signal, used primarily for managing take-profit, stop-loss, and time expiration conditions.

For quick performance tests, the `backtest` method lets you run your strategy against historical candle data, efficiently evaluating its behavior.

Finally, the `stop` method provides a way to pause signal generation without abruptly closing any existing positions, enabling a controlled shutdown when needed.

## Interface ISizingSchemaKelly

This interface defines how your trading strategy determines the size of each trade using the Kelly Criterion. When you use this sizing method, you're telling backtest-kit that your strategy will calculate trade sizes based on an expected return and risk. 

The `method` property is always set to "kelly-criterion" to identify this sizing approach. The key to controlling how aggressively your strategy sizes trades is the `kellyMultiplier`. This value, typically between 0 and 1, scales the Kelly Criterion calculation, preventing overly aggressive trading. A lower multiplier like 0.25 (the default) represents a "quarter Kelly" approach, which is a more conservative sizing strategy.

## Interface ISizingSchemaFixedPercentage

This schema lets you determine your trade size by fixing a percentage of your capital at risk for each trade. You specify the `method` as "fixed-percentage" to indicate you're using this sizing approach. The `riskPercentage` property is the key – it defines what percentage of your total capital you're willing to risk on a single trade. For example, a `riskPercentage` of 10 means 10% of your capital will be risked per trade.

## Interface ISizingSchemaBase

This interface defines the core structure for sizing configurations used within the backtest-kit trading framework. Think of it as a blueprint for how much of your account you're willing to risk on each trade. 

Each sizing schema needs a unique name to identify it, and you can add a note for yourself to explain its purpose.  You'll specify limits on position size, defining a maximum percentage of your account to use, as well as minimum and maximum absolute position sizes. Finally, you can optionally provide callback functions to be executed at different stages of the sizing process.

## Interface ISizingSchemaATR

This schema helps you determine your trade size based on the Average True Range (ATR), a measure of volatility. It's designed to help manage risk by adjusting your position size depending on how much the price is moving.

You'll specify a `riskPercentage` to define what portion of your capital you're willing to risk on each trade—a percentage between 0 and 100.  Then, the `atrMultiplier` dictates how much the ATR influences the size of your position, essentially scaling the stop-loss distance.  The `method` property is fixed to "atr-based" indicating the sizing approach being used.

## Interface ISizingParamsKelly

The `ISizingParamsKelly` interface defines how to configure a trading strategy's position sizing when using the Kelly Criterion. It's used when you're setting up the `ClientSizing` component, which manages how much capital your strategy uses for each trade. 

The key element here is the `logger`. This lets you provide a service for sending debugging messages, which is extremely helpful for understanding how the Kelly Criterion calculations are working and troubleshooting any issues. Essentially, you're telling the system where to send important diagnostic information as it figures out trade sizes.

## Interface ISizingParamsFixedPercentage

This interface, `ISizingParamsFixedPercentage`, helps define how much of your capital to use for each trade when using a fixed percentage sizing strategy. It’s really straightforward – you provide a `logger` to help you keep an eye on what’s happening behind the scenes, providing valuable debugging information as your backtest runs. Think of the logger as a way to peek into the calculations and make sure everything’s working as expected.

## Interface ISizingParamsATR

This interface, `ISizingParamsATR`, defines how your trading strategy determines the size of each trade when using an ATR (Average True Range) based sizing method. It focuses on providing a way to log information related to the sizing process, helping you understand and debug your trading decisions. 

The `logger` property is essential for this; it allows you to send debugging messages and track the calculations happening within your sizing logic. This helps pinpoint any unexpected behavior and optimize your strategy's trade sizing.

## Interface ISizingCallbacks

This section describes the `ISizingCallbacks` interface, which helps you hook into the sizing process within the backtest-kit framework. Think of it as a way to observe and potentially influence how much of an asset your trading strategy buys or sells.

Specifically, the `onCalculate` callback gets triggered right after the framework calculates the size of a position. This is your chance to inspect the calculated quantity, see the parameters used in the calculation, and perhaps log this information or perform some checks to ensure everything looks right. It allows you to keep tabs on how your sizing logic is behaving.

## Interface ISizingCalculateParamsKelly

When you're figuring out how much to trade based on the Kelly Criterion, this interface holds the information you need. It's all about defining the specific parameters that the calculation will use. You’ll provide the method – in this case, it's always "kelly-criterion" – and then you’ll specify the win rate, which is a number between 0 and 1 representing how often your trades win. Finally, you’ll also input the average win/loss ratio, which reflects how much you gain on a winning trade compared to how much you lose on a losing one.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate your trade size using a fixed percentage approach. When using this method, you specify the `method` as "fixed-percentage" to indicate this sizing strategy. You also provide a `priceStopLoss`, which represents the price at which your stop-loss order will be triggered. This helps determine the trade size based on risk management considerations tied to the stop-loss level.

## Interface ISizingCalculateParamsBase

This interface, `ISizingCalculateParamsBase`, provides the foundational information needed to determine how much of an asset to trade. Think of it as the basic data every sizing calculation requires. It includes the trading symbol, like "BTCUSDT," so the calculation knows which asset is involved. You’ll also find the current account balance, which is essential for calculating how much capital you can deploy. Finally, it includes the planned entry price, helping to estimate potential profits or losses.

## Interface ISizingCalculateParamsATR

This interface defines the information needed when calculating trade sizes using an ATR (Average True Range) based method. Essentially, it tells the backtest kit that you want to size your trades according to how volatile the market has been, as measured by the ATR. You’ll provide a specific ATR value as part of this configuration – think of it as the 'risk buffer' you're using to determine how much to trade. Providing this interface lets the framework know exactly how you want your positions sized using volatility.

## Interface ISizing

The `ISizing` interface is a core part of how backtest-kit determines how much of an asset your strategy should buy or sell. It defines a single, crucial method called `calculate`.

This `calculate` method takes in a set of parameters related to your risk management, like how much of your capital you're willing to risk per trade, and uses those to figure out the optimal position size for a given trade. Essentially, it translates your risk preferences into concrete trade quantities. The `calculate` method returns a promise that resolves to the calculated position size, which represents the number of shares or contracts to trade.

## Interface ISignalRow

This interface, `ISignalRow`, represents a complete trading signal that's ready to be used within the backtest-kit framework. Think of it as the finalized version of a signal after it's been checked and prepared for execution. 

Each signal gets a unique identifier, an `id`, which is automatically generated. You'll also find the entry price, `priceOpen`, along with information about which exchange and strategy triggered the signal, found as `exchangeName` and `strategyName`. 

The `symbol` property tells you what trading pair the signal applies to, like "BTCUSDT." To keep track of timing, `scheduledAt` marks when the signal was initially created, and `pendingAt` indicates when the position went pending. Lastly, `_isScheduled` is an internal flag that signals whether the signal was initially scheduled.

## Interface ISignalDto

This interface, `ISignalDto`, represents the data structure used to communicate trading signals within the backtest-kit framework. Think of it as a standardized way to describe a potential trade. When you request a signal, you’ll receive data conforming to this structure.

It includes essential details like the trade direction ("long" for buying, "short" for selling), a descriptive note to explain the reasoning behind the signal, and the entry price for the trade.

You’ll also find target prices for taking profits and setting stop-loss orders. It’s important to note that the take profit price must be higher than the entry price for long positions, and lower for short positions, and the stop loss prices must follow the opposite logic. Finally, it includes an estimation of how long the signal is expected to last. If you don’t provide an ID for the signal when creating it, the system will automatically generate one.

## Interface IScheduledSignalRow

This interface, `IScheduledSignalRow`, represents a trading signal that's set to execute when the price reaches a specific level. Think of it as a signal on hold, waiting for a price target to be hit. It builds upon the standard `ISignalRow` and handles the delay before a trade is actually placed.  When the market price matches the `priceOpen` value, this "scheduled" signal transforms into a regular, active signal.  A key detail is that the `pendingAt` time will initially reflect the scheduled time, but will update to the actual time when the signal activates. The `priceOpen` property tells you the price level that needs to be reached before the signal is triggered.

## Interface IRiskValidationPayload

This data structure helps risk validation functions understand the current state of your trading portfolio. It builds upon the basic information provided in `IRiskCheckArgs` by adding details about active positions. You'll find the total number of active positions you hold across all your strategies in the `activePositionCount` property.  For a more detailed look at each active position, the `activePositions` property provides a list containing information about each one.

## Interface IRiskValidationFn

This defines a function that helps ensure your trading strategies are safe and stable. Think of it as a gatekeeper for your risk settings. It takes risk parameters as input and carefully checks if they meet certain criteria. If anything seems off—like a position size that's too large or a stop-loss that's too close—it will raise an error, preventing your strategy from taking potentially harmful actions. This helps you catch problems early and maintain control over your trading risk.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define rules to make sure your risk checks are behaving as expected. Think of it as setting up guardrails for your trading strategies. 

It has two key parts: a `validate` function, which contains the actual logic to check the risk parameters, and a `note` property to add a helpful explanation of what that validation is doing. The `note` helps other people (or your future self) understand why a specific validation rule exists. Essentially, you're providing both the check *and* the context.

## Interface IRiskSchema

This interface, `IRiskSchema`, is how you define and register custom risk controls for your backtesting framework. Think of it as a blueprint for how your portfolio will manage risk. 

You give each risk control a unique `riskName` so you can easily identify it.  A `note` field allows you to add helpful documentation for yourself or other developers. 

You can also specify optional lifecycle event `callbacks` that trigger at certain points, like when a trade is rejected or allowed. 

The core of the risk schema is the `validations` array, where you’re going to put your actual risk logic – the rules that determine whether a trade can proceed. This allows you to implement sophisticated portfolio-level safeguards.

## Interface IRiskParams

The `IRiskParams` interface defines the information needed when setting up a risk management system within the backtest-kit framework. Think of it as a container for configuring how your risk management functions will behave and report.  It requires a `logger` – this is how your risk calculations can communicate important messages or errors to you during the backtesting process, helping you understand what’s happening under the hood. Essentially, it provides a way to observe and debug your risk management logic as it runs.

## Interface IRiskCheckArgs

The `IRiskCheckArgs` interface holds the information needed to decide whether a trading strategy should be allowed to create a new signal. Think of it as a gatekeeper – it’s used before a signal is generated to make sure everything is aligned.

It provides access to key details like the trading pair being considered (the `symbol`), the name of the strategy that wants to trade, which exchange is being used, the current price of the asset, and the current time. This lets you set up rules to ensure trades only happen when conditions are appropriate. Essentially, it passes along critical information from the larger trading environment directly to your risk checks.

## Interface IRiskCallbacks

This interface defines optional functions you can use to get notified about what's happening during the risk assessment process.  You can provide `onRejected` to be alerted when a trading signal is blocked because it hits a risk limit. Similarly, `onAllowed` lets you know when a signal successfully passes all the risk checks and is considered safe to proceed with.  These callbacks are useful for monitoring and debugging your risk management system or for implementing custom logic based on risk assessment outcomes.

## Interface IRiskActivePosition

This interface, `IRiskActivePosition`, describes a single trading position that's being monitored for risk management across different trading strategies. Think of it as a snapshot of a trade that’s currently open.

It tells you the signal that initiated the trade, which strategy is responsible for it, the exchange used, and precisely when the position was started. This information allows for a detailed view of how different strategies interact and influence risk profiles. You'll find this useful for analyzing overall portfolio risk and identifying potential issues.

## Interface IRisk

The `IRisk` interface helps manage and control risk while trading. It’s like a safety net for your strategies, making sure you don't take on more risk than you're comfortable with. 

You're able to check if a trading signal is okay to execute based on defined risk parameters using the `checkSignal` function.  

The `addSignal` function lets you tell the system when a new position is opened, allowing the framework to track your exposure. Conversely, `removeSignal` is used to notify the system when a position is closed, so it can accurately reflect your risk profile. This allows for a dynamic and accurate monitoring of risk limits as your strategies trade.

## Interface IPositionSizeKellyParams

This interface defines the inputs needed to calculate position sizes using the Kelly Criterion. It’s designed to help you determine how much of your capital to allocate to a trade based on historical performance. 

You'll provide the expected win rate of your strategy, expressed as a number between 0 and 1. You’re also required to specify the average ratio of wins to losses that your strategy has historically achieved. These two values work together to help the framework calculate an appropriate position size.

## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed to calculate a fixed percentage of your portfolio to use for each trade. It's all about consistently risking a set portion of your capital.

The `priceStopLoss` property lets you specify the price at which your stop-loss order will be triggered, helping to limit potential losses.

## Interface IPositionSizeATRParams

This interface defines the parameters needed for calculating your position size based on the Average True Range (ATR). Essentially, it tells the backtest-kit how much the market has been fluctuating recently. The `atr` property holds the current ATR value, which is a key indicator for determining how much capital you want to risk on a trade. A higher ATR suggests more volatility, potentially leading to a smaller position size to manage risk.

## Interface IPersistBase

This interface defines the core actions needed to manage data persistence—think of it as the foundation for saving and retrieving information within the backtest-kit framework. It allows you to read, write, and check for the existence of data.

The `waitForInit` method ensures that the storage area is ready to go and any necessary setup happens only once. `readValue` lets you fetch a specific data item, while `hasValue` simply tells you if a data item already exists. Finally, `writeValue` provides a way to save data securely, ensuring that changes are written reliably. 


## Interface IPartialData

This interface, `IPartialData`, helps save and load data related to a trading signal. It's designed to be easily stored and retrieved, even when dealing with complex data structures.

Think of it as a snapshot of key information – specifically, the profit and loss levels – that have been hit during trading. The `profitLevels` property stores an array representing the profit levels, while `lossLevels` holds the loss levels. These are essentially lists that allow the system to remember where a signal has previously reached in terms of profitability and losses. When data is saved, sets are converted into these arrays for easier storage.

## Interface IPartial

This interface, `IPartial`, manages how we track profit and loss for trading signals. It’s used by the system to keep tabs on when signals hit certain profit or loss milestones, like 10%, 20%, or 30%.

When a signal is making money, the `profit` method steps in to check if any new profit levels have been reached and announces them.  Similarly, the `loss` method does the same for signals experiencing losses. To avoid repeated announcements, it smartly only reports new levels.

Finally, when a trading signal finishes – whether it hits a target, a stop-loss, or its time expires – the `clear` method cleans up the tracking information, removes it from memory, and saves the changes, making sure everything is tidy for the next trade.

## Interface IOptimizerTemplate

This interface provides a way to create code snippets and messages used in the backtest-kit trading framework, especially when interacting with Large Language Models. It's like a blueprint for generating various code parts that work together.

You can use it to generate helper functions for debugging (like `dumpJson()` and `text()`) and creating structured outputs (`json()`). It’s also used to create entire configurations for different components.

Specifically, it helps you build code for things like:

*   Setting up initial imports and configurations (`getTopBanner`).
*   Crafting messages for conversations with LLMs – both what the user says (`getUserMessage`) and the model's response (`getAssistantMessage`).
*   Defining how the system ‘walks’ through data (`getWalkerTemplate`).
*   Configuring exchanges (`getExchangeTemplate`), timeframes (`getFrameTemplate`), and trading strategies (`getStrategyTemplate`).
*   Creating a launcher to run everything (`getLauncherTemplate`).

## Interface IOptimizerStrategy

This interface, `IOptimizerStrategy`, represents the complete information behind a trading strategy generated using an LLM. Think of it as a package containing everything that influenced the strategy's creation. 

It includes the `symbol` the strategy is designed for, a unique `name` used for identification, and the full `messages` – the conversation history between you and the LLM that led to this strategy.  Crucially, it also holds the `strategy` itself, which is the text-based description of the trading logic the LLM produced.  This lets you see the complete picture of how the strategy was formulated.


## Interface IOptimizerSourceFn

The `IOptimizerSourceFn` is a special function designed to feed data to the backtest-kit optimizer. Think of it as the data pipeline for training your trading strategies. It needs to be able to handle large datasets by fetching data in smaller chunks – a process called pagination. Each piece of data it provides must also have a unique identifier, helping the optimizer keep track of everything. It's a crucial component when you want to fine-tune your trading rules based on historical performance.

## Interface IOptimizerSource

This interface, `IOptimizerSource`, describes where your backtesting data comes from and how it's presented to a language model. Think of it as defining a connection to your historical trading data. 

You'll give it a unique `name` to easily identify it and can add a helpful `note` to describe its purpose. The key part is the `fetch` function, which tells the system how to retrieve your data, making sure it can handle larger datasets through pagination.

You can also customize how the data is formatted into messages for the language model.  The `user` property lets you control how messages intended for the user look, while `assistant` lets you customize the assistant's messages. If you don’t provide these custom formatters, the framework will use default templates.

## Interface IOptimizerSchema

This interface describes the blueprint for setting up an optimizer within the backtest-kit framework. Think of it as a configuration file that tells the system how to generate and test different trading strategies.

You'll define training periods using `rangeTrain`, which allows you to create multiple strategy variations for comparison against each other. There's also a `rangeTest` to evaluate the overall performance of the generated strategies.

The `source` property is an array of data sources that feed information to the system when building strategies – it's essentially the "knowledge" the system uses to make trading decisions.  `getPrompt` is a crucial function; it takes the conversation history from the data sources and crafts a prompt used to generate the actual trading strategy code.

You can customize the generated code using `template` to override default settings. `callbacks` lets you hook into different stages of the process for monitoring and logging. Finally, `note` provides a place for a descriptive note about what this particular optimizer configuration is intended to do. `optimizerName` gives the configuration a unique identifier.

## Interface IOptimizerRange

This interface, `IOptimizerRange`, helps you define specific time periods for backtesting and optimization. Think of it as setting the boundaries for your historical data. You specify a `startDate` and `endDate` to clearly indicate the beginning and end dates of the period you want to analyze.  It’s also useful to include a `note` – a short description – to help you remember what that time range represents, like "2023 bear market" or "Post-pandemic recovery."

## Interface IOptimizerParams

This interface defines the settings needed to create and run an optimizer within the backtest-kit framework. Think of it as a configuration bundle.

It includes a `logger`, which is crucial for tracking what's happening during optimization and helps you diagnose any issues. 

You'll also find a `template` property. This contains all the instructions and methods needed to actually perform the optimization process; it combines your custom setup with default settings.

## Interface IOptimizerFilterArgs

This interface defines the information needed to request specific data from a data source, typically used for backtesting. It lets you specify exactly which trading pair, and what date range you’re interested in. You’ll use the `symbol` property to indicate the trading pair, like "BTCUSDT," and then define the beginning and end dates with `startDate` and `endDate` to cover the period you want to analyze. Think of it as your way of saying, "I need data for this specific trading pair, from this date to that date."

## Interface IOptimizerFetchArgs

This interface defines the information needed when fetching data for optimization, like when you're trying out different trading strategies. It’s designed to help retrieve data in manageable chunks, using pagination. You specify how many records you want (`limit`) and how far into the data you want to start (`offset`). Think of `limit` as the page size and `offset` as the page number you're requesting. The default is to grab 25 records at a time, but you can adjust these values as needed.

## Interface IOptimizerData

This interface, `IOptimizerData`, acts as the foundation for how data is provided to the backtest kit's optimization tools. Think of it as a standard format – any data source used for optimization *must* conform to this. The most important part is the `id` property. Each piece of data, like a historical price or indicator value, needs a unique `id` so the system can avoid processing the same data multiple times, especially when dealing with large datasets or paginated sources.

## Interface IOptimizerCallbacks

These callbacks let you keep an eye on what's happening inside the backtest-kit optimizer and react to key events. 

After the optimizer gathers data for your strategies, the `onData` callback gives you a chance to examine that data—maybe to log it or make sure it looks right. 

Similarly, when the code for your strategies is created, `onCode` lets you inspect that code, perhaps for logging or validation purposes. If the optimizer writes strategy code to a file, `onDump` notifies you so you can log that action or do something else. 

Finally, `onSourceData` provides insight into the raw data being pulled from your data sources; you can use it to log data fetches or perform data quality checks.

## Interface IOptimizer

This interface lets you interact with an optimizer, helping you create and export trading strategies. 

You can use `getData` to pull information and generate strategy details—think of it as gathering all the pieces needed to build a strategy.  Then, `getCode` takes that information and assembles it into complete, runnable code for your trading strategy. Finally, `dump` allows you to save that generated code directly to a file, which is very useful for deployment. The `dump` method also creates any necessary folders, so you don't have to worry about that yourself.

## Interface IMethodContext

This interface, `IMethodContext`, acts like a little envelope carrying important information about the trading environment. Think of it as a guide that helps the backtest-kit framework know which specific strategy, exchange, and frame to use during a backtest or live trading session. It holds the names of these components – the exchange, strategy, and frame – ensuring the right tools are always at hand.  The `frameName` is particularly useful for backtesting, but will be empty when running in live mode. The framework uses this context to automatically find and use the correct trading components, making things easier for you.

## Interface ILogger

The `ILogger` interface provides a standardized way for different parts of the backtest-kit framework to record information about what’s happening. Think of it as a central place to keep track of events, errors, and helpful details.

It offers several logging methods: `log` for general messages, `debug` for detailed diagnostic information useful during development, `info` for recording successful operations and validations, and `warn` to highlight potential issues that aren't critical errors. Each method lets you specify a `topic` to categorize the log message, along with any arguments you want to include in the log. These logs help with troubleshooting, monitoring the system’s performance, and understanding its behavior.

## Interface IHeatmapStatistics

This interface defines the structure for presenting statistics related to a portfolio's performance visualized as a heatmap. It gathers key data points across all the assets within the portfolio, allowing you to get a broad overview of how things are doing.

You'll find a list of individual symbol statistics broken down in the `symbols` array, giving you a detailed look at each asset. The `totalSymbols` property simply tells you how many symbols are included in the analysis. Overall portfolio performance is captured by the `portfolioTotalPnl` (total profit/loss), `portfolioSharpeRatio` (a measure of risk-adjusted return), and `portfolioTotalTrades` (the total number of trades executed).

## Interface IHeatmapRow

This interface represents the key performance statistics for a single trading symbol, aggregated from all strategies used. It provides a concise overview of how a particular asset has performed. 

You'll find essential metrics like total profit or loss, the Sharpe Ratio for risk assessment, and the maximum drawdown to understand potential downside. It also details the trading activity itself, including the total number of trades, win/loss counts, and win rate. 

Other valuable figures include average profit/loss per trade, standard deviation, profit factor, and streak information (maximum win/loss streaks). Finally, expectancy provides a look at the overall profitability considering win rate and average win/loss amounts.

## Interface IFrameSchema

This `IFrameSchema` lets you define the structure of a time period for your backtesting. Think of it as setting the boundaries for your trading simulation - when it starts, when it stops, and how often you want data points generated within that period. 

You'll give each frame a unique name to identify it, and can add a note to help you remember what it’s for. The `interval` property determines the frequency of the generated data (e.g., daily, hourly, minute-by-minute).  You specify the `startDate` and `endDate` to mark the beginning and end of your backtest, including both dates. Finally, you can optionally provide `callbacks` to run custom code at different stages of the frame's lifecycle.

## Interface IFrameParams

The `IFramesParams` interface defines the information needed to set up a ClientFrame, which is a core building block in backtest-kit. Think of it as a container holding configuration details. It builds upon `IFramesSchema` by also requiring a `logger` – a tool for keeping track of what's happening inside the frame for debugging purposes. This logger lets you see internal messages and helps troubleshoot any issues that might arise during the backtesting process.

## Interface IFrameCallbacks

This interface helps you keep track of what’s happening with your trading timeframe data. Specifically, it provides a way to be notified when a new set of timeframes is created.

The `onTimeframe` function gets called each time the backtest kit figures out the time period for your analysis. You can use this to check that the start and end dates are correct, or to simply log the generated timeframe dates for debugging or verification. The function receives the array of dates representing the timeframe, the start and end dates of the whole backtest, and the interval used (like daily, weekly, or monthly).

## Interface IFrame

The `IFrames` interface is a core component for setting up your backtesting environment. Think of it as the system that figures out when each trade will happen during your simulation. 

Specifically, the `getTimeframe` function is the key here. When you give it a trading symbol (like "AAPL") and a timeframe name (like "1h" for one-hour candles), it returns a promise that resolves to an array of dates. These dates represent the specific moments in time that your backtest will analyze and potentially execute trades. The spacing of these dates is determined by the timeframe you choose.

## Interface IExecutionContext

The `IExecutionContext` interface holds the essential information your trading strategies and exchanges need to function correctly. Think of it as a package of runtime details passed around to keep everything synchronized. 

It tells your code which trading pair it's working with, represented by the `symbol` property (like "BTCUSDT"). It also provides the current timestamp, `when`, to ensure operations happen at the correct point in time. Finally, the `backtest` flag indicates whether you're running a simulation (`true`) or live trading (`false`). This context is automatically provided by the `ExecutionContextService`, so you don’t need to manage it directly.

## Interface IExchangeSchema

This interface describes how backtest-kit interacts with different cryptocurrency exchanges. Think of it as a blueprint for connecting to a specific exchange and getting the data it needs.

Each exchange you want to use needs to be registered with backtest-kit using this schema. 

The `exchangeName` is a unique identifier so backtest-kit knows which exchange it's dealing with.  You can add a `note` for yourself to explain something about the exchange's setup.

The core of the schema is `getCandles`, which is a function that backtest-kit will call to retrieve historical price data (candles) for a particular trading pair and timeframe.  `formatQuantity` and `formatPrice` handle converting numbers to strings in a way that matches the exchange’s specific formatting rules, ensuring orders and calculations are accurate.  Finally, `callbacks` lets you hook into certain events related to data, if you need to perform custom actions.

## Interface IExchangeParams

This interface, `IExchangeParams`, helps you set up how your trading strategy interacts with an exchange when using backtest-kit. It’s basically a container for important configuration details. 

You'll provide a `logger` to capture debugging messages – useful for understanding what your strategy is doing during backtesting.  

It also needs an `execution` object. This tells the system things like which symbol you’re trading, the timeframe of your backtest, and whether you’re running a live or backtesting environment. Providing these details correctly ensures accurate and meaningful backtesting results.

## Interface IExchangeCallbacks

This interface defines optional functions you can provide to your exchange integration within backtest-kit. Specifically, `onCandleData` lets you react whenever new candle data arrives for a particular trading symbol and timeframe. This callback provides the symbol, the interval (like 1 minute or 1 day), the starting date, the number of candles requested, and an array containing the actual candle data itself. You can use this to update your visualizations or perform custom processing as the data streams in.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with different cryptocurrency exchanges. It's like a standardized way to get data and handle orders, regardless of the specific exchange being used.

You can use it to request historical candle data (like open, high, low, and close prices over time) and even pull in future candles for backtesting scenarios. It also provides tools to ensure your order quantities and prices are formatted correctly for each exchange's requirements. 

Finally, it includes a handy method to calculate the VWAP (Volume Weighted Average Price) based on recent trading activity, which can be useful for strategic trading decisions.

## Interface IEntity

This interface, `IEntity`, serves as the foundation for any data that your backtest kit will store and manage persistently. Think of it as the common blueprint all your saved objects – like trades, orders, or account snapshots – will follow. It ensures that all of these saved items have a consistent structure, making it easier to work with them later on.

## Interface ICandleData

This interface defines the structure of a single candlestick, the fundamental building block for analyzing price movements and performing backtests. Each candlestick represents a specific time interval and contains essential data like the timestamp when it began, the opening price, the highest and lowest prices reached during that time, the closing price, and the total trading volume. You'll use this structure to feed historical price data into your trading strategies and simulations, allowing you to evaluate how they would have performed in the past. Think of it as a compact record of what happened to the price of an asset during a particular moment.

## Interface DoneContract

This interface, DoneContract, signals when a background task finishes, whether it's a backtest or a live trade execution. Think of it as a notification that a process has wrapped up. It provides key details about what just happened, like the exchange used, the name of the trading strategy involved, whether the execution occurred in backtest or live mode, and the symbol being traded. This information is crucial for monitoring and understanding the results of your trading processes.

## Interface BacktestStatistics

This interface holds all the key statistical data generated after running a backtest. It gives you a complete picture of how your trading strategy performed.

You'll find a detailed list of every closed trade, along with the total number of trades executed. The data includes counts of winning and losing trades, and crucial performance metrics like the win rate, average profit per trade, and total profit across all trades.

To assess risk, you can examine the standard deviation (a measure of volatility) and the Sharpe Ratio, which compares your returns to the risk taken. The annualized Sharpe Ratio expands on this by projecting returns over a year. Further, the certainty ratio shows the relative strength of winning trades compared to losses. Finally, it provides an estimation of yearly returns based on trade durations and profits. All numeric values are not available if their calculation is problematic.
