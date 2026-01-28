import { ActionIcon, Async, If, useActualState, useModalManager, useOutletModal } from "react-declarative";
import IconButton from "@mui/material/IconButton";
import { ArrowBack, Close, Download, Edit } from "@mui/icons-material";
import { createMemoryHistory } from "history";
import Stack from "@mui/material/Stack";
import routes from "./routes";
import { getPayload, ioc } from "../../lib";
import { CC_FULLSCREEN_SIZE_REQUEST } from "../../config/params";
import { Box, Typography } from "@mui/material";
import downloadMarkdown from "../../utils/downloadMarkdown";

const DEFAULT_PATH = "/strategy_report/main";

const history = createMemoryHistory();

export const useStrategyReportView = () => {
    const ctx = useModalManager();
    const { push, pop } = ctx;

    const [id$, setId] = useActualState("");

    const handleDownload = async () => {
        const data = await ioc.reportViewService.findOne(id$.current);
        await downloadMarkdown(data.content);
    };

    const { pickData, render } = useOutletModal({
        withActionButton: false,
        animation: "none",
        title: "Стратегия торгов",
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
                    <ActionIcon
                        sx={{
                            mr: 1,
                            display: total === 1 ? "none" : "flex",
                        }}
                        onClick={onClose}
                    >
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
            await ioc.reportViewService.findOne(id),
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

    return (id: string, route = DEFAULT_PATH) => {
        push({
            id: "strategy_report",
            render,
            onInit: () => {
                history.push(route);
            },
            onMount: () => {
                pickData(id);
                setId(id);
            },
        });
    };
};

export default useStrategyReportView;
