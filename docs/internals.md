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

This function lets you plug in your own logging system for backtest-kit. It's great if you want to send logs to a specific place, like a file, a database, or a custom monitoring tool. When you provide a logger, all the framework's internal messages will be routed through it. Importantly, the logger will automatically receive useful context information along with each log message, such as the strategy name, exchange name, and the trading symbol being used. This context makes it much easier to understand and debug your backtesting processes. You just need to provide an object that conforms to the `ILogger` interface.

## Function setConfig

This function lets you adjust the overall settings for your backtesting environment. Think of it as tweaking the fundamental rules of the game. You can modify certain default values by providing a configuration object; it doesn't require you to specify every single setting, just the ones you want to change. It's a promise-based function, so it will complete asynchronously once the configuration is applied.

## Function listWalkers

This function lets you see all the different trading strategies, or "walkers," that your backtest-kit setup is using. It returns a list of descriptions for each walker, allowing you to understand what strategies are available for testing. Think of it as a way to check what's in your toolbox before you start building a backtesting system. This is really helpful if you're trying to figure out how your system is configured or if you want to create a user interface that dynamically displays available strategies.

## Function listStrategies

This function provides a way to see all the trading strategies that are currently set up and ready to be used within the backtest-kit framework. It essentially gives you a look under the hood, showing you a list of all the strategies you've added.  You can use this information to confirm your strategies are loaded correctly, create helpful documentation, or even build user interfaces that dynamically display available strategies. The result is a promise that resolves to an array of strategy schemas, each describing a unique trading approach.

## Function listSizings

This function gives you a peek at all the sizing strategies currently set up within your backtest environment. Think of it as a way to see exactly how your positions are being sized for each trade. It returns a list of configurations, which can be helpful if you’re troubleshooting, trying to understand the system's behavior, or building tools that need to know about available sizing options. It’s a simple way to get a comprehensive view of how your trades are being sized.

## Function listRisks

This function lets you see all the risk assessments that are currently set up in your backtest kit. Think of it as a way to peek under the hood and check what risks your simulation is considering. It returns a list of these risk configurations, allowing you to inspect them for debugging purposes or to build tools that react to different risk scenarios. You can use this information to understand how your trading strategy is being evaluated and potentially adjust your risk settings.

## Function listOptimizers

This function helps you discover what optimization strategies are currently available within your backtest-kit setup. It gives you a list of all the optimizers that have been registered for use. Think of it as a way to see what options you have for fine-tuning your trading strategies. This is handy when you’re trying to understand your system, generate documentation, or build a user interface that dynamically adjusts based on available optimizers.

## Function listFrames

This function lets you see all the different data structures – we call them "frames" – that your backtest kit is using. Think of it as getting a catalog of all the data formats available. It’s incredibly handy if you're trying to understand what's going on behind the scenes, creating documentation, or building tools that need to know about all the different frames. The function returns a list of these frame descriptions, allowing you to inspect their structure and purpose.

## Function listExchanges

This function helps you discover which exchanges your backtest-kit framework is currently set up to work with. It gives you a list of exchange configurations, which is like getting a directory of available trading platforms. You can use this to see what’s been added, build tools that adapt to different exchanges, or simply double-check your setup. The information is returned as a promise that resolves to an array of exchange schema objects.

## Function listenWalkerProgress

This function lets you track the progress of your backtesting simulations. It’s like getting updates as each strategy finishes running within the larger backtest. You provide a function that will be called after every strategy completes. 

Importantly, these updates are delivered one at a time, even if your callback function takes some time to process the information – this helps prevent any issues that might arise from trying to handle everything at once. This allows you to monitor the backtest's overall completion and handle results as they become available. 

The function returns another function that you can call to unsubscribe from these progress updates when you no longer need them.

## Function listenWalkerOnce

This function lets you react to specific events happening during a backtesting process, but only once. Think of it as setting up a temporary listener that jumps in, does its job when it sees something it's looking for, and then quietly disappears.

You tell it what kind of event you're interested in using a filter – a function that checks if an event matches your criteria.  Then, you provide a callback function that will be executed *just once* when that specific event happens.  Once the callback runs, the listener automatically stops listening, so you don't have to worry about managing subscriptions. It's perfect for situations where you need to wait for a particular condition to be met during the backtest and then respond accordingly.


## Function listenWalkerComplete

This function lets you be notified when the backtest-kit has finished running all of its tests. It’s a way to react to the completion of a full backtesting process. When you subscribe using `listenWalkerComplete`, you’re given a function that handles the results – essentially, it's called once all strategies have been tested. The results are passed as an object containing information about the entire backtesting run. To ensure orderly processing, the provided callback function will be executed one after the other, even if it involves asynchronous operations. This means you don't have to worry about callbacks running at the same time, potentially causing issues.


## Function listenWalker

This function lets you keep an eye on how a backtest is progressing, step by step. It's like setting up a listener that gets notified after each strategy finishes running within the backtest. You provide a function that will be called for each completed strategy, and this listener ensures that these updates are processed one at a time, even if your callback function takes some time to execute. This helps prevent issues that can arise from trying to handle everything at once. The function returns another function that, when called, will unsubscribe the listener.

## Function listenValidation

This function lets you keep an eye on any errors that pop up during the risk validation process – think of it as setting up an alert system. Whenever a problem arises while checking signals, this function will notify you. It’s particularly handy for spotting and fixing issues during debugging or for keeping a close watch on how your risk validations are performing.  Importantly, the notifications are handled one at a time in the order they occur, even if your response involves asynchronous operations.

## Function listenSignalOnce

This function lets you react to a specific signal event just once and then automatically stops listening. Think of it as setting up a temporary listener – it waits for an event that matches your criteria, runs your provided function once when it finds one, and then quietly unsubscribes itself. You give it a filter to specify which events you're interested in, and a function to execute when a matching event occurs. It's handy when you need to react to a particular signal condition just one time without ongoing subscriptions.

## Function listenSignalLiveOnce

This function lets you temporarily "tap into" the live trading signals being generated. Think of it as setting up a short-lived listener that only cares about specific events. You provide a filter – a way to define which signals you're interested in – and a function that will be executed just *once* when a matching signal arrives. After that single execution, the listener automatically disappears, so you don't have to worry about manually unsubscribing. It’s great for quickly grabbing a single piece of information from a live trading simulation.

The `filterFn` is how you specify what you’re looking for. The `fn` is what actually happens when your filter finds a matching signal. 


## Function listenSignalLive

The `listenSignalLive` function lets you tap into the live trading signals generated by your backtest or strategy. Think of it as setting up a listener that waits for those signals to arrive. When a signal comes through from a running `Live.run()` execution, it's passed to a function you provide, allowing your code to react in real-time. Importantly, these signals are handled one at a time, ensuring they’re processed in the order they're received. This function returns another function that you can call to unsubscribe from the live signals. 

The function you provide to `listenSignalLive` will receive objects of type `IStrategyTickResult`, containing information about the signal.

## Function listenSignalBacktestOnce

This function lets you set up a listener that reacts to signals generated during a backtest, but only once. You provide a filter to specify which signals you’re interested in, and then a function to handle that single signal. Once the matching signal arrives, your function will run, and the listener will automatically stop listening – it's a convenient way to react to a specific event without ongoing subscriptions. It’s specifically designed to work with events produced during a `Backtest.run()` execution.


## Function listenSignalBacktest

This function lets you tap into the events generated during a backtest, allowing you to react to each tick as it happens. Think of it as setting up a listener that gets notified whenever the backtest produces a new signal. It's particularly useful for debugging or implementing custom logic that needs to respond in real-time to the backtest's progress. 

The function provides a callback function `fn` which receives the signal data. The interesting thing is that these signals are handled one at a time, ensuring events are processed in the order they arrive, which can be vital for certain analyses. It works specifically with events created by `Backtest.run()`. The function returns another function to unsubscribe from these signal events, allowing you to stop listening when it's no longer needed.

## Function listenSignal

This function lets you listen for signals generated by your trading strategy, ensuring that each signal is handled one at a time. It’s like setting up a listener that waits for events like when a strategy is idle, a position is opened, it's actively trading, or a position is closed.  The callback function you provide (represented by `fn`) will be executed whenever one of these events occurs. Crucially, it processes events sequentially, even if your callback function involves asynchronous operations, to maintain order and prevent unexpected behavior. The function returns an unsubscribe function, which you can call to stop listening for these signals.

## Function listenPerformance

This function lets you keep an eye on how quickly your trading strategy is performing. It’s like setting up a listener that gets notified whenever the framework measures a piece of your strategy's execution time. 

You provide a function that will be called with these performance measurements. This is particularly useful for spotting slow parts of your code and figuring out ways to speed things up. 

Importantly, the framework ensures that your provided function is processed one at a time, even if it takes a while to run. This guarantees a consistent and predictable way to track performance.

## Function listenPartialProfitOnce

This function lets you set up a one-time alert for when a specific partial profit condition is met in your backtest. Think of it as a temporary listener that reacts only once to a particular event. You provide a filter to define the exact condition you’re looking for, and then a function to execute when that condition happens. After the function runs once, the listener automatically turns itself off, so you don't have to worry about managing subscriptions. It's a clean way to react to a single event and then move on.


## Function listenPartialProfit

This function lets you keep track of your trading progress as you reach profit milestones, like 10%, 20%, or 30% gains. It provides a way to be notified each time your trade hits one of these levels. 

The function takes a callback function that will be executed whenever a partial profit level is reached. Importantly, it ensures that these notifications are handled one at a time, even if the callback you provide involves asynchronous operations, preventing any potential conflicts or issues with concurrent processing. You can think of it as a controlled way to respond to profit level updates.


## Function listenPartialLossOnce

This function lets you react to specific partial loss events in your backtesting strategy, but only once. You provide a filter to define which loss events you're interested in, and a function to execute when that event occurs. Once the event matches your filter, the provided function runs, and the listener automatically stops listening, so you don't continue to be notified about similar events. It's perfect for situations where you need to react to a particular loss condition just a single time.

You tell it *what* events to look for using the `filterFn`, and then you provide a function, `fn`, which will be executed *only once* when a matching event happens. After that single execution, the function quietly stops listening, ensuring it doesn't trigger again.


## Function listenPartialLoss

This function lets you be notified whenever your backtest hits a specific loss level, like losing 10%, 20%, or 30% of its initial value. It’s useful if you want to react to these milestones in your trading strategy. Importantly, it handles these events in a controlled order, ensuring that your code doesn't run concurrently and potentially cause issues. You provide a function that will be called with information about the partial loss event, and this function will return another function to unsubscribe.

## Function listenOptimizerProgress

This function lets you keep an eye on how your backtest optimization is going. It provides updates as the optimizer works through its process, letting you track the progress of data source processing. Importantly, these updates happen in order, even if the code you provide to handle them takes some time to run. Think of it as a way to get notified about milestones during the optimization, ensuring a smooth and predictable monitoring experience. You provide a function that will be called whenever an update is available, and it returns another function to unsubscribe from these updates when you’re done.

## Function listenExit

This function allows you to be notified when something goes seriously wrong and halts the background processes within the backtest kit, like those used for live trading or historical simulations. Think of it as an emergency alert for your trading system – it's triggered when a problem is so severe that it stops everything.  The provided callback function will receive details about the error. Importantly, these errors are handled one at a time to avoid any chaotic situations. The function itself returns a way to unsubscribe from these critical error notifications when you no longer need them.

## Function listenError

This function allows you to be notified whenever a recoverable error occurs while your trading strategy is running. Think of it as setting up an error listener – if something goes wrong, like a failed API request, you’ll get a signal. The beauty is that the strategy won't stop completely; it's designed to handle these hiccups and keep going.

The function takes a callback function as input, and this callback will be executed whenever an error is detected. Importantly, errors are handled one at a time, in the order they happen, even if your error handling logic involves asynchronous operations. It makes sure things stay orderly and prevents unexpected behavior.

## Function listenDoneWalkerOnce

This function lets you react to when a background process within your trading strategy finishes, but only once. You provide a filter – a test – to determine which finishing events you're interested in. Then, you specify a function to run when a matching event occurs. After that function runs, the subscription automatically ends, so you don’t have to worry about cleaning it up. 

It’s like setting up a single, temporary listener for completion signals from your background tasks.

The filter function decides which completion events are relevant, and the callback function handles those selected events.


## Function listenDoneWalker

This function lets you monitor when background tasks within the backtest-kit framework finish running. It's particularly useful if you're dealing with asynchronous operations inside those tasks.

You provide a function (`fn`) that will be called when a background task is done. The function receives a `DoneContract` object containing information about the completed task.

Importantly, the function ensures that your callback is executed one at a time, even if it's an asynchronous function. This helps prevent issues from multiple callbacks running concurrently. 

The function itself returns another function. Calling this returned function will unsubscribe you from the completion events.


## Function listenDoneLiveOnce

This function lets you react to when a background task finishes running within the backtest-kit framework. You provide a filter – a small piece of code – that determines which completed tasks you’re interested in. Then, you give it a function that will be executed just once when a matching task completes. Once that function has run, the subscription is automatically cancelled, so you don't need to worry about cleaning up. It's a convenient way to observe specific background process completions and respond to them briefly. 

You essentially tell the framework, "Hey, when this specific kind of background task finishes, run this function, and then forget about it."


## Function listenDoneLive

This function lets you monitor when background tasks within the backtest-kit framework finish running. It's like setting up a notification system to be informed when a process completes. The callback you provide will be triggered when a background task is done, and importantly, these notifications happen in the order they occurred, even if your callback involves asynchronous operations.  This ensures that events are handled one at a time to avoid unexpected issues caused by running things simultaneously. You're essentially subscribing to completion events and receiving them sequentially.


## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but only once. You provide a filter to specify which backtest completions you're interested in, and a function that will be executed when a matching backtest is done.  Once that function runs, it automatically stops listening, so you don't need to worry about manually unsubscribing. It's useful for things like displaying a notification or performing a single action after a specific backtest concludes.


## Function listenDoneBacktest

This function lets you listen for when a background backtest finishes running. It’s like setting up a notification system – when the backtest is done, the function you provide will be called. Importantly, even if your notification function involves some asynchronous processing, the events will be handled one after another, ensuring things happen in the order they occurred. This helps prevent any unexpected behavior due to multiple callbacks running at the same time. You provide a function that gets executed when the backtest is complete.

## Function listenBacktestProgress

This function lets you keep an eye on how a backtest is running. It’s like setting up a listener that gets updates as the backtest progresses, especially when you're using background tasks. The updates you receive will be processed one after another, ensuring things happen in the order they’re received, even if your callback function takes some time to complete. You give it a function that will handle each progress update, and it returns another function you can use to stop listening.

## Function getMode

This function lets you find out if the trading framework is running a backtest or if it's running in live trading mode. It returns a promise that resolves to either "backtest" or "live", so you can adjust your logic based on the environment. Knowing the mode helps your strategies behave correctly whether you're analyzing historical data or actively trading. It's a simple way to check the context of your code.

## Function getDate

This function, `getDate`, provides a simple way to retrieve the current date within your trading strategy. It's useful for time-based logic, like scheduling actions or analyzing trends over specific periods. When running a backtest, it returns the date associated with the current timeframe the backtest is evaluating. When operating in live trading mode, it provides the actual, real-time date.

## Function getCandles

This function helps you retrieve historical price data, like open, high, low, and close prices, for a specific trading pair. Think of it as a way to look back and see how a cryptocurrency or other asset has traded over time.

You tell the function which trading pair you’re interested in, like "BTCUSDT" for Bitcoin against USDT, and how frequently you want the data – for example, every minute, every hour, or every few hours.  You also specify how many historical data points, or "candles," you want to get.

Under the hood, it uses the connection to your chosen exchange to pull this historical data and format it into a consistent structure. It gets the data starting from the current time and goes backward.

## Function getAveragePrice

This function helps you figure out the average price a symbol has traded at. It calculates this using a method called VWAP, which considers both price and volume. Specifically, it looks at the last five minutes of trading data, using the high, low, and closing prices to determine a "typical price," and then weighs that price by the volume traded. If there’s no volume data available, it defaults to a simple average of the closing prices. You just need to provide the symbol, like "BTCUSDT", to get the calculated average price.

## Function formatQuantity

This function helps you ensure your trade quantities are formatted correctly for the specific exchange you're using. It takes a symbol like "BTCUSDT" and a raw quantity number, and then uses the exchange's own rules to format that quantity into a string. This is important because different exchanges have different rules about how many decimal places are allowed for different trading pairs, and this function handles that automatically, preventing potential order rejections. Basically, it's a simple way to make sure your quantities are in the right format.


## Function formatPrice

This function helps you display prices in the correct format for a specific trading pair. It takes the trading symbol, like "BTCUSDT", and the raw price as input. The function then uses the rules defined for that particular exchange to format the price, ensuring the right number of decimal places are shown. This is important for presenting price data accurately and consistently.

## Function dumpSignal

This function helps you save detailed records of your AI trading strategy’s decisions. It takes the conversation between your strategy and the AI, along with the final trading signal, and neatly organizes them into markdown files. These files create a clear timeline of how the AI arrived at a specific trade, including the system prompt, each user message, and the AI's response with trading details like entry price, take profit, and stop loss.

The function saves these records into a directory named after the signal ID, making it easy to track individual trades. It also provides a default output directory, but you can customize it. Importantly, it avoids accidentally deleting previous logs by checking if the directory already exists. This is invaluable for debugging and understanding your AI’s reasoning process.




The function accepts a unique identifier for the result (like a UUID), the full conversation history, the trading signal itself, and an optional directory where you’d like to save the output.

## Function addWalker

This function lets you register a "walker" – think of it as a specialized engine – to help compare how different trading strategies perform against each other. It takes a configuration object that defines how the walker will execute backtests and assess performance. Essentially, you’re setting up a system to run multiple strategies on the same historical data and then automatically evaluate which one did the best based on the criteria you’re providing. This is extremely helpful for systematically evaluating and refining your trading strategies. The walker configuration dictates what data to use and how to measure success.

## Function addStrategy

This function lets you add a trading strategy to the backtest-kit framework. Think of it as registering your strategy so it can be used for backtesting or live trading. When you add a strategy, the framework will automatically check it to make sure the signals it produces are valid – things like price data, take profit/stop loss calculations, and timestamps all get verified. It also handles limiting the frequency of signals to avoid overwhelming the system. If you're running in live mode, the framework ensures that your strategy's settings can be safely saved even if there are unexpected system crashes. You provide a configuration object, called `strategySchema`, that tells the framework how your strategy works.

## Function addSizing

This function lets you tell the backtest-kit how to determine the size of your trades. Think of it as setting the rules for how much capital you're willing to risk on each trade. You provide a configuration object that outlines the sizing method, risk parameters like the percentage of your capital you're comfortable losing, and any limits on the size of the positions you're taking. This allows for a structured approach to position sizing and helps manage risk during backtesting. It's a key step in customizing how your trading strategies are evaluated.

## Function addRisk

This function lets you set up the rules for managing risk within your backtesting environment. Think of it as defining how much your strategies can trade concurrently and establishing custom checks to ensure they're operating safely.  It's designed so that multiple trading strategies can share the same risk management rules, allowing for a holistic view of your overall portfolio risk. The system keeps track of all open positions, which you can use in your custom risk validation functions to make informed decisions about whether to allow a trade. You provide a configuration object outlining these rules, and the framework takes care of enforcing them.

## Function addOptimizer

This function lets you add a custom optimizer to the backtest-kit framework. Think of an optimizer as a recipe for generating trading strategies. It gathers data, builds a conversation history with that data, then uses prompts to create actual backtest code – essentially, a complete JavaScript file ready to run. You provide a configuration object, and the framework registers it so it can be used to create and evaluate different trading approaches. It's how you bring your own unique strategy generation logic into the system.

## Function addFrame

This function lets you tell backtest-kit how to create the timeframes it will use for backtesting. Think of it as defining the overall period and frequency of your backtest – whether you’re looking at daily data for a year, or hourly data for a month. You provide a configuration object describing the start and end dates of your backtest, the interval (like daily, weekly, or hourly), and a way for the system to notify you about changes in the timeframe. It essentially sets up the basic timeline for your backtesting simulation.


## Function addExchange

This function lets you tell backtest-kit about a new data source for trading, like a cryptocurrency exchange or a stock market. You essentially define how to access historical price data, how prices and quantities are displayed, and even how to calculate things like VWAP (volume-weighted average price) based on recent trades. Think of it as connecting backtest-kit to the specific market you want to simulate. You provide a configuration object that tells the framework the details of this new exchange.

# backtest-kit classes

## Class WalkerValidationService

The WalkerValidationService helps ensure your trading strategies are set up correctly by validating the structure of your custom "walkers." Think of walkers as building blocks for your backtesting logic.

This service lets you register the expected structure (the schema) for each walker you use.  You can then use the validation functionality to confirm that your walkers actually conform to those registered schemas.

You can add walker schemas, validate individual walkers against their schemas, and get a full list of all registered walkers and their expected structures. This helps catch configuration errors early on, making your backtesting more reliable.


## Class WalkerUtils

WalkerUtils provides helpful tools for running and managing trading walkers, streamlining the process of comparing strategies. It simplifies interacting with the core walker execution engine and offers convenient functions for common tasks.

You can easily run a walker comparison for a specific symbol, automatically handling details like the walker's name and schema.  A background execution option lets you run walkers without needing to see the real-time results, which is handy for things like logging or triggering other actions.

Need to stop a walker?  The `stop` function gracefully halts strategy signal generation, ensuring a clean shutdown and preventing further signals. It's designed to work even when you have multiple walkers running on the same symbol.

Retrieving results and generating reports are made simple with `getData` and `getReport` – `getData` grabs all comparison data, while `getReport` creates a formatted markdown report. You can also save that report to a file using `dump`.

Finally, `list` gives you a quick overview of all currently running walkers and their status, helping you monitor their progress.  WalkerUtils acts as a central point for interacting with and observing your trading walkers.

## Class WalkerSchemaService

This service helps you organize and manage different blueprints, or schemas, for your trading strategies, which we call "walkers." It keeps track of these schemas in a way that makes sure everything is typed correctly, preventing errors.

You can add new walker schemas using `addWalker()`, and then find them later by their name using `get()`. If you need to update an existing schema, `override()` lets you make changes without replacing the whole thing. Before a new schema is added, `validateShallow()` checks to make sure it has all the necessary parts and that they are the right types. The service uses a logger to help you keep track of what’s happening.

## Class WalkerMarkdownService

The WalkerMarkdownService helps you automatically create and save reports about your trading strategies. It listens for updates as your strategies run and gathers data to build detailed comparisons. These comparisons are presented in easy-to-read markdown tables.

The service uses a special storage system to keep results organized for each strategy. You can clear out the accumulated data at any time, either for a single strategy or for all of them.

To get started, the service needs to be initialized, which happens automatically the first time you use it. It connects to the system to receive updates on strategy progress and begins building the reports.

## Class WalkerLogicPublicService

The WalkerLogicPublicService acts as a convenient layer on top of the private service, handling the details of managing context for your backtesting processes. Think of it as a way to automatically pass important information like the strategy name, exchange, frame, and walker name around, so you don't have to manually include them in every call.

It utilizes a logger service and interacts with a private walker logic service and schema service to perform its functions. 

The core functionality lies in the `run` method. This method allows you to kick off a comparison of walkers for a specific trading symbol. It essentially runs backtests across all your strategies, automatically managing the necessary context.


## Class WalkerLogicPrivateService

The WalkerLogicPrivateService helps you compare different trading strategies against each other. Think of it as a conductor, orchestrating the backtesting process.

It takes a symbol (like a stock ticker), a list of strategies you want to compare, a key metric to evaluate them on, and some context information.

As each strategy runs, you'll get updates on its progress – allowing you to monitor how things are going. The service keeps track of the best performance it sees in real time.

Finally, it delivers a complete report ranking all the strategies based on their results. 

Internally, it relies on the BacktestLogicPublicService to actually perform the backtesting for each strategy.

## Class WalkerCommandService

WalkerCommandService acts as a central hub for interacting with the walker functionality within the backtest-kit. Think of it as a convenient way to access different services needed to run and manage your trading simulations.

It simplifies things by wrapping around other services, making it easy to inject dependencies and get everything you need in one place.

You're able to run walker comparisons for specific trading symbols, passing in information like the walker's name, the exchange used, and the frame context to ensure everything is correctly configured.

The service provides access to various validation services that ensure your strategies, exchanges, frames, and walkers are all set up correctly before running a backtest. It also handles the schema for strategies and risk validation.

## Class StrategyValidationService

The StrategyValidationService helps ensure your trading strategies are set up correctly before you start backtesting. Think of it as a quality control checkpoint for your strategies. 

You can add your strategy definitions to this service, essentially registering them for validation. The `validate` function then checks if a specific strategy exists and whether its associated risk profile is also defined. 

If you need to see all the strategies you've registered, the `list` function provides a straightforward way to get a list of them. This service utilizes logging and risk validation components internally to assist in the validation process.

## Class StrategySchemaService

This service acts as a central place to store and manage the blueprints, or schemas, for your trading strategies. It uses a special system to keep track of these schemas in a type-safe way, ensuring everything is structured correctly.

You can add new strategy schemas using `addStrategy()` and then find them later by their name using `get()`. If you need to update a schema, `override()` lets you make changes to existing ones. Before a strategy can be registered, `validateShallow()` checks if it has all the essential parts and if they're the right type. 

Essentially, this service helps you organize and verify your strategy definitions so they're consistent and reliable.

## Class StrategyGlobalService

The StrategyGlobalService acts as a central hub for managing and interacting with strategies, especially during backtesting or live trading. It combines several services to ensure strategies have the necessary context, like the trading symbol and timeframe.

It keeps track of strategy validation to prevent unnecessary checks and logs these activities for monitoring. You can use it to see if a strategy is currently generating signals or if it has been stopped.

The service provides methods to check the status of a strategy at a specific point in time, perform quick backtests against historical data, and ultimately stop a strategy's signal generation. It also handles clearing cached strategy information, forcing the system to reload a strategy when needed. Essentially, it's the go-to place for coordinating strategy operations.

## Class StrategyConnectionService

The StrategyConnectionService acts as a central hub for managing and executing trading strategies. It intelligently routes requests to the correct strategy implementation based on the trading symbol and strategy name you specify. To improve performance, it keeps a record of these strategy instances, so it doesn't have to recreate them every time you need to use them.

It ensures that strategies are properly initialized before any trading activity happens, whether it's processing live market data (ticks) or running backtests against historical data.

You can retrieve information about a strategy's current state, like if it's stopped or what its pending signal is. It also provides a way to stop a strategy from generating new signals, and clear out the cached strategy instances to force a refresh. This service simplifies the process of working with multiple strategies simultaneously.

## Class SizingValidationService

The SizingValidationService helps ensure your trading strategies are using valid sizing methods. Think of it as a gatekeeper for your trade sizes. 

You can add different sizing rules – like fixed percentage, Kelly Criterion, or ATR-based approaches – using `addSizing`.  Then, when you're about to execute a trade, you can use `validate` to confirm that the sizing you’re using is actually registered and, optionally, that the specified method is supported. 

If you need to see all the sizing rules currently registered, the `list` function provides a simple way to retrieve them. The `loggerService` property is used internally for logging and isn't intended for direct manipulation. `_sizingMap` is also an internal property and you should not modify it.

## Class SizingSchemaService

This service helps you keep track of your sizing schemas, which define how much of an asset to trade. It's like a central library for your sizing rules. 

It uses a special tool to make sure your sizing schemas are consistent and typed correctly.  You can add new sizing schemas using `register`, update existing ones with `override`, and easily get them back using `get`, all by their name. 

The service also has a built-in validation step (`validateShallow`) to ensure that new sizing schemas have the necessary structure before they're added to the system.

## Class SizingGlobalService

The SizingGlobalService is a central component that handles how much of an asset your trading strategy will buy or sell. Think of it as the engine that determines your position sizes, taking into account risk management rules and other factors.

It relies on other services – a connection service for managing the sizing process and a validation service to ensure calculations are sound. 

The `calculate` method is the main function you’d use (although it’s mostly used internally), allowing you to request a position size based on specific parameters. This method takes into account the name of the sizing strategy being used.


## Class SizingConnectionService

The SizingConnectionService acts as a central point for handling position sizing calculations within your backtesting framework. It figures out which sizing method to use based on a name you provide. 

Think of it like a dispatcher – you tell it which sizing method you want (like fixed percentage or Kelly Criterion), and it sends the request to the right component that knows how to perform that specific sizing calculation. 

To improve performance, it remembers (caches) the sizing components it's already created, so it doesn't have to build them again each time you need them.

The `calculate` method is where the actual sizing happens, using provided risk parameters and the selected sizing method. If you’re using a strategy without any specific sizing configuration, you'd use an empty string as the sizing name.

## Class ScheduleUtils

This class helps you keep track of and report on signals that are scheduled for trading. Think of it as a tool for understanding how well your trading strategies are performing over time, especially concerning scheduled actions.

It lets you easily gather statistics about signals, like how many are queued, cancelled, and how long they take to process. You can get data for a specific trading symbol and strategy to pinpoint any issues.

It's designed to be simple to use – there's just one instance available, allowing quick access to reporting functions. You can request formatted reports in markdown, and even save those reports directly to a file.

## Class ScheduleMarkdownService

This service helps you keep track of scheduled and cancelled trading signals, making it easier to understand how your strategies are performing. It listens for these events and organizes them by strategy.

You can generate reports in a readable markdown format, showing detailed information about each signal event. It also calculates useful statistics like cancellation rates and average wait times. The reports are saved automatically to log files, making it easy to review your trading activity.

The service keeps data separate for each symbol and strategy combination, ensuring that information is well-organized. You can clear the stored data when it's no longer needed, either for a specific strategy or all strategies at once. The service automatically sets itself up when it's first used, so you don’t have to worry about initial configuration.

## Class RiskValidationService

The RiskValidationService helps you ensure your trading strategies adhere to specific risk guidelines. Think of it as a gatekeeper for your risk profiles.

You can add custom risk schemas, essentially defining what constitutes a valid risk profile, using the `addRisk` function. The `validate` function then checks if a particular source meets the criteria defined by your risk schema.  If you need to see all the risk profiles you've set up, the `list` function provides a handy way to retrieve them. The service uses a logger to track its operations, and internally manages a map of registered risks.

## Class RiskSchemaService

This service helps you keep track of your risk schemas in a safe and organized way. It uses a special system to ensure that your schemas are structured correctly and consistently.

You can add new risk profiles using `addRisk()`, and retrieve them later by their assigned names. If a risk profile already exists, you can update it with `override()` to make changes.

Before adding a new risk profile, the system checks to make sure it has all the necessary properties and that they are the correct type. This helps prevent errors and ensures the integrity of your risk management system. The `get()` method lets you easily find a specific risk profile by its name.

## Class RiskGlobalService

The RiskGlobalService helps manage and enforce risk limits within the trading framework. It acts as a central point for risk-related operations, working alongside the RiskConnectionService. 

It keeps track of opened and closed trading signals, ensuring they align with defined risk rules.  The service also offers a way to clear risk data, either for all instances or for a specific one, helping to reset the system's risk state.  Validation of risk configurations is handled efficiently, preventing unnecessary checks. Think of it as the gatekeeper, ensuring trades happen within safe boundaries.

## Class RiskConnectionService

The RiskConnectionService acts as a central hub for managing risk checks during trading. It intelligently directs risk-related operations to the correct risk implementation based on a provided name, ensuring the right rules are applied. To speed things up, it remembers previously used risk implementations, avoiding redundant creation.

You can think of it as a dispatcher, deciding which risk checker to use. It handles tasks like validating signal limits, registering opened signals, and removing closed ones. It’s designed to be flexible, accommodating strategies that don’t have specific risk configurations by allowing an empty risk name. If you need to clear the stored risk implementations for performance or maintenance, there's a clear function to do just that.

## Class PositionSizeUtils

This class offers helpful tools for figuring out how much of an asset to trade, based on different sizing strategies. It contains pre-built calculations for several common approaches. 

You'll find methods to determine position size using a fixed percentage of your account, the Kelly Criterion (which aims to maximize growth), and an ATR-based approach that uses Average True Range. Each of these methods validates the information you provide to make sure it aligns with the specific sizing technique. 

Essentially, this class simplifies the process of calculating position sizes, reducing the potential for errors and helping you apply consistent sizing strategies.

## Class PersistSignalUtils

This class, PersistSignalUtils, helps manage how trading signals are saved and restored, especially when a strategy is running live. Think of it as a safe and reliable way to keep track of a strategy's progress even if things go wrong.

It's designed to work seamlessly with ClientStrategy, ensuring that trading signals don't get lost due to crashes or unexpected interruptions. It automatically handles saving and retrieving signal data, using a system that's organized per strategy.

You can even customize how this data is stored using a custom adapter, providing flexibility for different storage needs. The process of saving is done carefully, using atomic writes to prevent data corruption. When your strategy starts, it uses this class to retrieve the previous state and pick up where it left off.

## Class PersistScheduleUtils

The `PersistScheduleUtils` class helps manage how scheduled signals are saved and loaded, particularly for strategies running in live mode. It makes sure that the state of your scheduled signals is preserved, even if your application crashes or restarts.

It uses a system where each strategy gets its own dedicated storage, allowing for organized and efficient management of signal data. You can even customize how this data is stored using your own adapters.

The `readScheduleData` method retrieves previously saved scheduled signal data, crucial for restoring the strategy's state when it initializes. Conversely, `writeScheduleData` saves the current scheduled signal data, using a technique that ensures the save operation is reliable even if interrupted.

Finally, `usePersistScheduleAdapter` allows you to integrate your own custom storage solution for scheduled signals, providing flexibility and control over the persistence process.

## Class PersistRiskUtils

This utility class helps manage and store information about your active trading positions, specifically focusing on risk profiles. It's designed to ensure your positions are reliably saved and restored, even if something unexpected happens.

It keeps track of storage instances for each risk profile, and allows you to plug in your own custom storage solutions if you need more specialized behavior. You're able to read existing position data and write new data to disk in a way that’s designed to be safe, minimizing the risk of data corruption.

The `readPositionData` method is used to retrieve saved positions, and `writePositionData` is used to save them, ensuring a consistent and recoverable state. You can even register custom adapters to tailor how this persistence works to your specific needs.

## Class PersistPartialUtils

This class, PersistPartialUtils, helps manage how partial profit and loss data is saved and retrieved, particularly for live trading environments. It ensures that information like partial fills isn't lost even if there are interruptions.

It smartly keeps track of storage locations for each trading symbol, avoiding unnecessary duplication. You can even customize how the data is stored by providing your own adapter.

The `readPartialData` method is used to load any existing partial data when starting up, and if no data is found, it simply returns nothing. Conversely, `writePartialData` securely saves changes to the disk using atomic operations, making sure your data remains consistent even if something unexpected happens. Finally, `usePersistPartialAdapter` allows you to plug in your own storage solution if the default isn't suitable.

## Class PerformanceMarkdownService

This service helps you understand how your trading strategies are performing. It listens for performance data, keeps track of key metrics for each strategy and symbol combination, and then calculates overall statistics like average return, minimum drawdown, and percentiles.

You can easily generate detailed markdown reports that pinpoint potential bottlenecks in your strategies, which are then saved to log files. The service uses a unique storage area for each symbol and strategy pair, ensuring data isolation. 

To get started, you'll need to initialize the service and then let your trading logic send performance data to it. You can then retrieve aggregated statistics or request a full report. There’s also a handy function to clear all accumulated performance data when needed. The initialization process happens only once, ensuring efficient startup.

## Class Performance

The Performance class helps you understand how well your trading strategies are performing. It offers tools to gather and analyze metrics, allowing you to identify areas for improvement. 

You can retrieve performance data for specific symbol-strategy combinations, which gives you a detailed breakdown of metrics like duration, average time, and volatility.  It's like getting a report card for each strategy, highlighting its strengths and weaknesses.

The class can also generate easy-to-read markdown reports.  These reports visually represent how time is spent in different parts of your strategy, show detailed statistics, and use percentile analysis to pinpoint potential bottlenecks.

Finally, you can save these performance reports directly to your disk, making it simple to track progress over time and share your findings. It automatically creates the necessary directories if they don’t already exist.

## Class PartialUtils

This class helps you understand and share details about partial profit and loss information during backtesting or live trading. It acts like a central hub for accessing and organizing these smaller, incremental gains and losses.

You can use it to get overall statistics, like the total number of profit and loss events. It can also create nicely formatted markdown reports that display each individual event, including the action (profit or loss), symbol traded, the strategy used, signal ID, position, level, price, and timestamp. Think of it as generating a detailed log of every small step in your trading.

Finally, it can save these reports directly to a file, making it easy to share them or keep a record of your trading performance. The file names follow a simple pattern: {symbol}_{strategyName}.md, so you're able to clearly identify what each report represents.

## Class PartialMarkdownService

This service helps you track and report on partial profits and losses in your trading backtests. It listens for events indicating profits and losses, keeping a record of them for each symbol and strategy you're testing. You can then generate nicely formatted markdown reports summarizing these events, complete with statistics like total profits and losses.  The service automatically saves these reports to disk, organizing them by symbol and strategy.  It's designed to be easy to use – the initialization happens automatically when you first use it.  You can also clear the stored data if needed, either for everything or for specific symbol-strategy combinations.

## Class PartialGlobalService

This service helps keep track of partial profits and losses in your trading strategies. Think of it as a central point for managing these calculations, ensuring everything is logged and handled consistently. It's designed to be injected into your trading strategy, acting as a middleman between the strategy itself and the underlying connection service.

The `loggerService` property is how the service records its actions, providing a log of all partial profit/loss operations. The `partialConnectionService` handles the actual work of creating and managing the partial connection instances.

The `profit` function is called when a profit level is reached, the `loss` function when a loss level is reached, and `clear` is used to reset the partial profit/loss when a signal is closed. Each of these functions logs the operation before forwarding it to the connection service.

## Class PartialConnectionService

This service manages the tracking of partial profits and losses for each trading signal. It acts as a central hub, creating and maintaining a record for each signal’s performance. 

Think of it as a factory – whenever a new trading signal appears, it automatically creates a dedicated record to monitor its progress. This record, called a `ClientPartial`, is reused each time the signal is encountered, avoiding redundant setup.

It intelligently caches these records for efficiency. When a signal is closed, this service cleans up those records, preventing clutter and ensuring resources are managed effectively. 

You’re essentially getting a convenient, automatically-managed system for keeping tabs on each signal’s partial performance, with each signal getting its own tracked record. It uses a special technique to quickly retrieve these records and clears them when they're no longer needed.

## Class OutlineMarkdownService

This service helps you automatically create markdown files to document the conversations and results of your trading strategies, especially when using AI to optimize them. It's designed to save the system prompts, user inputs, and the final LLM outputs in an organized way.

The service organizes the documentation into directories, creating subdirectories under `dump/strategy/{signalId}`.  Inside each strategy's directory, it saves the system prompt, each user message as separate files, and the final output from the LLM alongside the signal data.

The `dumpSignal` function is the core of this service. It takes the signal ID, conversation history, signal details, and optionally a custom output directory.  It will create the necessary markdown files, but it smartly avoids overwriting existing files, so you can track changes over time. It relies on a logger service provided via dependency injection.

## Class OptimizerValidationService

This service helps ensure your optimizers are properly registered and available for backtesting. Think of it as a central record-keeper for your optimizers, making sure they exist and have the correct structure. 

It keeps track of all registered optimizers, preventing you from accidentally trying to use ones that aren't properly set up. To avoid repeated checks, it remembers the results of validation steps, making the process faster. 

You can use it to add new optimizers to the registry, check if an optimizer exists, or see a complete list of all registered optimizers. This helps keep your backtesting environment organized and reliable.

## Class OptimizerUtils

This utility class offers helpful tools for working with backtest strategies, particularly when using an optimizer. 

You can use it to retrieve information about your strategies, like their metadata and performance details. It allows you to easily generate the complete code for a strategy, which includes all the necessary parts like imports and helper functions. Finally, it can automatically create and save the generated code to a file, organizing it into a clearly named structure. This makes exporting and deploying your strategies much simpler.

## Class OptimizerTemplateService

This service acts as a blueprint for creating code snippets used in backtesting and optimization. It leverages a large language model (LLM) to generate these snippets, providing a foundation you can customize.

It handles various parts of the process, including generating code for:

*   **Overall setup:** Creating introductory banners with necessary imports.
*   **User prompts:**  Formulating initial messages for the LLM to acknowledge data.
*   **Assistant responses:** Crafting simple acknowledgment replies from the LLM.
*   **Strategy comparison:** Creating "Walker" configurations to compare different trading strategies.
*   **Individual strategies:**  Generating the code for each strategy itself, incorporating multi-timeframe analysis and signal creation.
*   **Exchange connections:**  Creating code to connect to exchanges like Binance using CCXT.
*   **Timeframe setup:** Generating code to define the specific timeframes (1m, 15m, etc.) for analysis.
*   **Running the analysis:**  Creating a "launcher" to start the analysis process and track its progress.
*   **Debugging:**  Creating helper functions to save detailed information to files for debugging purposes.
*   **Text Generation:** Generating a helper for generating plain text responses using a specific LLM model.
*   **Structured Signals:** Creating a helper for generating structured JSON output for trading signals, including details like entry price, take profit, stop loss, and expected duration.

This service can be partially adjusted to tailor the generated code to your specific needs.

## Class OptimizerSchemaService

This service helps keep track of different optimizer configurations, ensuring they're set up correctly and consistently. It's like a central catalog for your optimizer setups.

It lets you register new optimizer setups, and before it adds them, it makes sure they have the essential information like a name, the data range to use for training, where to find the data, and how to create prompts. 

You can also update existing optimizer setups by changing a few details without having to redefine the whole thing.

Finally, it provides a simple way to look up an optimizer setup by its name when you need it. This service relies on a tool registry to safely store these configurations.

## Class OptimizerGlobalService

The OptimizerGlobalService acts as a central hub for interacting with optimizers, ensuring everything runs smoothly and securely. It's the main place you'll go to get data, code, and save generated strategies. 

Think of it as a gatekeeper – it logs each request, checks that the optimizer you’re working with actually exists, and then passes the work on to specialized services. 

You can use this service to retrieve strategy data, generate the complete code needed to run a strategy, or save that code directly to a file. Behind the scenes, it handles the necessary checks and logging to keep things organized and reliable. 

It relies on other services – like a logger and dedicated optimizer connection and validation services – to do its job effectively.


## Class OptimizerConnectionService

The OptimizerConnectionService helps you easily work with optimizers in your backtesting framework. It's like a central hub that manages and reuses optimizer connections, preventing you from creating new ones every time you need one.

It cleverly caches these optimizer connections – meaning it remembers them for future use to improve speed and efficiency. When you request an optimizer, it checks if it's already been created; if not, it creates it, merges any custom settings with default settings, and saves it for later.

You can use it to get data for your strategies, generate the actual code that will run your strategies, and even save that code directly to a file. It’s designed to make using optimizers smooth and manageable within your backtesting environment.

## Class LoggerService

This service helps ensure consistent logging across your trading strategies and framework components. It automatically adds useful information to your log messages, such as the strategy name, exchange, and current frame, so you don't have to manually include them each time. It also incorporates details about the symbol being traded, the time, and whether it's a backtest.

You can customize the service by providing your own logger implementation using the `setLogger` method, but if you don't, it's configured to use a basic "no-op" logger that doesn't actually record anything.  The `log`, `debug`, `info`, and `warn` methods are your primary tools for emitting log messages, each representing different severity levels.

## Class LiveUtils

The LiveUtils class provides tools for running and managing live trading operations. Think of it as a helper for connecting your trading strategies to a live exchange.

It offers a `run` function that essentially kicks off the live trading process for a specific trading symbol and strategy. This function is designed to run continuously, recovering from crashes by saving its progress. You can also use `background` to run this process silently in the background, useful for tasks like updating databases or triggering external actions.

To halt the trading process, there's a `stop` function that gracefully shuts down signal generation, allowing currently open positions to close normally. `getData` lets you retrieve statistics about the trading activity, while `getReport` creates a handy markdown report summarizing events.

If you need to persist the report, `dump` can save it to disk. Finally, `list` provides an overview of all the live trading instances and their current status – helpful for monitoring what's running. The `_getInstance` property is an internal detail for how these live instances are managed.

## Class LiveMarkdownService

The LiveMarkdownService helps you automatically create detailed reports about your trading strategies. It keeps track of all the different events that happen during trading – like when a strategy is idle, opens a position, is actively trading, or closes a position.

The service takes all this information and turns it into easy-to-read markdown tables, which are saved as files on your computer.  It also calculates important trading statistics like win rate and average profit.

Each trading strategy and symbol combination gets its own separate report, keeping everything organized.  You don't need to manually create or update these reports – the LiveMarkdownService handles it all automatically, using data from the `onTick` events.

To get started, the service subscribes to live trading signals, but this happens automatically the first time you use it. You can clear the accumulated data if needed, either for a specific strategy or all strategies at once.

## Class LiveLogicPublicService

This service helps manage and orchestrate live trading, making it easier to work with. It builds upon a private service and automatically handles things like tracking the strategy and exchange being used, so you don't have to pass those details around everywhere. 

Think of it as a continuous stream of trading events – both signals to buy or sell and confirmations when trades are closed – that keeps running indefinitely. If something goes wrong and the process crashes, it can automatically recover and pick up where it left off, thanks to saved state.

You can start a live trading session for a specific symbol, and the service takes care of the rest, generating a stream of trading results. It’s designed to run continuously and reliably.

## Class LiveLogicPrivateService

This service handles the continuous, real-time execution of your trading strategy. Think of it as the engine that keeps your strategy running and responding to market changes. It operates in an endless loop, constantly checking for new signals and delivering updates on trades that are opened or closed. 

The service is designed for efficiency – it streams results to avoid using excessive memory.  If something goes wrong and the process crashes, it's designed to recover and pick up where it left off, ensuring your trading doesn't miss a beat. 

You give it a symbol to trade, and it sends you a continuous stream of updates regarding opened and closed positions. It uses a built-in mechanism to track its progress and recover from unexpected interruptions.

## Class LiveCommandService

This service acts as a central hub for enabling live trading within the backtest-kit framework. Think of it as a simplified way to inject dependencies needed for live trading functionality, making it easier to manage and test. 

It provides access to various services like logging, strategy validation, exchange validation, schema management, and risk assessment, ensuring a robust trading environment. 

The core functionality lies in the `run` method, which initiates and continuously manages live trading for a specific symbol. This `run` method acts like a tireless worker, constantly fetching data and executing trades, while also automatically recovering from unexpected crashes to keep the process running smoothly. It essentially handles the complexities of live trading so you don't have to.

## Class HeatUtils

HeatUtils is a handy tool to visualize and analyze your backtesting results with heatmaps. It gathers data from your closed trades, automatically organizing statistics for each strategy you’re running.

You can easily retrieve the raw data for a strategy’s heatmap, or generate a nicely formatted markdown report that displays key metrics like total profit/loss, Sharpe Ratio, and maximum drawdown for each symbol.

For quick access and convenience, HeatUtils is set up as a single, easily accessible instance. You can also save these reports directly to your disk, with the tool creating any necessary directories.

## Class HeatMarkdownService

The Heatmap Service helps you visualize and analyze your backtest results, especially focusing on how different strategies are performing. It gathers data from closed trades, calculating key metrics like total profit, Sharpe Ratio, and maximum drawdown for each strategy and individual symbols.

It creates separate, isolated data storage for each strategy, ensuring your analysis remains organized. You can request data about a specific strategy to see how it's doing or generate a nicely formatted markdown report that summarizes the key performance indicators.

The service handles potential math errors gracefully, preventing unexpected issues with calculations. It automatically initializes itself when needed, but you can also manually trigger initialization if required. You can also clear the data for a specific strategy, or clear all accumulated data to start fresh.

## Class FrameValidationService

The FrameValidationService helps you keep your trading backtests organized and consistent. It acts like a registry for your different data frames, ensuring they all follow a defined structure. 

You can use it to register the schema for each frame, which essentially tells the system what data to expect. It provides a simple way to check if a frame exists and to list all the registered frames. This service makes it easier to catch errors early on and maintain a reliable backtesting environment.

## Class FrameSchemaService

The FrameSchemaService acts as a central place to manage and store your frame schemas – essentially, the blueprints for your backtesting data. It uses a type-safe system to keep track of these schemas, ensuring consistency in your backtesting setup.

You can add new frame schemas using `register()`, allowing you to define the structure of your data. If a schema already exists, you can update it using `override()`, providing only the changes you need. 

To use a defined schema, just ask for it by name using `get()`. Before a schema is accepted, it goes through a quick check using `validateShallow` to make sure the basic structure is correct. This service keeps everything organized and prevents errors due to mismatched data structures.

## Class FrameGlobalService

The FrameGlobalService is a crucial component that manages how timeframes are generated for your backtesting process. Think of it as the engine that figures out exactly when your trades will happen, based on the data you’re using. It works closely with the FrameConnectionService to retrieve the timeframe data and validates it to ensure everything is correct. 

Inside, it keeps track of important services like a logger to record events and a connection service to access the actual historical data. The primary function, `getTimeframe`, is what you'd use to get a list of specific dates and times for a particular trading symbol and timeframe, like daily or hourly data. This makes sure your backtest executes with the correct sequence of time periods.

## Class FrameConnectionService

The FrameConnectionService acts as a central hub for managing and accessing different trading frames within your backtesting system. It intelligently directs requests to the correct frame implementation based on the currently active method context. 

To optimize performance, it uses caching to store frequently used frame instances, avoiding unnecessary creation. This service also handles backtesting timeframe management, allowing you to define start and end dates for your tests. 

When in live mode, no specific frame is active, and the service operates without any frame-related constraints.

The `getFrame` function is your primary way to obtain a frame; it fetches a cached instance or creates a new one if it doesn't already exist.  You can use `getTimeframe` to get the start and end dates associated with a specific frame, helping to constrain your backtesting period.

## Class ExchangeValidationService

The ExchangeValidationService helps you ensure your trading exchanges are properly set up and conform to expected structures. Think of it as a quality control system for your exchanges. 

You start by adding exchange schemas – blueprints that define how each exchange should look – using the `addExchange` method.  The `validate` method then checks if a specific exchange's configuration matches the schema you've defined. 

If you need to see what exchanges have been registered, the `list` method provides a simple way to retrieve all the exchange schemas. The `loggerService` property offers a way to hook into logging, while `_exchangeMap` is an internal storage.

## Class ExchangeSchemaService

This service helps you keep track of information about different cryptocurrency exchanges, ensuring everything is consistent and well-organized. It uses a special system for storing this information safely and avoiding errors.

You can add new exchange details using `addExchange()` and find them later by their name using `get()`. 

Before adding an exchange, `validateShallow` checks that the basic details are in the right format.  If you need to update an existing exchange’s details, `override` lets you change just parts of the information. The service keeps a log of its actions through the `loggerService`.

## Class ExchangeGlobalService

This service acts as a central point for interacting with an exchange, making sure that crucial information like the trading symbol, the trading time, and backtesting parameters are always available when needed. It builds upon other services to provide a consistent way to fetch data and format values.

The `validate` function checks the exchange setup and saves the result so it doesn't need to repeat the check every time.

You can use `getCandles` to retrieve historical price data, `getNextCandles` to look into the future (only when backtesting), and `getAveragePrice` to calculate the average price during a specific period.  Finally, functions like `formatPrice` and `formatQuantity` help to display these values in the correct format, adapting to the specific exchange and whether you are in backtest or live mode.

## Class ExchangeConnectionService

The ExchangeConnectionService acts as a central hub for interacting with different cryptocurrency exchanges. It intelligently directs your requests—like fetching historical data or getting the current average price—to the correct exchange based on your specified settings.

To optimize performance, it keeps a record of the exchanges it's working with, so it doesn't need to re-establish connections repeatedly. This service provides a simple way to access common exchange operations while handling the complexities of dealing with different exchange APIs.

Here's a breakdown of its core features:

*   **Smart Routing:** It automatically figures out which exchange to use for your requests.
*   **Performance Boost:** It remembers exchanges to avoid unnecessary connections.
*   **Comprehensive Access:** It provides a complete set of operations you're likely to need.
*   **Price and Quantity Formatting:** It adjusts prices and order quantities to match the specific rules of each exchange.



It relies on other services to understand the current settings and context of your operations, including things like the desired exchange and timestamp.

## Class ConstantUtils

This class provides a set of pre-calculated percentages used for setting take-profit and stop-loss levels in your trading strategies. These values are derived from the Kelly Criterion and incorporate a risk decay model, aiming to optimize profit-taking and loss mitigation.

Think of it as a structured way to manage how much of your potential profit you secure at different points, and how quickly you reduce risk when things aren’t going as planned.

*   **TP_LEVEL1 (30)**:  A first take-profit target, capturing a small portion of the potential gain.
*   **TP_LEVEL2 (60)**:  A second take-profit, designed to secure a larger share of the potential profit.
*   **TP_LEVEL3 (90)**:  A final take-profit, locking in nearly all of the potential gain.
*   **SL_LEVEL1 (40)**: An early warning stop-loss, reducing exposure if the initial trading setup weakens.
*   **SL_LEVEL2 (80)**: A final stop-loss, designed to exit the remaining position and prevent a significant loss.

These constants are intended to be used as a foundation for defining your take-profit and stop-loss levels, allowing for a systematic approach to risk management.

## Class ClientSizing

This component, ClientSizing, helps determine how much of an asset your trading strategy should buy or sell. It’s like a smart sizing tool that considers various factors to find the right amount. 

You can choose from different sizing methods like fixed percentages, the Kelly Criterion, or using Average True Range (ATR) to adjust position sizes based on market volatility.  It also lets you set limits – minimum and maximum position sizes, and a cap on how much of your total capital a single trade can use. 

Essentially, ClientSizing takes input data and applies your chosen sizing rules to figure out the ideal position size, ensuring your trades are aligned with your risk management strategy. It’s used during the actual execution of your trading strategy to ensure trades are sized appropriately.


## Class ClientRisk

ClientRisk helps manage the overall risk of your trading portfolio by setting limits and ensuring your strategies don't take on too much exposure. It acts as a central control point, preventing signals from being executed if they would violate those limits, even if they originate from different trading strategies.

Think of it as a safety net – multiple strategies can share the same ClientRisk instance to analyze risk across all of them. It keeps track of all currently open positions to provide a complete picture. 

It has a few key components: it's initialized once to load existing positions, allows for custom risk checks, and then keeps track of newly opened and closed positions. This helps you control your portfolio's risk profile in a consistent way. When a new trade is considered, the ClientRisk module checks to see if it’s safe to execute it based on predefined constraints.

## Class ClientOptimizer

The `ClientOptimizer` is a crucial part of the backtest-kit framework, handling the behind-the-scenes work of optimizing your trading strategies. Think of it as the engine that gathers data, crafts strategy code, and prepares everything for testing. 

It collects data from various sources, breaking it down into manageable chunks, and uses that information to build a history of conversations that will be used by an LLM. It then assembles all the necessary code components - imports, helper functions, and the core trading strategy itself - into a single, ready-to-run program.

You can also ask it to export your generated strategy code to a file, creating any needed directories along the way. It makes the process of taking your strategy idea and turning it into functional code much easier.

## Class ClientFrame

The ClientFrame is a crucial component that handles the creation of timeframes for backtesting trades. Think of it as the engine that produces the sequence of dates and times your trading strategy will be tested against. 

It avoids unnecessary work by storing previously generated timeframes – a process called singleshot caching. You can control how far apart these time points are, ranging from one minute to three days.

The ClientFrame also allows for custom validation and logging during timeframe generation. It’s used internally by the BacktestLogicPrivateService to efficiently step through historical data.

The `getTimeframe` function is the primary method to use, it creates the timeframe array and uses the singleshot caching.


## Class ClientExchange

The `ClientExchange` class provides a way to interact with an exchange for backtesting purposes. It's designed to be efficient by using prototype functions to minimize memory usage.

You can use it to retrieve historical candle data, looking back from a specific point in time.  It also provides a way to fetch future candles, crucial for simulating trading scenarios within a backtest.

The class can calculate the VWAP (Volume Weighted Average Price) which is a useful indicator when analyzing price trends. This calculation considers the typical price of each candle, which is the average of its high, low, and closing price, weighted by its volume. If volume data is unavailable, it defaults to a simple average of closing prices.

Finally, `ClientExchange` handles formatting quantities and prices to match the exchange's specific requirements, ensuring that orders are properly constructed for the simulation.

## Class BacktestUtils

The `BacktestUtils` class is your helper for running and managing backtests within the trading framework. Think of it as a central place to start, monitor, and get results from your backtesting experiments.

You can easily kick off a backtest for a specific symbol and strategy using the `run` method, which handles the underlying mechanics and adds helpful logging.  If you just want to run a backtest for side effects like logging or triggering callbacks without needing to see the results directly, the `background` method lets you do that.

Need to put a stop to a strategy mid-backtest?  The `stop` method allows you to halt signal generation, letting any existing signals finish up naturally.

Want to check how your strategy performed? `getData` pulls statistical information from completed backtests, and `getReport` generates a formatted markdown report detailing the results.  You can also save that report to a file using `dump`.

Finally, the `list` function provides a quick overview of all running backtest instances and their current status, giving you insight into what's happening behind the scenes.  The class is designed to be easily accessible and simplifies the process of running and analyzing backtests.

## Class BacktestMarkdownService

The BacktestMarkdownService helps you create readable reports about your backtest results. It automatically listens for trading signals and keeps track of closed trades for each strategy you’re testing.

You can think of it as a reporter that builds tables filled with details about each closed trade, making it easy to see how your strategies performed. It stores this information separately for each symbol and strategy, keeping things organized.

The service can generate these reports as markdown files, saving them to your logs directory, so you can easily review and share your backtest findings. It also has a handy way to clear the stored data when you's done with a backtest, or just clear data for a specific symbol and strategy. The service initializes itself automatically when you start using it.

## Class BacktestLogicPublicService

BacktestLogicPublicService helps you run backtests in a more streamlined way. It manages the underlying backtesting logic and automatically handles important context information like the strategy name, exchange, and timeframe. 

Think of it as a helper that simplifies the backtesting process by taking care of passing the necessary details around – you don't have to specify them every time you call a function.

The `run` function is the main way to execute a backtest, producing results as a stream. This allows you to process the backtest results as they become available, rather than waiting for the entire process to complete. The context is automatically passed to all the functions that perform the backtesting calculations.

## Class BacktestLogicPrivateService

This service is the engine that drives your backtesting process. It orchestrates the whole backtest by managing timeframes and signals. 

Think of it as a conductor, coordinating the data from different services – like getting the timeframes, handling signals, and running the actual backtest logic. 

It works by stepping through each timeframe, checking for trading signals, and then, when a signal instructs a trade, it retrieves the necessary candle data and executes the backtest. 

Importantly, this process streams the results as they become available, avoiding the buildup of large arrays in memory, which is especially helpful for long backtests.

You can initiate a backtest for a specific trading symbol using the `run` method, which returns an asynchronous generator that yields results for closed signals. You can break the generator at any time to end the backtest early.

## Class BacktestCommandService

This service acts as a central point for initiating and managing backtesting operations within the framework. It's designed to be used when you need to kick off a backtest, providing a straightforward way to trigger the process.

Think of it as a helper that bundles together all the necessary components—like logging, schema validation, and the core backtesting logic—to make things easier to manage.  You can use it to start a backtest for a specific asset, providing details about the strategy, exchange, and data frame you want to use.  The service then handles all the behind-the-scenes work to execute the backtest and return the results. It’s all about simplifying the process of running simulations of your trading strategies.

# backtest-kit interfaces

## Interface WalkerStopContract

This interface describes a signal that's sent when a Walker is being stopped. Think of it as a notification that a specific trading strategy, running under a particular name within a larger system, is being paused. 

It tells you which trading symbol is affected, which strategy's execution is being halted, and the name of the Walker initiating the stop. This is especially useful when you have multiple strategies running concurrently, allowing you to pinpoint exactly which one is being interrupted. You can use the walkerName to selectively react to stop events for specific walkers.


## Interface WalkerStatistics

The WalkerStatistics interface helps organize and understand the results of backtesting different trading strategies. Think of it as a container for all the data you need to compare how various strategies performed. It builds upon the existing IWalkerResults, adding a key piece of information: a list of strategy results. This `strategyResults` array lets you easily access and analyze the performance of each strategy you tested.

## Interface WalkerContract

The WalkerContract represents a notification about the progress of a strategy comparison test. It's like a checkpoint message you receive as the system evaluates different trading strategies.

Each message tells you which strategy just finished testing, along with details like the exchange and symbol being used. You'll also find key information about the results, including statistics, a metric value (which might be invalid), and how this strategy compares to the best one seen so far. 

The notification also includes how many strategies have been tested and the total number planned, giving you a sense of how much longer the process will take. It's a convenient way to track the optimization process and see which strategies are performing best.

## Interface TickEvent

This interface, `TickEvent`, provides a consistent way to represent all types of trading events within the backtest kit. Think of it as a single data structure that holds all the details you need, regardless of whether a trade is just starting, is actively running, or has already finished.

It includes information like the exact time of the event, the type of action that occurred (idle, opened, active, or closed), and the trading symbol involved. For trades that are opened or closed, you’re also provided with details such as the signal ID, position type, any notes related to the signal, and prices like the open price and stop-loss levels.

When a trade is actively running, you're given progress updates as percentages toward the take profit and stop loss. Finally, once a trade closes, you’re provided with the percentage profit/loss (PNL), the reason for closing the trade, and how long the trade lasted. This unified approach simplifies reporting and analysis across different trade events.

## Interface ScheduleStatistics

This interface helps you understand how your scheduled trading signals are performing. It gives you a breakdown of all the events that happened, whether they were scheduled or cancelled.

You'll find the total number of events, and separate counts for signals that were scheduled and those that were cancelled.

It also provides a cancellation rate, telling you the percentage of scheduled signals that were cancelled – a lower rate generally indicates better signal reliability. Finally, you can see the average wait time for cancelled signals, which can help pinpoint potential issues.

## Interface ScheduledEvent

This interface holds all the details about scheduled and cancelled trading signals, making it easy to generate reports and understand what happened. You'll find the exact time each event occurred, whether it was scheduled or cancelled, and the trading pair involved. 

It also includes key information like the signal ID, position type, and any notes associated with the signal. For scheduled signals, you're provided with the intended entry price, take profit level, and stop loss. If a signal was cancelled, you’ll see the time it was closed and the duration it ran. Essentially, it's a complete record of a signal's lifecycle.

## Interface ProgressWalkerContract

This interface describes the updates you’re given as a background process, like analyzing trading strategies, runs. It provides information about what’s happening during that process.

You'll see details like the name of the process, the exchange being used, and the trading symbol involved. Crucially, it tells you the total number of strategies being evaluated, how many have already been processed, and the overall percentage of completion. This lets you monitor the progress of your backtesting framework and get a sense of how long the process will take.

## Interface ProgressOptimizerContract

This interface helps you keep tabs on how your trading strategy optimizer is performing. It provides updates during the optimization process, letting you know the optimizer’s name, the trading symbol it's working on, and how much data it has processed out of the total amount. You’ll see the total number of data sources, the number already handled, and a percentage indicating the overall completion. Essentially, it's a progress report for your optimizer.

## Interface ProgressBacktestContract

This interface helps you monitor the progress of a backtest as it runs. It provides details about what's happening behind the scenes. 

You’ll see the name of the exchange and strategy being used, as well as the trading symbol. The interface tells you the total number of historical data points (frames) the backtest will analyze, and how many it has already processed. Finally, it provides a percentage representing how far along the backtest is, making it easier to understand its overall status.

## Interface PerformanceStatistics

This object holds a collection of performance data, grouped and summarized for a particular trading strategy. It tells you how a strategy performed, including the total number of events it generated and the overall time it took to run. 

Within this main object, you’ll find a breakdown of statistics organized by metric type, allowing you to analyze specific areas of performance. Finally, it provides access to the complete list of raw performance events, giving you the detailed records behind the summarized statistics. Essentially, this is your central hub for understanding a strategy's overall health and performance characteristics.


## Interface PerformanceContract

The PerformanceContract helps you keep an eye on how your trading strategies are performing. It captures important details like when an operation started and finished (timestamps), how long it took (duration), and which strategy, exchange, and symbol were involved. This data is particularly helpful for spotting slow parts of your code or areas where you can improve efficiency, whether you're testing a strategy in backtest mode or running it live. You can see the whole picture of performance metrics with the associated strategy and exchange names.

## Interface PartialStatistics

This interface holds key statistics about your trading backtest, specifically focusing on partial profit and loss events. Think of it as a snapshot of how your trading strategy performed, breaking down the total number of events, and separating them into profit and loss categories.  You'll find a list of all individual profit/loss events, along with the total count of all events and a count of each type (profit and loss). This information helps you analyze the overall performance of your trading strategy and identify potential areas for improvement.

## Interface PartialProfitContract

This interface describes what happens when a trading strategy hits a partial profit target, like 10%, 20%, or 30% profit. Each time a profit level is reached, this interface provides details about the trade, including the trading pair (symbol), all the original signal information, the price at the time the profit was achieved, the specific profit level reached (e.g., 10%), and whether the event occurred during a backtest or live trading. The timestamp indicates precisely when the profit level was detected, referencing either the tick time in live mode or the candle timestamp during backtesting. It’s used by systems to track partial profit executions and monitor strategy performance.

## Interface PartialLossContract

This interface describes what happens when a trading strategy hits a partial loss level, like -10%, -20%, or -30% from its initial entry price. Think of it as a notification that the strategy is experiencing a drawdown.

Each notification, or event, includes key details: the trading symbol involved (like BTCUSDT), all the data related to the original trading signal, the current price at the time of the loss, the specific loss level reached, whether this event occurred during a backtest or live trading, and the precise time it happened. 

The loss level is represented as a positive number (e.g., 20 represents a -20% loss).  These notifications are used to keep track of how a strategy is performing and can be used to generate reports about its drawdown. It’s important to note that each level is only reported once for each trading signal.

## Interface PartialEvent

This interface, `PartialEvent`, acts as a central hub for information about profit and loss milestones during a trading session. It gathers key data points like the exact time the event occurred, whether it was a profit or a loss, the trading pair involved, the name of the strategy that triggered it, and a unique identifier for the signal. You’ll also find details about the position being held, the market price at the time, the profit/loss level reached (like 10%, 20%, etc.), and whether the trading was part of a backtest or a live trade. Essentially, it provides a standardized way to track and report on the progress of a trade's profitability.

## Interface MetricStats

This object holds a collection of statistics related to a particular performance measurement, like how long an order takes to fill. It tells you how many times something was measured, the total time it took across all measurements, and a range of important details like the average, minimum, maximum, and standard deviation. You’ll find percentiles (like the 95th and 99th) which show the duration for a specific portion of the measurements. Finally, it also provides information about the wait times between those measurements, giving a complete picture of the performance.

## Interface MessageModel

The MessageModel is how backtest-kit keeps track of conversations when working with Large Language Models. Think of it as a single turn in a dialogue. Each message has a `role`, which tells you who sent it - whether it's the system providing instructions, the user asking a question, or the LLM responding. The `content` property holds the actual text of that message. This structure helps the Optimizer build prompts and remember the context of the conversation throughout the backtesting process.

## Interface LiveStatistics

This interface provides a detailed look at your live trading performance, giving you key statistics to analyze your strategy. You're given a complete history of events, including every idle, open, active, and closed signal, as well as a count of all events and just the closed signals.

It calculates fundamental metrics like the number of winning and losing trades, your overall win rate, and the average profit or loss per trade. More advanced measurements like standard deviation (a measure of volatility), Sharpe Ratio (which considers risk), and expected yearly returns are also provided to give you a well-rounded view of your trading results. Keep in mind that any calculation resulting in an unsafe value (like infinity or NaN) will be represented as null.

## Interface IWalkerStrategyResult

This interface describes the result you get when backtesting a single trading strategy as part of a larger comparison. Each result includes the strategy's name, a detailed set of backtest statistics, and a calculated metric used to compare it against other strategies.  You'll also find a rank assigned to the strategy, with the best performing strategy receiving a rank of 1. Essentially, it’s a packaged report for a single strategy’s performance within your backtesting system.


## Interface IWalkerSchema

The `IWalkerSchema` defines how to set up A/B tests for different trading strategies within the backtest-kit framework. Think of it as a blueprint for running comparisons between strategies and tracking their performance.

Each schema has a unique name (`walkerName`) to identify it and can include a note (`note`) for your own documentation.  You specify which exchange (`exchangeName`) and timeframe (`frameName`) should be used for all strategies involved in the test.

The most important part is the list of strategy names (`strategies`), which dictates which strategies you're comparing against each other.  You can also tell the framework what performance metric (`metric`) is most important for this comparison—like Sharpe Ratio, for example. Finally, you have the option to add custom callbacks (`callbacks`) to monitor the testing process at various stages.

## Interface IWalkerResults

This object holds all the information gathered after running a comparison of different trading strategies. It tells you which strategy was tested, the symbol it was tested on, and the exchange and timeframe used. You'll find details about the optimization metric used and how many strategies were evaluated in total. Most importantly, it highlights the best-performing strategy identified, along with its score (the best metric value) and a full set of statistics detailing its performance. It’s your one-stop shop for understanding the outcome of a strategy comparison.

## Interface IWalkerCallbacks

This interface lets you hook into the backtest process and get notified about what’s happening. You can use these callbacks to monitor the progress of your strategy tests, log results, or even react to errors in real-time.

When a backtest for a particular strategy and symbol begins, `onStrategyStart` will fire. Once a strategy's testing is finished, `onStrategyComplete` will let you know, providing statistics and a key metric.  If a strategy encounters a problem during testing, `onStrategyError` will be triggered, giving you details about the error. Finally, `onComplete` signals that all strategies have been tested, and provides a summary of the overall results.


## Interface IStrategyTickResultScheduled

This interface describes a specific type of tick result within the backtest-kit framework, representing a situation where a trading signal has been scheduled and is waiting for the price to reach the entry point. It's triggered when your strategy's `getSignal` function returns a signal that includes a desired entry price. 

Essentially, it tells you that your strategy has identified a potential trade and is patiently waiting for the market to move in the predicted direction. 

The data provided includes details like the strategy's name, the exchange being used, the trading symbol, the current price at the time the signal was scheduled, and the actual signal object that's waiting for execution. This allows you to monitor and analyze the behavior of your trading strategy as it anticipates market movements.

## Interface IStrategyTickResultOpened

This interface describes what happens when a new trading signal is created within your backtesting strategy. It's a notification that a signal has been successfully validated and saved, and it provides key details about that signal. 

You'll see this result when a strategy generates a new signal and it's confirmed as valid. The `signal` property gives you the full details of the newly created signal, including a unique ID. You also get information like the strategy and exchange names used, the symbol being traded (like "BTCUSDT"), and the current price used when the signal was opened. This data is helpful for monitoring strategy performance and debugging.

## Interface IStrategyTickResultIdle

This interface represents what happens when your trading strategy is in a pause, or "idle" state. It’s essentially a record of the conditions when no trades are being made. You'll see this data when your strategy isn't actively giving trading instructions. 

It includes details like the name of your strategy, which exchange it's connected to, the trading symbol (like BTCUSDT), the current price at that moment, and confirms that there's no active trading signal. Think of it as a log entry indicating a period of inactivity within your trading system.

## Interface IStrategyTickResultClosed

This interface describes the result when a trading signal is closed, providing a complete picture of what happened. It includes details like the original signal parameters, the price at which the signal was closed, and the reason for closing – whether it was due to a time limit, a take-profit target, or a stop-loss trigger.

You'll also find a record of the profit and loss, accounting for fees and slippage, along with the strategy and exchange names for tracking purposes. Finally, it specifies the trading symbol, such as "BTCUSDT," to clearly identify the asset being traded. This data is valuable for analyzing signal performance and understanding the factors that influenced trading outcomes.


## Interface IStrategyTickResultCancelled

This interface describes what happens when a scheduled trading signal is cancelled – essentially, it didn't lead to a trade being opened. This might happen if the signal was programmed to activate at a certain price, but that price wasn't reached, or if a stop-loss was hit before an entry could be made.

The data you get includes details about the cancelled signal itself, like the price at which it was scheduled, as well as the final price at the time of cancellation.  You'll also see the names of the strategy, exchange, and the trading pair involved, which helps in tracking and analyzing why the signal wasn't executed. It's a record of a planned action that didn’t happen, allowing you to understand your strategy’s behavior more deeply.


## Interface IStrategyTickResultActive

This interface represents the state of a trading strategy when it's actively monitoring a signal, waiting for a take profit, stop loss, or time expiration. It provides information about the active trade, including the signal being watched, the current price being used for monitoring, and the strategy and exchange involved. You’ll find details like the strategy's name, the trading symbol (like BTCUSDT), and how far the trade has progressed toward its take profit or stop loss goals. This data helps track the active trade and understand its current status within the backtesting framework.

## Interface IStrategySchema

This defines the blueprint for how your trading strategies work within the backtest-kit framework. Think of it as a recipe that tells the system how your strategy decides when to buy or sell.

Each strategy gets a unique name for easy identification. You can add a note to explain your strategy to other developers.

The `interval` property controls how often your strategy can make decisions, preventing it from overwhelming the system. 

The core of the strategy is the `getSignal` function, which takes market data and a timestamp to determine if a trade should be executed.  It can either trigger a trade immediately or schedule it to wait for a specific price to be reached.

You can optionally add lifecycle callbacks to your strategies, allowing you to perform actions when a trade is opened or closed.

Finally, the `riskName` property allows you to categorize your strategy based on its risk profile, useful for managing overall risk exposure.

## Interface IStrategyResult

This interface, `IStrategyResult`, represents a single row in a comparison table when evaluating different trading strategies. It holds the name of the strategy being tested, along with all its detailed statistical performance data from the backtest.  Crucially, it also includes the value of a specific metric used for ranking strategies, which can be missing if the strategy produced invalid results. Essentially, it's a container for all the information needed to assess and compare the performance of a particular strategy within the backtest kit.


## Interface IStrategyPnL

This interface, `IStrategyPnL`, neatly packages the results of a trading strategy’s profit and loss calculation. It gives you a clear picture of how your strategy performed, considering the impact of trading fees and slippage. 

The `pnlPercentage` property tells you the profit or loss expressed as a percentage – a simple way to gauge performance. You're also given the `priceOpen`, the entry price of your trade adjusted for those pesky fees and slippage, and `priceClose`, which shows the exit price similarly adjusted. This helps in understanding the actual realized prices and accurately assessing the strategy's profitability.

## Interface IStrategyCallbacks

This interface lets you hook into key events happening within your trading strategy. Think of them as notifications about what's going on – openings, closings, and various states of your signals.

You can provide functions to be called when a new signal is opened, when a signal becomes active and is being monitored, or when your system is in an idle state with no signals active.  There are also callbacks for when a signal is closed, or when a scheduled signal is either created or cancelled.

Beyond the standard signal lifecycle, you can receive updates about signals that are experiencing partial profits or losses – those situations where the price has moved in a favorable or unfavorable direction but hasn't yet reached a take profit or stop loss level.  Finally, a `onTick` callback gives you the raw price data with each tick, and an `onWrite` callback allows you to test persistence mechanisms.

## Interface IStrategy

The `IStrategy` interface outlines the essential functions a trading strategy needs within the backtest-kit framework.

The `tick` method is the heart of the strategy's execution, handling each incoming price update. It checks if a new trading signal should be generated, and also monitors any existing trading positions for potential take profit or stop-loss triggers.

`getPendingSignal` allows you to check if a trading signal is currently active for a specific asset. If a signal isn’t active, it returns nothing. It’s an internal helper that helps manage things like take profit/stop-loss conditions and time limits.

The `backtest` function lets you quickly test your strategy using historical price data. It simulates trading based on past candles, calculating VWAP and assessing take profit/stop-loss performance.

Finally, `stop` provides a way to pause signal generation. This doesn’t immediately close any existing trades – they continue to be monitored until their natural closing point (either take profit, stop-loss, or expiration) is reached. It’s useful for cleanly stopping a live trading strategy without abruptly closing open positions.

## Interface ISizingSchemaKelly

This interface defines how to calculate position sizes using the Kelly Criterion, a method for maximizing long-term growth. When implementing sizing strategies, you're telling the backtest-kit how much of your capital to allocate to each trade.

The `method` property is fixed and must be set to "kelly-criterion" to indicate you’re using this specific sizing approach. 

The `kellyMultiplier` property controls the aggressiveness of the Kelly Criterion. It’s a number between 0 and 1; a lower value (like the default of 0.25, known as a "quarter Kelly") is generally considered more conservative, while a higher value could lead to faster growth but also increased risk.

## Interface ISizingSchemaFixedPercentage

This schema defines how much of your capital you’ll risk on each trade using a fixed percentage. It’s straightforward – you simply specify a `riskPercentage`, which represents the percentage of your total capital you’re willing to lose on a single trade. This value is expressed as a number between 0 and 100, making it easy to understand and adjust based on your risk tolerance. The `method` property is always "fixed-percentage", confirming that this schema uses that specific sizing technique.

## Interface ISizingSchemaBase

This interface, `ISizingSchemaBase`, provides a foundation for defining how much of your trading account to allocate to each trade. Think of it as a blueprint for sizing strategies. 

It includes essential elements like `sizingName`, a unique identifier for your sizing configuration, and a `note` field for adding developer documentation. You'll find fields to control position sizing, setting maximum and minimum percentages of your account (`maxPositionPercentage`, `minPositionPercentage`) as well as absolute minimum and maximum position sizes (`minPositionSize`, `maxPositionSize`). Finally, it allows for optional callbacks (`callbacks`) that let you customize the sizing process at different stages.

## Interface ISizingSchemaATR

This schema defines how to size your trades based on the Average True Range (ATR), a measure of volatility. It's designed to help manage risk by adjusting trade size according to market fluctuations. 

The `method` is always "atr-based" to indicate the sizing strategy being used.

`riskPercentage` represents the maximum percentage of your capital you're willing to risk on a single trade – think of it as your risk tolerance, expressed as a number from 0 to 100. 

Finally, `atrMultiplier` determines how much space to give your stop-loss order based on the ATR value. A higher multiplier means a wider stop-loss, allowing for more natural price movement before being stopped out.

## Interface ISizingParamsKelly

This interface defines the parameters needed for determining trade sizes using the Kelly Criterion within the backtest-kit framework. It's all about controlling how much of your capital you risk on each trade based on expected returns. 

The `logger` property is essential; it allows you to monitor and debug the sizing calculations, providing valuable insights into how the Kelly Criterion is being applied. This helps you understand and potentially fine-tune your trading strategy.

## Interface ISizingParamsFixedPercentage

This interface defines how to set up your trade sizing when using a fixed percentage approach. It allows you to specify a logger for tracking and debugging your sizing decisions. Essentially, it's a way to control how much of your capital you allocate to each trade, consistently using the same percentage. The logger property provides a way to monitor the sizing calculations and identify any potential issues.

## Interface ISizingParamsATR

This interface, `ISizingParamsATR`, helps you configure how much of your capital to use for each trade when using an ATR (Average True Range) based sizing strategy. It’s designed to work with the `ClientSizing` component within the backtest-kit framework. 

You’re required to provide a `logger` object that allows you to track and debug your sizing calculations – essentially, it helps you understand what’s happening behind the scenes as your trades are sized. It’s all about transparency and making sure your sizing logic is behaving as expected.

## Interface ISizingCallbacks

This interface provides a way to be notified when the backtest-kit framework determines the size of a trade. Specifically, the `onCalculate` property lets you hook into the sizing calculation process – think of it as a chance to observe or verify the size that's been computed before the order is actually placed. You can use this to log the calculated quantity, examine the parameters that influenced the sizing, or ensure the size is within acceptable bounds. It's all about gaining insight into how your sizing logic is behaving.

## Interface ISizingCalculateParamsKelly

This interface defines the information needed to calculate trade sizes using the Kelly Criterion. 

It outlines three key pieces of data: the calculation method, which must be "kelly-criterion," your win rate (expressed as a number between 0 and 1), and your average win-loss ratio. Think of the win rate as the percentage of times you win a trade, and the win-loss ratio as how much you gain on a winning trade compared to how much you lose on a losing one. Providing these values allows the framework to automatically determine an appropriate bet size based on the Kelly Criterion formula.

## Interface ISizingCalculateParamsFixedPercentage

This interface defines the information needed to calculate your trade size using a fixed percentage approach. It’s pretty straightforward: you specify the `method` as "fixed-percentage" to indicate you're using this sizing method.  You also need to provide a `priceStopLoss`, which is the price at which your stop-loss order will be triggered. This allows the framework to determine the appropriate trade size based on that stop-loss price and a predefined percentage.

## Interface ISizingCalculateParamsBase

This interface defines the basic information needed when calculating how much of an asset to buy or sell. It includes the symbol of the trading pair, like "BTCUSDT," representing which assets are being traded. You'll also find the current balance of your trading account, and the anticipated entry price for the trade. These three pieces of information serve as the foundation for any sizing strategy.

## Interface ISizingCalculateParamsATR

This interface defines the information needed when calculating trade sizes using an ATR (Average True Range) based method. It requires you to specify that you're using the "atr-based" sizing approach. You're also expected to provide the current ATR value as a number, which will be used in the sizing calculation. Essentially, it’s the data structure that tells the system *how* you want to size your trades – using ATR – and *what* the ATR value is.

## Interface ISizing

The `ISizing` interface is the heart of how backtest-kit determines how much of an asset your strategy should buy or sell. Think of it as the sizing engine. 

It provides a `calculate` method that you’re expected to implement within your strategies.  This method takes in parameters describing the current trading situation – things like risk tolerance, account balance, and the price of the asset – and it returns a number representing the size of the position you want to take. It's a promise because complex sizing logic might involve asynchronous operations.





## Interface ISignalRow

This interface represents a complete trading signal, acting as the standard format used within the backtest-kit framework after a signal has been validated. Each signal gets a unique ID automatically assigned to it, ensuring it can be tracked throughout the backtesting process.

You'll find information about the entry price for a trade, along with details about which exchange and strategy generated the signal. There’s also a timestamp indicating when the signal was initially created and when it became pending. The trading symbol, like "BTCUSDT", is clearly identified. 

Finally, an internal flag tracks whether the signal was initially scheduled, providing valuable information for runtime processes. Essentially, this interface holds all the essential information needed to execute and analyze a trading signal.

## Interface ISignalDto

The `ISignalDto` represents the data used to define a trading signal. Think of it as a blueprint for a trade, containing all the essential details.  It includes a unique identifier, whether you're planning a long (buy) or short (sell) position, and a helpful note explaining the reasoning behind the trade.  You’ll also specify the entry price, along with your target take profit and stop loss levels – remember, the take profit must be higher than the entry for long positions and lower for short positions, while the stop loss should be the opposite. Finally, you can estimate how long you expect the signal to be active before it expires.


## Interface IScheduledSignalRow

This interface, `IScheduledSignalRow`, describes a signal that's waiting for a specific price to be reached before a trade is executed. Think of it as a signal that’s on hold, patiently waiting for the market to come to it. It builds upon the standard `ISignalRow` to include the delayed execution aspect.

When a signal is created in this way, it's considered a "pending" signal, waiting for the `priceOpen` to be met. Once the market price hits that `priceOpen`, the pending signal transforms into a normal, active signal. 

A key piece of information tracked is `scheduledAt`, which initially represents when the signal was created and when it *should* have started. This timestamp changes to reflect the actual time the signal becomes active.


## Interface IRiskValidationPayload

This interface defines the data you get when you're checking for risk – it's the information a risk validation function uses. Think of it as a snapshot of your trading activity. 

It builds upon the `IRiskCheckArgs` interface, adding details about what's currently happening in your portfolio. Specifically, it tells you how many positions are currently open (`activePositionCount`) and provides a list of those positions with their specifics (`activePositions`).  This allows risk checks to consider the current state of your trades.

## Interface IRiskValidationFn

This type defines a function that's responsible for checking if your trading strategy's risk settings are reasonable. Think of it as a safety net – it makes sure you haven't set things like maximum position size or stop-loss levels to values that could lead to unexpected or dangerous outcomes. 

The function receives the risk parameters, and its job is to carefully examine them. If anything seems off or violates your defined rules, it should throw an error to alert you and prevent the backtest from proceeding with potentially flawed settings. Essentially, it's a crucial tool for keeping your backtesting process reliable and preventing costly mistakes.

## Interface IRiskValidation

This interface, `IRiskValidation`, helps you define how to check if your trading risks are acceptable. Think of it as a way to create rules that ensure your trades stay within certain boundaries. 

It has two main parts:

*   `validate`: This is the core – it's a function you write that takes the risk parameters and determines if they pass the validation.
*   `note`:  This is an optional explanation you can add to describe what the validation does. It's great for making sure you and others understand the purpose of the check.

## Interface IRiskSchema

The `IRiskSchema` helps you define and enforce rules for your trading portfolio. Think of it as a way to create custom risk profiles within backtest-kit. 

Each schema has a unique `riskName` to identify it, and you can add a `note` to explain what the profile is for. 

You can also provide optional lifecycle callbacks, `callbacks`, which let you react to certain events related to risk decisions.  The core of the schema is the `validations` array, which is where you specify the actual rules that will be checked during your backtesting. These validations allow you to build in specific constraints and safeguards to control your portfolio's behavior.

## Interface IRiskParams

The `IRiskParams` interface defines the information needed when setting up the risk management part of your backtesting system. Think of it as a way to configure how the system handles potential risks during simulations. 

It primarily focuses on providing a `logger`. This logger allows you to track what’s happening under the hood, useful for debugging and understanding why decisions are being made during backtesting. It’s your window into the risk management process.


## Interface IRiskCheckArgs

This interface, `IRiskCheckArgs`, holds all the essential details needed to determine if a new trade should be allowed. Think of it as a safety check run *before* a trading signal is even created. It’s passed to a risk check function and provides information like the symbol being traded (e.g., BTCUSDT), the name of the strategy making the request, the exchange being used, the current price, and the current timestamp. Essentially, it’s a collection of data pulled directly from the client strategy's context, giving you the necessary information to validate the conditions for opening a position.

## Interface IRiskCallbacks

This interface, `IRiskCallbacks`, lets you hook into the risk management process within the backtest kit. Think of it as a way to be notified when trades are either approved or denied based on your defined risk rules.

Specifically, you can provide functions to be called in two situations: `onRejected` gets triggered when a trading signal fails a risk check, meaning it won’t be executed, and `onAllowed` gets called when a signal passes all the checks and is safe to proceed with. The `onRejected` and `onAllowed` functions both receive the symbol being checked and a set of parameters related to the risk assessment.

## Interface IRiskActivePosition

This interface, `IRiskActivePosition`, helps keep track of positions across different trading strategies, allowing you to analyze risk comprehensively. It essentially holds key information about a position that's currently open. 

You’ll find details like the originating signal (`signal`), the name of the strategy that created the position (`strategyName`), and the exchange where it’s being held (`exchangeName`). It also records the exact time the position was initially opened (`openTimestamp`). Think of it as a record of what’s actively trading and where it came from.

## Interface IRisk

The `IRisk` interface is all about keeping your trading strategies safe and within defined limits. It acts as a gatekeeper, ensuring your signals don't violate any pre-set risk parameters.

You're able to check if a potential trading signal is acceptable using the `checkSignal` method, providing it with the relevant details to assess its risk profile. 

When a signal is executed and a position is opened, you're able to register it using `addSignal`, keeping track of what's currently active. Conversely, when a position is closed, `removeSignal` lets you notify the system so it can update its calculations and records. These methods help maintain a clear picture of your risk exposure at all times.

## Interface IPositionSizeKellyParams

The `IPositionSizeKellyParams` interface helps you calculate position sizes using the Kelly Criterion, a popular method for determining how much to bet or trade based on expected returns. It defines the key inputs needed for this calculation.

You’re essentially telling the system how often you expect to win (`winRate`, a value between 0 and 1) and the average ratio of your wins compared to your losses (`winLossRatio`). These two values together will help determine an appropriate position size to manage risk and maximize long-term growth.

## Interface IPositionSizeFixedPercentageParams

This interface defines the parameters needed when you want to consistently size your trades using a fixed percentage of your account balance. It's all about ensuring that each trade represents the same proportion of your total capital.

The `priceStopLoss` property tells the system the price at which you want to set your stop-loss order – a crucial element in managing risk when using fixed percentage sizing.

## Interface IPositionSizeATRParams

This interface defines the settings needed when calculating position size using the Average True Range (ATR). Specifically, it includes the current ATR value, which is a key input for determining how much capital to allocate to a trade. You’re essentially telling the framework what the ATR currently is so it can use that information to figure out the appropriate position size.

## Interface IPersistBase

This interface defines the core functions needed to store and retrieve data within the backtest-kit framework. Think of it as the foundation for how your trading strategies save their state and load it later. 

It provides methods to ensure your storage area is properly set up initially, check if a specific piece of data already exists, read data back from storage, and write new data safely. The `waitForInit` method helps guarantee everything is ready before you start, while `readValue` and `hasValue` let you quickly access existing data. Finally, `writeValue` ensures your data is stored reliably.


## Interface IPartialData

This interface, `IPartialData`, represents a small piece of trading signal information that can be easily saved and loaded. Think of it as a snapshot of important data points like profit and loss levels.  It’s designed to be stored persistently, meaning it can be saved and retrieved later, even if your program closes. To make saving straightforward, sets of data are converted into arrays for JSON serialization, a common method for saving data. When you load this data back in, it's transformed into a complete trading state. The `profitLevels` property holds the profit levels achieved, while `lossLevels` stores the loss levels reached.

## Interface IPartial

This interface, `IPartial`, helps track how much profit or loss a trading signal is generating. It's used internally by the framework to keep tabs on milestones like reaching 10%, 20%, or 30% profit or loss. 

The `profit` method handles positive gains, while the `loss` method manages losses. Both methods ensure events are only triggered for new levels reached, avoiding redundant notifications.  

When a trading signal closes – whether it hits a take profit or stop loss, or simply expires – the `clear` method is used. This removes the signal's profit/loss information from the system's memory and saves the changes.

## Interface IOptimizerTemplate

The `IOptimizerTemplate` interface provides a way to create the building blocks of your backtesting code, particularly for systems using Large Language Models (LLMs).  It’s essentially a toolkit for generating the various code snippets needed to set up and run a trading simulation.

You can use it to create a "top banner" that includes necessary imports and initial setups. It also helps with crafting the content of messages sent to and received from an LLM – specifically, the default messages for both the user and the assistant.  

For configuring the core components of your backtest, it provides methods to generate code for the "Walker" (the main orchestrator), the "Exchange" (connecting to a data source and executing trades), the "Frame" (defining the timeframe), and the "Strategy" (the trading logic itself).  You can also use it to generate the code that launches your simulation and listens for events.

Finally, it has helpers to format text or structured JSON output from your LLM interactions, making it easier to interpret and work with the results.

## Interface IOptimizerStrategy

This interface, `IOptimizerStrategy`, holds all the information used to create a trading strategy, particularly when using a large language model. Think of it as a container for the strategy’s background story. 

It includes the `symbol` – the trading pair the strategy is designed for – and a `name` to easily identify it. Crucially, it stores the `messages`, which represent the full conversation with the LLM, including your prompts and the model’s responses. This history is valuable for understanding how the strategy was formed and for debugging. Finally, it contains the `strategy` itself, the actual code or description generated by the LLM that dictates the trading actions.

## Interface IOptimizerSourceFn

The `IOptimizerSourceFn` defines how backtest-kit gets the data it needs to test different trading strategies. Think of it as a way to feed the system with historical data for optimization. This function needs to be able to handle large datasets by fetching data in smaller chunks – that’s the pagination part. Critically, each piece of data it provides must have a unique identifier, so the system can keep track of everything.

## Interface IOptimizerSource

This interface describes where your backtesting data comes from and how it’s prepared for use in simulations or with large language models. 

Think of it as a blueprint for connecting to your data. It requires you to define a unique name for your data source and a function, `fetch`, that retrieves the data, handling pagination to grab data in chunks.

You can also add optional descriptions to your data source with the `note` property.

To really customize things, you can provide custom formatting functions, `user` and `assistant`, to shape the messages sent and received during the backtesting process. If you don't specify these, the framework will use default formatting.

## Interface IOptimizerSchema

This interface describes how an optimizer is configured within the backtest-kit framework. Think of it as a blueprint for creating and testing trading strategies.

You define training periods using `rangeTrain`, which allows for creating multiple strategy variations based on different timeframes for comparison. `rangeTest` specifies the timeframe used to evaluate how well those strategies perform.

`source` is an array of data sources – essentially, the information the system will use to create strategies. `getPrompt` is a function that assembles the prompt sent to the LLM, incorporating information from these data sources and conversation history to guide strategy creation.

`template` allows you to customize the structure of the generated strategies, and `callbacks` enable you to monitor the optimizer's progress and track key events. Finally, `optimizerName` provides a unique identifier for this specific optimizer setup. `note` allows you to add descriptive notes about the optimizer's purpose.

## Interface IOptimizerRange

This interface, `IOptimizerRange`, helps you specify the time periods your trading strategies will be tested or trained on. Think of it as defining the "window" of historical data used for backtesting. You'll use `startDate` to mark the beginning of that window and `endDate` to mark the end, both dates being included in the analysis.  There’s also a helpful `note` property where you can add a description of the range, like “2023 Bear Market” to easily remember what period it represents.

## Interface IOptimizerParams

This interface defines the essential settings needed when creating a ClientOptimizer. Think of it as the blueprint for configuring how the optimization process will run. It includes a `logger` which is used to record important events and debugging information during the optimization, allowing you to track what’s happening. The `template` property holds all the methods and logic necessary for the optimization to function, combining your specific configurations with default settings.

## Interface IOptimizerFilterArgs

This interface defines the information needed to request specific historical data for backtesting. It lets you specify exactly which trading pair, like "BTCUSDT," and the timeframe, using a start and end date, you’re interested in. Think of it as a way to say, "I need data for this specific cryptocurrency during this particular period." It's used behind the scenes to efficiently fetch the data your backtesting strategies need.

## Interface IOptimizerFetchArgs

This interface defines the information needed when fetching data for optimization, especially when dealing with large datasets that need to be retrieved in smaller chunks. Think of it as a way to request only a portion of your data at a time. 

It lets you specify the `limit`, which is the maximum number of records you want back in a single request, and the `offset`, which dictates how many records to skip before starting to fetch. This `offset` is often calculated based on the page number you want to see and the `limit` per page.

## Interface IOptimizerData

This interface, `IOptimizerData`, acts as the foundation for how data is provided to your backtesting optimization process. Every data source you use needs to conform to this structure. It ensures that each piece of data has a unique identifier, called `id`, which is essential for preventing duplicate data entries when you're working with large datasets or data that's fetched in chunks. This `id` property is a `RowId` type, helping to guarantee data integrity and efficient processing.

## Interface IOptimizerCallbacks

These callbacks let you keep an eye on what's happening during the optimization process. 

The `onData` callback gets triggered when the framework finishes creating strategy data for all the training periods – it’s a great place to check the data or record it somewhere. 

`onCode` lets you monitor and verify the generated strategy code after it’s created. 

If you need to do something after the code is saved to a file, like archiving or notifying someone, use the `onDump` callback. 

Finally, `onSourceData` is called whenever data is fetched from a source – this is ideal for logging the fetched data and making sure it looks right.

## Interface IOptimizer

The Optimizer interface lets you work with backtest-kit to automatically create and export trading strategies. You can use it to retrieve strategy data – essentially, information about potential strategies – for a specific trading symbol. It also allows you to generate the complete code for a trading strategy, ready to be executed. Finally, you can dump that generated code into a file, creating the necessary directory structure if it doesn’s already exist and saving the strategy as a .mjs file.


## Interface IMethodContext

The `IMethodContext` interface provides essential information for your backtesting operations. Think of it as a little package of details that helps the backtest-kit framework know exactly which strategy, exchange, and data frame to use for a specific calculation. It contains the names of these components – `exchangeName`, `strategyName`, and `frameName` – allowing the system to automatically fetch and apply the correct configurations. This context is passed around within the backtest-kit, making it easy to work with the right components without constantly needing to specify them manually.  The `frameName` is particularly useful during backtesting, but is empty when running in live mode.


## Interface ILogger

The `ILogger` interface provides a standardized way for different parts of the backtest-kit framework to record information about what’s happening. Think of it as a central place to keep track of events.

You can use it to record general messages about important events, detailed debug information for troubleshooting, informative updates on successful operations, and warnings for potential issues that need attention. It's used everywhere, from how agents work to how data is stored and processed, making it a key tool for understanding and debugging your trading strategies.

## Interface IHeatmapStatistics

This interface describes the data you get when analyzing your portfolio's performance using a heatmap. It bundles together key metrics calculated across all the assets you're tracking.

You'll find an array called `symbols` that holds individual statistics for each asset in your portfolio, allowing you to drill down into specifics. Alongside this, the interface provides aggregate numbers: the total number of symbols, your overall portfolio profit and loss (PNL), the portfolio's Sharpe Ratio (a measure of risk-adjusted return), and the total number of trades executed. This provides a quick, high-level view of your portfolio's overall health and trading activity.


## Interface IHeatmapRow

This interface describes a single row of data presented in a portfolio heatmap, focusing on the performance of a specific trading pair like BTCUSDT. It bundles key statistics to quickly assess how a symbol has performed across all strategies used.

You'll find metrics like total profit or loss as a percentage, the Sharpe Ratio which helps understand risk-adjusted returns, and the maximum drawdown indicating the largest potential loss. It also includes details on the number of trades executed, broken down into wins and losses to calculate the win rate and average profit/loss per trade.

Other important figures like standard deviation, profit factor, and streaks of wins or losses paint a more complete picture of trading performance. Finally, expectancy is provided which combines win rate and average win/loss values to provide an overall expectation of performance.

## Interface IFrameSchema

The `IFrameSchema` lets you define the structure of a backtest period, essentially telling the backtest-kit how to generate the timestamps it uses. Think of it as setting the boundaries and rhythm of your historical data. 

You’re required to give each frame a unique `frameName` so the system can identify it.  A `note` is optional, a helpful place to add comments for yourself or others to understand the frame's purpose.

The `interval` property dictates how frequently timestamps are created (e.g., every minute, every hour, daily).  `startDate` and `endDate` specify the beginning and end dates for your backtest period, including these dates.

Finally, `callbacks` offer a way to hook into different stages of the frame's lifecycle, if you need custom actions to happen at specific points.

## Interface IFrameParams

The `IFrameParams` interface defines the information needed to set up a ClientFrame, which is a core component of the backtest-kit trading framework. Think of it as a configuration object. 

It builds upon the `IFrameSchema` interface, adding a crucial element: a logger. This logger allows you to track what's happening internally within the frame, making debugging and understanding the backtesting process much easier. You’ll provide an instance of an `ILogger` when creating a ClientFrame, which will help you diagnose any unexpected behavior.

## Interface IFrameCallbacks

This section describes the `IFrameCallbacks` interface, which helps you react to changes in how your backtest framework handles time periods. Think of it as a way to be notified when your backtest is preparing to work with a set of dates. 

Specifically, the `onTimeframe` property lets you define a function that gets triggered once a set of timeframes is created. This is useful if you want to check that the timeframes look right, or simply to keep a record of when they were generated. You're given the dates, the start and end dates of the timeframe, and the interval used to create them.

## Interface IFrame

The `IFrames` interface is a core component for managing time-based data in backtest-kit. Think of it as the engine that creates the sequence of moments in time your trading strategy will be tested against. 

The `getTimeframe` function is the main tool provided by this interface. It’s how you get the specific dates and times for a particular trading symbol and timeframe. It takes a symbol (like "BTCUSDT") and a frame name (like "1h" for hourly data) and returns a promise that resolves to an array of dates. These dates represent the points in time your backtest will evaluate.

## Interface IExecutionContext

The `IExecutionContext` interface holds important information about the current trading environment. Think of it as a package of details that gets passed around to various parts of your trading strategy, like when a candle is fetched or a trade is executed. It tells your code which trading pair you're dealing with (like "BTCUSDT"), the current date and time, and crucially, whether the code is running in a backtesting simulation or live trading. This context is automatically managed and provided by the `ExecutionContextService`, so you don't need to worry about creating it yourself. 


## Interface IExchangeSchema

The `IExchangeSchema` lets you define how backtest-kit interacts with a specific cryptocurrency exchange. Think of it as a blueprint for connecting to a data source and understanding its quirks.

You provide a unique name for the exchange so backtest-kit knows which one it is, and can add a note for your own records. 

The core of the schema is the `getCandles` function, which tells backtest-kit exactly how to fetch historical price data (candles) from the exchange’s API or database, specifying the symbol, timeframe, starting date, and how many candles to retrieve.

Additionally, you’ll define how to properly format order quantities and prices to adhere to the exchange’s precision rules, ensuring your simulated trades are realistic. 

Finally, you can optionally provide callback functions to be notified of events as data is processed.

## Interface IExchangeParams

The `IExchangeParams` interface defines the information needed when setting up an exchange within the backtest-kit framework. Think of it as the configuration details you provide to tell the exchange *how* to operate during a backtest.

It includes a `logger` to help you track what's happening and debug any issues you encounter.  Also, you'll specify the `execution` context, which provides details about the backtest environment like the symbol being traded and the specific time period. This context helps the exchange correctly simulate trading conditions.

## Interface IExchangeCallbacks

The `IExchangeCallbacks` interface lets you plug in functions to be notified about specific events happening within the trading framework's exchange connection. Think of it as a way to listen in on what the exchange is telling us. 

Specifically, the `onCandleData` property lets you define a function that will be called whenever new candlestick data becomes available. This data includes details like the symbol being traded, the time interval of the candles, a timestamp indicating when the data starts, the number of candles received, and the actual candle data itself. You can use this to react to new price information as it arrives.

## Interface IExchange

The `IExchange` interface defines how backtest-kit interacts with a trading exchange. It lets you retrieve historical and future candle data, which is essential for simulating trading strategies.

You can use `getCandles` to pull past price data and `getNextCandles` to peek into the future (within the backtest environment).

Before placing orders, `formatQuantity` and `formatPrice` ensure your trade sizes and prices adhere to the exchange’s specific rules and precision.

Finally, `getAveragePrice` provides a quick way to calculate the Volume Weighted Average Price (VWAP) based on recent trading activity, a useful indicator for traders.

## Interface IEntity

This interface, `IEntity`, serves as the foundation for any data that gets saved and retrieved within the backtest-kit framework. Think of it as a common starting point, ensuring that all persistent objects share a basic structure. It's designed to simplify how you work with data that needs to be stored and managed during your backtesting simulations. If you're creating a custom data object for your backtest, it likely needs to implement this interface.

## Interface ICandleData

This interface represents a single candlestick, the basic building block for analyzing price movements and performing backtests. Each candlestick contains information about the opening price, the highest price reached, the lowest price reached, the closing price, and the volume traded during that specific time interval. The `timestamp` tells you exactly when that candle's interval began, measured in milliseconds since the Unix epoch. This structure is fundamental for calculations like VWAP and for creating realistic simulations of trading strategies.

## Interface DoneContract

This interface lets you know when a background task, whether it's a backtest or a live trading session, has finished running. It provides essential information about the completed execution, such as the name of the exchange used, the strategy that ran, whether it was a backtest or a live trade, and the trading symbol involved. Think of it as a notification confirming a process has wrapped up and giving you details about what just happened. You can use this to track the progress of longer-running tasks and get key information about their outcome.

## Interface BacktestStatistics

This interface holds all the key statistical information generated during a backtest. You'll find a detailed list of every closed trade, including its price, profit and loss, and timestamps, allowing for in-depth analysis of your strategy's performance. The data includes the total number of trades executed, the number of winning and losing trades, and crucial performance metrics.

You can assess your strategy's effectiveness using the win rate, which indicates the percentage of profitable trades, and the average profit per trade. Overall profitability is summarized in the total profit number. The standard deviation provides insight into the volatility of your returns, and the Sharpe Ratio helps you understand the risk-adjusted return of your strategy – a higher Sharpe Ratio suggests better performance relative to the risk taken. The certainty ratio helps to assess the ratio of average winning to average losing, helping you understand your strategy. Finally, an expected yearly return figure estimates potential returns over a year, assuming the backtest conditions persist. All numerical values are carefully handled, appearing as null when the calculation isn’t reliable.
