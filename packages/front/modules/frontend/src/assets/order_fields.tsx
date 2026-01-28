import { TypedField, FieldType, formatAmount, dayjs } from "react-declarative";
import { OpenOrder } from "../lib/model/Measure.model";

export const order_fields: TypedField[] = [
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
                compute: (obj: OpenOrder) =>
                    obj.quantity ? Number(obj.quantity).toFixed(6) : "",
            },
            {
                type: FieldType.Text,
                outlined: false,
                desktopColumns: "12",
                tabletColumns: "12",
                phoneColumns: "12",
                name: "price",
                title: "Цена",
                readonly: true,
                compute: (obj: OpenOrder) =>
                    obj.price ? formatAmount(Number(obj.price).toFixed(2)) : "",
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
                compute: (obj: OpenOrder) =>
                    obj.date
                        ? dayjs(obj.date).format("DD/MM/YYYY HH:mm")
                        : "",
            },
        ],
    },
];

export default order_fields;
