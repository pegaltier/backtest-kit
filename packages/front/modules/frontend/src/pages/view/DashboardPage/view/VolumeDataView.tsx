import {
    Async,
    Breadcrumbs2,
    Breadcrumbs2Type,
    Center,
    ColumnType,
    dayjs,
    IBreadcrumbs2Action,
    IBreadcrumbs2Option,
    IColumn,
    IListRowAction,
    IOutletProps,
    List,
    SelectionMode,
    Subject,
    TileMode,
    trycatch,
    useAsyncAction,
    useColumnConfig,
    useListIntersectionListen,
    useListSelection,
    useOnce,
    useQueryPagination,
    useSubject,
} from "react-declarative";
import {
    CC_DEFAULT_LIMIT,
    CC_FULLSCREEN_SIZE_REQUEST,
} from "../../../../config/params";
import { ioc } from "../../../../lib";
import useLongRangeArrayPaginator from "../../../../api/useLongRangeArrayPaginator";
import toPlainString from "../../../../helpers/toPlainString";
import { Chip, Tooltip, Typography } from "@mui/material";
import IconWrapper from "../../../../components/common/IconWrapper";
import { ArrowForward, KeyboardArrowLeft, Refresh, Settings } from "@mui/icons-material";
import useWebSearchView from "../../../../view/useWebSearchView";
import { makeStyles } from "../../../../styles";
import useVolumeDataArrayPaginator from "../../../../api/useVolumeDataArrayPaginator";

const useStyles = makeStyles()({
    tooltip: {
        maxHeight: 175,
        overflowY: "hidden",
    },
});

const heightRequest = () => window.innerHeight - 165;

const actionSubject = new Subject<string>();

const actions: IBreadcrumbs2Action[] = [
    {
        action: "update-now",
        label: "Обновить",
        icon: () => <IconWrapper icon={Refresh} color="#4caf50" />,
    },
    {
        action: "column-setup-action",
        label: "Настроить колонки",
        icon: () => <IconWrapper icon={Settings} color="#4caf50" />,
    },
];

const options: IBreadcrumbs2Option[] = [
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: <KeyboardArrowLeft sx={{ display: "block" }} />,
    },
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: "Дэшборд",
    },
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: "Объём торгов (SMA)",
    },
];

const news_volume_data_columns: IColumn[] = [
    {
        type: ColumnType.Component,
        sortable: false,
        field: "content",
        headerName: "Содержание",
        width: (fullWidth) => Math.max(fullWidth - 180 - 180 - 115, 400),
        element: ({ content }) => {
            const { classes } = useStyles();
            const value = toPlainString(content);
            return (
                <Tooltip title={value} classes={{ tooltip: classes.tooltip }}>
                    <Typography variant="body1">{value}</Typography>
                </Tooltip>
            );
        },
    },
    {
        type: ColumnType.Component,
        sortable: false,
        field: "status",
        headerName: "Статус",
        width: () => 180,
        element: ({ id, orderId }) => {
            const isVisible = useListIntersectionListen(id);
            return (
                <Async payload={orderId} disabled={!isVisible}>
                    {async (orderId) => {
                        if (!orderId) {
                            return (
                                <Center>
                                    <Typography variant="body1">
                                        Не указан
                                    </Typography>
                                </Center>
                            );
                        }

                        const order = await trycatch(
                            ioc.orderViewService.findOne,
                        )(orderId);

                        if (!order || !!order?.hide) {
                            return (
                                <Center>
                                    <Typography variant="body1">
                                        Не указан
                                    </Typography>
                                </Center>
                            );
                        }

                        const close = await trycatch(
                            ioc.orderCloseViewService.findOne,
                        )(order.orderCloseId);

                        if (!close) {
                            return (
                                <Center>
                                    <Chip color="default" label="В процессе" />
                                </Center>
                            );
                        }

                        const getLabel = () => {
                            if (close.estimateRevenue > 0) {
                                return `Заработано +${close.estimateRevenue}$`;
                            }
                            return `Потеряно +${close.estimateRevenue}$`;
                        };

                        const getColor = () => {
                            if (close.estimateRevenue > 0) {
                                return "success" as const;
                            }
                            return "warning" as const;
                        };

                        const color = getColor();
                        const label = getLabel();

                        return (
                            <Center>
                                <Chip
                                    color={color}
                                    label={label}
                                    sx={{
                                        color: "white",
                                    }}
                                />
                            </Center>
                        );
                    }}
                </Async>
            );
        },
    },
    {
        type: ColumnType.Compute,
        sortable: false,
        field: "date",
        headerName: "Дата",
        width: () => 180,
        compute: ({ date }) => dayjs(date).format("DD.MM.YYYY HH:mm"),
    },
    {
        type: ColumnType.Action,
        headerName: "Действие",
        sortable: false,
        width: () => 115,
    },
];

const row_actions: IListRowAction[] = [
    {
        label: "Показать статус",
        action: "show-status",
        icon: () => <IconWrapper icon={ArrowForward} color="#4caf50" />,
    },
];

export const VolumeDataView = () => {
    const handler = useVolumeDataArrayPaginator();

    const { render, pickColumns, columns } = useColumnConfig({
        columns: news_volume_data_columns,
        storageKey: "news_volume_data_columns",
    });

    const { listProps } = useQueryPagination(
        {
            limit: CC_DEFAULT_LIMIT,
            ...ioc.routerService.locationState,
        },
        {
            fallback: ioc.errorService.handleGlobalError,
            noCleanupOnLeave: true,
            noCleanupExtra: true,
            prefix: "news_volume_data",
        },
    );

    const handleAction = async (action: string) => {
        if (action === "column-setup-action") {
            pickColumns();
        }
        if (action === "back-action") {
            ioc.routerService.push("/dashboard");
        }
    };

    const handleRowAction = async (action: string, row: any) => {
        if (action === "show-status") {
            row.orderId && ioc.layoutService.pickOrderInfo(row.orderId);
        }
    };

    const handleClick = async (row: any) => {
        if (row.orderId) {
            ioc.layoutService.pickOrderInfo(row.orderId);
            return;
        }
        ioc.layoutService.pickVolumeData(row.id);
    };

    return (
        <>
            <Breadcrumbs2
                items={options}
                actions={actions}
                onAction={actionSubject.next}
            />
            <List
                withMobile
                withRestorePos
                withSingleChip
                withSingleSort
                rowActions={row_actions}
                actionSubject={actionSubject}
                heightRequest={heightRequest}
                modalSizeRequest={CC_FULLSCREEN_SIZE_REQUEST}
                columns={columns}
                handler={handler}
                onRowClick={handleClick}
                onAction={handleAction}
                onRowAction={handleRowAction}
                selectionMode={SelectionMode.Multiple}
                {...listProps}
            />
            {render()}
        </>
    );
};

export default VolumeDataView;
