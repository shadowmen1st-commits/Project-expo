/**
 * Worker Utilities for Image URL Resolution and Name Formatting
 */

/**
 * Normalizes worker image URL from any worker/user data structure.
 * Returns absolute URL or null if missing/empty.
 *
 * @param {Object} worker - Worker profile, user object, or booking object
 * @returns {string|null} Full image URL or null
 */
export const getWorkerImageUrl = (worker) => {
    if (!worker) return null;

    const rawUrl =
        worker.profileImage ||
        worker.profileImageUrl ||
        worker.user?.profileImage ||
        worker.user?.profileImageUrl ||
        worker.userId?.profileImage ||
        worker.userId?.profileImageUrl ||
        worker.workerProfile?.profileImage ||
        worker.workerProfile?.profileImageUrl ||
        worker.worker?.profileImage ||
        worker.worker?.profileImageUrl ||
        null;

    if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
        return null;
    }

    const trimmed = rawUrl.trim();

    // Absolute URLs (http://, https://, data:)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        return trimmed;
    }

    // Relative uploads path (/uploads/...) -> prefix with backend host
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    const hostOrigin = apiUrl.replace(/\/api(\/v\d+)?\/?$/, '');

    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${hostOrigin}${cleanPath}`;
};

/**
 * Extracts normalized worker name from worker or booking object.
 */
export const getWorkerName = (worker) => {
    if (!worker) return 'Worker';
    return (
        worker.name ||
        worker.user?.name ||
        worker.userId?.name ||
        worker.workerProfile?.name ||
        worker.worker?.name ||
        'Worker'
    );
};

/**
 * Generates initials for fallback worker avatar (e.g. "Rajesh Kumar" -> "RK").
 */
export const getWorkerInitials = (worker) => {
    const name = getWorkerName(worker);
    if (!name || name === 'Worker') return 'W';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
