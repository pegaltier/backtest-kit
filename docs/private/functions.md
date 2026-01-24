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

This function helps you make sure everything is set up correctly before you start running tests. It checks if all the entities you're using – things like exchanges, trading strategies, and risk parameters – actually exist in the system.

You can tell it to check specific parts, or if you leave it blank, it’ll check everything for you. This is a good way to catch any registration problems early on, preventing errors during backtesting or optimization. Think of it as a quick health check for your trading framework.

## Function stopStrategy

This function lets you pause a trading strategy without disrupting existing trades. It essentially tells the strategy to stop creating new signals. Any currently active signal will finish its process naturally, and the system will gracefully halt at a safe point – either when it's idle or after the current signal has closed. It works whether you're running a backtest or a live trading scenario, automatically adjusting to the environment. You just need to provide the symbol of the trading pair for which you want to stop the strategy.

## Function setLogger

You can now customize how backtest-kit reports its activities. The `setLogger` function lets you provide your own logging mechanism, like writing logs to a file or sending them to a central server. This is really useful if you want more control over where and how the framework's messages appear. Whenever something happens within backtest-kit, the details—like which trading strategy, exchange, or symbol is involved—will automatically be included in your log messages. Just make sure your logger conforms to the `ILogger` interface.

## Function setConfig

This function lets you adjust how the backtest-kit framework operates. Think of it as tweaking the settings behind the scenes. You can change specific parts of the default configuration by providing a `config` object with the values you want to update.  There’s also a special `_unsafe` flag you might need when running tests; it bypasses some safety checks, but use it with caution. This is how you can tailor the environment to your specific testing needs.

## Function setColumns

This function lets you customize the columns displayed in your backtest reports, giving you more control over what information is shown. You can adjust the configuration of existing columns or add entirely new ones to tailor the reports to your specific needs. The system verifies your column definitions to ensure they're valid, but there's a special option to bypass this validation if you're working in a testing environment. Essentially, it's your tool for making backtest reports more informative and relevant.

## Function overrideWalkerSchema

This function lets you tweak the way your trading strategy's performance is analyzed, specifically when you’re comparing different strategies. Think of it as modifying an existing blueprint for how the analysis is done. You can selectively change parts of that blueprint – things like how data is processed – without rewriting the whole thing. Only the settings you provide will be altered; everything else remains as it was originally configured. It’s useful for fine-tuning the comparison process to focus on specific aspects of strategy behavior.

## Function overrideStrategySchema

This function lets you modify an existing trading strategy’s configuration within the backtest-kit framework. It's useful when you need to adjust a strategy's settings without completely redefining it. Think of it as a targeted update – you provide only the parts of the strategy's schema you want to change, and everything else stays the same. This makes it easy to tweak parameters or add new configuration options to strategies already registered in your system. The function returns a promise that resolves to the updated strategy schema.

## Function overrideSizingSchema

This function lets you adjust a sizing schema that’s already been set up within the backtest-kit system. Think of it as fine-tuning an existing plan for how much capital you allocate to each trade. It doesn't replace the original schema entirely; instead, it lets you modify just the parts you want to change, leaving everything else untouched. You provide a partial configuration object with the updates, and the function returns a new, modified sizing schema.

## Function overrideRiskSchema

This function lets you tweak an existing risk management setup within the backtest-kit. Think of it as making small adjustments – you provide only the parts you want to change, and the rest of the original configuration stays the same. It's useful when you need to modify specific parameters without rebuilding the entire risk schema from scratch. You’ll be updating a risk configuration that’s already registered in the system.

## Function overrideFrameSchema

This function lets you tweak existing timeframe configurations used during backtesting. Think of it as a way to make small adjustments to how data is organized for a specific timeframe, like changing the frequency of data points.  It doesn't replace the original timeframe setup entirely; instead, it only updates the parts you specify.  This allows for targeted modifications without having to redefine the entire timeframe structure. You provide a partial configuration object, and the function merges it with the existing timeframe definition, keeping the rest of the original settings intact.

## Function overrideExchangeSchema

This function lets you modify an already set-up data source for an exchange within the backtest-kit framework. Think of it as a way to tweak an existing exchange's configuration without having to recreate it entirely.  You provide a partial update – only the settings you want to change are sent to the function, while the rest of the exchange’s settings stay as they were. This is helpful when you need to adjust things like data frequency or other exchange-specific details. The function returns a promise that resolves with the modified exchange schema.

## Function overrideActionSchema

This function lets you tweak an action handler that's already set up within the backtest-kit framework. Think of it as a way to make small adjustments to how an action is handled without having to completely replace the original setup. You can update specific parts of the action's configuration, like its callbacks or logic, leaving the rest of the handler untouched. This is handy for things like adapting event handling for different environments or swapping out handler implementations on the fly—it offers a flexible way to modify behavior without altering the core strategy. You simply provide a partial configuration object, and the existing action handler gets updated accordingly.

## Function listWalkerSchema

This function gives you a list of all the different trading strategies (walkers) that have been set up within the backtest-kit framework. Think of it as a way to see what's available for use. It's handy for things like checking that your strategies are properly registered, creating documentation, or building user interfaces that can show users what strategies they can choose. Essentially, it’s a look under the hood to understand the available trading methods.


## Function listStrategySchema

This function provides a way to see all the trading strategies that have been set up within the backtest-kit framework. Think of it as a directory listing – it gathers information about each strategy, including its structure and configuration. You can use this to check what strategies are available, generate documentation, or even build tools that automatically adapt to different strategy types. It returns a list of strategy schemas, allowing you to inspect and work with them programmatically.


## Function listSizingSchema

This function lets you see all the sizing strategies currently set up within the backtest-kit framework. It's a handy way to check what sizing methods are in use – perhaps you're verifying configurations or creating a tool to display these settings. Essentially, it provides a list of all the sizing schemas that have been added, allowing you to inspect them directly. This can be useful for troubleshooting or understanding how position sizes are being calculated.


## Function listRiskSchema

This function lets you see all the risk configurations currently set up in your backtest. It returns a list of these configurations, giving you a way to inspect them, generate documentation, or build interfaces that adapt to the different risk profiles you’re using. Think of it as a way to peek under the hood and understand how your risk management is structured. You can use this to double-check your setup or build tools that work with your risk settings.


## Function listFrameSchema

This function lets you see a complete list of all the different trading "frames" your backtest kit is using. Think of frames as building blocks for your trading strategies – they define data structures and how information flows. By calling this function, you get a snapshot of all those building blocks, which is incredibly helpful for understanding your setup, creating tools to visualize your strategy, or finding any potential registration issues. It essentially provides a directory of all the frames you've defined and made available within your backtest kit.


## Function listExchangeSchema

This function gives you a way to see all the exchanges that backtest-kit knows about. It fetches a list of their configurations, which is helpful when you're trying to understand how your system is set up or building tools that need to work with different exchanges. Think of it as a quick look under the hood to see what exchanges are available for testing. The result is a list of exchange schema objects.


## Function listenWalkerProgress

This function lets you track the progress of backtest simulations as they run. It's particularly useful when you want to monitor how each strategy performs within a larger backtesting process. You provide a function that will be called after each strategy finishes, and this function receives information about the completed strategy. To ensure things don't get chaotic, this function handles events one at a time, even if the callback you provide takes some time to execute. Think of it as a way to get updates as your backtests complete, guaranteeing a smooth and orderly flow of information. When you’re done listening for these updates, the function returns another function you can call to unsubscribe.

## Function listenWalkerOnce

This function lets you temporarily listen for changes happening within a trading system, but only once a specific condition is met. You provide a rule – a filter – that defines what kind of change you’re interested in. When that change occurs, a function you specify will run, and then the listening automatically stops. It’s perfect for situations where you need to react to something happening just one time, like waiting for a particular order to fill. The filter determines which changes trigger your function, and your function handles the event when it’s detected.

## Function listenWalkerComplete

This function lets you be notified when a backtest run finishes. It's designed for situations where you need to react to the completion of a testing process, ensuring that your reaction happens in a controlled, sequential manner even if your reaction involves asynchronous operations.  Essentially, it sets up a listener that gets triggered when all strategies have been tested, and guarantees the callback function you provide will execute one at a time. You give it a function to call when the testing is done, and it returns a function that you can use to unsubscribe from the notification later.


## Function listenWalker

The `listenWalker` function lets you keep track of how a backtest is progressing. It's like setting up a notification system that tells you when each strategy within the backtest has finished running. 

The function gives you a callback function (`fn`) that gets called after each strategy completes. Importantly, these notifications are handled one at a time, even if your callback function takes some time to process, ensuring things don't get out of order or overwhelmed. Think of it as a safe and sequential way to monitor your backtest’s steps. You'll receive a `WalkerContract` object in the callback, containing information about the completed strategy.  When you’re done listening, the function returns another function that you can use to unsubscribe.

## Function listenValidation

This function lets you keep an eye on potential problems during your risk validation checks. Whenever a validation process encounters an error, this function will notify you. Think of it as setting up an alert system for any issues popping up during those checks. The alerts are handled in the order they appear, ensuring things are processed systematically, even if your response involves some asynchronous work. It helps you catch and address validation failures quickly and reliably. You provide a function that will be executed whenever an error is detected, and this function returns another function that you can call to unsubscribe from these notifications.

## Function listenStrategyCommitOnce

This function lets you react to specific changes happening in your trading strategy, but only once. Think of it as setting up a temporary listener that waits for something particular to occur, then performs an action and disappears. You tell it what to look for using a filter—a condition that must be met—and what action to take when that condition is met. Once that event happens, the listener automatically stops, ensuring you only react to it once.

## Function listenStrategyCommit

This function lets you keep an eye on what’s happening with your trading strategies. It's like setting up a notification system that tells you when things change, such as when a signal is cancelled, a trade is partially closed for profit or loss, or stop-loss and take-profit orders are adjusted. The important thing is that these notifications are handled one at a time, in the order they occur, even if your notification handler needs to do some processing that takes a bit of time. You provide a function that will be called whenever one of these strategy events happens, giving you a chance to react to those changes. To stop listening, the function returns another function that you can call to unsubscribe.

## Function listenSignalOnce

This function lets you react to specific trading signals just once and then automatically stop listening. Think of it as setting up a temporary listener that only fires when a particular condition is met. You provide a filter to define what kind of signal you're interested in, and a function to run when that signal arrives. After the function runs once, the listener is automatically removed, so you don’t have to worry about cleaning up. It's handy when you need to wait for a specific signal to happen and then take action.


## Function listenSignalLiveOnce

This function lets you temporarily listen for specific trading signals coming directly from a live trading execution. Think of it as setting up a quick, one-time alert for a particular type of market event. You tell it what kind of signal you're interested in (using a filter) and what you want to do when you receive it. Once that signal arrives, the function automatically stops listening and unsubscribes, so you don't need to worry about managing subscriptions. This is great for testing or getting a single notification without ongoing involvement.


## Function listenSignalLive

This function lets you tap into the real-time trading signals generated by backtest-kit when you're running a live simulation. It's like setting up a listener that gets notified whenever a trading signal happens. The signals are delivered one after another, ensuring they're processed in the exact order they arrive. You provide a function that will be called with each signal event, allowing you to react to those signals as they happen during the live run. Remember, you’ll only receive signals from executions started with `Live.run()`.

## Function listenSignalBacktestOnce

This function lets you temporarily listen for specific signals generated during a backtest. You provide a filter that determines which signals you’re interested in, and a function to execute when a matching signal arrives. The function automatically handles the subscription and unsubscription, ensuring your callback runs only once and then stops listening. It's useful for quickly reacting to a particular event during a backtest without needing to manage ongoing subscriptions.


## Function listenSignalBacktest

This function lets you tap into the backtest process and get notified whenever a signal is generated. It's designed to handle these signals one at a time, ensuring things happen in the order they were created. You provide a function that will be called with details about each signal, which is especially useful if you need to react to these signals during your backtest. Remember, you'll only receive signals from backtests initiated with `Backtest.run()`.

## Function listenSignal

This function lets you easily monitor what’s happening with your trading strategies. It provides a way to receive updates whenever a strategy changes state – whether it's going idle, opening a position, actively trading, or closing a trade. Importantly, the updates are handled one at a time, even if the code you provide to process them takes some time to run, ensuring things don't get out of order or overwhelmed. You give it a function that will be called with each of these state changes. When you’re done listening, the function returns another function that you can call to unsubscribe.

## Function listenSchedulePingOnce

This function lets you react to specific ping events, but only once. Think of it as setting up a temporary listener – it will trigger your callback function when a matching event occurs and then automatically stop listening. You provide a filter to define which events you’re interested in, and a function to execute when the right event happens. This is handy when you need to respond to a particular condition and then don’t need to listen anymore. 


## Function listenSchedulePing

This function lets you keep an eye on scheduled signals as they wait to become active. It sends out a little "ping" every minute while a signal is being monitored, allowing you to track its progress and build custom checks. You provide a function that will be called each time a ping is received, giving you access to details about the signal. Essentially, it's a way to be notified and react to events during the waiting period for a scheduled trade.


## Function listenRiskOnce

This function lets you set up a one-time listener for risk rejection events within your backtest. You provide a filter – a way to identify the specific risk rejection events you're interested in – and a callback function that will be executed just once when a matching event occurs. After the callback runs, the listener automatically stops, which is perfect for situations where you need to react to a particular risk rejection and then move on. Think of it as a short-lived alert for a specific condition.


## Function listenRisk

This function lets you monitor for situations where your trading signals are being blocked because they violate risk rules. It’s like setting up an alert system specifically for when something goes wrong with your risk management.

You provide a function that will be called whenever a signal is rejected due to a risk check failure.  Importantly, you *won’t* receive notifications for signals that pass the risk checks, which helps keep things clean and avoids unnecessary alerts.

The system handles these rejections in a specific order, even if your callback function takes some time to execute, ensuring things happen reliably. It also makes sure your callback runs one at a time to prevent issues that could arise from multiple simultaneous executions.


## Function listenPerformance

This function lets you monitor how quickly your trading strategies are running. It essentially sets up a listener that will notify you whenever a performance metric is recorded during the strategy's execution. 

Think of it as a way to profile your code and pinpoint any slow areas. The listener function you provide will be called whenever a metric is available, and these calls happen one after another to keep things organized, even if your listener function itself takes some time to process. This helps ensure reliable tracking of performance over time. When you're done monitoring, you can unsubscribe using the value returned by this function.

## Function listenPartialProfitAvailableOnce

This function allows you to set up a listener that reacts to specific partial profit levels being reached in your trading strategy. Think of it as a temporary alert – you define what conditions you're looking for, and when those conditions are met, a function you provide gets executed just once. After that execution, the listener automatically stops, so you don't have to worry about managing subscriptions manually. It's great for things like triggering a one-time action when a certain profit milestone is hit.

You provide a filter to specify which profit events you're interested in, and then you define the action that should happen when a matching event occurs. The listener then takes care of the rest, ensuring it only runs once and then quietly unsubscribes.


## Function listenPartialProfitAvailable

This function lets you keep track of how your trades are performing by notifying you when they reach certain profit milestones, like 10%, 20%, or 30% gain. It ensures these notifications happen one at a time, even if your handling of the notification takes some time to complete. You provide a function that will be called with details about the trade whenever a profit level is hit, and this function will return another function to unsubscribe from these notifications when you no longer need them.

## Function listenPartialLossAvailableOnce

This function lets you set up a listener that will react to specific changes in partial loss levels within your trading system. You provide a filter to define exactly what kind of loss events you're interested in – essentially, you tell it which events should trigger a response. Once an event matching your filter appears, the provided callback function will be executed just once, and the listener automatically stops listening. This is a handy tool when you need to react to a particular loss scenario and then be done with it.


## Function listenPartialLossAvailable

This function lets you keep track of how much a contract has lost in value, but in manageable chunks. It will notify you when the loss reaches certain milestones, like 10%, 20%, or 30% of the original value. 

The important thing to know is that the notifications are handled in order and processed one at a time, even if your notification handling takes some time – this ensures things don't get out of sync. To stop listening for these loss level updates, the function returns another function that you can call to unsubscribe. You provide a function to be called when a partial loss event occurs, and that's how you'll be informed of the losses.

## Function listenExit

The `listenExit` function lets you be notified when something goes critically wrong and stops the backtest-kit processes like background tasks. Think of it as a way to catch the "oh no, everything stopped" kind of errors. 

Unlike the `listenError` function which handles problems you can recover from, `listenExit` deals with problems so severe they halt execution completely.  

These errors are handled one at a time, ensuring that your error handling logic runs cleanly even if it involves asynchronous operations. It makes sure things don’t get tangled up by preventing multiple callbacks from running at the same time. You provide a function that will be called with information about the error.

## Function listenError

This function helps you catch and deal with errors that might happen while your trading strategy is running, without stopping the entire process. It’s designed for "recoverable" errors – things like a failed API request that you can try again.

Think of it as setting up an alert system for these errors; when one occurs, the provided function will be called to handle it. 

Importantly, these alerts are processed one at a time, and in the order they happen, even if your error-handling function takes some time to complete. This ensures that errors are handled in a controlled and predictable manner. It's a good way to keep your strategy running smoothly even when things go wrong.

## Function listenDoneWalkerOnce

This function lets you react to when a background task within your trading system finishes, but only once. You provide a filter to specify which completed tasks you're interested in, and then a function to run when a matching task is done. Once that function executes, the listener automatically stops listening, preventing it from firing again. Think of it as a one-time notification for specific background processes.

## Function listenDoneWalker

This function lets you keep track of when background tasks within your backtest are finished. It’s designed to handle those finishing events, even if they happen asynchronously. Think of it as a way to be notified when a process running in the background of your backtest has completed, ensuring that the notification happens in the order events occurred and that your code handles them safely without running into conflicts. You provide a function that will be called when a background task is done, and it returns another function you can use to unsubscribe from these notifications later.

## Function listenDoneLiveOnce

This function lets you monitor when background tasks within your trading strategy finish, but in a streamlined way. You provide a filter to specify which completion events you're interested in, and then a function to execute when a matching event occurs. Once that function runs, the listener automatically stops listening, ensuring you don't get repeated notifications. It’s useful for tasks like cleanup or post-processing actions after a background operation completes.


## Function listenDoneLive

This function lets you keep an eye on when background tasks initiated by Live.background() finish running. It’s like setting up a notification system for those tasks. When a background task completes, it will call the function you provide, ensuring events are handled one after another, even if your callback function takes time to execute. This helps to avoid problems that can happen when things run at the same time. You’ll get a `DoneContract` object with information about the finished task. When you're done listening, you can unsubscribe by calling the function that `listenDoneLive` returns.

## Function listenDoneBacktestOnce

This function lets you react to when a background backtest finishes, but only once. You provide a filter to specify which backtest completions you're interested in, and a function to run when a matching backtest is done. Once the function runs, it automatically stops listening for further events, making it ideal for actions you only want to perform a single time after a backtest concludes. Think of it as setting up a temporary alert that goes off just once for a specific type of backtest completion.


## Function listenDoneBacktest

This function lets you be notified when a background backtest finishes running. It’s really useful for automating tasks that need to happen *after* a backtest is complete, like saving results or triggering another process.  The function registers a listener that will be called once the backtest is done. Importantly, any code you put in your callback function will run one at a time, ensuring things don't get messed up by running in parallel.  You provide a function (`fn`) that will receive information about the completed backtest when it's finished, and the function returns another function that you can call later to unsubscribe from these notifications.

## Function listenBreakevenAvailableOnce

This function lets you set up a listener that waits for a specific breakeven protection event to happen, but only reacts once. You provide a filter that defines what kind of event you're interested in, and a function that will be executed when that event occurs.  Once the event is detected and your function runs, the listener automatically stops listening, preventing it from triggering again. Think of it as a one-shot alert for a particular breakeven situation. It's handy when you need to react to something just once and then move on.

## Function listenBreakevenAvailable

This function lets you be notified whenever a trade's stop-loss automatically adjusts to breakeven – meaning the profit covers the transaction costs.  It’s like setting up a silent alert for when your trade hits a specific profitability milestone. The notifications happen one at a time, ensuring things are handled in order, even if your response to the notification takes some time to process. You simply provide a function that will be called whenever this breakeven event occurs.

## Function listenBacktestProgress

This function lets you keep an eye on how a backtest is running. It's like setting up a notification system that tells you about the progress as the backtest is performing its calculations. The information comes in the form of events, and they are delivered one after another, even if the code you provide to handle these events takes some time to complete. It ensures that these updates are processed in a controlled and orderly way, preventing any unexpected issues. You give it a function that will receive these progress updates, and it returns another function you can call later to stop listening.


## Function listenActivePingOnce

This function lets you set up a listener that reacts to specific "active ping" events, but only once. You provide a filter to define which events you're interested in, and a function to run when a matching event arrives. Once that single event triggers your function, the listener automatically stops itself, so you don't have to worry about managing subscriptions. It’s perfect for situations where you need to react to a certain condition happening just one time.

You tell it what kind of event you’re looking for with `filterFn`, and what you want to do when you find it with `fn`. The function returns a way to stop the listener if you need to before it triggers.


## Function listenActivePing

This function lets you keep an eye on active trading signals within the backtest-kit framework. It sends you updates, roughly every minute, about the status of these signals. Think of it as a way to be notified whenever a signal becomes active or changes. 

The function works by providing a callback – a piece of code you define – that gets executed whenever a new active ping event occurs. Importantly, even if your callback involves asynchronous operations, the events will be processed one after another, ensuring things don’t get mixed up. This sequential processing is handled automatically, so you don't need to worry about managing concurrency. To stop listening, the function returns another function that you can call to unsubscribe.


## Function hasTradeContext

This function lets you quickly verify if your code is running within a trading environment where it has access to the necessary information for executing trades. It confirms whether both the execution and method contexts are present. Think of it as a safety check – it ensures you're in the right place to use functions that interact with the exchange, like retrieving candle data or formatting prices. If this function returns `true`, it means you're good to go and can safely use those exchange-related functions.

## Function getWalkerSchema

This function helps you understand the structure of a specific trading strategy or algorithm within the backtest-kit framework. Think of it as a way to peek under the hood and see what components a particular strategy is built from. You provide the name of the strategy you're interested in, and the function returns a description of its expected layout, including the types of data it uses and the functions it expects. This is useful for developers building custom strategies or integrations. It allows you to programmatically access information about a registered walker and its structure.


## Function getSymbol

This function lets you find out which stock or asset your backtest is currently focused on. It’s a simple way to grab the symbol, like "AAPL" or "BTCUSDT," so you can use it in your strategies or indicators. The function returns a promise that will resolve with the symbol as a string.

## Function getStrategySchema

This function helps you understand the structure of a trading strategy defined within the backtest-kit framework. It lets you look up a strategy by its name and get a detailed description of what inputs it expects and what outputs it produces. Think of it as a way to peek under the hood and see exactly how a particular strategy is built. You provide the strategy's name, and it returns a blueprint showing all its components and how they fit together. This is useful for validating strategy configurations or dynamically generating user interfaces.


## Function getSizingSchema

This function helps you find the details of a specific sizing strategy you’ve set up within the backtest-kit framework. Think of it as looking up a configuration – you give it the name of the sizing strategy, and it returns all the information about how that strategy works, like how much to trade based on different factors. It’s a simple way to access the settings and logic behind your trading size calculations. You'll use this when you need to examine or dynamically adjust your sizing methods during testing or analysis.


## Function getRiskSchema

This function lets you fetch the details of a specific risk management strategy you've set up within your backtesting environment. Think of it as looking up the blueprint for how a certain risk calculation is performed. You provide the name you gave that risk strategy when you created it, and the function returns all the information related to that strategy, like what data it uses and how it’s calculated. It’s useful for understanding or verifying how risk is being assessed in your backtest.


## Function getRawCandles

This function, `getRawCandles`, lets you retrieve historical candlestick data for a specific trading pair. You can easily specify how many candles you want and, optionally, define a start and end date for your request. It's designed to be flexible, allowing you to fetch candles within a date range or just get a certain number of recent candles. 

Importantly, the function prevents any look-ahead bias, meaning it always uses data available at a given point in time.

Here's how you can use the parameters:

*   You can provide a start date, end date, and a limit to retrieve a specific chunk of candles.
*   If you only provide a start date and end date, the function will automatically calculate the number of candles needed.
*   Providing just an end date and a limit will cause the function to calculate the start date.
*   If you just want to fetch a limited number of candles, it will use the current time as a reference point.

The `symbol` parameter tells the function which trading pair to get data for (like "BTCUSDT"), and the `interval` parameter defines the time frame for each candle ("1m" for 1-minute candles, "1h" for 1-hour candles, and so on). Remember that the end date must always be in the past when using this function.

## Function getOrderBook

This function lets you retrieve the order book for a specific trading pair, like BTCUSDT. It pulls the data directly from the exchange you’re connected to.

You can specify how many levels of the order book you want to see; if you don’t provide a depth, it will default to a reasonable maximum. 

The function is designed to work whether you're doing a backtest or live trading, handling the timing automatically based on your current environment. The exchange itself decides how to utilize the time information provided.

## Function getMode

This function lets you check if the backtest-kit framework is running in backtest mode or live trading mode. It returns a promise that resolves to either "backtest" or "live," giving you a simple way to adapt your code's behavior depending on the environment. Think of it as a way to know whether you're practicing with historical data or actively trading. You can use this information to, for example, adjust logging levels or disable certain features in backtest mode.

## Function getFrameSchema

This function helps you understand the structure of a particular trading frame within the backtest-kit framework. Think of it as a way to peek at the expected format and data types for a specific frame. By providing the frame's name, you’ll get back a detailed schema describing its contents, allowing you to build your trading logic with confidence. It’s useful for validating data or ensuring your code interacts correctly with different frames.


## Function getExchangeSchema

This function helps you access the specific details and structure of different cryptocurrency exchanges that backtest-kit supports. Think of it as looking up a blueprint for how a particular exchange handles orders, data, and other crucial aspects. You provide the name of the exchange you’re interested in, and the function returns a detailed schema describing its features. This is useful for understanding how to integrate with and simulate trading on various platforms within your backtesting environment. The exchange name acts like a key to unlock this schema information.

## Function getDefaultConfig

This function gives you a set of pre-defined settings for how the backtest-kit framework operates. Think of it as a starting point for configuring your trading strategies – it shows you all the different adjustable parameters and what their typical values are.  You can use this as a guide when you want to customize the framework’s behavior. It provides sensible defaults for things like slippage percentages, candle retrieval limits, and signal timing.

## Function getDefaultColumns

This function provides a quick way to get the standard set of columns used for generating reports within the backtest-kit framework. Think of it as a template – it shows you all the different types of data (like closed trades, heatmaps, live ticks, and strategy events) that can be displayed in columns.  It’s helpful if you want to understand the available options and default settings for customizing your reports. You can use it as a starting point when defining your own custom column configurations.

## Function getDate

This function, `getDate`, provides a simple way to retrieve the current date within your trading strategies. It essentially tells you what date is relevant for the calculations you're performing. When you're backtesting, it will give you the date associated with the specific historical timeframe you’re analyzing. If you’re running live, it returns the actual current date. It's a handy tool for time-sensitive logic in your strategies.

## Function getContext

This function gives you access to information about where your code is running within the backtest-kit framework. Think of it as a way to peek behind the curtain and understand the current situation – what method is being executed, what data is available, and other relevant details. It returns a promise that resolves to a context object, providing valuable insight into the operational environment of your trading strategies.

## Function getConfig

This function lets you peek at the framework's global settings. Think of it as a way to see how the backtest is set up – things like slippage percentages, fee amounts, and limits on signal lifetimes.  It's important to know that this returns a copy of the settings, so you can look at them without risking changing the actual configuration. This is useful for understanding the backtest environment and diagnosing potential issues.

## Function getColumns

This function lets you peek at the column definitions used to build reports within the backtest-kit framework. It provides a snapshot of how data is organized for display, including columns for strategy performance, risk metrics, and various events like breakeven points or scheduled actions.  Think of it as getting a read-only view of what columns are available for customizing your reports. It’s designed so you can examine the existing structure without accidentally changing it.

## Function getCandles

This function lets you retrieve historical price data, like open, high, low, and close prices, for a specific trading pair. You tell it which pair you're interested in (like BTCUSDT), how frequently the data should be grouped (every minute, every hour, etc.), and how many data points you want to pull. The function then goes to the exchange it’s connected to and gets that historical data for you. It pulls the data backwards from the current time, giving you a look at past price movements.

## Function getBacktestTimeframe

This function helps you find out the dates your backtest is using for a specific trading pair, like BTCUSDT. It returns a list of dates that define the timeframe for the backtest.  Essentially, it tells you the start and end dates being used when you’re testing a strategy. You pass in the symbol of the trading pair you’re interested in, and it gives you back those relevant dates.

## Function getAveragePrice

This function, `getAveragePrice`, helps you determine the Volume Weighted Average Price, or VWAP, for a specific trading pair. It looks back at the last five minutes of trading data, calculating a typical price for each minute based on the high, low, and closing prices. Then, it figures out the VWAP by weighting those typical prices by the volume traded at each point. If there's no trading volume recorded, it falls back to a simpler calculation using just the closing prices. You just need to provide the symbol of the trading pair you're interested in, like "BTCUSDT."

## Function getActionSchema

This function helps you find the specific details about a particular action within the backtest-kit framework. Think of it as looking up a blueprint – you give it the name of the action, and it returns a description of what that action involves, including what data it needs and what it can do. It’s useful when you want to understand the requirements or capabilities of a specific trading action programmatically. The name you provide needs to be a valid action identifier that has already been registered within the system.

## Function formatQuantity

This function helps you ensure the quantity you're using for trades is formatted correctly, following the rules of the specific exchange you're trading on. It takes a trading pair symbol, like "BTCUSDT," and the raw quantity value as input.  The function then uses the exchange's guidelines to automatically handle the correct number of decimal places for that symbol, giving you a properly formatted string representing the quantity. This is useful for creating valid order requests and avoiding errors related to incorrect quantity formatting.

## Function formatPrice

This function helps you display prices in a way that follows the rules of the specific exchange you're trading on. It takes a trading pair symbol, like "BTCUSDT", and the raw price number as input. It then figures out how many decimal places are needed based on that exchange’s conventions, ensuring the price looks correct and professional when displayed. Think of it as automatically handling the formatting details so you don't have to.

## Function commitTrailingTake

This function helps you fine-tune your trailing take-profit orders. It lets you adjust the distance of your take-profit based on a percentage shift relative to the original take-profit you initially set. 

It's really important to remember that this calculation always works from the original take-profit distance – this prevents errors from building up if you call it repeatedly. 

If you provide a smaller percentage shift, the function will only adjust your take-profit to be more conservative, moving it closer to your entry price. For long positions, it will only lower the take-profit, and for short positions, it will only raise it. The function automatically adapts to whether you’re in backtesting or live trading mode.


## Function commitTrailingStop

The `commitTrailingStop` function lets you dynamically adjust the trailing stop-loss for an open trade. It's designed to help refine your risk management strategy by automatically moving your stop-loss based on price action. 

Crucially, the calculations are always based on the original stop-loss distance you set initially, preventing errors from stacking up if you adjust it repeatedly. The function prioritizes improvements - a smaller shift will always be adopted if it offers better protection, and larger shifts take precedence. 

Think of it as a way to intelligently tighten or loosen your stop-loss. A negative shift brings the stop-loss closer to your entry price, while a positive shift moves it further away. The direction of the adjustment (higher or lower) is also automatically managed depending on whether you're in a long or short position. It handles whether you’re running a backtest or live trading, so you don’t need to worry about that.

You'll need to provide the trading symbol, the percentage adjustment you want to apply, and the current price to check if the stop-loss is triggered.


## Function commitPartialProfit

This function lets you automatically close a portion of your open trade when the price moves in a profitable direction, helping you secure some gains along the way. You tell it which trading pair to adjust (`symbol`) and what percentage of the trade you want to close (`percentToClose`). It’s designed to work seamlessly whether you’re backtesting strategies or trading live, as it figures out the environment on its own. Essentially, it's a way to take partial profits as the price heads towards your target profit level.


## Function commitPartialLoss

This function lets you automatically close a portion of your open trade when the price is moving in a direction that would trigger your stop-loss. It's designed to help manage risk by taking profits or limiting losses in a more dynamic way. You specify the trading symbol and the percentage of the position you want to close – for example, closing 25% of your position. The function handles whether it's running in a backtesting environment or a live trading scenario, so you don't have to worry about that. Remember, the price needs to be heading toward your stop-loss for this function to work.


## Function commitClosePending

This function lets you manually close an existing pending order within your backtest or live trading strategy without interrupting its normal operation. Think of it as a way to cancel a pending order you previously set up, but still allow your strategy to keep generating new signals and making decisions. It's particularly useful if you want to override a pending order for some reason, like adjusting your risk management. You can optionally provide a close ID to help you track why you closed the order. The function figures out whether you're in a backtest or live environment automatically, so you don't have to worry about that.

## Function commitCancelScheduled

This function lets you cancel a previously scheduled trading signal without interrupting your overall trading strategy. Think of it as removing a plan from your to-do list—it doesn't affect anything currently happening, and your strategy will keep running as usual. You can optionally include a cancellation ID to help track which cancellations were initiated by you. The system automatically knows whether it’s running a backtest or a live trade, so you don’t need to worry about that.

## Function commitBreakeven

This function helps you manage your risk by automatically adjusting your stop-loss order. It essentially moves your stop-loss to the entry price – meaning you're at zero risk – once the price has moved favorably enough to cover any transaction fees and a small slippage buffer.  Think of it as a way to lock in profits once you've achieved a certain level of gain. The function figures out the exact threshold for this move based on pre-defined settings, and it handles the details of getting the current price for you. It works seamlessly whether you're backtesting or trading live. You only need to provide the trading pair symbol, like "BTCUSDT."

## Function addWalkerSchema

This function lets you register a "walker" which is essentially a way to run multiple trading strategies against the same historical data and see how they stack up against each other. Think of it as setting up a competition between your strategies. You provide a configuration object that defines how the walker should operate, telling it what strategies to test, what data to use, and what metrics to evaluate performance. Once registered, the walker is ready to be used within the backtest-kit framework to perform these comparative analyses.

## Function addStrategySchema

This function lets you tell backtest-kit about a new trading strategy you've built. Think of it as registering your strategy so the framework knows how to use it. When you register a strategy, the framework will automatically check that your strategy's signals make sense – like verifying prices and stop-loss logic – and help prevent it from sending too many signals at once. Additionally, when running live trades, it ensures your strategy's data is safely saved even if something unexpected happens. You provide the framework with a configuration object that describes your strategy.

## Function addSizingSchema

This function lets you tell backtest-kit how to determine your position sizes for each trade. Think of it as defining your risk management rules. You provide a configuration object that outlines things like whether you want to use a fixed percentage of your capital, a Kelly Criterion approach, or something based on Average True Range (ATR). The configuration also lets you set limits on your trades, such as minimum and maximum position sizes, and specify callbacks to handle sizing calculations. Essentially, it’s how you tell the framework how much money you're willing to risk on each trade.


## Function addRiskSchema

This function lets you define how your trading system manages risk. Think of it as setting the rules of the road for your strategies to prevent them from taking on too much exposure. You can specify limits on how many positions can be active at once, create custom checks to ensure your portfolio is healthy, and even define what happens when a trading signal is flagged as potentially risky.  Because multiple strategies share this risk configuration, you can get a clear view of overall portfolio risk and dependencies between strategies. It's a central point for controlling and monitoring risk across your entire trading setup.

## Function addFrameSchema

This function lets you tell backtest-kit about a new timeframe you want to use for your backtesting. Think of it as defining how your historical data will be sliced up into trading periods – for example, specifying a start date, end date, and the frequency of bars (like daily, hourly, or even minute-by-minute). You provide a configuration object that outlines these timeframe details, and the system remembers it so you can use it later when setting up your backtest. Essentially, it expands the range of timeframes backtest-kit can work with.

## Function addExchangeSchema

This function lets you tell backtest-kit about a new data source for trading, like a specific exchange. Think of it as registering a connection to a place where historical price data lives. The exchange you register needs to be able to provide past candle data, format prices and quantities correctly, and calculate a VWAP (Volume Weighted Average Price) based on recent trades. You essentially pass in a configuration object that defines how to connect to and use that exchange's data.

## Function addActionSchema

This function lets you register special handlers, called actions, within the backtest-kit framework. Think of actions as little helpers that react to specific events happening during your strategy's testing – like when a signal is generated or a trade reaches a profit target. You can use these actions to do things like send notifications to a messaging app, log events, or even trigger custom logic based on what’s happening in your backtest.

Essentially, you're defining a blueprint for how the framework should respond to different events. 

Each action gets created specifically for a combination of your strategy and the timeframe you’re testing it on, ensuring it’s relevant to the current situation. The action receives details about all the important events that occur during the backtest, giving it all the information it needs to do its job.

