import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
import "../styles/auth.css";

const CnicModal = ({ closeModal }) => {

  const [cnic, setCnic] = useState("");
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Step 1: Get current logged in user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("User not logged in");
      return;
    }

    if (!front || !back) {
      alert("Please upload both CNIC images");
      return;
    }

    try {
      setLoading(true);

      // Step 2: Upload CNIC front image to cnic-images bucket
      const frontPath = `buyers/${user.id}/front`;
      const { error: frontError } = await supabase.storage
        .from('cnic-images')
        .upload(frontPath, front, { upsert: true });

      if (frontError) {
        alert("Error uploading front image");
        console.error(frontError);
        return;
      }

      // Step 3: Upload CNIC back image to cnic-images bucket
      const backPath = `buyers/${user.id}/back`;
      const { error: backError } = await supabase.storage
        .from('cnic-images')
        .upload(backPath, back, { upsert: true });

      if (backError) {
        alert("Error uploading back image");
        console.error(backError);
        return;
      }

      // Step 4: Get public URLs of uploaded images
      const { data: frontURLData } = supabase.storage
        .from('cnic-images')
        .getPublicUrl(frontPath);

      const { data: backURLData } = supabase.storage
        .from('cnic-images')
        .getPublicUrl(backPath);

      const frontURL = frontURLData.publicUrl;
      const backURL = backURLData.publicUrl;

      // Step 5: Check if buyer record already exists
      const { data: existingBuyer } = await supabase
        .from('buyers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existingBuyer) {
        // Step 6a: Update existing buyer record
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
          alert("Error saving CNIC data");
          console.error(updateError);
          return;
        }

      } else {
        // Step 6b: Create new buyer record
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
          alert("Error saving CNIC data");
          console.error(insertError);
          return;
        }
      }

      // Step 7: Update id_verified in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ id_verified: 'pending' })
        .eq('id', user.id);

      if (profileError) {
        console.error(profileError);
        return;
      }

      alert("CNIC submitted! Waiting for admin approval.");
      closeModal();

    } catch (err) {
      console.error(err);
      alert("Error submitting CNIC");
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