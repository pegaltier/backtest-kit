import { makeStyles } from '../../../../styles';

import classNames from "clsx";

import usePropsContext from "../../context/PropsContext";

interface IFooterProps {
  className?: string;
  style?: React.CSSProperties;
}

const useStyles = makeStyles()({
  root: {
    display: "flex",
    alignItems: "stretch",
    justifyContent: "stretch",
    paddingLeft: "20px",
    paddingRight: "20px",
    overflow: "hidden"
  },
  container: {
    flex: 1,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "center",
    gap: "40px"
  },
  item: {
    gap: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    "& > span": {
      fontWeight: 500,
      fontSize: "12px",
      color: "var(--black-6)",
      whiteSpace: "nowrap"
    }
  },
  circle: { borderRadius: "50%", height: "8px", width: "8px" }
});

export const Footer = ({ className, style }: IFooterProps) => {
  const { classes } = useStyles();
  const { items } = usePropsContext();
  return (
    <div className={classNames(className, classes.root)} style={style}>
      <div className={classes.container}>
        {[...items]
          .sort(({ maxValue: a }, { maxValue: b }) => a - b)
          .map((item, idx) => (
            <div className={classes.item} key={idx}>
              <div
                className={classes.circle}
                style={{ background: item.color }}
              />
              <span>
                {item.label} {item.value ? item.value() : item.maxValue}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Footer;
