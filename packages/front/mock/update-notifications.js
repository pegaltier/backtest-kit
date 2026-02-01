/**
 * Script to update notifications.json with new fields:
 * - scheduledAt
 * - pendingAt
 * - priceTakeProfit (where missing)
 * - priceStopLoss (where missing)
 * - originalPriceTakeProfit
 * - originalPriceStopLoss
 *
 * Run: node packages/front/mock/update-notifications.js
 */

const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "notifications.json");
const notifications = JSON.parse(fs.readFileSync(filePath, "utf-8"));

// Types that need the new fields (commit/available types)
const typesNeedingUpdate = [
  "partial_profit.available",
  "partial_loss.available",
  "breakeven.available",
  "partial_profit.commit",
  "partial_loss.commit",
  "breakeven.commit",
  "trailing_stop.commit",
  "trailing_take.commit",
];

// Signal status types that need scheduledAt/pendingAt
const signalStatusTypes = [
  "signal.opened",
  "signal.closed",
];

// Default values based on position
const getDefaults = (notification) => {
  const priceOpen = notification.priceOpen || 51754;
  const position = notification.position || "long";
  const timestamp = notification.timestamp;

  // Calculate SL/TP based on position
  let priceTakeProfit, priceStopLoss;
  if (position === "long") {
    priceTakeProfit = priceOpen * 1.03; // +3%
    priceStopLoss = priceOpen * 0.98; // -2%
  } else {
    priceTakeProfit = priceOpen * 0.97; // -3%
    priceStopLoss = priceOpen * 1.02; // +2%
  }

  return {
    position,
    priceOpen,
    priceTakeProfit: notification.priceTakeProfit || priceTakeProfit,
    priceStopLoss: notification.priceStopLoss || priceStopLoss,
    originalPriceTakeProfit:
      notification.originalPriceTakeProfit ||
      notification.priceTakeProfit ||
      priceTakeProfit,
    originalPriceStopLoss:
      notification.originalPriceStopLoss ||
      notification.priceStopLoss ||
      priceStopLoss,
    // scheduledAt is typically when signal was created (before pending)
    scheduledAt: notification.scheduledAt || timestamp - 60000, // 1 minute before
    // pendingAt is when position became active at priceOpen
    pendingAt: notification.pendingAt || timestamp - 30000, // 30 seconds before
  };
};

let updatedCount = 0;

const updatedNotifications = notifications.map((notification) => {
  // Handle commit/available types
  if (typesNeedingUpdate.includes(notification.type)) {
    const defaults = getDefaults(notification);
    const updated = { ...notification };

    // Add missing fields
    if (!updated.position) {
      updated.position = defaults.position;
    }
    if (!updated.priceOpen) {
      updated.priceOpen = defaults.priceOpen;
    }
    if (!updated.priceTakeProfit) {
      updated.priceTakeProfit = defaults.priceTakeProfit;
    }
    if (!updated.priceStopLoss) {
      updated.priceStopLoss = defaults.priceStopLoss;
    }
    if (!updated.originalPriceTakeProfit) {
      updated.originalPriceTakeProfit = defaults.originalPriceTakeProfit;
    }
    if (!updated.originalPriceStopLoss) {
      updated.originalPriceStopLoss = defaults.originalPriceStopLoss;
    }
    if (!updated.scheduledAt) {
      updated.scheduledAt = defaults.scheduledAt;
    }
    if (!updated.pendingAt) {
      updated.pendingAt = defaults.pendingAt;
    }

    updatedCount++;
    return updated;
  }

  // Handle signal.opened and signal.closed types
  if (signalStatusTypes.includes(notification.type)) {
    const updated = { ...notification };
    const timestamp = notification.timestamp;

    if (!updated.scheduledAt) {
      updated.scheduledAt = timestamp - 60000; // 1 minute before
    }
    if (!updated.pendingAt) {
      // For signal.opened, pendingAt equals timestamp
      // For signal.closed, pendingAt is when position was opened (before close)
      if (notification.type === "signal.opened") {
        updated.pendingAt = timestamp;
      } else {
        // signal.closed - pendingAt should be before close timestamp
        updated.pendingAt = timestamp - (notification.duration || 60) * 60000;
      }
    }

    updatedCount++;
    return updated;
  }

  return notification;
});

// Write back
fs.writeFileSync(filePath, JSON.stringify(updatedNotifications, null, 2));

console.log(`Updated ${updatedCount} notifications with new fields.`);
console.log("Fields added: scheduledAt, pendingAt for signal.opened/signal.closed");
console.log("Fields added: scheduledAt, pendingAt, priceTakeProfit, priceStopLoss, originalPriceTakeProfit, originalPriceStopLoss for commit/available types");
