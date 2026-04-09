import "../styles/statusBadge.css";

const StatusBadge = ({ label, type }) => {
  return <span className={`status-badge ${type}`}>{label}</span>;
};

export default StatusBadge;

