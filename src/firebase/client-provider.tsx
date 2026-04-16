
'use client';

import React, { useMemo, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  const { auth } = firebaseServices;

  useEffect(() => {
    // Perform silent anonymous sign-in in the background without blocking the UI
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Auto sign-in failed", error);
        }
      }
    });

    return () => unsubscribe();
  }, [auth]);

  // Render the provider immediately to allow children (like public forms) to load fast
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
