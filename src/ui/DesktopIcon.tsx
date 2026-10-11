import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import {
  clampDesktopPosition,
  currentDesktopViewport,
  desktopPositionKey,
  fitDesktopPosition,
  getInitialDesktopPosition,
  isUsableDesktopViewport,
  parseDesktopPosition,
  saveDesktopPosition,
  type DesktopPosition,
} from './desktopLayout';
import { isCompactViewport } from './responsive';
import './desktop-icons.css';

export interface DesktopIconProps {
  id: string;
  index: number;
  className?: string;
  compact?: boolean;
  onOpen: () => void;
  children: ReactNode;
}

interface DragSession {
  pointerId: number;
  clientX: number;
  clientY: number;
  origin: DesktopPosition;
  moved: boolean;
}

const DRAG_THRESHOLD = 5;

export default function DesktopIcon(props: DesktopIconProps) {
  const { id, compact = false, className = '', onOpen, children } = props;
  const viewport = currentDesktopViewport();
  // Check the current size as well as the React snapshot: a resize can arrive
  // before the media-query subscription updates the parent.
  if (compact || isCompactViewport(viewport.width, viewport.height)) {
    return <button
      type="button"
      className={`desktop-icon is-compact ${className}`.trim()}
      data-desktop-icon={id}
      draggable={false}
      onClick={onOpen}
    >{children}</button>;
  }
  return <DraggableDesktopIcon {...props} />;
}

function DraggableDesktopIcon({ id, index, className = '', onOpen, children }: DesktopIconProps) {
  const [position, setPosition] = useState(() => getInitialDesktopPosition(id, index));
  const [dragging, setDragging] = useState(false);
  const positionRef = useRef(position);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<DragSession | null>(null);
  const suppressClickUntil = useRef(0);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const moveTo = useCallback((point: DesktopPosition) => {
    positionRef.current = point;
    setPosition(point);
  }, []);

  const finishDrag = useCallback((cancelled = false) => {
    const session = drag.current;
    if (!session) return;
    drag.current = null;
    setDragging(false);
    if (session.moved || cancelled) suppressClickUntil.current = performance.now() + 600;
    const viewport = currentDesktopViewport();
    if (session.moved && isUsableDesktopViewport(viewport) && !isCompactViewport(viewport.width, viewport.height)) {
      saveDesktopPosition(id, positionRef.current);
    }
    const button = buttonRef.current;
    try {
      if (button?.hasPointerCapture(session.pointerId)) button.releasePointerCapture(session.pointerId);
    } catch { /* The browser may already have released a cancelled pointer. */ }
  }, [id]);

  useEffect(() => {
    const initialViewport = currentDesktopViewport();
    if (isUsableDesktopViewport(initialViewport) && !isCompactViewport(initialViewport.width, initialViewport.height)) {
      saveDesktopPosition(id, positionRef.current);
    }
    const fitToDesktop = () => {
      const viewport = currentDesktopViewport();
      if (!isUsableDesktopViewport(viewport) || isCompactViewport(viewport.width, viewport.height)) return;
      finishDrag(true);
      const next = fitDesktopPosition(id, positionRef.current, viewport);
      if (next) moveTo(next);
    };
    const cancel = () => finishDrag(true);
    const receivePosition = (event: StorageEvent) => {
      if (event.key !== desktopPositionKey(id) || drag.current) return;
      const viewport = currentDesktopViewport();
      if (!isUsableDesktopViewport(viewport) || isCompactViewport(viewport.width, viewport.height)) return;
      const stored = parseDesktopPosition(event.newValue);
      if (stored) moveTo(clampDesktopPosition(stored, viewport));
    };
    window.addEventListener('resize', fitToDesktop);
    window.addEventListener('blur', cancel);
    window.addEventListener('storage', receivePosition);
    return () => {
      finishDrag(true);
      window.removeEventListener('resize', fitToDesktop);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('storage', receivePosition);
    };
  }, [id, finishDrag, moveTo]);

  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary || drag.current) return;
    const viewport = currentDesktopViewport();
    if (!isUsableDesktopViewport(viewport) || isCompactViewport(viewport.width, viewport.height)) return;
    suppressClickUntil.current = 0;
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      origin: positionRef.current,
      moved: false,
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); }
    catch { drag.current = null; }
  };

  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const viewport = currentDesktopViewport();
    if (!isUsableDesktopViewport(viewport) || isCompactViewport(viewport.width, viewport.height)) return;
    const dx = event.clientX - session.clientX;
    const dy = event.clientY - session.clientY;
    if (!session.moved && Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;
    session.moved = true;
    setDragging(true);
    event.preventDefault();
    moveTo(clampDesktopPosition({ x: session.origin.x + dx, y: session.origin.y + dy }, viewport));
  };

  const click = (event: MouseEvent<HTMLButtonElement>) => {
    // Native keyboard activation has detail=0 and remains available even just
    // after a cancelled drag. Each new pointer-down starts a fresh click.
    if (event.detail !== 0 && performance.now() < suppressClickUntil.current) {
      suppressClickUntil.current = 0;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    onOpenRef.current();
  };

  return <button
    ref={buttonRef}
    type="button"
    className={`desktop-icon ${className} ${dragging ? 'desktop-icon-dragging' : ''}`.trim()}
    data-desktop-icon={id}
    data-dragging={dragging || undefined}
    style={{ left: position.x, top: position.y }}
    draggable={false}
    onDragStart={event => event.preventDefault()}
    onPointerDown={pointerDown}
    onPointerMove={pointerMove}
    onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) finishDrag(); }}
    onPointerCancel={event => { if (drag.current?.pointerId === event.pointerId) finishDrag(true); }}
    onLostPointerCapture={event => { if (drag.current?.pointerId === event.pointerId) finishDrag(true); }}
    onClick={click}
  >{children}</button>;
}
