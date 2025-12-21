export enum ReportType {
  STUDENT_PROGRESS = 'student-progress',
  INTERNSHIP = 'internship',
  FACULTY_VISIT = 'faculty-visit',
  MONTHLY = 'monthly',
  PLACEMENT = 'placement',
  INSTITUTION_PERFORMANCE = 'institution-performance',
}

export enum ReportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ExportFormat {
  EXCEL = 'excel',
  PDF = 'pdf',
  CSV = 'csv',
}

export interface ReportJobData {
  userId: string;
  reportType: ReportType;
  filters: any;
  format: ExportFormat;
  reportId?: string;
}

export interface ReportConfig {
  type: ReportType;
  name: string;
  description: string;
  availableFor: string[]; // Roles that can access this report
  filters: ReportFilter[];
  columns: ReportColumn[];
}

export interface ReportFilter {
  name: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange' | 'multiSelect';
  required: boolean;
  options?: { label: string; value: any }[];
  defaultValue?: any;
}

export interface ReportColumn {
  field: string;
  header: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  width?: number;
  format?: string;
}

export interface ExportConfig {
  title: string;
  columns: ReportColumn[];
  data: any[];
  format: ExportFormat;
  metadata?: {
    generatedBy?: string;
    generatedAt?: Date;
    filters?: any;
  };
}

export interface ReportCatalogItem {
  type: ReportType;
  name: string;
  description: string;
  icon?: string;
  category: string;
}
