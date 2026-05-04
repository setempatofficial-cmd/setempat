"use client";

/**
 * Skeleton loading untuk StableGridCard
 */

const StableGridCardSkeleton = ({ count = 1, className = "" }) => {
  const skeletons = Array(count).fill(null);
  
  return (
    <>
      {skeletons.map((_, index) => (
        <div 
          key={index} 
          className={`flex flex-col rounded-2xl overflow-hidden border bg-white/5 border-white/10 w-full animate-pulse ${className}`}
        >
          <div className="aspect-video bg-zinc-800/50"></div>
          <div className="p-3 space-y-2">
            <div className="h-3 bg-white/10 rounded w-3/4"></div>
            <div className="h-2 bg-white/5 rounded w-1/2"></div>
            <div className="h-2 bg-white/5 rounded w-full"></div>
          </div>
        </div>
      ))}
    </>
  );
};

export default StableGridCardSkeleton;