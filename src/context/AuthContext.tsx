'use client';

import React, { createContext, useContext, useState } from 'react';
import { UserRole, User } from '@/types/database';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => { success: boolean; message?: string };
  logout: () => void;
}

const adminLogin = (process.env.NEXT_PUBLIC_ADMIN_USERNAME || 'Admin').trim().toLowerCase();
const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'Admin@hispeedcity';
const fieldOperatorLogin = (process.env.NEXT_PUBLIC_FIELD_OPERATOR_USERNAME || 'field').trim().toLowerCase();
const fieldOperatorPassword = process.env.NEXT_PUBLIC_FIELD_OPERATOR_PASSWORD || 'field@hispeedcity';

const defaultUser: User = {
  id: 'admin-user-id-001',
  name: 'System Admin',
  email: adminLogin,
  role: 'ADMINISTRATOR',
  status: 'ACTIVE',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const fieldOperatorUser: User = {
  id: 'field-operator-user-id-001',
  name: 'Field Operator',
  email: fieldOperatorLogin,
  role: 'BOB',
  status: 'ACTIVE',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const authorizedAccounts: Record<string, { password: string; user: User }> = {
  [adminLogin]: { password: adminPassword, user: defaultUser },
  [fieldOperatorLogin]: { password: fieldOperatorPassword, user: fieldOperatorUser },
};

const getPersistedSession = () => {
  if (typeof window === 'undefined') return null;
  const storedEmail = window.localStorage.getItem('rpsmas_session');
  if (!storedEmail) return null;
  const normalized = storedEmail.toLowerCase();
  return authorizedAccounts[normalized] ? authorizedAccounts[normalized].user : null;
};

const AuthContext = createContext<AuthContextType>({
  user: defaultUser,
  role: 'ADMINISTRATOR',
  isAuthenticated: false,
  isLoading: false,
  login: () => ({ success: false }),
  logout: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [role, setRole] = useState<UserRole>(() => getPersistedSession()?.role || 'ADMINISTRATOR');
  const [user, setUser] = useState<User | null>(() => getPersistedSession());
  const isLoading = false;

  const login = (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const account = authorizedAccounts[normalizedEmail];

    if (!account || account.password !== password) {
      return { success: false, message: 'Invalid login details. Use an authorized administrator or field operator account.' };
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
