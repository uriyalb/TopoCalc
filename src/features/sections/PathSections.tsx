import React, { useState, useEffect } from 'react';
import { AlertTriangle, LayoutTemplate, MapPin, Ruler, TrendingUp } from 'lucide-react';
import { dxfService } from './dxfService';
import { storageService } from './storageService';
import { generateProfileData } from './geometry';
import SetupPanel from './SetupPanel';
import LongSection from './LongSection';
import CrossSections from './CrossSections';
import FreeSection from './FreeSection';
import DiagnosticReport from './DiagnosticReport';
import { AppStatus, DxfParsed, ProfilePoint, ProcessingStep, LocalSectionConfig, UserSection, ProjectFile } from './types';
import { ProjectDialog, ProjectEntry } from '../shared/ProjectDialog';
import { ConfirmDialog, ConfirmRequest, EmptyState, Hint, Notice, Panel, SubTabs, ToolCard, useNotice } from '../shared/ui';

// Tab Definitions
type Tab = 'PROFILE' | 'SECTION' | 'LOCAL';

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
    { value: 'PROFILE', label: 'Long Section', icon: <TrendingUp /> },
    { value: 'LOCAL', label: 'Cross Sections', icon: <LayoutTemplate /> },
    { value: 'SECTION', label: 'Free Section', icon: <Ruler /> }
];

interface ModeConfig {
    path: string;
    contours: string[];
    data: ProfilePoint[];
}

const initialConfig: ModeConfig = { path: '', contours: [], data: [] };

const PathSections: React.FC<{ beta?: boolean }> = ({ beta }) => {
    // Application State
    const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
    const [fileName, setFileName] = useState<string>('');
    const [layers, setLayers] = useState<string[]>([]);
    const [dxfData, setDxfData] = useState<DxfParsed | null>(null);
    const [rawDxfContent, setRawDxfContent] = useState<string>(''); // Store raw content for saving project
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [processingLogs, setProcessingLogs] = useState<ProcessingStep[]>([]);

    // UI State
    const [activeTab, setActiveTab] = useState<Tab>('PROFILE');
    const [dialogMode, setDialogMode] = useState<'save' | 'open' | null>(null);
    const [savedProjects, setSavedProjects] = useState<ProjectEntry[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
    const [notice, notify] = useNotice();

    // Data State
    const [profileConfig, setProfileConfig] = useState<ModeConfig>(initialConfig);

    // Current Sidebar Selection State (Shared for now to allow quick switching)
    const [selectedPath, setSelectedPath] = useState<string>('');
    const [selectedContours, setSelectedContours] = useState<string[]>([]);
    const [selectedPlannedContours, setSelectedPlannedContours] = useState<string[]>([]);

    // --- Persisted State for Components ---
    const [localSectionConfig, setLocalSectionConfig] = useState<LocalSectionConfig>({
        interval: 5,
        width: 10,
        pathWidth: 1,
        sections: []
    });

    const [crossSections, setCrossSections] = useState<UserSection[]>([]);

    // --- Auto-Load Last Project ---
    useEffect(() => {
        const loadLastProject = async () => {
            const lastId = storageService.getLastProjectId();
            if (lastId) {
                try {
                    const project = await storageService.getProject(lastId);
                    if (project) {
                        await restoreProject(project);
                    }
                } catch (e) {
                    console.error("Failed to auto-load project", e);
                }
            }
        };
        loadLastProject();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const file = input.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setStatus(AppStatus.PARSING);
        setErrorMsg('');
        setProcessingLogs([]);

        // Read file content for storage
        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            setRawDxfContent(content);

            try {
                // Parse using service (which parses string)
                const parsed = await dxfService.parseString(content);
                const extractedLayers = dxfService.extractLayers(parsed);

                setDxfData(parsed);
                setLayers(extractedLayers);
                setStatus(AppStatus.SELECTING);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.error(err);
                setErrorMsg(err.message || 'Failed to parse DXF file.');
                setStatus(AppStatus.ERROR);
            }
        };
        reader.readAsText(file);
        input.value = ''; // let the same file be picked again
    };

    const handleContourChange = (layer: string) => {
        setSelectedContours(prev => {
            return prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer];
        });
    };

    const handlePlannedContourChange = (layer: string) => {
        setSelectedPlannedContours(prev => {
            return prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer];
        });
    };

    const handleGenerate = () => {
        if (!dxfData || !selectedPath || selectedContours.length === 0) return;

        setStatus(AppStatus.PROCESSING);
        setProcessingLogs([]);
        setErrorMsg('');
        setActiveTab('PROFILE');

        setTimeout(() => {
            try {
                // Call geometry engine for Profile (Existing only for now as per design)
                const result = generateProfileData(selectedPath, selectedContours, dxfData.entities);
                setProcessingLogs(result.logs);

                if (!result.success || result.points.length === 0) {
                    setErrorMsg(result.error || "Processing failed. See the geometry report below.");
                    setStatus(AppStatus.ERROR);
                } else {
                    setProfileConfig({ path: selectedPath, contours: selectedContours, data: result.points });
                    setStatus(AppStatus.COMPLETE);
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (err: any) {
                console.error(err);
                setErrorMsg(err.message || 'Unexpected system error.');
                setStatus(AppStatus.ERROR);
            }
        }, 100);
    };

    const handleReset = () => {
        setStatus(AppStatus.IDLE);
        setFileName('');
        setDxfData(null);
        setRawDxfContent('');
        setLayers([]);
        setSelectedPath('');
        setSelectedContours([]);
        setSelectedPlannedContours([]);
        setProfileConfig(initialConfig);
        setLocalSectionConfig({ interval: 5, width: 10, pathWidth: 1, sections: [] });
        setCrossSections([]);
        setErrorMsg('');
        setProcessingLogs([]);
    };

    // --- Save / Load Logic ---

    const refreshProjects = async () => {
        try {
            const list = await storageService.getAllMetadata();
            setSavedProjects(list.map(p => ({ id: p.id || '', name: p.name || 'Untitled', detail: p.fileName, timestamp: p.timestamp || 0 })));
        } catch (e) {
            console.error("Failed to load saved projects", e);
        } finally {
            setLoadingProjects(false);
        }
    };

    const openProjectList = () => {
        setLoadingProjects(true);
        setDialogMode('open');
        refreshProjects();
    };

    const handleSaveProject = async (name: string) => {
        if (!rawDxfContent) return;

        const projectData: ProjectFile = {
            id: crypto.randomUUID(),
            name,
            version: "1.0",
            timestamp: Date.now(),
            fileName,
            layers,
            selectedPath,
            selectedContours,
            selectedPlannedContours,
            profileData: profileConfig.data,
            localSectionConfig,
            crossSections,
            dxfString: rawDxfContent
        };

        try {
            await storageService.saveProject(projectData);
            setDialogMode(null);
            notify("Saved in this browser");
        } catch (e) {
            console.error(e);
            notify("Could not save", true);
        }
    };

    const restoreProject = async (project: ProjectFile) => {
        try {
            // Restore simple state
            setFileName(project.fileName);
            setLayers(project.layers);
            setSelectedPath(project.selectedPath);
            setSelectedContours(project.selectedContours);
            setSelectedPlannedContours(project.selectedPlannedContours);
            setProfileConfig({ path: project.selectedPath, contours: project.selectedContours, data: project.profileData });
            setLocalSectionConfig(project.localSectionConfig);
            setCrossSections(project.crossSections);
            setRawDxfContent(project.dxfString);
            setErrorMsg('');
            setProcessingLogs([]);

            // Re-hydrate DXF Data
            setStatus(AppStatus.PARSING);
            const parsed = await dxfService.parseString(project.dxfString);
            setDxfData(parsed);

            // Set status based on data presence
            if (project.profileData && project.profileData.length > 0) {
                setStatus(AppStatus.COMPLETE);
            } else {
                setStatus(AppStatus.SELECTING);
            }
        } catch (err) {
            console.error(err);
            notify("Could not open this project", true);
        }
    };

    const handleLoadVersion = async (id: string) => {
        const project = await storageService.getProject(id);
        if (project) {
            await restoreProject(project);
            setDialogMode(null);
        }
    };

    const handleDeleteVersion = async (id: string) => {
        await storageService.deleteProject(id);
        refreshProjects();
    };

    const hasProfile = profileConfig.data.length > 0;

    return (
        <ToolCard title="Path Sections" beta={beta} aside={<Hint>DXF path + contours → long &amp; cross sections</Hint>}>
            <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">

                {/* 1. Setup */}
                <SetupPanel
                    status={status}
                    fileName={fileName}
                    layers={layers}
                    selectedPath={selectedPath}
                    selectedContours={selectedContours}
                    selectedPlannedContours={selectedPlannedContours}
                    onFileUpload={handleFileUpload}
                    onPathChange={setSelectedPath}
                    onContourChange={handleContourChange}
                    onPlannedContourChange={handlePlannedContourChange}
                    onGenerate={handleGenerate}
                    onReset={() => setConfirm({ title: 'Reset Path Sections?', text: 'The drawing, layer choices and sections are cleared. Saved projects stay.', action: 'Reset', onConfirm: handleReset })}
                    onSaveProject={() => setDialogMode('save')}
                    onOpenProject={openProjectList}
                />

                {/* 2. Drawings */}
                <div className="min-w-0">
                    <SubTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

                    <Panel className="-mt-1 grid gap-4 p-3 md:p-4">

                        {/* Error State */}
                        {status === AppStatus.ERROR && (
                            <div className="grid gap-3">
                                <div className="flex items-start gap-2 border-4 border-black bg-red-100 p-3 text-sm font-bold text-red-900 shadow-[4px_4px_0px_#000]">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                                <DiagnosticReport logs={processingLogs} />
                            </div>
                        )}

                        {/* Tab Content */}
                        {activeTab === 'PROFILE' ? (
                            <>
                                {status === AppStatus.IDLE || (status === AppStatus.SELECTING && !hasProfile) ? (
                                    <EmptyState icon={<TrendingUp />} className="min-h-80">
                                        {layers.length === 0 ? 'Upload a DXF — step 1' : 'Pick the path and its contours, then draw'}
                                    </EmptyState>
                                ) : status === AppStatus.COMPLETE || hasProfile ? (
                                    <LongSection data={profileConfig.data} onError={(m) => notify(m, true)} />
                                ) : null}
                            </>
                        ) : activeTab === 'LOCAL' ? (
                            /* Sections every N metres along the path - Controlled Component */
                            <CrossSections
                                pathLayer={selectedPath}
                                contourLayers={selectedContours}
                                plannedContourLayers={selectedPlannedContours}
                                entities={dxfData?.entities || []}
                                config={localSectionConfig}
                                onConfigChange={setLocalSectionConfig}
                            />
                        ) : (
                            /* Hand-drawn section lines - Controlled Component */
                            dxfData ? (
                                <FreeSection
                                    pathLayer={selectedPath}
                                    contourLayers={selectedContours}
                                    entities={dxfData.entities}
                                    sections={crossSections}
                                    onSectionsChange={setCrossSections}
                                />
                            ) : (
                                <EmptyState icon={<MapPin />} className="min-h-80">Upload a DXF — step 1</EmptyState>
                            )
                        )}
                    </Panel>
                </div>
            </div>

            <ProjectDialog
                mode={dialogMode}
                projects={savedProjects}
                loading={loadingProjects}
                defaultName={fileName.replace(/\.dxf$/i, '')}
                onClose={() => setDialogMode(null)}
                onSave={handleSaveProject}
                onOpen={handleLoadVersion}
                onDelete={handleDeleteVersion}
            />
            <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
            <Notice notice={notice} />
        </ToolCard>
    );
};

export default PathSections;
