import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { tierStart } from "../domain/campaign";
import type { Tier } from "../domain/types";
import { campaignPuzzle, hasNextLesson, newPracticePuzzle, practicePuzzle, practicePuzzleAt } from "../game/puzzles";
import { activeSlot, createGame, reduce } from "../game/reduce";
import type { GameState } from "../game/types";
import { loadGame, saveGame, todayFrom, type KeyValueStore } from "../persistence/storage";
import { Board } from "./Board";
import { BoardViewport } from "./BoardViewport";
import { Coach } from "./Coach";
import { Pad } from "./Pad";
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
  const pane = wide ? Math.max(320, width - 420) : Math.max(280, width - 24);
  const puzzleKey = state ? `${state.mode}:${activeSlot(state).puzzle.id}:${activeSlot(state).puzzle.seed}` : "";
  useEffect(() => {
    const current = stateRef.current;
    if (!current) return;
    const slot = activeSlot(current);
    setCell(baseCell(slot.puzzle.shape, slot.puzzle.size, pane));
  }, [puzzleKey, pane]);

  const playing = state != null && !picking;
  useEffect(() => {
    if (Platform.OS !== "web" || !playing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
          event.preventDefault();
          setState((current) => (current ? reduce(current, { type: "undo" }) : current));
        }
        return;
      }
      if (event.key === "0" || event.key === "1") {
        setState((current) => (current ? reduce(current, { type: "select", tool: event.key === "0" ? 0 : 1 }) : current));
      } else if (event.key === "Backspace" || event.key === "x") {
        setState((current) => (current ? reduce(current, { type: "select", tool: "erase" }) : current));
      } else if (event.key === "h") {
        setState((current) => (current ? reduce(current, { type: "hint", today: todayFrom() }) : current));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing]);

  const chooseTier = (tier: Tier) => {
    if (busy) return;
    setBusy(true);
    setPickerError(null);
    setTimeout(() => {
      const current = stateRef.current;
      try {
        const start = tierStart(tier);
        let next: GameState;
        if (start.kind === "campaign") {
          const puzzle = campaignPuzzle(start.campaignIndex);
          next = current
            ? reduce(current, { type: "start-tier", mode: "campaign", puzzle, campaignIndex: start.campaignIndex })
            : createGame(puzzle, start.campaignIndex);
        } else {
          const puzzle = practicePuzzleAt(start.tier, start.shape, start.size, start.rules, Date.now() >>> 0);
          const shell = current ?? createGame(campaignPuzzle(0), 0);
          next = reduce(shell, { type: "start-tier", mode: "practice", puzzle });
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
        canBack={state != null}
        onPick={chooseTier}
        onBack={() => {
          if (!busy) setPicking(false);
        }}
      />
    );
  }

  const slot = activeSlot(state);
  const nextReady = state.mode === "campaign" && slot.won && hasNextLesson(state.campaignIndex);
  const campaignDone = state.mode === "campaign" && slot.won && !hasNextLesson(state.campaignIndex);
  const primaryLabel =
    state.mode === "practice" ? "New board" : nextReady ? "Next lesson" : campaignDone ? "Campaign complete" : null;

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
    if (busy || campaignDone) return;
    if (state.mode === "practice") {
      build((current) => {
        const seed = (Date.now() ^ (activeSlot(current).puzzle.seed + 1)) >>> 0;
        const active = activeSlot(current).puzzle;
        return reduce(current, { type: "new-practice", puzzle: newPracticePuzzle(current.campaignIndex, active, seed) });
      });
      return;
    }
    if (nextReady) {
      const index = state.campaignIndex + 1;
      build((current) => reduce(current, { type: "next-lesson", puzzle: campaignPuzzle(index), campaignIndex: index }));
    }
  };

  const onMode = (mode: "campaign" | "practice") => {
    if (busy || mode === state.mode) return;
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
      onMode={onMode}
      onChangeTier={() => {
        if (busy) return;
        setPickerError(null);
        setPicking(true);
      }}
    />
  );
  const pad = (
    <Pad
      selected={state.selected}
      tier={slot.puzzle.tier}
      canUndo={state.undo.length > 0}
      canHint={!slot.won}
      canReset
      primaryLabel={primaryLabel}
      primaryDisabled={campaignDone}
      busy={busy}
      onSelect={(tool) => setState((current) => (current ? reduce(current, { type: "select", tool }) : current))}
      onUndo={() => setState((current) => (current ? reduce(current, { type: "undo" }) : current))}
      onHint={() => setState((current) => (current ? reduce(current, { type: "hint", today: todayFrom() }) : current))}
      onReset={() => setState((current) => (current ? reduce(current, { type: "reset" }) : current))}
      onPrimary={onPrimary}
      onZoomIn={() => setCell((size) => clampCell(Math.min(MAX_CELL, size + 4)))}
      onZoomOut={() => setCell((size) => clampCell(Math.max(MIN_CELL, size - 4)))}
    />
  );

  const board = (
    <BoardViewport cellSize={cell} minCell={MIN_CELL} maxCell={MAX_CELL} onCellSize={setCell}>
      <Board
        grid={slot.grid}
        givens={slot.puzzle.givens}
        cellSize={cell}
        disabled={slot.won || busy}
        onTap={(row, col) =>
          setState((current) => (current ? reduce(current, { type: "tap", row, col, today: todayFrom() }) : current))
        }
      />
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
