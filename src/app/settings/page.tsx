'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
// Tailwind-only; removed CSS module

// Dynamically import ImageCropModal so its heavy CSS is only loaded when the component is actually rendered (Settings page)
const ImageCropModal = dynamic(() => import('@/components/ui/ImageCropModal'), {
  ssr: false,
  loading: () => null
});

interface UserProfile {
  id?: string;
  username: string;
  email: string;
  createdAt?: string;
  profileImage?: string | null;
  bio?: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null); // 'username' or 'bio' or null
  const [editedUsername, setEditedUsername] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>(''); // 선택된 이미지 저장
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // 사용자 프로필 정보 가져오기
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!session) {
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch('/api/user/profile');
        
        if (!response.ok) {
          throw new Error('Failed to fetch user profile');
        }
        
        const data = await response.json();
        setUserProfile(data);
        setEditedUsername(data.username);
        setEditedBio(data.bio || '');
      } catch (error) {
        console.error('Error fetching user profile:', error);
        toast.error('Failed to load profile information');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [session]);
  
  const handleUpdateProfile = async (field: 'username' | 'bio') => {
    if (!userProfile) return;
    
    setIsUpdating(true);
    
    try {
      const updateData = field === 'username' 
        ? { username: editedUsername }
        : { bio: editedBio };
      
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      const updatedProfile = await response.json();
      setUserProfile(updatedProfile);
      setIsEditing(null);
      toast.success(`${field === 'username' ? 'Username' : 'Bio'} updated successfully!`);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(`Failed to update ${field}`);
    } finally {
      setIsUpdating(false);
    }
  };
  
  const handleProfileImageClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleCancelCrop = () => {
    setShowCropModal(false);
    setSelectedImageSrc(''); // 선택된 이미지도 초기화
  };
  
  const handleSaveCroppedImage = async (croppedImageBase64: string) => {
    setIsUploadingImage(true);
    setShowCropModal(false);
    setSelectedImageSrc(''); // 선택된 이미지 초기화
    
    try {
      const response = await fetch('/api/user/profile-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: croppedImageBase64 }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload image');
      }
      
      const data = await response.json();
      
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          profileImage: data.profileImageUrl
        });
      }
      
      toast.success('Profile image updated successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to update profile image');
    } finally {
      setIsUploadingImage(false);
    }
  };
  
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Account Settings</h1>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-transparent"></div>
            </div>
          ) : !userProfile ? (
            <div className="py-8 text-center">
              <p className="text-gray-600">Please log in to access this page.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Profile Section */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-gray-200">
                  {userProfile.profileImage ? (
                    <img src={userProfile.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <img src="/api/user/default-avatar" alt="Default Avatar" className="w-full h-full object-cover" />
                  )}
                </div>
                <button
                  onClick={handleProfileImageClick}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                  Change photo
                </button>
              </div>

              {/* Profile Info Form */}
              <div className="flex flex-col gap-6">
                {/* Username */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Username</div>
                  {isEditing === 'username' ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={editedUsername}
                        onChange={(e) => setEditedUsername(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateProfile('username')}
                          disabled={isUpdating}
                          className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isUpdating ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditing(null);
                            setEditedUsername(userProfile.username);
                          }}
                          className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-gray-900 font-medium">{userProfile.username}</div>
                      <div className="h-px flex-1 bg-gray-200" />
                      <button
                        onClick={() => setIsEditing('username')}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>

                {/* Email (read-only) */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Email</div>
                  <div className="text-gray-900">{userProfile.email}</div>
                  <div className="h-px bg-gray-200 mt-2" />
                </div>

                {/* Bio */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Bio</div>
                  {isEditing === 'bio' ? (
                    <div className="flex flex-col gap-3">
                      <textarea
                        value={editedBio}
                        onChange={(e) => setEditedBio(e.target.value)}
                        rows={4}
                        maxLength={500}
                        placeholder="Write a little about yourself..."
                        className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateProfile('bio')}
                          disabled={isUpdating}
                          className="inline-flex items-center px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isUpdating ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditing(null);
                            setEditedBio(userProfile.bio || '');
                          }}
                          className="inline-flex items-center px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="text-gray-700">{userProfile.bio || 'No bio added yet.'}</div>
                      <div className="h-px flex-1 bg-gray-200" />
                      <button
                        onClick={() => setIsEditing('bio')}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for profile image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const imageSrc = event.target?.result as string;
              setSelectedImageSrc(imageSrc);
              setShowCropModal(true);
            };
            reader.readAsDataURL(file);
          }
        }}
      />

      {/* Profile Image Crop Modal */}
      <ImageCropModal
        isOpen={showCropModal}
        onClose={handleCancelCrop}
        onSave={handleSaveCroppedImage}
        imageSrc={selectedImageSrc}
      />
    </div>
  );
} 
 