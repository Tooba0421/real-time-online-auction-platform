import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaEdit, FaUser, FaEnvelope, FaIdCard, FaShieldAlt,
  FaSignOutAlt, FaTimes, FaBuilding, FaPhone, FaMapMarkerAlt
} from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { logout } from "../../supabase/authService";
import { useAuthContext } from "../../context/AuthContext";
import CnicModal from "../components/CnicModal";
import "../styles/profile.css";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, profile: contextProfile, loading: authLoading } = useAuthContext();

  const [seller, setSeller] = useState(null);
  const [buyer, setBuyer] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showPersonalEdit, setShowPersonalEdit] = useState(false);
  const [showCnicModal, setShowCnicModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (authLoading) return;

    if (!authLoading && !user) {
      navigate("/");
    }

    if (contextProfile) {
      setNewName(contextProfile.name || "");

      fetchExtraData(contextProfile);
    }
  }, [user, contextProfile, authLoading, navigate]);

  const fetchExtraData = async (profileData) => {
    try {
      setLoading(true);

      if (profileData.role === "seller") {
        const { data } = await supabase
          .from("sellers")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        setSeller(data);
      }

      if (profileData.role === "buyer") {
        const { data } = await supabase
          .from("buyers")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        setBuyer(data);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
  if (!newName.trim()) return;

  try {
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ name: newName })
      .eq("id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    // ⚡ IMPORTANT: DO NOT use setProfile
    // Instead update context indirectly OR reload profile in context

    setShowPersonalEdit(false);

  } catch (err) {
    console.error(err);
  } finally {
    setSaving(false);
  }
};

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const getVerificationBadge = (status) => {
    if (!status || status === "not_submitted") return { label: "Not Verified", cls: "badge-unverified" };
    if (status === "pending") return { label: "Pending Review", cls: "badge-pending" };
    if (status === "approved") return { label: "Verified", cls: "badge-verified" };
    if (status === "rejected") return { label: "Rejected", cls: "badge-rejected" };
    return { label: "Not Verified", cls: "badge-unverified" };
  };

  const getInitial = () => {
    const name = contextProfile?.name || user?.email || "?";
    return (name?.charAt(0) || "?").toUpperCase();
  };

  if (authLoading || loading) {
    return (
      <div className="profile-loading">
        <div className="profile-spinner" />
        <p>Loading your profile...</p>
      </div>
    );
  }

  const role = contextProfile?.role;
  const badge = getVerificationBadge(contextProfile?.id_verified);

  return (
    <div className="profile-page">
      <div className="profile-bg-top" />

      <div className="profile-container">

        {/* Top Section */}
        <div className="profile-avatar-section">
          <div className="profile-initial-avatar">{getInitial()}</div>
          <div className="profile-name-block">
            <h2 className="profile-display-name">{contextProfile?.name || "Anonymous User"}</h2>
            <span className="profile-role-tag">{role || "user"}</span>
            {role !== "admin" && role !== "user" && (
              <span className={`profile-badge ${badge.cls}`}>
                <FaShieldAlt /> {badge.label}
              </span>
            )}
          </div>
        </div>

        <div className="profile-cards">

          {/* Personal Info Card — all roles */}
          <div className="profile-card">
            <div className="profile-card-header">
              <h3>Personal Information</h3>
              <button className="edit-btn" onClick={() => setShowPersonalEdit(true)}>
                <FaEdit /> Edit
              </button>
            </div>

            <ProfileField icon={<FaUser />} label="Full Name" value={contextProfile?.name} />
            <ProfileField icon={<FaEnvelope />} label="Email Address" value={user?.email} />

            {role !== "admin" && (
              <div className="profile-field">
                <div className="field-icon"><FaShieldAlt /></div>
                <div className="field-content">
                  <label>Verification Status</label>
                  <span className={`inline-badge ${badge.cls}`}>{badge.label}</span>
                </div>
              </div>
            )}
          </div>

          {/* Seller Info Card */}
          {role === "seller" && seller && (
            <div className="profile-card">
              <div className="profile-card-header">
                <h3>Business Information</h3>
              </div>
              <ProfileField icon={<FaBuilding />} label="Business Name" value={seller?.business_name} />
              <ProfileField icon={<FaPhone />} label="Phone Number" value={seller?.phone_no} />
              <ProfileField icon={<FaMapMarkerAlt />} label="City" value={seller?.city} />
              <ProfileField icon={<FaMapMarkerAlt />} label="Address" value={seller?.address} />
              <ProfileField icon={<FaIdCard />} label="CNIC Number" value={seller?.cnic_number} mono />
              <CnicImages front={seller?.cnic_front} back={seller?.cnic_back} />
            </div>
          )}

          {/* Buyer CNIC Card */}
          {role === "buyer" && (
            <div className="profile-card">
              <div className="profile-card-header">
                <h3>Identity Verification</h3>
              </div>
              {buyer ? (
                <>
                  <ProfileField icon={<FaIdCard />} label="CNIC Number" value={buyer?.cnic_number} mono />
                  <CnicImages front={buyer?.cnic_front} back={buyer?.cnic_back} />
                </>
              ) : (
                <p className="auth-subtitle">No CNIC submitted yet.</p>
              )}
            </div>
          )}

          {/* User — CNIC prompt */}
          {(role === "user" || !role) && (
            <div className="profile-card cnic-prompt-card">
              <div className="cnic-prompt-icon"><FaIdCard /></div>
              <h3>Complete Your Verification</h3>
              <p>Submit your CNIC to unlock bidding and buying features.</p>
              <button className="cnic-submit-btn" onClick={() => setShowCnicModal(true)}>
                Submit CNIC
              </button>
            </div>
          )}

        </div>

        <button className="logout-btn" onClick={handleLogout}>
          <FaSignOutAlt /> Sign Out
        </button>
      </div>

      {/* Name Edit Modal */}
      {showPersonalEdit && (
        <div className="profile-modal-overlay" onClick={() => setShowPersonalEdit(false)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <button className="profile-modal-close" onClick={() => setShowPersonalEdit(false)}>
              <FaTimes />
            </button>
            <h3 className="profile-modal-title">Edit Name</h3>
            <div className="profile-modal-form">
              <div className="profile-modal-field">
                <label>Full Name</label>
                <input
                  className="profile-modal-input"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="profile-modal-actions">
                <button className="profile-modal-cancel" onClick={() => setShowPersonalEdit(false)}>
                  Cancel
                </button>
                <button className="profile-modal-save" onClick={handleSaveName} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CNIC Modal */}
      {showCnicModal && (
        <CnicModal closeModal={() => {
          setShowCnicModal(false);
          fetchAllData();
        }} />
      )}
    </div>
  );
};

const ProfileField = ({ icon, label, value, mono }) => (
  <div className="profile-field">
    <div className="field-icon">{icon}</div>
    <div className="field-content">
      <label>{label}</label>
      <span className={mono ? "cnic-number" : ""}>{value || "—"}</span>
    </div>
  </div>
);

const CnicImages = ({ front, back }) => (
  <div className="cnic-images-section">
    <div className="cnic-image-block">
      <label>Front Side</label>
      <div className="cnic-img-wrapper">
        {front
          ? <img src={front} alt="CNIC Front" className="cnic-img" />
          : <div className="cnic-placeholder">No image</div>
        }
      </div>
    </div>
    <div className="cnic-image-block">
      <label>Back Side</label>
      <div className="cnic-img-wrapper">
        {back
          ? <img src={back} alt="CNIC Back" className="cnic-img" />
          : <div className="cnic-placeholder">No image</div>
        }
      </div>
    </div>
  </div>
);

export default ProfilePage;