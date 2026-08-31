import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameEngine, DEFAULT_RENDER, type EngineOptions, type Snapshot, type TrainingConfig } from './game/GameEngine';
import type { Difficulty, FighterDef } from './game/types';
import { BOSS_ID, SELECTABLE, moveList } from './data/fighters';
import { BOSS_STAGE, HOME_STAGE, STAGES } from './data/stages';
import { DEFAULT_P1, DEFAULT_P2, keyboard, mergeState, touch } from './input/sources';
import type { Btn } from './input/InputBuffer';
import { audio } from './audio/AudioManager';
import { music } from './audio/MusicManager';
import { forge } from './rendering/forge/SpriteForge';
import './styles.css';

type Screen = 'menu' | 'select' | 'fight' | 'gallery' | 'records' | 'settings' | 'credits';
type Mode = 'arcade' | 'versus' | 'training' | 'survival';

const STORE = 'bayani-brawl-save-v1';

interface SaveData {
  completions: Record<string, number>;
  wins: number;
  kos: number;
  bestCombo: number;
  settings: {
    difficulty: Difficulty;
    shake: boolean;
    flash: boolean;
    scanlines: boolean;
    damage: boolean;
    reduced: boolean;
    simple: boolean;
    master: number;
    music: number;
    sfx: number;
  };
}

const defaultSave: SaveData = {
  completions: {},
  wins: 0,
  kos: 0,
  bestCombo: 0,
  settings: {
    difficulty: 'MANDIRIGMA',
    shake: true,
    flash: true,
    scanlines: true,
    damage: true,
    reduced: false,
    simple: false,
    master: 0.7,
    music: 0.55,
    sfx: 0.8,
  },
};

function loadSave(): SaveData {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) || '{}') as Partial<SaveData>;
    return {
      ...defaultSave,
      ...raw,
      settings: { ...defaultSave.settings, ...(raw.settings ?? {}) },
      completions: { ...defaultSave.completions, ...(raw.completions ?? {}) },
    };
  } catch {
    return defaultSave;
  }
}

function writeSave(save: SaveData): void {
  localStorage.setItem(STORE, JSON.stringify(save));
}

function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<Mode>('arcade');
  const [selected, setSelected] = useState(0);
  const [enemy, setEnemy] = useState(1);
  const [arcadeStep, setArcadeStep] = useState(0);
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => writeSave(save), [save]);

  const hero = SELECTABLE[selected];
  const foe = SELECTABLE[enemy === selected ? (enemy + 1) % SELECTABLE.length : enemy];

  useEffect(() => {
    audio.applySettings({
      master: save.settings.master,
      music: save.settings.music,
      sfx: save.settings.sfx,
    });
  }, [save.settings.master, save.settings.music, save.settings.sfx]);

  useEffect(() => {
    if (!audio.ready) return;
    if (screen === 'menu') music.play('title');
    if (screen === 'select') music.play('select');
  }, [screen]);

  const wakeAudio = async (track = 'title') => {
    await audio.init();
    audio.applySettings({
      master: save.settings.master,
      music: save.settings.music,
      sfx: save.settings.sfx,
    });
    music.play(track);
  };

  const start = async (nextMode: Mode) => {
    await wakeAudio('select');
    audio.play('select');
    setMode(nextMode);
    if (nextMode === 'arcade') setArcadeStep(0);
    setScreen('select');
  };

  const beginFight = async () => {
    await wakeAudio(mode === 'arcade' ? (HOME_STAGE[nextArcadeOpponent] || 'shore') : (HOME_STAGE[foe.id] || 'shore'));
    audio.play('fight');
    setSnapshot(null);
    setScreen('fight');
  };

  const nextArcadeOpponent = useMemo(() => {
    const ids = SELECTABLE.map((f) => f.id).filter((id) => id !== hero.id);
    const ladder = [...ids.slice(0, 6), ids[(selected + 3) % ids.length], ids[(selected + 5) % ids.length], BOSS_ID];
    return ladder[Math.min(arcadeStep, ladder.length - 1)];
  }, [arcadeStep, hero.id, selected]);

  return (
    <div className="app">
      {screen === 'menu' && <MainMenu onStart={start} open={setScreen} wakeAudio={wakeAudio} />}
      {screen === 'select' && (
        <CharacterSelect
          mode={mode}
          selected={selected}
          enemy={enemy}
          setSelected={setSelected}
          setEnemy={setEnemy}
          onBack={() => setScreen('menu')}
          onFight={beginFight}
        />
      )}
      {screen === 'fight' && (
        <FightScreen
          mode={mode}
          save={save}
          setSave={setSave}
          heroId={hero.id}
          foeId={mode === 'arcade' ? nextArcadeOpponent : foe.id}
          stageId={mode === 'arcade' && nextArcadeOpponent === BOSS_ID ? BOSS_STAGE : HOME_STAGE[mode === 'arcade' ? nextArcadeOpponent : foe.id] || STAGES[0].id}
          arcadeStep={arcadeStep}
          setArcadeStep={setArcadeStep}
          onSelect={() => setScreen('select')}
          onMenu={() => setScreen('menu')}
          snapshot={snapshot}
          setSnapshot={setSnapshot}
        />
      )}
      {screen === 'gallery' && <Gallery onBack={() => setScreen('menu')} />}
      {screen === 'records' && <Records save={save} onBack={() => setScreen('menu')} />}
      {screen === 'settings' && <Settings save={save} setSave={setSave} onBack={() => setScreen('menu')} />}
      {screen === 'credits' && <Credits onBack={() => setScreen('menu')} />}
    </div>
  );
}

function MainMenu({ onStart, open, wakeAudio }: { onStart: (m: Mode) => void; open: (s: Screen) => void; wakeAudio: () => Promise<void> }) {
  const go = async (s: Screen) => {
    await wakeAudio();
    audio.play('menu');
    open(s);
  };
  return (
    <main className="screen menu">
      <div className="titleBlock">
        <span className="insertCoin">PRESS ANY MODE</span>
        <h1>BAYANI BRAWL</h1>
        <p>HONOR THE PAST. FIGHT FOR THE FUTURE.</p>
      </div>
      <nav className="menuList">
        <button onClick={() => onStart('arcade')}>ARCADE</button>
        <button onClick={() => onStart('versus')}>VERSUS CPU</button>
        <button onClick={() => onStart('training')}>TRAINING</button>
        <button onClick={() => onStart('survival')}>SURVIVAL</button>
        <button onClick={() => go('gallery')}>FIGHTERS</button>
        <button onClick={() => go('records')}>RECORDS</button>
        <button onClick={() => go('settings')}>SETTINGS</button>
        <button onClick={() => go('credits')}>CREDITS</button>
      </nav>
    </main>
  );
}

function CharacterSelect(props: {
  mode: Mode;
  selected: number;
  enemy: number;
  setSelected: (n: number) => void;
  setEnemy: (n: number) => void;
  onBack: () => void;
  onFight: () => void;
}) {
  const f = SELECTABLE[props.selected];
  return (
    <main className="screen select">
      <header className="topbar">
        <button onClick={props.onBack}>BACK</button>
        <h2>{props.mode.toUpperCase()}</h2>
        <button onClick={() => props.onFight()}>FIGHT</button>
      </header>
      <CharacterPreview fighter={f} />
      <section className="selectGrid">
        {SELECTABLE.map((x, i) => (
          <button key={x.id} className={i === props.selected ? 'portrait active' : 'portrait'} onClick={() => props.setSelected(i)}>
            <span>{x.name}</span>
          </button>
        ))}
      </section>
      <aside className="fighterPanel">
        <h3>{f.name}</h3>
        <strong>{f.title}</strong>
        <p>{f.style}</p>
        <Stat name="POWER" n={f.stats.power} />
        <Stat name="SPEED" n={f.stats.speed} />
        <Stat name="DEFENSE" n={f.stats.defense} />
        <Stat name="TECHNIQUE" n={f.stats.technique} />
        {props.mode !== 'arcade' && (
          <label className="enemyPick">
            CPU
            <select value={props.enemy} onChange={(e) => props.setEnemy(Number(e.target.value))}>
              {SELECTABLE.map((x, i) => <option key={x.id} value={i}>{x.name}</option>)}
            </select>
          </label>
        )}
      </aside>
      <section className="movePanel">
        <h3>MOVE LIST</h3>
        {moveList(f).slice(0, 16).map((m) => (
          <p key={m.id}><b>{m.name}</b><span>{m.notation}</span></p>
        ))}
      </section>
    </main>
  );
}

function CharacterPreview({ fighter }: { fighter: FighterDef }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(240, Math.floor(rect.width * dpr));
      canvas.height = Math.max(220, Math.floor(rect.height * dpr));
    };

    const draw = (time: number) => {
      resize();
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#241323');
      grad.addColorStop(0.56, '#150b14');
      grad.addColorStop(1, '#07050a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 0.26;
      ctx.fillStyle = '#ffd83c';
      for (let x = 0; x < w; x += 12) ctx.fillRect(x, 0, 1, h);
      for (let y = 0; y < h; y += 12) ctx.fillRect(0, y, w, 1);
      ctx.globalAlpha = 1;

      const frameNo = Math.floor(time / 115);
      const frame = forge.get(fighter.art.plan, fighter.art.palette, 'idle', frameNo);
      const floor = h - 28;
      const scale = Math.max(2, Math.min(3.4, (h - 50) / frame.h));
      const x = Math.round(w / 2 + frame.ox * scale);
      const y = Math.round(floor + frame.oy * scale);

      ctx.fillStyle = 'rgba(0,0,0,0.44)';
      ctx.fillRect(Math.round(w / 2 - 54), Math.round(floor - 4), 108, 6);

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      ctx.drawImage(frame.canvas, 0, 0);
      ctx.restore();

      ctx.fillStyle = '#ffd83c';
      ctx.font = '700 13px BayaniPixel, "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(fighter.name.toUpperCase(), w / 2, 22);
      ctx.fillStyle = '#70d8ff';
      ctx.font = '700 10px BayaniPixel, "Courier New", monospace';
      ctx.fillText(fighter.archetype.toUpperCase(), w / 2, 40);

      ctx.restore();
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [fighter]);

  return (
    <section className="characterPreview">
      <canvas ref={canvasRef} aria-label={`${fighter.name} animated character preview`} />
      <div className="previewPlate">
        <span>PLAYER 1</span>
        <b>{fighter.name}</b>
      </div>
    </section>
  );
}

function FightScreen(props: {
  mode: Mode;
  save: SaveData;
  setSave: React.Dispatch<React.SetStateAction<SaveData>>;
  heroId: string;
  foeId: string;
  stageId: string;
  arcadeStep: number;
  setArcadeStep: (n: number) => void;
  onSelect: () => void;
  onMenu: () => void;
  snapshot: Snapshot | null;
  setSnapshot: (s: Snapshot | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const engine = useRef<GameEngine | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    keyboard.attach();
    return () => {
      keyboard.detach();
      touch.clear();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(320, Math.floor(rect.width * dpr));
      canvas.height = Math.max(180, Math.floor(rect.height * dpr));
      force((n) => n + 1);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    engine.current?.stop();
    const training: TrainingConfig | undefined = props.mode === 'training'
      ? { dummy: 'blockAll', infiniteHp: true, infiniteMeter: true, showHitboxes: false, showInputs: true, showDamage: true }
      : undefined;
    const opts: EngineOptions = {
      p1: props.heroId,
      p2: props.foeId,
      stage: props.stageId,
      difficulty: props.save.settings.difficulty,
      p2Kind: props.mode === 'training' ? 'training' : 'cpu',
      rounds: props.mode === 'survival' || props.mode === 'training' ? 1 : 2,
      roundTime: props.mode === 'training' ? 999 : 99,
      training,
      simpleInputs: props.save.settings.simple,
    };
    const e = new GameEngine(canvas, opts);
    e.applySettings({
      ...DEFAULT_RENDER,
      screenShake: props.save.settings.shake,
      hitFlash: props.save.settings.flash,
      scanlines: props.save.settings.scanlines,
      damageNumbers: props.save.settings.damage,
      reducedMotion: props.save.settings.reduced,
      inputDisplay: props.mode === 'training',
    });
    e.inputSource = (i) => i === 0 ? mergeState(keyboard.stateFor(DEFAULT_P1), touch.state()) : keyboard.stateFor(DEFAULT_P2);
    e.onSnapshot = props.setSnapshot;
    e.onEvent = (kind, payload) => {
      if (kind === 'ko') props.setSave((s) => ({ ...s, kos: s.kos + 1 }));
      if (kind === 'matchEnd') {
        const winner = (payload as { winner: 0 | 1 }).winner;
        if (winner === 0) {
          props.setSave((s) => ({
            ...s,
            wins: s.wins + 1,
            bestCombo: Math.max(s.bestCombo, e.f1.stats.longestCombo),
            completions: props.mode === 'arcade' && props.foeId === BOSS_ID
              ? { ...s.completions, [props.heroId]: (s.completions[props.heroId] || 0) + 1 }
              : s.completions,
          }));
        }
      }
    };
    engine.current = e;
    e.start();
    return () => e.stop();
  }, [props.heroId, props.foeId, props.stageId, props.mode, props.save.settings, props.setSave, props.setSnapshot]);

  const snap = props.snapshot;
  const playerWon = snap?.matchOver && snap.matchWinner === 0;
  const arcadeDone = props.mode === 'arcade' && props.foeId === BOSS_ID && playerWon;

  const next = () => {
    if (props.mode === 'arcade' && playerWon && !arcadeDone) {
      props.setArcadeStep(props.arcadeStep + 1);
      props.setSnapshot(null);
    } else if (props.mode === 'survival' && playerWon) {
      props.setArcadeStep(props.arcadeStep + 1);
      props.setSnapshot(null);
    } else {
      engine.current?.rematch();
    }
  };

  return (
    <main className="fightScreen">
      <div ref={wrapRef} className="canvasWrap">
        <canvas ref={canvasRef} />
        <TouchControls />
        <div className="fightTop">
          <button onClick={() => engine.current?.pause()}>PAUSE</button>
          <button onClick={() => engine.current?.resume()}>RESUME</button>
          <button onClick={props.onSelect}>SELECT</button>
        </div>
        <ControlGuide mode={props.mode} />
        {snap?.matchOver && (
          <div className="results">
            <h2>{snap.matchWinner === 0 ? 'VICTORY' : 'DEFEAT'}</h2>
            <p>{snap.p1.name} vs {snap.p2.name}</p>
            <p>Damage {snap.stats[0].damageDealt} | Longest combo {snap.stats[0].longestCombo} | Throws {snap.stats[0].throws}</p>
            {arcadeDone && <p>Arcade cleared. Forgotten history steps back into the light.</p>}
            <div>
              <button onClick={next}>{playerWon && props.mode === 'arcade' && !arcadeDone ? 'NEXT FIGHT' : 'REMATCH'}</button>
              <button onClick={props.onSelect}>CHARACTER SELECT</button>
              <button onClick={props.onMenu}>MAIN MENU</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ControlGuide({ mode }: { mode: Mode }) {
  return (
    <aside className="controlGuide" aria-label="Controls guide">
      <h3>CONTROLS</h3>
      <div className="guideRows">
        <p><b>A / D</b><span>MOVE</span></p>
        <p><b>W</b><span>JUMP</span></p>
        <p><b>S</b><span>CROUCH</span></p>
        <p><b>SHIFT</b><span>BLOCK</span></p>
        <p><b>J</b><span>LIGHT</span></p>
        <p><b>K</b><span>HEAVY</span></p>
        <p><b>L</b><span>SPECIAL</span></p>
        <p><b>I</b><span>GRAB</span></p>
        <p><b>SPACE</b><span>SUPER</span></p>
      </div>
      {mode === 'training' && <small>TRAINING: dummy blocks, HP and meter stay full.</small>}
      <small className="mobileHint">TOUCH: left pad moves, right buttons attack.</small>
    </aside>
  );
}

function TouchControls() {
  return (
    <div className="touchControls">
      <div className="dpad">
        <TouchDir label="UP" btn="up" />
        <TouchDir label="LEFT" btn="left" />
        <TouchDir label="DOWN" btn="down" />
        <TouchDir label="RIGHT" btn="right" />
      </div>
      <div className="buttons">
        <TouchBtn label="L" btn="light" />
        <TouchBtn label="H" btn="heavy" />
        <TouchBtn label="SP" btn="special" />
        <TouchBtn label="BL" btn="block" />
        <TouchBtn label="GR" btn="grab" />
        <TouchBtn label="SU" btn="super" />
      </div>
    </div>
  );
}

function TouchBtn({ label, btn }: { label: string; btn: Btn }) {
  return <button onPointerDown={(e) => touch.press(e.pointerId, btn)} onPointerUp={(e) => touch.release(e.pointerId)} onPointerCancel={(e) => touch.release(e.pointerId)}>{label}</button>;
}

function TouchDir({ label, btn }: { label: string; btn: Btn }) {
  return <button onPointerDown={(e) => touch.press(e.pointerId, btn)} onPointerUp={(e) => touch.release(e.pointerId)} onPointerCancel={(e) => touch.release(e.pointerId)}>{label}</button>;
}

function Stat({ name, n }: { name: string; n: number }) {
  return <p className="stat"><span>{name}</span><b>{'★★★★★'.slice(0, n)}</b></p>;
}

function Gallery({ onBack }: { onBack: () => void }) {
  return (
    <main className="screen library">
      <header className="topbar"><button onClick={onBack}>BACK</button><h2>FIGHTER GALLERY</h2></header>
      <div className="cards">{SELECTABLE.map((f) => <article key={f.id}><h3>{f.name}</h3><b>{f.title}</b><p>HISTORICAL BACKGROUND: {f.bio.historical}</p><p>BAYANI BRAWL LORE: {f.bio.lore}</p></article>)}</div>
    </main>
  );
}

function Records({ save, onBack }: { save: SaveData; onBack: () => void }) {
  return <main className="screen library"><header className="topbar"><button onClick={onBack}>BACK</button><h2>RECORDS</h2></header><div className="recordBox"><p>Wins {save.wins}</p><p>KOs {save.kos}</p><p>Best Combo {save.bestCombo}</p><p>Arcade Clears {Object.values(save.completions).reduce((a, b) => a + b, 0)}</p></div></main>;
}

function Settings({ save, setSave, onBack }: { save: SaveData; setSave: React.Dispatch<React.SetStateAction<SaveData>>; onBack: () => void }) {
  const update = (settings: Partial<SaveData['settings']>) => setSave((s) => ({ ...s, settings: { ...s.settings, ...settings } }));
  return (
    <main className="screen library">
      <header className="topbar"><button onClick={onBack}>BACK</button><h2>SETTINGS</h2></header>
      <div className="settingsGrid">
        <label>Difficulty<select value={save.settings.difficulty} onChange={(e) => update({ difficulty: e.target.value as Difficulty })}><option>CADET</option><option>MANDIRIGMA</option><option>BAYANI</option><option>ALAMAT</option></select></label>
        <label>MASTER VOLUME<input type="range" min="0" max="1" step="0.01" value={save.settings.master} onChange={(e) => update({ master: Number(e.target.value) })} /></label>
        <label>MUSIC VOLUME<input type="range" min="0" max="1" step="0.01" value={save.settings.music} onChange={(e) => update({ music: Number(e.target.value) })} /></label>
        <label>SFX VOLUME<input type="range" min="0" max="1" step="0.01" value={save.settings.sfx} onChange={(e) => update({ sfx: Number(e.target.value) })} /></label>
        {(['shake', 'flash', 'scanlines', 'damage', 'reduced', 'simple'] as const).map((k) => <label key={k}><input type="checkbox" checked={save.settings[k]} onChange={(e) => update({ [k]: e.target.checked })} />{k.toUpperCase()}</label>)}
      </div>
    </main>
  );
}

function Credits({ onBack }: { onBack: () => void }) {
  return <main className="screen library"><header className="topbar"><button onClick={onBack}>BACK</button><h2>CREDITS</h2></header><p className="credit">BAYANI BRAWL is an original browser fighting game prototype inspired by Philippine history, arcade competition, and 32-bit pixel craft. Fictional combat, respectful historical notes.</p></main>;
}

createRoot(document.getElementById('root')!).render(<App />);
