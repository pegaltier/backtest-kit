/**
 * Example utility functions for your trading bot
 */

/**
 * Calculate position size based on risk percentage
 * @param {number} accountBalance - Total account balance
 * @param {number} riskPercent - Risk percentage (e.g., 1 for 1%)
 * @param {number} entryPrice - Entry price
 * @param {number} stopLossPrice - Stop loss price
 * @returns {number} Position size
 */
export function calculatePositionSize(accountBalance, riskPercent, entryPrice, stopLossPrice) {
  const riskAmount = accountBalance * (riskPercent / 100);
  const priceDistance = Math.abs(entryPrice - stopLossPrice);
  const positionSize = riskAmount / priceDistance;
  return positionSize;
}

/**
 * Calculate Risk/Reward ratio
 * @param {number} entryPrice - Entry price
 * @param {number} takeProfitPrice - Take profit price
 * @param {number} stopLossPrice - Stop loss price
 * @param {'long' | 'short'} position - Position type
 * @returns {number} Risk/Reward ratio
 */
export function calculateRiskRewardRatio(entryPrice, takeProfitPrice, stopLossPrice, position) {
  const reward = position === 'long'
    ? takeProfitPrice - entryPrice
    : entryPrice - takeProfitPrice;

  const risk = position === 'long'
    ? entryPrice - stopLossPrice
    : stopLossPrice - entryPrice;

  return reward / risk;
}

/**
 * Format price with proper decimal places
 * @param {number} price - Price value
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted price
 */
export function formatPrice(price, decimals = 2) {
  return price.toFixed(decimals);
}

/**
 * Calculate percentage change
 * @param {number} oldValue - Old value
 * @param {number} newValue - New value
 * @returns {number} Percentage change
 */
export function calculatePercentageChange(oldValue, newValue) {
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Simple moving average calculation
 * @param {number[]} values - Array of values
 * @param {number} period - Period for SMA
 * @returns {number} SMA value
 */
export function calculateSMA(values, period) {
  if (values.length < period) {
    throw new Error('Not enough values for SMA calculation');
  }

  const slice = values.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * Check if a candle is bullish
 * @param {object} candle - OHLCV candle
 * @returns {boolean} True if bullish
 */
export function isBullishCandle(candle) {
  return candle.close > candle.open;
}

/**
 * Check if a candle is bearish
 * @param {object} candle - OHLCV candle
 * @returns {boolean} True if bearish
 */
export function isBearishCandle(candle) {
  return candle.close < candle.open;
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format timestamp to readable string
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
export function formatTimestamp(timestamp) {
  return new Date(timestamp).toISOString();
}

/**
 * Validate trading signal structure
 * @param {object} signal - Trading signal object
 * @returns {boolean} True if valid
 */
export function isValidSignal(signal) {
  const required = ['position', 'priceOpen', 'priceTakeProfit', 'priceStopLoss'];
  return required.every(field => signal[field] !== undefined && signal[field] !== null);
}
