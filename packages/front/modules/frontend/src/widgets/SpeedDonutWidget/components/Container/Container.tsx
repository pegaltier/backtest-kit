import { AutoSizer } from "react-declarative";
import classNames from "clsx";

import { makeStyles } from '../../../../styles';

import { Footer } from "../Footer/Footer";
import { Chart } from "../Chart/Chart";
import { Note } from "../Note/Note";
import { Paper } from "@mui/material";

interface IContainerProps {
  className?: string;
  style?: React.CSSProperties;
}

const useStyles = makeStyles()((theme) => ({
  root: {
    position: "relative",
    overflow: "hidden",
    height: "100%",
    width: "100%",
    background: theme.palette.background.paper,
  },
  container: { position: "absolute", top: "0", left: "0" },
  content: {
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
    flexDirection: "column"
  },
  chart: { flex: 1, paddingTop: "6px", paddingBottom: "6px" },
  footer: { minHeight: "32px" },
  note: { minHeight: "60px" }
}));

const FOOTER_HEIGHT = 32;
const NOTE_HEIGHT = 60;
const CHART_PADDING = 12;

export const Container = ({ className, style }: IContainerProps) => {
  const { classes } = useStyles();
  const computeHeight = (height: number) => {
    let result = height;
    result -= FOOTER_HEIGHT;
    result -= CHART_PADDING;
    result -= NOTE_HEIGHT;
    return result;
  };

  const computeWidth = (width: number) => {
    let result = width;
    result -= CHART_PADDING;
    return result;
  };

  return (
    <Paper className={classNames(className, classes.root)} style={style}>
      <AutoSizer className={classes.container}>
        {({ height = 0, width = 0 }) => {
          return (
            <div className={classes.content} style={{ height, width }}>
              <Chart
                className={classes.chart}
                height={computeHeight(height)}
                width={computeWidth(width)}
              />
              <Note className={classes.note} />
              <Footer className={classes.footer} />
            </div>
          );
        }}
      </AutoSizer>
    </Paper>
  );
};

export default Container;
