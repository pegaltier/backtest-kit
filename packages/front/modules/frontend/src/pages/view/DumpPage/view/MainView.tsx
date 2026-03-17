import {
    Article,
    DataObject,
    Folder,
    Image,
    InsertDriveFile,
    Refresh,
} from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";
import {
    Breadcrumbs2,
    Breadcrumbs2Type,
    Center,
    IBreadcrumbs2Action,
    IBreadcrumbs2Option,
    RECORD_NEVER_VALUE,
    RecordView,
    ScrollView,
    useActualValue,
    useAsyncValue,
    useReloadTrigger,
} from "react-declarative";
import { set } from "lodash";
import { useMemo } from "react";
import ioc from "../../../../lib";
import IconWrapper from "../../../../components/common/IconWrapper";
import {
    ExplorerData,
    ExplorerFile,
    ExplorerMap,
    ExplorerNode,
    ExplorerRecord,
} from "../../../../model/Explorer.model";

const options: IBreadcrumbs2Option[] = [
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: "Main",
    },
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: "File Explorer",
    },
];

const actions: IBreadcrumbs2Action[] = [
    {
        action: "update-now",
        label: "Refresh",
        icon: () => <IconWrapper icon={Refresh} color="#4caf50" />,
    },
];

const getFileIcon = (node: ExplorerFile) => {
    if (node.mimeType.startsWith("image/")) {
        return <Image sx={{ color: "#f57c00", fontSize: 20 }} />;
    }
    if (node.mimeType === "application/json") {
        return <DataObject sx={{ color: "#7b1fa2", fontSize: 20 }} />;
    }
    if (node.mimeType.startsWith("text/")) {
        return <Article sx={{ color: "#1976d2", fontSize: 20 }} />;
    }
    return <InsertDriveFile sx={{ color: "#546e7a", fontSize: 20 }} />;
};

export const MainView = () => {
    const { reloadTrigger, doReload } = useReloadTrigger();

    const [data, { loading }] = useAsyncValue(
        async () => {
            return await ioc.explorerViewService.getFolderTree();
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
            deps: [reloadTrigger],
        },
    );

    const data$ = useActualValue<ExplorerData>(data!);

    const handleAction = (action: string) => {
        if (action === "back-action") {
            ioc.routerService.push("/");
        }
        if (action === "update-now") {
            doReload();
        }
    };

    const renderInner = () => {
        if (loading || !data) {
            return (
                <Center>
                    <Typography variant="h6" sx={{ opacity: 0.5 }}>
                        Loading...
                    </Typography>
                </Center>
            );
        }

        return (
            <RecordView
                key={reloadTrigger}
                withExpandRoot
                sx={{
                    background: (theme) => theme.palette.background.default,
                    minHeight: "300px",
                }}
                formatSearch={(key) => {
                    const node = data$.current.map[key];
                    if (!node) {
                        return "";
                    }
                    return `${node.label}`;
                }}
                formatKey={(key) => {
                    const node = data$.current.map[key];
                    if (!node) {
                        return null;
                    }
                    return (
                        <Stack direction="row" alignItems="center" gap={1}>
                            {node.type === "directory" && (
                                <Folder
                                    sx={{ color: "#1976d2", fontSize: 20 }}
                                />
                            )}
                            <Typography>{node ? node.label : key}</Typography>
                            <Box sx={{ flex: 1 }} />
                        </Stack>
                    );
                }}
                EmptyItem={() => <span>No files</span>}
                CustomItem={({ itemKey }) => {
                    const node = data$.current.map[itemKey];
                    if (!node) {
                        return null;
                    }
                    if (node.type !== "file") {
                        return null;
                    }
                    return (
                        <Stack
                            direction="row"
                            alignItems="center"
                            gap={1}
                            mb={0.5}
                        >
                            {getFileIcon(node)}
                            <Stack>
                                <Typography variant="body2">
                                    {node.label}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{ opacity: 0.5 }}
                                >
                                    {node.mimeType}
                                </Typography>
                            </Stack>
                            <Box sx={{ flex: 1 }} />
                        </Stack>
                    );
                }}
                data={data.record}
                keyWidth={3}
                valueWidth={9}
            />
        );
    };

    return (
        <>
            <Breadcrumbs2
                items={options}
                actions={actions}
                onAction={handleAction}
            />
            <ScrollView hideOverflowX sx={{ height: "calc(100vh - 140px)" }}>
                {renderInner()}
            </ScrollView>
        </>
    );
};

export default MainView;
