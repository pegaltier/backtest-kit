import { makeStyles } from "../../../styles";

import LinearProgress from "@mui/material/LinearProgress";
import Tooltip from "@mui/material/Tooltip";

const BAR_HEIGHT = 10;

interface IDimension {
  color: string;
  title: string;
  value: number;
}

interface IColorProgressBarProps {
  data: {
    done: IDimension;
    inprogress: IDimension;
    waiting: IDimension;
    archive: IDimension;
  }
}

const percent = (v: number, m = 100) =>
  Math.min(100, Math.round((Math.max(Number(v), 0) / m) * 100));

const useStyles = makeStyles()({
  root: {
    position: "relative",
    height: BAR_HEIGHT,
    flex: 1,
  },
  bar: {
    position: "absolute !important" as "absolute",
    top: '42%',
    left: 0,
    right: 10,
  },
});

export const ColorProgressBar = (props: IColorProgressBarProps) => {
  const { classes } = useStyles();

  const keys = ["done", "inprogress", "waiting", "archive"];

  const getColor = (key: string) => (props.data as any)[key]?.color;
  const getValue = (key: string) => (props.data as any)[key]?.value;
  const getTitle = (key: string) => (props.data as any)[key]?.title;

  const tooltip = keys
    .map((k) => {
      const value = getValue(k);
      const title = getTitle(k) || k;
      return `${title} - ${value}`;
    })
    .join(" | ");

  const items = keys.map((key) => {
    const color = getColor(key);
    const value = getValue(key);
    return {
      color,
      value,
      key,
    };
  });

  const progress = items
    .map(({ color, value, key }, idx) => {
      let fix = 0;
      if (idx !== 0) {
        for (let i = idx - 1; i >= 0; i--) {
          fix += getValue(keys[i]);
        }
      }
      return {
        value: value > 0 ? value + fix : value,
        key,
        color,
      };
    })
    .sort(({ value: a }, { value: b }) => b - a);

  const total = Math.max(...progress.map(({ value }) => value));

  return (
    <Tooltip title={tooltip} arrow>
      <div className={classes.root}>
        {progress.map(({ color, value: curValue, key }, idx) => {
          const percentValue = percent(curValue, total);
          return (
            <LinearProgress
              key={`${idx}-${key}`}
              sx={{
                height: `${BAR_HEIGHT}px !important`,
                zIndex: `${idx + 1} !important`,
                backgroundColor: "transparent !important",
                '& .MuiLinearProgress-bar': {
                  borderTopRightRadius: 5,
                  borderBottomRightRadius: 5,
                  backgroundColor: `${color} !important`,
                },
              }}
              variant="determinate"
              className={classes.bar}
              value={percentValue}
            />
          );
        })}
      </div>
    </Tooltip>
  );
};

export default ColorProgressBar;