/**
 * Central query-key factory. Keys are hierarchical so one prefix invalidation
 * covers a whole domain (e.g. invalidate qk.timeEntries.all after any shift
 * mutation instead of juggling 'shifts'/'allShifts'/'todayStats' separately).
 * Never build query keys inline — always reference this factory.
 */
export const qk = {
  timeEntries: {
    all: ['timeEntries'] as const,
    mine: (userId: string | undefined, filters?: unknown) =>
      ['timeEntries', 'mine', userId, filters] as const,
    list: (filters?: unknown) => ['timeEntries', 'list', filters] as const,
    current: (userId: string | undefined) => ['timeEntries', 'current', userId] as const,
    todayStats: (userId: string | undefined) =>
      ['timeEntries', 'todayStats', userId] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    list: ['invoices', 'list'] as const,
    mine: (userId: string) => ['invoices', 'mine', userId] as const,
  },
  sops: {
    all: ['sops'] as const,
    templates: ['sops', 'templates'] as const,
    template: (id: string) => ['sops', 'templates', id] as const,
    daily: ['sops', 'daily'] as const,
    today: ['sops', 'daily', 'today'] as const,
    completed: ['sops', 'daily', 'completed'] as const,
    checklists: ['sops', 'checklist'] as const,
    checklist: (dailySopId: string) => ['sops', 'checklist', dailySopId] as const,
    comments: (dailySopId: string, itemId?: string | null) =>
      ['sops', 'comments', dailySopId, itemId] as const,
    commentsFor: (dailySopId: string) => ['sops', 'comments', dailySopId] as const,
    adHoc: (dailySopId: string) => ['sops', 'adHoc', dailySopId] as const,
  },
  taskLists: {
    all: ['taskLists'] as const,
    list: ['taskLists', 'list'] as const,
    templateItems: ['taskLists', 'templateItems'] as const,
    details: ['taskLists', 'detail'] as const,
    detail: (id: string) => ['taskLists', 'detail', id] as const,
    assignments: (taskListId: string) =>
      ['taskLists', 'assignments', taskListId] as const,
    mine: ['taskLists', 'mine'] as const,
    mineFor: (userId: string | undefined) => ['taskLists', 'mine', userId] as const,
    checklist: (assignmentId: string) =>
      ['taskLists', 'checklist', assignmentId] as const,
    pending: ['taskLists', 'pending'] as const,
    pendingFor: (userId: string | undefined) =>
      ['taskLists', 'pending', userId] as const,
  },
  team: {
    all: ['team'] as const,
    members: ['team', 'members'] as const,
    search: (email: string) => ['team', 'search', email] as const,
  },
  profiles: {
    all: ['profiles'] as const,
    detail: (userId: string | undefined) => ['profiles', userId] as const,
  },
  settings: {
    all: ['settings'] as const,
    business: ['settings', 'business'] as const,
    openAiKey: ['settings', 'openAiKey'] as const,
  },
  equipment: {
    all: ['equipment'] as const,
  },
  inventory: {
    all: ['inventory'] as const,
    items: ['inventory', 'items'] as const,
    activeItems: ['inventory', 'items', 'active'] as const,
    lastRun: ['inventory', 'lastRun'] as const,
    runs: ['inventory', 'runs'] as const,
    runChecks: (runId: string) => ['inventory', 'runChecks', runId] as const,
    latestChecks: ['inventory', 'latestChecks'] as const,
  },
  schedule: {
    all: ['schedule'] as const,
    shifts: (filters?: unknown) => ['schedule', 'shifts', filters] as const,
    mine: (userId: string | undefined, filters?: unknown) =>
      ['schedule', 'mine', userId, filters] as const,
  },
  locations: {
    all: ['locations'] as const,
    linkedTasks: (zoneId: string) => ['locations', 'linkedTasks', zoneId] as const,
  },
} as const;
