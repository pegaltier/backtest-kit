import { makeStyles } from "../../styles";

import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";

import StockChart from "./components/StockChart";

import IStockItem from "./model/StockItem.model";
import IDailyTrades from "../../model/DailyTrades.model";
import { useMemo } from "react";
import { fromMomentStamp } from "react-declarative";
import { SxProps } from "@mui/system";

const useStyles = makeStyles()({
  root: {},
  container: {
    position: "relative",
    margin: 0,
    padding: 0,
    overflow: "hidden",
  },
  editor: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});

interface IChartWidgetProps {
  items: IDailyTrades[];
  sx: SxProps;
}

export const ChartWidget = ({ items, sx }: IChartWidgetProps) => {
  const { classes } = useStyles();

  const stocks = useMemo((): IStockItem[] => {
    return [...items]
      .sort(({ stamp: a }, { stamp: b }) => a - b)
      .map(({ count, rejected, resolved, stamp }) => {
        const date = fromMomentStamp(stamp);
        return {
          time: {
            year: date.get("year"),
            month: date.get("month") + 1,
            day: date.get("date"),
          },
          rejected,
          resolved,
          value: count,
        };
      });
  }, [items]);

  return (
    <Paper className={classes.container} sx={sx}>
      <div className={classes.editor}>
        <StockChart items={stocks} />
      </div>
    </Paper>
  );
};

export default ChartWidget;
