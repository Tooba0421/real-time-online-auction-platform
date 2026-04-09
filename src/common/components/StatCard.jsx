import "../styles/statCard.css";

const StatCard = ({ title, value, subtitle }) => {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-title">{title}</span>
      </div>

      <div className="stat-card-body">
        <h2 className="stat-card-value">{value}</h2>
        <small className="stat-card-subtitle">{subtitle}</small>
      </div>
    </div>
  );
};

export default StatCard;
