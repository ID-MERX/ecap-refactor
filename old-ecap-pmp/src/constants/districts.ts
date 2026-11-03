export const PROVINCES = ["Central Province", "Southern Province"];

export const DISTRICTS_BY_PROVINCE: Record<string, string[]> = {
  "Central Province": ["Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Chisamba", "Serenje"],
  "Southern Province": ["Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"],
};

export const ALL_DISTRICTS = Object.values(DISTRICTS_BY_PROVINCE).flat();
