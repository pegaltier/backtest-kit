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
import { generateMarkdown } from "./utils/generateMarkdown";

const DEFAULT_PATH = "/swing_range_status/main";

const history = createMemoryHistory();

export const useBalanceInfoView = () => {
    const ctx = useModalManager();
    const { push, pop } = ctx;

    const handleDownload = async () => {
        const report = await ioc.measureViewService.getTradeInfo();
        const content = generateMarkdown(report);
        await downloadMarkdown(content);
    };

    const { pickData, render } = useOutletModal({
        withActionButton: false,
        animation: "none",
        title: "Текущий баланс",
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
        fetchState: async () => [
            await ioc.measureViewService.getTradeInfo(),
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
            id: "swing_range_status",
            render,
            onInit: () => {
                history.push(route);
            },
            onMount: () => {
                pickData("swing");
            },
        });
    };
};

export default useBalanceInfoView;
