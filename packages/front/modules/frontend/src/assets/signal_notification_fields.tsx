import { TypedField, FieldType, dayjs, CopyButton } from "react-declarative";
import { Box, Chip } from "@mui/material";
import Markdown from "../components/common/Markdown";

/**
 * Get notification type label
 */
const getNotificationTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
        "signal.opened": "Signal Opened",
        "signal.closed": "Signal Closed",
        "signal.scheduled": "Signal Scheduled",
        "signal.cancelled": "Signal Cancelled",
    };
    return typeMap[type] || type || "Unknown";
};

/**
 * Get notification type color
 */
const getNotificationTypeColor = (type: string): "success" | "error" | "warning" | "info" | "default" => {
    const colorMap: Record<string, "success" | "error" | "warning" | "info" | "default"> = {
        "signal.opened": "success",
        "signal.closed": "info",
        "signal.scheduled": "warning",
        "signal.cancelled": "error",
    };
    return colorMap[type] || "default";
};

/**
 * Format duration from milliseconds to human readable string
 */
const formatDuration = (durationMs: number): string => {
    if (durationMs == null) return "N/A";
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(" ");
};

export const signal_notification_fields: TypedField[] = [
    {
        type: FieldType.Paper,
        transparentPaper: true,
        fieldBottomMargin: "1",
        fields: [
            // Notification Type Header
            {
                type: FieldType.Box,
                sx: { display: "grid", gridTemplateColumns: "auto 1fr auto" },
                fields: [
                    {
                        type: FieldType.Typography,
                        style: { color: "#2196f3" },
                        typoVariant: "h6",
                        placeholder: "Signal Notification",
                    },
                    {
                        type: FieldType.Div,
                    },
                    {
                        type: FieldType.Component,
                        element: ({ type }) => (
                            <Chip
                                label={getNotificationTypeLabel(type)}
                                color={getNotificationTypeColor(type)}
                                size="medium"
                            />
                        ),
                    },
                ],
            },
            // General Information
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
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
                        name: "position",
                        title: "Position",
                        readonly: true,
                        compute: (obj) => {
                            if (obj.position === "long") return "LONG";
                            if (obj.position === "short") return "SHORT";
                            return "Not specified";
                        },
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
                ],
            },
            // Timestamps
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
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
                        title: "Event Time",
                        readonly: true,
                        compute: (obj) =>
                            obj.timestamp
                                ? dayjs(obj.timestamp).format("DD/MM/YYYY HH:mm:ss")
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
                                ? dayjs(obj.createdAt).format("DD/MM/YYYY HH:mm:ss")
                                : "",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",
                        name: "scheduledAt",
                        title: "Scheduled At",
                        readonly: true,
                        isVisible: (obj) => obj.type === "signal.scheduled" && !!obj.scheduledAt,
                        compute: (obj) =>
                            obj.scheduledAt
                                ? dayjs(obj.scheduledAt).format("DD/MM/YYYY HH:mm:ss")
                                : "",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",
                        name: "duration",
                        title: "Duration",
                        readonly: true,
                        isVisible: (obj) =>
                            (obj.type === "signal.closed" || obj.type === "signal.cancelled") &&
                            obj.duration != null,
                        compute: (obj) => formatDuration(obj.duration),
                    },
                ],
            },
            // Price Levels (for opened, closed, scheduled)
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
                typoVariant: "h6",
                placeholder: "Price Levels",
                isVisible: (obj) =>
                    obj.type === "signal.opened" ||
                    obj.type === "signal.closed" ||
                    obj.type === "signal.scheduled",
            },
            {
                type: FieldType.Outline,
                sx: { mb: 3 },
                isVisible: (obj) =>
                    obj.type === "signal.opened" ||
                    obj.type === "signal.closed" ||
                    obj.type === "signal.scheduled",
                fields: [
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "priceOpen",
                        title: "Entry Price",
                        readonly: true,
                        compute: (obj) =>
                            obj.priceOpen != null
                                ? `${obj.priceOpen.toFixed(6)}$`
                                : "Not specified",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "priceTakeProfit",
                        title: "Take Profit",
                        readonly: true,
                        isVisible: (obj) => obj.type === "signal.opened" && obj.priceTakeProfit != null,
                        compute: (obj) =>
                            obj.priceTakeProfit != null
                                ? `${obj.priceTakeProfit.toFixed(6)}$`
                                : "Not specified",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "priceStopLoss",
                        title: "Stop Loss",
                        readonly: true,
                        isVisible: (obj) => obj.type === "signal.opened" && obj.priceStopLoss != null,
                        compute: (obj) =>
                            obj.priceStopLoss != null
                                ? `${obj.priceStopLoss.toFixed(6)}$`
                                : "Not specified",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "priceClose",
                        title: "Close Price",
                        readonly: true,
                        isVisible: (obj) => obj.type === "signal.closed" && obj.priceClose != null,
                        compute: (obj) =>
                            obj.priceClose != null
                                ? `${obj.priceClose.toFixed(6)}$`
                                : "Not specified",
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
                        isVisible: (obj) => obj.type === "signal.scheduled" && obj.currentPrice != null,
                        compute: (obj) =>
                            obj.currentPrice != null
                                ? `${obj.currentPrice.toFixed(6)}$`
                                : "Not specified",
                    },
                ],
            },
            // Result (for signal.closed)
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
                typoVariant: "h6",
                placeholder: "Result (PNL)",
                isVisible: (obj) => obj.type === "signal.closed" && obj.pnlPercentage != null,
            },
            {
                type: FieldType.Outline,
                sx: { mb: 3 },
                isVisible: (obj) => obj.type === "signal.closed" && obj.pnlPercentage != null,
                fields: [
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "pnlPercentage",
                        title: "PNL %",
                        readonly: true,
                        compute: (obj) => {
                            const pnl = obj.pnlPercentage;
                            if (pnl == null) return "N/A";
                            const sign = pnl >= 0 ? "+" : "";
                            return `${sign}${pnl.toFixed(2)}%`;
                        },
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "4",
                        tabletColumns: "4",
                        phoneColumns: "12",
                        name: "closeReason",
                        title: "Close Reason",
                        readonly: true,
                        isVisible: (obj) => !!obj.closeReason,
                        compute: (obj) => {
                            const reasonMap: Record<string, string> = {
                                "take_profit": "Take Profit",
                                "stop_loss": "Stop Loss",
                                "manual": "Manual Close",
                                "trailing_stop": "Trailing Stop",
                                "timeout": "Timeout",
                            };
                            return reasonMap[obj.closeReason] || obj.closeReason || "Unknown";
                        },
                    },
                ],
            },
            // Cancel Reason (for signal.cancelled)
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
                typoVariant: "h6",
                placeholder: "Cancellation Details",
                isVisible: (obj) => obj.type === "signal.cancelled",
            },
            {
                type: FieldType.Outline,
                sx: { mb: 3 },
                isVisible: (obj) => obj.type === "signal.cancelled",
                fields: [
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",
                        name: "cancelReason",
                        title: "Cancel Reason",
                        readonly: true,
                        compute: (obj) => obj.cancelReason || "Not specified",
                    },
                ],
            },
            // Note (for signal.opened)
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
                typoVariant: "h6",
                placeholder: "Note",
                isVisible: (obj) => obj.type === "signal.opened" && !!obj.note,
            },
            {
                type: FieldType.Outline,
                isVisible: (obj) => obj.type === "signal.opened" && !!obj.note,
                sx: { mb: 3 },
                child: {
                    type: FieldType.Component,
                    desktopColumns: "12",
                    tabletColumns: "12",
                    phoneColumns: "12",
                    name: "note",
                    element: ({ note }) => (
                        <Box>
                            <Markdown content={note || "No note"} />
                        </Box>
                    ),
                },
            },
            // IDs section
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
                        isVisible: (obj) => !!obj.signalId,
                        element: ({ signalId }) => (
                            <CopyButton
                                label={`Signal ID: ${signalId}`}
                                content={signalId}
                            />
                        ),
                    },
                    {
                        type: FieldType.Div,
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
                        isVisible: (obj) => obj.type === "signal.cancelled" && !!obj.cancelId,
                        element: ({ cancelId }) => (
                            <CopyButton
                                label={`Cancel ID: ${cancelId}`}
                                content={cancelId}
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

export default signal_notification_fields;
