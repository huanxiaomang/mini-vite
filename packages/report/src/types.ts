export interface ModuleInfo {
  name: string;
  size: number;
}

export interface FileInfo {
  name: string;
  size: number;
  type: "chunk" | "asset";
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  modules?: ModuleInfo[];
  imports?: string[];
  exports?: string[];
}

export interface DuplicateGroup {
  packageName: string;
  instances: { module: string; chunk: string; size: number }[];
  totalWaste: number;
}

export interface DiffEntry {
  file: string;
  status: "added" | "removed" | "changed" | "unchanged";
  oldSize?: number;
  newSize?: number;
  delta?: number;
}

export interface BuildRecord {
  id: number;
  timestamp: string;
  files: { name: string; size: number }[];
  totalSize: number;
  jsSize: number;
  cssSize: number;
  otherSize: number;
  buildTimeMs: number;
  fileCount: number;
  moduleCount: number;
}

export interface BuildHistory {
  records: BuildRecord[];
}

export interface ReportData {
  files: FileInfo[];
  buildTimeMs: number;
  entry: string;
  format: string;
  outputDir: string;
  totalSize: number;
  jsSize: number;
  cssSize: number;
  otherSize: number;
  totalModules: number;
  totalExports: number;
  hasSourcemap: boolean;
  allModules: (ModuleInfo & { chunk: string })[];
  duplicates: DuplicateGroup[];
  suggestions: string[];
  history: BuildHistory;
  selectedDiffId: number | null;
  diffEntries: DiffEntry[];
}

export type PrevBuildData = BuildRecord;
