import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { TIER_ORDER, tierStart } from "../domain/campaign";
import { formatElapsed } from "../domain/daily";
import type { Grid, Tier } from "../domain/types";
import { finishNext, finishPrimaryLabel, finishSummary } from "../game/finish";
import { campaignPuzzle, dailyPuzzle, newPracticePuzzle, practicePuzzle, practicePuzzleAt } from "../game/puzzles";
import { activeSlot, createGame, createPracticeGame, reduce } from "../game/reduce";
import type { Action, GameState } from "../game/types";
import { loadGame, saveGame, todayFrom, type KeyValueStore } from "../persistence/storage";
import { Board } from "./Board";
import { BoardViewport } from "./BoardViewport";
import { Coach } from "./Coach";
import { Finish } from "./Finish";
import { Pad } from "./Pad";
import { shareResult } from "./shareResult";
import { TierPicker } from "./TierPicker";
import { MAX_CELL, MIN_CELL, baseCell, clampCell, sans, theme } from "./theme";

interface GameProps {
  storage: KeyValueStore;
}

export function Game({ storage }: GameProps) {
  const [state, setState] = useState<GameState | null>(null);
  const [booting, setBooting] = useState(true);
  const [picking, setPicking] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cell, setCell] = useState(MIN_CELL);
  const [tick, setTick] = useState(0);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [active, setActive] = useState<{ row: number; col: number } | null>(null);
  const { width } = useWindowDimensions();
  const wide = width >= 880;

  useEffect(() => {
    let live = true;
    loadGame(storage)
      .then((saved) => {
        if (!live) return;
        if (saved) setState(saved);
        else setPicking(true);
      })
      .catch(() => {
        if (live) setPicking(true);
      })
      .finally(() => {
        if (live) setBooting(false);
      });
    return () => {
      live = false;
    };
  }, [storage]);

  useEffect(() => {
    if (!state) return;
    saveGame(storage, state).catch(() => undefined);
  }, [state, storage]);

  const stateRef = useRef(state);
  stateRef.current = state;
  const sitting = useRef<{ key: string; started: number; frozen: number | null } | null>(null);
  const liveOrigin = useRef<number | null>(null);
  const clockDay =
    state != null && state.surface === "daily" && state.daily != null && !state.daily.won && !picking
      ? state.daily.day
      : "";
  const clocking = clockDay !== "";

  const bankOpenDaily = (current: GameState): GameState => {
    const started = liveOrigin.current;
    if (started == null || current.surface !== "daily" || !current.daily || current.daily.won) return current;
    const ms = Date.now() - started;
    liveOrigin.current = Date.now();
    if (ms < 1) return current;
    return reduce(current, { type: "bank-daily", ms: Math.floor(ms) });
  };
  useEffect(() => {
    if (!clocking) return;
    liveOrigin.current = Date.now();
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    const onAppState = (next: string) => {
      if (next === "active") {
        liveOrigin.current = Date.now();
        setTick((n) => n + 1);
        return;
      }
      const started = liveOrigin.current;
      liveOrigin.current = null;
      if (started == null) return;
      const ms = Date.now() - started;
      setState((current) => (current ? bankDaily(current, clockDay, ms) : current));
    };
    const sub = AppState.addEventListener("change", onAppState);
    return () => {
      clearInterval(id);
      sub.remove();
      const started = liveOrigin.current;
      liveOrigin.current = null;
      if (started == null) return;
      const ms = Date.now() - started;
      setState((current) => (current ? bankDaily(current, clockDay, ms) : current));
    };
  }, [clocking, clockDay]);

  const pane = wide ? Math.max(320, width - 420) : Math.max(280, width - 24);
  const puzzleKey = state
    ? `${state.surface}:${state.mode}:${activeSlot(state).puzzle.id}:${activeSlot(state).puzzle.seed}`
    : "";
  useEffect(() => {
    const current = stateRef.current;
    if (!current) return;
    const slot = activeSlot(current);
    setCell(baseCell(slot.puzzle.shape, slot.puzzle.size, pane));
  }, [puzzleKey, pane]);
  useEffect(() => {
    setActive(null);
  }, [puzzleKey]);

  const playing = state != null && !picking;
  useEffect(() => {
    if (Platform.OS !== "web" || !playing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
          event.preventDefault();
          play({ type: "undo" });
        }
        return;
      }
      if (event.key === "0" || event.key === "1") {
        play({ type: "select", tool: event.key === "0" ? 0 : 1 });
      } else if (event.key === "Backspace" || event.key === "x") {
        play({ type: "select", tool: "erase" });
      } else if (event.key === "h") {
        play({ type: "hint", today: todayFrom() });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  const play = (action: Action) => {
    const current = stateRef.current;
    if (!current) return;
    const banked = bankOpenDaily(current);
    const next = reduce(banked, action);
    stateRef.current = next;
    const landed = focusAfter(action, banked, next);
    if (landed) setActive(landed);
    setState(next);
  };

  const chooseTier = (tier: Tier) => {
    if (busy) return;
    const current = stateRef.current;
    if (current && current.tier === tier && current.surface !== "daily") {
      setPickerError(null);
      setPicking(false);
      return;
    }
    if (current && (current.savedTiers[tier] || current.tier === tier)) {
      setPickerError(null);
      setState(reduce(bankOpenDaily(current), { type: "choose-tier", tier }));
      setPicking(false);
      return;
    }
    setBusy(true);
    setPickerError(null);
    setTimeout(() => {
      const latest = stateRef.current;
      try {
        const start = tierStart(tier);
        let next: GameState;
        if (start.kind === "campaign") {
          const puzzle = campaignPuzzle(start.campaignIndex);
          const fresh = { mode: "campaign" as const, puzzle, campaignIndex: start.campaignIndex };
          next = latest ? reduce(bankOpenDaily(latest), { type: "choose-tier", tier, fresh }) : createGame(puzzle, start.campaignIndex);
        } else {
          const puzzle = practicePuzzleAt(start.tier, start.shape, start.size, start.rules, Date.now() >>> 0);
          const campaign = campaignPuzzle(0);
          const fresh = { mode: "practice" as const, puzzle, campaign, campaignIndex: 0 };
          next = latest ? reduce(bankOpenDaily(latest), { type: "choose-tier", tier, fresh }) : createPracticeGame(puzzle, campaign, 0);
        }
        setState(next);
        setPicking(false);
      } catch {
        setPickerError("Could not build a board. Try again.");
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const openDaily = () => {
    if (busy) return;
    const day = todayFrom();
    const current = stateRef.current;
    if (current?.daily?.day === day) {
      setPickerError(null);
      setState(reduce(bankOpenDaily(current), { type: "play-daily", day }));
      setPicking(false);
      return;
    }
    setBusy(true);
    setPickerError(null);
    setTimeout(() => {
      const latest = stateRef.current;
      try {
        const puzzle = dailyPuzzle(day);
        const shell = latest ?? createGame(campaignPuzzle(0));
        const banked = latest ? bankOpenDaily(shell) : shell;
        setState(reduce(banked, { type: "play-daily", day, puzzle }));
        setPicking(false);
      } catch {
        setPickerError("Could not build a board. Try again.");
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const backToPicker = () => {
    if (busy) return;
    setPickerError(null);
    setPicking(true);
  };

  if (booting || (!state && !picking)) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.ink} />
        <Text style={styles.loadingText}>Opening the board…</Text>
      </View>
    );
  }

  if (picking || !state) {
    return (
      <TierPicker
        busy={busy}
        error={pickerError}
        continued={continuedTiers(state)}
        dailyStatus={dailyStatus(state)}
        dailyStreak={state?.dailyStreak ?? 0}
        stars={state?.stars ?? {}}
        canBack={state != null}
        onPick={chooseTier}
        onDaily={openDaily}
        onBack={() => {
          if (!busy) setPicking(false);
        }}
      />
    );
  }

  const slot = activeSlot(state);
  const onDaily = state.surface === "daily";
  const summary = finishSummary(state);
  const next = summary ? finishNext(state) : null;
  const primaryLabel = !onDaily && !slot.won && state.mode === "practice" ? "New board" : null;
  const liveMs =
    clocking && tick >= 0 && liveOrigin.current != null ? Math.max(0, Date.now() - liveOrigin.current) : 0;
  const elapsedLabel = formatElapsed((state.daily?.elapsedMs ?? 0) + liveMs);
  const tierTime = sittingLabel(sitting, puzzleKey, slot.won);

  const build = (make: (current: GameState) => GameState) => {
    setBusy(true);
    setTimeout(() => {
      const current = stateRef.current;
      if (!current) {
        setBusy(false);
        return;
      }
      try {
        setState(make(current));
      } catch {
        setState({ ...current, coachLine: "Could not build a board. Try again." });
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const onPrimary = () => {
    if (busy || state.mode !== "practice" || slot.won) return;
    build((current) => {
      const seed = (Date.now() ^ (activeSlot(current).puzzle.seed + 1)) >>> 0;
      const active = activeSlot(current).puzzle;
      return reduce(current, { type: "new-practice", puzzle: newPracticePuzzle(current.campaignIndex, active, seed) });
    });
  };

  const onFinishPrimary = () => {
    if (busy || !next) return;
    if (next.kind === "picker") {
      backToPicker();
      return;
    }
    if (next.kind === "lesson") {
      const index = next.campaignIndex;
      build((current) => reduce(current, { type: "next-lesson", puzzle: campaignPuzzle(index), campaignIndex: index }));
      return;
    }
    build((current) => {
      const seed = (Date.now() ^ (activeSlot(current).puzzle.seed + 1)) >>> 0;
      const active = activeSlot(current).puzzle;
      return reduce(current, { type: "new-practice", puzzle: newPracticePuzzle(current.campaignIndex, active, seed) });
    });
  };

  const onMode = (mode: "campaign" | "practice") => {
    if (busy || state.surface === "daily" || mode === state.mode) return;
    if (mode === "campaign") {
      setState((current) => (current ? reduce(current, { type: "switch-campaign" }) : current));
      return;
    }
    if (state.practice) {
      setState((current) =>
        current ? reduce(current, { type: "switch-practice", puzzle: current.practice?.puzzle ?? state.practice!.puzzle }) : current,
      );
      return;
    }
    build((current) =>
      reduce(current, { type: "switch-practice", puzzle: practicePuzzle(current.campaignIndex, Date.now() >>> 0) }),
    );
  };

  const coach = (
    <Coach
      state={state}
      slot={slot}
      elapsedLabel={elapsedLabel}
      shareNote={shareNote}
      onMode={onMode}
      onBack={backToPicker}
      onShare={(line) => {
        shareResult(line)
          .then((outcome) => {
            if (outcome === "copied") setShareNote("Copied.");
            else if (outcome === "shared") setShareNote("Shared.");
            else setShareNote(null);
          })
          .catch(() => setShareNote("Could not share that line."));
      }}
    />
  );
  const pad = (
    <Pad
      selected={state.selected}
      tier={slot.puzzle.tier}
      canUndo={onDaily ? (state.daily?.undo.length ?? 0) > 0 : state.undo.length > 0}
      canHint={!slot.won}
      canReset
      primaryLabel={primaryLabel}
      busy={busy}
      onSelect={(tool) => play({ type: "select", tool })}
      onUndo={() => play({ type: "undo" })}
      onHint={() => play({ type: "hint", today: todayFrom() })}
      onReset={() => play({ type: "reset" })}
      onPrimary={onPrimary}
      onZoomIn={() => setCell((size) => clampCell(Math.min(MAX_CELL, size + 4)))}
      onZoomOut={() => setCell((size) => clampCell(Math.max(MIN_CELL, size - 4)))}
    />
  );

  const board = (
    <BoardViewport cellSize={cell} minCell={MIN_CELL} maxCell={MAX_CELL} onCellSize={setCell}>
      {summary && next ? (
        <Finish
          timeLabel={onDaily ? elapsedLabel : tierTime}
          moves={summary.moves}
          par={summary.par}
          stars={summary.stars}
          earnedPoints={summary.earnedPoints}
          points={summary.points}
          puzzleStreak={summary.puzzleStreak}
          dailyStreak={summary.dailyStreak}
          primaryLabel={finishPrimaryLabel(next)}
          busy={busy}
          onPrimary={onFinishPrimary}
          onBack={backToPicker}
        />
      ) : (
        <Board
          grid={slot.grid}
          givens={slot.puzzle.givens}
          cellSize={cell}
          disabled={slot.won || busy}
          active={active}
          onTap={(row, col) => play({ type: "tap", row, col, today: todayFrom() })}
        />
      )}
    </BoardViewport>
  );

  return (
    <View style={[styles.screen, wide ? styles.wide : styles.narrow]}>
      {wide ? (
        <>
          {board}
          <View style={styles.side}>
            {coach}
            {pad}
          </View>
        </>
      ) : (
        <>
          <View style={styles.top}>{coach}</View>
          {board}
          <View style={styles.bottom}>{pad}</View>
        </>
      )}
    </View>
  );
}

function sittingLabel(
  sitting: { current: { key: string; started: number; frozen: number | null } | null },
  key: string,
  won: boolean,
): string {
  const now = Date.now();
  if (sitting.current?.key !== key) {
    sitting.current = { key, started: now, frozen: won ? 0 : null };
  }
  const current = sitting.current;
  if (won && current.frozen == null) current.frozen = Math.max(0, now - current.started);
  if (!won && current.frozen != null) {
    current.frozen = null;
    current.started = now;
  }
  return formatElapsed(current.frozen ?? Math.max(0, now - current.started));
}

function continuedTiers(state: GameState | null): readonly Tier[] {
  if (!state) return [];
  const found = new Set<Tier>([state.tier]);
  for (const tier of TIER_ORDER) {
    if (state.savedTiers[tier]) found.add(tier);
  }
  return TIER_ORDER.filter((tier) => found.has(tier));
}

function dailyStatus(state: GameState | null): "fresh" | "playing" | "won" {
  const today = todayFrom();
  if (!state?.daily || state.daily.day !== today) return "fresh";
  return state.daily.won ? "won" : "playing";
}

function focusAfter(
  action: Action,
  before: GameState,
  after: GameState,
): { row: number; col: number } | null {
  if (action.type === "tap") return { row: action.row, col: action.col };
  if (action.type !== "undo") return null;
  return changedCell(activeSlot(before).grid, activeSlot(after).grid);
}

function changedCell(before: Grid, after: Grid): { row: number; col: number } | null {
  const rows = Math.min(before.length, after.length);
  for (let row = 0; row < rows; row++) {
    const cols = Math.min(before[row].length, after[row].length);
    for (let col = 0; col < cols; col++) {
      if (before[row][col] !== after[row][col]) return { row, col };
    }
  }
  return null;
}

function bankDaily(current: GameState, day: string, ms: number): GameState {
  if (ms < 1 || current.surface !== "daily" || current.daily?.day !== day || current.daily.won) return current;
  return reduce(current, { type: "bank-daily", ms: Math.floor(ms) });
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.paper,
  },
  narrow: {
    paddingTop: Platform.OS === "ios" ? 54 : 18,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === "ios" ? 20 : 12,
    gap: 10,
  },
  wide: {
    flexDirection: "row",
    padding: 20,
    gap: 20,
  },
  top: {},
  bottom: {},
  side: {
    width: 360,
    gap: 16,
  },
  loading: {
    flex: 1,
    backgroundColor: theme.paper,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontFamily: sans,
    color: theme.inkSoft,
    fontSize: 16,
  },
});
