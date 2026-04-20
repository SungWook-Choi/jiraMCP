import { QueryMode } from '../query/query.schema.js';

export interface CliCollectedQuery {
  mode: QueryMode;
  assignee?: string;
  projectKey?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  outputFormat: 'console' | 'markdown';
}
