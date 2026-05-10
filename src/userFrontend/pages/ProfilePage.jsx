import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaEdit, FaUser, FaEnvelope, FaIdCard, FaShieldAlt,
  FaSignOutAlt, FaTimes, FaUpload, FaCheckCircle,
  FaBuilding, FaPhone, FaMapMarkerAlt
} from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { logout } from "../../supabase/authService";
import { useAuthContext } from "../../context/AuthContext";
import CnicModal from "../components/CnicModal";
import "../styles/profile.css";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthContext();

  const [profile, setProfile] = useState(null);
  const [seller, setSeller] = useState(null);
  const [buyer, setBuyer] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  const [showPersonalEdit, setShowPersonalEdit] = useState(false);
  const [showSellerEditModal, setShowSellerEditModal] = useState(false);
  const [showCnicEdit, setShowCnicEdit] = useState(false);
  const [showCnicModal, setShowCnicModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // For admin/buyer/user — name only
  const [personalForm, setPersonalForm] = useState({});

  // For seller — all fields in one form
  const [sellerEditForm, setSellerEditForm] = useState({});
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);

  // For buyer — CNIC only
  const [cnicForm, setCnicForm] = useState({ cnic_number: "", front: null, back: null });
  const [buyerFrontPreview, setBuyerFrontPreview] = useState(null);
  const [buyerBackPreview, setBuyerBackPreview] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/"); return; }
    fetchAllData();
  }, [user, authLoading]);

  const fetchAllData = async () => {
    try {
      setLoading(true);

      const { data: profileData } = await supabase
        .from("profiles").select("*").eq("id", user.id).single();

      setProfile(profileData);
      setRole(profileData?.role);

      if (profileData?.role === "seller") {
        const { data: sellerData } = await supabase
          .from("sellers").select("*").eq("user_id", user.id).single();
        setSeller(sellerData);
      }

      if (profileData?.role === "buyer") {
        const { data: buyerData } = await supabase
          .from("buyers").select("*").eq("user_id", user.id).single();
        setBuyer(buyerData);
      }

      // Fetch pending change if any
      const { data: pendingData } = await supabase
        .from("pending_changes")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setPendingChange(pendingData || null);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Admin / Buyer / User: name edit (saves immediately) ──
  const openPersonalEdit = () => {
    setPersonalForm({ name: profile?.name || "" });
    setShowPersonalEdit(true);
  };

  const handleSavePersonal = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({ name: personalForm.name })
        .eq("id", user.id);

      if (error) { alert("Error updating name"); return; }
      setProfile(prev => ({ ...prev, name: personalForm.name }));
      setShowPersonalEdit(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Seller: open combined edit modal ──
  const openSellerEdit = () => {
    setSellerEditForm({
      // Saves immediately
      name: profile?.name || "",
      business_name: seller?.business_name || "",

      // Needs approval — pre-fill with pending if exists
      phone_no: pendingChange?.pending_phone_no || seller?.phone_no || "",
      city: pendingChange?.pending_city || seller?.city || "",
      postal_code: pendingChange?.pending_postal_code || seller?.postal_code || "",
      address: pendingChange?.pending_address || seller?.address || "",

      // CNIC — needs approval
      cnic_number: pendingChange?.pending_cnic_number || seller?.cnic_number || "",
      front: null,
      back: null,
    });

    setFrontPreview(pendingChange?.pending_cnic_front || seller?.cnic_front || null);
    setBackPreview(pendingChange?.pending_cnic_back || seller?.cnic_back || null);
    setShowSellerEditModal(true);
  };

  const handleSellerFileChange = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (side === "front") {
      setSellerEditForm(prev => ({ ...prev, front: file }));
      setFrontPreview(preview);
    } else {
      setSellerEditForm(prev => ({ ...prev, back: file }));
      setBackPreview(preview);
    }
  };

  // ── Seller: save — name & business name immediately, rest needs approval ──
  const handleSaveSellerEdit = async () => {
    try {
      setSaving(true);

      // 1. Save name immediately to profiles
      const { error: nameError } = await supabase
        .from("profiles")
        .update({ name: sellerEditForm.name })
        .eq("id", user.id);
      if (nameError) { alert("Error updating name"); return; }

      // 2. Save business name immediately to sellers
      const { error: bizError } = await supabase
        .from("sellers")
        .update({ business_name: sellerEditForm.business_name })
        .eq("user_id", user.id);
      if (bizError) { alert("Error updating business name"); return; }

      // 3. Upload CNIC images if changed
      let frontURL = pendingChange?.pending_cnic_front || seller?.cnic_front || null;
      let backURL = pendingChange?.pending_cnic_back || seller?.cnic_back || null;

      if (sellerEditForm.front) {
        const frontPath = `sellers/${user.id}/front_pending`;
        await supabase.storage.from("cnic-images")
          .upload(frontPath, sellerEditForm.front, { upsert: true });
        const { data } = supabase.storage.from("cnic-images").getPublicUrl(frontPath);
        frontURL = data.publicUrl;
      }

      if (sellerEditForm.back) {
        const backPath = `sellers/${user.id}/back_pending`;
        await supabase.storage.from("cnic-images")
          .upload(backPath, sellerEditForm.back, { upsert: true });
        const { data } = supabase.storage.from("cnic-images").getPublicUrl(backPath);
        backURL = data.publicUrl;
      }

      // 4. Save pending fields (phone, city, postal code, address, cnic)
      const pendingPayload = {
        user_id: user.id,
        role: "seller",
        change_type: "all",
        pending_phone_no: sellerEditForm.phone_no,
        pending_city: sellerEditForm.city,
        pending_postal_code: sellerEditForm.postal_code,
        pending_address: sellerEditForm.address,
        pending_cnic_number: sellerEditForm.cnic_number,
        pending_cnic_front: frontURL,
        pending_cnic_back: backURL,
        status: "pending",
      };

      if (pendingChange) {
        // Update existing pending request
        const { error } = await supabase
          .from("pending_changes")
          .update(pendingPayload)
          .eq("id", pendingChange.id);
        if (error) { alert("Error submitting changes"); console.error(error); return; }
      } else {
        // Insert new pending request
        const { error } = await supabase
          .from("pending_changes")
          .insert(pendingPayload);
        if (error) { alert("Error submitting changes"); console.error(error); return; }
      }

      // 5. Notify admin
      const { data: adminData } = await supabase
        .from("profiles").select("id").eq("role", "admin").single();
      if (adminData) {
        await supabase.from("notifications").insert({
          user_id: adminData.id,
          title: "Seller Profile Update Request",
          message: `A seller has submitted updated profile and CNIC information for approval.`,
          type: "approval",
          notification_for: "admin",
          is_read: false
        });
      }

      // 6. Update local state immediately for name and business name
      setProfile(prev => ({ ...prev, name: sellerEditForm.name }));
      setSeller(prev => ({ ...prev, business_name: sellerEditForm.business_name }));

      alert("Name and business name updated. Other changes submitted for admin approval.");
      setShowSellerEditModal(false);
      fetchAllData();

    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // ── Buyer: CNIC edit ──
  const openCnicEdit = () => {
    setCnicForm({
      cnic_number: pendingChange?.pending_cnic_number || buyer?.cnic_number || "",
      front: null,
      back: null,
    });
    setBuyerFrontPreview(pendingChange?.pending_cnic_front || buyer?.cnic_front || null);
    setBuyerBackPreview(pendingChange?.pending_cnic_back || buyer?.cnic_back || null);
    setShowCnicEdit(true);
  };

  const handleCnicFileChange = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (side === "front") {
      setCnicForm(prev => ({ ...prev, front: file }));
      setBuyerFrontPreview(preview);
    } else {
      setCnicForm(prev => ({ ...prev, back: file }));
      setBuyerBackPreview(preview);
    }
  };

  const handleSaveCnic = async () => {
    try {
      setSaving(true);

      let frontURL = pendingChange?.pending_cnic_front || buyer?.cnic_front || null;
      let backURL = pendingChange?.pending_cnic_back || buyer?.cnic_back || null;

      if (cnicForm.front) {
        const frontPath = `buyers/${user.id}/front_pending`;
        await supabase.storage.from("cnic-images")
          .upload(frontPath, cnicForm.front, { upsert: true });
        const { data } = supabase.storage.from("cnic-images").getPublicUrl(frontPath);
        frontURL = data.publicUrl;
      }

      if (cnicForm.back) {
        const backPath = `buyers/${user.id}/back_pending`;
        await supabase.storage.from("cnic-images")
          .upload(backPath, cnicForm.back, { upsert: true });
        const { data } = supabase.storage.from("cnic-images").getPublicUrl(backPath);
        backURL = data.publicUrl;
      }

      const pendingPayload = {
        user_id: user.id,
        role: "buyer",
        change_type: "cnic",
        pending_cnic_number: cnicForm.cnic_number,
        pending_cnic_front: frontURL,
        pending_cnic_back: backURL,
        status: "pending",
      };

      if (pendingChange) {
        const { error } = await supabase
          .from("pending_changes")
          .update(pendingPayload)
          .eq("id", pendingChange.id);
        if (error) { alert("Error submitting CNIC update"); return; }
      } else {
        const { error } = await supabase
          .from("pending_changes")
          .insert(pendingPayload);
        if (error) { alert("Error submitting CNIC update"); return; }
      }

      // Notify admin
      const { data: adminData } = await supabase
        .from("profiles").select("id").eq("role", "admin").single();
      if (adminData) {
        await supabase.from("notifications").insert({
          user_id: adminData.id,
          title: "Buyer CNIC Update Request",
          message: "A buyer has submitted updated CNIC information for approval.",
          type: "approval",
          notification_for: "admin",
          is_read: false
        });
      }

      alert("CNIC update submitted for admin approval. Your current info stays active until approved.");
      setShowCnicEdit(false);
      fetchAllData();

    } catch (err) {
      console.error(err);
      alert("Something went wrong");
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
    if (status === "approved" || status === "verified") return { label: "Verified", cls: "badge-verified" };
    if (status === "rejected") return { label: "Rejected", cls: "badge-rejected" };
    return { label: "Not Verified", cls: "badge-unverified" };
  };

  const getInitial = () => {
    const name = profile?.name || user?.email || "?";
    return name.charAt(0).toUpperCase();
  };

  if (authLoading || loading) {
    return (
      <div className="profile-loading">
        <div className="profile-spinner" />
        <p>Loading your profile...</p>
      </div>
    );
  }

  const badge = getVerificationBadge(profile?.id_verified);
  const hasPending = !!pendingChange;

  return (
    <div className="profile-page">
      <div className="profile-bg-top" />

      <div className="profile-container">

        {/* ── Top Section ── */}
        <div className="profile-avatar-section">
          <div className="profile-initial-avatar">{getInitial()}</div>
          <div className="profile-name-block">
            <h2 className="profile-display-name">{profile?.name || "Anonymous User"}</h2>
            <span className="profile-role-tag">{role || "user"}</span>
            {role !== "admin" && role !== "user" && (
              <span className={`profile-badge ${badge.cls}`}>
                <FaShieldAlt /> {badge.label}
              </span>
            )}
          </div>
        </div>

        <div className="profile-cards">

          {/* ══════ ADMIN VIEW ══════ */}
          {role === "admin" && (
            <div className="profile-card">
              <div className="profile-card-header">
                <h3>Personal Information</h3>
                <button className="edit-btn" onClick={openPersonalEdit}>
                  <FaEdit /> Edit
                </button>
              </div>
              <ProfileField icon={<FaUser />} label="Full Name" value={profile?.name} />
              <ProfileField icon={<FaEnvelope />} label="Email Address" value={user?.email} />
            </div>
          )}

          {/* ══════ SELLER VIEW ══════ */}
          {role === "seller" && (
            <>
              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>Personal & Business Information</h3>
                  <button className="edit-btn" onClick={openSellerEdit}>
                    <FaEdit /> Edit
                  </button>
                </div>

                {hasPending && (
                  <div className="cnic-pending-notice">
                    ⏳ You have changes pending admin approval.
                  </div>
                )}

                <ProfileField icon={<FaUser />} label="Full Name" value={profile?.name} />
                <ProfileField icon={<FaEnvelope />} label="Email Address" value={user?.email} />
                <ProfileField icon={<FaBuilding />} label="Business Name" value={seller?.business_name} />
                <ProfileField icon={<FaPhone />} label="Phone Number" value={seller?.phone_no} />
                <ProfileField icon={<FaMapMarkerAlt />} label="City" value={seller?.city} />
                <ProfileField icon={<FaMapMarkerAlt />} label="Postal Code" value={seller?.postal_code} />
                <ProfileField icon={<FaMapMarkerAlt />} label="Address" value={seller?.address} />
                <div className="profile-field">
                  <div className="field-icon"><FaShieldAlt /></div>
                  <div className="field-content">
                    <label>Verification Status</label>
                    <span className={`inline-badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                </div>
              </div>

              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>Identity Verification</h3>
                </div>
                {hasPending && (
                  <div className="cnic-pending-notice">
                    ⏳ CNIC update pending admin approval.
                  </div>
                )}
                <ProfileField icon={<FaIdCard />} label="CNIC Number" value={seller?.cnic_number} mono />
                <CnicImages front={seller?.cnic_front} back={seller?.cnic_back} />
              </div>
            </>
          )}

          {/* ══════ BUYER VIEW ══════ */}
          {role === "buyer" && (
            <>
              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>Personal Information</h3>
                  <button className="edit-btn" onClick={openPersonalEdit}>
                    <FaEdit /> Edit
                  </button>
                </div>
                <ProfileField icon={<FaUser />} label="Full Name" value={profile?.name} />
                <ProfileField icon={<FaEnvelope />} label="Email Address" value={user?.email} />
                <div className="profile-field">
                  <div className="field-icon"><FaShieldAlt /></div>
                  <div className="field-content">
                    <label>Verification Status</label>
                    <span className={`inline-badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                </div>
              </div>

              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>Identity Verification</h3>
                  <button className="edit-btn" onClick={openCnicEdit}>
                    <FaEdit /> Edit
                  </button>
                </div>
                {hasPending && (
                  <div className="cnic-pending-notice">
                    ⏳ You have a CNIC update pending admin approval.
                  </div>
                )}
                <ProfileField icon={<FaIdCard />} label="CNIC Number" value={buyer?.cnic_number} mono />
                <CnicImages front={buyer?.cnic_front} back={buyer?.cnic_back} />
              </div>
            </>
          )}

          {/* ══════ USER VIEW ══════ */}
          {(role === "user" || !role) && (
            <>
              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>Personal Information</h3>
                  <button className="edit-btn" onClick={openPersonalEdit}>
                    <FaEdit /> Edit
                  </button>
                </div>
                <ProfileField icon={<FaUser />} label="Full Name" value={profile?.name} />
                <ProfileField icon={<FaEnvelope />} label="Email Address" value={user?.email} />
                <div className="profile-field">
                  <div className="field-icon"><FaShieldAlt /></div>
                  <div className="field-content">
                    <label>Verification Status</label>
                    <span className={`inline-badge ${badge.cls}`}>{badge.label}</span>
                  </div>
                </div>
              </div>

              <div className="profile-card cnic-prompt-card">
                <div className="cnic-prompt-icon"><FaIdCard /></div>
                <h3>Complete Your Verification</h3>
                <p>Submit your CNIC to unlock bidding and buying features.</p>
                <button className="cnic-submit-btn" onClick={() => setShowCnicModal(true)}>
                  Submit CNIC
                </button>
              </div>
            </>
          )}

        </div>

        <button className="logout-btn" onClick={handleLogout}>
          <FaSignOutAlt /> Sign Out
        </button>
      </div>

      {/* ══════ ADMIN / BUYER / USER — Name Edit Modal ══════ */}
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
                  value={personalForm.name || ""}
                  onChange={e => setPersonalForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="profile-modal-actions">
                <button className="profile-modal-cancel" onClick={() => setShowPersonalEdit(false)}>
                  Cancel
                </button>
                <button className="profile-modal-save" onClick={handleSavePersonal} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════ SELLER — Combined Edit Modal ══════ */}
      {showSellerEditModal && (
        <div className="profile-modal-overlay" onClick={() => setShowSellerEditModal(false)}>
          <div className="profile-modal profile-modal-wide" onClick={e => e.stopPropagation()}>
            <button className="profile-modal-close" onClick={() => setShowSellerEditModal(false)}>
              <FaTimes />
            </button>
            <h3 className="profile-modal-title">Edit Profile</h3>
            <p className="profile-modal-subtitle">
              Name and business name save immediately. Phone, address and CNIC changes require admin approval.
            </p>

            <div className="profile-modal-form">

              {/* Saves immediately */}
              <div className="profile-modal-section-label">
                Saves Immediately
              </div>

              <div className="profile-modal-row">
                <div className="profile-modal-field">
                  <label>Full Name</label>
                  <input className="profile-modal-input"
                    value={sellerEditForm.name || ""}
                    onChange={e => setSellerEditForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="Full name" />
                </div>
                <div className="profile-modal-field">
                  <label>Business Name</label>
                  <input className="profile-modal-input"
                    value={sellerEditForm.business_name || ""}
                    onChange={e => setSellerEditForm(p => ({ ...p, business_name: e.target.value }))}
                    placeholder="Business name" />
                </div>
              </div>

              {/* Needs approval */}
              <div className="profile-modal-section-label">
                Requires Admin Approval
              </div>

              <div className="profile-modal-row">
                <div className="profile-modal-field">
                  <label>Phone Number</label>
                  <input className="profile-modal-input"
                    value={sellerEditForm.phone_no || ""}
                    onChange={e => setSellerEditForm(p => ({ ...p, phone_no: e.target.value }))}
                    placeholder="03XX-XXXXXXX" />
                </div>
                <div className="profile-modal-field">
                  <label>City</label>
                  <input className="profile-modal-input"
                    value={sellerEditForm.city || ""}
                    onChange={e => setSellerEditForm(p => ({ ...p, city: e.target.value }))}
                    placeholder="City" />
                </div>
              </div>

              <div className="profile-modal-row">
                <div className="profile-modal-field">
                  <label>Postal Code</label>
                  <input className="profile-modal-input"
                    value={sellerEditForm.postal_code || ""}
                    onChange={e => setSellerEditForm(p => ({ ...p, postal_code: e.target.value }))}
                    placeholder="Postal code" />
                </div>
                <div className="profile-modal-field">
                  <label>Address</label>
                  <input className="profile-modal-input"
                    value={sellerEditForm.address || ""}
                    onChange={e => setSellerEditForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="Full address" />
                </div>
              </div>

              {/* CNIC */}
              <div className="profile-modal-section-label">
                Identity Verification
              </div>

              <div className="profile-modal-field">
                <label>CNIC Number</label>
                <input
                  className="profile-modal-input cnic-number-input"
                  value={sellerEditForm.cnic_number || ""}
                  onChange={e => {
                    let val = e.target.value.replace(/[^0-9]/g, "");
                    if (val.length > 5 && val.length <= 12) val = val.slice(0, 5) + "-" + val.slice(5);
                    else if (val.length > 12) val = val.slice(0, 5) + "-" + val.slice(5, 12) + "-" + val.slice(12, 13);
                    setSellerEditForm(p => ({ ...p, cnic_number: val }));
                  }}
                  maxLength={15}
                  placeholder="XXXXX-XXXXXXX-X"
                />
              </div>

              <div className="profile-modal-upload-row">
                <div className="profile-modal-upload-box">
                  <label>CNIC Front</label>
                  <label className="profile-modal-upload-area" htmlFor="seller-edit-front">
                    {frontPreview ? (
                      <>
                        <img src={frontPreview} alt="Front" className="profile-modal-upload-preview" />
                        <div className="profile-modal-upload-overlay">
                          <FaCheckCircle style={{ color: "var(--color-success)", fontSize: 20 }} />
                          <span>Change</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <FaUpload className="profile-modal-upload-icon" />
                        <span>Upload Front</span>
                      </>
                    )}
                  </label>
                  <input id="seller-edit-front" type="file" accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => handleSellerFileChange(e, "front")} />
                </div>

                <div className="profile-modal-upload-box">
                  <label>CNIC Back</label>
                  <label className="profile-modal-upload-area" htmlFor="seller-edit-back">
                    {backPreview ? (
                      <>
                        <img src={backPreview} alt="Back" className="profile-modal-upload-preview" />
                        <div className="profile-modal-upload-overlay">
                          <FaCheckCircle style={{ color: "var(--color-success)", fontSize: 20 }} />
                          <span>Change</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <FaUpload className="profile-modal-upload-icon" />
                        <span>Upload Back</span>
                      </>
                    )}
                  </label>
                  <input id="seller-edit-back" type="file" accept="image/*"
                    style={{ display: "none" }}
                    onChange={e => handleSellerFileChange(e, "back")} />
                </div>
              </div>

              <div className="profile-modal-actions">
                <button className="profile-modal-cancel" onClick={() => setShowSellerEditModal(false)}>
                  Cancel
                </button>
                <button className="profile-modal-save" onClick={handleSaveSellerEdit} disabled={saving}>
                  {saving ? "Submitting..." : "Save & Submit"}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ══════ BUYER — CNIC Edit Modal ══════ */}
      {showCnicEdit && (
        <div className="profile-modal-overlay" onClick={() => setShowCnicEdit(false)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <button className="profile-modal-close" onClick={() => setShowCnicEdit(false)}>
              <FaTimes />
            </button>
            <h3 className="profile-modal-title">Edit CNIC Information</h3>
            <p className="profile-modal-subtitle">
              Changes will be submitted for admin approval. Your current info stays active until approved.
            </p>

            <div className="profile-modal-form">
              <div className="profile-modal-field">
                <label>CNIC Number</label>
                <input
                  className="profile-modal-input cnic-number-input"
                  value={cnicForm.cnic_number}
                  onChange={e => {
                    let val = e.target.value.replace(/[^0-9]/g, "");
                    if (val.length > 5 && val.length <= 12) val = val.slice(0, 5) + "-" + val.slice(5);
                    else if (val.length > 12) val = val.slice(0, 5) + "-" + val.slice(5, 12) + "-" + val.slice(12, 13);
                    setCnicForm(p => ({ ...p, cnic_number: val }));
                  }}
                  maxLength={15}
                  placeholder="XXXXX-XXXXXXX-X"
                />
              </div>

              <div className="profile-modal-upload-row">
                <div className="profile-modal-upload-box">
                  <label>Front Side</label>
                  <label className="profile-modal-upload-area" htmlFor="edit-cnic-front">
                    {buyerFrontPreview ? (
                      <>
                        <img src={buyerFrontPreview} alt="Front" className="profile-modal-upload-preview" />
                        <div className="profile-modal-upload-overlay">
                          <FaCheckCircle style={{ color: "var(--color-success)", fontSize: 20 }} />
                          <span>Change</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <FaUpload className="profile-modal-upload-icon" />
                        <span>Upload Front</span>
                      </>
                    )}
                  </label>
                  <input id="edit-cnic-front" type="file" accept="image/*"
                    style={{ display: "none" }} onChange={e => handleCnicFileChange(e, "front")} />
                </div>

                <div className="profile-modal-upload-box">
                  <label>Back Side</label>
                  <label className="profile-modal-upload-area" htmlFor="edit-cnic-back">
                    {buyerBackPreview ? (
                      <>
                        <img src={buyerBackPreview} alt="Back" className="profile-modal-upload-preview" />
                        <div className="profile-modal-upload-overlay">
                          <FaCheckCircle style={{ color: "var(--color-success)", fontSize: 20 }} />
                          <span>Change</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <FaUpload className="profile-modal-upload-icon" />
                        <span>Upload Back</span>
                      </>
                    )}
                  </label>
                  <input id="edit-cnic-back" type="file" accept="image/*"
                    style={{ display: "none" }} onChange={e => handleCnicFileChange(e, "back")} />
                </div>
              </div>

              <div className="profile-modal-actions">
                <button className="profile-modal-cancel" onClick={() => setShowCnicEdit(false)}>
                  Cancel
                </button>
                <button className="profile-modal-save" onClick={handleSaveCnic} disabled={saving}>
                  {saving ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CnicModal for user role */}
      {showCnicModal && (
        <CnicModal closeModal={() => { setShowCnicModal(false); fetchAllData(); }} />
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
        {front ? <img src={front} alt="CNIC Front" className="cnic-img" /> : <div className="cnic-placeholder">No image</div>}
      </div>
    </div>
    <div className="cnic-image-block">
      <label>Back Side</label>
      <div className="cnic-img-wrapper">
        {back ? <img src={back} alt="CNIC Back" className="cnic-img" /> : <div className="cnic-placeholder">No image</div>}
      </div>
    </div>
  </div>
);

export default ProfilePage;