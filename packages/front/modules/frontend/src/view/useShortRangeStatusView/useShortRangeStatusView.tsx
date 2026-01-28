import { ActionIcon, Async, If, useModalManager, useOutletModal } from "react-declarative";
import IconButton from "@mui/material/IconButton";
import { ArrowBack, Close, Download, Edit } from "@mui/icons-material";
import { createMemoryHistory } from "history";
import Stack from "@mui/material/Stack";
import routes from "./routes";
import { getPayload, ioc } from "../../lib";
import { CC_FULLSCREEN_SIZE_REQUEST } from "../../config/params";
import { Box, Typography } from "@mui/material";
import downloadMarkdown from "../../utils/downloadMarkdown";

const DEFAULT_PATH = "/short_range_status/main";

const history = createMemoryHistory();

export const useShortRangeStatusView = () => {
    const ctx = useModalManager();
    const { push, pop } = ctx;

    const handleDownload = async () => {
        const content = await ioc.revenueViewService.getShortRangeStatus();
        await downloadMarkdown(content);
    };

    const { pickData, render } = useOutletModal({
        withActionButton: false,
        animation: "none",
        title: "Индикатор EMA (краткосрочный)",
        sizeRequest: CC_FULLSCREEN_SIZE_REQUEST,
        history,
        routes,
        BeforeTitle: ({ onClose }) => {
            const { total } = useModalManager();
            return (
                <Box
                    sx={{
                        mr: 1,
                        display: total === 1 ? "none" : "flex",
                    }}
                >
                    <ActionIcon onClick={onClose}>
                        <ArrowBack />
                    </ActionIcon>
                </Box>
            );
        },
        AfterTitle: ({ onClose }) => (
            <Stack direction="row" gap={1}>
                <ActionIcon onClick={() => handleDownload()}>
                    <Download />
                </ActionIcon>
                <ActionIcon onClick={onClose}>
                    <Close />
                </ActionIcon>
            </Stack>
        ),
        fetchState: async (id) => [
            await ioc.revenueViewService.getShortRangeStatus(),
            await getPayload(),
        ],
        mapInitialData: (_, [main]) => ({
            main,
        }),
        mapPayload: (id, [_, payload]) => ({
            ...payload,
        }),
        onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
        onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        onClose: () => {
            pop();
        },
    });

    return (route = DEFAULT_PATH) => {
        push({
            id: "short_range_status",
            render,
            onInit: () => {
                history.push(route);
            },
            onMount: () => {
                pickData("short");
            },
        });
    };
};

export default useShortRangeStatusView;
