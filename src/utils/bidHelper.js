import { supabase } from "../supabase/supabase";

export const validateBid = ({
  bidAmount,
  highestBid,
  minIncrement,
  basePrice,
  auctionStatus,
  userRole,
  userStatus,
  sellerId,
  currentUserId,
}) => {
  const bid = Number(bidAmount);

  if (!bidAmount || isNaN(bid) || bid <= 0) {
    return { valid: false, message: "Please enter a valid bid amount" };
  }

  if (auctionStatus !== "live") {
    return { valid: false, message: "This auction is not currently live" };
  }

  if (userStatus === "suspended" || userStatus === "banned") {
    return { valid: false, message: "Your account has been suspended" };
  }

  if (userRole !== "buyer") {
    return { valid: false, message: "You must be a verified buyer to place bids" };
  }

  // FIX: If no bids yet, minimum bid is base_price
  // If bids exist, minimum bid is highest_bid + min_increment
  if (highestBid === 0 || highestBid === null) {
    // No bids placed yet — first bid must meet base price
    if (bid < basePrice) {
      return {
        valid: false,
        message: `First bid must be at least the starting price of PKR ${basePrice.toLocaleString()}`
      };
    }
  } else {
    // Bids exist — must beat current highest + increment
    if (bid <= highestBid) {
      return {
        valid: false,
        message: `Bid must be greater than current highest bid of PKR ${highestBid.toLocaleString()}`
      };
    }
    if (bid < highestBid + minIncrement) {
      return {
        valid: false,
        message: `Minimum bid increment is PKR ${minIncrement.toLocaleString()}. Minimum next bid: PKR ${(highestBid + minIncrement).toLocaleString()}`
      };
    }
  }

  return { valid: true };
};

export const placeBid = async ({
  auctionId,
  buyerId,
  bidAmount,
}) => {
  // Insert bid into bids table
  // Triggers handle: update highest bid, auto extend, outbid notification, suspicious detection
  const { data, error } = await supabase
    .from("bids")
    .insert({
      auction_id: auctionId,
      bidder_id: buyerId,
      bid_amount: Number(bidAmount),
      status: "active",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const fetchBuyerRecord = async (userId) => {
  const { data, error } = await supabase
    .from("buyers")
    .select("id, is_verified")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};