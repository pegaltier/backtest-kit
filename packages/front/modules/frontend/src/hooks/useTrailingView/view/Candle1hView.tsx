import { Box } from "@mui/material";
import { AutoSizer, IOutletModalProps } from "react-declarative";
import TrailingChart from "../components/TrailingChart/TrailingChart";
import { useMemo } from "react";
import { TrailingStopCommitNotification, TrailingTakeCommitNotification } from "backtest-kit";

type TrailingNotification = TrailingStopCommitNotification | TrailingTakeCommitNotification;

export const Candle1hView = ({ data, formState }: IOutletModalProps) => {
    const {
        currentPrice,
        percentShift,
        trailingType,
        createdAt,
    } = useMemo(() => {
        const trailing = formState.data.main as TrailingNotification;
        return {
            currentPrice: trailing.currentPrice,
            percentShift: trailing.percentShift,
            trailingType: trailing.type as "trailing_stop.commit" | "trailing_take.commit",
            createdAt: new Date(trailing.createdAt).toUTCString(),
        };
    }, [formState.data.main]);

    return (
        <Box sx={{ height: "100%", width: "100%", pt: 1 }}>
            <AutoSizer payload={data}>
                {({ height, width }) => (
                    <TrailingChart
                        items={data}
                        createdAt={createdAt}
                        currentPrice={currentPrice}
                        percentShift={percentShift}
                        trailingType={trailingType}
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
