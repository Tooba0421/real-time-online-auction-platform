import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  
  const login = (email, password) => {
    // Your login logic
    setUser({
      id: 1,
      name: 'Admin',
      email: 'admin@auction.com',
      role: 'admin' // or 'seller', 'buyer'
    });
  };
  
  const logout = () => {
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};