import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function WhatsAppButton() {
  const [showBubble, setShowBubble] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');

  // Refs for timer management
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleIdRef = useRef(0);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);

  // Fetch WhatsApp number on mount — sempre busca da API primeiro
  useEffect(() => {
    const API_BASE = typeof window !== 'undefined' && window.__API_BASE
      ? window.__API_BASE
      : '/api';
    
    fetch(API_BASE + '/admin/settings')
      .then(r => r.json())
      .then(d => {
        if (d && d.settings && d.settings.whatsapp) {
          const num = d.settings.whatsapp.replace(/\D/g, '');
          sessionStorage.setItem('vs_support_wa', num);
          setWhatsappNumber(num);
        } else {
          // API respondeu mas sem whatsapp — tenta sessionStorage
          const stored = sessionStorage.getItem('vs_support_wa');
          if (stored) setWhatsappNumber(stored);
        }
      })
      .catch(() => {
        // Fallback: usa sessionStorage se a API falhar
        const stored = sessionStorage.getItem('vs_support_wa');
        if (stored) setWhatsappNumber(stored);
      });
  }, []);

  // Show bubble after 3 seconds on mount
  useEffect(() => {
    initialTimerRef.current = setTimeout(() => {
      setShowBubble(true);
    }, 3000);

    return () => {
      if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
    };
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, []);

  // Schedule bubble to reopen after 35 seconds
  const scheduleReopen = useCallback(() => {
    if (cycleTimerRef.current) clearTimeout(cycleTimerRef.current);
    cycleTimerRef.current = setTimeout(() => {
      setShowBubble(true);
      setIsExiting(false);
    }, 35000);
  }, []);

  // Dismiss bubble with smooth exit animation, then schedule reopen
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      setShowBubble(false);
      scheduleReopen();
    }, 300);
  }, [scheduleReopen]);

  // Auto-dismiss bubble after 10 seconds of showing
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (showBubble) {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
      autoDismissRef.current = setTimeout(() => {
        handleDismiss();
      }, 10000);
    }
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    };
  }, [showBubble, handleDismiss]);

  // Handle click on WhatsApp button
  const handleWhatsAppClick = useCallback(() => {
    if (!whatsappNumber) return;
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      'Quero saber mais sobre o CredVale'
    )}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    // Dismiss bubble with exit animation and schedule reopen
    setIsExiting(true);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      setShowBubble(false);
      scheduleReopen();
    }, 300);
  }, [whatsappNumber, scheduleReopen]);

  // Ripple effect handler
  const handleRipple = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = ++rippleIdRef.current;

    setRipples(prev => [...prev, { x, y, id }]);

    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== id));
    }, 600);
  }, []);

  // Combined click handler: ripple + whatsapp
  const handleButtonClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      handleRipple(e);
      handleWhatsAppClick();
    },
    [handleRipple, handleWhatsAppClick]
  );

  return (
    <div
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        paddingRight: 'env(safe-area-inset-right, 8px)',
      }}
    >
      {/* ── Message Bubble ── */}
      {showBubble && (
        <div
          className="pointer-events-auto relative bg-white rounded-2xl p-4 pb-3.5 max-w-[260px] shadow-2xl"
          style={{
            boxShadow:
              '0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.06)',
            animation: isExiting
              ? 'whatsappBubbleOut 0.3s cubic-bezier(0.55, 0, 0.1, 1) forwards'
              : 'whatsappBubbleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            transformOrigin: 'bottom right',
          }}
        >
          {/* Arrow pointing down to button */}
          <div
            className="absolute -bottom-[7px] right-6 w-3.5 h-3.5 bg-white"
            style={{
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.06))',
            }}
          />

          {/* Close button (X) */}
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200"
            aria-label="Fechar"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Bubble text */}
          <div className="pr-5">
            <p className="text-sm font-bold text-gray-900 mb-1 leading-tight">
              💬 Fale com a CredVale
            </p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Tire suas dúvidas com nossa equipe. Estamos prontos para atender você pelo WhatsApp.
            </p>
          </div>
        </div>
      )}

      {/* ── WhatsApp Floating Button ── */}
      <button
        onClick={handleButtonClick}
        className="pointer-events-auto relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center overflow-hidden cursor-pointer
          bg-gradient-to-br from-[#25D366] to-[#128C7E]
          shadow-lg hover:shadow-xl
          transition-all duration-300 ease-out
          hover:scale-105 active:scale-95
          focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 focus:ring-offset-2 focus:ring-offset-transparent
          group"
        style={{
          boxShadow: '0 4px 20px rgba(37, 211, 102, 0.35)',
          animation: 'whatsappPulse 2.5s ease-in-out infinite',
        }}
        aria-label="Fale conosco no WhatsApp"
      >
        {/* Ripple container */}
        {ripples.map(r => (
          <span
            key={r.id}
            className="absolute rounded-full bg-white/30 pointer-events-none"
            style={{
              left: r.x - 10,
              top: r.y - 10,
              width: 20,
              height: 20,
              animation: 'whatsappRipple 0.6s ease-out forwards',
            }}
          />
        ))}

        {/* Tooltip on hover */}
        <span
          className="absolute right-full mr-3 bg-gray-900 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg
            opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap shadow-lg pointer-events-none"
        >
          Fale Conosco
        </span>

        {/* WhatsApp SVG Icon */}
        <svg
          viewBox="0 0 24 24"
          className="w-7 h-7 sm:w-8 sm:h-8 fill-white relative z-10 drop-shadow-sm"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </button>

      {/* ── Animations ── */}
      <style>{`
        @keyframes whatsappBubbleIn {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.92);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes whatsappBubbleOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
        }

        @keyframes whatsappPulse {
          0% {
            box-shadow: 0 4px 20px rgba(37, 211, 102, 0.35);
          }
          50% {
            box-shadow: 0 4px 28px rgba(37, 211, 102, 0.55);
          }
          100% {
            box-shadow: 0 4px 20px rgba(37, 211, 102, 0.35);
          }
        }

        @keyframes whatsappRipple {
          0% {
            transform: scale(1);
            opacity: 0.4;
          }
          100% {
            transform: scale(6);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
