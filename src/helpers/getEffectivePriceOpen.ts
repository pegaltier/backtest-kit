import { ISignalRow } from "../interfaces/Strategy.interface";

/**
 * Returns the effective entry price for price calculations.
 *
 * Uses harmonic mean (correct for fixed-dollar DCA: $100 per entry).
 * When partial closes exist, uses the last partial's effectivePrice snapshot
 * + any new DCA entries added after that partial, weighted by actual coin quantities.
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

  // Use the last partial snapshot:
  // - effectivePrice = harmonic average of position at that moment
  // - entryCountAtClose = how many _entry records existed at that moment
  const lastPartial = partials[partials.length - 1];
  const totalClosedPercent = partials.reduce((sum, p) => sum + p.percent, 0);
  const remainingPercent = (100 - totalClosedPercent) / 100; // fraction [0..1]

  // New DCA entries added AFTER the last partial close
  const newEntries = entries.slice(lastPartial.entryCountAtClose);

  // Coins remaining from "old" position:
  // totalCoins at last partial = entryCountAtClose * $100 / effectivePrice
  // remainingOldCoins = remainingPercent * totalCoins
  const oldCoins =
    (remainingPercent * lastPartial.entryCountAtClose * 100) /
    lastPartial.effectivePrice;

  // Coins from new DCA entries (each costs $100)
  const newCoins = newEntries.reduce((sum, e) => sum + 100 / e.price, 0);

  const totalCoins = oldCoins + newCoins;
  if (totalCoins === 0) return lastPartial.effectivePrice;

  const totalCost =
    oldCoins * lastPartial.effectivePrice + newEntries.length * 100;

  return totalCost / totalCoins;
};

const harmonicMean = (prices: number[]): number => {
  if (prices.length === 0) return 0;
  return prices.length / prices.reduce((sum, p) => sum + 1 / p, 0);
};

export default getEffectivePriceOpen;