/**
 * Sanitizes a profile for general private use (e.g., login response, session info).
 * Usually strips very sensitive fields like bank info unless specifically needed.
 */
export function sanitizeProfile(profile) {
    if (!profile) return null;
    const {
        bankAccountNumber,
        bankAccountName,
        bankName,
        ...safeProfile
    } = profile;
    return safeProfile;
}

/**
 * Sanitizes a member object for public display (e.g., teams page).
 * Strictly removes PII (Personally Identifiable Information).
 */
export function sanitizePublicMember(user) {
    if (!user) return null;

    const profile = user.profile || {};

    return {
        id: user.id,
        name: profile.name || user.email?.split('@')[0] || 'Member',
        jabatan: profile.jabatan || null,
        division: profile.division?.name || null,
        divisionKey: profile.division?.key || null,
        photo: profile.avatar || null,
        avatar: profile.avatar || null, // Compatibility
        faculty: profile.faculty?.name || null,
        major: profile.studyProgram?.name || null,
        studyProgram: profile.studyProgram?.name || null,
        semester: profile.semester || null,
        cohort: profile.semester || null, // Compatibility
        socials: profile.socials || null,
        role: user.role?.name || 'awardee',
        isActive: user.isActive,
        sortOrder: profile.sortOrder || 0,
        // EXCLUDED: email, phone, npm, nik, birthDate, bank info
    };
}
