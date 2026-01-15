# 🧿 @backtest-kit/sidekick

> The easiest way to create a new Backtest Kit trading bot project. Like create-react-app, but for algorithmic trading.

![future](https://raw.githubusercontent.com/tripolskypetr/backtest-kit/HEAD/assets/prophet.png)

[![npm](https://img.shields.io/npm/v/@backtest-kit/sidekick.svg?style=flat-square)](https://npmjs.org/package/@backtest-kit/sidekick)
[![License](https://img.shields.io/npm/l/@backtest-kit/sidekick.svg)](https://github.com/tripolskypetr/backtest-kit/blob/master/LICENSE)

Create production-ready trading bots in seconds with pre-configured templates, LLM integration, and technical analysis.

📚 **[Backtest Kit Docs](https://backtest-kit.github.io/documents/example_02_first_backtest.html)** | 🌟 **[GitHub](https://github.com/tripolskypetr/backtest-kit)**

## ✨ Features

- 🚀 **Zero Config**: Get started with one command - no setup required
- 📦 **Complete Template**: Includes backtest strategy, risk management, and LLM integration
- 🤖 **AI-Powered**: Pre-configured with DeepSeek, Claude, and GPT-5 fallback chain
- 📊 **Technical Analysis**: Built-in 50+ indicators via @backtest-kit/signals
- 🔑 **Environment Setup**: Auto-generated .env with all API key placeholders
- 📝 **Best Practices**: Production-ready code structure with examples

## 🚀 Quick Start

### Create a New Project

```bash
npx -y @backtest-kit/sidekick my-trading-bot
cd my-trading-bot
npm start
```

That's it! You now have a working trading bot with:
- Complete backtest setup
- LLM-powered strategy
- Multi-timeframe technical analysis
- Risk management validation
- Environment configuration

## 📁 Project Structure

The generated project includes:

```
my-trading-bot/
├── src/
│   ├── index.mjs          # Main entry point with strategy
│   └── utils/
│       └── example.mjs    # Helper functions
├── .env                   # API keys (populated from .env.example)
├── .env.example           # Environment template
├── .gitignore             # Git ignore rules
├── package.json           # Dependencies
└── README.md              # Project documentation
```

## 🎯 What's Included

### 1. Pre-configured Exchange (Binance)
```javascript
addExchange({
  exchangeName: 'binance',
  getCandles: async (symbol, interval, since, limit) => { ... }
});
```

### 2. Risk Management Profile
```javascript
addRisk({
  riskName: 'demo',
  validations: [
    // TP at least 1% away
    // R/R ratio at least 2:1
  ]
});
```

### 3. LLM Strategy with Fallback Chain
```javascript
// Try DeepSeek → Claude → GPT-5
signal = await deepseek(messages, 'deepseek-chat');
```

### 4. Technical Analysis Integration
```javascript
await commitHistorySetup(symbol, messages);
// Injects 50+ indicators across 4 timeframes
```

### 5. Backtest Runner
```javascript
Backtest.background('BTCUSDT', {
  strategyName: 'llm-strategy',
  exchangeName: 'binance',
  frameName: '1d-test',
});
```

## ⚙️ Configuration

### API Keys

Edit `.env` file and add your keys:

```bash
# LLM Providers (at least one required)
CC_DEEPSEEK_API_KEY=your_deepseek_key_here
CC_ANTHROPIC_API_KEY=your_anthropic_key_here
CC_OPENAI_API_KEY=your_openai_key_here

# Exchange (for live trading)
CC_BINANCE_API_KEY=your_api_key_here
CC_BINANCE_API_SECRET=your_api_secret_here
```

### Strategy Parameters

Modify these in `src/index.mjs`:

```javascript
addFrame({
  frameName: '1d-test',
  startDate: new Date('2025-01-01'),  // Change dates
  endDate: new Date('2025-01-02'),
});

addStrategy({
  strategyName: 'llm-strategy',
  interval: '5m',  // Change interval
  riskName: 'demo',
});
```

## 🔄 Live Trading

To switch from backtest to live trading:

1. Uncomment the live trading section in `src/index.mjs`:

```javascript
import { Live, listenSignalLive, listenErrorLive } from 'backtest-kit';

Live.background('BTCUSDT', {
  strategyName: 'llm-strategy',
  exchangeName: 'binance',
});
```

2. Make sure your exchange API keys are set in `.env`

3. Start with paper trading first!

## 📊 Generated Reports

After backtest completes, find reports in:

```
./dump/
├── BTCUSDT-llm-strategy-signals.md    # All signals
├── BTCUSDT-llm-strategy-report.md     # Performance metrics
└── ...
```

## 🛠️ Customization Examples

### Add Custom Indicator

```javascript
import { getCandles } from 'backtest-kit';
import { calculateSMA } from './utils/example.mjs';

const candles = await getCandles(symbol, '1h', 50);
const closes = candles.map(c => c.close);
const sma50 = calculateSMA(closes, 50);
```

### Change LLM Provider

```javascript
// Use only OpenAI
signal = await gpt5(messages, 'gpt-4o', process.env.CC_OPENAI_API_KEY);

// Use only Claude
signal = await claude(messages, 'claude-3-5-sonnet-20241022', process.env.CC_ANTHROPIC_API_KEY);
```

### Modify Risk Rules

```javascript
addRisk({
  riskName: 'aggressive',
  validations: [
    ({ pendingSignal, currentPrice }) => {
      // Custom validation logic
      if (pendingSignal.priceStopLoss < currentPrice * 0.95) {
        throw new Error('Stop loss too far');
      }
    }
  ]
});
```

## 📦 Dependencies

The generated project includes:

```json
{
  "backtest-kit": "^1.11.10",
  "@backtest-kit/signals": "^0.0.1",
  "@backtest-kit/ollama": "^0.0.1",
  "agent-swarm-kit": "^1.1.180",
  "ccxt": "^4.4.41",
  "uuid": "^11.0.3",
  "dotenv": "^16.4.7"
}
```

## 💡 CLI Options

```bash
# Create project with custom name
npx -y @backtest-kit/sidekick my-bot

# Create in current directory (must be empty)
npx -y @backtest-kit/sidekick .
```

## 🚨 Common Issues

### "Directory already exists and is not empty"
The target directory must be empty. Either:
- Choose a different project name
- Delete existing files
- Use a fresh directory

### "npm install failed"
Make sure you have:
- Node.js 18+ installed
- Stable internet connection
- Write permissions in the directory

### "API key not found"
Don't forget to:
1. Copy `.env.example` to `.env`
2. Fill in your API keys
3. Restart the bot

## 🔗 Links

- [Backtest Kit Documentation](https://backtest-kit.github.io/documents/example_02_first_backtest.html)
- [GitHub Repository](https://github.com/tripolskypetr/backtest-kit)
- [Demo Projects](https://github.com/tripolskypetr/backtest-kit/tree/master/demo)
- [API Reference](https://backtest-kit.github.io/documents/example_02_first_backtest.html)

## 🤝 Contribute

Found a bug or want to add a feature? [Open an issue](https://github.com/tripolskypetr/backtest-kit/issues) or submit a PR!

## 📜 License

MIT © [tripolskypetr](https://github.com/tripolskypetr)
