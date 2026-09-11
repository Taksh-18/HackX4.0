import React, { createContext, useContext, useState } from 'react';

type Role = 'citizen' | 'responder';

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
  isCitizen: boolean;
  isResponder: boolean;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>(() => {
    const stored = localStorage.getItem('cdis-role');
    return (stored === 'responder' || stored === 'citizen') ? stored : 'citizen';
  });

  const setRole = (newRole: Role) => {
    localStorage.setItem('cdis-role', newRole);
    setRoleState(newRole);
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        isCitizen: role === 'citizen',
        isResponder: role === 'responder',
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
