import { dayjs } from "react-declarative";
import { TradingMeasure } from "../../../lib/model/Measure.model";

export const generateMarkdown = (data: TradingMeasure): string => {
    let markdown = "";

    {
        markdown += "# Детали баланса\n\n";

        // coin
        {
            markdown += `**Монета:** BTC\n`;
        }

        // symbol
        {
            markdown += `**Символ:** BTCUSDT\n`;
        }

        // averagePrice
        if (data.averagePrice) {
            const formattedValue = Number(data.averagePrice).toFixed(2);
            markdown += `**Текущая цена:** ${formattedValue}\n`;
        }
    }

    {
        markdown += "# Сводка\n\n";

        // openOrders
        if (data.openOrders && Array.isArray(data.openOrders)) {
            const formattedValue = String(data.openOrders.length);
            markdown += `**Всего покупок:** ${formattedValue}\n`;
        }

        // averageCost
        if (data.averageCost) {
            const formattedValue = Number(data.averageCost).toFixed(2);
            markdown += `**Средняя стоимость:** ${formattedValue}\n`;
        }

        // totalCoins
        if (data.totalCoins) {
            const formattedValue = Number(data.totalCoins).toFixed(6);
            markdown += `**Общее количество:** ${formattedValue}\n`;
        }

        // totalAmount
        if (data.totalAmount) {
            const formattedValue = `${Number(data.totalAmount).toFixed(2)}$`;
            markdown += `**Вложено:** ${formattedValue}\n`;
        }

        // frozenAmount
        if (data.frozenAmount) {
            const formattedValue = `${+data.frozenAmount >= 0 ? "+" : ""}${Number(data.frozenAmount).toFixed(2)}$`;
            markdown += `**Прибыль/Убыток:** ${formattedValue}\n`;
        }

        // frozenAmount
        if (data.revenuePercent) {
            const formattedValue = `${+data.revenuePercent >= 0 ? "+" : ""}${Number(data.revenuePercent).toFixed(2)}%`;
            markdown += `**Прибыль/Убыток (%):** ${formattedValue}\n`;
        }

        // date
        {
            const formattedValue = dayjs().format("DD/MM/YYYY HH:mm Z")
            markdown += `**Дата:** ${formattedValue}\n`;
        }
    }

    return markdown.trim();
};
