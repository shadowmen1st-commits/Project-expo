import { getProfileImageUrl } from './imageUtils';

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
    return getProfileImageUrl(worker);
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
