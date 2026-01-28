import { Close } from "@mui/icons-material";
import { Box } from "@mui/material";
import { TypedField, FieldType, dayjs, formatAmount, useElementSize } from "react-declarative";

export const order_create_fields: TypedField[] = [
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
                name: "price",
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
                title: "Цена Bitcoin",
                placeholder: "000000.00",
                inputFormatterSymbol: "0",
                inputFormatterAllowed: /[0-9.]/,
                defaultValue: "100000",
            },
            {
                type: FieldType.Text,
                name: "quantity",
                inputPattern: "[0-9\.]*",
                inputMode: "numeric",
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
                title: "Количество покупки",
                inputFormatterSymbol: "0",
                placeholder: "0.00000",
                inputFormatterAllowed: /[0-9\.]/,
                defaultValue: "0.00095",
            },
            {
                type: FieldType.Text,
                outlined: true,
                sx: {
                    cursor: "not-allowed",
                    "& *": {
                        pointerEvents: "none",
                    },
                },
                name: "estimateLoss",
                title: "Прибыль/убыток",
                placeholder: "BTCUSDT",
                compute: ({ price, quantity, currentPrice }) => {
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
                outlined: true,
                sx: {
                    cursor: "not-allowed",
                    opacity: 0.5,
                    "& *": {
                        pointerEvents: "none",
                    },
                },
                name: "estimateFreeze",
                title: "Стоимость заказа",
                placeholder: "BTCUSDT",
                compute: ({ quantity, price }) => {
                    if (!price) {
                        return "Текущая цена не указана";
                    }
                    if (!quantity) {
                        return "Количество не указано";
                    }
                    return `${formatAmount(quantity * price)}$`;
                },
            },
            {
                type: FieldType.Text,
                outlined: true,
                readonly: true,
                sx: {
                    cursor: "not-allowed",
                    opacity: 0.5,
                    "& *": {
                        pointerEvents: "none",
                    },
                },
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "currentPrice",
                title: "Текущая цена",
                placeholder: "100000",
            },
            {
                type: FieldType.Date,
                validation: {
                    required: true,
                },
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "date",
                title: "Дата",
            },
            {
                type: FieldType.Time,
                validation: {
                    required: true,
                },
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "time",
                title: "Время",
            },
            {
                type: FieldType.Text,
                inputRows: 5,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "comment",
                title: "Комментарий",
                defaultValue: "",
                placeholder: "Введите комментарий",
            },
        ],
    },
];

export default order_create_fields;
