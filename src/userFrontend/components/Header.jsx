import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFavorites } from "../components/FavoritesContext";
import { products } from "../data/products";
import "../styles/header.css";
import LoginModal from "./LoginModal";
import SignupModal from "./SignupModal";
import { FaBell, FaHeart, FaSearch, FaBars } from "react-icons/fa";

const Header = () => {

  const navigate = useNavigate();
  const dropdownRef = useRef();
  const favDropdownRef = useRef();

  const [showLogin, setShowLogin] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { favorites, toggleFavorite } = useFavorites();
  const [showFav, setShowFav] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowFav(false);
      }
    };


    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    navigate(`/search?q=${searchQuery}`);
  };

  const goToHome = () => {
    navigate("/");
  };

  const goToNotifications = () => {
    navigate("/notifications");
  };

  const goToCategory = (category) => {
    navigate(`/category/${encodeURIComponent(category)}`);
  };

  return (
    <>
      <header className="main-header">

        <div className="header-left">

          {/* Hamburger (Mobile Only) */}
          <FaBars
            className="menu-icon"
            onClick={() => setShowMenu(!showMenu)}
          />

          {/* Logo */}
          <div className="logo" onClick={goToHome}>
            <img
              src="https://i.pravatar.cc/40?img=12"
              alt="Auctions"
              className="logo-pic"
            />
            <h4 className="logo-name">Auctions</h4>
          </div>

        </div>


        <form className="search-box mobile-search" onSubmit={handleSearch}>
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Search auctions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>


        <div className="header-actions">
          <div className="icons">

            {/* <FaSearch
              className="header-icon mobile-search-icon"
              onClick={() => setShowSearch(!showSearch)}
            /> */}

            <div className="fav-wrapper" ref={dropdownRef}>
              <FaHeart
                className="header-icon"
                onClick={() => setShowFav(!showFav)}
              />

              {showFav && (
                <div className="fav-dropdown">

                  {favorites.length > 0 ? (
                    favorites.map(item => (
                      <div
                        key={item.id}
                        className="fav-item"
                        onClick={() =>
                          navigate(`/product/${item.id}`, {
                            state: { product: item, products }
                          })
                        }
                      >

                        <img src={item.image} alt={item.title} />

                        <div className="fav-info">
                          <p>{item.title}</p>
                          <span>PKR {item.currentBid.toLocaleString()}</span>
                        </div>

                        <FaHeart
                          className="remove-heart"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(item);
                          }}
                        />

                      </div>
                    ))
                  ) : (
                    <p className="empty">No favorites yet</p>
                  )}

                </div>
              )}

            </div>

            <FaBell className="header-icon" onClick={goToNotifications} />
          </div>

          <button
            className="header-btn"
            onClick={() => setShowLogin(true)}
          >
            Login
          </button>

          <button
            className="signup-btn"
            onClick={() => setShowSignup(true)}
          >
            Sign Up
          </button>


        </div>

      </header>

      {/* NAV */}
      <nav className={`navBar ${showMenu ? "active" : ""}`}>
        <span onClick={goToHome}>Home</span>
        <span className="dropdown-title">Category
          <div className="dropdown-menu">
            <span onClick={() => goToCategory("Jewelry")}>Jewelry</span>
            <span onClick={() => goToCategory("Antiques")}>Antiques</span>
            <span onClick={() => goToCategory("Furniture")}>Furniture</span>
            <span onClick={() => goToCategory("Electronics")}>Electronics</span>
            <span onClick={() => goToCategory("Interiors")}>Interiors</span>
            <span onClick={() => goToCategory("Artwork")}>Artwork</span>
            <span onClick={() => goToCategory("Music,Movies & Cameras")}>Music,Movies & Cameras</span>
            <span onClick={() => goToCategory("Coins & Stamps")}>Coins & Stamps</span>
            <span onClick={() => goToCategory("Fashion")}>Fashion</span>
            <span onClick={() => goToCategory("Toys & Models")}>Toys & Models</span>
            <span onClick={() => goToCategory("Luxury Watches")}>Luxury Watches</span>
          </div>
        </span>
        <span onClick={() => navigate("/auctions")}>Auctions</span>
        <span onClick={() => navigate("/how-to-bid")}>
          How to Bid
        </span>
      </nav>

      {/* LOGIN MODAL */}
      {showLogin && (
        <LoginModal
          closeModal={() => setShowLogin(false)}
          openSignup={() => {
            setShowLogin(false);
            setShowSignup(true);
          }}
        />
      )}

      {/* SIGNUP MODAL */}
      {showSignup && (
        <SignupModal
          closeModal={() => setShowSignup(false)}
          openLogin={() => {
            setShowSignup(false);
            setShowLogin(true);
          }}
        />
      )}
    </>
  );
};

export default Header;