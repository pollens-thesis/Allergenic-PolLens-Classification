"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  IDENTITY_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
  clampView,
  fitView,
  zoomAtPoint,
  type Bounds,
  type ViewTransform,
} from "@/lib/geo";

/** Pointer travel, in viewBox units, past which a press counts as a drag. */
const DRAG_SLOP = 6;

type Point = { x: number; y: number };

/**
 * Wheel / drag / pinch zoom and pan for an SVG map whose viewBox is
 * `0 0 width height`.
 *
 * Two details are worth knowing:
 *
 * - Pointer coordinates go through `getScreenCTM()` rather than the element's
 *   bounding box. The SVG is capped at `max-h`, so when the map is taller than
 *   that cap it is letterboxed inside its box and a naive rect-relative
 *   calculation would drift.
 * - Move and release are tracked on the window instead of capturing the
 *   pointer. Capturing would retarget the following `click` to the SVG itself,
 *   which would break selecting a province by clicking its outline.
 */
export function useMapZoom(width: number, height: number) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<ViewTransform>(IDENTITY_VIEW);
  const [dragging, setDragging] = useState(false);

  /** Live pointers, in viewBox coordinates. Two of them means a pinch. */
  const pointers = useRef(new Map<number, Point>());
  const pinchSpan = useRef<number | null>(null);
  const travelled = useRef(0);
  const dragged = useRef(false);

  const toLocal = useCallback((clientX: number, clientY: number): Point | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }, []);

  const zoomBy = useCallback(
    (factor: number) =>
      setView((v) => zoomAtPoint(v, factor, width / 2, height / 2, width, height)),
    [width, height],
  );

  const reset = useCallback(() => setView(IDENTITY_VIEW), []);

  const fitTo = useCallback(
    (bounds: Bounds) => setView(fitView(bounds, width, height)),
    [width, height],
  );

  // Wheel needs a non-passive listener: React routes wheel through a passive
  // root listener, where preventDefault is ignored and the page scrolls instead.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toLocal(event.clientX, event.clientY);
      if (!point) return;
      // Normalise line- and page-mode wheels to pixels before scaling.
      const delta =
        event.deltaMode === 1 ? event.deltaY * 16 : event.deltaMode === 2 ? event.deltaY * 400 : event.deltaY;
      setView((v) => zoomAtPoint(v, Math.exp(-delta * 0.002), point.x, point.y, width, height));
    };

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [width, height, toLocal]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (event: PointerEvent) => {
      const previous = pointers.current.get(event.pointerId);
      if (!previous) return;
      const point = toLocal(event.clientX, event.clientY);
      if (!point) return;
      pointers.current.set(event.pointerId, point);

      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        const span = Math.hypot(a.x - b.x, a.y - b.y);
        const previousSpan = pinchSpan.current;
        pinchSpan.current = span;
        dragged.current = true;
        if (previousSpan && previousSpan > 0 && span > 0) {
          setView((v) =>
            zoomAtPoint(v, span / previousSpan, (a.x + b.x) / 2, (a.y + b.y) / 2, width, height),
          );
        }
        return;
      }

      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      travelled.current += Math.hypot(dx, dy);
      if (travelled.current > DRAG_SLOP) dragged.current = true;
      setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }, width, height));
    };

    const onRelease = (event: PointerEvent) => {
      pointers.current.delete(event.pointerId);
      if (pointers.current.size < 2) pinchSpan.current = null;
      if (pointers.current.size === 0) setDragging(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
    };
  }, [dragging, width, height, toLocal]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const point = toLocal(event.clientX, event.clientY);
      if (!point) return;
      pointers.current.set(event.pointerId, point);
      travelled.current = 0;
      dragged.current = false;
      if (pointers.current.size >= 2) pinchSpan.current = null;
      setDragging(true);
    },
    [toLocal],
  );

  /**
   * Swallow the click that ends a pan, so releasing the drag over a province
   * does not also select it. Capture phase, so it lands before the path's own
   * handler.
   */
  const onClickCapture = useCallback((event: ReactMouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    event.stopPropagation();
  }, []);

  return {
    svgRef,
    view,
    zoomBy,
    reset,
    fitTo,
    dragging,
    zoomedIn: view.k > MIN_ZOOM,
    atMaxZoom: view.k >= MAX_ZOOM - 0.001,
    /** Handlers to spread onto the <svg>. */
    handlers: { onPointerDown, onClickCapture },
  };
}
