import { makeStyles } from '../../../../../styles';

interface IDotProps {
  side: number;
}

const useStyles = makeStyles()((theme) => ({
  dot: {
    position: "absolute",
    transform: "translate(-50%, 50%)",
    bottom: "0",
    left: "50%",
    borderRadius: "50%",
    background: theme.palette.background.paper,
  }
}));

export const Dot = ({ side }: IDotProps) => {
  const { classes } = useStyles();
  return <div className={classes.dot} style={{ height: side, width: side }} />;
};

export default Dot;
