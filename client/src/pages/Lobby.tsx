import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Copy, Check, Wifi, WifiOff, Crown, Bot, User } from 'lucide-react';
import { useMultiplayerStore, inviteFromRoom } from '../game/multiplayer/session';
import { isMultiplayerConfigured } from '../game/multiplayer';
import { AIDifficulty, MarketMode } from '../game/types';
import { AI_DIFFICULTY_LABELS, DEFAULT_AI_DIFFICULTY } from '../game/ai';
import { SUPERPOWER_IDS } from '../data/initialPlayers';
import { useT } from '../i18n/useI18n';
import { useNames } from '../i18n/names';
import { TranslationKey } from '../i18n';

// MVP online: apenas Modo Clássico. O Digital Balanceado depende da fase de
// Venda Simultânea (declaração privada por jogador), que é uma feature
// multiplayer à parte — ver docs/multiplayer-status.md.
const MARKET_MODE_IDS: MarketMode[] = ['classic'];

type View = 'choose' | 'create' | 'join' | 'room';

export default function Lobby() {
  const [, setLocation] = useLocation();
  const t = useT();
  const names = useNames();
  const mp = useMultiplayerStore();
  const [view, setView] = useState<View>('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [humanSlots, setHumanSlots] = useState(2);
  const [aiCount, setAiCount] = useState(1);
  const [difficulty, setDifficulty] = useState<AIDifficulty>(DEFAULT_AI_DIFFICULTY);
  // MVP online: forçado a 'classic' (ver MARKET_MODES acima).
  const [marketMode, setMarketMode] = useState<MarketMode>('classic');
  const [copied, setCopied] = useState(false);

  const usingLocal = !isMultiplayerConfigured();

  // Pré-preenche o código vindo do link de convite (?code=XXXX).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code');
    if (c) { setCode(c.toUpperCase()); setView('join'); }
  }, []);

  // Quando há sala, mostra a sala de espera.
  useEffect(() => { if (mp.room) setView('room'); }, [mp.room]);

  // Partida iniciou → vai para o jogo.
  useEffect(() => {
    if (mp.status === 'active') setLocation('/game');
  }, [mp.status, setLocation]);

  const maxTotal = SUPERPOWER_IDS.length;
  const maxAi = Math.max(0, maxTotal - humanSlots);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const aiSeats = Array.from({ length: Math.min(aiCount, maxAi) }, () => ({ difficulty }));
    await mp.createRoom({ hostName: name.trim(), humanSlots, aiSeats });
  };
  const handleJoin = async () => {
    if (!name.trim() || !code.trim()) return;
    await mp.joinRoom(code.trim().toUpperCase(), name.trim());
  };
  const handleCopy = () => {
    if (!mp.room) return;
    navigator.clipboard.writeText(inviteFromRoom(mp.room));
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const handleLeave = async () => { await mp.leave(); setLocation('/'); };

  const inputCls = 'w-full px-4 py-3 rounded-md bg-secondary border border-border text-foreground text-sm focus:border-primary focus:outline-none';
  const btnPrimary = 'w-full py-4 px-6 bg-primary text-primary-foreground font-semibold uppercase tracking-wider text-sm rounded-md hover:opacity-90 transition-opacity active:scale-[0.97] disabled:opacity-40';
  const btnGhost = 'w-full py-2 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors';
  const dispFont = { fontFamily: 'var(--font-display)' };

  const presenceOnline = (userId: string | null) =>
    !!userId && mp.presence.some(p => p.userId === userId && p.status === 'online');

  const humanSeats = mp.players.filter(s => s.type === 'human');
  const allHumansReady = humanSeats.length > 0 && humanSeats.every(s => s.isReady);
  const canStart = mp.isHost && allHumansReady && mp.players.length >= 2;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-center mb-1 uppercase tracking-wider" style={dispFont}>
          {t('lobby.title')}
        </h1>
        <p className="text-xs text-muted-foreground text-center mb-6">
          {usingLocal ? t('lobby.localMode') : t('lobby.subtitle')}
        </p>

        {/* Escolha inicial */}
        {view === 'choose' && (
          <div className="flex flex-col gap-3">
            <button className={btnPrimary} style={dispFont} onClick={() => setView('create')}>{t('lobby.create')}</button>
            <button className="w-full py-4 px-6 bg-secondary text-secondary-foreground font-semibold uppercase tracking-wider text-sm rounded-md hover:opacity-90 active:scale-[0.97]" style={dispFont} onClick={() => setView('join')}>
              {t('lobby.joinByCode')}
            </button>
            <button className={btnGhost} style={dispFont} onClick={() => setLocation('/')}>{t('common.back')}</button>
          </div>
        )}

        {/* Criar sala */}
        {view === 'create' && (
          <div className="flex flex-col gap-4">
            <input className={inputCls} placeholder={t('lobby.yourName')} value={name} maxLength={20}
              onChange={e => setName(e.target.value)} />

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2" style={dispFont}>{t('lobby.humanSlots')}</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map(n => (
                  <button key={n} onClick={() => { setHumanSlots(n); if (aiCount > maxTotal - n) setAiCount(maxTotal - n); }}
                    className={`flex-1 h-10 rounded-md text-sm font-bold ${humanSlots === n ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`} style={dispFont}>{n}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2" style={dispFont}>{t('lobby.aiOpponents', { max: maxAi })}</label>
              <div className="flex gap-2">
                {Array.from({ length: maxAi + 1 }, (_, i) => i).map(n => (
                  <button key={n} onClick={() => setAiCount(n)}
                    className={`flex-1 h-10 rounded-md text-sm font-bold ${aiCount === n ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`} style={dispFont}>{n}</button>
                ))}
              </div>
            </div>

            {aiCount > 0 && (
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2" style={dispFont}>{t('setup.aiDifficulty')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(AI_DIFFICULTY_LABELS) as AIDifficulty[]).map(level => (
                    <button key={level} onClick={() => setDifficulty(level)}
                      className={`p-2 rounded-md border text-xs font-bold uppercase tracking-wider ${difficulty === level ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground'}`} style={dispFont}>
                      {t(`ai.diff.${level}.label` as TranslationKey)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2" style={dispFont}>{t('setup.marketMode')}</label>
              <div className="grid grid-cols-2 gap-2">
                {MARKET_MODE_IDS.map(m => (
                  <button key={m} onClick={() => setMarketMode(m)}
                    className={`p-2 rounded-md border text-xs font-bold uppercase tracking-wider ${marketMode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground'}`} style={dispFont}>
                    {t(`market.${m}.label` as TranslationKey)}
                  </button>
                ))}
              </div>
            </div>

            <button className={btnPrimary} style={dispFont} disabled={!name.trim() || mp.status === 'connecting'} onClick={handleCreate}>
              {mp.status === 'connecting' ? t('lobby.creating') : t('lobby.createRoom')}
            </button>
            <button className={btnGhost} style={dispFont} onClick={() => setView('choose')}>{t('common.back')}</button>
          </div>
        )}

        {/* Entrar por código */}
        {view === 'join' && (
          <div className="flex flex-col gap-4">
            <input className={inputCls} placeholder={t('lobby.yourName')} value={name} maxLength={20}
              onChange={e => setName(e.target.value)} />
            <input className={`${inputCls} tracking-[0.3em] text-center uppercase font-bold`} placeholder={t('lobby.codePlaceholder')} value={code} maxLength={5}
              onChange={e => setCode(e.target.value.toUpperCase())} />
            <button className={btnPrimary} style={dispFont} disabled={!name.trim() || !code.trim() || mp.status === 'connecting'} onClick={handleJoin}>
              {mp.status === 'connecting' ? t('lobby.joining') : t('lobby.enter')}
            </button>
            <button className={btnGhost} style={dispFont} onClick={() => setView('choose')}>{t('common.back')}</button>
          </div>
        )}

        {/* Sala de espera */}
        {view === 'room' && mp.room && (
          <div className="flex flex-col gap-4">
            {/* Convite */}
            <div className="bg-secondary/50 rounded-lg p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1" style={dispFont}>{t('lobby.roomCode')}</div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xl font-bold tracking-[0.3em]" style={dispFont}>{mp.room.code}</span>
                <button onClick={handleCopy} className="flex items-center gap-1 px-3 py-2 rounded-md bg-primary/10 text-primary text-xs uppercase tracking-wider hover:bg-primary/20" style={dispFont}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}{copied ? t('lobby.copied') : t('lobby.invite')}
                </button>
              </div>
            </div>

            {/* Jogadores */}
            <div className="space-y-2">
              {mp.players.map(seat => {
                const online = seat.type === 'ai' || presenceOnline(seat.userId);
                const isMe = seat.id === mp.mySeat?.id;
                return (
                  <div key={seat.id} className="flex items-center gap-3 p-3 rounded-md border border-border" style={{ borderLeftColor: seat.color, borderLeftWidth: 3 }}>
                    {seat.type === 'ai' ? <Bot size={16} className="text-muted-foreground" /> : <User size={16} className="text-muted-foreground" />}
                    <span className="flex-1 text-sm font-medium">
                      {seat.name}{isMe && <span className="text-muted-foreground"> {t('lobby.you')}</span>}
                      {mp.room!.hostUserId === seat.userId && <Crown size={12} className="inline ml-1 text-amber-400" />}
                    </span>
                    {seat.superpowerId && <span className="text-[10px] text-muted-foreground uppercase">{names.factionShort(seat.superpowerId)}</span>}
                    {online ? <Wifi size={14} className="text-green-500" /> : <WifiOff size={14} className="text-muted-foreground/50" />}
                    <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${seat.isReady ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}`} style={dispFont}>
                      {seat.isReady ? t('lobby.ready') : '…'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Ações */}
            {mp.mySeat?.type === 'human' && (
              <button className={btnPrimary} style={dispFont} onClick={() => mp.setReady(!mp.mySeat?.isReady)}>
                {mp.mySeat?.isReady ? t('lobby.cancelReady') : t('lobby.imReady')}
              </button>
            )}
            {mp.isHost && (
              <button className="w-full py-4 px-6 bg-green-600 text-white font-semibold uppercase tracking-wider text-sm rounded-md hover:opacity-90 active:scale-[0.97] disabled:opacity-40" style={dispFont}
                disabled={!canStart} onClick={() => mp.startMatch(marketMode)}>
                {canStart ? t('lobby.startMatch') : t('lobby.waitingReady')}
              </button>
            )}
            <button className={btnGhost} style={dispFont} onClick={handleLeave}>{t('lobby.leaveRoom')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
