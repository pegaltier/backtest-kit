export interface TradingSignal {
    time: string;
    type: "BUY" | "SELL";
    price: number;
    reason: string;
    strength: "weak" | "medium" | "strong";
    strategy: string;
}

export interface OpenOrder {
    type: "buy" | "sell";
    quantity: string;
    price: string;
    coin: string;
    date: string;
    ignore: boolean;
    lastSellDate: string;
    lastFlushDate: string;
    tradeId?: string;
    reports: string[];
    id: string;
}

export interface PivotPoint {
    time: number;
    pivot: number;
    support1: number;
    resistance1: number;
    support2: number;
    resistance2: number;
}

export interface SignificantVolume {
    time: number;
    price: string;
    volume: string;
}

export interface VolumeData {
    pivotPoints: PivotPoint[];
    significantVolumes: SignificantVolume[];
}

export interface TradingMeasure {
    volumeData: VolumeData;
    shortRangeSignals: TradingSignal[];
    swingRangeSignals: TradingSignal[];
    longRangeSignals: TradingSignal[];
    openOrders: OpenOrder[];
    averageCost: number;
    averagePrice: number;
    frozenAmount: number;
    totalAmount: number;
    totalDeals: number;
    totalCoins: number;
    revenueAmount: number;
    revenuePercent: number;
    newestOrderDate: string | null;
    oldestOrderDate: string | null;
}
