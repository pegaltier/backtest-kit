import * as React from "react";
import { useRef, useState, useLayoutEffect } from "react";

import {
    DeepPartial,
    ChartOptions,
    CrosshairMode,
    LineStyle,
    Time,
    SeriesMarker,
} from "lightweight-charts";

import { createChart } from "lightweight-charts";

import IStockItem from "../model/IStockItem";

import { makeStyles } from "../../../styles";
import {
    dayjs,
    formatAmount,
    fromMomentStamp,
    getMomentStamp,
} from "react-declarative";
import { OpenOrder } from "../../../lib/model/Measure.model";
import { ioc } from "../../../lib";

interface IChartProps {
    orders: OpenOrder[];
    height: number;
    width: number;
    items: IStockItem[];
}

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
        zIndex: 9,
        color: "white",
        fontWeight: "bold",
        padding: "5px 10px",
        borderRadius: "3px",
        fontSize: "12px",
    },
});

const chartOptions: DeepPartial<ChartOptions> = {
    layout: {
        textColor: "#d1d4dc",
        backgroundColor: "#0000",
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

const MOMENT_STAMP_OFFSET = getMomentStamp();

type Ref = React.MutableRefObject<HTMLDivElement>;

export const StockChart = ({
    height,
    width,
    items,
    orders: originalOrders,
}: IChartProps) => {
    const { classes } = useStyles();

    const elementRef: Ref = useRef<HTMLDivElement>(undefined as never);

    const [tooltipDate, setTooltipDate] = useState<string | null>(null);

    useLayoutEffect(() => {
        const { current: chartElement } = elementRef;

        const orders = originalOrders.concat().reverse();

        const candles = items.map(({ close, time: originalTime }, idx) => {
            const momentStamp = MOMENT_STAMP_OFFSET + idx;
            return {
                time: fromMomentStamp(momentStamp).format("YYYY-MM-DD"),
                originalTime,
                momentStamp,
                value: close,
            };
        });

        const chart = createChart(chartElement, {
            ...chartOptions,
            width,
            height,
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    labelVisible: false,
                },
                horzLine: {
                    labelVisible: false,
                    visible: false,
                },
            },
            timeScale: {
                timeVisible: false,
                secondsVisible: false,
                tickMarkFormatter: (time: any) => {
                    let date = dayjs();
                    date = date.set("year", time.year);
                    date = date.set("month", time.month - 1);
                    date = date.set("date", time.day);
                    date = date
                        .set("hour", 0)
                        .set("minute", 0)
                        .set("second", 0)
                        .set("millisecond", 0);

                    const momentStamp = getMomentStamp(date) + 1;

                    const [firstCandle] = candles;
                    const candle =
                        candles.find(
                            (candle) => candle.momentStamp === momentStamp,
                        ) || firstCandle;

                    if (!candle) {
                        return "Invalid date";
                    }

                    return dayjs(candle.originalTime).format("HH:mm");
                },
            },
        });

        const lineSeries = chart.addLineSeries({
            lastValueVisible: false,
        });

        lineSeries.setData(candles);

        const markers = orders
            .map((order, idx): SeriesMarker<Time> => {
                // Find the closest candle by time (assuming order has a 'time' field)
                const orderTime = dayjs(order.date); // Adjust 'time' to the actual field name in OpenOrder
                const closestCandle = candles.reduce((prev, curr) => {
                    const currDiff = Math.abs(
                        dayjs(curr.originalTime).diff(orderTime),
                    );
                    const prevDiff = Math.abs(
                        dayjs(prev.originalTime).diff(orderTime),
                    );
                    return currDiff < prevDiff ? curr : prev;
                });

                if (!closestCandle) return null;

                return {
                    time: closestCandle.time as Time,
                    position: "inBar" as const,
                    color: ioc.colorHelperService.getColorByIndex(idx),
                    shape: "circle" as const,
                    size: 1,
                };
            })
            .filter((marker) => marker !== null);

        lineSeries.setMarkers(markers);

        chart.subscribeCrosshairMove((param) => {
            if (param.time) {
                const data = candles.find(
                    (d) =>
                        (d.time as string) ===
                        (param.time as unknown as string),
                );
                if (data) {
                    const dateTime = dayjs(data.originalTime).format(
                        "DD/MM/YYYY HH:mm",
                    );
                    const price = formatAmount(data.value.toFixed(6));
                    setTooltipDate(`${dateTime}: ${price}`);
                } else {
                    setTooltipDate(null);
                }
            } else {
                setTooltipDate(null);
            }
        });

        orders?.forEach((order, idx) => {
            lineSeries.createPriceLine({
                price: parseFloat(order.price),
                color: ioc.colorHelperService.getColorByIndex(idx),
                lineWidth: 2,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: true,
                title: `№${idx + 1}`,
            });
        });

        chart.timeScale().fitContent();

        return () => {
            chart.remove();
        };
    }, [height, width, items, originalOrders]);

    return (
        <div ref={elementRef} className={classes.root}>
            {tooltipDate && (
                <div className={classes.tooltip}>{tooltipDate}</div>
            )}
        </div>
    );
};

export default StockChart;
