import { dayjs, formatAmount } from "react-declarative";

interface OrderClose {
  coin: string;
  orderId: string;
  quantity: string;
  originalPrice: string;
  closePrice: string;
  ignore: boolean;
  estimateRevenue: string;
  date: string;
  comment: string;
  reports: string[];
}

export const generateOrderCloseReport = (order: OrderClose): string => {
  let markdown = "";

  markdown += "# Отчет по отмененному ордеру\n\n";
  markdown += "## Детали ордера\n\n";

  markdown += `- **Монета**: ${order.coin || "Не указана"}\n`;
  markdown += `- **Количество**: ${order.quantity ? Number(order.quantity).toFixed(6) : "0"}\n`;
  markdown += `- **Цена ордера**: ${order.originalPrice ? `${formatAmount(Number(order.originalPrice).toFixed(2))}$` : "0"}\n`;
  markdown += `- **Цена отмены**: ${order.closePrice ? `${formatAmount(Number(order.closePrice).toFixed(2))}$` : "0"}\n`;
  markdown += `- **Ожидаемая прибыль**: ${order.estimateRevenue ? `${formatAmount(Number(order.estimateRevenue).toFixed(2))}$` : "0"}\n`;
  markdown += `- **Дата**: ${order.date ? dayjs(order.date).format("DD/MM/YYYY HH:mm") : "Не указана"}\n`;
  markdown += `- **Комментарий**: ${order.comment || "Не указан"}\n`;

  return markdown;
};
