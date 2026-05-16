import { useState, useEffect, useMemo } from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import StatCard from "../../common/components/StatCard";
import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import "../styles/sellerLayout.css";
import "../styles/orderDelivery.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const OrdersDelivery = () => {

  const { user } = useAuthContext();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Tracking number modal
  const [trackingModal, setTrackingModal] = useState(null);
  const [trackingNo, setTrackingNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchOrders();
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      const { data: sellerData } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!sellerData) return;

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          auctions (
            id,
            products ( title, category )
          ),
          buyers (
            id,
            phone_no,
            address,
            city,
            postal_code,
            profiles ( name )
          ),
          payments (
            status,
            total_amount
          ),
          deliveries (
            id,
            status,
            tracking_no,
            courier_service,
            delivery_date
          )
        `)
        .eq('seller_id', sellerData.id)
        .order('order_date', { ascending: false });

      if (error) {
        toast.error("Error fetching orders");
        console.error(error);
        return;
      }

      setOrders(data || []);

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Mark as shipped — opens tracking modal
  const openTrackingModal = (order) => {
    setTrackingModal(order);
    setTrackingNo("");
  };

  const handleSubmitTracking = async () => {
    if (!trackingNo.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }

    try {
      setSubmitting(true);

      const delivery = trackingModal.deliveries;

      if (delivery?.id) {
        // Update existing delivery
        const { error } = await supabase
          .from('deliveries')
          .update({
            status: 'shipped',
            tracking_no: trackingNo.trim(),
            courier_service: 'TCS'
          })
          .eq('id', delivery.id);

        if (error) {
          toast.error("Error updating delivery");
          console.error(error);
          return;
        }
      } else {
        // Create new delivery record
        const { error } = await supabase
          .from('deliveries')
          .insert({
            order_id: trackingModal.id,
            buyer_id: trackingModal.buyer_id,
            seller_id: trackingModal.seller_id,
            status: 'shipped',
            tracking_no: trackingNo.trim(),
            courier_service: 'TCS'
          });

        if (error) {
          toast.error("Error creating delivery");
          console.error(error);
          return;
        }
      }

      // Notify buyer
      if (trackingModal.buyers?.profiles) {
        const { data: buyerProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', trackingModal.buyer_id)
          .single();

        if (buyerProfile) {
          await supabase
            .from('notifications')
            .insert({
              user_id: buyerProfile.id,
              title: 'Your Order Has Been Shipped! 📦',
              message: `Your order for "${trackingModal.auctions?.products?.title}" has been shipped via TCS. Tracking No: ${trackingNo}`,
              type: 'delivery',
              notification_for: 'buyer',
              is_read: false
            });
        }
      }

      toast.success("Order marked as shipped!");
      setTrackingModal(null);
      fetchOrders();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  // Mark as in transit
  const handleMarkInTransit = async (order) => {
    try {
      setProcessing(order.id);

      const { error } = await supabase
        .from('deliveries')
        .update({ status: 'in_transit' })
        .eq('id', order.deliveries?.id);

      if (error) {
        toast.error("Error updating delivery status");
        console.error(error);
        return;
      }

      // Notify buyer
      await supabase
        .from('notifications')
        .insert({
          user_id: order.buyer_id,
          title: 'Your Order is In Transit 🚚',
          message: `Your order for "${order.auctions?.products?.title}" is now in transit. Expected delivery soon.`,
          type: 'delivery',
          notification_for: 'buyer',
          is_read: false
        });

      toast.success("Status updated to In Transit");
      fetchOrders();

    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setProcessing(null);
    }
  };

  const query = search.trim().toLowerCase();
  const filteredOrders = orders.filter(o => {
    const productTitle = o.auctions?.products?.title?.toLowerCase() || '';
    const buyerName = o.buyers?.profiles?.name?.toLowerCase() || '';

    const matchesSearch =
      productTitle.includes(query) ||
      buyerName.includes(query) ||
      o.id.toLowerCase().includes(query);

    const deliveryStatus = o.deliveries?.status || 'pending';
    const matchesStatus =
      filterStatus === "all" || deliveryStatus === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(o => !o.deliveries || o.deliveries?.status === 'pending').length;
    const shipped = orders.filter(o => o.deliveries?.status === 'shipped').length;
    const inTransit = orders.filter(o => o.deliveries?.status === 'in_transit').length;
    const delivered = orders.filter(o => o.deliveries?.status === 'delivered').length;
    return { total, pending, shipped, inTransit, delivered };
  }, [orders]);

  const statsData = [
    { title: "Total Orders", value: loading ? "..." : stats.total, subtitle: "All auction sales" },
    { title: "Pending Shipment", value: loading ? "..." : stats.pending, subtitle: "Need to book courier" },
    { title: "In Transit", value: loading ? "..." : stats.inTransit, subtitle: "On the way to buyer" },
    { title: "Delivered", value: loading ? "..." : stats.delivered, subtitle: "Completed orders" },
  ];

  const deliveryChartData = useMemo(() => ({
    labels: ["Pending", "Shipped", "In Transit", "Delivered"],
    datasets: [{
      data: [stats.pending, stats.shipped, stats.inTransit, stats.delivered],
      backgroundColor: ["#facc15", "#3b82f6", "#8b5cf6", "#22c55e"],
    }],
  }), [stats]);

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "0%",
    layout: { padding: { top: 10, bottom: 30 } },
    plugins: {
      legend: {
        position: "top", align: "center",
        labels: { boxWidth: 30, padding: 15 },
      },
    },
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-PK', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getDeliveryStatus = (order) =>
    order.deliveries?.status || 'pending';

  return (
    <div className="seller-page">

      <div className="stats-grid">
        {statsData.map((item, index) => (
          <StatCard key={index} title={item.title} value={item.value} subtitle={item.subtitle} />
        ))}
      </div>

      <div className="seller-section">
        <h3 className="seller-section-heading">Orders & Delivery</h3>

        <div className="page-controls">
          <input
            type="text"
            placeholder="Search by product, buyer or order ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="shipped">Shipped</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-state">Loading orders...</div>
        ) : (
          <div className="table-wrapper">
            <table className="seller-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Buyer</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>City</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Courier</th>
                  <th>Tracking No</th>
                  <th>Delivery Status</th>
                  <th>Order Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="no-data">No orders found</td>
                  </tr>
                ) : (
                  filteredOrders.map(o => {
                    const deliveryStatus = getDeliveryStatus(o);
                    return (
                      <tr key={o.id}>
                        <td>{o.auctions?.products?.title || '—'}</td>
                        <td>{o.buyers?.profiles?.name || '—'}</td>
                        <td>{o.buyers?.phone_no || '—'}</td>
                        <td>
                          <span title={o.buyers?.address || ''}>
                            {o.buyers?.address
                              ? o.buyers.address.length > 20
                                ? o.buyers.address.slice(0, 20) + '...'
                                : o.buyers.address
                              : '—'}
                          </span>
                        </td>
                        <td>{o.buyers?.city || '—'}</td>
                        <td>PKR {o.total_amount?.toLocaleString()}</td>
                        <td>
                          <StatusBadge
                            label={o.payments?.status || 'pending'}
                            type={o.payments?.status || 'pending'}
                          />
                        </td>
                        <td>{o.deliveries?.courier_service || '—'}</td>
                        <td>{o.deliveries?.tracking_no || '—'}</td>
                        <td>
                          <StatusBadge
                            label={
                              deliveryStatus === 'in_transit' ? 'In Transit' :
                              deliveryStatus.charAt(0).toUpperCase() + deliveryStatus.slice(1)
                            }
                            type={deliveryStatus}
                          />
                        </td>
                        <td>{formatDate(o.order_date)}</td>
                        <td className="actions">
                          {deliveryStatus === 'pending' && (
                            <ActionButton
                              label="Enter Tracking No"
                              variant="secondary"
                              onClick={() => openTrackingModal(o)}
                              disabled={processing === o.id}
                            />
                          )}
                          {deliveryStatus === 'shipped' && (
                            <ActionButton
                              label="Mark In Transit"
                              variant="secondary"
                              onClick={() => handleMarkInTransit(o)}
                              disabled={processing === o.id}
                            />
                          )}
                          {(deliveryStatus === 'in_transit' ||
                            deliveryStatus === 'delivered') && (
                            <span className="no-action-text">
                              {deliveryStatus === 'delivered'
                                ? '✓ Delivered'
                                : '🚚 In Transit'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CHART */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="seller-section-heading">Delivery Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={deliveryChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* TRACKING NUMBER MODAL */}
      {trackingModal && (
        <div className="modal-overlay" onClick={() => setTrackingModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>Enter TCS Tracking Number</h3>
            <p className="modal-subtitle">
              Book your shipment with TCS and enter the tracking number below.
            </p>

            <div className="shipping-info">
              <p><strong>Product:</strong> {trackingModal.auctions?.products?.title}</p>
              <p><strong>Buyer:</strong> {trackingModal.buyers?.profiles?.name || '—'}</p>
              <p><strong>Phone:</strong> {trackingModal.buyers?.phone_no || '—'}</p>
              <p><strong>Address:</strong> {trackingModal.buyers?.address || '—'}</p>
              <p><strong>City:</strong> {trackingModal.buyers?.city || '—'}</p>
              <p><strong>Postal Code:</strong> {trackingModal.buyers?.postal_code || '—'}</p>
            </div>

            <input
              type="text"
              className="form-input"
              placeholder="Enter TCS tracking number"
              value={trackingNo}
              onChange={e => setTrackingNo(e.target.value)}
              style={{ marginTop: "1rem" }}
            />

            <div className="modal-actions" style={{ marginTop: "1rem" }}>
              <button
                className="btn-secondary"
                onClick={() => setTrackingModal(null)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="create-btn"
                onClick={handleSubmitTracking}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Confirm Shipment"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OrdersDelivery;