import 'dotenv/config';
import { v4 as uuid } from 'uuid';
import ccxt from 'ccxt';
import {
  setLogger,
  setConfig,
  addExchange,
  addStrategy,
  addFrame,
  addRisk,
  Backtest,
  listenSignalBacktest,
  listenDoneBacktest,
  listenErrorBacktest,
} from 'backtest-kit';
import { commitHistorySetup } from '@backtest-kit/signals';
import { gpt5, deepseek, claude } from '@backtest-kit/ollama';

// ============================================
// 1. SETUP LOGGER
// ============================================

setLogger({
  log: console.log,
  debug: console.debug,
  info: console.info,
  warn: console.warn,
});

// ============================================
// 2. GLOBAL CONFIGURATION
// ============================================

setConfig({
  CC_PERCENT_SLIPPAGE: 0.1, // 0.1% slippage
  CC_PERCENT_FEE: 0.1, // 0.1% fee
  CC_SCHEDULE_AWAIT_MINUTES: 120, // Wait 120 minutes for pending signals
});

// ============================================
// 3. REGISTER EXCHANGE (DATA SOURCE)
// ============================================

addExchange({
  exchangeName: 'binance',
  getCandles: async (symbol, interval, since, limit) => {
    const exchange = new ccxt.binance();
    const ohlcv = await exchange.fetchOHLCV(
      symbol,
      interval,
      since.getTime(),
      limit
    );
    return ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    }));
  },
  formatPrice: (symbol, price) => price.toFixed(2),
  formatQuantity: (symbol, quantity) => quantity.toFixed(8),
});

// ============================================
// 4. REGISTER RISK PROFILE
// ============================================

addRisk({
  riskName: 'demo',
  validations: [
    // Validation 1: Take Profit must be at least 1% away from entry
    ({ pendingSignal, currentPrice }) => {
      const { priceOpen = currentPrice, priceTakeProfit, position } = pendingSignal;
      const tpDistance =
        position === 'long'
          ? ((priceTakeProfit - priceOpen) / priceOpen) * 100
          : ((priceOpen - priceTakeProfit) / priceOpen) * 100;

      if (tpDistance < 1) {
        throw new Error(`TP too close: ${tpDistance.toFixed(2)}% (minimum 1%)`);
      }
    },

    // Validation 2: Risk/Reward ratio must be at least 2:1
    ({ pendingSignal, currentPrice }) => {
      const { priceOpen = currentPrice, priceTakeProfit, priceStopLoss, position } = pendingSignal;
      const reward =
        position === 'long'
          ? priceTakeProfit - priceOpen
          : priceOpen - priceTakeProfit;
      const risk =
        position === 'long'
          ? priceOpen - priceStopLoss
          : priceStopLoss - priceOpen;

      if (reward / risk < 2) {
        throw new Error(
          `Poor R/R ratio: ${(reward / risk).toFixed(2)} (minimum 2:1)`
        );
      }
    },
  ],
});

// ============================================
// 5. REGISTER TIME FRAME (FOR BACKTEST)
// ============================================

addFrame({
  frameName: '1d-test',
  interval: '1m',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-02'),
});

// ============================================
// 6. REGISTER STRATEGY (LLM-POWERED)
// ============================================

addStrategy({
  strategyName: 'llm-strategy',
  interval: '5m', // Strategy runs every 5 minutes
  riskName: 'demo',
  getSignal: async (symbol) => {
    const messages = [
      {
        role: 'system',
        content: `You are a professional trading bot. Analyze technical indicators and market data to generate trading signals.

Your response MUST be valid JSON with the following structure:
{
  "position": "long" | "short" | "wait",
  "priceOpen": number,
  "priceTakeProfit": number,
  "priceStopLoss": number,
  "minuteEstimatedTime": number,
  "note": "string explaining your reasoning"
}

Rules:
- Use "wait" if signals are unclear or contradictory
- Ensure Risk/Reward ratio is at least 2:1
- Take Profit must be at least 1% away from entry
- Provide clear reasoning in the note field`,
      },
    ];

    // Inject technical analysis from @backtest-kit/signals
    await commitHistorySetup(symbol, messages);

    // Add user instruction
    messages.push({
      role: 'user',
      content: `Based on the technical analysis above, generate a trading signal for ${symbol}.`,
    });

    // Generate signal via LLM (with fallback chain)
    let signal;
    const resultId = uuid();

    try {
      // Try DeepSeek first (cheap and fast)
      signal = await deepseek(messages, 'deepseek-chat', process.env.CC_DEEPSEEK_API_KEY);
    } catch (err) {
      console.warn('DeepSeek failed, trying Claude:', err.message);
      try {
        // Fallback to Claude
        signal = await claude(
          messages,
          'claude-3-5-sonnet-20241022',
          process.env.CC_ANTHROPIC_API_KEY
        );
      } catch (err2) {
        console.warn('Claude failed, using GPT-5:', err2.message);
        // Final fallback to OpenAI
        signal = await gpt5(messages, 'gpt-4o', process.env.CC_OPENAI_API_KEY);
      }
    }

    return { ...signal, id: resultId };
  },
});

// ============================================
// 7. RUN BACKTEST
// ============================================

console.log('🚀 Starting backtest...\n');

Backtest.background('BTCUSDT', {
  strategyName: 'llm-strategy',
  exchangeName: 'binance',
  frameName: '1d-test',
});

// Listen to backtest events
listenSignalBacktest((event) => {
  console.log('📊 Signal:', event);
});

listenErrorBacktest((event) => {
  console.error('❌ Error:', event);
});

listenDoneBacktest(async (event) => {
  console.log('\n✅ Backtest completed!');
  console.log('Generating report...\n');

  // Generate markdown report
  await Backtest.dump(event.symbol, event.strategyName);

  console.log('📈 Report saved to ./dump directory');
  console.log('\nBacktest Summary:');
  console.log(`- Symbol: ${event.symbol}`);
  console.log(`- Strategy: ${event.strategyName}`);
  console.log(`- Total Signals: ${event.totalSignals || 0}`);
  console.log(`- Successful Trades: ${event.successfulTrades || 0}`);
  console.log(`- Failed Trades: ${event.failedTrades || 0}`);
});

// ============================================
// 8. UNCOMMENT FOR LIVE TRADING
// ============================================

/*
import { Live, listenSignalLive, listenErrorLive } from 'backtest-kit';

Live.background('BTCUSDT', {
  strategyName: 'llm-strategy',
  exchangeName: 'binance', // Make sure to set API keys in .env
});

listenSignalLive((event) => {
  console.log('🔴 LIVE Signal:', event);
});

listenErrorLive((event) => {
  console.error('❌ LIVE Error:', event);
});
*/
