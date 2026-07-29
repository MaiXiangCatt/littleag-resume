/* eslint-disable react-hooks/refs -- dnd-kit exposes callback refs and transform state through its hook result. */
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowUp,
  Award,
  BriefcaseBusiness,
  Check,
  FileText,
  FolderKanban,
  GraduationCap,
  GripVertical,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';

import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

import { moveById } from '../model/resume.model';
import type { ResumeSection } from '../model/resume.types';

const icons = {
  summary: FileText,
  work: BriefcaseBusiness,
  education: GraduationCap,
  project: FolderKanban,
  skills: Sparkles,
  awards: Award,
  custom: FileText,
};

export function StructurePanel({
  activeId,
  onAdd,
  onFormat,
  onMove,
  onRemove,
  onSelect,
  sections,
}: {
  activeId: string;
  onAdd: () => void;
  onFormat: () => void;
  onMove: (sections: ResumeSection[]) => void;
  onRemove: (section: ResumeSection) => void;
  onSelect: (id: string) => void;
  sections: ResumeSection[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const enabled = sections.filter((section) => section.enabled);
  function moveButton(id: string, delta: number) {
    const index = enabled.findIndex((section) => section.id === id);
    const target = enabled[index + delta];
    if (!target) return;
    const moved = moveById(sections, id, target.id);
    onMove(moved);
  }
  function dragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id)
      onMove(moveById(sections, String(active.id), String(over.id)));
  }
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[#e7dfe4] bg-[#f8f5f6]">
      <div className="border-b border-[#e7dfe4] px-5 py-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#a63a2a]">
          Resume map
        </p>
        <h2 className="mt-1 font-serif text-xl font-semibold text-[#30252d]">简历结构</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <Button
          className={cn(
            'mb-2 h-11 w-full justify-start rounded-xl px-3',
            activeId === 'profile' ? 'bg-white text-[#bf301e] shadow-sm' : 'text-[#62565f]',
          )}
          onClick={() => onSelect('profile')}
          variant="ghost"
        >
          <UserRound size={17} />
          基本信息
        </Button>
        <DndContext collisionDetection={closestCenter} onDragEnd={dragEnd} sensors={sensors}>
          <SortableContext
            items={enabled.map((section) => section.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {enabled.map((section, index) => (
                <StructureItem
                  active={activeId === section.id}
                  index={index}
                  key={section.id}
                  onDown={() => moveButton(section.id, 1)}
                  onRemove={() => onRemove(section)}
                  onSelect={() => onSelect(section.id)}
                  onUp={() => moveButton(section.id, -1)}
                  section={section}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button className="mt-4 w-full border-dashed" onClick={onAdd} variant="outline">
          <Plus size={16} />
          添加板块
        </Button>
      </div>
      <div className="border-t border-[#e7dfe4] p-3">
        <Button className="h-11 w-full justify-start rounded-xl" onClick={onFormat} variant="ghost">
          <Settings2 size={17} />
          排版设置
        </Button>
      </div>
    </aside>
  );
}

function StructureItem({
  active,
  index,
  onDown,
  onRemove,
  onSelect,
  onUp,
  section,
}: {
  active: boolean;
  index: number;
  onDown: () => void;
  onRemove: () => void;
  onSelect: () => void;
  onUp: () => void;
  section: ResumeSection;
}) {
  const sortable = useSortable({ id: section.id });
  const Icon = icons[section.type];
  return (
    <div
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
      }}
      className={cn(
        'group flex items-center rounded-xl border border-transparent px-1 py-1 transition',
        active
          ? 'border-[#e6d7e3] bg-white text-[#bf301e] shadow-sm'
          : 'text-[#655a62] hover:bg-white/70',
      )}
    >
      <Button
        aria-label={`拖拽 ${section.title}`}
        className="size-8 shrink-0 cursor-grab"
        size="icon"
        variant="ghost"
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <GripVertical size={15} />
      </Button>
      <Button
        className="h-9 min-w-0 flex-1 justify-start gap-2 px-1 hover:bg-transparent"
        onClick={onSelect}
        variant="ghost"
      >
        <Icon className="shrink-0" size={16} />
        <span className="truncate">{section.title}</span>
        {active ? <Check className="ml-auto shrink-0" size={14} /> : null}
      </Button>
      <div className="hidden shrink-0 group-hover:flex">
        <Button
          aria-label="上移板块"
          disabled={index === 0}
          onClick={onUp}
          size="icon"
          variant="ghost"
        >
          <ArrowUp size={13} />
        </Button>
        <Button aria-label="下移板块" onClick={onDown} size="icon" variant="ghost">
          <ArrowDown size={13} />
        </Button>
        <Button aria-label="移除板块" onClick={onRemove} size="icon" variant="ghost">
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );
}
