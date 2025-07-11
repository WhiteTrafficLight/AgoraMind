'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { loggers } from '@/utils/logger';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/open-chat';
  
  // Display success message if redirected from register page
  const registered = searchParams?.get('registered');
  const [successMessage, setSuccessMessage] = useState(
    registered === 'true' ? 'Registration completed successfully. Please log in.' : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      loggers.auth.info('Attempting login with email:', email);
      
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      
      if (!result?.ok) {
        const errorMsg = result?.error || 'Login failed. Please try again.';
        setError(errorMsg);
        setIsLoading(false);
        loggers.auth.warn('Login failed:', errorMsg);
        return;
      }
      
      loggers.auth.info('Login successful, redirecting to:', callbackUrl);
      router.push(callbackUrl);
    } catch (err) {
      loggers.auth.error('Login error:', err);
      setError('Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Only allow Google login in production or when explicitly enabled
    if (process.env.NODE_ENV === 'development') {
      alert('Google login is only available in production environment.');
      loggers.auth.info('Google login attempted in development mode - blocked');
      return;
    }
    
    setIsLoading(true);
    loggers.auth.info('Attempting Google login with callback:', callbackUrl);
    signIn('google', { callbackUrl });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12">
      <div className="auth-container">
        <h1 className="text-4xl font-black text-center mb-2">AgoraMind</h1>
        <h2 className="text-2xl font-bold text-center mb-8">Login</h2>
      </div>

      <div className="auth-container">
        <div className="bg-white py-6 px-4 shadow-md rounded-3xl">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-2xl text-sm text-center">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-2xl text-sm text-center">
              {successMessage}
            </div>
          )}
          
          <form className="space-y-4 flex flex-col" onSubmit={handleSubmit}>
            <div className="w-full">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input w-full"
                style={{ boxSizing: 'border-box' }}
                placeholder="your@email.com"
              />
            </div>

            <div className="w-full">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input w-full"
                style={{ boxSizing: 'border-box' }}
                placeholder="********"
              />
            </div>

            <div className="w-full mt-2">
              <button
                type="submit"
                className="btn-primary w-full flex justify-center py-2 text-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="spinner-small spinner-white"></div>
                ) : (
                  'Login'
                )}
              </button>
            </div>
          </form>

          {/* Forgot Password Section */}
          <div className="mt-6 text-center">
            <Link href="/forgot-password" className="text-blue-600 hover:text-blue-500 text-sm">
              Forgot password?
            </Link>
          </div>

          {/* Divider */}
          <div className="mt-8 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-gray-500">Or continue with</span>
              </div>
            </div>
          </div>

          {/* Google Login Section */}
          <div className="mb-8">
            <button 
              onClick={handleGoogleLogin}
              className="btn-secondary w-full flex justify-center items-center py-2 text-sm gap-2" 
              disabled={isLoading}
            >
              <svg viewBox="0 0 48 48" width="20" height="20">
                <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
              </svg>
              Continue with Google
            </button>
          </div>
          
          {/* Sign Up Section */}
          <div className="border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-600 text-center">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-500 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
} 