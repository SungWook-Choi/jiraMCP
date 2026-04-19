export type QueryMode = 'assignee' | 'project' | 'assignee_project';

export type OutputFormat = 'console' | 'markdown';
export type QueryPeriod = 'this_week' | string;

export interface QueryOutput {
  format: OutputFormat;
}

export interface QuerySchema {
  mode: QueryMode;
  assignees: string[];
  projectKeys: string[];
  period: QueryPeriod;
  output: QueryOutput;
}
