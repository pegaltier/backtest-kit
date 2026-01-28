import { Subject } from "react-declarative";

export class LayoutService {
    public readonly pickWebSearchSubject = new Subject<string>();
    public readonly pickMastodonSearchSubject = new Subject<string>();
    public readonly pickLongRangeSubject = new Subject<string>();
    public readonly pickSwingRangeSubject = new Subject<string>();
    public readonly pickShortRangeSubject = new Subject<string>();
    public readonly pickStrategyReportSubject = new Subject<string>();
    public readonly pickOrderInfoSubject = new Subject<string>();
    public readonly pickVolumeDataSubject = new Subject<string>();
    public readonly pickNotifyInfoSubject = new Subject<string>();

    public readonly pickLongRangeStatusSubject = new Subject<void>();
    public readonly pickSwingRangeStatusSubject = new Subject<void>();
    public readonly pickShortRangeStatusSubject = new Subject<void>();
    public readonly pickVolumeDataStatusSubject = new Subject<void>();

    public readonly pickBalanceInfoSubject = new Subject<void>();

    public readonly pickMastodonSubject = new Subject<void>();
    public readonly pickBraveSubject = new Subject<void>();

    public readonly pickOrderCloseInfoSubject = new Subject<string>();

    public readonly appbarSubject = new Subject<boolean>();
    public readonly modalSubject = new Subject<boolean>();

    public readonly reloadOutletSubject = new Subject<void>();

    public readonly openDocumentSubject = new Subject<{
        fileName: string;
        url: string;
        sizeOriginal?: number;
    }>();

    public readonly promptOutgoing = new Subject<{
        title: string;
        value: string;
    }>();

    public readonly promptIncoming = new Subject<string | null>();

    public readonly alertOutgoung = new Subject<{
        title: string;
        description: string;
    }>();

    private _modalLoading = 0;

    private _appbarLoading = 0;

    get hasModalLoader() {
        return !!this._modalLoading;
    }

    get hasAppbarLoader() {
        return !!this._appbarLoading;
    }

    setModalLoader = (loading: boolean) => {
        this._modalLoading = Math.max(
            this._modalLoading + (loading ? 1 : -1),
            0,
        );
        this.modalSubject.next(loading);
    };

    setAppbarLoader = (loading: boolean) => {
        this._appbarLoading = Math.max(
            this._appbarLoading + (loading ? 1 : -1),
            0,
        );
        this.appbarSubject.next(loading);
    };

    dropModalLoader = () => {
        this._modalLoading = 0;
        this.modalSubject.next(false);
    };

    dropAppbarLoader = () => {
        this._appbarLoading = 0;
        this.appbarSubject.next(false);
    };

    reloadOutlet = () => {
        this.reloadOutletSubject.next();
    };

    prompt = async (title: string, value = "") => {
        this.promptOutgoing.next({ title, value });
        return await this.promptIncoming.toPromise();
    };

    downloadFile = (url: string, fileName: string, sizeOriginal?: number) => {
        this.openDocumentSubject.next({
            url,
            fileName,
            sizeOriginal,
        });
    };

    pickWebSearch = async (reportId: string) => {
        await this.pickWebSearchSubject.next(reportId);
    };

    pickMastodonSearch = async (reportId: string) => {
        await this.pickMastodonSearchSubject.next(reportId);
    };

    pickLongRange = async (reportId: string) => {
        await this.pickLongRangeSubject.next(reportId);
    };

    pickSwingRange = async (reportId: string) => {
        await this.pickSwingRangeSubject.next(reportId);
    };

    pickShortRange = async (reportId: string) => {
        await this.pickShortRangeSubject.next(reportId);
    };

    pickStrategyReport = async (reportId: string) => {
        await this.pickStrategyReportSubject.next(reportId);
    };

    pickVolumeData = async (reportId: string) => {
        await this.pickVolumeDataSubject.next(reportId);
    };

    pickOrderInfo = async (orderId: string) => {
        await this.pickOrderInfoSubject.next(orderId);
    };

    pickNotifyInfo = async (notifyId: string) => {
        await this.pickNotifyInfoSubject.next(notifyId);
    }

    pickLongRangeStatus = async () => {
        await this.pickLongRangeStatusSubject.next();
    };

    pickSwingRangeStatus = async () => {
        await this.pickSwingRangeStatusSubject.next();
    };

    pickShortRangeStatus = async () => {
        await this.pickShortRangeStatusSubject.next();
    };

    pickVolumeDataStatus = async () => {
        await this.pickVolumeDataStatusSubject.next();
    };

    pickMastodonInfo = async () => {
        await this.pickMastodonSubject.next();
    };

    pickBraveInfo = async () => {
        await this.pickBraveSubject.next();
    };

    pickAlert = async (title: string, description: string) => {
        await this.alertOutgoung.next({
            title,
            description,
        });
    };

    pickOrderCloseInfo = async (orderId: string) => {
        await this.pickOrderCloseInfoSubject.next(orderId);
    };

    pickBalanceInfo = async () => {
        await this.pickBalanceInfoSubject.next();
    }
}

export default LayoutService;
