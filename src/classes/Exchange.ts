import backtest from "../lib";
import { CandleInterval, ExchangeName, IExchangeSchema } from "../interfaces/Exchange.interface";
import { memoize } from "functools-kit";

const EXCHANGE_METHOD_NAME_GET_CANDLES = "ExchangeUtils.getCandles";
const EXCHANGE_METHOD_NAME_FORMAT_QUANTITY = "ExchangeUtils.formatQuantity";
const EXCHANGE_METHOD_NAME_FORMAT_PRICE = "ExchangeUtils.formatPrice";

/**
 * Instance class for exchange operations on a specific exchange.
 *
 * Provides isolated exchange operations for a single exchange.
 * Each instance maintains its own context and exposes IExchangeSchema methods.
 * The schema is retrieved once during construction for better performance.
 *
 * @example
 * ```typescript
 * const instance = new ExchangeInstance("binance");
 *
 * const candles = await instance.getCandles("BTCUSDT", "1m", new Date(), 100);
 * const formattedQty = await instance.formatQuantity("BTCUSDT", 0.001);
 * const formattedPrice = await instance.formatPrice("BTCUSDT", 50000.123);
 * ```
 */
export class ExchangeInstance {
  /** Cached exchange schema retrieved once during construction */
  private _schema: IExchangeSchema;

  /**
   * Creates a new ExchangeInstance for a specific exchange.
   *
   * @param exchangeName - Exchange name (e.g., "binance")
   */
  constructor(readonly exchangeName: ExchangeName) {
    this._schema = backtest.exchangeSchemaService.get(this.exchangeName);
  }

  /**
   * Fetch candles from data source (API or database).
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param interval - Candle time interval (e.g., "1m", "1h")
   * @param since - Start date for candle fetching
   * @param limit - Maximum number of candles to fetch
   * @returns Promise resolving to array of OHLCV candle data
   *
   * @example
   * ```typescript
   * const instance = new ExchangeInstance("binance");
   * const candles = await instance.getCandles("BTCUSDT", "1m", new Date(), 100);
   * ```
   */
  public getCandles = async (
    symbol: string,
    interval: CandleInterval,
    since: Date,
    limit: number
  ) => {
    backtest.loggerService.info(EXCHANGE_METHOD_NAME_GET_CANDLES, {
      exchangeName: this.exchangeName,
      symbol,
      interval,
      since,
      limit,
    });
    return await this._schema.getCandles(symbol, interval, since, limit);
  };

  /**
   * Format quantity according to exchange precision rules.
   *
   * @param symbol - Trading pair symbol
   * @param quantity - Raw quantity value
   * @returns Promise resolving to formatted quantity string
   *
   * @example
   * ```typescript
   * const instance = new ExchangeInstance("binance");
   * const formatted = await instance.formatQuantity("BTCUSDT", 0.001);
   * console.log(formatted); // "0.001"
   * ```
   */
  public formatQuantity = async (symbol: string, quantity: number): Promise<string> => {
    backtest.loggerService.info(EXCHANGE_METHOD_NAME_FORMAT_QUANTITY, {
      exchangeName: this.exchangeName,
      symbol,
      quantity,
    });
    return await this._schema.formatQuantity(symbol, quantity);
  };

  /**
   * Format price according to exchange precision rules.
   *
   * @param symbol - Trading pair symbol
   * @param price - Raw price value
   * @returns Promise resolving to formatted price string
   *
   * @example
   * ```typescript
   * const instance = new ExchangeInstance("binance");
   * const formatted = await instance.formatPrice("BTCUSDT", 50000.123);
   * console.log(formatted); // "50000.12"
   * ```
   */
  public formatPrice = async (symbol: string, price: number): Promise<string> => {
    backtest.loggerService.info(EXCHANGE_METHOD_NAME_FORMAT_PRICE, {
      exchangeName: this.exchangeName,
      symbol,
      price,
    });
    return await this._schema.formatPrice(symbol, price);
  };
}

/**
 * Utility class for exchange operations.
 *
 * Provides simplified access to exchange schema methods with validation.
 * Exported as singleton instance for convenient usage.
 *
 * @example
 * ```typescript
 * import { Exchange } from "./classes/Exchange";
 *
 * const candles = await Exchange.getCandles("BTCUSDT", "1m", new Date(), 100, {
 *   exchangeName: "binance"
 * });
 * const formatted = await Exchange.formatQuantity("BTCUSDT", 0.001, {
 *   exchangeName: "binance"
 * });
 * ```
 */
export class ExchangeUtils {
  /**
   * Memoized function to get or create ExchangeInstance for an exchange.
   * Each exchange gets its own isolated instance.
   */
  private _getInstance = memoize<(exchangeName: ExchangeName) => ExchangeInstance>(
    ([exchangeName]) => exchangeName,
    (exchangeName: ExchangeName) => new ExchangeInstance(exchangeName)
  );

  /**
   * Fetch candles from data source (API or database).
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param interval - Candle time interval (e.g., "1m", "1h")
   * @param since - Start date for candle fetching
   * @param limit - Maximum number of candles to fetch
   * @param context - Execution context with exchange name
   * @returns Promise resolving to array of OHLCV candle data
   */
  public getCandles = async (
    symbol: string,
    interval: CandleInterval,
    since: Date,
    limit: number,
    context: {
      exchangeName: ExchangeName;
    }
  ) => {
    backtest.exchangeValidationService.validate(context.exchangeName, EXCHANGE_METHOD_NAME_GET_CANDLES);

    const instance = this._getInstance(context.exchangeName);
    return await instance.getCandles(symbol, interval, since, limit);
  };

  /**
   * Format quantity according to exchange precision rules.
   *
   * @param symbol - Trading pair symbol
   * @param quantity - Raw quantity value
   * @param context - Execution context with exchange name
   * @returns Promise resolving to formatted quantity string
   */
  public formatQuantity = async (
    symbol: string,
    quantity: number,
    context: {
      exchangeName: ExchangeName;
    }
  ): Promise<string> => {
    backtest.exchangeValidationService.validate(context.exchangeName, EXCHANGE_METHOD_NAME_FORMAT_QUANTITY);

    const instance = this._getInstance(context.exchangeName);
    return await instance.formatQuantity(symbol, quantity);
  };

  /**
   * Format price according to exchange precision rules.
   *
   * @param symbol - Trading pair symbol
   * @param price - Raw price value
   * @param context - Execution context with exchange name
   * @returns Promise resolving to formatted price string
   */
  public formatPrice = async (
    symbol: string,
    price: number,
    context: {
      exchangeName: ExchangeName;
    }
  ): Promise<string> => {
    backtest.exchangeValidationService.validate(context.exchangeName, EXCHANGE_METHOD_NAME_FORMAT_PRICE);

    const instance = this._getInstance(context.exchangeName);
    return await instance.formatPrice(symbol, price);
  };
}

/**
 * Singleton instance of ExchangeUtils for convenient exchange operations.
 *
 * @example
 * ```typescript
 * import { Exchange } from "./classes/Exchange";
 *
 * // Using static-like API with context
 * const candles = await Exchange.getCandles("BTCUSDT", "1m", new Date(), 100, {
 *   exchangeName: "binance"
 * });
 * const qty = await Exchange.formatQuantity("BTCUSDT", 0.001, {
 *   exchangeName: "binance"
 * });
 * const price = await Exchange.formatPrice("BTCUSDT", 50000.123, {
 *   exchangeName: "binance"
 * });
 *
 * // Using instance API (no context needed, exchange set in constructor)
 * const binance = new ExchangeInstance("binance");
 * const candles2 = await binance.getCandles("BTCUSDT", "1m", new Date(), 100);
 * ```
 */
export const Exchange = new ExchangeUtils();
