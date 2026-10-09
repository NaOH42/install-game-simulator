import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import {
  clampDesktopPosition,
  currentDesktopViewport,
  desktopPositionKey,
  getInitialDesktopPosition,
  parseDesktopPosition,
  saveDesktopPosition,
  type DesktopPosition,
} from './desktopLayout';
import './desktop-icons.css';

export interface DesktopIconProps {
  id: string;
  index: number;
  className?: string;
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

export default function DesktopIcon({ id, index, className = '', onOpen, children }: DesktopIconProps) {
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
    if (session.moved) saveDesktopPosition(id, positionRef.current);
    const button = buttonRef.current;
    try {
      if (button?.hasPointerCapture(session.pointerId)) button.releasePointerCapture(session.pointerId);
    } catch { /* The browser may already have released a cancelled pointer. */ }
  }, [id]);

  useEffect(() => {
    saveDesktopPosition(id, positionRef.current);
    const fitToDesktop = () => {
      finishDrag(true);
      const next = clampDesktopPosition(positionRef.current, currentDesktopViewport());
      moveTo(next);
      saveDesktopPosition(id, next);
    };
    const cancel = () => finishDrag(true);
    const receivePosition = (event: StorageEvent) => {
      if (event.key !== desktopPositionKey(id) || drag.current) return;
      const stored = parseDesktopPosition(event.newValue);
      if (stored) moveTo(clampDesktopPosition(stored, currentDesktopViewport()));
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
    const dx = event.clientX - session.clientX;
    const dy = event.clientY - session.clientY;
    if (!session.moved && Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;
    session.moved = true;
    setDragging(true);
    event.preventDefault();
    moveTo(clampDesktopPosition({ x: session.origin.x + dx, y: session.origin.y + dy }, currentDesktopViewport()));
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
