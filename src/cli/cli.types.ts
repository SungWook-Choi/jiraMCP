import { AssigneeMode, QueryMode } from '../query/query.schema.js';

export type CliTopLevelAction = 'query' | 'comment';
export type CliCommentType = 'basic' | 'weekly_issue';
export type CliIssueSelectionMethod = 'search_title' | 'direct_key';

export interface CliCollectedQuery {
  mode: QueryMode;
  assigneeMode?: AssigneeMode;
  assignee?: string;
  projectKey?: string;
  period?: string;
  startDate?: string;
  endDate?: string;
  outputFormat: 'console' | 'markdown';
}

export interface CliCollectedComment {
  commentType: CliCommentType;
  issueSelectionMethod: CliIssueSelectionMethod;
  issueKey: string;
  issueSummary: string;
  rawBody: string;
  finalBody: string;
}
