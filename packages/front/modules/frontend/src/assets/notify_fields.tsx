import { TypedField, FieldType, dayjs } from "react-declarative";
import Markdown from "../components/common/Markdown";
import { Box } from "@mui/material";

export const notification_fields: TypedField[] = [
    {
        type: FieldType.Paper,
        transparentPaper: true,
        fieldBottomMargin: "1",
        fields: [
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
                typoVariant: "h6",
                placeholder: "Уведомление",
            },
            {
                type: FieldType.Outline,
                sx: {
                    mb: 3,
                },
                child: {
                    type: FieldType.Component,
                    desktopColumns: "12",
                    tabletColumns: "12",
                    phoneColumns: "12",
                    name: "markdown",
                    element: ({ markdown }) => (
                        <Box>
                            <Markdown content={markdown} />
                        </Box>
                    ),
                },
            },
            {
                type: FieldType.Typography,
                style: { color: "#2196f3" },
                typoVariant: "h6",
                placeholder: "Свойства",
            },
            {
                type: FieldType.Outline,
                fields: [
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
                        name: "symbol",
                        title: "Символ",
                        readonly: true,
                        compute: (obj) => obj.symbol || "Не указан",
                    },
                    {
                        type: FieldType.Text,
                        outlined: false,
                        desktopColumns: "12",
                        tabletColumns: "12",
                        phoneColumns: "12",
                        name: "notificationType",
                        title: "Тип уведомления",
                        readonly: true,
                        compute: (obj) => {
                            switch (obj.notificationType) {
                                case "buy":
                                    return "Покупка";
                                case "wait":
                                    return "Ожидание";
                                case "close":
                                    return "Продажа";
                                default:
                                    return "Не указан";
                            }
                        },
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
        ],
    },
];

export default notification_fields;
