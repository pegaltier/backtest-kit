import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { SxProps } from "@mui/material";

import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";

import ContentCopy from "@mui/icons-material/ContentCopy";
import { ActionIcon, copyToClipboard, createAwaiter, debounce } from "react-declarative";

const TOOLTIP_CLOSE_DELAY = 800;

interface ICopyIconProps {
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  sx?: SxProps<any>;
  delay?: number;
  onClick: (e: React.MouseEvent<HTMLButtonElement>, doCopy: (content: string | number) => void) => void | Promise<void>;
  color?: 'inherit' | 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
}

const doCopy = async (content: React.ReactNode) => {
  let isOk = false;
  isOk = isOk || typeof content === "string";
  isOk = isOk || typeof content === "number";
  isOk = isOk || typeof content === "boolean";
  isOk = isOk || content === undefined;
  isOk = isOk || content === null;
  if (!isOk) {
    return;
  }
  await copyToClipboard(String(content));
};

export const CopyIcon = ({
  disabled,
  className,
  style,
  sx,
  onClick,
  delay = TOOLTIP_CLOSE_DELAY,
  color = "info",
}: ICopyIconProps) => {
  const [open, setOpen] = useState(false);

  const emitClose = useMemo(
    () =>
      debounce(() => {
        setOpen(false);
      }, delay),
    []
  );

  useEffect(() => () => emitClose.clear(), []);

  return (
    <Tooltip
      className={className}
      style={style}
      sx={sx}
      open={open}
      title="Copied!"
      placement="bottom"
      arrow
      disableFocusListener
      disableTouchListener
    >
      <ActionIcon
        disabled={disabled}
        color={color}
        onClick={async (e) => {
          const [awaiter, { resolve }] = createAwaiter<string | number>();
          {
            e.preventDefault();
            e.stopPropagation();
          }
          await onClick(e, (content) => resolve(content));
          const content = await awaiter;
          {
            setOpen(true);
            await doCopy(content);
            emitClose();
          }
        }}
      >
        <ContentCopy />
      </ActionIcon>
    </Tooltip>
  );
};

export default CopyIcon;
