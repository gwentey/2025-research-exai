import { DatasetFilterCriteria, DatasetScored } from './dataset.models';

export interface CriterionWeight {
  criterion_name: string;
  weight: number; // 0.0 to 1.0
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  criteria?: DatasetFilterCriteria;
  weights?: CriterionWeight[];
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  criteria?: DatasetFilterCriteria;
  weights?: CriterionWeight[];
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  criteria?: DatasetFilterCriteria;
  weights?: CriterionWeight[];
}

export interface ProjectListResponse {
  projects: Project[];
  total_count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DatasetScoredWithDetails extends DatasetScored {
  criterion_scores: { [key: string]: number };
}

export interface ProjectRecommendationResponse {
  project: Project;
  datasets: DatasetScoredWithDetails[];
  total_count: number;
} 