import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Email-email yang secara otomatis mendapat role superadmin
const SUPERADMIN_EMAILS = [
  'deamok@gmail.com'
];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);

          let role = 'player';
          if (SUPERADMIN_EMAILS.includes(user.email)) {
            role = 'superadmin';
          } else if (userSnap.exists()) {
            role = userSnap.data().role || 'player';
          }

          if (SUPERADMIN_EMAILS.includes(user.email) && (!userSnap.exists() || userSnap.data().role !== 'superadmin')) {
            await setDoc(userRef, {
              nama: user.displayName || 'Super Admin',
              email: user.email,
              role: 'superadmin',
              createdAt: userSnap.exists() ? (userSnap.data().createdAt || new Date().toISOString()) : new Date().toISOString()
            }, { merge: true });
          } else if (!userSnap.exists()) {
            await setDoc(userRef, {
              nama: user.displayName || 'Pemain',
              email: user.email,
              role: 'player',
              noHP: '',
              divisi: '',
              namaPTM: '',
              ownerUid: user.uid,
              ownerPTM: '',
              pts: 0,
              statsPTS: {
                ikutSingle: 0,
                ikutDouble: 0,
                setMenang: 0,
                lolosPool: 0,
                juara: 0,
                finalist: 0,
                semifinalist: 0,
                quarterfinalist: 0
              },
              createdAt: new Date().toISOString()
            });
          }

          setUserRole(role);
          setUserProfile(userSnap.exists() ? userSnap.data() : null);
        } catch (error) {
          console.error("Firebase fetch error:", error);
          setUserRole('player');
        }
        setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userRole,
    userProfile,
    userPTM: userProfile?.namaPTM || '',
    isSuperAdmin: userRole === 'superadmin',
    isAdmin: userRole === 'admin',
    isPlayer: userRole === 'player' || !userRole,
    canCreateTournament: userRole === 'superadmin' || userRole === 'admin',
    canEditTournament: (tournament) => {
      if (userRole === 'superadmin') return true;
      if (userRole === 'admin' && tournament && tournament.createdBy === currentUser?.uid) return true;
      return false;
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
