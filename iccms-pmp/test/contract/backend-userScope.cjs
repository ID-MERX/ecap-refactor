/**
 * VERBATIM copy of `lib/userScope.js` as added by `backend.patch` at the repo root.
 *
 * The backend checkout in this workspace is deliberately left unpatched (patch-only files are
 * applied to throwaway copies, see `scripts/verify-audit.sh`), so this file is the *contract* the
 * frontend must satisfy — not a re-implementation. `src/core/access/__tests__/deriveAccess.test.ts` runs its `deriveScope` against the same fixtures as ours.
 * **Only the two `require` targets are rewritten** (to `./stubs/axios.cjs` and `./backend-geography.cjs`); the rule code below is byte-for-byte the backend's.
 *
 * Regenerate with:  node scripts/sync-backend-contract.mjs
 */
const axios = require("./stubs/axios.cjs");
const { DISTRICTS_BY_PROVINCE } = require("./backend-geography.cjs");

/**
 * Works out which data a user may see, from their Directus profile.
 *
 * The rules deliberately mirror the frontend's useEffectiveDistrict hook, so
 * the backend and the UI agree. They are based on free-text profile fields
 * (description / title / location) and should be replaced by explicit
 * role/scope fields during the backend refactor; this is the one place to change.
 *
 * Returns one of:
 *   { level: "national" }
 *   { level: "province", province, districts: [...] }
 *   { level: "district", district }
 *   { level: "none" }   -> could not determine a scope: deny access to data
 */
const deriveScope = (profile, tokenClaims = {}) => {
  const description = String(profile.description || "").toLowerCase();
  const roleName =
    typeof profile.role === "object" && profile.role
      ? String(profile.role.name || "").toLowerCase()
      : "";
  const location = profile.location && profile.location !== "All" ? profile.location : null;
  const province = profile.title && profile.title !== "All" ? profile.title : null;

  const isAdmin =
    tokenClaims.admin_access === true ||
    roleName === "administrator" ||
    description.includes("admin") ||
    description === "ecap+ support" ||
    // The frontend sidebar treats "has a role but no description" as admin.
    // Kept so existing admin accounts aren't locked out; revisit in the refactor.
    (!description && Boolean(roleName) && !location && !province);
  if (isAdmin) return { level: "national" };

  const isProvinceUser = description.includes("provincial") || description.includes("province");
  if (isProvinceUser) {
    const districts = province ? DISTRICTS_BY_PROVINCE[province] : null;
    return districts && districts.length
      ? { level: "province", province, districts }
      : { level: "none" };
  }

  const isDistrictUser = description.includes("district") || Boolean(location);
  if (isDistrictUser && location) return { level: "district", district: location };

  return { level: "none" };
};

// Small in-memory cache so we don't call Directus on every request.
const PROFILE_TTL_MS = 5 * 60 * 1000;
const profileCache = new Map(); // userId -> { profile, expires }

/**
 * Loads the caller's profile from Directus using the caller's own token,
 * so no Directus admin credentials are needed on this server.
 */
const getUserProfile = async (userId, accessToken) => {
  const cached = profileCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.profile;

  const directusUrl = String(process.env.DIRECTUS_URL || "").replace(/\/+$/, "");
  if (!directusUrl) throw new Error("DIRECTUS_URL is not set");

  const response = await axios.get(`${directusUrl}/users/me`, {
    params: { fields: "id,email,first_name,last_name,description,title,location,role.name" },
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10_000,
  });

  const profile = response.data && response.data.data;
  if (!profile || profile.id !== userId) {
    throw new Error("Directus profile does not match the token");
  }

  profileCache.set(userId, { profile, expires: Date.now() + PROFILE_TTL_MS });
  return profile;
};

module.exports = { deriveScope, getUserProfile };
