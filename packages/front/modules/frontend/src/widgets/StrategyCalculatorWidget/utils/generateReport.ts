function generateReport(fiatAmount: number, lastClosePrice: number, ladderPercent: number, orderPrice: number, priceGrowthRate = 1.5, commissionRate = 0.002): string {
  // Проверка входных данных
  if (fiatAmount <= 0 || lastClosePrice <= 0 || ladderPercent <= 0 || ladderPercent >= 100 || orderPrice <= 0 || orderPrice > fiatAmount || priceGrowthRate <= 0 || commissionRate < 0) {
    return "Ошибка: Все параметры должны быть положительными, ladderPercent должен быть меньше 100, а orderPrice не должен превышать fiatAmount.";
  }

  // Инициализация переменных
  let remainingFiat = fiatAmount;
  let totalCoins = 0;
  let totalSpent = 0; // Общая сумма затрат, включая комиссии
  let currentPrice = lastClosePrice;
  const steps: { price: number; coinsBought: number; totalCoins: number; remainingFiat: number; commission: number }[] = [];
  const ladderMultiplier = 1 - ladderPercent / 100;

  // Рассчет шагов падения цены
  while (remainingFiat >= orderPrice && currentPrice > 0) {
    const commission = orderPrice * commissionRate; // Комиссия за сделку
    const amountAfterCommission = orderPrice * (1 - commissionRate); // Сумма после вычета комиссии
    const coinsBought = amountAfterCommission / currentPrice; // Монеты, купленные после учета комиссии
    totalCoins += coinsBought;
    totalSpent += orderPrice + commission; // Учет затрат с комиссией
    remainingFiat -= orderPrice; // Уменьшаем остаток фиата на сумму ордера
    steps.push({
      price: Number(currentPrice.toFixed(2)),
      coinsBought: Number(coinsBought.toFixed(6)),
      totalCoins: Number(totalCoins.toFixed(6)),
      remainingFiat: Number(remainingFiat.toFixed(2)),
      commission: Number(commission.toFixed(2)),
    });
    currentPrice *= ladderMultiplier;
  }

  let report = "";

  // Рассчет ключевых метрик
  const breakEvenPrice = totalSpent / totalCoins; // Точка безубыточности с учетом комиссий
  const stopPrice = steps.length > 0 ? steps[steps.length - 1].price : lastClosePrice;
  const targetProfit = fiatAmount * 0.2; // Прибыль 20% от начального капитала
  const profitPrice = (totalSpent + targetProfit) / totalCoins; // Цена для достижения 20% прибыли с учетом комиссий

  // Рассчет ожидаемого времени достижения прибыли
  const dailyGrowthMultiplier = 1 + priceGrowthRate / 100;
  const daysToProfit = Math.abs(Math.ceil(Math.log(profitPrice / steps[steps.length - 1].price) / Math.log(dailyGrowthMultiplier)));

  // Формирование текстовых метрик
  report += "\n# Метрики\n\n";
  report += `- Минимальная цена выхода в 0 (Break-even price): ${breakEvenPrice.toFixed(2)} USD\n`;
  report += `- Цена остановки торгов (Stop price): ${stopPrice.toFixed(2)} USD\n`;
  report += `- Цена получения прибыли (20% от капитала): ${profitPrice.toFixed(2)} USD\n`;
  report += `- Комиссия за сделку: ${(commissionRate * 100).toFixed(1)}%\n`;

  // Формирование таблицы
  report += "\n# Наихудший сценарий\n\n";
  report += "| Цена (USD) | Куплено монет | Всего монет | Остаток фиата (USD) | Комиссия (USD) |\n";
  report += "|------------|---------------|-------------|---------------------|----------------|\n";
  steps.forEach((step) => {
    report += `| ${step.price} | ${step.coinsBought} | ${step.totalCoins} | ${step.remainingFiat} | ${step.commission} |\n`;
  });

  report += "\n# Доходность в наихудшем сценарии\n\n";
  report += `- Ожидаемое время достижения прибыли: ${daysToProfit} дней (при предполагаемом среднем росте цены на ${priceGrowthRate}% в день от ${steps[steps.length - 1].price})\n`;
  report += `- Примечание: Время достижения прибыли зависит от указанного среднего роста цены, который является предположением и не гарантирует фактических результатов на рынке.\n`;

  return report;
}

export { generateReport }