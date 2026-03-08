import { Box, Chip, Paper, SxProps, Typography } from "@mui/material";
import StatusModel from "../../model/Status.model";
import { makeStyles } from "../../styles";
import { AutoSizer, formatAmount } from "react-declarative";
import { Bar } from "react-chartjs-2";

const HEADER_HEIGHT = "35px";

const useStyles = makeStyles()((theme) => ({
    root: {
        position: "relative",
        height: "100%",
        width: "100%",
        background: "#eee",
        overflow: "hidden",
    },
    header: {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: "8px",
        paddingRight: "4px",
        height: HEADER_HEIGHT,
    },
    text: {
        opacity: 0.5,
        padding: 0,
        margin: 0,
        height: HEADER_HEIGHT,
        display: "flex",
        alignItems: "center",
    },
    title: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
    },
    icon: {
        opacity: 0.5,
        transition: "opacity 500ms",
        "&:hover": {
            opacity: 1.0,
        },
    },
    container: {
        position: "absolute",
        top: HEADER_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        height: `calc(100% - ${HEADER_HEIGHT})`,
        padding: 5,
        width: "100%",
        background: "white",
        overflow: "hidden",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
    },
    content: {
        display: "flex",
        flex: 1,
    },
}));

interface IAveragingWidgetProps {
    className?: string;
    style?: React.CSSProperties;
    sx?: SxProps;
    data: StatusModel;
}

export const AveragingWidget = ({
    className,
    style,
    sx,
    data,
}: IAveragingWidgetProps) => {
    const { classes, cx } = useStyles();

    const renderInner = () => {
        if (!data.positionEntries.length) {
            return (
                <Box sx={{ p: 1, color: "text.secondary" }}>
                    <Typography variant="body2">No entries</Typography>
                </Box>
            );
        }

        const isLong = data.position === "long";

        // Final effective avg = harmonic mean of ALL entries
        const allTotalCost = data.positionEntries.reduce((s, e) => s + e.cost, 0);
        const allTotalCoins = data.positionEntries.reduce((s, e) => s + e.cost / e.price, 0);
        const finalAvg = allTotalCoins === 0 ? 0 : allTotalCost / allTotalCoins;
        const finalDelta = ((finalAvg - data.originalPriceOpen) / data.originalPriceOpen) * 100;
        const isFavorable = isLong ? finalDelta <= 0 : finalDelta >= 0;

        const barColor = isLong ? "rgba(33, 150, 243, 0.7)" : "rgba(255, 152, 0, 0.7)";
        const barBorder = isLong ? "rgba(33, 150, 243, 1)" : "rgba(255, 152, 0, 1)";

        const chartData = {
            labels: data.positionEntries.map((_, i) => `#${i + 1}`),
            datasets: [
                {
                    label: "Price",
                    data: data.positionEntries.map((e) => e.price),
                    backgroundColor: barColor,
                    borderColor: barBorder,
                    borderWidth: 1,
                },
            ],
        };

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false as const,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    title: { display: true, text: "Price ($)" },
                },
            },
        };

        return (
            <Box sx={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                    <AutoSizer>
                        {({ height, width }) => (
                            <div style={{ height, width }}>
                                <Bar data={chartData} options={chartOptions} />
                            </div>
                        )}
                    </AutoSizer>
                </Box>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        px: 1,
                        py: 0.5,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        flexShrink: 0,
                    }}
                >
                    <Typography variant="caption" color="text.secondary">
                        Eff.Avg
                    </Typography>
                    <Typography variant="body2" fontWeight="medium">
                        {formatAmount(finalAvg)}$
                    </Typography>
                    <Typography
                        variant="body2"
                        fontWeight="medium"
                        sx={{ color: isFavorable ? "success.main" : "error.main" }}
                    >
                        {finalDelta >= 0 ? "+" : ""}
                        {finalDelta.toFixed(2)}%
                    </Typography>
                </Box>
            </Box>
        );
    };

    return (
        <Paper className={cx(classes.root, className)} style={style} sx={sx}>
            <div className={classes.header}>
                <div className={classes.title}>
                    <Typography className={classes.text} variant="body1">
                        Dollar Cost Averaging
                    </Typography>
                    <Chip
                        size="small"
                        variant="outlined"
                        color="info"
                        label="DCA"
                    />
                </div>
            </div>
            <div className={classes.container}>
                <div className={classes.content}>{renderInner()}</div>
            </div>
        </Paper>
    );
};

export default AveragingWidget;
