import { useState, useEffect } from 'react';
import { Maximize2, Download, X, CheckCircle } from 'lucide-react';
import { usePwaInstall, type Platform } from '../hooks/usePwaInstall';

const STORAGE_KEY = 'supremacy_fullscreen_help_dismissed';

// ─── SVG icons matching iOS UI chrome ────────────────────────────────────────

function IosShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="4" y="9" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 2v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7.5 5.5L11 2l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IosAddHomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="18" height="18" rx="3.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 7v8M7 11h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IosOpenAppIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" fill="currentColor" fillOpacity="0.12" />
      <polygon points="11,6 16,16 6,16" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Step row for iOS instructions ───────────────────────────────────────────

function IosStep({ num, icon, label, sub }: { num: number; icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-slate-800/60">
      <span
        className="flex-none w-5 h-5 rounded-full border border-primary/40 bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {num}
      </span>
      <span className="flex-none text-primary">{icon}</span>
      <div>
        <span className="text-sm text-slate-200 leading-tight">{label}</span>
        {sub && <span className="block text-[11px] text-slate-500 mt-0.5">{sub}</span>}
      </div>
    </div>
  );
}

// ─── Platform-specific content panels ────────────────────────────────────────

function IosContent() {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-3">
        Para jogar em tela cheia no iPhone / iPad:
      </p>
      <IosStep
        num={1}
        icon={<IosShareIcon />}
        label="Toque em Compartilhar"
        sub="Botão na barra inferior do Safari"
      />
      <IosStep
        num={2}
        icon={<IosAddHomeIcon />}
        label="Adicionar à Tela de Início"
      />
      <IosStep
        num={3}
        icon={<IosOpenAppIcon />}
        label="Abra pelo ícone criado"
        sub="Abre sem barra do navegador"
      />
      {/* iOS doesn't allow automatic install — explain why */}
      <p className="text-[11px] text-slate-600 text-center pt-1 leading-relaxed">
        O iOS não permite instalação automática pelo navegador.
      </p>
    </div>
  );
}

type InstallStatus = 'idle' | 'pending' | 'accepted' | 'dismissed-by-user';

function AndroidContent({
  canInstall,
  status,
  onInstall,
}: {
  canInstall: boolean;
  status: InstallStatus;
  onInstall: () => void;
}) {
  if (status === 'accepted') {
    return (
      <div className="flex flex-col items-center gap-2 py-3">
        <CheckCircle size={32} className="text-emerald-400" />
        <p className="text-sm text-slate-300 text-center">
          Instalado com sucesso!
          <br />
          <span className="text-slate-500 text-xs">Abra pelo ícone na tela inicial.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canInstall ? (
        <button
          onClick={onInstall}
          disabled={status === 'pending'}
          className="w-full flex items-center justify-center gap-2.5 py-4 px-4 bg-primary text-white text-sm font-bold rounded-md uppercase tracking-wider hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-60"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Download size={16} />
          {status === 'pending' ? 'Instalando…' : 'Instalar e jogar em tela cheia'}
        </button>
      ) : (
        <div className="rounded-md bg-slate-800/60 border border-slate-700 p-3 text-xs text-slate-400 leading-relaxed">
          Para instalar, abra o menu do navegador{' '}
          <span className="font-bold text-slate-300">(⋮)</span> e escolha{' '}
          <span className="font-bold text-slate-300">Adicionar à tela inicial</span>.
        </div>
      )}
      {status === 'dismissed-by-user' && (
        <p className="text-[11px] text-amber-500 text-center">
          Cancelado. Você pode instalar pelo menu do navegador a qualquer momento.
        </p>
      )}
    </div>
  );
}

function OtherMobileContent() {
  return (
    <div className="rounded-md bg-slate-800/60 border border-slate-700 p-3 text-xs text-slate-400 leading-relaxed">
      Para melhor experiência, instale pelo menu do seu navegador{' '}
      <span className="font-bold text-slate-300">(Adicionar à tela inicial)</span>.
    </div>
  );
}

// ─── Corner decoration (military aesthetic) ───────────────────────────────────

function CornerDecor({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute w-5 h-5 border-primary/30';
  const cls = {
    tl: `${base} top-3 left-3 border-l-2 border-t-2`,
    tr: `${base} top-3 right-3 border-r-2 border-t-2`,
    bl: `${base} bottom-3 left-3 border-l-2 border-b-2`,
    br: `${base} bottom-3 right-3 border-r-2 border-b-2`,
  }[pos];
  return <div className={cls} aria-hidden="true" />;
}

// ─── Heading row shared by all platforms ─────────────────────────────────────

function PlatformLabel({ platform }: { platform: Platform }) {
  const labels: Record<Platform, string> = {
    ios: 'iPhone / iPad detectado',
    'android-chrome': 'Android detectado',
    'other-mobile': 'Celular detectado',
    desktop: 'Navegador detectado',
  };
  return (
    <span className="text-[10px] text-slate-500 uppercase tracking-wider">
      {labels[platform]}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface FullscreenOnboardingProps {
  /**
   * When true, forces the modal open regardless of localStorage state.
   * Used by the "Modo tela cheia" menu option.
   */
  externalOpen?: boolean;
  /** Called when the user closes a forced-open modal (does not write to localStorage). */
  onExternalClose?: () => void;
}

export default function FullscreenOnboarding({ externalOpen, onExternalClose }: FullscreenOnboardingProps) {
  const pwa = usePwaInstall();
  const [autoVisible, setAutoVisible] = useState(false);
  const [installStatus, setInstallStatus] = useState<InstallStatus>('idle');

  // Auto-show on first mobile visit when not already in standalone mode
  useEffect(() => {
    if (pwa.isStandalone) return;
    if (!pwa.isMobile) return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    setAutoVisible(true);
  }, [pwa.isStandalone, pwa.isMobile]);

  const isExternal = externalOpen === true;
  const visible = isExternal || autoVisible;

  if (!visible) return null;

  const handleClose = () => {
    if (isExternal) {
      onExternalClose?.();
    } else {
      localStorage.setItem(STORAGE_KEY, 'true');
      setAutoVisible(false);
    }
  };

  const handleInstall = async () => {
    setInstallStatus('pending');
    const result = await pwa.promptInstall();
    if (result === 'accepted') {
      setInstallStatus('accepted');
      // Brief success moment before closing
      setTimeout(handleClose, 2200);
    } else {
      setInstallStatus('dismissed-by-user');
    }
  };

  const handleFullscreen = async () => {
    await pwa.enterFullscreen();
    // Close the modal so the user can enjoy fullscreen
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label="Modo tela cheia"
    >
      {/* Military corner decor on backdrop */}
      <CornerDecor pos="tl" />
      <CornerDecor pos="tr" />
      <CornerDecor pos="bl" />
      <CornerDecor pos="br" />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-lg overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-300">

        {/* Subtle top accent line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

        {/* Header */}
        <div className="relative flex items-start gap-3 px-5 pt-4 pb-3.5 border-b border-slate-800">
          <div className="mt-0.5 p-2 rounded-md bg-primary/10 border border-primary/20 flex-none">
            <Maximize2 size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <PlatformLabel platform={pwa.platform} />
            <h2
              className="text-base font-bold text-white uppercase tracking-wider leading-tight mt-0.5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Modo App — Tela Cheia
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Jogue sem a barra do navegador
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-none mt-0.5 p-1.5 text-slate-600 hover:text-slate-300 active:scale-90 transition-all rounded"
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>

        {/* Platform content */}
        <div className="px-5 py-4">
          {pwa.platform === 'ios' && <IosContent />}
          {pwa.platform === 'android-chrome' && (
            <AndroidContent
              canInstall={pwa.canInstall}
              status={installStatus}
              onInstall={handleInstall}
            />
          )}
          {pwa.platform === 'other-mobile' && <OtherMobileContent />}
        </div>

        {/* Footer actions */}
        <div className="px-5 pb-5 space-y-2">
          {/* Fullscreen API — only for platforms that support it (not iOS) */}
          {pwa.supportsFullscreen && (
            <button
              onClick={handleFullscreen}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-slate-700 text-slate-300 text-sm rounded-md hover:bg-slate-800 active:scale-[0.97] transition-all"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Maximize2 size={14} />
              Entrar em tela cheia agora
            </button>
          )}

          {/* For iOS: "Continue in browser" is the primary dismiss */}
          <button
            onClick={handleClose}
            className="w-full py-2.5 text-xs text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {pwa.platform === 'ios' ? 'Continuar no navegador mesmo assim' : 'Continuar sem tela cheia'}
          </button>
        </div>
      </div>
    </div>
  );
}
