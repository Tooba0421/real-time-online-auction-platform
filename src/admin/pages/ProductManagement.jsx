import React, { useState, useMemo } from "react";
import "../styles/adminLayout.css";
import "../styles/productManagement.css";

import StatusBadge from "../../common/components/StatusBadge";
import ActionButton from "../../common/components/ActionButton";
import StatCard from "../../common/components/StatCard";

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

import VintageWoodenChair from "../../assets/VintageWoodenChair.jpg";
import ModernLamp from "../../assets/ModernLamp.jpg";
import AntiqueVase from "../../assets/AntiqueVase.jpg";

ChartJS.register(ArcElement, Tooltip, Legend);

/* ======================= INITIAL PRODUCTS ======================= */
const initialProducts = [
  {
    id: "PRD-101",
    name: "Vintage Wooden Chair",
    category: "Furniture",
    seller: "Ali Khan",
    basePrice: "$120",
    description: "A beautifully handcrafted vintage chair from the 1950s.",
    status: "Pending",
    requestDate: "2026-01-20",
    image: VintageWoodenChair,
  },
  {
    id: "PRD-102",
    name: "Modern Lamp",
    category: "Home Decor",
    seller: "Sara Ahmed",
    basePrice: "$45",
    description: "Stylish lamp with modern design, perfect for living room.",
    status: "Approved",
    requestDate: "2026-01-18",
    image: ModernLamp,
  },
  {
    id: "PRD-103",
    name: "Antique Vase",
    category: "Home Decor",
    seller: "Zain Malik",
    basePrice: "$200",
    description: "Rare antique vase, from early 20th century.",
    status: "Rejected",
    requestDate: "2026-01-15",
    image: AntiqueVase,
  },
];

const ProductManagement = () => {
  const [products, setProducts] = useState(initialProducts);
  const [editingProductId, setEditingProductId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedImage, setSelectedImage] = useState(null);

  /* ======================= PRODUCT STATS ======================= */

  const totalProducts = products.length;
  const pendingProducts = products.filter(p => p.status === "Pending").length;
  const approvedProducts = products.filter(p => p.status === "Approved").length;
  const rejectedProducts = products.filter(p => p.status === "Rejected").length;

  const productStatusData = useMemo(() => ({
    labels: ["Approved", "Pending", "Rejected"],
    datasets: [
      {
        data: [approvedProducts, pendingProducts, rejectedProducts],
        backgroundColor: ["#10B981", "#F59E0B", "#EF4444"],
      },
    ],
  }), [approvedProducts, pendingProducts, rejectedProducts]);

  const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "0%",
        layout: {
            padding: {
                top: 10,    // space above the chart
                bottom: 30, // space below the chart
            },
        },
        plugins: {
            legend: {
                position: "top",
                align: "center",
                labels: {
                    boxWidth: 30,
                    padding: 15,
                },
            },
        },
    };


  /* ======================= ACTIONS ======================= */

  const handleViewImage = (image) => {
    setSelectedImage(image);
  };

  const closeModal = () => {
    setSelectedImage(null);
  };

  const handleApprove = (id) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "Approved" } : p))
    );
    setEditingProductId(null);
  };

  const handleReject = (id) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "Rejected" } : p))
    );
    setEditingProductId(null);
  };

  const handleEdit = (id) => {
    setEditingProductId(id);
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || p.status.toLowerCase() === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const statsData = [
    {
      title: "Total Products",
      value: totalProducts,
      subtitle: "All submitted products"
    },
    {
      title: "Pending Products",
      value: pendingProducts,
      subtitle: "Awaiting approval"
    },
    {
      title: "Approved Products",
      value: approvedProducts,
      subtitle: "Live listings"
    },
    {
      title: "Rejected Products",
      value: rejectedProducts,
      subtitle: "Not approved"
    }
  ];

  return (
    <div className="admin-page">

      {/* ================= STAT CARDS ================= */}
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
      {/* ================= PRODUCTS TABLE ================= */}
      <div className="admin-section">
        <h3 className="admin-section-heading">All Products</h3>
      
      {/* ================= SEARCH & FILTER ================= */}
      <div className="admin-controls">
        <input
          type="text"
          placeholder="Search by Product ID or Name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

        <div className="table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Seller</th>
                <th>Image</th>
                <th>Base Price</th>
                <th>Description</th>
                <th>Request Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="10" className="no-data">
                    No products found
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.id}</td>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.seller}</td>
                    <td>
                      <span
                        className="view-image-link"
                        onClick={() => handleViewImage(product.image)}
                      >
                        View Image
                      </span>
                    </td>
                    <td>{product.basePrice}</td>
                    <td className="description" title={product.description}>
                      {product.description}
                    </td>
                    <td>{product.requestDate}</td>
                    <td>
                      <StatusBadge
                        label={product.status}
                        type={product.status.toLowerCase()}
                      />
                    </td>
                    <td className="actions">
                      {product.status === "Pending" ? (
                        <>
                          <ActionButton
                            label="Approve"
                            variant="success"
                            onClick={() => handleApprove(product.id)}
                          />
                          <ActionButton
                            label="Reject"
                            variant="danger"
                            onClick={() => handleReject(product.id)}
                          />
                        </>
                      ) : editingProductId === product.id ? (
                        <>
                          <ActionButton
                            label="Approve"
                            variant="success"
                            onClick={() => handleApprove(product.id)}
                          />
                          <ActionButton
                            label="Reject"
                            variant="danger"
                            onClick={() => handleReject(product.id)}
                          />
                        </>
                      ) : (
                        <ActionButton
                          label="Edit"
                          variant="secondary"
                          onClick={() => handleEdit(product.id)}
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {selectedImage && (
            <div className="image-modal-overlay" onClick={closeModal}>
              <div
                className="image-modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <button className="close-modal" onClick={closeModal}>
                  ✕
                </button>
                <img src={selectedImage} alt="Product Preview" />
              </div>
            </div>
          )}
        </div>
      </div>

        
      {/* ================= STATUS CHART ================= */}
      <div className="overview-grid chart-space">
        <div className="chart-box">
          <h3 className="admin-section-heading">Product Status Overview</h3>
          <div className="chart-container">
            <Doughnut data={productStatusData} options={doughnutOptions} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductManagement;