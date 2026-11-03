import { useAuth } from "@/context/AuthContext";
import { DEFAULT_DISTRICT } from "@/lib/api";
import { DISTRICTS_BY_PROVINCE, ALL_DISTRICTS } from "@/constants/districts";

export const useEffectiveDistrict = () => {
  const { user } = useAuth();
  const description = (user?.description || "").toLowerCase();
  const isAdmin = description.includes("admin") || description.includes("administrator") || description === "ecap+ support";
  const isProvinceUser = description.includes("provincial") || description.includes("province");
  const isDistrictUser = description.includes("district") || (!!user?.location && user.location !== "All" && !isAdmin && !isProvinceUser);
  const province = user?.title && user.title !== "All" ? user.title : user?.province;
  const district = user?.location && user.location !== "All" ? user.location : (user?.district || DEFAULT_DISTRICT || "");
  let availableDistricts = ALL_DISTRICTS;
  if (isProvinceUser && province) availableDistricts = ["All Districts", ...(DISTRICTS_BY_PROVINCE[province] || [])];
  else if (isDistrictUser && district) availableDistricts = [district];
  else if (isAdmin) availableDistricts = ["All Districts", ...ALL_DISTRICTS];
  return { district, province, isAdmin, isProvinceUser, isDistrictUser, isRestrictedToDistrict: isDistrictUser, availableDistricts };
};
