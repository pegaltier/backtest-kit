import { listExchangeSchema, listStrategySchema, Live, overrideExchangeSchema } from "backtest-kit";
import { singleshot } from "functools-kit";
import { getArgs } from "../../../helpers/getArgs";
import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import ExchangeSchemaService from "../schema/ExchangeSchemaService";
import ResolveService from "../base/ResolveService";
import FrontendProviderService from "../provider/FrontendProviderService";
import TelegramProviderService from "../provider/TelegramProviderService";
import notifyFinish from "../../../utils/notifyFinish";
import SymbolSchemaService from "../schema/SymbolSchemaService";
import LiveProviderService from "../provider/LiveProviderService";

export class LiveMainService {

  private loggerService = inject<LoggerService>(TYPES.loggerService);

  private exchangeSchemaService = inject<ExchangeSchemaService>(TYPES.exchangeSchemaService);
  private symbolSchemaService = inject<SymbolSchemaService>(TYPES.symbolSchemaService);

  private resolveService = inject<ResolveService>(TYPES.resolveService);

  private frontendProviderService = inject<FrontendProviderService>(TYPES.frontendProviderService);
  private telegramProviderService = inject<TelegramProviderService>(TYPES.telegramProviderService);
  private liveProviderService = inject<LiveProviderService>(TYPES.liveProviderService);

  protected init = singleshot(async () => {
    this.loggerService.log("liveMainService init");

    {
        this.frontendProviderService.connect();
        this.telegramProviderService.connect();
        this.liveProviderService.connect();
    }

    const { values, positionals } = getArgs();

    if (!values.live) {
      return;
    }

    const [entryPoint = null] = positionals;

    if (!entryPoint) {
      throw new Error("Entry point is required");
    }

    await this.resolveService.attachEntryPoint(entryPoint);

    {
        this.exchangeSchemaService.addSchema();
        this.symbolSchemaService.addSchema();
    }

    const symbol = <string>values.symbol || "BTCUSDT";

    const [defaultStrategyName = null] = await listStrategySchema();
    const [defaultExchangeName = null] = await listExchangeSchema();

    const strategyName =
      <string>values.strategy || defaultStrategyName?.strategyName;

    if (!strategyName) {
      throw new Error("Strategy name is required");
    }

    const exchangeName =
      <string>values.exchange || defaultExchangeName?.exchangeName;

    if (!exchangeName) {
      throw new Error("Exchange name is required");
    }

    if (values.verbose) {
      overrideExchangeSchema({
        exchangeName,
        callbacks: {
          onCandleData(symbol, interval, since) {
            console.log(
              `Received candle data for symbol: ${symbol}, interval: ${interval}, since: ${since.toUTCString()}`,
            );
          },
        },
      });
    }

    Live.background(symbol, {
      strategyName,
      exchangeName,
    });
        
    notifyFinish();
  });
}

export default LiveMainService;
