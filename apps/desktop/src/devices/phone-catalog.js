export const phoneCatalog = [
  {
    id: "samsung-galaxy-s24-ultra",
    brand: "Samsung",
    model: "Galaxy S24 Ultra",
    aliases: ["SM-S928", "S24 Ultra"],
    platform: "android",
    width: 1440,
    height: 3120,
    aspectRatio: "20:9",
    safeArea: {
      top: 160,
      right: 64,
      bottom: 220,
      left: 64
    }
  },
  {
    id: "google-pixel-9-pro",
    brand: "Google",
    model: "Pixel 9 Pro",
    aliases: ["Pixel 9 Pro"],
    platform: "android",
    width: 1280,
    height: 2856,
    aspectRatio: "20:9",
    safeArea: {
      top: 148,
      right: 56,
      bottom: 208,
      left: 56
    }
  },
  {
    id: "samsung-galaxy-z-fold-6-cover",
    brand: "Samsung",
    model: "Galaxy Z Fold6 Cover Screen",
    aliases: ["SM-F956 cover", "Z Fold6 cover"],
    platform: "android",
    width: 968,
    height: 2376,
    aspectRatio: "22.1:9",
    safeArea: {
      top: 136,
      right: 48,
      bottom: 188,
      left: 48
    }
  }
];

export function findPhoneProfile(modelId) {
  const normalized = modelId.trim().toLowerCase();
  return phoneCatalog.find((phone) => {
    return (
      phone.id === normalized ||
      phone.model.toLowerCase() === normalized ||
      phone.aliases.some((alias) => alias.toLowerCase() === normalized)
    );
  });
}
