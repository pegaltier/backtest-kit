import { Box, Typography } from "@mui/material";
import { AutoSizer, IOutletModalProps, useAsyncValue } from "react-declarative";
import StockChart from "../../../widgets/StockChart/StockChart";
import { useMemo } from "react";
import { fetchPriceCandles } from "../api/fetchPriceCandles";

const arr = [];

export const Candle1mView = ({ data, formState }: IOutletModalProps) => {
  /*const lines = useMemo(() => {
    const { position, createDate, buyPrice } = formState.data.main;
    const priceLine = {
      buyPrice,
      date: createDate,
      position,
    };
    return [priceLine];
  }, [formState.data.main]);*/

  return (
    <Box sx={{ height: "100%", width: "100%", pt: 1 }}>
      <AutoSizer payload={data}>
        {({ height, width }) => (
          <StockChart
            items={data}
            lines={arr}
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
