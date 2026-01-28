import { ITabsStep } from "react-declarative";

export const tabs: ITabsStep[] = [
    {
        id: "main",
        label: "Детали",
    },
    {
        id: "strategy",
        label: "Стратегия торгов",
        isVisible: ({ strategy }) => strategy,
    },
    {
        id: "volume",
        label: "Объём рынка",
        isVisible: ({ volume }) => volume,
    },
    {
        id: "price",
        label: "Цена торгов",
        isVisible: ({ price }) => price,
    },
    {
        id: "long",
        label: "Long Range (RSI)",
        isVisible: ({ long }) => long,
    },
    {
        id: "swing",
        label: "Swing Range (MACD)",
        isVisible: ({ swing }) => swing,
    },
    {
        id: "short",
        label: "Short Range (EMA)",
        isVisible: ({ short }) => short,
    },
    {
        id: "mastodon",
        label: "Тренды Mastodon",
        isVisible: ({ mastodon }) => mastodon,
    },
    {
        id: "brave",
        label: "Тренды интернета",
        isVisible: ({ brave }) => brave,
    },
];

export default tabs;
