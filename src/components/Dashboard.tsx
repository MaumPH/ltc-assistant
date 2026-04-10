import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ClipboardList, ListChecks } from 'lucide-react';
import {
  AS_NEEDED_TRIGGER_ORDER,
  CYCLE_ORDER,
  PRE_EVAL_GROUP_ORDER,
  TASKS,
  WORK_AREA_STYLES,
  type Cycle,
  type Task,
} from '../data/taskSchedule';

const CHECK_STORAGE_KEY = 'ltc_task_checks';

type TaskGroup = {
  key: string;
  label?: string;
  tasks: Task[];
};

const CYCLE_COUNTS = Object.fromEntries(
  CYCLE_ORDER.map((cycle) => [cycle, TASKS.filter((task) => task.cycle === cycle).length]),
) as Record<Cycle, number>;

function loadCheckedTasks() {
  if (typeof window === 'undefined') return new Set<string>();

  try {
    const saved = window.localStorage.getItem(CHECK_STORAGE_KEY);
    if (!saved) return new Set<string>();

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return new Set<string>();

    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set<string>();
  }
}

function buildTaskGroups(activeTab: Cycle, tasks: Task[]) {
  if (activeTab === '수시') {
    return AS_NEEDED_TRIGGER_ORDER.map((trigger) => ({
      key: trigger,
      label: trigger,
      tasks: tasks.filter((task) => task.trigger === trigger),
    })).filter((group) => group.tasks.length > 0);
  }

  if (activeTab === '평가직전') {
    return PRE_EVAL_GROUP_ORDER.map((subGroup) => ({
      key: subGroup,
      label: subGroup,
      tasks: tasks.filter((task) => task.subGroup === subGroup),
    })).filter((group) => group.tasks.length > 0);
  }

  return [{ key: activeTab, tasks }];
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Cycle>('일일');
  const [checked, setChecked] = useState<Set<string>>(loadCheckedTasks);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set<string>());

  useEffect(() => {
    window.localStorage.setItem(CHECK_STORAGE_KEY, JSON.stringify([...checked]));
  }, [checked]);

  const visibleTasks = useMemo(
    () => TASKS.filter((task) => task.cycle === activeTab),
    [activeTab],
  );

  const taskGroups = useMemo(
    () => buildTaskGroups(activeTab, visibleTasks),
    [activeTab, visibleTasks],
  );

  const activeCompleted = visibleTasks.filter((task) => checked.has(task.id)).length;
  const completedCount = checked.size;
  const progress = TASKS.length === 0 ? 0 : Math.round((completedCount / TASKS.length) * 100);

  const toggleCheck = (id: string) => {
    setChecked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 p-6 md:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="overflow-hidden rounded-[28px] bg-slate-900 text-white shadow-xl">
          <div className="bg-[radial-gradient(circle_at_top_right,_rgba(96,165,250,0.24),_transparent_38%),linear-gradient(135deg,_rgba(30,41,59,1),_rgba(15,23,42,1))] p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
                  <ClipboardList className="h-3.5 w-3.5" />
                  평가 준비 체크리스트
                </div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">2026 평가준비 업무현황</h1>
                <p className="mt-2 text-sm leading-6 text-slate-300 md:text-base">
                  업무 주기별 준비 현황을 확인하고, 완료 여부와 필요한 증빙을 한 화면에서 점검하세요.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">전체 완료</div>
                  <div className="mt-2 text-2xl font-semibold">
                    {completedCount}
                    <span className="ml-1 text-base font-medium text-slate-400">/ {TASKS.length}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">현재 탭 완료</div>
                  <div className="mt-2 text-2xl font-semibold">
                    {activeCompleted}
                    <span className="ml-1 text-base font-medium text-slate-400">/ {visibleTasks.length}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-300">진행률</div>
                  <div className="mt-2 text-2xl font-semibold">{progress}%</div>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>전체 38개 항목 기준</span>
                <span>{progress}% 완료</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap gap-2">
            {CYCLE_ORDER.map((cycle) => {
              const isActive = cycle === activeTab;
              return (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setActiveTab(cycle)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <span>{cycle}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      isActive ? 'bg-white/15 text-white' : 'bg-white text-slate-500'
                    }`}
                  >
                    {CYCLE_COUNTS[cycle]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-5">
          {taskGroups.map((group) => (
            <div key={group.key} className="space-y-3">
              {group.label && (
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
                    {group.label}
                  </div>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              )}

              {group.tasks.map((task) => {
                const isChecked = checked.has(task.id);
                const isExpanded = expanded.has(task.id);
                const badgeClasses = WORK_AREA_STYLES[task.workArea];

                return (
                  <article
                    key={task.id}
                    className={`rounded-[24px] border shadow-sm transition-colors ${
                      isChecked ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="p-5 md:p-6">
                      <div className="flex items-start gap-4">
                        <button
                          type="button"
                          onClick={() => toggleCheck(task.id)}
                          aria-pressed={isChecked}
                          aria-label={`${task.title} 완료 여부 토글`}
                          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            isChecked
                              ? 'border-emerald-500 bg-emerald-500 text-white'
                              : 'border-slate-300 bg-white text-transparent hover:border-slate-400'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
                              <p className="mt-1 text-sm text-slate-500">완료 기한: {task.deadline}</p>
                            </div>

                            <span
                              className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${badgeClasses}`}
                            >
                              {task.workArea}
                            </span>
                          </div>

                          <p className="mt-4 text-sm leading-6 text-slate-600">{task.criteria}</p>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {task.staff.map((staff) => (
                              <span
                                key={`${task.id}-${staff}`}
                                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                              >
                                {staff}
                              </span>
                            ))}
                          </div>

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                            <div className="inline-flex items-center gap-2 text-xs text-slate-400">
                              <ListChecks className="h-3.5 w-3.5" />
                              필요 증빙 {task.evidence.length}개
                            </div>

                            <button
                              type="button"
                              onClick={() => toggleExpanded(task.id)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
                            >
                              {isExpanded ? '증빙 접기' : '증빙 보기'}
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                필요 증빙
                              </div>
                              <ul className="space-y-2">
                                {task.evidence.map((item) => (
                                  <li key={`${task.id}-${item}`} className="flex items-start gap-2 text-sm text-slate-600">
                                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                                    <span>{item}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
