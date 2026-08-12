import { API_BASE_URL } from '../config/api';

/**
 * Resolves worker profile photo reference to a full, valid image URI.
 * Handles full URLs (http/https/data/file), relative API routes (/api/v1/...),
 * relative upload paths (/uploads/...), and raw filenames.
 */
export const resolveWorkerImage = (userOrUrl: any): string | null => {
  if (!userOrUrl) return null;

  let rawUrl: string | null = null;
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

  // Blob URLs from local preview should not be stored, but can render temporarily
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  // Prepend backend host origin
  const hostOrigin = API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, '');

  let cleanPath = trimmed;
  if (!trimmed.startsWith('/') && !trimmed.includes('/')) {
    cleanPath = `/api/v1/worker/verification/profile-photo/file/${trimmed}`;
  } else {
    cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  return `${hostOrigin}${cleanPath}`;
};

/**
 * Extracts normalized user display name.
 */
export const getUserName = (userOrName: any): string => {
  if (!userOrName) return 'User';
  if (typeof userOrName === 'string') return userOrName;
  return (
    userOrName.name ||
    userOrName.fullName ||
    userOrName.user?.name ||
    userOrName.user?.fullName ||
    userOrName.userId?.name ||
    userOrName.userId?.fullName ||
    userOrName.workerProfile?.name ||
    userOrName.workerProfile?.fullName ||
    userOrName.worker?.name ||
    userOrName.worker?.fullName ||
    'User'
  );
};

/**
 * Generates capital initials for avatar fallback (e.g. "Harsh Singh" -> "HS").
 */
export const getUserInitials = (userOrName: any): string => {
  const name = getUserName(userOrName);
  if (!name || name === 'User') return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
