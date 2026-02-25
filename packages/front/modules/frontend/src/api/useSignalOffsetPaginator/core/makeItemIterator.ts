import { iterateDocuments, fetchApi, randomString } from "react-declarative";
import { ISignal } from "../model/Signal.model";

const ITERATION_LIMIT = 25;

interface IInternalSignal {
    id: string;
    quantity: number;
    buyPrice: number;
    takeProfitPrice: number;
    closePrice?: number;
    ignore: boolean;
    stopLossPrice: number;
    symbol: string;
    finished: boolean;
    resolved: boolean;
    rejected: boolean;
    createDate: Date;
    updateDate: Date;
    comment: string;
    info: string;
    /** Тип позиции: LONG (прибыль при росте) или SHORT (прибыль при падении) */
    position: "long" | "short";
}

/**
 * Расчет прибыли/убытка с учетом типа позиции
 *
 * LONG: прибыль при росте цены (totalReceived - totalInvested)
 * SHORT: прибыль при падении цены (totalInvested - totalReceived)
 */
const toProfitLossInfo = (signal: IInternalSignal) => {
    const averagePrice = signal.resolved
        ? (signal.closePrice ?? signal.takeProfitPrice)
        : (signal.closePrice ?? signal.stopLossPrice);
    const totalInvested = signal.quantity * signal.buyPrice;
    const totalReceived = averagePrice * signal.quantity;

    // SHORT: прибыль при падении цены
    const profitLoss =
        signal.position === "short"
            ? totalInvested - totalReceived
            : totalReceived - totalInvested;

    const profitLossPercentage = (profitLoss / totalInvested) * 100;
    return {
        profitLoss,
        profitLossPercentage,
    };
};

const makeItemIterator = () =>
    iterateDocuments<ISignal>({
        limit: ITERATION_LIMIT,
        async createRequest({ limit, offset }): Promise<ISignal[]> {
            const { error, data } = await fetchApi("/signal/list", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("tradegpt-token")}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    requestId: randomString(),
                    serviceName: "kpi-app",
                    filterData: {
                        $or: [{ resolved: true }, { rejected: true }],
                        ignore: false,
                    },
                    pagination: {
                        limit,
                        offset,
                    },
                }),
            });

            if (error) {
                throw new Error(error);
            }

            const rows = data?.rows || [];

            return rows.map((signal: IInternalSignal): ISignal => {
                const { profitLoss, profitLossPercentage } =
                    toProfitLossInfo(signal);
                return {
                    id: signal.id,
                    buyPrice: signal.buyPrice,
                    quantity: signal.quantity,
                    symbol: signal.symbol,
                    status: "finished",
                    position: signal.position,
                    profitLoss,
                    profitLossPercentage,
                    date: new Date(signal.createDate).toISOString(),
                };
            });
        },
    });

export default makeItemIterator;
