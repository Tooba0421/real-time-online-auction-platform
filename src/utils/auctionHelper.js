import { supabase } from "../supabase/supabase";

// ── Pause Auction ─────────────────────────────────────────────────
// Saves remaining seconds so resume can restore the correct end_time.
// Sets end_time far in the future so pg_cron never auto-ends it.
export const pauseAuction = async (auctionId) => {

  // Step 1: Get current end_time to calculate remaining seconds
  const { data, error: fetchError } = await supabase
    .from("auctions")
    .select("end_time")
    .eq("id", auctionId)
    .single();

  if (fetchError || !data) throw new Error("Could not fetch auction before pausing.");

  // Step 2: Calculate how many seconds are left on the clock
  const now = new Date();
  const end = new Date(data.end_time);
  const remainingSeconds = Math.max(0, Math.floor((end - now) / 1000));

  // Step 3: Set end_time far in future so pg_cron never auto-ends
  // the paused auction. paused_time_remaining stores the real time left.
  const farFuture = new Date("2099-12-31T23:59:59Z").toISOString();

  const { error } = await supabase
    .from("auctions")
    .update({
      status:                 "paused",
      paused_by:              "seller",
      paused_time_remaining:  remainingSeconds, // save real time left
      end_time:               farFuture,        // prevent pg_cron from ending it
    })
    .eq("id", auctionId);

  if (error) throw error;
  return true;
};

// ── Pause Auction by Admin ────────────────────────────────────────
// Same logic as pauseAuction but sets paused_by = 'admin'
export const pauseAuctionByAdmin = async (auctionId) => {

  const { data, error: fetchError } = await supabase
    .from("auctions")
    .select("end_time")
    .eq("id", auctionId)
    .single();

  if (fetchError || !data) throw new Error("Could not fetch auction before pausing.");

  const now = new Date();
  const end = new Date(data.end_time);
  const remainingSeconds = Math.max(0, Math.floor((end - now) / 1000));

  const farFuture = new Date("2099-12-31T23:59:59Z").toISOString();

  const { error } = await supabase
    .from("auctions")
    .update({
      status:                "paused",
      paused_by:             "admin",
      paused_time_remaining: remainingSeconds,
      end_time:              farFuture,
    })
    .eq("id", auctionId);

  if (error) throw error;
  return true;
};

// ── Resume Auction ────────────────────────────────────────────────
// Recalculates end_time as now + paused_time_remaining
// so the timer resumes from exactly where it stopped.
export const resumeAuction = async (auctionId, pausedBy) => {
  if (pausedBy === "admin") {
    throw new Error("This auction was paused by admin and cannot be resumed by seller.");
  }

  // Step 1: Get saved remaining seconds
  const { data, error: fetchError } = await supabase
    .from("auctions")
    .select("paused_time_remaining")
    .eq("id", auctionId)
    .single();

  if (fetchError || !data) throw new Error("Could not fetch auction before resuming.");

  // Step 2: Calculate new end_time = now + remaining seconds
  const remainingSeconds = data.paused_time_remaining || 0;
  const newEndTime = new Date(Date.now() + remainingSeconds * 1000).toISOString();

  // Step 3: Resume with correct end_time, clear paused fields
  const { error } = await supabase
    .from("auctions")
    .update({
      status:                "live",
      paused_by:             null,
      paused_time_remaining: null, // clear saved time
      end_time:              newEndTime, // restore correct countdown
    })
    .eq("id", auctionId);

  if (error) throw error;
  return true;
};

// ── Resume Auction by Admin ───────────────────────────────────────
// Admin can resume any paused auction regardless of who paused it
export const resumeAuctionByAdmin = async (auctionId) => {

  const { data, error: fetchError } = await supabase
    .from("auctions")
    .select("paused_time_remaining")
    .eq("id", auctionId)
    .single();

  if (fetchError || !data) throw new Error("Could not fetch auction before resuming.");

  const remainingSeconds = data.paused_time_remaining || 0;
  const newEndTime = new Date(Date.now() + remainingSeconds * 1000).toISOString();

  const { error } = await supabase
    .from("auctions")
    .update({
      status:                "live",
      paused_by:             null,
      paused_time_remaining: null,
      end_time:              newEndTime,
    })
    .eq("id", auctionId);

  if (error) throw error;
  return true;
};

// ── Close Auction (Seller) ────────────────────────────────────────
export const closeAuction = async (auctionId) => {
  const { error } = await supabase
    .from("auctions")
    .update({ status: "ended" })
    .eq("id", auctionId);

  if (error) throw error;
  return true;
};

// ── Cancel Auction (Seller — scheduled only) ──────────────────────
export const cancelAuction = async (auctionId) => {
  const { error } = await supabase
    .from("auctions")
    .update({ status: "cancelled" })
    .eq("id", auctionId);

  if (error) throw error;
  return true;
};

// ── Get Time Remaining from end_time (used by seller LiveAuctions) ─
export const getTimeRemaining = (endTime) => {
  const now  = new Date();
  const end  = new Date(endTime);
  const diff = Math.max(0, Math.floor((end - now) / 1000));

  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;

  return {
    seconds:   diff,
    formatted: `${h.toString().padStart(2, "0")}:${m
      .toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`,
  };
};