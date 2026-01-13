import { str } from "functools-kit";
import { z } from "zod";

export const SignalSchema = z.object({
  position: z
    .enum(["long", "short", "wait"])
    .describe(
      str.newline(
        "Position direction (ALWAYS required):",
        "long: market shows consistent bullish signals, uptrend or growth potential",
        "short: market shows consistent bearish signals, downtrend or decline potential",
        "wait: conflicting signals between timeframes OR unfavorable trading conditions",
      )
    ),
  price_open: z
    .number()
    .describe(
      str.newline(
        "Position opening price in USD",
        "Use the current market price at the time of analysis"
      )
    ),
  price_stop_loss: z
    .number()
    .describe(
      str.newline(
        "Stop-loss price in USD",
        "For LONG: price below price_open (protection against decline)",
        "For SHORT: price above price_open (protection against rise)",
        "NEVER set SL in 'empty space' without technical justification"
      )
    ),
  price_take_profit: z
    .number()
    .describe(
      str.newline(
        "Take-profit price in USD",
        "For LONG: price above price_open (growth target)",
        "For SHORT: price below price_open (decline target)",
        "NEVER set TP based on trend without technical justification",
      )
    ),
  minute_estimated_time: z
    .number()
    .describe(
      str.newline(
        "Estimated time to reach Take Profit in minutes",
        "Calculated based on HONEST technical analysis, using:",
        "ATR, ADX, MACD, Momentum, Slope and other metrics",
      )
    ),
  risk_note: z
    .string()
    .describe(
      str.newline(
        "Description of current market situation risks:",
        "",
        "Analyze and specify applicable risks:",
        "1. Whale manipulations (volume spikes, long shadows, pin bars, candle engulfing, false breakouts)",
        "2. Order book (order book walls, spoofing, bid/ask imbalance, low liquidity)",
        "3. P&L history (recurring mistakes on similar patterns)",
        "4. Time factors (trading session, low liquidity, upcoming events)",
        "5. Correlations (overall market trend, conflicting trends across timeframes)",
        "6. Technical risks (indicator divergences, weak volumes, critical levels)",
        "7. Gaps and anomalies (price gaps, unfilled gaps, movements without volume)",
        "",
        "Provide SPECIFIC numbers, percentages and probabilities."
      )
    ),
});

type SignalSchemaInfer = z.infer<typeof SignalSchema>;

export type TSignalSchema = {
  [K in keyof SignalSchemaInfer]-?: Exclude<SignalSchemaInfer[K], undefined>;
};

export default TSignalSchema;
