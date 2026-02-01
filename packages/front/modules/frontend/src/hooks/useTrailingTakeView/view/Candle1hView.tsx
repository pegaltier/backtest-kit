import { Box } from "@mui/material";
import { AutoSizer, IOutletModalProps } from "react-declarative";
import StockChart from "../components/StockChart";
import { useMemo } from "react";
import { TrailingTakeCommitNotification } from "backtest-kit";

export const Candle1hView = ({ data, formState }: IOutletModalProps) => {
    const {
        currentPrice,
        percentShift,
        createdAt,
    } = useMemo(() => {
        const trailingTake = formState.data.main as TrailingTakeCommitNotification;
        return {
            currentPrice: trailingTake.currentPrice,
            percentShift: trailingTake.percentShift,
            createdAt: new Date(trailingTake.createdAt).toUTCString(),
        };
    }, [formState.data.main]);

    return (
        <Box sx={{ height: "100%", width: "100%", pt: 1 }}>
            <AutoSizer payload={data}>
                {({ height, width }) => (
                    <StockChart
                        items={data}
                        createdAt={createdAt}
                        currentPrice={currentPrice}
                        percentShift={percentShift}
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
