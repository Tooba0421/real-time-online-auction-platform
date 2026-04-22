import { useState } from "react";
import { FaTimes } from "react-icons/fa";
import { auth, db, storage } from "../../firebase/firebase";
import { collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import "../styles/auth.css";

const CnicModal = ({ closeModal }) => {

  const [cnic, setCnic] = useState("");
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = auth.currentUser;

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

      // 🔥 1. Upload FRONT image
      const frontRef = ref(storage, `cnic/${user.uid}/front`);
      await uploadBytes(frontRef, front);
      const frontURL = await getDownloadURL(frontRef);

      // 🔥 2. Upload BACK image
      const backRef = ref(storage, `cnic/${user.uid}/back`);
      await uploadBytes(backRef, back);
      const backURL = await getDownloadURL(backRef);

      // 🔥 3. Get user document
      const q = query(collection(db, "users"), where("uid", "==", user.uid));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("User not found");
        return;
      }

      const docRef = snapshot.docs[0].ref;

      // 🔥 4. Update Firestore
      await updateDoc(docRef, {
        cnicNumber: cnic,
        cnicFront: frontURL,
        cnicBack: backURL,
        idVerified: "pending",
      });

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

          <input
            type="file"
            required
            onChange={(e) => setFront(e.target.files[0])}
          />

          <input
            type="file"
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