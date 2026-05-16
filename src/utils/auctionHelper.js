import { supabase } from "../supabase/supabase";

// ── Pause Auction (Seller) ──────────────────────────────────
export const pauseAuction = async (auctionId, productTitle) => {
  const { error } = await supabase
    .from('auctions')
    .update({
      status: 'paused',
      paused_by: 'seller'
    })
    .eq('id', auctionId);

  if (error) throw error;

  // Get seller user_id to notify them (optional self-notify skip)
  // Notify via notifications if needed in future
  return true;
};

// ── Resume Auction (Seller) ─────────────────────────────────
// Seller can only resume if THEY paused it (paused_by = 'seller')
export const resumeAuction = async (auctionId, pausedBy) => {
  if (pausedBy === 'admin') {
    throw new Error("This auction was paused by admin and cannot be resumed by seller.");
  }

  const { error } = await supabase
    .from('auctions')
    .update({
      status: 'live',
      paused_by: null
    })
    .eq('id', auctionId);

  if (error) throw error;
  return true;
};

// ── Close Auction (Seller) ──────────────────────────────────
export const closeAuction = async (auctionId) => {
  const { error } = await supabase
    .from('auctions')
    .update({ status: 'ended' })
    .eq('id', auctionId);

  if (error) throw error;
  return true;
};

// ── Cancel Auction (Seller - scheduled only) ────────────────
export const cancelAuction = async (auctionId) => {
  const { error } = await supabase
    .from('auctions')
    .update({ status: 'cancelled' })
    .eq('id', auctionId);

  if (error) throw error;
  return true;
};

// ── Format Time Remaining from end_time ─────────────────────
export const getTimeRemaining = (endTime) => {
  const now = new Date();
  const end = new Date(endTime);
  const diff = Math.max(0, Math.floor((end - now) / 1000));

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  return {
    seconds: diff,
    formatted: `${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")}:${s.toString().padStart(2, "0")}`
  };
};