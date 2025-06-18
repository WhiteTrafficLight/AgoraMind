'use client';

import React, { useState, useEffect, useRef } from 'react';
import ImageCropModal from '@/components/ui/ImageCropModal';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

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
  };
  
  const handleSaveCroppedImage = async (croppedImageBase64: string) => {
    setIsUploadingImage(true);
    setShowCropModal(false);
    
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
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <h1 className={styles.title}>
          Account Settings
        </h1>
        
        <div className={styles.contentWrapper}>
          <div className={styles.card}>
            {isLoading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner}></div>
              </div>
            ) : !userProfile ? (
              <div className={styles.loginMessage}>
                <p className={styles.loginText}>
                  Please log in to access this page.
                </p>
              </div>
            ) : (
              <div className={styles.profileContainer}>
                {/* Profile Section */}
                <div className={styles.profileSection}>
                  <div className={styles.profileImageContainer}>
                    {userProfile.profileImage ? (
                      <img 
                        src={userProfile.profileImage} 
                        alt="Profile" 
                        className={styles.profileImage}
                      />
                    ) : (
                      <img 
                        src="/api/user/default-avatar" 
                        alt="Default Avatar" 
                        className={styles.profileImage}
                      />
                    )}
                  </div>
                    
                  {/* Camera icon button for changing profile picture */}
                  <button
                    onClick={handleProfileImageClick}
                    className={styles.cameraButton}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                      <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                  </button>
                </div>
                
                {/* Profile Info Form */}
                <div className={styles.formContainer}>
                  {/* Username field */}
                  <div className={styles.fieldContainer}>
                    <div className={styles.fieldLabel}>
                      Username
                    </div>
                    
                    {isEditing === 'username' ? (
                      <div className={styles.editingContainer}>
                        <input
                          type="text"
                          value={editedUsername}
                          onChange={(e) => setEditedUsername(e.target.value)}
                          className={styles.input}
                        />
                        <div className={styles.buttonContainer}>
                          <button
                            onClick={() => handleUpdateProfile('username')}
                            disabled={isUpdating}
                            className={styles.saveButton}
                          >
                            {isUpdating ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(null);
                              setEditedUsername(userProfile.username);
                            }}
                            className={styles.cancelButton}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.displayContainer}>
                        <div className={styles.displayValue}>
                          {userProfile.username}
                        </div>
                        <div className={styles.divider}></div>
                        <button
                          onClick={() => setIsEditing('username')}
                          className={styles.editButton}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Email field - read only */}
                  <div className={styles.fieldContainer}>
                    <div className={styles.fieldLabel}>
                      Email
                    </div>
                    <div className={styles.emailValue}>
                      {userProfile.email}
                    </div>
                    <div className={styles.divider}></div>
                  </div>
                  
                  {/* Bio field */}
                  <div className={styles.fieldContainer}>
                    <div className={styles.fieldLabel}>
                      Bio
                    </div>
                    
                    {isEditing === 'bio' ? (
                      <div className={styles.editingContainer}>
                        <textarea
                          value={editedBio}
                          onChange={(e) => setEditedBio(e.target.value)}
                          rows={4}
                          maxLength={500}
                          placeholder="Write a little about yourself..."
                          className={styles.textarea}
                        />
                        <div className={styles.buttonContainer}>
                          <button
                            onClick={() => handleUpdateProfile('bio')}
                            disabled={isUpdating}
                            className={styles.saveButton}
                          >
                            {isUpdating ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(null);
                              setEditedBio(userProfile.bio || '');
                            }}
                            className={styles.cancelButton}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.displayContainer}>
                        <div className={styles.bioValue}>
                          {userProfile.bio || 'No bio added yet.'}
                        </div>
                        <div className={styles.divider}></div>
                        <button
                          onClick={() => setIsEditing('bio')}
                          className={styles.editButton}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Hidden file input for profile image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const imageSrc = event.target?.result as string;
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
      />
    </div>
  );
} 
 