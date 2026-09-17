'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, User } from '@/types/database';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
}

const defaultUser: User = {
  id: 'admin-user-id-001',
  name: 'System Admin',
  email: 'admin@parkingco.com',
  role: 'ADMINISTRATOR',
  status: 'ACTIVE',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const demoAccounts: Record<string, { password: string; user: User }> = {
  'admin@parkingco.com': { password: 'admin123', user: defaultUser },
  'supervisor@parkingco.com': {
    password: 'supervisor123',
    user: {
      ...defaultUser,
      id: 'sup-user-id-003',
      name: 'Supervisor User',
      email: 'supervisor@parkingco.com',
      role: 'SUPERVISOR',
    },
  },
  'fieldops@parkingco.com': {
    password: 'field123',
    user: {
      ...defaultUser,
      id: 'field-user-id-002',
      name: 'Field Operator',
      email: 'fieldops@parkingco.com',
      role: 'BOB',
    },
  },
};

const AuthContext = createContext<AuthContextType>({
  user: defaultUser,
  role: 'ADMINISTRATOR',
  isAuthenticated: false,
  isLoading: true,
  login: () => ({ success: false }),
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [role, setRole] = useState<UserRole>('ADMINISTRATOR');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem('rpsmas_session');
    if (storedEmail && demoAccounts[storedEmail]) {
      const storedUser = demoAccounts[storedEmail].user;
      setUser(storedUser);
      setRole(storedUser.role);
    }
    setIsLoading(false);
  }, []);

  const login = (email: string, password: string) => {
    const account = demoAccounts[email.trim().toLowerCase()];
    if (!account || account.password !== password) {
      return { success: false, message: 'Incorrect email or password.' };
    }
    setUser(account.user);
    setRole(account.user.role);
    window.localStorage.setItem('rpsmas_session', account.user.email);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    setRole('ADMINISTRATOR');
    window.localStorage.removeItem('rpsmas_session');
  };

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated: Boolean(user), isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
