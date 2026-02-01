import { Box } from "@mui/material";
import { AutoSizer, IOutletModalProps } from "react-declarative";
import StockChart from "../components/StockChart/StockChart";
import { useMemo } from "react";
import { PartialProfitAvailableNotification, PartialProfitCommitNotification } from "backtest-kit";

type PartialProfitNotification = PartialProfitAvailableNotification | PartialProfitCommitNotification;

export const Candle1hView = ({ data, formState }: IOutletModalProps) => {
    const {
        position,
        priceOpen,
        currentPrice,
        createdAt,
    } = useMemo(() => {
        const main = formState.data.main as PartialProfitNotification;
        const isAvailable = main.type === "partial_profit.available";

        return {
            position: isAvailable ? (main as PartialProfitAvailableNotification).position : "long" as const,
            priceOpen: isAvailable ? (main as PartialProfitAvailableNotification).priceOpen : main.currentPrice,
            currentPrice: main.currentPrice,
            createdAt: new Date(main.createdAt).toUTCString(),
        };
    }, [formState.data.main]);

    return (
        <Box sx={{ height: "100%", width: "100%", pt: 1 }}>
            <AutoSizer payload={data}>
                {({ height, width }) => (
                    <StockChart
                        items={data}
                        createdAt={createdAt}
                        position={position}
                        priceOpen={priceOpen}
                        currentPrice={currentPrice}
                        height={height}
                        width={width}
                        source="1h"
                    />
                )}
            </AutoSizer>
        </Box>
    );
};

export default Candle1hView;
