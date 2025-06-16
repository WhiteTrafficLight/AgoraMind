'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
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
    registered === 'true' ? '회원가입이 완료되었습니다. 로그인해주세요.' : ''
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      
      if (!result?.ok) {
        setError(result?.error || '로그인에 실패했습니다.');
        setIsLoading(false);
        return;
      }
      
      router.push(callbackUrl);
    } catch (err) {
      console.error('Login failed:', err);
      setError('로그인에 실패했습니다. 다시 시도해주세요.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
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
          
          <form className="space-y-4 flex flex-col items-center" onSubmit={handleSubmit}>
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

          {/* Social Login Section */}
          <div className="mb-6">
            <div className="grid grid-cols-3 gap-8 w-full">
              <div className="flex justify-center">
                <button 
                  onClick={handleGoogleLogin}
                  className="flex items-center justify-center w-14 h-14 rounded-full border-0 hover:shadow-md transition-all bg-white" 
                  aria-label="Continue with Google"
                >
                  <svg viewBox="0 0 48 48" width="28" height="28">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                  </svg>
                </button>
              </div>

              <div className="flex justify-center">
                <button 
                  className="flex items-center justify-center w-14 h-14 rounded-full border-0 hover:shadow-md transition-all bg-white" 
                  aria-label="Continue with Apple"
                  disabled
                >
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="black">
                    <path d="M17.05 20.28c-.98.95-2.05.86-3.09.43-1.09-.46-2.09-.48-3.23 0-1.44.62-2.2.44-3.05-.42C2.18 14.55 3.16 7.6 8.9 7.31c1.4.11 2.37.94 3.25.83.89-.12 2.02-.96 3.56-.84 1.71.14 3 .99 3.81 2.53-3.43 2.02-2.85 6.78.49 8.41-.7 1.36-1.44 2.7-2.96 2.04zm-6.96-13.63c.08-2.81 2.39-4.54 4.76-4.66.45 2.63-2.34 5.57-4.76 4.66z"></path>
                  </svg>
                </button>
              </div>

              <div className="flex justify-center">
                <button 
                  className="flex items-center justify-center w-14 h-14 rounded-full border-0 hover:shadow-md transition-all bg-[#1877F2]" 
                  aria-label="Continue with Facebook"
                  disabled
                >
                  <svg viewBox="0 0 24 24" width="28" height="28" fill="white">
                    <path d="M12.001 2.002c-5.522 0-9.999 4.477-9.999 9.999 0 4.99 3.656 9.126 8.437 9.879v-6.988h-2.54v-2.891h2.54V9.798c0-2.508 1.493-3.891 3.776-3.891 1.094 0 2.24.195 2.24.195v2.459h-1.264c-1.24 0-1.628.772-1.628 1.563v1.875h2.771l-.443 2.891h-2.328v6.988C18.344 21.129 22 16.992 22 12.001c0-5.522-4.477-9.999-9.999-9.999z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Sign Up Section */}
          <div className="border-t border-gray-200 pt-4">
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