import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaUser } from "react-icons/fa";
import { useFavorites } from "../components/FavoritesContext";
import { products } from "../data/products";
import "../styles/header.css";
import LoginModal from "./LoginModal";
import SignupModal from "./SignupModal";
import { FaBell, FaHeart, FaSearch, FaBars, FaUserCircle } from "react-icons/fa";
import { supabase } from "../../supabase/supabase";
// Add these imports
import ForgotPasswordModal from "./ForgotPasswordModal";
import ResetPasswordModal from "./ResetPasswordModal";


// Update handleForgotPassword in LoginModal — pass prop instead:
// In your LoginModal, change onClick to call openForgotPassword prop

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

  // Add these states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  // Auth state
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Listen to Supabase auth changes
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      setAuthChecked(true);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutsideMenu = (e) => {
      if (!e.target.closest(".navBar") && !e.target.closest(".menu-icon")) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutsideMenu);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutsideMenu);
    };
  }, [showMenu]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/search?q=${searchQuery}`);
  };

  const goToHome = () => navigate("/");
  const goToNotifications = () => navigate("/notifications");
  const goToCategory = (category) => navigate(`/category/${encodeURIComponent(category)}`);

  // Profile icon click logic:
  // - Not signed up / no account → open Signup modal
  // - Has account but not logged in → open Login modal
  // - Logged in → go to profile page
  const handleProfileClick = async () => {
    if (!authChecked) return; // wait for auth check

    if (authUser) {
      // Logged in → go to profile
      navigate("/profile");
      setShowMenu(false);
    } else {
      // Check if there's a stored session hint (not logged in but had account)
      // For simplicity: if no user at all, show signup. 
      // If you want "was signed up but logged out" → show login instead:
      // We'll open Login by default when not logged in (they can switch to signup from there).
      setShowLogin(true);
    }
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

            {/* ── Profile Icon ── */}
            <div className="profile-icon-wrapper" onClick={handleProfileClick} title="Profile">
              {authUser ? (
                <div className="profile-icon-avatar">
                  {/* Show first letter of email or name as avatar */}
                  {authUser.email?.charAt(0).toUpperCase()}
                </div>
              ) : (
                <FaUser className="header-icon profile-icon" />
              )}
            </div>

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

      {/* OVERLAY */}
      {showMenu && <div className="sidebar-overlay" onClick={() => setShowMenu(false)}></div>}

      {/* NAV / SIDEBAR */}
      <nav className={`navBar ${showMenu ? "active" : ""}`}>

        <div className="sidebar-header">
          <p className="back-btn" onClick={() => setShowMenu(false)}><FaArrowLeft /></p>
          <h3>Menu</h3>
        </div>

        <span onClick={() => { goToHome(); setShowMenu(false); }}>Home</span>

        <span className="dropdown-title">Category
          <div className="dropdown-category">
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

        <div className="mobile-category">
          <span
            className="dropdown-toggle"
            onClick={() => setShowSearch(!showSearch)}
          >
            Category
          </span>

          {showSearch && (
            <div className="mobile-dropdown">
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
          )}
        </div>

        <span onClick={() => { navigate("/auctions"); setShowMenu(false); }}>Auctions</span>
        <span onClick={() => { navigate("/how-to-bid"); setShowMenu(false); }}>How to Bid</span>

      </nav>

      {/* LOGIN MODAL */}
      {showLogin && (
        <LoginModal
          closeModal={() => setShowLogin(false)}
          openSignup={() => {
            setShowLogin(false);
            setShowSignup(true);
          }}
          openForgotPassword={() => {
            setShowLogin(false);
            setShowForgotPassword(true);
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

      {/* FORGOT PASSWORD MODAL */}
      {showForgotPassword && (
        <ForgotPasswordModal
          closeModal={() => setShowForgotPassword(false)}
          openLogin={() => {
            setShowForgotPassword(false);
            setShowLogin(true);
          }}
        />
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetPassword && (
        <ResetPasswordModal
          closeModal={() => setShowResetPassword(false)}
        />
      )}
    </>
  );
};

export default Header;
