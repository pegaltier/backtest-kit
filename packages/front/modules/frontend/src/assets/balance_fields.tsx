import { TypedField, FieldType, formatAmount, dayjs } from "react-declarative";

export const balance_fields: TypedField[] = [
    {
        type: FieldType.Paper,
        transparentPaper: true,
        fieldBottomMargin: "1",
        fields: [
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
                typoVariant: "h6",
                placeholder: "Детали баланса",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "coin",
                title: "Монета",
                readonly: true,
                compute: () => "BTC", // Fallback since no direct field
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "symbol",
                title: "Символ",
                readonly: true,
                compute: () => "BTCUSDT", // Fallback since no direct field
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "averagePrice",
                title: "Текущая цена",
                readonly: true,
                compute: (obj) =>
                    obj.averagePrice
                        ? formatAmount(Number(obj.averagePrice).toFixed(2))
                        : "",
            },
        ],
    },
    {
        type: FieldType.Paper,
        transparentPaper: true,
        fieldBottomMargin: "1",
        fields: [
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
                typoVariant: "h6",
                placeholder: "Сводка",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "openOrders",
                title: "Всего покупок",
                readonly: true,
                isVisible: (obj) => obj.openOrders !== undefined,
                compute: (obj) => String(obj.openOrders?.length ?? 0),
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "averageCost",
                title: "Средняя стоимость",
                readonly: true,
                isVisible: (obj) => !!obj.averageCost,
                compute: (obj) =>
                    obj.averageCost
                        ? formatAmount(Number(obj.averageCost).toFixed(2))
                        : "",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "totalCoins",
                title: "Общее количество",
                readonly: true,
                isVisible: (obj) => !!obj.totalCoins,
                compute: (obj) =>
                    obj.totalCoins ? Number(obj.totalCoins).toFixed(6) : "",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "totalAmount",
                title: "Вложено",
                readonly: true,
                isVisible: (obj) => !!obj.totalAmount,
                compute: (obj) =>
                    obj.totalAmount
                        ? `${formatAmount(Number(obj.totalAmount).toFixed(2))}$`
                        : "",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "frozenAmount",
                title: "Прибыль/Убыток",
                readonly: true,
                isVisible: (obj) => obj.frozenAmount !== undefined,
                compute: (obj) =>
                    obj.frozenAmount !== undefined
                        ? `${obj.frozenAmount >= 0 ? "+" : ""}${formatAmount(Number(obj.frozenAmount).toFixed(2))}$`
                        : "",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "revenuePercent",
                title: "Прибыль/Убыток (%)",
                readonly: true,
                isVisible: (obj) => obj.revenuePercent !== undefined,
                compute: (obj) =>
                    obj.revenuePercent !== undefined
                        ? `${obj.revenuePercent >= 0 ? "+" : ""}${formatAmount(Number(obj.revenuePercent).toFixed(2))}%`
                        : "",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "date",
                title: "Дата",
                readonly: true,
                compute: () => dayjs().format("DD/MM/YYYY HH:mm Z")
            },
        ],
    },
];

export default balance_fields;
