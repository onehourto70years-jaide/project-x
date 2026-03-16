import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API } from '@/App';

export default function AuthCallback() {
  const { setUser, checkAuth } = useAuth();
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Use ref to prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      // Extract session_id from URL hash
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const sessionId = params.get('session_id');

      if (!sessionId) {
        console.error('No session_id found');
        navigate('/', { replace: true });
        return;
      }

      try {
        // Exchange session_id for user data
        const response = await fetch(`${API}/auth/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (!response.ok) {
          throw new Error('Failed to exchange session');
        }

        const userData = await response.json();
        setUser(userData);

        // Clear the hash and navigate to dashboard
        window.history.replaceState(null, '', '/dashboard');
        navigate('/dashboard', { replace: true, state: { user: userData } });
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/', { replace: true });
      }
    };

    processAuth();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-neon-cyan/20 flex items-center justify-center mx-auto animate-pulse">
          <div className="w-8 h-8 rounded-full bg-neon-cyan/40" />
        </div>
        <p className="font-mono text-neon-cyan">AUTHENTICATING...</p>
      </div>
    </div>
  );
}
