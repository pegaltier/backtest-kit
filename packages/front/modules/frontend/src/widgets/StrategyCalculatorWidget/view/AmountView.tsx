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
        placeholder: "Управление рисками",
    },
    {
        type: FieldType.Text,
        name: "amount",
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
        title: "Сумма покупки",
        placeholder: "00000",
        inputFormatterSymbol: "0",
        inputFormatterAllowed: /[0-9]/,
        defaultValue: "100",
    },
    {
        type: FieldType.Typography,
        typoVariant: "caption",
        style: { opacity: 0.5, fontSize: 12 },
        placeholder:
            "Лимитный ордер (Limit Order) — это заявка на покупку или продажу актива по заранее установленной цене или лучше. Такой ордер исполняется только тогда, когда рынок достигает указанной цены, что позволяет трейдеру контролировать условия входа или выхода из позиции.",
    },
    {
        type: FieldType.Text,
        name: "percent",
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
        title: "Шаг цены (%)",
        placeholder: "0.00",
        inputFormatterSymbol: "0",
        inputFormatterAllowed: /[0-9.]/,
        defaultValue: "2.5",
    },
    {
        type: FieldType.Typography,
        typoVariant: "caption",
        style: { opacity: 0.5, fontSize: 12 },
        placeholder:
            "Лестница торгов — это стратегия, при которой ордера на покупку или продажу размещаются на разных ценовых уровнях, чтобы поэтапно войти или выйти из позиции. Усреднение цены позволяет снизить общий риск: покупая актив по разным ценам, трейдер получает среднюю стоимость позиции, что помогает сгладить колебания рынка.",
    },
];

export const AmountView = ({
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
                    hasPrev
                    onPrev={async () => {
                        if (data) {
                            onChange({ ...data });
                            await waitForChanges();
                        }
                        history.replace("/price");
                    }}
                    onNext={async () => {
                        if (data) {
                            onChange({ ...data });
                            await waitForChanges();
                        }
                        history.replace("/report");
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
                    key="amount"
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

export default AmountView;
