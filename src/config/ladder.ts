/**
 * Tolerance zone configuration for DCA overlap detection.
 * Percentages are in 0–100 format (e.g. 5 means 5%).
 */
export interface IPositionOverlapLadder {
  /** Upper tolerance in percent (0–100): how far above each DCA level to flag as overlap */
  upperPercent: number;
  /** Lower tolerance in percent (0–100): how far below each DCA level to flag as overlap */
  lowerPercent: number;
}

export const POSITION_OVERLAP_LADDER_DEFAULT: IPositionOverlapLadder = {
  upperPercent: 1.5,
  lowerPercent: 1.5,
};
