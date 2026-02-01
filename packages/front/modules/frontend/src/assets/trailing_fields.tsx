import { TypedField, FieldType, dayjs, CopyButton } from "react-declarative";
import { Box, Chip } from "@mui/material";

const TRAILING_PURPLE = "#673AB7";

const getTypeLabel = (type: string): string => {
    if (type === "trailing_stop.commit") return "Trailing Stop";
    if (type === "trailing_take.commit") return "Trailing Take";
    return type || "Unknown";
};

export const trailing_fields: TypedField[] = [
    {
        type: FieldType.Paper,
        transparentPaper: true,
        fieldBottomMargin: "1",
        fields: [
            {
                type: FieldType.Box,
                sx: { display: "grid", gridTemplateColumns: "auto 1fr auto" },
                fields: [
                    {
                        type: FieldType.Typography,
                        style: { color: TRAILING_PURPLE },
                        typoVariant: "h6",
                        placeholder: "Trailing",
                    },
                    {
                        type: FieldType.Div,
                    },
                    {
                        type: FieldType.Component,
                        element: ({ type }) => (
                            <Chip
                                label={getTypeLabel(type)}
                                sx={{ backgroundColor: TRAILING_PURPLE, color: "white" }}
                                size="medium"
                            />
                        ),
                    },
                ],
            },
            {
                type: FieldType.Typography,
                style: { color: TRAILING_PURPLE },
                typoVariant: "h6",
                placeholder: "General Information",
            },
            {
                type: FieldType.Outline,
                sx: { mb: 3 },
                fields: [
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "symbol",
                        title: "Symbol",
                        readonly: true,
                        compute: (obj) => obj.symbol || "Not specified",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "exchangeName",
                        title: "Exchange",
                        readonly: true,
                        compute: (obj) => obj.exchangeName || "Not specified",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "strategyName",
                        title: "Strategy",
                        readonly: true,
                        compute: (obj) => obj.strategyName || "Not specified",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "backtest",
                        title: "Mode",
                        readonly: true,
                        compute: (obj) => (obj.backtest ? "Backtest" : "Live"),
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "currentPrice",
                        title: "Current Price",
                        readonly: true,
                        compute: (obj) =>
                            obj.currentPrice != null
                                ? `${obj.currentPrice.toFixed(6)}$`
                                : "Not specified",
                    },
                ],
            },
            {
                type: FieldType.Typography,
                style: { color: TRAILING_PURPLE },
                typoVariant: "h6",
                placeholder: "Trailing Details",
            },
            {
                type: FieldType.Outline,
                sx: { mb: 3 },
                fields: [
                    {
                        type: FieldType.Text,
                        name: "percentShift",
                        title: "Percent shift",
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",
                        compute: ({ percentShift, type }) => {
                            const isPositive = percentShift >= 0;
                            const arrow = isPositive ? "+" : "";
                            const label = type === "trailing_stop.commit" ? "SL Shift" : "TP Shift";
                            return `${label} ${arrow}${percentShift?.toFixed(2)}%`;
                        },
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",
                        name: "currentPrice",
                        title: "Price at Commit",
                        readonly: true,
                        compute: (obj) =>
                            obj.currentPrice != null
                                ? `${obj.currentPrice.toFixed(6)}$`
                                : "Not specified",
                    },
                ],
            },
            {
                type: FieldType.Typography,
                style: { color: TRAILING_PURPLE },
                typoVariant: "h6",
                placeholder: "Timestamps",
            },
            {
                type: FieldType.Outline,
                sx: { mb: 3 },
                fields: [
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",
                        name: "timestamp",
                        title: "Committed At",
                        readonly: true,
                        compute: (obj) =>
                            obj.timestamp
                                ? dayjs(obj.timestamp).format(
                                      "DD/MM/YYYY HH:mm:ss",
                                  )
                                : "",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",
                        name: "createdAt",
                        title: "Created",
                        readonly: true,
                        compute: (obj) =>
                            obj.createdAt
                                ? dayjs(obj.createdAt).format(
                                      "DD/MM/YYYY HH:mm:ss",
                                  )
                                : "",
                    },
                ],
            },
        ],
    },
];

export default trailing_fields;
