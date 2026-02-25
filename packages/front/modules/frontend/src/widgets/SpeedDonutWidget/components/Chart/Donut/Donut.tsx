import { useCallback, useMemo } from "react";

import { Circle } from "../Circle/Circle";
import { Dot } from "../Dot/Dot";
import { Line } from "../Line/Line";
import { Outline } from "../Outline/Outline";
import { IChunk } from "../../../model/IChunk";
import { Pointer } from "../Pointer/Pointer";
import { Labels } from "../Labels/Labels";

interface IDonutProps {
  color: string;
  side: number;
  width: number;
  chunks: IChunk[];
  minValue: number;
  maxValue: number;
  value: number;
}

export const Donut = ({
  width,
  side,
  chunks,
  maxValue,
  minValue,
  value,
}: IDonutProps) => {
  const lineWidth = useMemo(() => side * 0.5, [side]);
  const dotSide = useMemo(() => side * 0.63, [side]);
  const labelsSide = useMemo(() => side * 0.58, [side]);

  const computeCircleAngle = useCallback(
    (chunk: IChunk) => {
      const range = maxValue - minValue;
      const startPosition = chunk.minValue - minValue;
      return (180 / range) * startPosition + 45;
    },
    [maxValue, minValue]
  );

  const pointerAngle = useMemo(() => {
    return Math.min((value / maxValue) * 180, 180);
  }, [maxValue, value]);

  const pointerScale = useMemo(() => {
    if (width > side) {
      return (dotSide / width) * 1.5;
    }
    return 1;
  }, [dotSide, width, side]);

  const lineAngles = useMemo(() => {
    return [...chunks]
      .sort(({ maxValue: a }, { maxValue: b }) => a - b)
      .slice(0, chunks.length - 1)
      .map((chunk) => {
        const angle = (180 / maxValue) * chunk.maxValue;
        return {
          angle: angle,
          value: chunk.maxValue,
        };
      });
  }, [chunks, maxValue]);

  const labelAngles = useMemo(
    () => [
      {
        angle: 0,
        value: 0,
      },
      ...lineAngles,
      {
        angle: 180,
        value: maxValue,
      },
    ],
    [lineAngles, maxValue]
  );

  return (
    <>
      <Pointer angle={pointerAngle} scale={pointerScale} />
      {[...chunks]
        .sort(({ maxValue: a }, { maxValue: b }) => a - b)
        .map((chunk, idx) => (
          <Circle
            key={`${chunk.color}-${idx}`}
            rotate={computeCircleAngle(chunk)}
            color={chunk.color}
            side={side}
            lineWidth={lineWidth}
          />
        ))}
      {lineAngles.map(({ angle }, idx) => (
        <Line key={`${angle}-${idx}`} angle={angle - 90} />
      ))}
      <Outline side={side} />
      <Dot side={dotSide} />
      <Labels items={labelAngles} side={labelsSide} />
    </>
  );
};

export default Donut;
