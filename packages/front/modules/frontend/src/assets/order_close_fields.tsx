import { TypedField, FieldType, formatAmount, dayjs } from "react-declarative";

export const order_close_fields: TypedField[] = [
    {
        type: FieldType.Paper,
        transparentPaper: true,
        fieldBottomMargin: "1",
        fields: [
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
                typoVariant: "h6",
                placeholder: "Детали ордера",
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
                compute: (obj) => obj.coin || "Не указана",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "quantity",
                title: "Количество",
                readonly: true,
                compute: (obj) =>
                    obj.quantity ? Number(obj.quantity).toFixed(6) : "0",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "originalPrice",
                title: "Цена ордера",
                readonly: true,
                compute: (obj) =>
                    obj.originalPrice ? formatAmount(Number(obj.originalPrice).toFixed(2)) : "0",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "closePrice",
                title: "Цена отмены",
                readonly: true,
                compute: (obj) =>
                    obj.closePrice ? formatAmount(Number(obj.closePrice).toFixed(2)) : "0",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "estimateRevenue",
                title: "Прибыль/Убыток",
                readonly: true,
                compute: (obj) =>
                    obj.estimateRevenue ? formatAmount(Number(obj.estimateRevenue).toFixed(2)) : "0",
            },
            {
                type: FieldType.Text,
                inputRows: 10,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "comment",
                title: "Комментарий",
                readonly: true,
                compute: (obj) => obj.comment || "Не указан",
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
                compute: (obj) =>
                    obj.date
                        ? dayjs(obj.date).format("DD/MM/YYYY HH:mm")
                        : "",
            },
        ],
    },
];

export default order_close_fields;
