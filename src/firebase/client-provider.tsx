
'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  const { auth, firestore } = firebaseServices;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Sign in anonymously if not logged in
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Auto sign-in failed", error);
        }
      } else {
        // Ensure user is in the managers collection for dev/prototype
        const managerRef = doc(firestore, 'managers', user.uid);
        try {
          const snap = await getDoc(managerRef);
          if (!snap.exists()) {
            await setDoc(managerRef, { 
              uid: user.uid,
              role: 'admin',
              createdAt: serverTimestamp() 
            });
          }
        } catch (error) {
          console.error("Manager setup failed", error);
        }
      }
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
