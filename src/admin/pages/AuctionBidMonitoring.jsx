import { useState, useMemo } from "react";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import { useAdminContext } from "../../context/AdminContext";
import toast from "react-hot-toast";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import StatCard from "../../common/components/StatCard";
import "../styles/adminLayout.css";
import "../styles/auctionsBidMonitoring.css";

const AuctionBidMonitoring = () => {
  const { user } = useAuthContext();
  const {
    activeAuctions,
    suspiciousBids,
    auctionsLoading,
    updateAuctionLocally,
    removeSuspiciousBid,
    refetchAuctions,
  } = useAdminContext();

  const [processing, setProcessing] = useState(null);
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // ── Log admin action ──────────────────────────────────────────────
  const logAdminAction = async (actionType, targetId, targetTable, remarks) => {
    try {
      await supabase.from("admin_actions").insert({
        admin_id:     user.id,
        action_type:  actionType,
        target_id:    targetId,
        target_table: targetTable,
        remarks:      remarks,
      });
    } catch (err) {
      console.error("Admin action log error:", err);
    }
  };

  // ── Pause auction ─────────────────────────────────────────────────
  // FIX: Removed pauseAuctionByAdmin (does not exist in auctionHelper)
  // Now calls supabase directly — same logic, no missing import
  const handlePause = async (auction) => {
    try {
      setProcessing(auction.id);

      // Optimistic update so UI reflects pause immediately
      updateAuctionLocally(auction.id, { status: "paused", paused_by: "admin" });

      // FIX: Direct supabase call instead of non-existent helper function
      const { error } = await supabase
        .from("auctions")
        .update({ status: "paused", paused_by: "admin" })
        .eq("id", auction.id);

      if (error) {
        // Rollback optimistic update
        updateAuctionLocally(auction.id, {
          status:    auction.status,
          paused_by: auction.paused_by,
        });
        toast.error("Error pausing auction");
        return;
      }

      await logAdminAction("pause", auction.id, "auctions", "Auction paused by admin");

      // FIX: Use auction.sellers?.user_id for notification
      // auction.sellers?.user_id = profiles.id of the seller (correct for notifications)
      // auction.seller_id = sellers.id (NOT correct for notifications)
      const sellerUserId = auction.sellers?.user_id || null;
      if (sellerUserId) {
        await supabase.from("notifications").insert({
          user_id:          sellerUserId,
          title:            "Your Auction Has Been Paused",
          message:          `Your auction for "${auction.products?.title}" has been temporarily paused by admin. Please contact support for more information.`,
          type:             "auction_ended",
          notification_for: "seller",
          is_read:          false,
        });
      }

      toast.success("Auction paused successfully");
    } catch (err) {
      updateAuctionLocally(auction.id, {
        status:    auction.status,
        paused_by: auction.paused_by,
      });
      console.error(err);
      toast.error("Error pausing auction");
    } finally {
      setProcessing(null);
    }
  };

  // ── Resume auction ────────────────────────────────────────────────
  // FIX: Removed resumeAuctionByAdmin (does not exist in auctionHelper)
  const handleResume = async (auction) => {
    try {
      setProcessing(auction.id);

      // Optimistic update
      updateAuctionLocally(auction.id, { status: "live", paused_by: null });

      // FIX: Direct supabase call instead of non-existent helper function
      const { error } = await supabase
        .from("auctions")
        .update({ status: "live", paused_by: null })
        .eq("id", auction.id);

      if (error) {
        // Rollback optimistic update
        updateAuctionLocally(auction.id, {
          status:    auction.status,
          paused_by: auction.paused_by,
        });
        toast.error("Error resuming auction");
        return;
      }

      await logAdminAction("resume", auction.id, "auctions", "Auction resumed by admin");

      // FIX: Use auction.sellers?.user_id (profiles.id) not auction.seller_id (sellers.id)
      const sellerUserId = auction.sellers?.user_id || null;
      if (sellerUserId) {
        await supabase.from("notifications").insert({
          user_id:          sellerUserId,
          title:            "Your Auction Has Been Resumed",
          message:          `Your auction for "${auction.products?.title}" has been resumed by admin and is now live.`,
          type:             "auction_ended",
          notification_for: "seller",
          is_read:          false,
        });
      }

      toast.success("Auction resumed successfully");
    } catch (err) {
      updateAuctionLocally(auction.id, {
        status:    auction.status,
        paused_by: auction.paused_by,
      });
      console.error(err);
      toast.error("Error resuming auction");
    } finally {
      setProcessing(null);
    }
  };

  // ── Force close auction ───────────────────────────────────────────
  const handleForceClose = async (auction) => {
    const productTitle = auction.products?.title || "this auction";

    if (!window.confirm(
      `Force close "${productTitle}"?\n\n` +
      `This will immediately end the auction and determine the winner if bids exist.\n` +
      `This action cannot be undone.`
    )) return;

    try {
      setProcessing(auction.id);

      // Optimistic remove from active list
      updateAuctionLocally(auction.id, { status: "ended" });

      // Step 1: End the auction
      const { error: auctionError } = await supabase
        .from("auctions")
        .update({
          status:   "ended",
          end_time: new Date().toISOString(),
        })
        .eq("id", auction.id);

      if (auctionError) {
        updateAuctionLocally(auction.id, { status: auction.status });
        toast.error(`Error closing auction: ${auctionError.message}`);
        return;
      }

      // Step 2: Find the highest active bid
      const { data: highestBid, error: bidError } = await supabase
        .from("bids")
        .select("id, bidder_id, bid_amount")
        .eq("auction_id", auction.id)
        .eq("status", "active")
        .order("bid_amount", { ascending: false })
        .limit(1)
        .maybeSingle();

      let winnerBuyerId  = null; // buyers.id — used for orders.buyer_id and auctions.winner_id
      let winnerUserId   = null; // profiles.id — used for notifications.user_id
      let winningAmount  = 0;

      if (!bidError && highestBid) {
        winnerBuyerId = highestBid.bidder_id; // buyers.id
        winningAmount = highestBid.bid_amount;

        // FIX: Fetch buyer.user_id (profiles.id) to use for notifications
        // bidder_id = buyers.id, but notifications need profiles.id (user_id)
        const { data: buyerProfile } = await supabase
          .from("buyers")
          .select("user_id")
          .eq("id", winnerBuyerId)
          .single();

        winnerUserId = buyerProfile?.user_id || null;

        // Step 3a: Set winner on auction
        await supabase
          .from("auctions")
          .update({ winner_id: winnerBuyerId })
          .eq("id", auction.id);

        // Step 3b: Mark winning bid as won
        await supabase
          .from("bids")
          .update({ status: "won" })
          .eq("id", highestBid.id);

        // Step 3c: Mark all other active bids as outbid
        await supabase
          .from("bids")
          .update({ status: "outbid" })
          .eq("auction_id", auction.id)
          .eq("status", "active")
          .neq("id", highestBid.id);

        // Step 3d: Mark product as sold
        await supabase
          .from("products")
          .update({ status: "sold" })
          .eq("id", auction.product_id);

        // Step 3e: Create order
        const { error: orderError } = await supabase
          .from("orders")
          .insert({
            auction_id:   auction.id,
            buyer_id:     winnerBuyerId,   // buyers.id — correct for orders table
            seller_id:    auction.seller_id, // sellers.id — correct for orders table
            amount:       winningAmount,
            service_tax:  0,
            shipping_fee: 250,
            total_amount: winningAmount + 250,
            order_status: "pending",
            order_date:   new Date().toISOString(),
          });

        if (orderError) {
          console.error("Order creation error:", orderError);
          // Non-critical — log but continue
        }

        // Step 3f: Notify winner (uses profiles.id = winnerUserId)
        if (winnerUserId) {
          await supabase.from("notifications").insert({
            user_id:          winnerUserId,
            title:            "🎉 You Won the Auction!",
            message:          `Congratulations! You won "${productTitle}" with a bid of PKR ${winningAmount.toLocaleString()}. Please proceed to checkout to complete your payment.`,
            type:             "auction_won",
            notification_for: "buyer",
            is_read:          false,
          });
        }

      } else {
        // No bids — mark product as unsold
        await supabase
          .from("products")
          .update({ status: "unsold" })
          .eq("id", auction.product_id);
      }

      // Step 4: Log admin action
      await logAdminAction(
        "force_close",
        auction.id,
        "auctions",
        winnerBuyerId
          ? `Auction force closed. Winner buyer ID: ${winnerBuyerId}, Amount: PKR ${winningAmount.toLocaleString()}`
          : "Auction force closed with no winner"
      );

      // Step 5: Notify seller
      // FIX: Use auction.sellers?.user_id (profiles.id) not auction.seller_id (sellers.id)
      const sellerUserId = auction.sellers?.user_id || null;
      if (sellerUserId) {
        await supabase.from("notifications").insert({
          user_id:          sellerUserId,
          title:            "Your Auction Was Force Closed by Admin",
          message:          winnerBuyerId
            ? `Your auction for "${productTitle}" was closed by admin. Winning bid: PKR ${winningAmount.toLocaleString()}. The buyer will complete payment shortly.`
            : `Your auction for "${productTitle}" was closed by admin with no winner.`,
          type:             "auction_ended",
          notification_for: "seller",
          is_read:          false,
        });
      }

      toast.success(
        winnerBuyerId
          ? "Auction force closed — winner found and order created!"
          : "Auction force closed — no bids, product marked as unsold."
      );

      // Refresh after short delay to let DB settle
      setTimeout(() => refetchAuctions(), 500);

    } catch (err) {
      console.error("Force close error:", err);
      toast.error("Something went wrong while closing the auction");
      refetchAuctions();
    } finally {
      setProcessing(null);
    }
  };

  // ── Dismiss suspicious bid ────────────────────────────────────────
  const handleDismissBid = async (bid) => {
    if (!window.confirm(
      `Dismiss suspicious bid from "${bid.buyers?.profiles?.name || "bidder"}" ` +
      `for PKR ${bid.bid_amount?.toLocaleString()}?\n\nThis marks the bid as safe.`
    )) return;

    try {
      setProcessing(bid.id);

      // Optimistic remove from list immediately
      removeSuspiciousBid(bid.id);

      const { error } = await supabase
        .from("bids")
        .update({ is_suspicious: false })
        .eq("id", bid.id);

      if (error) {
        toast.error("Error dismissing bid");
        refetchAuctions(); // re-sync
        return;
      }

      await logAdminAction("dismiss_bid", bid.id, "bids", "Suspicious bid dismissed as safe by admin");

      toast.success("Bid dismissed as safe");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
      refetchAuctions();
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("en-PK", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  };

  const filteredAuctions = useMemo(() => {
    const q = search.toLowerCase();
    return activeAuctions.filter((auction) => {
      const matchesSearch =
        auction.products?.title?.toLowerCase().includes(q) ||
        auction.sellers?.profiles?.name?.toLowerCase().includes(q) ||
        auction.sellers?.business_name?.toLowerCase().includes(q) ||
        auction.id?.toLowerCase().includes(q);
      const matchesStatus =
        filterStatus === "all" || auction.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [activeAuctions, search, filterStatus]);

  const liveCount      = useMemo(() => activeAuctions.filter((a) => a.status === "live").length,      [activeAuctions]);
  const pausedCount    = useMemo(() => activeAuctions.filter((a) => a.status === "paused").length,    [activeAuctions]);
  const scheduledCount = useMemo(() => activeAuctions.filter((a) => a.status === "scheduled").length, [activeAuctions]);

  const statsData = [
    { title: "Live Auctions",   value: auctionsLoading ? "..." : liveCount,             subtitle: "Currently active"     },
    { title: "Scheduled",       value: auctionsLoading ? "..." : scheduledCount,        subtitle: "Upcoming auctions"    },
    { title: "Paused",          value: auctionsLoading ? "..." : pausedCount,           subtitle: "On hold"              },
    { title: "Suspicious Bids", value: auctionsLoading ? "..." : suspiciousBids.length, subtitle: "Flagged for review"   },
  ];

  return (
    <div className="admin-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      {/* AUCTIONS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Active Auctions</h3>

        <div className="admin-controls">
          <input
            type="text"
            placeholder="Search by product, seller, or auction ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="live">Live</option>
            <option value="scheduled">Scheduled</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        {auctionsLoading ? (
          <div className="loading-state">Loading auctions...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Current Bid</th>
                  <th>Min Increment</th>
                  <th>Reserve Met</th>
                  <th>Status</th>
                  <th>Paused By</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuctions.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="empty-row">No auctions found</td>
                  </tr>
                ) : filteredAuctions.map((auction) => (
                  <tr key={auction.id}>
                    <td>{auction.products?.title || "—"}</td>
                    <td>{auction.sellers?.profiles?.name || "—"}</td>
                    <td>PKR {(auction.highest_bid || 0).toLocaleString()}</td>
                    <td>PKR {(auction.min_increment || 0).toLocaleString()}</td>
                    <td>
                      <StatusBadge
                        label={
                          auction.products?.reserved_price &&
                          auction.highest_bid >= auction.products.reserved_price
                            ? "Met" : "Not Met"
                        }
                        type={
                          auction.products?.reserved_price &&
                          auction.highest_bid >= auction.products.reserved_price
                            ? "approved" : "pending"
                        }
                      />
                    </td>
                    <td>
                      <StatusBadge
                        label={auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
                        type={auction.status}
                      />
                    </td>
                    <td>
                      {auction.paused_by
                        ? <span style={{
                            fontSize: "12px",
                            color: auction.paused_by === "admin" ? "#ef4444" : "#f59e0b",
                            fontWeight: "600",
                          }}>
                            {auction.paused_by === "admin" ? "Admin" : "Seller"}
                          </span>
                        : <span style={{ color: "#ccc" }}>—</span>
                      }
                    </td>
                    <td>{formatDate(auction.start_time)}</td>
                    <td>{formatDate(auction.end_time)}</td>
                    <td className="actions">
                      {auction.status === "live" && (
                        <ActionButton
                          label={processing === auction.id ? "Pausing..." : "Pause"}
                          variant="secondary"
                          onClick={() => handlePause(auction)}
                          disabled={processing === auction.id}
                        />
                      )}
                      {auction.status === "paused" && (
                        <ActionButton
                          label={processing === auction.id ? "Resuming..." : "Resume"}
                          variant="success"
                          onClick={() => handleResume(auction)}
                          disabled={processing === auction.id}
                        />
                      )}
                      {/* Force Close shown for live and paused — not scheduled */}
                      {auction.status !== "scheduled" && (
                        <ActionButton
                          label={processing === auction.id ? "Closing..." : "Force Close"}
                          variant="danger"
                          onClick={() => handleForceClose(auction)}
                          disabled={processing === auction.id}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUSPICIOUS BIDS TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Suspicious Bids</h3>
        {auctionsLoading ? (
          <div className="loading-state">Loading bids...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Bidder</th>
                  <th>Product</th>
                  <th>Bid Amount</th>
                  <th>Bid Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {suspiciousBids.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-row">No suspicious bids found</td>
                  </tr>
                ) : suspiciousBids.map((bid) => (
                  <tr key={bid.id}>
                    <td>{bid.buyers?.profiles?.name || "—"}</td>
                    <td>{bid.auctions?.products?.title || "—"}</td>
                    <td>PKR {bid.bid_amount?.toLocaleString()}</td>
                    <td>{formatDate(bid.bid_time)}</td>
                    <td className="actions">
                      <ActionButton
                        label={processing === bid.id ? "Dismissing..." : "Dismiss"}
                        variant="secondary"
                        onClick={() => handleDismissBid(bid)}
                        disabled={processing === bid.id}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default AuctionBidMonitoring;