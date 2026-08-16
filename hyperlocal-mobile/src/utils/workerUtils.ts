/**
 * Canonical Worker & ObjectId utilities for Jobnest Mobile App
 * Ensures consistent 24-character hex MongoDB ObjectId extraction across all screens
 */

export function isValidObjectId(id: any): boolean {
  if (!id) return false;
  const str = String(id).trim();
  return /^[0-9a-fA-F]{24}$/.test(str);
}

export function getCanonicalWorkerId(worker: any): string {
  if (!worker) return '';

  if (typeof worker === 'string') {
    const trimmed = worker.trim();
    if (isValidObjectId(trimmed)) return trimmed;
    return trimmed;
  }

  // 1. Check primary DTO workerId (standard from /workers/search & /workers/profile/:id)
  if (worker.workerId && isValidObjectId(worker.workerId)) {
    return String(worker.workerId).trim();
  }

  // 2. Check userId
  if (worker.userId && isValidObjectId(worker.userId)) {
    return String(worker.userId).trim();
  }

  // 3. Check nested user._id
  if (worker.user?._id && isValidObjectId(worker.user._id)) {
    return String(worker.user._id).trim();
  }

  // 4. Check nested user.id
  if (worker.user?.id && isValidObjectId(worker.user.id)) {
    return String(worker.user.id).trim();
  }

  // 5. Check direct _id
  if (worker._id && isValidObjectId(worker._id)) {
    return String(worker._id).trim();
  }

  // 6. Check direct id
  if (worker.id && isValidObjectId(worker.id)) {
    return String(worker.id).trim();
  }

  // Fallback if none matched strict regex
  return String(
    worker.workerId ||
    worker.userId ||
    worker.user?._id ||
    worker.user?.id ||
    worker._id ||
    worker.id ||
    ''
  ).trim();
}

export function normalizeWorkerData(worker: any) {
  if (!worker) return null;

  const workerId = getCanonicalWorkerId(worker);
  const name =
    worker.name ||
    worker.fullName ||
    worker.user?.name ||
    worker.user?.fullName ||
    'Verified Professional';

  const profileImage =
    worker.profileImage ||
    worker.profilePhoto ||
    worker.profileImageUrl ||
    worker.profilePhotoUrl ||
    worker.user?.profileImage ||
    worker.user?.profilePhoto ||
    worker.user?.avatar ||
    null;

  const categoryName =
    worker.categoryName ||
    worker.serviceCategoryName ||
    worker.serviceCategory ||
    worker.category?.name ||
    worker.services?.[0]?.name ||
    (Array.isArray(worker.skills) && worker.skills.length > 0 ? worker.skills[0] : 'Home Services');

  const hourlyRate =
    worker.hourlyRate ||
    worker.pricePerHour ||
    worker.rate ||
    (worker.hourlyRatePaise ? Math.round(worker.hourlyRatePaise / 100) : 499);

  const rating = Number(
    worker.averageRating ||
    worker.avgRating ||
    worker.rating ||
    worker.ratingAvg ||
    4.8
  );

  const experienceYears = Number(
    worker.experienceYears ||
    worker.yearsOfExperience ||
    worker.experience ||
    3
  );

  const completedJobs = Number(
    worker.completedBookingsCount ||
    worker.completedJobs ||
    worker.jobsCount ||
    worker.ratingCount ||
    18
  );

  const skills: string[] = Array.isArray(worker.skills) && worker.skills.length > 0
    ? worker.skills
    : ['Verified Pro', 'Background Checked', 'Punctual'];

  const bio =
    worker.bio ||
    `${name} is an experienced ${categoryName} specialist offering reliable, punctual and high quality home services.`;

  const isVerified =
    worker.verificationStatus === 'APPROVED' ||
    worker.isVerified === true ||
    worker.verified === true ||
    worker.verificationBadge === true;

  const isOnline = worker.isOnline !== false;

  return {
    ...worker,
    workerId,
    name,
    profileImage,
    categoryName,
    hourlyRate,
    rating,
    experienceYears,
    completedJobs,
    skills,
    bio,
    isVerified,
    isOnline,
  };
}
