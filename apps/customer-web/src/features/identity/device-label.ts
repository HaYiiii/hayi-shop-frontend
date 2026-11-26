/** "iPhone · Safari" from a user-agent, for the devices list (D3f screen 11, FE #74); unknown → "Thiết bị khác". */
export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const system = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux|X11/.test(ua)
              ? "Linux"
              : null;
  // Order matters: Edge and Samsung Internet also say "Chrome", Chrome also says "Safari".
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome|CriOS/.test(ua)
          ? "Chrome"
          : /Safari/.test(ua)
            ? "Safari"
            : null;
  if (!system && !browser) return "Thiết bị khác";
  return [system, browser].filter(Boolean).join(" · ");
}
