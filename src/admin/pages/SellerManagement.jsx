import { useState, useMemo, useEffect } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import "../styles/adminLayout.css";
import "../styles/sellerManagement.css";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";

ChartJS.register(ArcElement, Tooltip, Legend);

const SellerManagement = () => {

  const { user } = useAuthContext();

  const [pendingSellers, setPendingSellers] = useState([]);
  const [approvedSellers, setApprovedSellers] = useState([]);
  const [rejectedSellers, setRejectedSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCnicSeller, setSelectedCnicSeller] = useState(null);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [reasonText, setReasonText] = useState("");
  const [actionType, setActionType] = useState("");
  const [processing, setProcessing] = useState(false);
  // Add state
  const [sellerCnicUrls, setSellerCnicUrls] = useState({ front: null, back: null });
  const [sellerCnicLoading, setSellerCnicLoading] = useState(false);

  useEffect(() => {
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      setLoading(true);

      // Fetch all sellers with their profile info
      const { data, error } = await supabase
        .from('sellers')
        .select(`
          *,
          profiles (
            id,
            name,
            role,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error("Error fetching sellers");
        console.error(error);
        return;
      }

      // Separate sellers by status
      const pending = [];
      const approved = [];
      const rejected = [];

      for (const seller of data) {

        // Calculate listings count
        const { count: listingsCount } = await supabase
          .from('auctions')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', seller.id)
          .in('status', ['live', 'ended', 'scheduled']);

        // Calculate success rate
        const { count: totalEnded } = await supabase
          .from('auctions')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', seller.id)
          .eq('status', 'ended');

        const { count: totalSold } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', seller.id)
          .eq('status', 'sold');

        const successRate = totalEnded > 0
          ? ((totalSold / totalEnded) * 100).toFixed(1)
          : 0;

        // Calculate earnings
        const { data: transactionData } = await supabase
          .from('transactions')
          .select('seller_amount')
          .eq('seller_id', seller.id)
          .eq('status', 'released');

        const earnings = transactionData?.reduce(
          (sum, t) => sum + (t.seller_amount || 0), 0
        ) || 0;

        const sellerWithStats = {
          ...seller,
          name: seller.profiles?.name || '—',
          listings: listingsCount || 0,
          successRate: `${successRate}%`,
          earnings: `PKR ${earnings.toLocaleString()}`,
        };

        if (seller.is_verified === 'pending') {
          pending.push(sellerWithStats);
        } else if (seller.is_verified === 'approved') {
          approved.push(sellerWithStats);
        } else if (
          seller.is_verified === 'rejected' ||
          seller.is_verified === 'suspended'
        ) {
          rejected.push(sellerWithStats);
        }
      }

      setPendingSellers(pending);
      setApprovedSellers(approved);
      setRejectedSellers(rejected);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Add function
  const handleViewSellerCnic = async (seller) => {
    try {
      setSellerCnicLoading(true);
      setSelectedCnicSeller(seller);

      const { data: frontSigned } = await supabase.storage
        .from("cnic-images")
        .createSignedUrl(`sellers/${seller.user_id}/front`, 60);

      const { data: backSigned } = await supabase.storage
        .from("cnic-images")
        .createSignedUrl(`sellers/${seller.user_id}/back`, 60);

      setSellerCnicUrls({
        front: frontSigned?.signedUrl || null,
        back: backSigned?.signedUrl || null,
      });

    } catch (err) {
      console.error(err);
      toast.error("Could not load CNIC images");
    } finally {
      setSellerCnicLoading(false);
    }
  };


  // Approve seller
  const handleApprove = async (seller) => {
    try {
      setProcessing(true);

      // Step 1: Update seller is_verified to approved
      const { error: sellerError } = await supabase
        .from('sellers')
        .update({ is_verified: 'approved' })
        .eq('id', seller.id);

      if (sellerError) {
        toast.error("Error approving seller");
        console.error(sellerError);
        return;
      }

      // Step 2: Update profile role to seller
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ role: 'seller' })
        .eq('id', seller.user_id);

      if (profileError) {
        toast.error("Error updating seller role");
        console.error(profileError);
        return;
      }

      // Step 3: Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user.id,
          action_type: 'approve',
          target_id: seller.id,
          target_table: 'sellers',
          remarks: 'Seller approved by admin'
        });

      // Step 4: Notify seller
      await supabase
        .from('notifications')
        .insert({
          user_id: seller.user_id,
          title: 'Seller Application Approved! 🎉',
          message: 'Congratulations! Your seller application has been approved. You can now list products and create auctions.',
          type: 'approval',
          notification_for: 'seller',
          is_read: false
        });

      toast.success(`${seller.name} approved as seller!`);

      // Update local state
      setPendingSellers(prev => prev.filter(s => s.id !== seller.id));
      setApprovedSellers(prev => [...prev, { ...seller, is_verified: 'approved' }]);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const openReasonModal = (seller, type) => {
    setSelectedSeller(seller);
    setActionType(type);
    setReasonText("");
  };

  // Reject or suspend seller
  const handleConfirmAction = async () => {
    if (!reasonText.trim()) {
      toast.error("Please write a reason");
      return;
    }

    try {
      setProcessing(true);

      const newStatus = actionType === 'reject' ? 'rejected' : 'suspended';

      // Step 1: Update seller status
      const { error: sellerError } = await supabase
        .from('sellers')
        .update({ is_verified: newStatus })
        .eq('id', selectedSeller.id);

      if (sellerError) {
        toast.error(`Error ${actionType}ing seller`);
        console.error(sellerError);
        return;
      }

      // Step 2: If rejecting → keep role as user
      // If suspending → change role back to user
      if (actionType === 'suspend') {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ role: 'user' })
          .eq('id', selectedSeller.user_id);

        if (profileError) {
          toast.error("Error updating seller role");
          console.error(profileError);
          return;
        }
      }

      // Step 3: Log admin action
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: user.id,
          action_type: actionType === 'reject' ? 'reject' : 'suspend',
          target_id: selectedSeller.id,
          target_table: 'sellers',
          remarks: reasonText
        });

      // Step 4: Notify seller
      await supabase
        .from('notifications')
        .insert({
          user_id: selectedSeller.user_id,
          title: actionType === 'reject'
            ? 'Seller Application Rejected'
            : 'Seller Account Suspended',
          message: actionType === 'reject'
            ? `Your seller application has been rejected. Reason: ${reasonText}`
            : `Your seller account has been suspended. Reason: ${reasonText}`,
          type: 'approval',
          notification_for: 'seller',
          is_read: false
        });

      toast.success(
        actionType === 'reject'
          ? `${selectedSeller.name} rejected`
          : `${selectedSeller.name} suspended`
      );

      // Update local state
      if (actionType === 'reject') {
        setPendingSellers(prev =>
          prev.filter(s => s.id !== selectedSeller.id)
        );
      } else {
        setApprovedSellers(prev =>
          prev.filter(s => s.id !== selectedSeller.id)
        );
      }

      setRejectedSellers(prev => [
        ...prev,
        {
          ...selectedSeller,
          is_verified: newStatus,
          reason: reasonText
        }
      ]);

      setSelectedSeller(null);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(false);
    }
  };

  const renderEmptyRow = (colSpan, message) => (
    <tr>
      <td colSpan={colSpan} className="empty-row">
        {message}
      </td>
    </tr>
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Stats
  const totalApproved = approvedSellers.length;
  const totalPending = pendingSellers.length;
  const totalRejected = rejectedSellers.length;
  const totalListings = approvedSellers.reduce(
    (sum, seller) => sum + (seller.listings || 0), 0
  );

  const statsData = [
    {
      title: "Approved Sellers",
      value: loading ? "..." : totalApproved,
      subtitle: "Currently active sellers",
    },
    {
      title: "Pending Requests",
      value: loading ? "..." : totalPending,
      subtitle: "Awaiting verification",
    },
    {
      title: "Rejected / Suspended",
      value: loading ? "..." : totalRejected,
      subtitle: "Restricted sellers",
    },
    {
      title: "Total Listings",
      value: loading ? "..." : totalListings,
      subtitle: "From approved sellers",
    },
  ];

  const sellerStatusData = useMemo(() => ({
    labels: ["Approved", "Pending", "Rejected / Suspended"],
    datasets: [
      {
        data: [totalApproved, totalPending, totalRejected],
        backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
      },
    ],
  }), [totalApproved, totalPending, totalRejected]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: {
      padding: { top: 10, bottom: 30 },
    },
    plugins: {
      legend: {
        position: "top",
        align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  return (
    <div className="admin-page">

      {/* STAT CARDS */}
      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard
            key={index}
            title={item.title}
            value={item.value}
            subtitle={item.subtitle}
          />
        ))}
      </div>

      {/* PENDING TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Pending Sellers</h3>
        {loading ? (
          <div className="loading-state">Loading sellers...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Email</th>
                  <th>Business</th>
                  <th>City</th>
                  <th>Address</th>
                  <th>CNIC No</th>
                  <th>View CNIC</th>
                  <th>Request Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingSellers.length === 0
                  ? renderEmptyRow(9, "No pending sellers.")
                  : pendingSellers.map(seller => (
                    <tr key={seller.id}>
                      <td>{seller.name}</td>
                      <td>{seller.email}</td>
                      <td>{seller.business_name}</td>
                      <td>{seller.city}</td>
                      <td>
                        <span className="long-text" title={seller.address}>
                          {seller.address}
                        </span>
                      </td>
                      <td>{seller.cnic_number}</td>
                      <td>
                        <span
                          className="view-image-link"
                          onClick={() => handleViewSellerCnic(seller)}
                        >
                          View CNIC
                        </span>
                      </td>
                      <td>{formatDate(seller.created_at)}</td>
                      <td className="actions">
                        <ActionButton
                          label="Approve"
                          variant="success"
                          onClick={() => handleApprove(seller)}
                          disabled={processing}
                        />
                        <ActionButton
                          label="Reject"
                          variant="danger"
                          onClick={() => openReasonModal(seller, "reject")}
                          disabled={processing}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* APPROVED TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Approved Sellers</h3>
        {loading ? (
          <div className="loading-state">Loading sellers...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Email</th>
                  <th>Business</th>
                  <th>Listings</th>
                  <th>Success Rate</th>
                  <th>Earnings</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvedSellers.length === 0
                  ? renderEmptyRow(8, "No approved sellers.")
                  : approvedSellers.map(seller => (
                    <tr key={seller.id}>
                      <td>{seller.name}</td>
                      <td>{seller.email}</td>
                      <td>{seller.business_name}</td>
                      <td>{seller.listings}</td>
                      <td>{seller.successRate}</td>
                      <td>{seller.earnings}</td>
                      <td>
                        <StatusBadge label="Approved" type="approved" />
                      </td>
                      <td className="actions">
                        <ActionButton
                          label="Suspend"
                          variant="danger"
                          onClick={() => openReasonModal(seller, "suspend")}
                          disabled={processing}
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REJECTED TABLE */}
      <div className="admin-section">
        <h3 className="admin-section-heading">Rejected / Suspended Sellers</h3>
        {loading ? (
          <div className="loading-state">Loading sellers...</div>
        ) : (
          <div className="table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Seller</th>
                  <th>Email</th>
                  <th>Business</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rejectedSellers.length === 0
                  ? renderEmptyRow(5, "No rejected sellers.")
                  : rejectedSellers.map(seller => (
                    <tr key={seller.id}>
                      <td>{seller.name}</td>
                      <td>{seller.email}</td>
                      <td>{seller.business_name}</td>
                      <td>
                        <StatusBadge
                          label={
                            seller.is_verified === 'rejected'
                              ? 'Rejected'
                              : 'Suspended'
                          }
                          type="rejected"
                        />
                      </td>
                      <td>
                        <span className="long-text" title={seller.reason}>
                          {seller.reason || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CNIC MODAL */}
      {selectedCnicSeller && (
  <div className="cnic-modal-overlay">
    <div className="cnic-modal">
      <h3>CNIC Details — {selectedCnicSeller.name}</h3>

      {sellerCnicLoading ? (
        <div style={{ textAlign: "center", padding: "30px" }}>
          Loading images...
        </div>
      ) : (
        <div className="cnic-images">
          <div>
            <p>Front Side</p>
            {sellerCnicUrls.front ? (
              <img src={sellerCnicUrls.front} alt="CNIC Front" />
            ) : (
              <p style={{ color: "#999" }}>Image not available</p>
            )}
          </div>
          <div>
            <p>Back Side</p>
            {sellerCnicUrls.back ? (
              <img src={sellerCnicUrls.back} alt="CNIC Back" />
            ) : (
              <p style={{ color: "#999" }}>Image not available</p>
            )}
          </div>
        </div>
      )}

      <button
        className="close-btn"
        onClick={() => {
          setSelectedCnicSeller(null);
          setSellerCnicUrls({ front: null, back: null });
        }}
      >
        Close
      </button>
    </div>
  </div>
)}

      {/* REASON MODAL */}
      {selectedSeller && (
        <div className="reason-modal-overlay">
          <div className="reason-modal">
            <h3>
              {actionType === "reject" ? "Reject Seller" : "Suspend Seller"}
            </h3>
            <textarea
              placeholder="Write reason here..."
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
            />
            <div className="modal-actions">
              <button
                className="cancel"
                onClick={() => setSelectedSeller(null)}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className="confirm"
                onClick={handleConfirmAction}
                disabled={processing}
              >
                {processing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHART */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">Seller Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={sellerStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>

    </div>
  );
};

export default SellerManagement;