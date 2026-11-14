export interface NodeData {
  existing: number;
  planned: number;
}

export interface Point {
  x: number;
  y: number;
  val: number;
  label?: string; // e.g., "TL", "TR", "Zero"
}

export interface GridSize {
  rows: number;
  cols: number;
}

export interface CellPolygons {
  cut: Point[][];
  fill: Point[][];
}

export interface CalculationStep {
  type: 'Interpolation' | 'Triangle';
  category?: 'geometry' | 'cut' | 'fill';
  description: string;
  formula?: string;
  values?: string;
  result?: string;
  // Polygon steps only: the numbers behind `formula` and `result`
  area?: number;
  avgH?: number;
  vol?: number;
}

export interface DetailedResults {
  realCutArea: number;
  realFillArea: number;
  cutAvgH: number;
  fillAvgH: number;
  cutVol: number;
  fillVol: number;
  steps: CalculationStep[];
  zeroLines: Point[][]; // For drawing the zero line specifically
}

export interface ModalData {
  id: string;
  r: number;
  c: number;
  polygons: CellPolygons;
  nodes: Point[];
  results: DetailedResults;
}

export interface SelectionState {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BackgroundConfig {
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  x: number;
  y: number;
  lockAspectRatio: boolean;
  lastSelection?: SelectionState; // Persist the calibration box position
}

export interface VisualConfig {
  cutColor: string;
  cutOpacity: number;
  fillColor: string;
  fillOpacity: number;
  gridColor: string;
}

export interface ProjectData {
  gridSize: GridSize;
  cellWidth: number;
  nodeData: NodeData[][];
  bgImage: string | null;
  bgConfig: BackgroundConfig;
  visualConfig: VisualConfig;
}

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: string;
  data: ProjectData;
}