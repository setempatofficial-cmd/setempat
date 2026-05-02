"use client";
import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Camera, 
  CloudRain, 
  Navigation,
  Sparkles 
} from "lucide-react";

const AIQuickActions = memo(({ 
  actions = [], 
  onActionClick, 
  onLaporClick, 
  isMalam,
  contextData = { cuaca: "cerah", lalin: "lancar" } 
}) => {

  const BRAND_COLOR = "#E3655B";

  const smartActions = useMemo(() => {
    let dynamicOptions = [...actions];
    if (contextData.cuaca.toLowerCase().includes('hujan')) {
      dynamicOptions.unshift({ 
        label: "Cek Genangan", 
        query: "Update titik banjir sekarang",
        type: 'danger',
        icon: CloudRain
      });
    }
    if (contextData.lalin.toLowerCase().includes('macet')) {
      dynamicOptions.unshift({ 
        label: "Jalur Alternatif", 
        query: "Cari rute anti macet",
        type: 'warning',
        icon: Navigation
      });
    }
    return dynamicOptions;
  }, [actions, contextData]);

  return (
    <div className="w-full mb-2 space-y-2">
      {/* Label - Warna icon AI disamakan dengan brand tapi tipis */}
      <div className="flex items-center gap-1.5 px-4">
        <Sparkles size={10} style={{ color: BRAND_COLOR }} className="opacity-70" />
        <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${isMalam ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Saran Setempat AI
        </span>
      </div>

      <div className="flex items-center w-full overflow-x-auto no-scrollbar pb-2">
        <div className="flex gap-2 px-4 flex-nowrap">
          
          {/* Tombol LAPOR - Soft Version */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onLaporClick}
            style={{ 
              backgroundColor: `${BRAND_COLOR}15`, // Alpha 15% (Sangat lembut)
              border: `1px solid ${BRAND_COLOR}40`, // Border 40% opacity
              color: BRAND_COLOR 
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl transition-colors shrink-0"
          >
            <Camera size={14} strokeWidth={2.5} />
            <span className="text-[11px] font-extrabold uppercase">LAPOR</span>
          </motion.button>

          {/* Dynamic Actions */}
          <AnimatePresence mode="popLayout">
            {smartActions.map((tag, idx) => (
              <motion.button
                key={tag.label}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onActionClick(tag.query)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 transition-all
                  ${isMalam 
                    ? 'bg-zinc-900/60 border-zinc-800 text-zinc-300' 
                    : 'bg-white border-zinc-100 shadow-sm text-zinc-600'
                  }
                  ${tag.type === 'danger' ? 'ring-1 ring-rose-500/30 !bg-rose-500/5 !text-rose-500 !border-rose-500/20' : ''}
                `}
              >
                {tag.icon ? (
                  <tag.icon 
                    size={13} 
                    className={tag.type === 'danger' ? 'text-rose-500' : 'text-zinc-400'} 
                  />
                ) : (
                  <Sparkles size={13} className="text-zinc-400" />
                )}
                <span className="text-[11px] font-medium whitespace-nowrap">{tag.label}</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

AIQuickActions.displayName = "AIQuickActions";
export default AIQuickActions;