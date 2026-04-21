export type QueryMode = 'assignee' | 'project' | 'assignee_project';
export type AssigneeMode = 'personal' | 'all';

export type OutputFormat = 'console' | 'markdown';
export type QueryPeriod = 'this_week' | 'last_week' | 'today' | 'yesterday' | 'custom_range';

export const VALID_PERIODS: QueryPeriod[] = [
  'this_week',
  'last_week',
  'today',
  'yesterday',
  'custom_range',
];

export interface QueryOutput {
  format: OutputFormat;
}

export interface QuerySchema {
  mode: QueryMode;
  assigneeMode: AssigneeMode;
  assignees: string[];
  projectKeys: string[];
  period: QueryPeriod;
  startDate?: string;
  endDate?: string;
  output: QueryOutput;
}
