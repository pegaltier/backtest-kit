import { Box, Divider, Paper, Typography } from "@mui/material";
import {
    ActionIcon,
    AutoSizer,
    LoaderView,
    sleep,
    useAsyncValue,
} from "react-declarative";
import dayjs from "dayjs";
import { ioc } from "../../lib";
import StockChart from "./components/StockChart";
import { OpenOrder } from "../../lib/model/Measure.model";
import downloadMarkdown from "../../utils/downloadMarkdown";
import { Download } from "@mui/icons-material";

const LOADER_SIZE = 56;

interface IOrderChartWidgetProps {
    orders: OpenOrder[];
}

export const OrderChartWidget = ({
    orders,
}: IOrderChartWidgetProps) => {
    const [candles, { loading }] = useAsyncValue(
        async () => {
            const oldestDate = orders.reduce((oldest, current) => {
                const currentDate = dayjs(current.date);
                return !oldest || currentDate.isBefore(oldest.date) ? current : oldest;
              }, null);
            const fromDate = dayjs(oldestDate?.date || undefined)
                .subtract(1, "day")
                .toDate()
                .toUTCString();
            const toDate = dayjs().toDate().toUTCString();
            return await ioc.candleViewService.getChartCandles(
                fromDate,
                toDate,
            );
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
            deps: [orders],
        },
    );

    const renderInner = () => {
        if (!candles || loading) {
            return (
                <LoaderView
                    size={LOADER_SIZE}
                    sx={{
                        flex: 1,
                    }}
                />
            );
        }
        return (
            <Box
                sx={{
                    position: "relative",
                    flex: 1,
                }}
            >
                <AutoSizer style={{ position: "absolute" }} payload={candles}>
                    {({ height, width, payload }) => (
                        <StockChart
                            height={height}
                            width={width}
                            items={payload}
                            orders={orders}
                        />
                    )}
                </AutoSizer>
            </Box>
        );
    };

    return (
        <Paper
            sx={{
                display: "flex",
                alignItems: "stretch",
                justifyContent: "stretch",
                flexDirection: "column",
                background: "whitesmote",
                overflow: "hidden",
            }}
        >
            <Box
                sx={{
                    background: "#1de9b6",
                    minHeight: "60px",
                    display: "flex",
                    alignItems: "center",

                    pl: 1,
                }}
            >
                <Typography
                    variant="h5"
                    sx={{ color: "white", fontWeight: "bold" }}
                >
                    График торгов
                </Typography>
                <Box flex={1} />
                <ActionIcon
                    sx={{
                        mr: 1,
                    }}
                    onClick={async () => {
                        const content =
                            await ioc.reportViewService.getHistoryReport();
                        await downloadMarkdown(content);
                    }}
                >
                    <Download sx={{ color: "white" }} />
                </ActionIcon>
            </Box>
            <Divider />
            {renderInner()}
        </Paper>
    );
};

export default OrderChartWidget;
