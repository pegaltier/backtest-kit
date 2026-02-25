import { useMemo } from "react";

import { makeStyles } from '../../../../../styles';

interface ILabel {
  angle: number;
  value: number;
}

interface ILabelsProps {
  items: ILabel[];
  side: number;
}

const degToRad = (deg: number) => (deg * Math.PI) / 180;

const angleToPos = (angle: number, radius: number) => ({
  left: radius * Math.cos(degToRad(angle)) + radius,
  top: radius * Math.sin(degToRad(angle)) + radius,
});

const useStyles = makeStyles()((theme) => ({
  root: {
    position: "absolute",
    transform: "translate(-50%, 50%)",
    bottom: "0",
    left: "50%",
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch"
  },
  container: { flex: 1, position: "relative" },
  label: {
    position: "absolute",
    transform: "translate(-50%, -50%)",
    color: theme.palette.text.primary,
    zIndex: 2
  },
}));

export const Labels = ({ items, side }: ILabelsProps) => {
  const { classes } = useStyles();
  const radius = useMemo(() => Math.floor(side / 2), [side]);
  return (
    <div className={classes.root} style={{ height: side, width: side }}>
      <div className={classes.container}>
        {items.slice(0, items.length - 1).map(({ angle, value }, idx) => (
          <span
            key={idx}
            className={classes.label}
            style={{
              ...angleToPos(angle + 180, radius),
              ...(angle < 90 && {
                marginLeft: 10,
              }),
              ...(angle > 90 && {
                marginLeft: -10,
              }),
              ...(angle > 15 &&
                angle < 165 && {
                marginTop: 5,
              }),
            }}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Labels;
