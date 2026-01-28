import {
    IWizardOutletProps,
    WizardNavigation,
    WizardContainer,
    One,
    useOnce,
    ScrollView,
} from "react-declarative";
import { ioc } from "../../../lib";
import { useEffect, useMemo } from "react";
import Markdown from "../../../components/common/Markdown";
import { generateReport } from "../utils/generateReport";
import downloadMarkdown from "../../../utils/downloadMarkdown";
import { Box } from "@mui/material";
import InfoButton from "../../../components/common/InfoButton";

export const AmountView = ({ history, formState }: IWizardOutletProps) => {
    const reportMarkdown = useMemo(() => {
        return generateReport(
            parseFloat(formState.data.price.fiat),
            parseFloat(formState.data.price.price),
            parseFloat(formState.data.amount.percent),
            parseFloat(formState.data.amount.amount),
        );
    }, [formState]);

    useEffect(
        () =>
            formState.payload.downloadSubject?.subscribe(() => {
                downloadMarkdown(reportMarkdown);
            }),
        [reportMarkdown],
    );

    return (
        <WizardContainer
            Navigation={
                <WizardNavigation
                    hasNext
                    hasPrev
                    labelNext="Готово"
                    onPrev={async () => {
                        history.replace("/amount");
                    }}
                    onNext={async () => {
                        ioc.routerService.push("/dashboard");
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
                <Box p={2}>
                    <Markdown content={reportMarkdown} />
                    <InfoButton info={reportMarkdown} />
                </Box>
            </ScrollView>
        </WizardContainer>
    );
};

export default AmountView;
