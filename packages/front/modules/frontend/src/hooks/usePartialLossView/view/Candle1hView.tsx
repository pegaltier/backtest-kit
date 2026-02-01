import { Box } from "@mui/material";
import { AutoSizer, IOutletModalProps } from "react-declarative";
import StockChart from "../components/StockChart/StockChart";
import { useMemo } from "react";
import { PartialLossAvailableNotification } from "backtest-kit";

export const Candle1hView = ({ data, formState }: IOutletModalProps) => {
    const {
        position,
        priceOpen,
        currentPrice,
        level,
        createdAt,
    } = useMemo(() => {
        const main = formState.data.main as PartialLossAvailableNotification;
        return {
            position: main.position,
            priceOpen: main.priceOpen,
            currentPrice: main.currentPrice,
            level: main.level,
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
                        level={level}
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
