import { get, post, put } from '../../util/axiosNaming';
import { Issue, IssueSuggestion, PaginatedIssueResponse, PaginatedIssueSuggestionResponse } from './types';


export const IssuesService = {
  /**
   * Get a paginated list of issues
   */
  async getIssues(page?: number): Promise<PaginatedIssueResponse> {
    const params = page ? { page } : undefined;
    const response = await get(`/api/v1/issues/`, { params });
    return response.data;
  },

  /**
   * Get a paginated list of Alert Level issues which are essentially just very recent
   * and high priority issues that have been logged locally during development.
   */
  async getAlertLevelIssues(projectKey: string): Promise<Issue[]> {
    
    const issues = await this.getIssuesForProject(projectKey, "error", 1);
    const alertLevelIssues = issues.results.filter((issue: Issue) => issue.priority === "alert");
    return alertLevelIssues;
  },
  /**
   * Get a paginated list of issues for a project
   */
  async getIssuesForProject(projectKey: string, level?: string, page?: number, additionalParams?: Record<string, any>): Promise<PaginatedIssueResponse> {
    const params = {
      ...(level ? { level } : {}),
      ...(page ? { page } : {}),
      ...(additionalParams || {}),
    };
    const response = await get(`/api/v1/issues/project/${projectKey}/`, { params });
    return response.data;
  },

  /**
   * Create a new issue
   */
  async createIssue(issue: Partial<Issue>): Promise<Issue> {
    const response = await post(`/api/v1/issues/`, issue);
    return response.data;
  },

  /**
   * Get a specific issue by UUID
   */
  async getIssue(uuid: string): Promise<Issue> {
    const response = await get(`/api/v1/issues/${uuid}/`);
    return response.data;
  },

  /**
   * Update an issue
   */
  async updateIssue(uuid: string, issue: Partial<Issue>): Promise<Issue> {
    const response = await put(`/api/v1/issues/${uuid}/`, issue);
    return response.data;
  },

  /**
   * Get logs for an issue
   */
  async getIssueLogs(uuid: string): Promise<Issue> {
    const response = await get(`/api/v1/issues/${uuid}/logs/`);
    return response.data;
  },

  /**
   * Resolve an issue
   */
  async resolveIssue(uuid: string, data: Partial<Issue>): Promise<Issue> {
    const response = await post(`/api/v1/issues/${uuid}/resolve/`, data);
    return response.data;
  },

  /**
   * Get suggestions for a project's issues
   * @param companyKey Company identifier
   * @param projectKey Project identifier
   * @param options Optional parameters including page number and additional query params
   */
  async getIssueSuggestions(
    companyKey: string,
    projectKey: string,
    options?: { page?: number; queryParams?: Record<string, any> }
  ): Promise<PaginatedIssueSuggestionResponse> {
    const params = {
      ...(options?.page ? { page: options.page } : {}),
      ...(options?.queryParams || {})
    };
    const response = await get(
      `/api/v1/suggestions/${companyKey}/${projectKey}/`,
      { params }
    );
    return response.data;
  },

  /**
   * Get a specific issue suggestion
   */
  async getIssueSuggestion(
    companyKey: string,
    projectKey: string,
    id: number
  ): Promise<IssueSuggestion> {
    const response = await get(
      `/api/v1/suggestions/${companyKey}/${projectKey}/${id}/`
    );
    return response.data;
  }
};
