import {
    ActionIcon,
    datetime,
    dayjs,
    FieldType,
    formatAmount,
    Grid,
    GridView,
    IGridAction,
    IGridColumn,
    ScrollView,
    SelectionMode,
    sleep,
    TypedField,
    typo,
    useAlert,
    useAsyncAction,
    useConfirm,
    useElementSize,
    useOne,
    usePrompt,
} from "react-declarative";
import { OpenOrder } from "../../lib/model/Measure.model";
import { Box, Divider, Paper, Typography } from "@mui/material";
import { ioc } from "../../lib";
import { useMemo } from "react";
import {
    Circle,
    Close,
    Delete,
    Download,
    Edit,
    Flag,
} from "@mui/icons-material";
import downloadMarkdown from "../../utils/downloadMarkdown";
import IconWrapper from "../../components/common/IconWrapper";
import { defaultSlots } from "../../components/OneSlotFactory";
import order_create_fields from "../../assets/order_create_fields";

const ADMIN_PASS = "88888888";

interface IOrderGridWidgetProps {
    orders: OpenOrder[];
}

interface GridItem extends OpenOrder {
    idx: number;
    color?: never;
}

const columns: IGridColumn<GridItem>[] = [
    {
        field: "color",
        label: typo.nbsp,
        minWidth: 45,
        width: () => 45,
        format: ({ idx }) => (
            <Circle
                sx={{
                    color: ioc.colorHelperService.getColorByIndex(idx),
                }}
            />
        ),
    },
    {
        field: "idx",
        label: "№",
        minWidth: 55,
        width: () => 55,
        format: ({ idx }) => `${idx + 1}`,
    },
    {
        field: "coin",
        label: "Цена",
        minWidth: 115,
        width: (fullWidth) => Math.max(fullWidth - 45 - 55 - 125 - 145, 115),
        format: ({ price }) => `${formatAmount(price)}$`,
    },
    {
        field: "quantity",
        label: "Количество",
        minWidth: 125,
        width: () => 125,
        format: ({ quantity }) => Number(quantity).toFixed(6),
    },
    {
        field: "date",
        label: "Дата",
        minWidth: 145,
        width: () => 145,
        format: ({ date }) => dayjs(date).format("DD/MM/YYYY HH:mm"),
    },
];

const row_actions: IGridAction[] = [
    {
        action: "edit-action",
        label: "Редактировать сделку",
        icon: () => <IconWrapper icon={Edit} color="#ff9800" />,
    },
    {
        action: "close-action",
        label: "Закрыть сделку",
        icon: () => <IconWrapper icon={Flag} color="#d500f9" />,
    },
    {
        divider: true,
    },
    {
        action: "remove-action",
        label: "Удалить сделку",
        icon: () => <IconWrapper icon={Delete} color="#ff4569" />,
    },
];

const close_fields: TypedField[] = [
    {
        type: FieldType.Layout,
        customLayout: ({ children }) => {
            const { size, elementRef } = useElementSize({
                closest: ".MuiDialogContent-root",
                compute: (size) => ({
                    width: size.width,
                    height: size.height - 85,
                }),
            });
            return (
                <Box
                    ref={elementRef}
                    sx={{
                        overflow: "hidden",
                        overflowY: "auto",
                        maxHeight: size.height,
                        width: "100%",
                    }}
                >
                    {children}
                </Box>
            );
        },
        fields: [
            {
                type: FieldType.Text,
                sx: {
                    cursor: "pointer",
                },
                dirty: true,
                name: "currentPrice",
                fieldBottomMargin: "3",
                inputPattern: "[0-9\.]*",
                inputMode: "decimal",
                inputType: "tel",
                trailingIcon: Close,
                isIncorrect: ({ currentPrice, price, quantity }) => {
                    if (!price) {
                        return null;
                    }
                    if (!currentPrice) {
                        return null;
                    }
                    if (!quantity) {
                        return null;
                    }
                    const estimateRevenue =
                        (parseFloat(currentPrice) - parseFloat(price)) *
                        parseFloat(quantity);
                    if (Math.sign(estimateRevenue) === -1) {
                        return "Убыток";
                    }
                    return null;
                },
                trailingIconClick: (v, {}, {}, onValueChange) => {
                    onValueChange("");
                },
                validation: {
                    required: true,
                },
                title: "Цена продажи",
                placeholder: "000000.00",
                inputFormatterSymbol: "0",
                inputFormatterAllowed: /[0-9]/,
                defaultValue: (payload) => payload.closePrice || "100000.00",
            },
            {
                type: FieldType.Text,
                sx: {
                    cursor: "not-allowed",
                    "& *": {
                        pointerEvents: "none",
                    },
                },
                outlined: true,
                name: "estimateLoss",
                title: "Прибыль/убыток",
                placeholder: "BTCUSDT",
                compute: ({ currentPrice, price, quantity }) => {
                    if (!price) {
                        return "Цена покупки не указана";
                    }
                    if (!currentPrice) {
                        return "Текущая цена не указана";
                    }
                    if (!quantity) {
                        return "Количество не указано";
                    }
                    const estimateRevenue =
                        (parseFloat(currentPrice) - parseFloat(price)) *
                        parseFloat(quantity);
                    return `${Math.sign(estimateRevenue) === 1 ? "Заработано +" : "Потеряно "}${estimateRevenue.toFixed(2)}$`;
                },
            },
            {
                type: FieldType.Text,
                sx: {
                    cursor: "not-allowed",
                    opacity: 0.5,
                    "& *": {
                        pointerEvents: "none",
                    },
                },
                outlined: true,
                readonly: true,
                name: "price",
                title: "Цена покупки",
                placeholder: "BTCUSDT",
            },
            {
                type: FieldType.Text,
                sx: {
                    cursor: "not-allowed",
                    opacity: 0.5,
                    "& *": {
                        pointerEvents: "none",
                    },
                },
                outlined: true,
                name: "quantity",
                readonly: true,
                title: "Количество",
                placeholder: "BTCUSDT",
            },
            {
                type: FieldType.Text,
                inputRows: 5,
                sx: {
                    cursor: "pointer",
                },
                name: "comment",
                validation: {
                    required: true,
                },
                title: "Комментарий",
                placeholder: "Причина отмены. Обязательно к заполнению",
            },
        ],
    },
];

export const OrderGridWidget = ({ orders }: IOrderGridWidgetProps) => {
    const pickPrompt = usePrompt({
        title: "Пароль администратора",
        inputType: "password",
    });

    const pickAlert = useAlert({
        title: "Статус отмены",
        large: true,
    });

    const pickOne = useOne({
        title: "Закрытие сделки",
        fields: close_fields,
        slots: defaultSlots,
        large: true,
        canCancel: true,
    });

    const pickEdit = useOne({
        title: "Редактирование сделки",
        fields: order_create_fields,
        large: true,
        slots: defaultSlots,
    });

    const pickConfirm = useConfirm({
        title: "Вы уверены?",
        msg: "Удаленную сделку восстановить нельзя! Продолжить?",
        canCancel: true,
    });

    const items = useMemo(() => {
        return orders
            .concat()
            .reverse()
            .map((order, idx) => ({ ...order, idx }));
    }, [orders]);

    const { execute: executeClose } = useAsyncAction(
        async (dto: {
            coin: string;
            orderId: string;
            closePrice: string;
            comment: string;
        }) => {
            const { isValid, message } =
                await ioc.actionViewService.commitClose(
                    dto.coin,
                    dto.orderId,
                    dto.closePrice,
                    dto.comment,
                );
            pickAlert({
                title: isValid
                    ? "Заказ отменен успешно"
                    : "Ошибка отмены заказа",
                description: message,
            }).then(() => sleep(1_000).then(ioc.layoutService.reloadOutlet));
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const { execute: executeEdit } = useAsyncAction(
        async (dto: {
            id: string;
            comment: string;
            price: string;
            quantity: string;
            timestamp: number;
        }) => {
            const { id, ...other } = dto;
            await ioc.actionViewService.commitEdit(id, other);
            pickAlert({
                title: "Сделка изменена",
                description: "Изменения применены успешно",
            }).then(() => sleep(1_000).then(ioc.layoutService.reloadOutlet));
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const { execute: executeRemove } = useAsyncAction(
        async (orderId: string) => {
            await ioc.actionViewService.commitRemove(orderId);
            pickAlert({
                title: "Сделка удалена",
                description: "Для восстановления обратитесь к администратору",
            }).then(() => sleep(1_000).then(ioc.layoutService.reloadOutlet));
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const { execute: fetchPrice } = useAsyncAction(
        async () => await ioc.revenueViewService.getLastClosePrice(),
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const { execute: fetchOrder } = useAsyncAction(
        async (orderId: string) => await ioc.orderViewService.findOne(orderId),
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const closeOrder = async (dto: {
        coin: string;
        orderId: string;
        closePrice: string;
        comment: string;
    }) => {
        const data = await pickPrompt().toPromise();
        if (data === ADMIN_PASS) {
            await executeClose(dto);
            return;
        }
        ioc.alertService.notify("Неверный пароль");
    };

    const handleRemove = async (orderId: string) => {
        const confirm = await pickConfirm().toPromise();
        if (!confirm) {
            return;
        }
        const data = await pickPrompt().toPromise();
        if (data === ADMIN_PASS) {
            await executeRemove(orderId);
            return;
        }
        ioc.alertService.notify("Неверный пароль");
    };

    const handleClose = async (
        orderId: string,
        coin: string,
        price: string,
        quantity: string,
    ) => {
        const closePrice = await fetchPrice();
        const data = await pickOne({
            handler: () => ({
                quantity,
                price,
            }),
            payload: () => ({
                closePrice,
            }),
        }).toPromise();
        if (!data) {
            return;
        }
        {
            ioc.layoutService.setAppbarLoader(true);
            await sleep(2_500);
            ioc.layoutService.setAppbarLoader(false);
        }
        await closeOrder({
            coin,
            orderId,
            closePrice: data.currentPrice,
            comment: data.comment || "",
        });
    };

    const handleEdit = async (id: string) => {
        const pass = await pickPrompt().toPromise();
        if (pass !== ADMIN_PASS) {
            ioc.alertService.notify("Неверный пароль");
            return;
        }
        const order = await fetchOrder(id);
        const currentPrice = await fetchPrice();
        const data = await pickEdit({
            handler: async () => {
                const date = dayjs(order.date);
                return {
                    price: order.price,
                    quantity: order.quantity,
                    comment: order.comment,
                    date: date.format("DD/MM/YYYY"),
                    time: date.format("HH:mm"),
                    currentPrice: currentPrice,
                };
            },
        }).toPromise();
        if (!data) {
            return;
        }
        const momentstamp = datetime.parseDate(data.date);
        const timestamp = datetime.parseTime(data.time);

        let date = dayjs();
        date = date.set("year", momentstamp.year);
        date = date.set("month", momentstamp.month - 1);
        date = date.set("date", momentstamp.day);
        date = date
            .set("hour", timestamp.hour)
            .set("minute", timestamp.minute)
            .set("second", 0)
            .set("millisecond", 0);

        await executeEdit({
            id,
            price: data.price,
            quantity: data.quantity,
            comment: data.comment,
            timestamp: date.toDate().getTime(),
        });
    };

    const handleRowClick = (row: OpenOrder) => {
        ioc.layoutService.pickOrderInfo(row.id);
    };

    const handleRowAction = (action: string, row: any) => {
        if (action === "close-action") {
            handleClose(row.id, row.coin, row.price, row.quantity);
        }
        if (action === "remove-action") {
            handleRemove(row.id);
        }
        if (action === "edit-action") {
            handleEdit(row.id);
        }
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
                    background: "#ff669a",
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
                    Цена заказов
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
            <Grid
                sx={{ flex: 1, background: "transparent !important" }}
                data={items}
                columns={columns}
                rowActions={row_actions}
                onRowClick={handleRowClick}
                onRowAction={handleRowAction}
            />
        </Paper>
    );
};

export default OrderGridWidget;
