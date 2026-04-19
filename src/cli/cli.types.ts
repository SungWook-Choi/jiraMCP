import { QueryMode } from '../query/query.schema.js';

export interface CliCollectedQuery {
  mode: QueryMode;
  assignee?: string;
  projectKey?: string;
  period?: string;
  outputFormat: 'console' | 'markdown';
}
