
'use client';

import React, { useMemo, useEffect, type ReactNode, useState } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  
  const firebaseServices = useMemo(() => {
    return initializeFirebase();
  }, []);

  useEffect(() => {
    if (!firebaseServices) return;
    
    const { auth } = firebaseServices;
    
    // Perform silent anonymous sign-in in the background
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Auto sign-in failed", error);
        }
      }
      setIsInitialized(true);
    });

    return () => unsubscribe();
  }, [firebaseServices]);

  if (!isInitialized || !firebaseServices) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-[10000]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
