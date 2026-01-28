import { Paper } from "@mui/material";
import { FieldType, formatAmount, TypedField } from "react-declarative";
import SingleValueWidget from "../widgets/SingleValueWidget";
import BackgroundColor from "../widgets/SingleValueWidget/model/BackgroundColor";
import { BackgroundMode } from "../widgets/SingleValueWidget/model/BackgroundMode";
import { ioc } from "../lib";
import {
    SignificantVolume,
    TradingMeasure,
    TradingSignal,
    VolumeData,
} from "../lib/model/Measure.model";
import wordForm from "../utils/wordForm";
import OrderGridWidget from "../widgets/OrderGridWidget";
import OrderCalendarWidget from "../widgets/OrderCalendarWidget";
import OrderChartWidget from "../widgets/OrderChartWidget";

const CC_CELL_PADDING = "7px";

// Функция для вычисления SMA
function calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) {
        console.log(
            `Недостаточно данных для SMA с периодом ${period}: ${prices.length} элементов`,
        );
        return 0;
    }
    const sum = prices.slice(-period).reduce((acc, val) => acc + val, 0);
    return sum / period;
}

// Функция для динамического вычисления периодов SMA
function calculateDynamicPeriods(dataLength: number): {
    shortPeriod: number;
    longPeriod: number;
} {
    const minShortPeriod = 3;
    const maxShortPeriod = 10;
    const longPeriodMultiplier = 2;

    let shortPeriod = Math.round(dataLength * 0.15);
    shortPeriod = Math.max(
        minShortPeriod,
        Math.min(maxShortPeriod, shortPeriod),
    );
    let longPeriod = Math.min(
        Math.round(shortPeriod * longPeriodMultiplier),
        dataLength,
    );
    longPeriod = Math.max(minShortPeriod, Math.min(longPeriod, dataLength));

    console.log(
        `Динамические периоды: shortPeriod=${shortPeriod}, longPeriod=${longPeriod}, dataLength=${dataLength}`,
    );

    return { shortPeriod, longPeriod };
}

// Функция для получения цвета индикатора SMA
function getSMAColor(result: VolumeData | null): BackgroundColor {
    if (
        !result ||
        !result.significantVolumes ||
        result.significantVolumes.length < 3
    ) {
        console.log(
            `Недостаточно данных в significantVolumes: ${result?.significantVolumes?.length || 0} элементов, требуется минимум 3`,
        );
        return BackgroundColor.Red; // Недостаточно данных
    }

    // Получаем цены закрытия из significantVolumes
    const closes = result.significantVolumes.map((level: SignificantVolume) =>
        parseFloat(level.price),
    );

    // Вычисляем динамические периоды
    const { shortPeriod, longPeriod } = calculateDynamicPeriods(closes.length);

    // Проверяем, достаточно ли данных для длинного периода
    if (closes.length < longPeriod) {
        console.log(
            `Недостаточно данных для longPeriod: ${closes.length} элементов, требуется ${longPeriod}`,
        );
        return BackgroundColor.Red;
    }

    // Вычисляем короткую и длинную SMA
    const shortSMA = calculateSMA(closes, shortPeriod);
    const longSMA = calculateSMA(closes, longPeriod);

    // Проверяем, достаточно ли данных
    if (shortSMA === 0 || longSMA === 0) {
        console.log(
            `SMA не рассчитаны: shortSMA=${shortSMA}, longSMA=${longSMA}`,
        );
        return BackgroundColor.Red; // Недостаточно данных для SMA
    }

    // Рассчитываем предыдущие значения SMA для анализа тренда
    const prevCloses = closes.slice(0, -1);
    const prevShortSMA = calculateSMA(prevCloses, shortPeriod);
    const prevLongSMA = calculateSMA(prevCloses, longPeriod);

    // Вычисляем наклон короткой SMA
    const shortSMASlope = shortSMA - prevShortSMA;

    // Логика определения тренда
    const isBullish = shortSMA > longSMA && prevShortSMA <= prevLongSMA; // Кроссовер вверх
    const isBearish = shortSMA < longSMA && prevShortSMA >= prevLongSMA; // Кроссовер вниз
    const isGoldenCross =
        shortSMA > longSMA && shortSMA - longSMA > 0.002 * longSMA; // Золотой крест (понижен порог до 0.2%)
    const isDeathCross =
        shortSMA < longSMA && longSMA - shortSMA > 0.002 * longSMA; // Крест смерти (понижен порог до 0.2%)
    const isBullishSlope = shortSMASlope > 0.001 * shortSMA; // Положительный наклон короткой SMA
    const isBearishSlope = shortSMASlope < -0.001 * shortSMA; // Отрицательный наклон короткой SMA

    // Диагностика
    console.log(
        `SMA: short=${shortSMA.toFixed(2)}, long=${longSMA.toFixed(2)}, prevShort=${prevShortSMA.toFixed(2)}, prevLong=${prevLongSMA.toFixed(2)}`,
    );
    console.log(`Наклон короткой SMA: ${shortSMASlope.toFixed(2)}`);
    console.log(
        `Тренд: isBullish=${isBullish}, isBearish=${isBearish}, isGoldenCross=${isGoldenCross}, isDeathCross=${isDeathCross}, isBullishSlope=${isBullishSlope}, isBearishSlope=${isBearishSlope}`,
    );

    // Логика выбора цвета
    if (isGoldenCross || isBullish || isBullishSlope) {
        return BackgroundColor.Green; // Бычий тренд
    } else if (isDeathCross || isBearish || isBearishSlope) {
        return BackgroundColor.Red; // Медвежий тренд
    } else {
        return BackgroundColor.Orange; // Нейтральная ситуация
    }
}

// Функция для получения значения SMA (период фиксирован на 5)
function getSMAValue(result: VolumeData | null): number {
    const period = 5; // Фиксированный период
    if (
        !result ||
        !result.significantVolumes ||
        result.significantVolumes.length < period
    ) {
        console.log(
            `Недостаточно данных для SMA с периодом ${period}: ${result?.significantVolumes?.length || 0} элементов`,
        );
        return 0; // Недостаточно данных
    }

    // Получаем цены закрытия из significantVolumes
    const closes = result.significantVolumes.map((level: SignificantVolume) =>
        parseFloat(level.price),
    );

    // Вычисляем SMA
    const sma = calculateSMA(closes, period);
    console.log(`SMA(${period}) = ${sma.toFixed(2)}`);
    return sma;
}

const getMacdColor = (signals: TradingSignal[]) => {
    if (!signals || signals.length === 0) {
        return BackgroundColor.Red; // Нет сигналов — не запускаем
    }

    // Подсчет сигналов по типу и силе
    let buyStrongCount = 0;
    let buyMediumCount = 0;
    let buyWeakCount = 0;
    let sellStrongCount = 0;
    let sellMediumCount = 0;
    let sellWeakCount = 0;

    for (const signal of signals) {
        if (signal.type === "BUY") {
            if (
                signal.strength === "strong" &&
                (signal.strategy === "signal_line_crossover" ||
                    signal.strategy === "bullish_divergence")
            ) {
                buyStrongCount++;
            } else if (
                signal.strength === "medium" &&
                signal.strategy === "zero_line_crossover"
            ) {
                buyMediumCount++;
            } else if (
                signal.strength === "weak" &&
                signal.strategy === "histogram_momentum"
            ) {
                buyWeakCount++;
            }
        } else if (signal.type === "SELL") {
            if (
                signal.strength === "strong" &&
                signal.strategy === "signal_line_crossover"
            ) {
                sellStrongCount++;
            } else if (
                signal.strength === "medium" &&
                signal.strategy === "zero_line_crossover"
            ) {
                sellMediumCount++;
            } else if (signal.strength === "weak") {
                sellWeakCount++;
            }
        }
    }

    // Условие для валидных сигналов BUY
    const hasValidBuySignals =
        buyStrongCount >= 1 || (buyMediumCount >= 1 && buyWeakCount >= 2);

    // Вес сигналов: strong = 3, medium = 2, weak = 1
    const buyStrength =
        buyStrongCount * 3 + buyMediumCount * 2 + buyWeakCount * 1;
    const sellStrength =
        sellStrongCount * 3 + sellMediumCount * 2 + sellWeakCount * 1;

    // Логика выбора цвета
    if (!hasValidBuySignals) {
        return BackgroundColor.Red; // Нет валидных сигналов BUY
    }

    if (buyStrength > sellStrength) {
        return BackgroundColor.Green; // Сила BUY больше — запуск бота
    } else if (buyStrength < sellStrength) {
        return BackgroundColor.Red; // Сила SELL больше — не запускаем
    } else {
        return BackgroundColor.Orange; // Силы равны — неоднозначная ситуация
    }
};

const getEmaColor = (signals: TradingSignal[]) => {
    // Проверяем, есть ли сигналы
    if (!signals || signals.length === 0) {
        return BackgroundColor.Red; // Нет сигналов — не запускаем
    }

    // Подсчет сигналов по типу и силе
    let buyStrongCount = 0;
    let buyMediumCount = 0;
    let buyWeakCount = 0;
    let sellStrongCount = 0;
    let sellMediumCount = 0;
    let sellWeakCount = 0;

    for (const signal of signals) {
        if (signal.type === "BUY") {
            if (
                signal.strength === "strong" &&
                signal.strategy === "golden_cross"
            ) {
                buyStrongCount++;
            } else if (
                signal.strength === "medium" &&
                signal.strategy === "bullish_trend"
            ) {
                buyMediumCount++;
            } else if (signal.strength === "weak") {
                buyWeakCount++;
            }
        } else if (signal.type === "SELL") {
            if (
                signal.strength === "strong" &&
                signal.strategy === "death_cross"
            ) {
                sellStrongCount++;
            } else if (
                signal.strength === "medium" &&
                signal.strategy === "bearish_trend"
            ) {
                sellMediumCount++;
            } else if (signal.strength === "weak") {
                sellWeakCount++;
            }
        }
    }

    // Условие для валидных сигналов BUY
    const hasValidBuySignals =
        buyStrongCount >= 1 ||
        (buyMediumCount >= 1 && buyMediumCount + buyWeakCount >= 3);

    // Вес сигналов: strong = 3, medium = 2, weak = 1
    const buyStrength =
        buyStrongCount * 3 + buyMediumCount * 2 + buyWeakCount * 1;
    const sellStrength =
        sellStrongCount * 3 + sellMediumCount * 2 + sellWeakCount * 1;

    // Логика выбора цвета
    if (!hasValidBuySignals) {
        return BackgroundColor.Red; // Нет валидных сигналов BUY
    }

    if (buyStrength > sellStrength) {
        return BackgroundColor.Green; // Сила BUY больше — запуск бота
    } else if (buyStrength < sellStrength) {
        return BackgroundColor.Red; // Сила SELL больше — не запускаем
    } else {
        return BackgroundColor.Orange; // Силы равны — неоднозначная ситуация
    }
};

const getRsiColor = (signals: TradingSignal[]) => {
    // Проверяем, есть ли сигналы
    if (!signals || signals.length === 0) {
        return BackgroundColor.Red; // Нет сигналов — не запускаем
    }

    // Подсчет сигналов по типу и силе
    let buyStrongCount = 0;
    let buyMediumCount = 0;
    let buyWeakCount = 0;
    let sellStrongCount = 0;
    let sellMediumCount = 0;
    let sellWeakCount = 0;

    for (const signal of signals) {
        if (signal.type === "BUY") {
            if (
                signal.strength === "strong" &&
                signal.strategy === "oversold_crossover"
            ) {
                buyStrongCount++;
            } else if (
                signal.strength === "medium" &&
                signal.strategy === "neutral_momentum"
            ) {
                buyMediumCount++;
            } else if (signal.strength === "weak") {
                buyWeakCount++;
            }
        } else if (signal.type === "SELL") {
            if (
                signal.strength === "strong" &&
                signal.strategy === "overbought_crossover"
            ) {
                sellStrongCount++;
            } else if (
                signal.strength === "medium" &&
                signal.strategy === "neutral_momentum"
            ) {
                sellMediumCount++;
            } else if (signal.strength === "weak") {
                sellWeakCount++;
            }
        }
    }

    // Условие для валидных сигналов BUY
    const hasValidBuySignals = buyStrongCount >= 1 || buyMediumCount >= 3;

    // Вес сигналов: strong = 3, medium = 2, weak = 1
    const buyStrength =
        buyStrongCount * 3 + buyMediumCount * 2 + buyWeakCount * 1;
    const sellStrength =
        sellStrongCount * 3 + sellMediumCount * 2 + sellWeakCount * 1;

    // Логика выбора цвета
    if (!hasValidBuySignals) {
        return BackgroundColor.Red; // Нет валидных сигналов BUY
    }

    if (buyStrength > sellStrength) {
        return BackgroundColor.Green; // Сила BUY больше — запуск бота
    } else if (buyStrength < sellStrength) {
        return BackgroundColor.Red; // Сила SELL больше — не запускаем
    } else {
        return BackgroundColor.Orange; // Силы равны — неоднозначная ситуация
    }
};

export const revenue_fields: TypedField<TradingMeasure>[] = [
    {
        type: FieldType.Group,
        columns: "14",
        tabletColumns: "12",
        phoneColumns: "12",
        fieldRightMargin: CC_CELL_PADDING,
        fieldBottomMargin: CC_CELL_PADDING,

        fields: [
            {
                type: FieldType.Hero,
                height: `max(calc(100vh * 0.2), 225px)`,
                minHeight: "185px",
                columns: "3",
                tabletColumns: "6",
                phoneColumns: "12",
                bottom: CC_CELL_PADDING,
                right: CC_CELL_PADDING,
                child: {
                    type: FieldType.Component,
                    element: ({ averagePrice }) => (
                        <SingleValueWidget
                            value={averagePrice}
                            backgroundColor={BackgroundColor.Blue}
                            backgroundMode={BackgroundMode.Semi}
                            onClick={ioc.layoutService.pickBalanceInfo}
                            valueUnit="USDT"
                            headerLabel="Цена рынка"
                            footerLabel="Last 1m candle low"
                        />
                    ),
                },
            },
            {
                type: FieldType.Hero,
                minHeight: "185px",
                columns: "3",
                tabletColumns: "6",
                phoneColumns: "12",

                right: CC_CELL_PADDING,
                bottom: CC_CELL_PADDING,

                height: `max(calc(100vh * 0.2), 225px)`,

                child: {
                    type: FieldType.Component,
                    element: ({ averageCost }) => (
                        <SingleValueWidget
                            value={averageCost}
                            backgroundColor={BackgroundColor.Orange}
                            backgroundMode={BackgroundMode.Semi}
                            onClick={ioc.layoutService.pickBalanceInfo}
                            valueUnit="USDT"
                            headerLabel="Цена монеты"
                            footerLabel="Средняя цена"
                        />
                    ),
                },
            },
            {
                type: FieldType.Hero,
                minHeight: "185px",
                columns: "3",
                tabletColumns: "6",
                phoneColumns: "12",

                height: `max(calc(100vh * 0.2), 225px)`,

                bottom: CC_CELL_PADDING,
                right: CC_CELL_PADDING,
                child: {
                    type: FieldType.Component,
                    element: ({ totalAmount, frozenAmount }) => {

                        let caption = "";

                        if (frozenAmount && frozenAmount < 0) {
                            caption = `Удерживается средств: ${formatAmount(frozenAmount)}$`;
                        }

                        if (frozenAmount && frozenAmount > 0) {
                            caption = `Цена выросла на: +${formatAmount(frozenAmount)}$`;
                        }

                        return (
                            <SingleValueWidget
                                value={totalAmount}
                                backgroundColor={BackgroundColor.Violet}
                                backgroundMode={BackgroundMode.Semi}
                                caption={caption}
                                onClick={ioc.layoutService.pickBalanceInfo}
                                valueUnit="USDT"
                                headerLabel="Заморожено"
                                footerLabel="Используется в сделках"
                            />
                        );
                    },
                },
            },
            {
                type: FieldType.Hero,
                minHeight: "185px",
                columns: "3",
                tabletColumns: "6",
                phoneColumns: "12",

                bottom: CC_CELL_PADDING,
                right: CC_CELL_PADDING,
                height: `max(calc(100vh * 0.2), 225px)`,

                child: {
                    type: FieldType.Component,
                    element: ({ revenueAmount, totalDeals }) => {

                        let caption = "";

                        if (totalDeals) {
                            caption = `Всего сделок: ${totalDeals}`;
                        }

                        return (
                            <SingleValueWidget
                                value={revenueAmount}
                                backgroundColor={BackgroundColor.Green}
                                backgroundMode={BackgroundMode.Semi}
                                onClick={ioc.layoutService.pickBalanceInfo}
                                caption={caption}
                                valueUnit="USDT"
                                headerLabel="Заработано"
                                footerLabel="Прибыль с продаж (текущий месяц)"
                            />
                        );
                    },
                },
            },
        ],
    },
    {
        type: FieldType.Group,
        columns: "12",
        tabletColumns: "12",
        phoneColumns: "12",

        fields: [
            {
                type: FieldType.Hero,
                height: `min(calc(100vh * 0.5), 700px)`,
                minHeight: "465px",
                right: CC_CELL_PADDING,
                bottom: CC_CELL_PADDING,
                columns: "6",
                phoneColumns: "12",

                child: {
                    type: FieldType.Component,
                    element: ({ openOrders }) => (
                        <OrderChartWidget
                            orders={openOrders || []}
                        />
                    ),
                },
            },
            {
                type: FieldType.Hero,
                columns: "6",
                phoneColumns: "12",
                right: CC_CELL_PADDING,
                bottom: CC_CELL_PADDING,
                height: `min(calc(100vh * 0.5), 700px)`,
                minHeight: "465px",
                child: {
                    type: FieldType.Component,
                    element: ({ openOrders }) => (
                        <OrderCalendarWidget items={openOrders} />
                    ),
                },
            },
        ],
    },

    {
        type: FieldType.Group,
        columns: "12",
        tabletColumns: "12",
        phoneColumns: "12",

        fields: [
            {
                type: FieldType.Hero,
                height: `min(calc(100vh * 0.5), 700px)`,
                minHeight: "465px",
                columns: "6",
                phoneColumns: "12",
                right: CC_CELL_PADDING,
                bottom: CC_CELL_PADDING,
                child: {
                    type: FieldType.Component,
                    element: ({ openOrders }) => (
                        <OrderGridWidget orders={openOrders} />
                    ),
                },
            },
            {
                type: FieldType.Group,
                columns: "6",
                phoneColumns: "12",
                fields: [
                    {
                        type: FieldType.Hero,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",

                        right: CC_CELL_PADDING,
                        bottom: CC_CELL_PADDING,
                        height: `min(calc(100vh * 0.25), 350px)`,
                        minHeight: "calc(465px / 2)",

                        child: {
                            type: FieldType.Component,
                            element: ({ shortRangeSignals }) => {
                                const buySignals = shortRangeSignals.filter(
                                    ({ type }) => type === "BUY",
                                );
                                const sellSignals = shortRangeSignals.filter(
                                    ({ type }) => type === "SELL",
                                );

                                const getValue = () => {
                                    if (
                                        buySignals.length > sellSignals.length
                                    ) {
                                        return buySignals.length;
                                    }
                                    return sellSignals.length;
                                };

                                const value = getValue();

                                const getValueUnit = () => {
                                    if (
                                        buySignals.length > sellSignals.length
                                    ) {
                                        return wordForm(Math.abs(value), {
                                            one: "Сигнал BUY",
                                            two: "Сигнала BUY",
                                            many: "Сигналов BUY",
                                        });
                                    }
                                    return wordForm(Math.abs(value), {
                                        one: "Сигнал SELL",
                                        two: "Сигнала SELL",
                                        many: "Сигналов SELL",
                                    });
                                };

                                return (
                                    <SingleValueWidget
                                        value={value}
                                        backgroundColor={getEmaColor(
                                            shortRangeSignals,
                                        )}
                                        backgroundMode={BackgroundMode.Solid}
                                        onClick={
                                            ioc.layoutService
                                                .pickShortRangeStatus
                                        }
                                        valueUnit={getValueUnit()}
                                        headerLabel="EMA"
                                        footerLabel="Краткосрочный"
                                    />
                                );
                            },
                        },
                    },
                    {
                        type: FieldType.Hero,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",

                        right: CC_CELL_PADDING,
                        bottom: CC_CELL_PADDING,
                        height: `min(calc(100vh * 0.25), 350px)`,
                        minHeight: "calc(465px / 2)",

                        child: {
                            type: FieldType.Component,
                            element: ({ swingRangeSignals }) => {
                                const buySignals = swingRangeSignals.filter(
                                    ({ type }) => type === "BUY",
                                );
                                const sellSignals = swingRangeSignals.filter(
                                    ({ type }) => type === "SELL",
                                );

                                const getValue = () => {
                                    if (
                                        buySignals.length > sellSignals.length
                                    ) {
                                        return buySignals.length;
                                    }
                                    return sellSignals.length;
                                };

                                const value = getValue();

                                const getValueUnit = () => {
                                    if (
                                        buySignals.length > sellSignals.length
                                    ) {
                                        return wordForm(Math.abs(value), {
                                            one: "Сигнал BUY",
                                            two: "Сигнала BUY",
                                            many: "Сигналов BUY",
                                        });
                                    }
                                    return wordForm(Math.abs(value), {
                                        one: "Сигнал SELL",
                                        two: "Сигнала SELL",
                                        many: "Сигналов SELL",
                                    });
                                };

                                return (
                                    <SingleValueWidget
                                        value={value}
                                        backgroundColor={getMacdColor(
                                            swingRangeSignals,
                                        )}
                                        backgroundMode={BackgroundMode.Solid}
                                        onClick={
                                            ioc.layoutService
                                                .pickSwingRangeStatus
                                        }
                                        valueUnit={getValueUnit()}
                                        headerLabel="MACD"
                                        footerLabel="Среднесрочный"
                                    />
                                );
                            },
                        },
                    },
                    {
                        type: FieldType.Hero,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",

                        right: CC_CELL_PADDING,
                        bottom: CC_CELL_PADDING,
                        height: `min(calc(100vh * 0.25), 350px)`,
                        minHeight: "calc(465px / 2)",

                        child: {
                            type: FieldType.Component,
                            element: ({ longRangeSignals }) => {
                                const buySignals = longRangeSignals.filter(
                                    ({ type }) => type === "BUY",
                                );
                                const sellSignals = longRangeSignals.filter(
                                    ({ type }) => type === "SELL",
                                );

                                const getValue = () => {
                                    if (
                                        buySignals.length > sellSignals.length
                                    ) {
                                        return buySignals.length;
                                    }
                                    return sellSignals.length;
                                };

                                const value = getValue();

                                const getValueUnit = () => {
                                    if (
                                        buySignals.length > sellSignals.length
                                    ) {
                                        return wordForm(Math.abs(value), {
                                            one: "Сигнал BUY",
                                            two: "Сигнала BUY",
                                            many: "Сигналов BUY",
                                        });
                                    }
                                    return wordForm(Math.abs(value), {
                                        one: "Сигнал SELL",
                                        two: "Сигнала SELL",
                                        many: "Сигналов SELL",
                                    });
                                };

                                return (
                                    <SingleValueWidget
                                        value={value}
                                        backgroundColor={getRsiColor(
                                            longRangeSignals,
                                        )}
                                        backgroundMode={BackgroundMode.Solid}
                                        valueUnit={getValueUnit()}
                                        onClick={
                                            ioc.layoutService
                                                .pickLongRangeStatus
                                        }
                                        headerLabel="RSI"
                                        footerLabel="Долгосрочный"
                                    />
                                );
                            },
                        },
                    },
                    {
                        type: FieldType.Hero,
                        desktopColumns: "6",
                        tabletColumns: "6",
                        phoneColumns: "12",

                        right: CC_CELL_PADDING,
                        bottom: CC_CELL_PADDING,
                        height: `min(calc(100vh * 0.25), 350px)`,
                        minHeight: "calc(465px / 2)",

                        child: {
                            type: FieldType.Component,
                            element: ({ volumeData }) => {
                                const value = getSMAValue(volumeData);

                                return (
                                    <SingleValueWidget
                                        value={value}
                                        backgroundColor={getSMAColor(
                                            volumeData,
                                        )}
                                        backgroundMode={BackgroundMode.Solid}
                                        valueUnit={"USDT"}
                                        onClick={
                                            ioc.layoutService
                                                .pickVolumeDataStatus
                                        }
                                        headerLabel="SMA"
                                        footerLabel="Объём рынка"
                                    />
                                );
                            },
                        },
                    },
                ],
            },
        ],
    },
];

export default revenue_fields;
