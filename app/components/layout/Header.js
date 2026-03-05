"use client";

export default function Header({
  locationReady,
  displayLocation,
  isScrolled,
  greeting,
  momentText,
  onToggleLocation,
  onRequestLocation,
  statsTitikRamai = 0,
  statsTitikDekat = 0,
}) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-100/50">
      {/* Baris 1: Logo + Brand + Lokasi + Toggle */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          {/* LOGO ASLI */}
          <div className="w-9 h-9 bg-gradient-to-br from-[#E3655B] to-[#FF7A70] rounded-xl flex items-center justify-center shadow-sm">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>

          {/* BRAND + LOKASI */}
          <div>
            <h1 className="text-base font-bold text-gray-900 tracking-tight">
              Setempat<span className="text-[#E3655B]">ID</span>
            </h1>
            {locationReady && displayLocation ? (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <span>{displayLocation}</span>
                <span>•</span>
                <span>
                  {new Date().getHours() >= 4 && new Date().getHours() < 18
                    ? "🌤️"
                    : "🌙"}{" "}
                  29°
                </span>
              </p>
            ) : (
              <p className="text-xs text-gray-400">Jelajahi sekitar</p>
            )}
          </div>
        </div>

{/* Toggle Lokasi */}
<div className="flex items-center gap-2">
  <button
    onClick={locationReady ? onToggleLocation : onRequestLocation}
    className={`relative w-14 h-7 rounded-full transition-all duration-300 active:scale-95 overflow-hidden ${
      locationReady
        ? "bg-gradient-to-r from-[#E3655B] to-[#FF7A70] shadow-md"
        : "bg-gray-200 border border-gray-300"
    }`}
  >
    {/* Glow halus ketika ON */}
    {locationReady && (
      <span className="absolute inset-0 bg-white/20 opacity-30 blur-sm"></span>
    )}

    {/* Circle */}
    <span
      className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${
        locationReady ? "translate-x-7" : "translate-x-0"
      }`}
    />

    {/* ON */}
    <span
      className={`absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold tracking-wide transition-opacity duration-200 ${
        locationReady ? "opacity-100 text-white" : "opacity-0"
      }`}
    >
      ON
    </span>

    {/* OFF */}
    <span
      className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold tracking-wide transition-opacity duration-200 ${
        locationReady ? "opacity-0" : "opacity-100 text-gray-500"
      }`}
    >
      OFF
    </span>
  </button>


          <button className="relative p-1">
            <span className="text-xl">🔔</span>
            {locationReady && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E3655B] animate-pulse text-white text-[10px] rounded-full flex items-center justify-center">
                3
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 pb-3">
        <div className="relative">
          <input
            type="text"
            placeholder={
              locationReady && displayLocation
                ? `Cari di ${displayLocation}...`
                : "Cari tempat atau suasana..."
            }
            className="w-full bg-gray-100/70 border border-transparent focus:border-[#E3655B]/40 rounded-2xl py-3 pl-12 pr-4 text-sm text-gray-600 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#E3655B]/40 focus:bg-white transition-all"
          />
          <svg
            className="absolute left-4 top-3.5 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
    </header>
  );
}