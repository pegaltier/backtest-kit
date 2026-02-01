import { TypedField, FieldType, dayjs, CopyButton } from "react-declarative";
import { Box, Chip } from "@mui/material";

const TRAILING_PURPLE = "#673AB7";

export const trailing_fields: TypedField[] = [
    {
        type: FieldType.Paper,
        transparentPaper: true,
        fieldBottomMargin: "1",
        fields: [
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
                    {
                        type: FieldType.Component,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        element: ({ type }) => (
                            <Box sx={{ display: "flex", alignItems: "center", height: "100%", pt: 1 }}>
                                <Chip
                                    label={type === "trailing_stop.commit" ? "Trailing Stop" : "Trailing Take"}
                                    sx={{
                                        backgroundColor: TRAILING_PURPLE,
                                        color: "white",
                                        fontWeight: "bold",
                                    }}
                                />
                            </Box>
                        ),
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
                        type: FieldType.Component,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",
                        element: ({ percentShift, type }) => {
                            const isPositive = percentShift >= 0;
                            const shiftColor = isPositive ? "#4caf50" : "#f44336";
                            const arrow = isPositive ? "+" : "";
                            const label = type === "trailing_stop.commit" ? "SL Shift" : "TP Shift";
                            return (
                                <Box sx={{ p: 2 }}>
                                    <Box sx={{ color: "text.secondary", fontSize: "0.875rem", mb: 0.5 }}>
                                        {label}
                                    </Box>
                                    <Box sx={{ color: shiftColor, fontSize: "1.5rem", fontWeight: "bold" }}>
                                        {arrow}{percentShift?.toFixed(2)}%
                                    </Box>
                                    <Box sx={{ color: "text.secondary", fontSize: "0.75rem", mt: 0.5 }}>
                                        {type === "trailing_stop.commit"
                                            ? "Stop Loss level shifted"
                                            : "Take Profit level shifted"}
                                    </Box>
                                </Box>
                            );
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
            {
                type: FieldType.Box,
                sx: {
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    gap: 1,
                },
                fields: [
                    {
                        type: FieldType.Component,
                        isVisible: (obj) => !!obj.id,
                        element: ({ id }) => (
                            <CopyButton
                                label={`Trailing ID: ${id}`}
                                content={id}
                            />
                        ),
                    },
                    {
                        type: FieldType.Div,
                    },
                ],
            },
        ],
    },
];

export default trailing_fields;
