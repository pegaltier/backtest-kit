export interface ISignal {
    id: string;
    symbol: string;
    position: string;
    profitLoss: number;
    profitLossPercentage: number;
    buyPrice: number;
    quantity: number;
    date: string;
    status: "finished";
}
