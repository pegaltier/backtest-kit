import { makeStyles } from '../../../../../styles';

interface ILineProps {
  angle: number;
}

const useStyles = makeStyles()((theme) => ({
  line: {
    position: "absolute",
    background: theme.palette.background.paper,
    height: "100%",
    width: "1px",
    left: "50%",
    transformOrigin: "center bottom"
  }
}));

export const Line = ({ angle }: ILineProps) => {
  const { classes } = useStyles();
  return (
    <div
      className={classes.line}
      style={{
        transform: `rotate(${angle}deg)`,
      }}
    />
  );
};

export default Line;
