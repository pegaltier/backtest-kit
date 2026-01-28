import {
    IWizardOutletProps,
    WizardNavigation,
    WizardContainer,
    One,
    TypedField,
    FieldType,
    useRenderWaiter,
    useActualValue,
    ScrollView,
} from "react-declarative";
import { get } from "lodash";
import Typography from "@mui/material/Typography";
import { Close } from "@mui/icons-material";
import { useState } from "react";

const fields: TypedField[] = [
    {
        type: FieldType.Typography,
        style: { opacity: 0.5 },
        fieldBottomMargin: "3",
        typoVariant: "h6",
        placeholder: "Портфель криптоактивов",
    },
    {
        type: FieldType.Text,
        name: "price",
        inputPattern: "[0-9\.]*",
        inputMode: "decimal",
        inputType: "tel",
        trailingIcon: Close,
        trailingIconClick: (v, {}, {}, onValueChange) => {
            onValueChange("");
        },
        validation: {
            required: true,
        },
        title: "Цена Bitcoin",
        placeholder: "000000.00",
        inputFormatterSymbol: "0",
        inputFormatterAllowed: /[0-9.]/,
        defaultValue: (formState) =>
            formState.payload.closePrice || "100000.00",
    },
    {
        type: FieldType.Typography,
        fieldBottomMargin: "3",
        typoVariant: "caption",
        style: { opacity: 0.5, fontSize: 12 },
        placeholder:
            "BTCUSDT на Binance — это торговая пара, представляющая цену биткойна (BTC) в долларах США (USDT, стейблкоин). Она является одной из самых ликвидных и популярных на платформе, активно используемой как трейдерами, так и инвесторами для покупки, продажи и спекуляции на движении курса биткойна.",
    },
    {
        type: FieldType.Text,
        name: "fiat",
        inputPattern: "[0-9]*",
        inputMode: "numeric",
        inputType: "tel",
        trailingIcon: Close,
        trailingIconClick: (v, {}, {}, onValueChange) => {
            onValueChange("");
        },
        validation: {
            required: true,
        },
        title: "Планируется вложить",
        placeholder: "0000000",
        inputFormatterSymbol: "0",
        inputFormatterAllowed: /[0-9]/,
        defaultValue: "10000",
    },
    {
        type: FieldType.Typography,
        fieldBottomMargin: "3",
        typoVariant: "caption",
        style: { opacity: 0.5, fontSize: 12 },
        placeholder:
            "USDT (Tether) — это стейблкоин, привязанный к курсу доллара США в соотношении 1:1. Он используется как цифровой эквивалент фиата на крипторынке, обеспечивая удобство расчетов и защиту от волатильности криптовалют.",
    },
];

export const PriceView = ({
    history,
    data: upperData,
    formState,
    onChange,
}: IWizardOutletProps) => {
    const [data, setData] = useState(upperData);
    const waitForChanges = useRenderWaiter([upperData], 50);
    return (
        <WizardContainer
            Navigation={
                <WizardNavigation
                    hasNext={!!data}
                    onNext={async () => {
                        if (data) {
                            onChange({ ...data });
                            await waitForChanges();
                        }
                        history.replace("/amount");
                    }}
                />
            }
        >
            <ScrollView
                withScrollbar
                hideOverflowX
                sx={{
                    height: "100%",
                }}
            >
                <One
                    key="price"
                    fields={fields}
                    sx={{ p: 1 }}
                    handler={() => data}
                    payload={formState}
                    onChange={(data) => setData(data)}
                />
            </ScrollView>
        </WizardContainer>
    );
};

export default PriceView;
