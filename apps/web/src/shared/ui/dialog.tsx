/* eslint-disable react-hooks/refs -- dnd-kit exposes callback refs and listeners through its hook result. */
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type Modifier,
} from '@dnd-kit/core';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { GripHorizontal, X } from 'lucide-react';
import {
  createContext,
  useContext,
  useId,
  useState,
  type ComponentProps,
  type CSSProperties,
} from 'react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;
const DIALOG_VIEWPORT_PADDING_PX = 12;

type DialogContentPrimitiveProps = ComponentProps<typeof DialogPrimitive.Content>;
type DialogContentBaseProps = Omit<DialogContentPrimitiveProps, 'draggable'> & {
  overlayClassName?: string;
};
type DialogContentProps = DialogContentBaseProps & {
  draggable?: boolean;
};

type DialogDragHandleContextValue = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
};

const DialogDragHandleContext = createContext<DialogDragHandleContextValue | null>(null);

const restrictDialogToViewport: Modifier = ({ activeNodeRect, transform, windowRect }) => {
  if (!activeNodeRect || !windowRect) return transform;

  return {
    ...transform,
    x: Math.min(
      windowRect.right - DIALOG_VIEWPORT_PADDING_PX - activeNodeRect.right,
      Math.max(windowRect.left + DIALOG_VIEWPORT_PADDING_PX - activeNodeRect.left, transform.x),
    ),
    y: Math.min(
      windowRect.bottom - DIALOG_VIEWPORT_PADDING_PX - activeNodeRect.bottom,
      Math.max(windowRect.top + DIALOG_VIEWPORT_PADDING_PX - activeNodeRect.top, transform.y),
    ),
  };
};

const dialogDragModifiers = [restrictDialogToViewport];

function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-40 bg-slate-950/40', className)}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

function DialogContent({ draggable = false, ...props }: DialogContentProps) {
  if (draggable) {
    return <DraggableDialogContent {...props} />;
  }

  return <DialogContentFrame {...props} />;
}

function DraggableDialogContent(props: DialogContentBaseProps) {
  const draggableId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleDragEnd = ({ delta }: DragEndEvent) => {
    setPosition((current) => ({
      x: current.x + delta.x,
      y: current.y + delta.y,
    }));
  };

  return (
    <DndContext
      autoScroll={false}
      modifiers={dialogDragModifiers}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <DraggableDialogContentFrame draggableId={draggableId} position={position} {...props} />
    </DndContext>
  );
}

function DraggableDialogContentFrame({
  draggableId,
  position,
  ...props
}: DialogContentBaseProps & {
  draggableId: string;
  position: { x: number; y: number };
}) {
  const { attributes, isDragging, listeners, setActivatorNodeRef, setNodeRef, transform } =
    useDraggable({ id: draggableId });
  const dragOffset = {
    x: position.x + (transform?.x ?? 0),
    y: position.y + (transform?.y ?? 0),
  };

  return (
    <DialogContentFrame
      contentRef={setNodeRef}
      data-dragging={isDragging ? '' : undefined}
      dragHandle={{ attributes, listeners, setActivatorNodeRef }}
      dragOffset={dragOffset}
      {...props}
    />
  );
}

function DialogContentFrame({
  children,
  className,
  contentRef,
  dragHandle,
  dragOffset,
  overlayClassName,
  style,
  ...props
}: DialogContentBaseProps & {
  contentRef?: (element: HTMLElement | null) => void;
  dragHandle?: DialogDragHandleContextValue;
  dragOffset?: { x: number; y: number };
}) {
  const positionedStyle: CSSProperties | undefined = dragOffset
    ? {
        ...style,
        transform: `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`,
      }
    : style;

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 text-left shadow-xl data-[dragging]:select-none data-[dragging]:shadow-2xl',
          className,
        )}
        data-slot="dialog-content"
        ref={contentRef}
        style={positionedStyle}
        {...props}
      >
        <DialogDragHandleContext.Provider value={dragHandle ?? null}>
          {children}
        </DialogDragHandleContext.Provider>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">
          <X aria-hidden="true" size={16} />
          <span className="sr-only">关闭</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogDragHandle({
  'aria-label': ariaLabel = '拖动弹窗',
  className,
  ...props
}: ComponentProps<typeof Button>) {
  const dragHandle = useContext(DialogDragHandleContext);

  if (!dragHandle) return null;

  return (
    <Button
      aria-label={ariaLabel}
      className={cn(
        'hidden shrink-0 cursor-grab touch-none rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing md:inline-flex',
        className,
      )}
      ref={dragHandle.setActivatorNodeRef}
      size="icon"
      type="button"
      variant="ghost"
      {...props}
      {...dragHandle.attributes}
      {...dragHandle.listeners}
    >
      <GripHorizontal aria-hidden="true" size={20} />
    </Button>
  );
}

function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-xl font-semibold text-slate-950', className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('mt-1 text-sm text-slate-500', className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mt-6 flex justify-end gap-2', className)} {...props} />;
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogDragHandle,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
