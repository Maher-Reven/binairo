import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PanResponder, Platform, ScrollView, View, type ViewStyle } from "react-native";
import { clampCell } from "./theme";

interface BoardViewportProps {
  cellSize: number;
  minCell: number;
  maxCell: number;
  onCellSize: (size: number) => void;
  children: ReactNode;
}

function touchDistance(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }): number {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * The grid pans inside the scroll views. A two-finger pinch, and ctrl-wheel
 * on the web, changes the cell size and keeps it large enough for a phone.
 */
export function BoardViewport({ cellSize, minCell, maxCell, onCellSize, children }: BoardViewportProps) {
  const sizeRef = useRef(cellSize);
  const changeRef = useRef(onCellSize);
  const boundsRef = useRef({ minCell, maxCell });
  const pinch = useRef<{ dist: number; size: number } | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  sizeRef.current = cellSize;
  changeRef.current = onCellSize;
  boundsRef.current = { minCell, maxCell };

  useEffect(() => {
    const node = hostRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== "function") return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const { minCell: min, maxCell: max } = boundsRef.current;
      const next = sizeRef.current + (event.deltaY < 0 ? 4 : -4);
      changeRef.current(clampCell(Math.max(min, Math.min(max, next))));
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches;
          if (touches.length < 2) return;
          pinch.current = { dist: touchDistance(touches[0], touches[1]), size: sizeRef.current };
        },
        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;
          const start = pinch.current;
          if (!start || touches.length < 2 || start.dist <= 0) return;
          const { minCell: min, maxCell: max } = boundsRef.current;
          const next = Math.round(start.size * (touchDistance(touches[0], touches[1]) / start.dist));
          changeRef.current(clampCell(Math.max(min, Math.min(max, next))));
        },
        onPanResponderRelease: () => {
          pinch.current = null;
        },
        onPanResponderTerminate: () => {
          pinch.current = null;
        },
      }),
    [],
  );

  if (Platform.OS === "web") {
    return (
      <View
        ref={(node) => {
          hostRef.current = (node as unknown as HTMLElement | null) ?? null;
        }}
        style={{ flex: 1, overflow: "auto" } as unknown as ViewStyle}
        {...responder.panHandlers}
      >
        <View style={styles.webCenter}>{children}</View>
      </View>
    );
  }

  return (
    <View
      ref={(node) => {
        hostRef.current = (node as unknown as HTMLElement | null) ?? null;
      }}
      style={{ flex: 1 }}
      onLayout={(event) => {
        setFrame({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        });
      }}
      {...responder.panHandlers}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ minHeight: frame.height, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ minWidth: frame.width, justifyContent: "center", padding: 16 }}
        >
          {children}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = {
  webCenter: {
    minWidth: "100%",
    minHeight: "100%",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  } as ViewStyle,
};
