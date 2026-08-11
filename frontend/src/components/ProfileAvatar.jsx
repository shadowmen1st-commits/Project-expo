import React, { useState, useEffect } from 'react';
import { getProfileImageUrl, getUserInitials, getUserName } from '../utils/imageUtils';

/**
 * ProfileAvatar Component
 * Standardized, safe avatar component for customers, workers, company users, and admins.
 * Handles URL normalization, instant previews, image load errors, and fallback initials.
 *
 * @param {Object} props
 * @param {Object|string} [props.user] - User object or raw image URL string
 * @param {string} [props.src] - Direct image URL override
 * @param {string} [props.name] - Direct name override for initials fallback
 * @param {string} [props.size='md'] - 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {boolean} [props.showBadge=false] - Show verified checkmark badge overlay
 */
export const ProfileAvatar = ({
    user,
    src,
    name: nameProp,
    size = 'md',
    className = '',
    showBadge = false,
}) => {
    const [imgError, setImgError] = useState(false);

    const imageUrl = src || getProfileImageUrl(user);
    const name = nameProp || getUserName(user);
    const initials = getUserInitials(name);

    // Reset error state if image URL changes
    useEffect(() => {
        setImgError(false);
    }, [imageUrl]);

    // Standardized sizes
    const sizeClasses = {
        xs: 'w-6 h-6 text-[10px]',
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
        xl: 'w-16 h-16 text-xl',
        '2xl': 'w-24 h-24 text-2xl',
        '3xl': 'w-32 h-32 text-3xl',
    };

    const dimensionClass = sizeClasses[size] || sizeClasses.md;

    const isVerified =
        user?.verificationBadge ||
        user?.verificationStatus === 'APPROVED' ||
        user?.isVerified;

    return (
        <div className={`relative inline-block shrink-0 ${className}`}>
            <div
                className={`${dimensionClass} rounded-full bg-gradient-to-br from-[#F97316] to-[#EAB308] text-white flex items-center justify-center font-extrabold shadow-sm overflow-hidden border border-[#FED7AA] select-none`}
            >
                {imageUrl && !imgError ? (
                    <img
                        src={imageUrl}
                        alt={name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <span>{initials}</span>
                )}
            </div>

            {showBadge && isVerified && (
                <span
                    className="absolute -bottom-0.5 -right-0.5 bg-[#16A34A] text-white rounded-full p-0.5 border border-white shadow-xs flex items-center justify-center"
                    title="Verified"
                >
                    <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                </span>
            )}
        </div>
    );
};

export default ProfileAvatar;
