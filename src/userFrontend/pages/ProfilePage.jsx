import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaEdit, FaUser, FaEnvelope, FaIdCard, FaShieldAlt,
  FaSignOutAlt, FaTimes, FaUpload, FaCheckCircle,
  FaBuilding, FaPhone, FaMapMarkerAlt,
} from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { logout } from "../../supabase/authService";
import { useAuthContext } from "../../context/AuthContext";
import CnicModal from "../components/CnicModal";
import toast from "react-hot-toast";
import "../styles/profile.css";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshProfile } = useAuthContext();

  const [profile, setProfile] = useState(null);
  const [seller, setSeller] = useState(null);
  const [buyer, setBuyer] = useState(null);
  const [pendingChange, setPendingChange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [saving, setSaving] = useState(false);

  const [showPersonalEdit, setShowPersonalEdit] = useState(false);
  const [showSellerBasicEdit, setShowSellerBasicEdit] = useState(false);
  const [showSellerApprovalEdit, setShowSellerApprovalEdit] = useState(false);
  const [showCnicEdit, setShowCnicEdit] = useState(false);
  const [showCnicModal, setShowCnicModal] = useState(false);

  const [personalForm, setPersonalForm] = useState({});
  const [sellerBasicForm, setSellerBasicForm] = useState({});
  const [sellerApprovalForm, setSellerApprovalForm] = useState({});
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [cnicForm, setCnicForm] = useState({ cnic_number: "", front: null, back: null });
  const [buyerFrontPreview, setBuyerFrontPreview] = useState(null);
  const [buyerBackPreview, setBuyerBackPreview] = useState(null);

  const [sellerCnicUrls, setSellerCnicUrls] = useState({ front: null, back: null });
  const [buyerCnicUrls, setBuyerCnicUrls] = useState({ front: null, back: null });

  const fetchBuyerCnicUrls = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: f }, { data: b }] = await Promise.all([
        supabase.storage.from("cnic-images").createSignedUrl(`buyers/${user.id}/front`, 3600),
        supabase.storage.from("cnic-images").createSignedUrl(`buyers/${user.id}/back`, 3600),
      ]);
      setBuyerCnicUrls({ front: f?.signedUrl || null, back: b?.signedUrl || null });
    } catch (_) { }
  }, [user]);

  const fetchSellerCnicUrls = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: f }, { data: b }] = await Promise.all([
        supabase.storage.from("cnic-images").createSignedUrl(`sellers/${user.id}/front`, 3600),
        supabase.storage.from("cnic-images").createSignedUrl(`sellers/${user.id}/back`, 3600),
      ]);
      setSellerCnicUrls({ front: f?.signedUrl || null, back: b?.signedUrl || null });
    } catch (_) { }
  }, [user]);

  const fetchAllData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data: profileData } = await supabase
        .from("profiles").select("*").eq("id", user.id).single();
      setProfile(profileData);
      setRole(profileData?.role);

      await Promise.all([
        profileData?.role === "seller"
          ? supabase.from("sellers").select("*").eq("user_id", user.id).single()
            .then(({ data }) => { if (data) setSeller(data); })
            .then(() => fetchSellerCnicUrls())
          : Promise.resolve(),

        profileData?.role === "buyer"
          ? supabase.from("buyers").select("*").eq("user_id", user.id).single()
            .then(({ data }) => { if (data) setBuyer(data); })
            .then(() => fetchBuyerCnicUrls())
          : Promise.resolve(),

        supabase.from("pending_changes")
          .select("*").eq("user_id", user.id).eq("status", "pending")
          .order("created_at", { ascending: false }).limit(1).maybeSingle()
          .then(({ data }) => setPendingChange(data || null)),
      ]);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [user, fetchSellerCnicUrls, fetchBuyerCnicUrls]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate("/"); return; }
    fetchAllData();
  }, [user, authLoading]);

  // Realtime: profiles
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-realtime-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "profiles",
        filter: `id=eq.${user.id}`,
      }, () => { fetchAllData(); refreshProfile(); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  // Realtime: sellers
  useEffect(() => {
    if (!user || role !== "seller") return;
    const channel = supabase
      .channel(`seller-realtime-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "sellers",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        supabase.from("sellers").select("*").eq("user_id", user.id).single()
          .then(({ data }) => { if (data) setSeller(data); });
        fetchSellerCnicUrls();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, role]);

  // Realtime: buyers
  useEffect(() => {
    if (!user || role !== "buyer") return;
    const channel = supabase
      .channel(`buyer-realtime-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "buyers",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        supabase.from("buyers").select("*").eq("user_id", user.id).single()
          .then(({ data }) => { if (data) setBuyer(data); });
        fetchBuyerCnicUrls();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user, role]);

  // Realtime: pending_changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`pending-changes-realtime-${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "pending_changes",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        supabase.from("pending_changes")
          .select("*").eq("user_id", user.id).eq("status", "pending")
          .order("created_at", { ascending: false }).limit(1).maybeSingle()
          .then(({ data }) => setPendingChange(data || null));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  // ── Name edit (all roles) ─────────────────────────────────────────
  const openPersonalEdit = () => {
    setPersonalForm({ name: profile?.name || "" });
    setShowPersonalEdit(true);
  };

  const handleSavePersonal = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles").update({ name: personalForm.name }).eq("id", user.id);
      if (error) { toast.error("Error updating name"); return; }
      setProfile(prev => ({ ...prev, name: personalForm.name }));
      await refreshProfile();
      setShowPersonalEdit(false);
      toast.success("Name updated successfully.");
    } catch (_) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Seller: Basic edit ────────────────────────────────────────────
  const openSellerBasicEdit = () => {
    setSellerBasicForm({
      name: profile?.name || "",
      business_name: seller?.business_name || "",
    });
    setShowSellerBasicEdit(true);
  };

  const handleSaveSellerBasic = async () => {
    try {
      setSaving(true);
      const [{ error: nameErr }, { error: bizErr }] = await Promise.all([
        supabase.from("profiles").update({ name: sellerBasicForm.name }).eq("id", user.id),
        supabase.from("sellers").update({ business_name: sellerBasicForm.business_name }).eq("user_id", user.id),
      ]);
      if (nameErr) { toast.error("Error updating name"); return; }
      if (bizErr) { toast.error("Error updating business name"); return; }
      setProfile(prev => ({ ...prev, name: sellerBasicForm.name }));
      setSeller(prev => ({ ...prev, business_name: sellerBasicForm.business_name }));
      await refreshProfile();
      setShowSellerBasicEdit(false);
      toast.success("Name and business name updated successfully.");
    } catch (_) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Seller: Contact & CNIC edit (requires admin approval) ─────────
  const openSellerApprovalEdit = () => {
    setSellerApprovalForm({
      phone_no: pendingChange?.pending_phone_no || seller?.phone_no || "",
      city: pendingChange?.pending_city || seller?.city || "",
      postal_code: pendingChange?.pending_postal_code || seller?.postal_code || "",
      address: pendingChange?.pending_address || seller?.address || "",
      cnic_number: pendingChange?.pending_cnic_number || seller?.cnic_number || "",
      front: null, back: null,
    });
    setFrontPreview(null);
    setBackPreview(null);
    setShowSellerApprovalEdit(true);
  };

  const handleSellerFileChange = (e, side) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (side === "front") {
      setSellerApprovalForm(prev => ({ ...prev, front: file }));
      setFrontPreview(preview);
    } else {
      setSellerApprovalForm(prev => ({ ...prev, back: file }));
      setBackPreview(preview);
    }
  };

  const handleSaveSellerApproval = async () => {
    try {
      setSaving(true);

      let frontPath = pendingChange?.pending_cnic_front || null;
      let backPath = pendingChange?.pending_cnic_back || null;

      if (sellerApprovalForm.front) {
        const path = `sellers/${user.id}/front_pending`;
        const { error } = await supabase.storage
          .from("cnic-images").upload(path, sellerApprovalForm.front, { upsert: true });
        if (error) { toast.error("Error uploading CNIC front"); return; }
        frontPath = path;
      }

      if (sellerApprovalForm.back) {
        const path = `sellers/${user.id}/back_pending`;
        const { error } = await supabase.storage
          .from("cnic-images").upload(path, sellerApprovalForm.back, { upsert: true });
        if (error) { toast.error("Error uploading CNIC back"); return; }
        backPath = path;
      }

      const payload = {
        user_id: user.id,
        role: "seller",
        change_type: "all",
        pending_phone_no: sellerApprovalForm.phone_no,
        pending_city: sellerApprovalForm.city,
        pending_postal_code: sellerApprovalForm.postal_code,
        pending_address: sellerApprovalForm.address,
        pending_cnic_number: sellerApprovalForm.cnic_number,
        pending_cnic_front: frontPath,
        pending_cnic_back: backPath,
        status: "pending",
      };

      if (pendingChange) {
        const { error } = await supabase.from("pending_changes")
          .update(payload).eq("id", pendingChange.id);
        if (error) { toast.error("Error submitting changes"); return; }
      } else {
        const { error } = await supabase.from("pending_changes").insert(payload);
        if (error) { toast.error("Error submitting changes"); return; }
      }

      const { data: adminData } = await supabase
        .from("profiles").select("id").eq("role", "admin").single();
      if (adminData) {
        await supabase.from("notifications").insert({
          user_id: adminData.id,
          title: "Seller Profile Update Request",
          message: "A seller has submitted updated contact and CNIC information for approval.",
          type: "approval",
          notification_for: "admin",
          is_read: false,
        });
      }

      toast.success("Changes submitted for admin approval.");
      setShowSellerApprovalEdit(false);
      fetchAllData();
    } catch (_) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Buyer: CNIC edit (requires admin approval) ────────────────────
  const openCnicEdit = () => {
    setCnicForm({
      cnic_number: pendingChange?.pending_cnic_number || buyer?.cnic_number || "",
      front: null, back: null,
    });
    setBuyerFrontPreview(null);
    setBuyerBackPreview(null);
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

      let frontPath = pendingChange?.pending_cnic_front || null;
      let backPath = pendingChange?.pending_cnic_back || null;

      if (cnicForm.front) {
        const path = `buyers/${user.id}/front_pending`;
        const { error } = await supabase.storage
          .from("cnic-images").upload(path, cnicForm.front, { upsert: true });
        if (error) { toast.error(`CNIC front upload failed: ${error.message}`); return; }
        frontPath = path;
      }

      if (cnicForm.back) {
        const path = `buyers/${user.id}/back_pending`;
        const { error } = await supabase.storage
          .from("cnic-images").upload(path, cnicForm.back, { upsert: true });
        if (error) { toast.error(`CNIC back upload failed: ${error.message}`); return; }
        backPath = path;
      }

      const payload = {
        user_id: user.id,
        role: "buyer",
        change_type: "cnic",
        pending_cnic_number: cnicForm.cnic_number,
        pending_cnic_front: frontPath,
        pending_cnic_back: backPath,
        status: "pending",
      };

      if (pendingChange) {
        const { error } = await supabase
          .from("pending_changes")
          .update(payload)
          .eq("id", pendingChange.id);
        // ✅ Show exact error message
        if (error) { toast.error(`Update failed: ${error.message}`); return; }
      } else {
        const { error } = await supabase
          .from("pending_changes")
          .insert(payload);
        // ✅ Show exact error message
        if (error) { toast.error(`Submit failed: ${error.message}`); return; }
      }

      const { data: adminData } = await supabase
        .from("profiles").select("id").eq("role", "admin").single();
      if (adminData) {
        await supabase.from("notifications").insert({
          user_id: adminData.id,
          title: "Buyer CNIC Update Request",
          message: "A buyer has submitted updated CNIC information for approval.",
          type: "approval",
          notification_for: "admin",
          is_read: false,
        });
      }

      toast.success("CNIC update submitted for admin approval.");
      setShowCnicEdit(false);
      fetchAllData();
    } catch (err) {
      toast.error(`Unexpected error: ${err?.message}`);
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

        {/* Avatar + Name */}
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

          {/* ADMIN VIEW */}
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

          {/* SELLER VIEW */}
          {role === "seller" && (
            <>
              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>Basic Information</h3>
                  <button className="edit-btn" onClick={openSellerBasicEdit}>
                    <FaEdit /> Edit
                  </button>
                </div>
                <ProfileField icon={<FaUser />} label="Full Name" value={profile?.name} />
                <ProfileField icon={<FaEnvelope />} label="Email Address" value={user?.email} />
                <ProfileField icon={<FaBuilding />} label="Business Name" value={seller?.business_name} />
              </div>

              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>Contact & Identity</h3>
                  <button className="edit-btn" onClick={openSellerApprovalEdit}>
                    <FaEdit /> Edit
                  </button>
                </div>
                {hasPending && (
                  <div className="cnic-pending-notice">
                    ⏳ You have changes pending admin approval.
                  </div>
                )}
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
                <CnicImages front={sellerCnicUrls.front} back={sellerCnicUrls.back} />
              </div>
            </>
          )}

          {/* BUYER VIEW */}
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
                <CnicImages front={buyerCnicUrls.front} back={buyerCnicUrls.back} />
              </div>
            </>
          )}

          {/* USER VIEW */}
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
                <input className="profile-modal-input"
                  value={personalForm.name || ""}
                  onChange={e => setPersonalForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name" />
              </div>
              <div className="profile-modal-actions">
                <button className="profile-modal-cancel" onClick={() => setShowPersonalEdit(false)}>Cancel</button>
                <button className="profile-modal-save" onClick={handleSavePersonal} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seller Basic Edit Modal */}
      {showSellerBasicEdit && (
        <div className="profile-modal-overlay" onClick={() => setShowSellerBasicEdit(false)}>
          <div className="profile-modal" onClick={e => e.stopPropagation()}>
            <button className="profile-modal-close" onClick={() => setShowSellerBasicEdit(false)}>
              <FaTimes />
            </button>
            <h3 className="profile-modal-title">Edit Basic Information</h3>
            <p className="profile-modal-subtitle">These changes save immediately.</p>
            <div className="profile-modal-form">
              <div className="profile-modal-field">
                <label>Full Name</label>
                <input className="profile-modal-input"
                  value={sellerBasicForm.name || ""}
                  onChange={e => setSellerBasicForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Full name" />
              </div>
              <div className="profile-modal-field">
                <label>Business Name</label>
                <input className="profile-modal-input"
                  value={sellerBasicForm.business_name || ""}
                  onChange={e => setSellerBasicForm(p => ({ ...p, business_name: e.target.value }))}
                  placeholder="Business name" />
              </div>
              <div className="profile-modal-actions">
                <button className="profile-modal-cancel" onClick={() => setShowSellerBasicEdit(false)}>Cancel</button>
                <button className="profile-modal-save" onClick={handleSaveSellerBasic} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seller Contact & CNIC Edit Modal */}
      {showSellerApprovalEdit && (
        <div className="profile-modal-overlay" onClick={() => setShowSellerApprovalEdit(false)}>
          <div className="profile-modal profile-modal-wide" onClick={e => e.stopPropagation()}>
            <button className="profile-modal-close" onClick={() => setShowSellerApprovalEdit(false)}>
              <FaTimes />
            </button>
            <h3 className="profile-modal-title">Edit Contact & Identity</h3>
            <p className="profile-modal-subtitle">
              These changes require admin approval before taking effect.
            </p>
            <div className="profile-modal-form">
              <div className="profile-modal-row">
                <div className="profile-modal-field">
                  <label>Phone Number</label>
                  <input className="profile-modal-input"
                    value={sellerApprovalForm.phone_no || ""}
                    onChange={e => setSellerApprovalForm(p => ({ ...p, phone_no: e.target.value }))}
                    placeholder="03XX-XXXXXXX" />
                </div>
                <div className="profile-modal-field">
                  <label>City</label>
                  <input className="profile-modal-input"
                    value={sellerApprovalForm.city || ""}
                    onChange={e => setSellerApprovalForm(p => ({ ...p, city: e.target.value }))}
                    placeholder="City" />
                </div>
              </div>
              <div className="profile-modal-row">
                <div className="profile-modal-field">
                  <label>Postal Code</label>
                  <input className="profile-modal-input"
                    value={sellerApprovalForm.postal_code || ""}
                    onChange={e => setSellerApprovalForm(p => ({ ...p, postal_code: e.target.value }))}
                    placeholder="Postal code" />
                </div>
                <div className="profile-modal-field">
                  <label>Address</label>
                  <input className="profile-modal-input"
                    value={sellerApprovalForm.address || ""}
                    onChange={e => setSellerApprovalForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="Full address" />
                </div>
              </div>

              <div className="profile-modal-section-label">Identity Verification</div>

              <div className="profile-modal-field">
                <label>CNIC Number</label>
                <input className="profile-modal-input cnic-number-input"
                  value={sellerApprovalForm.cnic_number || ""}
                  onChange={e => {
                    let val = e.target.value.replace(/[^0-9]/g, "");
                    if (val.length > 5 && val.length <= 12) val = val.slice(0, 5) + "-" + val.slice(5);
                    if (val.length > 12) val = val.slice(0, 5) + "-" + val.slice(5, 12) + "-" + val.slice(12, 13);
                    setSellerApprovalForm(p => ({ ...p, cnic_number: val }));
                  }}
                  maxLength={15} placeholder="XXXXX-XXXXXXX-X" />
              </div>

              <div className="profile-modal-upload-row">
                {[
                  { side: "front", label: "CNIC Front", preview: frontPreview, htmlFor: "seller-approval-front" },
                  { side: "back", label: "CNIC Back", preview: backPreview, htmlFor: "seller-approval-back" },
                ].map(({ side, label, preview, htmlFor }) => (
                  <div key={side} className="profile-modal-upload-box">
                    <label>{label}</label>
                    <label className="profile-modal-upload-area" htmlFor={htmlFor}>
                      {preview ? (
                        <>
                          <img src={preview} alt={label} className="profile-modal-upload-preview" />
                          <div className="profile-modal-upload-overlay">
                            <FaCheckCircle style={{ color: "var(--color-success)", fontSize: 20 }} />
                            <span>Change</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <FaUpload className="profile-modal-upload-icon" />
                          <span>Upload {label}</span>
                        </>
                      )}
                    </label>
                    <input id={htmlFor} type="file" accept="image/*"
                      style={{ display: "none" }}
                      onChange={e => handleSellerFileChange(e, side)} />
                  </div>
                ))}
              </div>

              <div className="profile-modal-actions">
                <button className="profile-modal-cancel" onClick={() => setShowSellerApprovalEdit(false)}>Cancel</button>
                <button className="profile-modal-save" onClick={handleSaveSellerApproval} disabled={saving}>
                  {saving ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buyer CNIC Edit Modal */}
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
                <input className="profile-modal-input cnic-number-input"
                  value={cnicForm.cnic_number}
                  onChange={e => {
                    let val = e.target.value.replace(/[^0-9]/g, "");
                    if (val.length > 5 && val.length <= 12) val = val.slice(0, 5) + "-" + val.slice(5);
                    if (val.length > 12) val = val.slice(0, 5) + "-" + val.slice(5, 12) + "-" + val.slice(12, 13);
                    setCnicForm(p => ({ ...p, cnic_number: val }));
                  }}
                  maxLength={15} placeholder="XXXXX-XXXXXXX-X" />
              </div>

              <div className="profile-modal-upload-row">
                {[
                  { side: "front", label: "Front Side", preview: buyerFrontPreview, htmlFor: "edit-cnic-front" },
                  { side: "back", label: "Back Side", preview: buyerBackPreview, htmlFor: "edit-cnic-back" },
                ].map(({ side, label, preview, htmlFor }) => (
                  <div key={side} className="profile-modal-upload-box">
                    <label>{label}</label>
                    <label className="profile-modal-upload-area" htmlFor={htmlFor}>
                      {preview ? (
                        <>
                          <img src={preview} alt={label} className="profile-modal-upload-preview" />
                          <div className="profile-modal-upload-overlay">
                            <FaCheckCircle style={{ color: "var(--color-success)", fontSize: 20 }} />
                            <span>Change</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <FaUpload className="profile-modal-upload-icon" />
                          <span>Upload {label}</span>
                        </>
                      )}
                    </label>
                    <input id={htmlFor} type="file" accept="image/*"
                      style={{ display: "none" }}
                      onChange={e => handleCnicFileChange(e, side)} />
                  </div>
                ))}
              </div>

              <div className="profile-modal-actions">
                <button className="profile-modal-cancel" onClick={() => setShowCnicEdit(false)}>Cancel</button>
                <button className="profile-modal-save" onClick={handleSaveCnic} disabled={saving}>
                  {saving ? "Submitting..." : "Submit for Approval"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCnicModal && (
        <CnicModal closeModal={() => { setShowCnicModal(false); fetchAllData(); }} />
      )}
    </div>
  );
};

// Sub-components
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
    {[
      { label: "Front Side", src: front },
      { label: "Back Side", src: back },
    ].map(({ label, src }) => (
      <div key={label} className="cnic-image-block">
        <label>{label}</label>
        <div className="cnic-img-wrapper">
          {src
            ? <img src={src} alt={label} className="cnic-img" />
            : <div className="cnic-placeholder">No image</div>}
        </div>
      </div>
    ))}
  </div>
);

export default ProfilePage;