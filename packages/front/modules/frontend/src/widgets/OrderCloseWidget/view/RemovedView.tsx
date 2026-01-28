import {
    Async,
    Breadcrumbs2,
    Breadcrumbs2Type,
    Center,
    ColumnType,
    dayjs,
    formatAmount,
    IBreadcrumbs2Action,
    IBreadcrumbs2Option,
    IColumn,
    IListRowAction,
    IOutletProps,
    List,
    SelectionMode,
    sleep,
    Subject,
    TileMode,
    trycatch,
    useAlert,
    useAsyncAction,
    useColumnConfig,
    useConfirm,
    useListIntersectionListen,
    useListSelection,
    useOnce,
    usePrompt,
    useQueryPagination,
    useSubject,
} from "react-declarative";
import { makeStyles } from "../../../styles";
import { ioc } from "../../../lib";
import {
    CC_DEFAULT_LIMIT,
    CC_FULLSCREEN_SIZE_REQUEST,
} from "../../../config/params";
import IconWrapper from "../../../components/common/IconWrapper";
import { Restore } from "@mui/icons-material";
import useOrderCloseArrayPaginator from "../../../api/useOrderCloseArrayPaginator";
import { Chip, Tooltip, Typography } from "@mui/material";
import actionSubject from "../config/actionSubject";
import useOrderHideArrayPaginator from "../../../api/useOrderHideArrayPaginator";
import toPlainString from "../../../helpers/toPlainString";

const useStyles = makeStyles()({
    tooltip: {
        maxHeight: 175,
        overflowY: "hidden",
    },
});

const heightRequest = () => window.innerHeight - 235;

const order_hide_columns: IColumn[] = [
    {
        type: ColumnType.Component,
        sortable: false,
        field: "coin",
        headerName: "Монета",
        width: () => 120,
        element: ({ coin }) => (
            <Center>
                <Typography variant="body1">{coin || "Не указана"}</Typography>
            </Center>
        ),
    },
    {
        type: ColumnType.Component,
        sortable: false,
        field: "price",
        headerName: "Цена покупки",
        width: () => 175,
        element: ({ price }) => (
            <Center>
                <Typography variant="body1">
                    {formatAmount(price || "0")}
                </Typography>
            </Center>
        ),
    },
    {
        type: ColumnType.Component,
        sortable: false,
        field: "quantity",
        headerName: "Количество",
        width: () => 150,
        element: ({ quantity }) => (
            <Center>
                <Typography variant="body1">{quantity || "0"}</Typography>
            </Center>
        ),
    },
    {
        type: ColumnType.Component,
        sortable: false,
        field: "comment",
        headerName: "Комментарий",
        width: (fullWidth) => Math.max(fullWidth - 180 - 150 - 175 - 120, 250),
        element: ({ comment }) => {
            const { classes } = useStyles();
            const value = toPlainString(comment);
            return (
                <Tooltip title={value} classes={{ tooltip: classes.tooltip }}>
                    <Typography variant="body1">{value}</Typography>
                </Tooltip>
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
];

export const RemovedView = () => {
    const handler = useOrderHideArrayPaginator();

    const reloadSubject = useSubject<void>();

    const pickAlert = useAlert({
        title: "Готово",
        description: "Заказ успешно восстановлен",
    });

    const pickPrompt = usePrompt({
        title: "Пароль администратора",
        inputType: "password",
    });

    const pickConfirm = useConfirm({
        title: "Вы уверены?",
        msg: "Вы уверены, что хотите восстановить заказ? Это действие нельзя будет отменить.",
        canCancel: true,
    });

    const { execute } = useAsyncAction(
        async (id: string) => {
            await ioc.orderCloseViewService.revertCancellation(id);
            await reloadSubject.next();
            pickAlert();
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const { render, pickColumns, columns } = useColumnConfig({
        columns: order_hide_columns,
        storageKey: "order_hide_columns",
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
            prefix: "order_hide",
        },
    );

    const handleAction = async (action: string) => {
        if (action === "column-setup-action") {
            pickColumns();
        }
        if (action === "back-action") {
            ioc.routerService.push("/dashboard/admin_panel");
        }
    };

    const handleClick = async (row: any) => {
        ioc.layoutService.pickOrderInfo(row.id);
    };

    return (
        <>
            <List
                withTransparentPaper
                withMobile
                withRestorePos
                withSingleChip
                withSingleSort
                reloadSubject={reloadSubject}
                actionSubject={actionSubject}
                heightRequest={heightRequest}
                modalSizeRequest={CC_FULLSCREEN_SIZE_REQUEST}
                columns={columns}
                handler={handler}
                onRowClick={handleClick}
                onAction={handleAction}
                selectionMode={SelectionMode.Multiple}
                {...listProps}
            />
            {render()}
        </>
    );
};

export default RemovedView;
