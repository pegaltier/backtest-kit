import {
  Breadcrumbs2,
  Breadcrumbs2Type,
  IBreadcrumbs2Action,
  IBreadcrumbs2Option,
  Subject,
  useAsyncAction,
} from "react-declarative";
import IconWrapper from "../../../components/common/IconWrapper";
import { Download, KeyboardArrowLeft, Refresh } from "@mui/icons-material";
import { Container } from "@mui/material";
import ioc from "../../../lib";

const actions: IBreadcrumbs2Action[] = [
  {
    action: "download-action",
    label: "Download",
    icon: () => <IconWrapper icon={Download} color="#4caf50" />
  },
  {
    divider: true,
  },
  {
    action: "update-now",
    label: "Refresh manually",
    icon: () => <IconWrapper icon={Refresh} color="#4caf50" />,
  },
];

const options: IBreadcrumbs2Option[] = [
  {
    type: Breadcrumbs2Type.Link,
    action: "back-action",
    label: <KeyboardArrowLeft sx={{ display: "block" }} />,
  },
  {
    type: Breadcrumbs2Type.Link,
    action: "back-action",
    label: "Main",
  },
  {
    type: Breadcrumbs2Type.Link,
    action: "back-action",
    label: "Logs",
  },
];

const reloadSubject = new Subject<void>();

export const LogPage = () => {

  const { execute: handleDownload } = useAsyncAction(async () => {
    /*const signals = await fetchSignals(mode);
    const blob = new Blob([JSON.stringify(signals, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    ioc.layoutService.downloadFile(url, `signals_${mode}_${Date.now()}.json`);*/
  }, {
    onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
    onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
  });

  const handleAction = (action: string) => {

  }

  return (
    <Container>
      <Breadcrumbs2 items={options} actions={actions} onAction={handleAction} />
    </Container>
  );
};

export default LogPage;
