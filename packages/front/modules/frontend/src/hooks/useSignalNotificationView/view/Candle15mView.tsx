import { Box } from "@mui/material";
import { AutoSizer, IOutletModalProps } from "react-declarative";
import StockChart from "../components/StockChart/StockChart";
import { useMemo } from "react";
import {
    SignalOpenedNotification,
    SignalClosedNotification,
    SignalScheduledNotification,
    SignalCancelledNotification,
} from "backtest-kit";

type SignalNotification =
    | SignalOpenedNotification
    | SignalClosedNotification
    | SignalScheduledNotification
    | SignalCancelledNotification;

export const Candle15mView = ({ data, formState }: IOutletModalProps) => {
    const chartProps = useMemo(() => {
        const notification = formState.data.main as SignalNotification;
        const { position, createdAt, type } = notification;

        // Extract prices based on notification type
        let priceOpen: number | undefined;
        let priceTakeProfit: number | undefined;
        let priceStopLoss: number | undefined;
        let priceClose: number | undefined;

        if (type === "signal.opened") {
            const n = notification as SignalOpenedNotification;
            priceOpen = n.priceOpen;
            priceTakeProfit = n.priceTakeProfit;
            priceStopLoss = n.priceStopLoss;
        } else if (type === "signal.closed") {
            const n = notification as SignalClosedNotification;
            priceOpen = n.priceOpen;
            priceClose = n.priceClose;
        } else if (type === "signal.scheduled") {
            const n = notification as SignalScheduledNotification;
            priceOpen = n.priceOpen;
        }

        return {
            position,
            priceOpen,
            priceTakeProfit,
            priceStopLoss,
            priceClose,
            createdAt: new Date(createdAt).toISOString(),
            notificationType: type,
        };
    }, [formState.data.main]);

    return (
        <Box sx={{ height: "100%", width: "100%", pt: 1 }}>
            <AutoSizer payload={data}>
                {({ height, width }) => (
                    <StockChart
                        items={data}
                        createdAt={chartProps.createdAt}
                        position={chartProps.position}
                        priceOpen={chartProps.priceOpen}
                        priceTakeProfit={chartProps.priceTakeProfit}
                        priceStopLoss={chartProps.priceStopLoss}
                        priceClose={chartProps.priceClose}
                        notificationType={chartProps.notificationType}
                        height={height}
                        width={width}
                        source="15m"
                    />
                )}
            </AutoSizer>
        </Box>
    );
};

export default Candle15mView;
