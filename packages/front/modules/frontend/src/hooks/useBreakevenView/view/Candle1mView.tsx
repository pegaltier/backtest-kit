import { Box } from "@mui/material";
import { AutoSizer, IOutletModalProps } from "react-declarative";
import StockChart from "../components/StockChart/StockChart";
import { useMemo } from "react";
import { BreakevenAvailableNotification, BreakevenCommitNotification } from "backtest-kit";

type BreakevenNotification = BreakevenAvailableNotification | BreakevenCommitNotification;

export const Candle1mView = ({ data, formState }: IOutletModalProps) => {
    const {
        position,
        priceOpen,
        currentPrice,
        createdAt,
    } = useMemo(() => {
        const main = formState.data.main as BreakevenNotification;

        // BreakevenAvailableNotification has position and priceOpen
        // BreakevenCommitNotification does not
        const isAvailable = main.type === "breakeven.available";

        return {
            position: isAvailable ? (main as BreakevenAvailableNotification).position : "long" as const,
            priceOpen: isAvailable ? (main as BreakevenAvailableNotification).priceOpen : main.currentPrice,
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
                        source="1m"
                    />
                )}
            </AutoSizer>
        </Box>
    );
};

export default Candle1mView;
