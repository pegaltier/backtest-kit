import { Box } from "@mui/material";
import { AutoSizer, IOutletModalProps } from "react-declarative";
import StockChart from "../components/StockChart";
import { useMemo } from "react";
import { TrailingStopCommitNotification } from "backtest-kit";

export const Candle15mView = ({ data, formState }: IOutletModalProps) => {
    const {
        currentPrice,
        percentShift,
        createdAt,
    } = useMemo(() => {
        const trailingStop = formState.data.main as TrailingStopCommitNotification;
        return {
            currentPrice: trailingStop.currentPrice,
            percentShift: trailingStop.percentShift,
            createdAt: new Date(trailingStop.createdAt).toUTCString(),
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
                        source="15m"
                    />
                )}
            </AutoSizer>
        </Box>
    );
};

export default Candle15mView;
