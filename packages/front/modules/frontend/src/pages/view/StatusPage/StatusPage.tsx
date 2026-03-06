import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Container,
  darken,
  getContrastRatio,
  lighten,
  Paper,
  Stack,
} from "@mui/material";
import {
  Breadcrumbs2,
  Breadcrumbs2Type,
  Center,
  FieldType,
  IBreadcrumbs2Option,
  One,
  TypedField,
  typo,
  openBlank,
  useAsyncValue,
} from "react-declarative";
import { makeStyles } from "../../../styles";
import { KeyboardArrowLeft } from "@mui/icons-material";
import ioc from "../../../lib";
import IconPhoto from "../../../components/common/IconPhoto";

const GROUP_HEADER = "trade-gpt__groupHeader";
const GROUP_ROOT = "trade-gpt__groupRoot";

const ICON_ROOT = "trade-gpt__symbolImage";

const useStyles = makeStyles()({
  root: {
    [`& .${GROUP_ROOT}:hover .${GROUP_HEADER}`]: {
      opacity: "1 !important",
    },
  },
});

interface IRoute {
  label: string;
  symbol: string;
  color: string;
  to: string;
}

function isLightColor(hex: string) {
  const contrastWithBlack = getContrastRatio(hex, "#000000");
  const contrastWithWhite = getContrastRatio(hex, "#FFFFFF");
  return contrastWithBlack > contrastWithWhite;
}

const options: IBreadcrumbs2Option[] = [
  {
    type: Breadcrumbs2Type.Link,
    action: "back-action",
    label: <KeyboardArrowLeft sx={{ display: "block" }} />,
  },
  {
    type: Breadcrumbs2Type.Link,
    action: "back-action",
    label: "Дэшборд",
  },
  {
    type: Breadcrumbs2Type.Link,
    action: "back-action",
    label: "Меню",
  },
];

const createButton = (
  symbol: string,
  to: string,
  label: React.ReactNode,
  color: string
): TypedField => ({
  type: FieldType.Component,
  desktopColumns: "6",
  tabletColumns: "6",
  phoneColumns: "12",
  fieldRightMargin: "1",
  fieldBottomMargin: "1",
  element: () => (
    <Button
      component={ButtonBase}
      onClick={() => {
        ioc.routerService.push(`/status/${to}`);
      }}
      sx={{
        width: "100%",
        background: color,
        color: "white",
        fontWeight: "bold",
        fontSize: "14px",
        height: "75px",
        minHeight: "75px",
        textWrap: "wrap",
        padding: "16px",
        [`& .${ICON_ROOT}`]: {
          transition: "filter 500ms",
        },
        "&:hover": {
          background: () =>
            isLightColor(color) ? darken(color, 0.33) : lighten(color, 0.33),
          [`& .${ICON_ROOT}`]: {
            transition: "filter 500ms",
            filter: isLightColor(color)
              ? "brightness(0.7) contrast(1.2)"
              : "brightness(1.3) contrast(0.5)",
          },
        },
        transition: "background 500ms",
      }}
      startIcon={<IconPhoto className={ICON_ROOT} symbol={symbol} />}
    >
      {label}
    </Button>
  ),
});

const createGroup = (label: string, routes: IRoute[]): TypedField => ({
  type: FieldType.Group,
  className: GROUP_ROOT,
  sx: {
    p: 2,
  },
  tabletColumns: "12",
  desktopColumns: "3",
  fields: [
    {
      type: FieldType.Component,
      className: GROUP_HEADER,
      style: {
        transition: "opacity 500ms",
        opacity: 0.5,
      },
      element: () => (
        <Stack direction="row">
          <Chip
            variant="outlined"
            size="small"
            color="info"
            label={`${typo.bullet} ${label}`}
            sx={{
              mb: 1,
              pr: 0.5,
              fontSize: "14px",
              background: "white",
              cursor: "not-allowed",
            }}
          />
          <Box flex={1} />
        </Stack>
      ),
    },
    {
      type: FieldType.Group,
      fields: routes.map(({ symbol, label, to, color }) =>
        createButton(symbol, to, label, color)
      ),
    },
  ],
});

const createFields = async (): Promise<TypedField[]> => {
  const [symbolMap, statusList] = await Promise.all([
    ioc.symbolGlobalService.getSymbolMap(),
    ioc.statusViewService.getStatusList(),
  ]);

  // Группируем сигналы по strategyName
  const strategyGroups: Record<string, IRoute[]> = {};

  statusList.forEach((live) => {
    const symbolData = symbolMap[live.symbol];
    const strategy = live.strategyName;

    if (!strategyGroups[strategy]) {
      strategyGroups[strategy] = [];
    }

    strategyGroups[strategy].push({
      symbol: live.symbol,
      label: symbolData?.displayName || live.symbol,
      color: symbolData?.color || "#ccc",
      to: live.id,
    });
  });

  const sortedGroups = Object.entries(strategyGroups).sort(
    ([, a], [, b]) => b.length - a.length
  );

  const tabletLeftColumn: TypedField[] = [];
  const tabletRightColumn: TypedField[] = [];
  const wideColumn: TypedField[] = [];

  sortedGroups.forEach(([strategy, routes], idx) => {
    const group = createGroup(strategy, routes);

    if (idx % 2 === 0) {
      tabletLeftColumn.push(group);
    } else {
      tabletRightColumn.push(group);
    }

    wideColumn.push(group);
  });

  return [
    {
      type: FieldType.Group,
      columns: "6",
      className: "tabletLeftColumn",
      phoneHidden: true,
      desktopHidden: true,
      fields: tabletLeftColumn,
    },
    {
      type: FieldType.Group,
      columns: "6",
      className: "tabletRightColumn",
      phoneHidden: true,
      desktopHidden: true,
      fields: tabletRightColumn,
    },
    {
      type: FieldType.Group,
      columns: "12",
      className: "wideColumn",
      tabletHidden: true,
      fields: wideColumn,
    },
  ];
};

interface IStatusPageProps {
  id?: string;
}

export const StatusPage = ({ id }: IStatusPageProps) => {
  const { classes } = useStyles();

  const [fields, { loading }] = useAsyncValue(async () => {
    return await createFields();
  });

  const handleAction = (action: string) => {
    if (action === "back-action") {
      openBlank("/");
      window.close();
    }
  };

  if (id) {
    return (
      <p>Status getOne</p>
    );
  }

  if (loading || !fields) {
    return (
      <Container>
        <Breadcrumbs2 items={options} onAction={handleAction} />
        <Center>
          <p>Загрузка...</p>
        </Center>
      </Container>
    );
  }

  if (!fields.length) {
    return (
      <Container>
        <Breadcrumbs2 items={options} onAction={handleAction} />
        <Center>
          <p>Нет активных сигналов</p>
        </Center>
      </Container>
    );
  }

  return (
    <Container>
      <Breadcrumbs2 items={options} onAction={handleAction} />
      <One
        className={classes.root}
        fields={fields}
      />
      <Box paddingBottom="24px" />
    </Container>
  );
};

export default StatusPage;
