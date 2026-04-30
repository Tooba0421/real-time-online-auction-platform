import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaEdit, FaUser, FaEnvelope, FaIdCard, FaShieldAlt, FaSignOutAlt, FaCamera, FaTrash, FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import "../styles/profile.css";

const ProfilePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef();

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [buyer, setBuyer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  // Avatar popup state
  const [showAvatarPopup, setShowAvatarPopup] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      setUser(user);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData);
      setNewName(profileData?.name || "");

      const { data: buyerData } = await supabase
        .from("buyers")
        .select("*")
        .eq("user_id", user.id)
        .single();

      setBuyer(buyerData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Avatar: Change Image ──
  const handleChangeImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setAvatarLoading(true);

      const filePath = `avatars/${user.id}/avatar`;

      // Upload (upsert replaces previous image)
      const { error: uploadError } = await supabase.storage
        .from("profile-images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        alert("Error uploading image");
        console.error(uploadError);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("profile-images")
        .getPublicUrl(filePath);

      const avatarUrl = urlData.publicUrl;

      // Save URL to profiles table
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

      if (updateError) {
        alert("Error saving avatar");
        console.error(updateError);
        return;
      }

      // Update local state
      setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }));
      setShowAvatarPopup(false);

    } catch (err) {
      console.error(err);
    } finally {
      setAvatarLoading(false);
    }
  };

  // ── Avatar: Remove Image ──
  const handleRemoveImage = async () => {
    try {
      setAvatarLoading(true);

      const filePath = `avatars/${user.id}/avatar`;

      // Delete from storage
      await supabase.storage
        .from("profile-images")
        .remove([filePath]);

      // Set avatar_url to null in profiles
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);

      if (error) {
        alert("Error removing avatar");
        return;
      }

      setProfile((prev) => ({ ...prev, avatar_url: null }));
      setShowAvatarPopup(false);

    } catch (err) {
      console.error(err);
    } finally {
      setAvatarLoading(false);
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

      if (error) { alert("Error updating name"); return; }

      setProfile((prev) => ({ ...prev, name: newName }));
      setEditMode(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const getVerificationBadge = (status) => {
    if (!status || status === "unverified") return { label: "Not Verified", cls: "badge-unverified" };
    if (status === "pending") return { label: "Pending Review", cls: "badge-pending" };
    if (status === "verified") return { label: "Verified", cls: "badge-verified" };
    return { label: status, cls: "badge-unverified" };
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="profile-spinner" />
        <p>Loading your profile...</p>
      </div>
    );
  }

  const badge = getVerificationBadge(profile?.id_verified);
  const hasCnic = buyer && buyer.cnic_number;

  return (
    <div className="profile-page">
      <div className="profile-bg-top" />

      <div className="profile-container">

        {/* Avatar Section */}
        <div className="profile-avatar-section">
          <div className="profile-avatar" onClick={() => setShowAvatarPopup(true)}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" className="avatar-img" />
            ) : (
              <FaUser className="avatar-icon" />
            )}
            <div className="avatar-camera-btn">
              <FaCamera />
            </div>
          </div>
          <div className="profile-name-block">
            <h2 className="profile-display-name">{profile?.name || "Anonymous User"}</h2>
            <span className={`profile-badge ${badge.cls}`}>
              <FaShieldAlt /> {badge.label}
            </span>
          </div>
        </div>

        {/* ── Avatar Popup ── */}
        {showAvatarPopup && (
          <div className="avatar-popup-overlay" onClick={() => setShowAvatarPopup(false)}>
            <div className="avatar-popup" onClick={(e) => e.stopPropagation()}>

              <button className="avatar-popup-close" onClick={() => setShowAvatarPopup(false)}>
                <FaTimes />
              </button>

              <h3 className="avatar-popup-title">Profile Photo</h3>

              {/* Preview circle */}
              <div className="avatar-popup-preview">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Preview" />
                ) : (
                  <FaUser className="avatar-popup-placeholder" />
                )}
              </div>

              {avatarLoading ? (
                <div className="avatar-popup-loading">
                  <div className="profile-spinner" />
                  <p>Updating...</p>
                </div>
              ) : (
                <div className="avatar-popup-actions">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleChangeImage}
                  />

                  <button
                    className="avatar-action-btn change-btn"
                    onClick={() => fileInputRef.current.click()}
                  >
                    <FaCamera /> Change Photo
                  </button>

                  {profile?.avatar_url && (
                    <button
                      className="avatar-action-btn remove-btn"
                      onClick={handleRemoveImage}
                    >
                      <FaTrash /> Remove Photo
                    </button>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

        {/* Info Cards */}
        <div className="profile-cards">

          {/* Personal Info Card */}
          <div className="profile-card">
            <div className="profile-card-header">
              <h3>Personal Information</h3>
              {!editMode && (
                <button className="edit-btn" onClick={() => setEditMode(true)}>
                  <FaEdit /> Edit
                </button>
              )}
            </div>

            <div className="profile-field">
              <div className="field-icon"><FaUser /></div>
              <div className="field-content">
                <label>Full Name</label>
                {editMode ? (
                  <div className="edit-row">
                    <input
                      className="profile-edit-input"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Enter your name"
                    />
                    <button className="save-btn" onClick={handleSaveName} disabled={saving}>
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button className="cancel-btn" onClick={() => { setEditMode(false); setNewName(profile?.name || ""); }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <span>{profile?.name || "—"}</span>
                )}
              </div>
            </div>

            <div className="profile-field">
              <div className="field-icon"><FaEnvelope /></div>
              <div className="field-content">
                <label>Email Address</label>
                <span>{user?.email || "—"}</span>
              </div>
            </div>

            <div className="profile-field">
              <div className="field-icon"><FaShieldAlt /></div>
              <div className="field-content">
                <label>Verification Status</label>
                <span className={`inline-badge ${badge.cls}`}>{badge.label}</span>
              </div>
            </div>
          </div>

          {/* CNIC Card */}
          {hasCnic ? (
            <div className="profile-card">
              <div className="profile-card-header">
                <h3>Identity Verification</h3>
                <span className={`profile-badge ${badge.cls}`}>
                  <FaShieldAlt /> {badge.label}
                </span>
              </div>

              <div className="profile-field">
                <div className="field-icon"><FaIdCard /></div>
                <div className="field-content">
                  <label>CNIC Number</label>
                  <span className="cnic-number">{buyer.cnic_number}</span>
                </div>
              </div>

              <div className="cnic-images-section">
                <div className="cnic-image-block">
                  <label>Front Side</label>
                  <div className="cnic-img-wrapper">
                    {buyer.cnic_front ? (
                      <img src={buyer.cnic_front} alt="CNIC Front" className="cnic-img" />
                    ) : (
                      <div className="cnic-placeholder">No image</div>
                    )}
                  </div>
                </div>
                <div className="cnic-image-block">
                  <label>Back Side</label>
                  <div className="cnic-img-wrapper">
                    {buyer.cnic_back ? (
                      <img src={buyer.cnic_back} alt="CNIC Back" className="cnic-img" />
                    ) : (
                      <div className="cnic-placeholder">No image</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="profile-card cnic-prompt-card">
              <div className="cnic-prompt-icon"><FaIdCard /></div>
              <h3>Complete Your Verification</h3>
              <p>Submit your CNIC to unlock bidding and buying features.</p>
              <button className="cnic-submit-btn" onClick={() => navigate("/verify-cnic")}>
                Submit CNIC
              </button>
            </div>
          )}

        </div>

        <button className="logout-btn" onClick={handleLogout}>
          <FaSignOutAlt /> Sign Out
        </button>

      </div>
    </div>
  );
};

export default ProfilePage;


// import { useNavigate } from "react-router-dom";
// import { FaEdit, FaUser, FaEnvelope, FaIdCard, FaShieldAlt, FaSignOutAlt, FaCamera } from "react-icons/fa";

// import frontSide from "../../assets/frontSide.jpeg";
// import backSide from "../../assets/backSide.jpeg";
// import "../styles/profile.css";

// const ProfilePage = () => {
//   const navigate = useNavigate();

//   // Static test data
//   const profile = {
//     name: "Ahmed Raza",
//     email: "ahmed.raza@gmail.com",
//     cnic_number: "42101-1234567-8",
//     cnic_front: frontSide,
//     cnic_back: backSide,
//     id_verified: "verified",
//   };

//   return (
//     <div className="profile-page">
//       <div className="profile-bg-top" />

//       <div className="profile-container">

//         {/* Avatar Section */}
//         <div className="profile-avatar-section">
//           <div className="profile-avatar">
//             <FaUser className="avatar-icon" />
//             <div className="avatar-camera-btn">
//               <FaCamera />
//             </div>
//           </div>
//           <div className="profile-name-block">
//             <h2 className="profile-display-name">{profile.name}</h2>
//             <span className="profile-badge badge-verified">
//               <FaShieldAlt /> Verified
//             </span>
//           </div>
//         </div>

//         <div className="profile-cards">

//           {/* Personal Info Card */}
//           <div className="profile-card">
//             <div className="profile-card-header">
//               <h3>Personal Information</h3>
//               <button className="edit-btn">
//                 <FaEdit /> Edit
//               </button>
//             </div>

//             <div className="profile-field">
//               <div className="field-icon"><FaUser /></div>
//               <div className="field-content">
//                 <label>Full Name</label>
//                 <span>{profile.name}</span>
//               </div>
//             </div>

//             <div className="profile-field">
//               <div className="field-icon"><FaEnvelope /></div>
//               <div className="field-content">
//                 <label>Email Address</label>
//                 <span>{profile.email}</span>
//               </div>
//             </div>

//             <div className="profile-field">
//               <div className="field-icon"><FaShieldAlt /></div>
//               <div className="field-content">
//                 <label>Verification Status</label>
//                 <span className="inline-badge badge-verified">Verified</span>
//               </div>
//             </div>
//           </div>

//           {/* CNIC Card */}
//           <div className="profile-card">
//             <div className="profile-card-header">
//               <h3>Identity Verification</h3>
//               <span className="profile-badge badge-verified">
//                 <FaShieldAlt /> Verified
//               </span>
//             </div>

//             <div className="profile-field">
//               <div className="field-icon"><FaIdCard /></div>
//               <div className="field-content">
//                 <label>CNIC Number</label>
//                 <span className="cnic-number">{profile.cnic_number}</span>
//               </div>
//             </div>

//             <div className="cnic-images-section">
//               <div className="cnic-image-block">
//                 <label>Front Side</label>
//                 <div className="cnic-img-wrapper">
//                   <img src={profile.cnic_front} alt="CNIC Front" className="cnic-img" />
//                 </div>
//               </div>
//               <div className="cnic-image-block">
//                 <label>Back Side</label>
//                 <div className="cnic-img-wrapper">
//                   <img src={profile.cnic_back} alt="CNIC Back" className="cnic-img" />
//                 </div>
//               </div>
//             </div>
//           </div>

//         </div>

//         {/* Logout */}
//         <button className="logout-btn" onClick={() => navigate("/")}>
//           <FaSignOutAlt /> Sign Out
//         </button>

//       </div>
//     </div>
//   );
// };

// export default ProfilePage;