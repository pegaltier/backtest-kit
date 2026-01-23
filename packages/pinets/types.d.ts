import { IProvider } from 'src/interface/Provider.interface';
import * as pinets from 'pinets';
import { PlotModel as PlotModel$1 } from 'src/model/Plot.model';

interface ILogger {
    log(topic: string, ...args: any[]): void;
    debug(topic: string, ...args: any[]): void;
    info(topic: string, ...args: any[]): void;
    warn(topic: string, ...args: any[]): void;
}

declare class LoggerService implements ILogger {
    private _commonLogger;
    log: (topic: string, ...args: any[]) => Promise<void>;
    debug: (topic: string, ...args: any[]) => Promise<void>;
    info: (topic: string, ...args: any[]) => Promise<void>;
    warn: (topic: string, ...args: any[]) => Promise<void>;
    setLogger: (logger: ILogger) => void;
}

declare class AxisProviderService implements IProvider {
    private readonly loggerService;
    getMarketData(_: string, timeframe: string, limit?: number, sDate?: number, eDate?: number): Promise<any[]>;
    getSymbolInfo(): Promise<any>;
}

declare class CandleProviderService implements IProvider {
    private readonly loggerService;
    getMarketData(tickerId: string, timeframe: string, limit?: number, sDate?: number, eDate?: number): Promise<any[]>;
    getSymbolInfo(tickerId: string): Promise<any>;
}

declare class PineJobService {
    readonly loggerService: LoggerService;
    readonly axisProviderService: AxisProviderService;
    readonly candleProviderService: CandleProviderService;
    run: (script: string | Function, tickerId: string, timeframe?: string, limit?: number) => Promise<pinets.Context>;
}

type PlotExtractConfig = {
    plot: string;
    barsBack?: number;
    transform?: (value: number) => any;
};
type PlotMapping<T> = {
    [K in keyof T]: string | PlotExtractConfig;
};
declare class PineDataService {
    private readonly loggerService;
    extract<T>(plots: PlotModel$1, mapping: PlotMapping<T>): T;
}

declare const pine: {
    pineDataService: PineDataService;
    pineJobService: PineJobService;
    axisProviderService: AxisProviderService;
    candleProviderService: CandleProviderService;
    loggerService: LoggerService;
};

interface CandleModel {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

type PlotData = {
    time: number;
    value: number;
};
type PlotEntry = {
    data: PlotData[];
};
type PlotModel = Record<string, PlotEntry>;

interface SymbolInfoModel {
    ticker: string;
    tickerid: string;
    description: string;
    type: string;
    basecurrency: string;
    currency: string;
    timezone: string;
}

export { type CandleModel, type PlotExtractConfig, type PlotMapping, type PlotModel, type SymbolInfoModel, pine as lib };
