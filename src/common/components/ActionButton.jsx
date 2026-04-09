import "../styles/actionButton.css";

const ActionButton = ({ label, variant = "secondary", onClick }) => {
  return (
    <button className={`button ${variant}`} onClick={onClick}>
      {label}
    </button>
  );
};

export default ActionButton;
