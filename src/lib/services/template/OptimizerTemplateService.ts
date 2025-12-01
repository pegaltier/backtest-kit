import { inject } from "../../../lib/core/di";
import {
  IOptimizerData,
  IOptimizerTemplate,
} from "../../../interfaces/Optimizer.interface";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import { str } from "functools-kit";
import { CandleInterval, ExchangeName } from "../../../interfaces/Exchange.interface";

export class OptimizerTemplateService implements IOptimizerTemplate {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public getTopBanner = async (symbol: string) => {
    this.loggerService.log("optimizerTemplateService getTopBanner", {
      symbol,
    });
    return str.newline(
      "#!/usr/bin/env node",
      "",
      `import { Ollama } from "ollama";`,
      `import ccxt from "ccxt";`
    );
  };

  public getUserMessage = async (
    symbol: string,
    data: IOptimizerData[],
    name: string
  ) => {
    this.loggerService.log("optimizerTemplateService getUserMessage", {
      symbol,
      data,
      name,
    });
    return str.newline("Прочитай данные и скажи ОК", "", JSON.stringify(data));
  };

  public getAssistantMessage = async (
    symbol: string,
    data: IOptimizerData[],
    name: string
  ) => {
    this.loggerService.log("optimizerTemplateService getAssistantMessage", {
      symbol,
      data,
      name,
    });
    return "ОК";
  };

  public getExchangeTemplate = async (
    symbol: string,
    exchangeName: ExchangeName
  ) => {
    this.loggerService.log("optimizerTemplateService getExchangeTemplate", {
      exchangeName,
      symbol,
    });
    return str.newline(
      `addExchange({`,
      `    exchangeName: "${exchangeName}",`,
      `    getCandles: async (symbol, interval, since, limit) => {`,
      `        const exchange = new ccxt.binance();`,
      `        const ohlcv = await exchange.fetchOHLCV(symbol, interval, since.getTime(), limit);`,
      `        return ohlcv.map(([timestamp, open, high, low, close, volume]) => ({`,
      `            timestamp, open, high, low, close, volume`,
      `        }));`,
      `    },`,
      `    formatPrice: async (symbol, price) => price.toFixed(2),`,
      `    formatQuantity: async (symbol, quantity) => quantity.toFixed(8),`,
      `});`
    );
  };

  public getFrameTemplate = async (
    symbol: string,
    frameName: string,
    interval: CandleInterval,
    startDate: Date,
    endDate: Date
  ) => {
    this.loggerService.log("optimizerTemplateService getFrameTemplate", {
      symbol,
      frameName,
      interval,
      startDate,
      endDate,
    });
    return str.newline(
      `addFrame({`,
      `    frameName: "${frameName}",`,
      `    interval: "${interval}",`,
      `    startDate: new Date("${startDate.toISOString()}"),`,
      `    endDate: new Date("${endDate.toISOString()}"),`,
      `});`
    );
  };

  public getTextTemplate = async (symbol: string) => {
    this.loggerService.log("optimizerTemplateService getTextTemplate", {
      symbol,
    });
    return str.newline(
      `async function text(messages) {`,
      `    const ollama = new Ollama({`,
      `        host: "https://ollama.com",`,
      `        headers: {`,
      `            Authorization: \`Bearer \${process.env.OLLAMA_API_KEY}\`,`,
      `        },`,
      `    });`,
      ``,
      `    const response = await ollama.chat({`,
      `        model: "gpt-oss:20b",`,
      `        messages: [`,
      `            {`,
      `                role: "system",`,
      `                content: [`,
      `                    "В ответ напиши торговую стратегию где нет ничего лишнего,",`,
      `                    "только отчёт готовый для копипасты целиком",`,
      `                    "",`,
      `                    "**ВАЖНО**: Не здоровайся, не говори что делаешь - только отчёт!"`,
      `                ].join("\\n"),`,
      `            },`,
      `            ...messages,`,
      `        ],`,
      `    });`,
      ``,
      `    return response.message.content.trim();`,
      `}`
    );
  };

  public getJsonTemplate = async (symbol: string) => {
    this.loggerService.log("optimizerTemplateService getJsonTemplate", {
      symbol,
    });
    return str.newline(
      `async function json(messages) {`,
      `    const ollama = new Ollama({`,
      `        host: "https://ollama.com",`,
      `        headers: {`,
      `            Authorization: \`Bearer \${process.env.OLLAMA_API_KEY}\`,`,
      `        },`,
      `    });`,
      ``,
      `    const response = await ollama.chat({`,
      `        model: "gpt-oss:20b",`,
      `        messages: [`,
      `            {`,
      `                role: "system",`,
      `                content: [`,
      `                    "Проанализируй торговую стратегию и верни торговый сигнал.",`,
      `                    "",`,
      `                    "ПРАВИЛА ОТКРЫТИЯ ПОЗИЦИЙ:",`,
      `                    "",`,
      `                    "1. ТИПЫ ПОЗИЦИЙ:",`,
      `                    "   - position='wait': нет четкого сигнала, жди лучших условий",`,
      `                    "   - position='long': бычий сигнал, планируй покупку",`,
      `                    "   - position='short': медвежий сигнал, планируй продажу",`,
      `                    "",`,
      `                    "2. ЦЕНА ВХОДА (priceOpen):",`,
      `                    "   - Может быть текущей рыночной ценой для немедленного входа",`,
      `                    "   - Может быть отложенной ценой для входа при достижении уровня",`,
      `                    "   - Укажи оптимальную цену входа согласно технического анализа",`,
      `                    "",`,
      `                    "3. УРОВНИ ВЫХОДА:",`,
      `                    "   - LONG: priceTakeProfit > priceOpen > priceStopLoss",`,
      `                    "   - SHORT: priceStopLoss > priceOpen > priceTakeProfit",`,
      `                    "   - Уровни должны иметь техническое обоснование (Fibonacci, S/R, Bollinger)",`,
      `                    "",`,
      `                    "4. ВРЕМЕННЫЕ РАМКИ:",`,
      `                    "   - minuteEstimatedTime: прогноз времени до TP (макс 360 минут)",`,
      `                    "   - Расчет на основе ATR, ADX, MACD, Momentum, Slope",`,
      `                ].join("\\n"),`,
      `            },`,
      `            ...messages,`,
      `        ],`,
      `        format: {`,
      `            type: "object",`,
      `            properties: {`,
      `                position: {`,
      `                    type: "string",`,
      `                    enum: ["wait", "long", "short"],`,
      `                    description: "Trade decision: wait (no signal), long (buy), or short (sell)",`,
      `                },`,
      `                note: {`,
      `                    type: "string",`,
      `                    description: "Professional trading recommendation with price levels",`,
      `                },`,
      `                priceOpen: {`,
      `                    type: "number",`,
      `                    description: "Entry price (current market price or pending order price)",`,
      `                },`,
      `                priceTakeProfit: {`,
      `                    type: "number",`,
      `                    description: "Take profit target price",`,
      `                },`,
      `                priceStopLoss: {`,
      `                    type: "number",`,
      `                    description: "Stop loss exit price",`,
      `                },`,
      `                minuteEstimatedTime: {`,
      `                    type: "number",`,
      `                    description: "Expected time to reach TP in minutes (max 360)",`,
      `                },`,
      `            },`,
      `            required: ["position", "note", "priceOpen", "priceTakeProfit", "priceStopLoss", "minuteEstimatedTime"],`,
      `        },`,
      `    });`,
      ``,
      `    const jsonResponse = JSON.parse(response.message.content.trim());`,
      `    return jsonResponse;`,
      `}`
    );
  };
}

export default OptimizerTemplateService;
