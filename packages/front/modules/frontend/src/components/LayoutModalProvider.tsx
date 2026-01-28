import {
    downloadBlank,
    useAlert,
    useOnce,
    useOpenDocument,
    usePrompt,
} from "react-declarative";
import { ioc } from "../lib";
import useWebSearchView from "../view/useWebSearchView";
import useMastodonSearchView from "../view/useMastodonSearchView";
import useLongRangeView from "../view/useLongRangeView";
import useSwingRangeView from "../view/useSwingRangeView";
import useShortRangeView from "../view/useShortRangeView";
import useStrategyReportView from "../view/useStrategyReportView";
import useLongRangeStatusView from "../view/useLongRangeStatusView";
import useSwingRangeStatusView from "../view/useSwingRangeStatusView";
import useShortRangeStatusView from "../view/useShortRangeStatusView";
import useOrderInfoView from "../view/useOrderInfoView";
import useVolumeDataStatusView from "../view/useVolumeDataStatusView";
import useVolumeDataView from "../view/useVolumeDataView";
import useBraveStatusView from "../view/useBraveStatusView";
import useMastodonStatusView from "../view/useMastodonStatusView";
import useOrderCloseInfoView from "../view/useOrderCloseInfoView";
import useNotifyInfoView from "../view/useNotifyInfoView";
import useBalanceInfoView from "../view/useBalanceInfoView";

interface ILayoutModalProviderProps {
    children: React.ReactNode;
}

export const LayoutModalProvider = ({
    children,
}: ILayoutModalProviderProps) => {
    const pickPrompt = usePrompt();
    const pickAlert = useAlert();

    const pickWebSearch = useWebSearchView();
    const pickMastodonSearch = useMastodonSearchView();
    const pickLongRange = useLongRangeView();
    const pickSwingRange = useSwingRangeView();
    const pickShortRange = useShortRangeView();
    const pickVolumeData = useVolumeDataView();
    const pickStrategyReport = useStrategyReportView();
    const pickOrderInfo = useOrderInfoView();
    const pickBraveStatus = useBraveStatusView();
    const pickMastodonStatus = useMastodonStatusView();

    const pickLongRangeStatus = useLongRangeStatusView();
    const pickSwingRangeStatus = useSwingRangeStatusView();
    const pickShortRangeStatus = useShortRangeStatusView();
    const pickVolumeDataStatus = useVolumeDataStatusView();

    const pickNotifyInfo = useNotifyInfoView();
    const pickBalanceInfo = useBalanceInfoView();

    const pickOrderCloseInfo = useOrderCloseInfoView();

    const { pickData: pickOpenDocument, render: renderOpenDocument } =
        useOpenDocument({
            async onSubmit(url, data) {
                if (data?.main.blob) {
                    const url = URL.createObjectURL(data.main.blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = data.main.fileName;
                    a.style.display = "none";
                    a.target = "_blank";
                    document.body.appendChild(a);
                    a.addEventListener(
                        "click",
                        () =>
                            queueMicrotask(() => {
                                URL.revokeObjectURL(url);
                            }),
                        {
                            once: true,
                        },
                    );
                    a.click();
                } else if (data) {
                    await downloadBlank(url, data.main.fileName);
                }
                return true;
            },
        });

    useOnce(() =>
        ioc.layoutService.promptOutgoing.subscribe(async ({ title, value }) => {
            const result = await pickPrompt({ title, value }).toPromise();
            ioc.layoutService.promptIncoming.next(result);
        }),
    );

    useOnce(() =>
        ioc.layoutService.openDocumentSubject.subscribe(
            ({ fileName, url, sizeOriginal }) => {
                pickOpenDocument({
                    fileName,
                    url,
                    sizeOriginal,
                });
            },
        ),
    );

    useOnce(() =>
        ioc.layoutService.pickWebSearchSubject.subscribe(pickWebSearch),
    );

    useOnce(() =>
        ioc.layoutService.pickMastodonSearchSubject.subscribe(
            pickMastodonSearch,
        ),
    );

    useOnce(() =>
        ioc.layoutService.pickVolumeDataSubject.subscribe(pickVolumeData)
    )

    useOnce(() =>
        ioc.layoutService.pickLongRangeSubject.subscribe(pickLongRange),
    );

    useOnce(() =>
        ioc.layoutService.pickSwingRangeSubject.subscribe(pickSwingRange),
    );

    useOnce(() =>
        ioc.layoutService.pickShortRangeSubject.subscribe(pickShortRange),
    );

    useOnce(() => ioc.layoutService.alertOutgoung.subscribe(pickAlert));

    useOnce(() =>
        ioc.layoutService.pickStrategyReportSubject.subscribe(
            pickStrategyReport,
        ),
    );

    useOnce(() =>
        ioc.layoutService.pickOrderInfoSubject.subscribe(pickOrderInfo),
    );

    useOnce(() =>
        ioc.layoutService.pickShortRangeStatusSubject.subscribe(
            pickShortRangeStatus,
        ),
    );
    useOnce(() =>
        ioc.layoutService.pickSwingRangeStatusSubject.subscribe(
            pickSwingRangeStatus,
        ),
    );
    useOnce(() =>
        ioc.layoutService.pickLongRangeStatusSubject.subscribe(
            pickLongRangeStatus,
        ),
    );

    useOnce(() => 
        ioc.layoutService.pickVolumeDataStatusSubject.subscribe(
            pickVolumeDataStatus,
        )
    );

    useOnce(() =>
        ioc.layoutService.pickBraveSubject.subscribe(pickBraveStatus),
    );

    useOnce(() => ioc.layoutService.pickMastodonSubject.subscribe(pickMastodonStatus))

    useOnce(() => ioc.layoutService.pickOrderCloseInfoSubject.subscribe(pickOrderCloseInfo));

    useOnce(() => ioc.layoutService.pickNotifyInfoSubject.subscribe(pickNotifyInfo));

    useOnce(() => ioc.layoutService.pickBalanceInfoSubject.subscribe(pickBalanceInfo));

    return (
        <>
            {children}
            {renderOpenDocument()}
        </>
    );
};

export default LayoutModalProvider;
