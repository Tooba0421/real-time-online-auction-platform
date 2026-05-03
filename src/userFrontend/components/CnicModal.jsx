import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import { useAuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "../styles/auth.css";

const CnicModal = ({ closeModal }) => {

  const { user } = useAuthContext();

  const [cnic, setCnic] = useState("");
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      toast.error("User not logged in");
      return;
    }

    if (!front || !back) {
      toast.error("Please upload both CNIC images");
      return;
    }

    try {
      setLoading(true);

      // Step 1: Upload CNIC front image
      const frontPath = `buyers/${user.id}/front`;
      const { error: frontError } = await supabase.storage
        .from('cnic-images')
        .upload(frontPath, front, { upsert: true });

      if (frontError) {
        toast.error("Error uploading front image");
        console.error(frontError);
        return;
      }

      // Step 2: Upload CNIC back image
      const backPath = `buyers/${user.id}/back`;
      const { error: backError } = await supabase.storage
        .from('cnic-images')
        .upload(backPath, back, { upsert: true });

      if (backError) {
        toast.error("Error uploading back image");
        console.error(backError);
        return;
      }

      // Step 3: Get public URLs
      const { data: frontURLData } = supabase.storage
        .from('cnic-images')
        .getPublicUrl(frontPath);

      const { data: backURLData } = supabase.storage
        .from('cnic-images')
        .getPublicUrl(backPath);

      const frontURL = frontURLData.publicUrl;
      const backURL = backURLData.publicUrl;

      // Step 4: Check if buyer record already exists
      const { data: existingBuyer } = await supabase
        .from('buyers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingBuyer) {
        // Update existing buyer record
        const { error: updateError } = await supabase
          .from('buyers')
          .update({
            cnic_number: cnic,
            cnic_front: frontURL,
            cnic_back: backURL,
            is_verified: 'pending'
          })
          .eq('user_id', user.id);

        if (updateError) {
          toast.error("Error saving CNIC data");
          console.error(updateError);
          return;
        }

      } else {
        // Create new buyer record
        const { error: insertError } = await supabase
          .from('buyers')
          .insert({
            user_id: user.id,
            cnic_number: cnic,
            cnic_front: frontURL,
            cnic_back: backURL,
            is_verified: 'pending'
          });

        if (insertError) {
          toast.error("Error saving CNIC data");
          console.error(insertError);
          return;
        }
      }

      // Step 5: Update id_verified in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ id_verified: 'pending' })
        .eq('id', user.id);

      if (profileError) {
        toast.error("Error updating profile");
        console.error(profileError);
        return;
      }

      // Step 6: Notify admin
      const { data: adminData } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .single();

      if (adminData) {
        await supabase
          .from('notifications')
          .insert({
            user_id: adminData.id,
            title: 'New CNIC Verification Request',
            message: `A buyer has submitted their CNIC for verification.`,
            type: 'approval',
            notification_for: 'admin',
            is_read: false
          });
      }

      toast.success("CNIC submitted! Waiting for admin approval.");
      closeModal();

    } catch (err) {
      console.error(err);
      toast.error("Error submitting CNIC");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal seller-modal">

        <FaTimes className="close-icon" onClick={closeModal} />

        <h2>CNIC Verification</h2>

        <form className="auth-form" onSubmit={handleSubmit}>

          <input
            className="auth-input"
            type="text"
            placeholder="CNIC Number"
            required
            value={cnic}
            onChange={(e) => setCnic(e.target.value)}
          />

          <label>CNIC Front Image</label>
          <input
            type="file"
            accept="image/*"
            required
            onChange={(e) => setFront(e.target.files[0])}
          />

          <label>CNIC Back Image</label>
          <input
            type="file"
            accept="image/*"
            required
            onChange={(e) => setBack(e.target.files[0])}
          />

          <button className="auth-btn" disabled={loading}>
            {loading ? "Submitting..." : "Submit"}
          </button>

        </form>
      </div>
    </div>
  );
};

export default CnicModal;