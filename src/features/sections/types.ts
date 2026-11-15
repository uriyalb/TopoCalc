
export interface Point3D {
    x: number;
    y: number;
    z: number;
}

export interface Segment2D {
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    cumulativeLengthStart: number; // Distance from start of path to p1
    z1?: number; // Elevation at p1 (for contours)
    z2?: number; // Elevation at p2 (for contours)
    isConstantZ: boolean;
}

export interface ProfilePoint {
    distance: number;
    elevation: number;
    layer: string;
}

export interface EarthworkStats {
    cutArea: number;
    fillArea: number;
    netArea: number; // cut - fill
    slopePercentage: number;
    startElevation: number;
    endElevation: number;
}

export interface EarthworkPolygons {
    cutPolygons: Point3D[][];
    fillPolygons: Point3D[][];
    designLine: { start: Point3D; end: Point3D };
}

// Local Section Types
export interface SectionLine {
    id: number;
    n: number;      // The 'n' index (1, 2, 3...)
    distance: number; // The actual distance (n * interval)
    center: { x: number; y: number };
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    width: number; // Store total width for calculations
}

export interface SectionProfilePoint {
    offset: number; // Distance from centerline (Negative = Left, Positive = Right)
    elevation: number;
}

// State Interfaces for Persistence
export interface LocalSectionConfig {
    interval: number;
    width: number;
    pathWidth: number;
    sections: SectionLine[];
}

export interface UserSection {
    id: string;
    p1: { x: number; y: number };
    p2: { x: number; y: number };
    name: string;
}

export interface ProjectFile {
    id?: string;        // UUID or Unique ID
    name?: string;      // User-friendly name
    version: string;
    timestamp: number;
    fileName: string;
    layers: string[];
    selectedPath: string;
    selectedContours: string[];
    selectedPlannedContours: string[];
    closedContours?: boolean;        // existing contours are closed shapes
    closedPlannedContours?: boolean; // planned contours are closed shapes
    profileData: ProfilePoint[];
    localSectionConfig: LocalSectionConfig;
    crossSections: UserSection[];
    dxfString: string; // Stored as string to avoid huge JSON object overhead and re-parse on load
}

// Debugging Types
export interface BoundingBox {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface ProcessingStep {
    step: string;
    status: 'success' | 'warning' | 'error' | 'info';
    message: string;
    details?: string[];
}

export interface GeometryResult {
    points: ProfilePoint[];
    logs: ProcessingStep[];
    success: boolean;
    error?: string;
}

// Minimal DXF Parser Types (since we don't have the library types installed)
export interface DxfParsed {
    entities: DxfEntity[];
    tables: {
        layer: {
            layers: Record<string, DxfLayer>;
        };
    };
}

export interface DxfLayer {
    name: string;
    color?: number;
}

export interface DxfEntity {
    type: string;
    layer: string;
    vertices?: Point3D[]; // For POLYLINE/LWPOLYLINE
    startPoint?: Point3D; // For LINE
    endPoint?: Point3D;   // For LINE
    elevation?: number;   // For LWPOLYLINE
    closed?: boolean;
    shape?: boolean;
    controlPoints?: Point3D[]; // For SPLINE
    
    // New Geometry Support
    center?: Point3D;          // ARC, CIRCLE, ELLIPSE
    radius?: number;           // ARC, CIRCLE
    startAngle?: number;       // ARC (deg), ELLIPSE (rad)
    endAngle?: number;         // ARC (deg), ELLIPSE (rad)
    majorAxisEndPoint?: Point3D; // ELLIPSE
    axisRatio?: number;        // ELLIPSE
}

export enum AppStatus {
    IDLE = 'IDLE',
    PARSING = 'PARSING',
    SELECTING = 'SELECTING',
    PROCESSING = 'PROCESSING',
    COMPLETE = 'COMPLETE',
    ERROR = 'ERROR'
}
