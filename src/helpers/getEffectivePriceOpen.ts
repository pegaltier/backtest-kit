import { ISignalRow } from "../interfaces/Strategy.interface";

/**
 * Returns the effective entry price for price calculations.
 *
 * Uses harmonic mean (correct for fixed-dollar DCA: $100 per entry).
 *
 * When partial closes exist, uses the last partial's snapshot:
 *   - effectivePrice: harmonic average at that moment
 *   - positionCostBasisAtClose: total dollar cost basis of position BEFORE that partial
 *   - entryCountAtClose: how many _entry records existed at that moment (for slicing new entries)
 *
 * Remaining cost basis after last partial:
 *   remainingCostBasis = positionCostBasisAtClose × (1 - percent / 100)
 *
 * Then new DCA entries after the last partial are added on top.
 *
 * @param signal - Signal row
 * @returns Effective entry price for PNL calculations
 */
export const getEffectivePriceOpen = (signal: ISignalRow): number => {
  if (!signal._entry || signal._entry.length === 0) return signal.priceOpen;

  const entries = signal._entry;
  const partials = signal._partial ?? [];

  // No partial exits — pure harmonic mean of all entries
  if (partials.length === 0) {
    return harmonicMean(entries.map((e) => e.price));
  }

  // Use the last partial snapshot
  const lastPartial = partials[partials.length - 1];

  const positionCostBasisAtClose = lastPartial.entryCountAtClose * 100;
      
  const partialDollarValue =
    (lastPartial.percent / 100) * positionCostBasisAtClose;

  // Dollar cost basis of position remaining after the last partial close
  const remainingCostBasis =
    partialDollarValue * (1 - lastPartial.percent / 100);

  // Coins remaining from the old position
  const oldCoins = remainingCostBasis / lastPartial.effectivePrice;

  // New DCA entries added AFTER the last partial close
  const newEntries = entries.slice(lastPartial.entryCountAtClose);

  // Coins from new DCA entries (each costs $100)
  const newCoins = newEntries.reduce((sum, e) => sum + 100 / e.price, 0);

  const totalCoins = oldCoins + newCoins;
  if (totalCoins === 0) return lastPartial.effectivePrice;

  const totalCost = remainingCostBasis + newEntries.length * 100;

  return totalCost / totalCoins;
};

const harmonicMean = (prices: number[]): number => {
  if (prices.length === 0) return 0;
  return prices.length / prices.reduce((sum, p) => sum + 1 / p, 0);
};

export default getEffectivePriceOpen;