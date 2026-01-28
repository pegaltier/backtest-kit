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
import { CC_DEFAULT_LIMIT, CC_FULLSCREEN_SIZE_REQUEST } from "../../../config/params";
import IconWrapper from "../../../components/common/IconWrapper";
import { Restore } from "@mui/icons-material";
import useOrderCloseArrayPaginator from "../../../api/useOrderCloseArrayPaginator";
import { Chip, Typography } from "@mui/material";
import actionSubject from "../config/actionSubject";

const ADMIN_PASS = "88888888";

const useStyles = makeStyles()({
    tooltip: {
        maxHeight: 175,
        overflowY: "hidden",
    },
});

const heightRequest = () => window.innerHeight - 235;

const order_close_columns: IColumn[] = [
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
        field: "originalPrice",
        headerName: "Цена покупки",
        width: (fullWidth) => Math.max((fullWidth - 530) / 4, 175),
        element: ({ originalPrice }) => (
            <Center>
                <Typography variant="body1">
                    {formatAmount(originalPrice || "0")}$
                </Typography>
            </Center>
        ),
    },
    {
        type: ColumnType.Component,
        sortable: false,
        field: "quantity",
        headerName: "Количество",
        width: (fullWidth) => Math.max((fullWidth - 530) / 4, 150),
        element: ({ quantity }) => (
            <Center>
                <Typography variant="body1">{quantity || "0"}</Typography>
            </Center>
        ),
    },
    {
        type: ColumnType.Component,
        sortable: false,
        field: "closePrice",
        headerName: "Цена продажи",
        width: (fullWidth) => Math.max((fullWidth - 530) / 4, 175),
        element: ({ closePrice }) => (
            <Center>
                <Typography variant="body1">
                    {formatAmount(closePrice || "0")}$
                </Typography>
            </Center>
        ),
    },
    {
        type: ColumnType.Component,
        sortable: false,
        field: "estimateRevenue",
        headerName: "Прибыль/Убыток",
        width: (fullWidth) => Math.max((fullWidth - 530) / 4, 140),
        element: ({ estimateRevenue }) => {
            if (estimateRevenue > 0) {
                return (
                    <Center>
                        <Chip
                            color="success"
                            sx={{ color: "white" }}
                            label={`Прибыль +${formatAmount(estimateRevenue || "0")}$`}
                        />
                    </Center>
                );
            }
            return (
                <Center>
                    <Chip
                        color="warning"
                        sx={{ color: "white" }}
                        label={`Убыток ${formatAmount(estimateRevenue || "0")}$`}
                    />
                </Center>
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
        type: ColumnType.CheckBox,
        sortable: false,
        field: "isBot",
        headerName: "Автоматически",
        width: () => 115,
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
        label: "Восстановить",
        action: "revert-action",
        icon: () => <IconWrapper icon={Restore} color="#ff9800" />,
    },
];

export const ClosedView = () => {
    const handler = useOrderCloseArrayPaginator();

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
        columns: order_close_columns,
        storageKey: "order_close_columns",
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
            prefix: "order_close",
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

    const handleRevert = async (id: string) => {
        const data = await pickPrompt().toPromise();
        if (data !== ADMIN_PASS) {
            ioc.alertService.notify("Неверный пароль");
            return;
        }
        {
            ioc.layoutService.setAppbarLoader(true);
            await sleep(2_500);
            ioc.layoutService.setAppbarLoader(false);
        }
        const confirm = await pickConfirm().toPromise();
        if (!confirm) {
            return;
        }
        await execute(id);
    };

    const handleRowAction = async (action: string, row: any) => {
        if (action === "revert-action") {
            await handleRevert(row.id);
        }
    };

    const handleClick = async (row: any) => {
        ioc.layoutService.pickOrderCloseInfo(row.id);
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

export default ClosedView;
