import React from "react";

import { BackgroundMode } from "./BackgroundMode";
import BackgroundColor from "./BackgroundColor";

export interface IStep {
  color: string;
  maxValue: number;
}

export interface IProps {
  className?: string;
  style?: React.CSSProperties;
  backgroundMode?: BackgroundMode;
  backgroundColor?: BackgroundColor;
  headerLabel?: React.ReactNode;
  footerLabel?: React.ReactNode;
  roundDigits?: number;
  valueUnit?: string;
  onClick?: () => void;
  value: number;
  caption?: string;
}
