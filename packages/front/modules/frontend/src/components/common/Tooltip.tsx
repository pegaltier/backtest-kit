import MatTooltip from "@mui/material/Tooltip";
import { useMemo } from "react";
import { useMediaContext } from "react-declarative";

interface ITooltipProps {
    description: string;
    placement?: 'bottom-end'
    | 'bottom-start'
    | 'bottom'
    | 'left-end'
    | 'left-start'
    | 'left'
    | 'right-end'
    | 'right-start'
    | 'right'
    | 'top-end'
    | 'top-start'
    | 'top';
    children: React.ReactElement;
}

export const Tooltip = ({ description, placement = "left", children }: ITooltipProps) => {
    const { isDesktop } = useMediaContext();

    const slotProps = useMemo(
        () => ({
            popper: {
                sx: { pointerEvents: "none" },
                modifiers: isDesktop
                    ? [
                          {
                              name: "fallbackPlacements",
                              options: {
                                  fallbackPlacements: [
                                      "right",
                                      "top",
                                      "bottom",
                                  ],
                              },
                          },
                      ]
                    : undefined,
            },
            tooltip: { sx: { background: "black", p: 1.5, fontSize: "16px" } },
            arrow: { sx: { color: "black" } },
        }),
        [isDesktop],
    );

    const props = useMemo(() => ({
        placement: isDesktop ? placement : undefined,
    }), [isDesktop, placement]);

    return (
        <MatTooltip
            title={description}
            slotProps={slotProps}
            {...props}
            arrow
        >
            {children}
        </MatTooltip>
    );
};

export default Tooltip;
