import React, { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { Crop, Download, Eye, EyeOff, FileCode, FileImage, FileText, FolderOpen, Maximize, Move, MousePointer2, Plus, RotateCcw, Save, Trash2, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NodeInput } from './NodeInput';
import { GridCell } from './GridCell';
import { CellDetailDialog } from './CellDetailDialog';
import { CalibrationDialog, MAX_GRID } from './CalibrationDialog';
import { NodeData, GridSize, ModalData, BackgroundConfig, VisualConfig, SavedProject, ProjectData, SelectionState } from './types';
import { MathEngine } from './math';
import { Exporters } from './exporters';
import { COLORS } from '../shared/palette';
import { ProjectDialog } from '../shared/ProjectDialog';
import { Btn, Chip, ConfirmDialog, ConfirmRequest, Field, Hint, Notice, Panel, Stat, ToolCard, ZoomButtons, downloadText, labelClass, useNotice, useWheel } from '../shared/ui';

const CELL_DISPLAY_SIZE = 140;
const SHEET_PADDING = 96; // white margin around the grid, in sheet pixels (room for the edge labels)
const PROJECT_STORAGE_KEY = 'terraCalc_v2_projects';

const DEFAULT_BG: BackgroundConfig = { scaleX: 1, scaleY: 1, rotation: 0, opacity: 0.5, x: 0, y: 0, lockAspectRatio: true };
const DEFAULT_VISUAL: VisualConfig = {
  cutColor: COLORS.cut,
  cutOpacity: 0.35,
  fillColor: COLORS.fill,
  fillOpacity: 0.3,
  gridColor: '#000000'
};

const createInitialNodes = (rows: number, cols: number): NodeData[][] => {
  const arr: NodeData[][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: NodeData[] = [];
    for (let c = 0; c <= cols; c++) {
      row.push({ existing: 10.00, planned: 10.00 });
    }
    arr.push(row);
  }
  return arr;
};

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-black uppercase text-black">{children}</h3>
      {aside}
    </div>
  );
}

export default function CutFill() {
  // --- State ---
  // Core Data
  const [gridSize, setGridSize] = useState<GridSize>({ rows: 3, cols: 4 });
  const [cellWidth, setCellWidth] = useState(1.0);
  const [nodeData, setNodeData] = useState<NodeData[][]>(() => createInitialNodes(3, 4));

  // UI State
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [notice, notify] = useNotice();

  // View Transform State (Main Grid Zoom/Pan)
  // We use a Ref for the active transform to ensure 60fps performance without React re-renders during drag/zoom
  const [view, setView] = useState({ x: 50, y: 50, scale: 0.8 });
  const viewRef = useRef({ x: 50, y: 50, scale: 0.8 });

  const [isPanning, setIsPanning] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const viewDragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });

  // Project Management State
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [currentProject, setCurrentProject] = useState<{ id: string, name: string } | null>(null);
  const [managerMode, setManagerMode] = useState<'save' | 'open' | null>(null);

  // Visual Configuration
  const [visualConfig, setVisualConfig] = useState<VisualConfig>(DEFAULT_VISUAL);

  // Background Image State
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgConfig, setBgConfig] = useState<BackgroundConfig>(DEFAULT_BG);
  const [showCalibration, setShowCalibration] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [bgVisible, setBgVisible] = useState(true);

  const [isDraggingBg, setIsDraggingBg] = useState(false);
  const [isResizingBg, setIsResizingBg] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, initialScaleX: 1, initialScaleY: 1 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- View Control Logic (Zoom/Pan) ---

  const fitToScreen = useCallback(() => {
    if (!viewportRef.current) return;
    const containerW = viewportRef.current.clientWidth;
    const containerH = viewportRef.current.clientHeight;
    if (containerW === 0 || containerH === 0) return;
    const contentW = gridSize.cols * CELL_DISPLAY_SIZE + 2 * SHEET_PADDING + 40; // + sheet margin and a little air
    const contentH = gridSize.rows * CELL_DISPLAY_SIZE + 2 * SHEET_PADDING + 40;

    const scaleX = containerW / contentW;
    const scaleY = containerH / contentH;
    const scale = Math.min(scaleX, scaleY, 0.8);

    // Centre the grid itself; the sheet's margin sits to its left and top
    const x = (containerW - (gridSize.cols * CELL_DISPLAY_SIZE * scale)) / 2 - SHEET_PADDING * scale;
    const y = (containerH - (gridSize.rows * CELL_DISPLAY_SIZE * scale)) / 2 - SHEET_PADDING * scale;

    setView({ x, y, scale });
  }, [gridSize]);

  // Keep the latest fit function reachable from timers
  const fitRef = useRef(fitToScreen);
  fitRef.current = fitToScreen;
  const fitSoon = () => setTimeout(() => fitRef.current(), 100);

  // --- Effects & Initialization ---

  // Fit initially
  useEffect(() => {
    const t = fitSoon();
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load Projects & Migration Logic
  useEffect(() => {
    const rawV2 = localStorage.getItem(PROJECT_STORAGE_KEY);
    let loadedProjects: SavedProject[] = [];

    if (rawV2) {
      try {
        loadedProjects = JSON.parse(rawV2);
      } catch (e) { console.error('Error loading projects', e); }
    } else {
      // Migration Check: v1 -> v2
      const rawV1 = localStorage.getItem('terraCalcProject');
      if (rawV1) {
        try {
          const parsedV1 = JSON.parse(rawV1);
          const migratedData: ProjectData = {
            gridSize: parsedV1.gridSize || { rows: 3, cols: 4 },
            cellWidth: parsedV1.cellWidth || 1.0,
            nodeData: parsedV1.nodeData || createInitialNodes(3, 4),
            bgImage: parsedV1.bgImage || null,
            bgConfig: parsedV1.bgConfig || DEFAULT_BG,
            visualConfig: parsedV1.visualConfig || { cutColor: '#fbbf24', cutOpacity: 0.4, fillColor: '#60a5fa', fillOpacity: 0.25, gridColor: '#e5e7eb' }
          };

          const migratedProject: SavedProject = {
            id: 'legacy-project',
            name: 'Recovered project',
            updatedAt: new Date().toISOString(),
            data: migratedData
          };

          loadedProjects = [migratedProject];
          localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(loadedProjects));

          // Load it immediately for user convenience
          setGridSize(migratedData.gridSize);
          setCellWidth(migratedData.cellWidth);
          setNodeData(migratedData.nodeData);
          setBgImage(migratedData.bgImage);
          setBgConfig(migratedData.bgConfig);
          setVisualConfig(migratedData.visualConfig);
          setCurrentProject({ id: migratedProject.id, name: migratedProject.name });
        } catch (e) { console.error('Migration failed', e); }
      }
    }
    setProjects(loadedProjects);
  }, []);

  // Persist Projects whenever they change
  useEffect(() => {
    if (projects.length > 0) {
      try {
        localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(projects));
      } catch (e) {
        console.error('Saving projects failed', e);
        notify('Browser storage is full — remove the background plan or an old project', true);
      }
    }
  }, [projects, notify]);

  // Sync React State to Mutable Ref and DOM
  useLayoutEffect(() => {
    viewRef.current = view;
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    }
  }, [view]);

  // --- Logic ---

  const handleGridResize = (newR: number, newC: number) => {
    if (newR > MAX_GRID || newC > MAX_GRID || newR < 1 || newC < 1) return;
    const newData: NodeData[][] = [];
    for (let r = 0; r <= newR; r++) {
      const row: NodeData[] = [];
      for (let c = 0; c <= newC; c++) {
        if (nodeData[r] && nodeData[r][c]) {
          row.push({ ...nodeData[r][c] });
        } else {
          row.push({ existing: 10, planned: 10 });
        }
      }
      newData.push(row);
    }
    setGridSize({ rows: newR, cols: newC });
    setNodeData(newData);
  };

  const handleNodeChange = (r: number, c: number, field: 'existing' | 'planned', val: string) => {
    const newVal = parseFloat(val);
    const newData = [...nodeData];
    newData[r][c] = { ...newData[r][c], [field]: isNaN(newVal) ? (val as unknown as number) : newVal };
    setNodeData(newData);
  };

  // Node columns are stored right-to-left (column 0 is the right edge); letters read left-to-right.
  const getNodeLabel = (r: number, c: number) => {
    const colIndexFromLeft = gridSize.cols - c;
    const colChar = String.fromCharCode(65 + colIndexFromLeft);
    const rowNum = r + 1;
    return `${colChar}${rowNum}`;
  };

  // Helper to apply transforms directly to DOM for performance
  const updateTransform = () => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${viewRef.current.x}px, ${viewRef.current.y}px) scale(${viewRef.current.scale})`;
    }
  };

  // Debounce saving the view to React state to avoid excessive re-renders during high-frequency events
  const debouncedSaveView = useMemo(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (newView: { x: number, y: number, scale: number }) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setView(newView);
        // Remove will-change after interaction settles to ensure crisp text rendering
        if (contentRef.current) contentRef.current.style.willChange = 'auto';
      }, 100);
    };
  }, []);

  useWheel(viewportRef, (e) => {
    // Allow browser native zoom if Ctrl is pressed
    if (e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();

    if (!viewportRef.current || !contentRef.current) return;

    // Optimization: Hint browser for smoother animation
    contentRef.current.style.willChange = 'transform';

    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Use Ref for current state (not React state)
    const current = viewRef.current;
    const worldX = (mouseX - current.x) / current.scale;
    const worldY = (mouseY - current.y) / current.scale;

    const delta = -e.deltaY;
    const sensitivity = 0.0015;
    const zoomFactor = Math.exp(delta * sensitivity);
    const newScale = Math.min(Math.max(0.05, current.scale * zoomFactor), 5);

    const newX = mouseX - (worldX * newScale);
    const newY = mouseY - (worldY * newScale);

    viewRef.current = { x: newX, y: newY, scale: newScale };
    updateTransform();
    debouncedSaveView(viewRef.current);
  });

  const handleViewMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('input, button')) return;
    if (isDraggingBg || isResizingBg) return;

    e.preventDefault();
    (document.activeElement as HTMLElement | null)?.blur?.();
    setIsPanning(true);

    // Optimization
    if (contentRef.current) contentRef.current.style.willChange = 'transform';

    viewDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: viewRef.current.x,
      initialY: viewRef.current.y
    };
  };

  const handleZoomBtn = (dir: 'in' | 'out') => {
    if (!viewportRef.current) return;

    if (contentRef.current) contentRef.current.style.willChange = 'transform';

    const rect = viewportRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const current = viewRef.current;
    const worldX = (centerX - current.x) / current.scale;
    const worldY = (centerY - current.y) / current.scale;

    const factor = dir === 'in' ? 1.25 : 0.8;
    const newScale = Math.min(Math.max(0.05, current.scale * factor), 5);

    const newX = centerX - (worldX * newScale);
    const newY = centerY - (worldY * newScale);

    viewRef.current = { x: newX, y: newY, scale: newScale };
    updateTransform();
    debouncedSaveView(viewRef.current);
  };

  // --- Project Management Functions ---

  const getCurrentProjectData = (): ProjectData => ({
    gridSize, cellWidth, nodeData, bgImage, bgConfig, visualConfig
  });

  const handleSaveClick = () => {
    if (currentProject) {
      const updatedProjects = projects.map(p =>
        p.id === currentProject.id
          ? { ...p, updatedAt: new Date().toISOString(), data: getCurrentProjectData() }
          : p
      );
      setProjects(updatedProjects);
      notify(`Saved “${currentProject.name}”`);
    } else {
      setManagerMode('save');
    }
  };

  const handleSaveNewProject = (name: string) => {
    const newProject: SavedProject = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
      name,
      updatedAt: new Date().toISOString(),
      data: getCurrentProjectData()
    };
    setProjects([...projects, newProject]);
    setCurrentProject({ id: newProject.id, name: newProject.name });
    setManagerMode(null);
    notify(`Saved “${name}”`);
  };

  const handleLoadProject = (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    setGridSize(project.data.gridSize);
    setCellWidth(project.data.cellWidth);
    setNodeData(project.data.nodeData);
    setBgImage(project.data.bgImage);
    setBgConfig(project.data.bgConfig);
    setVisualConfig(project.data.visualConfig || visualConfig);
    setCurrentProject({ id: project.id, name: project.name });
    setManagerMode(null);
    fitSoon();
  };

  const handleDeleteProject = (id: string) => {
    const updated = projects.filter(p => p.id !== id);
    setProjects(updated);
    if (updated.length === 0) {
      localStorage.removeItem(PROJECT_STORAGE_KEY);
    }
    if (currentProject?.id === id) {
      setCurrentProject(null);
    }
  };

  const handleReset = () => {
    setNodeData(createInitialNodes(3, 4));
    setGridSize({ rows: 3, cols: 4 });
    setCellWidth(1.0);
    setBgImage(null);
    setCurrentProject(null);
    fitSoon();
  };

  // --- Exports ---
  const totals = useMemo(() => {
    let totalCut = 0;
    let totalFill = 0;
    if (nodeData.length < gridSize.rows + 1) return { cut: 0, fill: 0 };

    for (let r = 0; r < gridSize.rows; r++) {
      for (let c = 0; c < gridSize.cols; c++) {
        const tl = nodeData[r]?.[c + 1];
        const tr = nodeData[r]?.[c];
        const br = nodeData[r + 1]?.[c];
        const bl = nodeData[r + 1]?.[c + 1];
        if (!tl || !tr || !br || !bl) continue;
        const { results } = MathEngine.getCellPolygons({ tl, tr, br, bl }, cellWidth);
        totalCut += results.cutVol;
        totalFill += results.fillVol;
      }
    }
    return { cut: totalCut, fill: totalFill };
  }, [nodeData, gridSize, cellWidth]);

  // A half-typed level is kept as text while editing; exports need real numbers
  const levelsComplete = () => {
    const ok = nodeData.every(row => row.every(n => typeof n.existing === 'number' && typeof n.planned === 'number' && Number.isFinite(n.existing) && Number.isFinite(n.planned)));
    if (!ok) notify('Fill in every level first', true);
    return ok;
  };

  const exportToCSV = () => {
    if (!levelsComplete()) return;
    const headers = [
      ['﻿Cut & Fill export'], [`Date: ${new Date().toLocaleDateString()}`],
      [`Project: ${currentProject ? currentProject.name : 'Untitled'}`], [],
      ['Grid'], ['Cell size (m)', cellWidth], ['Rows', gridSize.rows], ['Columns', gridSize.cols], [],
      ['Totals'], ['Cut (m3)', totals.cut.toFixed(2)], ['Fill (m3)', totals.fill.toFixed(2)], ['Net: fill - cut (m3)', (totals.fill - totals.cut).toFixed(2)], [],
      ['Levels'], ['Point', 'Existing', 'Planned', 'Difference']
    ];
    const rows: (string | number)[][] = [];
    nodeData.forEach((rowNodes, r) => {
      rowNodes.forEach((node, c) => {
        if (c <= gridSize.cols) {
          rows.push([getNodeLabel(r, c), node.existing.toFixed(2), node.planned.toFixed(2), (node.planned - node.existing).toFixed(2)]);
        }
      });
    });
    const csvContent = [...headers, ...rows].map(e => e.join(",")).join("\n");
    downloadText(csvContent, `cut-fill_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
  };
  const exportToDXF = () => { if (levelsComplete()) downloadText(Exporters.generateDXF(nodeData, gridSize, cellWidth), `cut-fill_plan.dxf`, 'application/dxf'); };
  const exportToSVG = () => { if (levelsComplete()) downloadText(Exporters.generateSVG(nodeData, gridSize, cellWidth, visualConfig), `cut-fill_plan.svg`, 'image/svg+xml'); };

  // Background Drag Logic
  const handleBgMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop propagation to prevent view pan
    setIsDraggingBg(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: bgConfig.x, initialY: bgConfig.y, initialScaleX: bgConfig.scaleX, initialScaleY: bgConfig.scaleY };
  };
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingBg(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: bgConfig.x, initialY: bgConfig.y, initialScaleX: bgConfig.scaleX, initialScaleY: bgConfig.scaleY };
  };

  // Global Mouse Move / Up
  useEffect(() => {
    const handleWindowMouseMove = (e: MouseEvent) => {
      // 1. BG Dragging (screen pixels -> sheet pixels, so the plan stays under the cursor at any zoom)
      if (isDraggingBg) {
        const k = viewRef.current.scale || 1;
        setBgConfig(prev => ({ ...prev, x: dragRef.current.initialX + (e.clientX - dragRef.current.startX) / k, y: dragRef.current.initialY + (e.clientY - dragRef.current.startY) / k }));
      }
      // 2. BG Resizing
      if (isResizingBg) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        const sensitivity = 0.005;
        if (bgConfig.lockAspectRatio) {
          const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
          const newScale = Math.max(0.01, dragRef.current.initialScaleX * (1 + delta * sensitivity));
          setBgConfig(prev => ({ ...prev, scaleX: newScale, scaleY: newScale }));
        } else {
          setBgConfig(prev => ({ ...prev, scaleX: Math.max(0.01, dragRef.current.initialScaleX * (1 + dx * sensitivity)), scaleY: Math.max(0.01, dragRef.current.initialScaleY * (1 + dy * sensitivity)) }));
        }
      }
      // 3. View Panning (Optimized with Direct DOM)
      if (isPanning) {
        const dx = e.clientX - viewDragRef.current.startX;
        const dy = e.clientY - viewDragRef.current.startY;

        viewRef.current.x = viewDragRef.current.initialX + dx;
        viewRef.current.y = viewDragRef.current.initialY + dy;
        updateTransform();
      }
    };
    const handleWindowMouseUp = () => {
      setIsDraggingBg(false);
      setIsResizingBg(false);
      if (isPanning) {
        setIsPanning(false);
        // Sync final state to React
        setView({ ...viewRef.current });
        if (contentRef.current) contentRef.current.style.willChange = 'auto';
      }
    };

    if (isDraggingBg || isResizingBg || isPanning) { window.addEventListener('mousemove', handleWindowMouseMove); window.addEventListener('mouseup', handleWindowMouseUp); }
    return () => { window.removeEventListener('mousemove', handleWindowMouseMove); window.removeEventListener('mouseup', handleWindowMouseUp); };
  }, [isDraggingBg, isResizingBg, isPanning, bgConfig.lockAspectRatio]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Clear input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    if (file.type === 'application/pdf') {
      // Process PDF: the reader is only downloaded when a PDF is actually opened
      setIsProcessingPdf(true);
      try {
        const [pdfModule, worker] = await Promise.all([
          import('pdfjs-dist/build/pdf'),
          import('pdfjs-dist/build/pdf.worker.min.js?url')
        ]);
        const pdfjsLib = pdfModule.default ?? pdfModule;
        pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1); // Get first page

        // Render to canvas at high resolution
        const scale = 3.0; // High res for quality
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport
        };

        await page.render(renderContext).promise;

        // Convert to image
        const dataUrl = canvas.toDataURL('image/png');
        setPendingImage(dataUrl);
        setShowCalibration(true);
      } catch (error) {
        console.error('Error parsing PDF', error);
        notify('Could not read this PDF', true);
      } finally {
        setIsProcessingPdf(false);
      }

    } else {
      // Process Image
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPendingImage(event.target.result as string);
          setShowCalibration(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Updated to accept selection state
  const handleCalibrationConfirm = (newGridSize: GridSize, newCellWidth: number, newBgConfig: BackgroundConfig, newSelection: SelectionState) => {
    setPendingImage(null);
    setShowCalibration(false);

    // Batch updates
    handleGridResize(newGridSize.rows, newGridSize.cols);
    setCellWidth(newCellWidth);
    if (pendingImage) setBgImage(pendingImage); // Only update image if it was a new upload, otherwise (recalibration) keep current

    // Persist the selection state in the config
    setBgConfig({
      ...newBgConfig,
      lastSelection: newSelection
    });

    fitSoon(); // Fit screen after calibration
  };

  const handleRecalibrate = () => {
    if (bgImage) {
      setPendingImage(bgImage); // Reuse existing
      setShowCalibration(true);
    }
  };

  const net = totals.fill - totals.cut;
  const netWord = Math.abs(net) < 0.005 ? 'Balanced' : net > 0 ? 'Deficit · bring in' : 'Surplus · haul away';

  return (
    <ToolCard
      title="Cut & Fill"
      aside={
        <div className="flex flex-wrap items-center gap-3">
          {currentProject && <span className="border-2 border-black bg-white px-2 py-0.5 text-xs font-black uppercase text-black">{currentProject.name}</span>}
          <Hint>Existing + planned levels on a grid → volumes · zero-line method</Hint>
        </div>
      }
    >
      <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">

        {/* Setup */}
        <Panel className="grid gap-4 p-3">

          {/* Project Controls */}
          <div className="grid gap-2">
            <SectionTitle>Project</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Btn size="sm" variant="primary" onClick={handleSaveClick}>
                <Save /> {currentProject ? 'Save' : 'Save as'}
              </Btn>
              <Btn size="sm" onClick={() => setManagerMode('open')}>
                <FolderOpen /> Open
              </Btn>
              {currentProject && (
                <Btn size="sm" variant="plain" className="col-span-2" onClick={() => setManagerMode('save')}>
                  <Plus /> Save as new
                </Btn>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="grid gap-2 border-t-4 border-black pt-3">
            <SectionTitle>Grid</SectionTitle>
            <Field label="Cell size" unit="m" type="number" value={cellWidth} onChange={(e) => setCellWidth(Number(e.target.value))} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rows" type="number" min="1" max={MAX_GRID} value={gridSize.rows} onChange={(e) => handleGridResize(Number(e.target.value), gridSize.cols)} />
              <Field label="Columns" type="number" min="1" max={MAX_GRID} value={gridSize.cols} onChange={(e) => handleGridResize(gridSize.rows, Number(e.target.value))} />
            </div>
          </div>

          {/* Background Image */}
          <div className="grid gap-2 border-t-4 border-black pt-3">
            <SectionTitle
              aside={bgImage && (
                <button type="button" onClick={() => setBgVisible(!bgVisible)} aria-pressed={bgVisible} title={bgVisible ? 'Hide plan' : 'Show plan'} aria-label={bgVisible ? 'Hide plan' : 'Show plan'} className="text-black hover:text-lime-700">
                  {bgVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              )}
            >
              Background plan
            </SectionTitle>

            {!bgImage ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPdf}
                className="flex h-24 flex-col items-center justify-center gap-1 border-4 border-dashed border-black bg-white text-sm font-black uppercase text-black hover:bg-lime-300"
              >
                {isProcessingPdf ? (
                  <>
                    <FileText className="h-6 w-6 animate-pulse" />
                    Reading PDF…
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6" />
                    Upload image or PDF
                    <span className="text-[11px] font-bold normal-case text-lime-700">Optional · PDF is sharpest</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <div className="h-28 overflow-hidden border-4 border-black bg-white">
                  <img src={bgImage} alt="Background plan" className="h-full w-full object-contain" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Btn size="sm" variant="plain" onClick={handleRecalibrate}>
                    <Crop /> Re-place
                  </Btn>
                  <Btn size="sm" variant="danger" onClick={() => setBgImage(null)}>
                    <Trash2 /> Remove
                  </Btn>
                </div>
                <label className="grid gap-1">
                  <span className={cn(labelClass, 'flex justify-between')}>
                    Opacity <span className="font-mono">{Math.round(bgConfig.opacity * 100)}%</span>
                  </span>
                  <input type="range" min="0" max="1" step="0.05" value={bgConfig.opacity} onChange={(e) => setBgConfig({ ...bgConfig, opacity: Number(e.target.value) })} className="h-3 w-full cursor-pointer accent-lime-800" />
                </label>
                <Hint className="font-mono">Scale X {bgConfig.scaleX.toFixed(4)} · Y {bgConfig.scaleY.toFixed(4)}</Hint>
              </>
            )}
            <input type="file" ref={fileInputRef} className="hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={handleImageUpload} />
          </div>

          {/* Visual Settings */}
          <div className="grid gap-2 border-t-4 border-black pt-3">
            <SectionTitle>Colours</SectionTitle>
            <ColorRow label="Cut" color={visualConfig.cutColor} onColor={(v) => setVisualConfig({ ...visualConfig, cutColor: v })} opacity={visualConfig.cutOpacity} onOpacity={(v) => setVisualConfig({ ...visualConfig, cutOpacity: v })} />
            <ColorRow label="Fill" color={visualConfig.fillColor} onColor={(v) => setVisualConfig({ ...visualConfig, fillColor: v })} opacity={visualConfig.fillOpacity} onOpacity={(v) => setVisualConfig({ ...visualConfig, fillOpacity: v })} />
            <ColorRow label="Grid lines" color={visualConfig.gridColor} onColor={(v) => setVisualConfig({ ...visualConfig, gridColor: v })} />
          </div>

          {/* Export */}
          <div className="grid gap-2 border-t-4 border-black pt-3">
            <SectionTitle>Export</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              <Btn size="sm" onClick={exportToCSV} title="Levels and totals as a table"><Download /> CSV</Btn>
              <Btn size="sm" onClick={exportToSVG} title="Coloured drawing"><FileImage /> SVG</Btn>
              <Btn size="sm" onClick={exportToDXF} title="CAD drawing, in metres"><FileCode /> DXF</Btn>
            </div>
          </div>

          <Btn
            size="sm"
            variant="danger"
            onClick={() => setConfirm({ title: 'Reset the grid?', text: 'Levels, grid size and the background plan are cleared. Saved projects stay.', action: 'Reset', onConfirm: handleReset })}
          >
            <RotateCcw /> Reset
          </Btn>
        </Panel>

        {/* Totals + grid */}
        <div className="grid min-w-0 gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="Cut" swatch={visualConfig.cutColor} value={totals.cut.toFixed(2)} unit="m³" />
            <Stat label="Fill" swatch={visualConfig.fillColor} value={totals.fill.toFixed(2)} unit="m³" />
            <Stat tone="dark" label="Net" value={Math.abs(net).toFixed(2)} unit="m³" sub={netWord} />
          </div>

          {/* Grid Canvas with Zoom/Pan */}
          <Panel tone="paper" className="relative">
            <div
              ref={viewportRef}
              className={cn('relative h-[70vh] min-h-[520px] cursor-grab overflow-hidden active:cursor-grabbing', isPanning && '[&_*]:!pointer-events-none')}
              onMouseDown={handleViewMouseDown}
            >
              {/* Uncontrolled Div for performance - styles managed by Refs */}
              <div ref={contentRef} style={{ transformOrigin: '0 0', width: 'fit-content' }}>
                <div className="relative inline-block min-w-fit border-4 border-black bg-white subpixel-antialiased shadow-[8px_8px_0px_#000]" style={{ padding: SHEET_PADDING - 4 }}>
                  <div className="relative select-none" style={{ width: gridSize.cols * CELL_DISPLAY_SIZE, height: gridSize.rows * CELL_DISPLAY_SIZE }}>

                    {/* Background plan, anchored to the grid's top-right corner */}
                    {bgImage && bgVisible && (
                      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                        <div
                          className={cn('pointer-events-auto absolute right-0 top-0 origin-top-right', isDraggingBg ? 'cursor-grabbing' : 'cursor-grab')}
                          style={{
                            transform: `translate(${bgConfig.x}px, ${bgConfig.y}px) rotate(${bgConfig.rotation}deg) scale(${bgConfig.scaleX}, ${bgConfig.scaleY})`,
                            opacity: bgConfig.opacity,
                            backfaceVisibility: 'hidden', // Performance tweak
                          }}
                          onMouseDown={handleBgMouseDown}
                        >
                          {/* Image rendered at natural size for predictable scaling */}
                          <img
                            src={bgImage}
                            alt=""
                            style={{ width: 'auto', height: 'auto', maxWidth: 'none', display: 'block' }}
                            draggable={false}
                          />

                          {/* Resize Handle */}
                          <div
                            className="absolute bottom-0 left-0 z-10 h-8 w-8 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize border-4 border-black bg-white opacity-0 hover:opacity-100"
                            onMouseDown={handleResizeMouseDown}
                          />
                        </div>
                      </div>
                    )}

                    {/* Cells. Cell column c is the c-th from the right, like the nodes. */}
                    <div className="pointer-events-none absolute inset-0 z-10" style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize.cols}, ${CELL_DISPLAY_SIZE}px)`, gridTemplateRows: `repeat(${gridSize.rows}, ${CELL_DISPLAY_SIZE}px)` }}>
                      {Array.from({ length: gridSize.rows }).map((_, r) => (
                        Array.from({ length: gridSize.cols }).map((_, c) => {
                          const hasData = nodeData[r] && nodeData[r][c + 1] && nodeData[r + 1] && nodeData[r + 1][c];
                          if (!hasData) return null;
                          return (
                            <div key={`cell-wrap-${r}-${c}`} className="pointer-events-auto" style={{ gridRow: r + 1, gridColumn: gridSize.cols - c }}>
                              <GridCell
                                r={r} c={c} cellWidth={cellWidth} hasBackground={!!bgImage}
                                corners={{ tl: nodeData[r][c + 1], tr: nodeData[r][c], br: nodeData[r + 1][c], bl: nodeData[r + 1][c + 1] }}
                                onShowDetails={setModalData} visualConfig={visualConfig}
                              />
                            </div>
                          );
                        })
                      ))}
                    </div>

                    {Array.from({ length: gridSize.rows + 1 }).map((_, r) => (
                      Array.from({ length: gridSize.cols + 1 }).map((_, c) => {
                        if (!nodeData[r] || !nodeData[r][c]) return null;
                        return (
                          <div key={`node-${r}-${c}`} className="pointer-events-none absolute z-20 flex items-center justify-center" style={{ top: r * CELL_DISPLAY_SIZE, right: c * CELL_DISPLAY_SIZE, width: 0, height: 0, overflow: 'visible' }} onMouseEnter={() => setHoveredNode(`${r}-${c}`)} onMouseLeave={() => setHoveredNode(null)}>
                            <NodeInput r={r} c={c} label={getNodeLabel(r, c)} data={nodeData[r][c]} onChange={handleNodeChange} isHovered={hoveredNode === `${r}-${c}`} />
                          </div>
                        );
                      })
                    ))}

                    {/* Rulers */}
                    {Array.from({ length: gridSize.cols + 1 }).map((_, c) => (
                      <div key={`col-header-${c}`} className="absolute flex select-none items-center justify-center text-2xl font-black text-lime-700" style={{ right: c * CELL_DISPLAY_SIZE, top: -84, width: 0, height: 40 }}>{getNodeLabel(0, c).charAt(0)}</div>
                    ))}
                    {Array.from({ length: gridSize.rows + 1 }).map((_, r) => (
                      <div key={`row-header-${r}`} className="absolute flex select-none items-center justify-center text-2xl font-black text-lime-700" style={{ top: r * CELL_DISPLAY_SIZE, left: -90, height: 0, width: 40 }}>{r + 1}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Controls */}
            <ZoomButtons
              vertical
              className="absolute left-3 top-3 z-30"
              onIn={() => handleZoomBtn('in')}
              onFit={fitToScreen}
              onOut={() => handleZoomBtn('out')}
              icons={{ in: <ZoomIn />, fit: <Maximize />, out: <ZoomOut /> }}
            />

            {/* User Hint */}
            <Chip className="absolute right-3 top-3 z-30">
              <MousePointer2 /> Scroll = zoom
              <span className="h-3 w-0.5 bg-black" />
              <Move /> Drag = pan
            </Chip>

            {/* How to read a grid point */}
            <NodeKey className="absolute bottom-3 left-3 z-30" />
          </Panel>
        </div>
      </div>

      {/* Modals */}
      <CellDetailDialog data={modalData} labelOf={getNodeLabel} onClose={() => setModalData(null)} />

      <CalibrationDialog
        isOpen={showCalibration}
        imageUrl={pendingImage}
        initialGridSize={gridSize}
        initialCellWidth={cellWidth}
        initialSelection={bgConfig.lastSelection} // Pass previous selection for edit mode
        cellDisplaySize={CELL_DISPLAY_SIZE}
        onClose={() => { setShowCalibration(false); setPendingImage(null); }}
        onConfirm={handleCalibrationConfirm}
      />

      <ProjectDialog
        mode={managerMode}
        projects={projects.map(p => ({ id: p.id, name: p.name, timestamp: new Date(p.updatedAt).getTime() }))}
        onClose={() => setManagerMode(null)}
        onSave={handleSaveNewProject}
        onOpen={handleLoadProject}
        onDelete={handleDeleteProject}
      />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
      <Notice notice={notice} />
    </ToolCard>
  );
}

function ColorRow({ label, color, onColor, opacity, onOpacity }: { label: string; color: string; onColor: (v: string) => void; opacity?: number; onOpacity?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={color} onChange={(e) => onColor(e.target.value)} aria-label={`${label} colour`} className="h-7 w-7 shrink-0 cursor-pointer border-2 border-black bg-white p-0" />
      <span className={cn(labelClass, 'w-20 shrink-0')}>{label}</span>
      {opacity !== undefined && onOpacity && (
        <input type="range" min="0" max="1" step="0.1" value={opacity} onChange={(e) => onOpacity(parseFloat(e.target.value))} aria-label={`${label} opacity`} title="Opacity" className="h-3 min-w-0 flex-1 cursor-pointer accent-lime-800" />
      )}
    </div>
  );
}

/** A grid point, labelled: the same four-corner layout used at every node. */
function NodeKey({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none select-none border-2 border-black bg-white p-2 shadow-[2px_2px_0px_#000]', className)}>
      <div className="grid grid-cols-2 text-[11px] font-black leading-tight">
        <span className="border-b-2 border-r-2 border-black px-2 py-1 text-right text-black">Point</span>
        <span className="border-b-2 border-black px-2 py-1 font-mono text-black">(existing)</span>
        <span className="border-r-2 border-black px-2 py-1 text-right font-mono">
          <span style={{ color: COLORS.cut }}>−cut</span> <span style={{ color: COLORS.fill }}>+fill</span>
        </span>
        <span className="px-2 py-1 font-mono text-fuchsia-700">planned</span>
      </div>
    </div>
  );
}
