/**
 * Image Utilities for Profile Avatar Resolution and Initials Generation
 */

/**
 * Resolves a profile image URL (or path) to a valid absolute image URL.
 * Handles full URLs (http/https/data), relative API routes (/api/v1/...), and local paths (/uploads/...).
 *
 * @param {Object|string|null} userOrUrl - User object, profile object, or raw image URL string
 * @returns {string|null} Full absolute URL or null if missing/invalid
 */
export const getProfileImageUrl = (userOrUrl) => {
    if (!userOrUrl) return null;

    let rawUrl = null;
    if (typeof userOrUrl === 'string') {
        rawUrl = userOrUrl;
    } else if (typeof userOrUrl === 'object') {
        rawUrl =
            userOrUrl.profileImage ||
            userOrUrl.profileImageUrl ||
            userOrUrl.profilePhotoId ||
            userOrUrl.user?.profileImage ||
            userOrUrl.user?.profileImageUrl ||
            userOrUrl.user?.profilePhotoId ||
            userOrUrl.userId?.profileImage ||
            userOrUrl.userId?.profileImageUrl ||
            userOrUrl.userId?.profilePhotoId ||
            userOrUrl.workerProfile?.profileImage ||
            userOrUrl.workerProfile?.profileImageUrl ||
            userOrUrl.workerProfile?.profilePhotoId ||
            userOrUrl.worker?.profileImage ||
            userOrUrl.worker?.profileImageUrl ||
            userOrUrl.worker?.profilePhotoId ||
            null;
    }

    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return null;
    }

    const trimmed = rawUrl.trim();

    // Absolute URLs (http://, https://, data:, blob:)
    if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:')
    ) {
        return trimmed;
    }

    // Relative path (/api/v1/... or /uploads/...) -> prepend backend host origin
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const hostOrigin = apiUrl.replace(/\/api(\/v\d+)?\/?$/, '');

    let cleanPath = trimmed;
    if (!trimmed.startsWith('/') && !trimmed.includes('/')) {
        // Filename only -> construct full relative API route
        cleanPath = `/api/v1/worker/verification/profile-photo/file/${trimmed}`;
    } else {
        cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }

    return `${hostOrigin}${cleanPath}`;
};

/**
 * Extracts normalized user display name.
 */
export const getUserName = (userOrName) => {
    if (!userOrName) return 'User';
    if (typeof userOrName === 'string') return userOrName;
    return (
        userOrName.name ||
        userOrName.user?.name ||
        userOrName.userId?.name ||
        userOrName.workerProfile?.name ||
        userOrName.worker?.name ||
        'User'
    );
};

/**
 * Generates capital initials for fallback avatar display (e.g. "Harsh Singh" -> "HS").
 */
export const getUserInitials = (userOrName) => {
    const name = getUserName(userOrName);
    if (!name || name === 'User') return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
