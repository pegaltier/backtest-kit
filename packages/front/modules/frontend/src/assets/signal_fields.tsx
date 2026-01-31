import { TypedField, FieldType, dayjs } from "react-declarative";
import { Box } from "@mui/material";
import Markdown from "../components/common/Markdown";

export const signal_fields: TypedField[] = [
  {
    type: FieldType.Paper,
    transparentPaper: true,
    fieldBottomMargin: "1",
    fields: [
      {
        type: FieldType.Typography,
        style: { color: "#2196f3" },
        typoVariant: "h6",
        placeholder: "Основная информация",
      },
      {
        type: FieldType.Outline,
        sx: { mb: 3 },
        fields: [
          {
            type: FieldType.Text,
            outlined: false,
            desktopColumns: "6",
            tabletColumns: "6",
            phoneColumns: "12",
            name: "symbol",
            title: "Символ",
            readonly: true,
            compute: (obj) => obj.symbol || "Не указан",
          },
          {
            type: FieldType.Text,
            outlined: false,
            desktopColumns: "6",
            tabletColumns: "6",
            phoneColumns: "12",
            name: "position",
            title: "Позиция",
            readonly: true,
            compute: (obj) => {
              if (obj.position === "long") return "LONG";
              if (obj.position === "short") return "SHORT";
              return "Не указана";
            },
          },
          {
            type: FieldType.Text,
            outlined: false,
            desktopColumns: "6",
            tabletColumns: "6",
            phoneColumns: "12",
            name: "quantity",
            title: "Количество",
            readonly: true,
            compute: (obj) => obj.quantity || "0",
          },
          {
            type: FieldType.Text,
            outlined: false,
            desktopColumns: "6",
            tabletColumns: "6",
            phoneColumns: "12",
            name: "createDate",
            title: "Дата создания",
            readonly: true,
            compute: (obj) =>
              obj.createDate ? dayjs(obj.createDate).format("DD/MM/YYYY HH:mm:ss") : "",
          },
        ],
      },
      {
        type: FieldType.Typography,
        style: { color: "#2196f3" },
        typoVariant: "h6",
        placeholder: "Ценовые уровни",
      },
      {
        type: FieldType.Outline,
        sx: { mb: 3 },
        fields: [
          {
            type: FieldType.Text,
            outlined: false,
            desktopColumns: "4",
            tabletColumns: "4",
            phoneColumns: "12",
            name: "buyPrice",
            title: "Цена покупки",
            readonly: true,
            compute: (obj) => (obj.buyPrice ? `${obj.buyPrice.toFixed(6)}$` : "Не указана"),
          },
          {
            type: FieldType.Text,
            outlined: false,
            desktopColumns: "4",
            tabletColumns: "4",
            phoneColumns: "12",
            name: "takeProfitPrice",
            title: "Take Profit",
            readonly: true,
            compute: (obj) => (obj.takeProfitPrice ? `${obj.takeProfitPrice.toFixed(6)}$` : "Не указана"),
          },
          {
            type: FieldType.Text,
            outlined: false,
            desktopColumns: "4",
            tabletColumns: "4",
            phoneColumns: "12",
            name: "stopLossPrice",
            title: "Stop Loss",
            readonly: true,
            compute: (obj) => (obj.stopLossPrice ? `${obj.stopLossPrice.toFixed(6)}$` : "Не указана"),
          },
          {
            type: FieldType.Text,
            outlined: false,
            desktopColumns: "6",
            tabletColumns: "6",
            phoneColumns: "12",
            name: "closePrice",
            title: "Цена закрытия",
            readonly: true,
            isVisible: (obj) => !!obj.closePrice,
            compute: (obj) => (obj.closePrice ? `${obj.closePrice.toFixed(6)}$` : ""),
          },
          {
            type: FieldType.Text,
            outlined: false,
            desktopColumns: "6",
            tabletColumns: "6",
            phoneColumns: "12",
            name: "estimatedMinutes",
            title: "Ожидаемое время (мин)",
            readonly: true,
            compute: (obj) => obj.estimatedMinutes?.toString() || "Не указано",
          },
        ],
      },
      {
        type: FieldType.Typography,
        style: { color: "#2196f3" },
        typoVariant: "h6",
        placeholder: "Комментарий",
      },
      {
        type: FieldType.Outline,
        sx: { mb: 3 },
        child: {
          type: FieldType.Component,
          desktopColumns: "12",
          tabletColumns: "12",
          phoneColumns: "12",
          name: "comment",
          element: ({ comment }) => (
            <Box>
              <Markdown content={comment || "Нет комментария"} />
            </Box>
          ),
        },
      },
      {
        type: FieldType.Typography,
        style: { color: "#2196f3" },
        typoVariant: "h6",
        placeholder: "Возможные риски",
        isVisible: (data) => !!data.riskNote,
      },
      {
        type: FieldType.Outline,
        isVisible: (data) => !!data.riskNote,
        sx: { mb: 3 },
        child: {
          type: FieldType.Component,
          desktopColumns: "12",
          tabletColumns: "12",
          phoneColumns: "12",
          name: "riskNote",
          element: ({ riskNote }) => (
            <Box>
              <Markdown content={riskNote || "Нет информации о рисках"} />
            </Box>
          ),
        },
      },
      {
        type: FieldType.Typography,
        style: { color: "#2196f3" },
        typoVariant: "h6",
        placeholder: "Дополнительная информация",
        isVisible: (data) => !!data.info,
      },
      {
        type: FieldType.Outline,
        isVisible: (data) => !!data.info,
        sx: { mb: 3 },
        child: {
          type: FieldType.Component,
          desktopColumns: "12",
          tabletColumns: "12",
          phoneColumns: "12",
          name: "info",
          element: ({ info }) => (
            <Box>
              <Markdown content={info} />
            </Box>
          ),
        },
      },
      {
        type: FieldType.Typography,
        style: { color: "#2196f3" },
        typoVariant: "h6",
        placeholder: "Причина закрытия",
        isVisible: (data) => !!data.closeReason,
      },
      {
        type: FieldType.Outline,
        isVisible: (data) => !!data.closeReason,
        child: {
          type: FieldType.Component,
          desktopColumns: "12",
          tabletColumns: "12",
          phoneColumns: "12",
          name: "closeReason",
          element: ({ closeReason }) => (
            <Box>
              <Markdown content={closeReason || "Нет причины"} />
            </Box>
          ),
        },
      },
    ],
  },
];

export default signal_fields;
