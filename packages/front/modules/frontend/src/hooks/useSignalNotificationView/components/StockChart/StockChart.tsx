import * as React from "react";
import { useRef, useState, useLayoutEffect } from "react";
import { ICandleData } from "backtest-kit"
import {
  DeepPartial,
  ChartOptions,
  CrosshairMode,
  Time,
  LineStyle,
  SeriesMarker,
} from "lightweight-charts";
import { createChart } from "lightweight-charts";
import { makeStyles } from "../../../../styles";
import { dayjs, fromMomentStamp, getMomentStamp } from "react-declarative";
import { colors } from "@mui/material";

declare function parseFloat(value: unknown): number;

interface IChartProps {
  source: "1m" | "15m" | "1h";
  height: number;
  width: number;
  items: ICandleData[];
  position: "long" | "short";
  createdAt: string;
  priceOpen?: number;
  priceTakeProfit?: number;
  priceStopLoss?: number;
  priceClose?: number;
  notificationType: "signal.opened" | "signal.closed" | "signal.scheduled" | "signal.cancelled";
}

const COLOR_LIST = [
  colors.purple[900],
  colors.red[900],
  colors.purple[300],
  colors.yellow[900],
  colors.blue[500],
  colors.blue[900],
  colors.yellow[500],
  colors.orange[900],
  colors.cyan[500],
  colors.red[200],
];

const getColorByIndex = (index: number) => {
  return COLOR_LIST[index % COLOR_LIST.length];
};

/**
 * Get color for position based on type
 * @param position - position type (long/short)
 * @param index - fallback color index
 */
const getPositionColor = (position: "long" | "short", index: number): string => {
  if (position === "long") return colors.blue[700];
  if (position === "short") return colors.orange[700];
  return getColorByIndex(index);
};

const formatAmount = (value: number | string, scale = 2, separator = ",") => {
  const num = typeof value === "string" ? Number(value) : value;
  const str = num.toFixed(scale);
  const formatted =
    num < 10000 ? str : str.replace(/(\d)(?=(\d{3})+(\.|$))/g, `$1 `);
  return formatted.replace(/.00$/, "").replace(".", separator);
};

const useStyles = makeStyles()({
  root: {
    position: "relative",
  },
  tooltip: {
    position: "absolute",
    margin: 0,
    left: 5,
    top: 5,
    backgroundColor: "#343434",
    zIndex: 999,
    color: "white",
    fontWeight: "bold",
    padding: "5px 10px",
    borderRadius: 3,
    fontSize: "12px",
    pointerEvents: "none",
    touchAction: "none",
  },
});

const chartOptions: DeepPartial<ChartOptions> = {
  layout: {
    textColor: "#d4d4d8",
    backgroundColor: "#ffffff",
  },
  rightPriceScale: {
    scaleMargins: {
      top: 0.3,
      bottom: 0.25,
    },
  },
  crosshair: {
    vertLine: {
      width: 4,
      color: "#ebe0e301",
      style: 0,
    },
    horzLine: {
      visible: false,
      labelVisible: false,
    },
  },
  grid: {
    vertLines: {
      color: "#f8b3",
    },
    horzLines: {
      color: "#f8b3",
    },
  },
  handleScroll: {
    vertTouchDrag: false,
  },
};

// Base UTC date for MOMENT_STAMP_OFFSET
const MOMENT_STAMP_OFFSET = getMomentStamp(
  dayjs("2025-07-26T00:00:00Z"),
  "minute"
);

type Ref = React.MutableRefObject<HTMLDivElement>;

export const StockChart = ({
  source,
  height,
  width,
  items,
  position,
  createdAt,
  priceOpen,
  priceTakeProfit,
  priceStopLoss,
  priceClose,
  notificationType,
}: IChartProps) => {
  const { classes } = useStyles();
  const elementRef: Ref = useRef<HTMLDivElement>(undefined as never);
  const [tooltipDate, setTooltipDate] = useState<string | null>(null);

  useLayoutEffect(() => {
    const { current: chartElement } = elementRef;

    // Map items to chart data
    const candles = items
      .map(({ close, timestamp }, idx) => {
        let momentStamp: number;
        let time: Time;
        let date: dayjs.Dayjs;
        let formattedOriginalTime: string;

        // Check timestamp (Unix timestamp in milliseconds)
        if (timestamp && dayjs(timestamp).isValid()) {
          date = dayjs(timestamp);
          formattedOriginalTime = date.format("YYYY-MM-DD HH:mm:ss");
        } else {
          // If timestamp is invalid, use fromMomentStamp
          if (source === "1m") {
            momentStamp = MOMENT_STAMP_OFFSET + idx;
            date = fromMomentStamp(momentStamp, "minute");
          } else if (source === "15m") {
            momentStamp = MOMENT_STAMP_OFFSET + idx;
            date = fromMomentStamp(momentStamp, "minute");
            const minute = Math.floor(date.minute() / 15) * 15;
            date = date.startOf("hour").add(minute, "minute");
          } else if (source === "1h") {
            momentStamp = MOMENT_STAMP_OFFSET + Math.floor(idx / 60);
            date = fromMomentStamp(momentStamp, "hour");
            date = date.startOf("hour");
          }
          formattedOriginalTime = date.format("YYYY-MM-DD HH:mm:ss");
          console.warn(
            `Invalid timestamp at index ${idx}: ${timestamp}, using fromMomentStamp: ${formattedOriginalTime}`
          );
        }

        // Create momentStamp for valid date
        if (source === "1m") {
          momentStamp = getMomentStamp(date, "minute");
          time = momentStamp as Time;
        } else if (source === "15m") {
          const minute = Math.floor(date.minute() / 15) * 15;
          const alignedDate = date.startOf("hour").add(minute, "minute");
          momentStamp = getMomentStamp(alignedDate, "minute");
          time = momentStamp as Time;
        } else if (source === "1h") {
          const alignedDate = date.startOf("hour");
          momentStamp = getMomentStamp(alignedDate, "hour");
          time = momentStamp as Time;
        }

        if (!date.isValid()) {
          console.warn(
            `Invalid date at index ${idx}: momentStamp: ${momentStamp}`
          );
          return null;
        }

        // Debug output
        console.debug(
          `Index: ${idx}, timestamp: ${timestamp}, momentStamp: ${momentStamp}, time: ${time}, date: ${date.format("YYYY-MM-DD HH:mm:ss")}`
        );

        return {
          time,
          originalTime: formattedOriginalTime,
          momentStamp,
          value: parseFloat(close),
        };
      })
      .filter((item): item is NonNullable<typeof item> => !!item);

    if (candles.length === 0) {
      console.warn("No valid data points for chart");
      return;
    }

    const chart = createChart(chartElement, {
      ...chartOptions,
      width,
      height,
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { labelVisible: false },
        horzLine: { visible: false, labelVisible: false },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: source === "1m",
        tickMarkFormatter: (time: Time) => {
          // Find candle by momentStamp
          const candle =
            candles.find((c) => c.momentStamp === Number(time)) || candles[0];
          if (!candle || !candle.originalTime) {
            return "Invalid date";
          }
          const date = dayjs(candle.originalTime);
          if (!date.isValid()) {
            return "Invalid date";
          }
          if (source === "1m") {
            return date.format("HH:mm:ss");
          } else if (source === "15m") {
            return date.format("HH:mm");
          } else {
            return date.format("DD/MM HH:mm");
          }
        },
      },
    });

    const lineSeries = chart.addLineSeries({
      lastValueVisible: false,
    });

    lineSeries.setData(candles);

    // Price lines for position
    const positionLabel = position === "long" ? "LONG" : "SHORT";
    const positionColor = getPositionColor(position, 0);

    // Entry price line (for opened, closed, scheduled)
    if (priceOpen != null) {
      lineSeries.createPriceLine({
        price: priceOpen,
        color: positionColor,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `${positionLabel} Entry`,
      });
    }

    // Stop Loss line (for opened)
    if (priceStopLoss != null && notificationType === "signal.opened") {
      lineSeries.createPriceLine({
        price: priceStopLoss,
        color: colors.red[500],
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "SL",
      });
    }

    // Take Profit line (for opened)
    if (priceTakeProfit != null && notificationType === "signal.opened") {
      lineSeries.createPriceLine({
        price: priceTakeProfit,
        color: colors.green[500],
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "TP",
      });
    }

    // Close price line (for closed)
    if (priceClose != null && notificationType === "signal.closed") {
      lineSeries.createPriceLine({
        price: priceClose,
        color: colors.grey[500],
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: "Close",
      });
    }

    // Markers for entry point
    const markers: SeriesMarker<Time>[] = [];

    // Entry marker (createdAt)
    const entryDate = dayjs(createdAt);
    if (entryDate.isValid()) {
      let entryTime: Time;
      if (source === "1m") {
        entryTime = getMomentStamp(entryDate, "minute") as Time;
      } else if (source === "15m") {
        const minute = Math.floor(entryDate.minute() / 15) * 15;
        const alignedDate = entryDate.startOf("hour").add(minute, "minute");
        entryTime = getMomentStamp(alignedDate, "minute") as Time;
      } else {
        const alignedDate = entryDate.startOf("hour");
        entryTime = getMomentStamp(alignedDate, "hour") as Time;
      }

      // Marker shape and text based on notification type
      let markerShape: SeriesMarker<Time>["shape"] = "circle";
      let markerText = "Event";
      let markerColor = positionColor;

      if (notificationType === "signal.opened") {
        markerShape = position === "short" ? "arrowDown" : "arrowUp";
        markerText = "Opened";
      } else if (notificationType === "signal.closed") {
        markerShape = "circle";
        markerText = "Closed";
        markerColor = colors.grey[500];
      } else if (notificationType === "signal.scheduled") {
        markerShape = "square";
        markerText = "Scheduled";
        markerColor = colors.yellow[700];
      } else if (notificationType === "signal.cancelled") {
        markerShape = "circle";
        markerText = "Cancelled";
        markerColor = colors.red[500];
      }

      markers.push({
        time: entryTime,
        position: position === "short" ? "aboveBar" : "belowBar",
        color: markerColor,
        shape: markerShape,
        size: 1,
        text: markerText,
      });
    }

    // Markers must be sorted by time for lightweight-charts
    markers.sort((a, b) => Number(a.time) - Number(b.time));
    lineSeries.setMarkers(markers);

    chart.subscribeCrosshairMove((param) => {
      if (param.time) {
        const data = candles.find((d) => d.momentStamp === Number(param.time));
        if (data) {
          const dateFormat =
            source === "1m" ? "DD/MM/YYYY HH:mm:ss" : "DD/MM/YYYY HH:mm";
          const dateTime = dayjs(data.originalTime).format(dateFormat);
          const price = formatAmount(data.value.toFixed(6));
          setTooltipDate(`${dateTime}: ${price}`);
        } else {
          setTooltipDate(null);
        }
      } else {
        setTooltipDate(null);
      }
    });

    chart.timeScale().fitContent();

    return () => {
      chart.remove();
    };
  }, [source, height, width, items, position, createdAt, priceOpen, priceTakeProfit, priceStopLoss, priceClose, notificationType]);

  return (
    <div ref={elementRef} className={classes.root}>
      {tooltipDate && <div className={classes.tooltip}>{tooltipDate}</div>}
    </div>
  );
};

export default StockChart;
