
import React, { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import ContourBackground from "../components/ContourBackground";
import ResultCard from "../components/ResultCard";
import StairsCalculator from "../components/StairsCalculator";
import PointsSection from "../components/PointsSection";
import { BetaTag } from "../components/BetaTag";
import { Calculator, Ruler, LineChart, ArrowBigUp, MoveUp, MapPin, Menu, X, Route, Shovel } from "lucide-react";

// Loaded on first use: they bring the DXF parser, the charts and the PDF reader with them.
const PathSections = lazy(() => import("@/features/sections/PathSections"));
const CutFill = lazy(() => import("@/features/cutfill/CutFill"));

// One list drives the folder tabs, the mobile menu and the "you are here" badge.
// `workspace` tools are drawing boards: they get the full width and keep their state while hidden.
// `beta` puts a Beta tag on the tab and a banner in the tool — delete the flag when a tool is proven.
const TOOLS = [
  { id: "slope", label: "Slope", name: "Slope Calculator", icon: Calculator },
  { id: "elevation", label: "Elevation", name: "Elevation Calculator", icon: MapPin },
  { id: "stairs", label: "Stairs", name: "Stairs Calculator", icon: MoveUp },
  { id: "sections", label: "Sections", name: "Path Sections", icon: Route, workspace: PathSections, beta: true },
  { id: "cut-fill", label: "Cut & Fill", name: "Cut & Fill", icon: Shovel, workspace: CutFill, beta: true },
];
const WORKSPACES = TOOLS.filter((t) => t.workspace);
const isWorkspace = (id) => WORKSPACES.some((t) => t.id === id);

function ToolLoading() {
  return (
    <div className="rounded-xl border-4 border-black bg-lime-200 p-10 shadow-[8px_8px_0px_#000] flex justify-center">
      <div className="w-8 h-8 border-4 border-lime-400 border-t-black rounded-full animate-spin"></div>
    </div>
  );
}

export default function SlopeCalculator() {
  // The open tool lives in the URL (?tool=…) so it survives a refresh and can be linked to.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("tool");
  const activeFolder = TOOLS.some((t) => t.id === requested) ? requested : "slope";
  const setActiveFolder = (id) => setSearchParams(id === "slope" ? {} : { tool: id });
  const activeTool = TOOLS.find((t) => t.id === activeFolder);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Workspace tools mount on first visit and then stay mounted, so unsaved work survives a tab switch.
  const [visited, setVisited] = useState(() => (isWorkspace(activeFolder) ? [activeFolder] : []));
  useEffect(() => {
    if (isWorkspace(activeFolder)) setVisited((v) => (v.includes(activeFolder) ? v : [...v, activeFolder]));
  }, [activeFolder]);

  // A calculator animates out before a workspace takes its place.
  const previousTool = useRef(activeFolder);
  const [leaving, setLeaving] = useState(false);
  useLayoutEffect(() => {
    if (previousTool.current === activeFolder) return;
    const fromCalculator = !isWorkspace(previousTool.current);
    previousTool.current = activeFolder;
    if (!fromCalculator) return;
    setLeaving(true);
    const fallback = setTimeout(() => setLeaving(false), 450);
    return () => clearTimeout(fallback);
  }, [activeFolder]);
  const wide = isWorkspace(activeFolder) && !leaving;
  
  // State for the slope calculator tabs
  const [slopeHeightToDistance, setSlopeHeightToDistance] = useState({
    slope: "",
    height: "",
    result: null,
    calculated: false,
  });

  const [distanceHeightToSlope, setDistanceHeightToSlope] = useState({
    distance: "",
    height: "",
    result: null,
    calculated: false,
  });

  const [distanceSlopeToHeight, setDistanceSlopeToHeight] = useState({
    distance: "",
    slope: "",
    result: null,
    calculated: false,
  });

  // State for elevation point calculators
  const [pointsToSlope, setPointsToSlope] = useState({
    point1Height: "",
    point2Height: "",
    horizontalDistance: "",
    slope: null,
    heightDifference: null,
    calculated: false
  });
  const [pointSlopeToSecondPoint, setPointSlopeToSecondPoint] = useState({
    point1Height: "",
    slope: "",
    distance: "",
    direction: "uphill", // 'uphill' or 'downhill'
    result: null,
    calculated: false
  });
  const [pointsSlopeToDistance, setPointsSlopeToDistance] = useState({
    point1Height: "",
    point2Height: "",
    slope: "",
    result: null,
    calculated: false
  });

  useEffect(() => {
    if (slopeHeightToDistance.calculated) {
      calculateDistance();
    }
  }, [slopeHeightToDistance.slope, slopeHeightToDistance.height]);

  useEffect(() => {
    if (distanceHeightToSlope.calculated) {
      calculateSlope();
    }
  }, [distanceHeightToSlope.distance, distanceHeightToSlope.height]);

  useEffect(() => {
    if (distanceSlopeToHeight.calculated) {
      calculateHeight();
    }
  }, [distanceSlopeToHeight.distance, distanceSlopeToHeight.slope]);

  // Effect for real-time elevation calculations
  useEffect(() => {
    if (pointsToSlope.calculated) calculateElevationSlope();
  }, [pointsToSlope.point1Height, pointsToSlope.point2Height, pointsToSlope.horizontalDistance]);
  
  useEffect(() => {
    if (pointSlopeToSecondPoint.calculated) calculateSecondPoint();
  }, [pointSlopeToSecondPoint.point1Height, pointSlopeToSecondPoint.slope, pointSlopeToSecondPoint.distance, pointSlopeToSecondPoint.direction]);

  useEffect(() => {
    if (pointsSlopeToDistance.calculated) calculateDistanceByPointsSlope();
  }, [pointsSlopeToDistance.point1Height, pointsSlopeToDistance.point2Height, pointsSlopeToDistance.slope]);


  // Slope Calculation functions
  const calculateDistance = () => {
    const slope = parseFloat(slopeHeightToDistance.slope);
    const height = parseFloat(slopeHeightToDistance.height);
    
    if (isNaN(slope) || isNaN(height)) return;
    
    // distance = height / (slope/100)
    const result = height / (slope / 100);
    setSlopeHeightToDistance({
      ...slopeHeightToDistance,
      result: result.toFixed(2),
      calculated: true,
    });
  };

  const calculateSlope = () => {
    const distance = parseFloat(distanceHeightToSlope.distance);
    const height = parseFloat(distanceHeightToSlope.height);
    
    if (isNaN(distance) || isNaN(height)) return;
    
    // slope = (height/distance) * 100
    const result = (height / distance) * 100;
    setDistanceHeightToSlope({
      ...distanceHeightToSlope,
      result: result.toFixed(2),
      calculated: true,
    });
  };

  const calculateHeight = () => {
    const distance = parseFloat(distanceSlopeToHeight.distance);
    const slope = parseFloat(distanceSlopeToHeight.slope);
    
    if (isNaN(distance) || isNaN(slope)) return;
    
    // height = distance * (slope/100)
    const result = distance * (slope / 100);
    setDistanceSlopeToHeight({
      ...distanceSlopeToHeight,
      result: result.toFixed(2),
      calculated: true,
    });
  };

  // Elevation Point Calculation functions
  const calculateElevationSlope = () => {
    const point1 = parseFloat(pointsToSlope.point1Height);
    const point2 = parseFloat(pointsToSlope.point2Height);
    const distance = parseFloat(pointsToSlope.horizontalDistance);
    
    if (isNaN(point1) || isNaN(point2) || isNaN(distance) || distance === 0) return;
    
    const heightDifference = Math.abs(point2 - point1);
    const slope = (heightDifference / distance) * 100;
    
    setPointsToSlope({
      ...pointsToSlope,
      slope: slope.toFixed(2),
      heightDifference: heightDifference.toFixed(2),
      calculated: true
    });
  };

  const calculateSecondPoint = () => {
    const point1 = parseFloat(pointSlopeToSecondPoint.point1Height);
    const slope = parseFloat(pointSlopeToSecondPoint.slope);
    const distance = parseFloat(pointSlopeToSecondPoint.distance);
    
    if (isNaN(point1) || isNaN(slope) || isNaN(distance)) return;
    
    const heightDifference = distance * (slope / 100);
    const result = pointSlopeToSecondPoint.direction === 'uphill' 
      ? point1 + heightDifference
      : point1 - heightDifference;

    setPointSlopeToSecondPoint({
      ...pointSlopeToSecondPoint,
      result: result.toFixed(2),
      calculated: true,
    });
  };

  const calculateDistanceByPointsSlope = () => {
    const point1 = parseFloat(pointsSlopeToDistance.point1Height);
    const point2 = parseFloat(pointsSlopeToDistance.point2Height);
    const slope = parseFloat(pointsSlopeToDistance.slope);
    
    if (isNaN(point1) || isNaN(point2) || isNaN(slope) || slope === 0) return;

    const heightDifference = Math.abs(point2 - point1);
    const result = heightDifference / (slope / 100);
    
    setPointsSlopeToDistance({
      ...pointsSlopeToDistance,
      result: result.toFixed(2),
      calculated: true,
    });
  };
  
  // Clear form functions
  const clearSlopeHeightForm = () => {
    setSlopeHeightToDistance({
      slope: "",
      height: "",
      result: null,
      calculated: false
    });
  };

  const clearDistanceHeightForm = () => {
    setDistanceHeightToSlope({
      distance: "",
      height: "",
      result: null,
      calculated: false
    });
  };

  const clearDistanceSlopeForm = () => {
    setDistanceSlopeToHeight({
      distance: "",
      slope: "",
      result: null,
      calculated: false
    });
  };

  const clearElevationSlopeForm = () => {
    setPointsToSlope({ point1Height: "", point2Height: "", horizontalDistance: "", slope: null, heightDifference: null, calculated: false });
  };
  const clearSecondPointForm = () => {
    setPointSlopeToSecondPoint({ point1Height: "", slope: "", distance: "", direction: "uphill", result: null, calculated: false });
  };
  const clearDistanceByPointsSlopeForm = () => {
    setPointsSlopeToDistance({ point1Height: "", point2Height: "", slope: "", result: null, calculated: false });
  };


  return (
    <div className="min-h-screen bg-lime-100 relative overflow-hidden">
      <ContourBackground />
      
      {/* Mobile Menu Button: part of the page header, so it scrolls away instead of covering the content */}
      <div className="md:hidden absolute top-4 left-4 z-30">
        <Button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open tools menu"
          aria-expanded={mobileMenuOpen}
          className="bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] p-3"
        >
          <Menu className="w-6 h-6" />
        </Button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{type: "tween", duration: 0.2}}
              className="bg-lime-200 w-80 max-w-[85vw] h-full overflow-y-auto p-6 border-r-4 border-black shadow-[8px_0px_0px_#000]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* The close button lives in the drawer, so it is there however far the page was scrolled */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-lime-900 uppercase">
                  Tools
                </h2>
                <Button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close tools menu"
                  className="bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] p-3"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
              <div className="space-y-4">
                {TOOLS.map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setActiveFolder(tool.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-4 font-bold text-black border-4 border-black rounded-lg shadow-[4px_4px_0px_#000] uppercase flex items-center gap-3 ${
                      activeFolder === tool.id ? "bg-lime-500" : "bg-lime-400 hover:bg-lime-300"
                    }`}
                  >
                    <tool.icon className="w-6 h-6" />
                    {tool.name}
                    {tool.beta && <BetaTag className="ml-auto" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 md:p-8 relative z-10">
        <div className={`${wide ? "max-w-[1600px]" : "max-w-4xl"} mx-auto`}>
          <div className="text-center md:text-left mt-16 md:mt-0">
            <h1 className="text-3xl md:text-6xl font-black text-lime-800 mb-2 tracking-tight leading-none">
              TOPO CALCULATOR
            </h1>
            <p className="text-lime-700 text-base md:text-xl font-bold mb-6 md:mb-8 uppercase tracking-wide">
              FOR LANDSCAPE ARCHITECTS
            </p>
          </div>

          <div className="relative">
            {/* Desktop Folder tabs */}
            <div className="mb-2 hidden md:flex gap-1 md:gap-2">
              {TOOLS.map((tool, i) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveFolder(tool.id)}
                  className={`${
                    activeFolder === tool.id ? "bg-lime-200 relative z-20" : "bg-lime-400 hover:bg-lime-300"
                  } py-3 px-3 lg:px-6 text-sm lg:text-base whitespace-nowrap font-bold text-black border-4 border-b-0 ${
                    i > 0 ? "border-l-0 ml-[-4px]" : ""
                  } border-black rounded-t-lg shadow-[4px_0px_0px_#000] uppercase flex items-center gap-2`}
                >
                  <tool.icon className="w-5 h-5" />
                  {tool.label}
                  {tool.beta && <BetaTag />}
                </button>
              ))}
              <div className="flex-1 border-black relative z-10"></div>
            </div>

            {/* Mobile Current Calculator Indicator */}
            <div className="md:hidden mb-4 text-center">
              <div className="inline-flex items-center gap-2 bg-lime-300 px-4 py-2 border-4 border-black rounded-lg shadow-[4px_4px_0px_#000]">
                <activeTool.icon className="w-5 h-5" />
                <span className="font-bold text-black uppercase">{activeTool.label}</span>
                {activeTool.beta && <BetaTag />}
              </div>
            </div>

            <div className="relative">
              <AnimatePresence mode="wait" onExitComplete={() => setLeaving(false)}>
                {activeFolder === "slope" && (
                  <motion.div
                    key="slope"
                    initial={{ opacity: 0, x: -50 }} // Changed to x for desktop, will update to y for mobile if needed
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }} // Changed to x for desktop, will update to y for mobile if needed
                    transition={{ duration: 0.3 }}
                  >
                    <Tabs defaultValue="option1" className="w-full">
                      <TabsList className="relative z-10 flex items-stretch w-full h-auto p-0 gap-0 bg-transparent rounded-none">
<TabsTrigger
                          value="option1"
                          className="flex-1 min-w-0 -ml-1 first:ml-0 h-auto rounded-none first:rounded-tl-lg last:rounded-tr-lg border-4 border-black bg-lime-400 hover:bg-lime-300 text-black font-bold uppercase px-1 md:px-3 py-2 md:py-3 text-[11px] leading-tight md:text-base whitespace-normal flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-none data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-lime-200 data-[state=active]:shadow-none"
                        >
                          <Calculator className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                          <span>Slope & Height</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option2"
                          className="flex-1 min-w-0 -ml-1 first:ml-0 h-auto rounded-none first:rounded-tl-lg last:rounded-tr-lg border-4 border-black bg-lime-400 hover:bg-lime-300 text-black font-bold uppercase px-1 md:px-3 py-2 md:py-3 text-[11px] leading-tight md:text-base whitespace-normal flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-none data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-lime-200 data-[state=active]:shadow-none"
                        >
                          <Ruler className="w-4 h-4 md:w-5 md:h-5" />
                          <span>Distance & Height</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option3"
                          className="flex-1 min-w-0 -ml-1 first:ml-0 h-auto rounded-none first:rounded-tl-lg last:rounded-tr-lg border-4 border-black bg-lime-400 hover:bg-lime-300 text-black font-bold uppercase px-1 md:px-3 py-2 md:py-3 text-[11px] leading-tight md:text-base whitespace-normal flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-none data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-lime-200 data-[state=active]:shadow-none"
                        >
                          <LineChart className="w-4 h-4 md:w-5 md:h-5" />
                          <span>Distance & Slope</span>
                        </TabsTrigger>
                      </TabsList>

                      {/* Option 1: Calculate distance from slope and height */}
                      <TabsContent value="option1" className="mt-0">
                        <Card className="-mt-1 border-4 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6"> 
                          <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 md:mb-6 uppercase tracking-tight">
                            Find Distance
                          </h2>
                          
                          <div className="grid gap-4 md:gap-6">
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Desired Slope (%)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter slope percentage"
                                value={slopeHeightToDistance.slope}
                                onChange={(e) =>
                                  setSlopeHeightToDistance({
                                    ...slopeHeightToDistance,
                                    slope: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Height (meters)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter height"
                                value={slopeHeightToDistance.height}
                                onChange={(e) =>
                                  setSlopeHeightToDistance({
                                    ...slopeHeightToDistance,
                                    height: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div className="flex gap-2 md:gap-4">
                              <Button
                                onClick={calculateDistance}
                                className="flex-1 bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                <ArrowBigUp className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
                                Calculate
                              </Button>
                              <Button
                                onClick={clearSlopeHeightForm}
                                className="flex-1 bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Clear
                              </Button>
                            </div>

                            {slopeHeightToDistance.result !== null && (
                              <ResultCard
                                title="Required Distance"
                                value={`${slopeHeightToDistance.result} meters`}
                                subtitle={`For a ${slopeHeightToDistance.slope}% slope with ${slopeHeightToDistance.height}m height`}
                              />
                            )}
                          </div>
                        </Card>
                      </TabsContent>

                      {/* Option 2: Calculate slope from distance and height */}
                      <TabsContent value="option2" className="mt-0">
                        <Card className="-mt-1 border-4 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
                          <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 md:mb-6 uppercase tracking-tight">
                            Find Slope
                          </h2>
                          
                          <div className="grid gap-4 md:gap-6">
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Distance (meters)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter distance"
                                value={distanceHeightToSlope.distance}
                                onChange={(e) =>
                                  setDistanceHeightToSlope({
                                    ...distanceHeightToSlope,
                                    distance: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Height (meters)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter height"
                                value={distanceHeightToSlope.height}
                                onChange={(e) =>
                                  setDistanceHeightToSlope({
                                    ...distanceHeightToSlope,
                                    height: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div className="flex gap-2 md:gap-4">
                              <Button
                                onClick={calculateSlope}
                                className="flex-1 bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                <ArrowBigUp className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
                                Calculate
                              </Button>
                              <Button
                                onClick={clearDistanceHeightForm}
                                className="flex-1 bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Clear
                              </Button>
                            </div>

                            {distanceHeightToSlope.result !== null && (
                              <ResultCard
                                title="Slope Percentage"
                                value={`${distanceHeightToSlope.result}%`}
                                subtitle={`For ${distanceHeightToSlope.distance}m distance with ${distanceHeightToSlope.height}m height`}
                              />
                            )}
                          </div>
                        </Card>
                      </TabsContent>

                      {/* Option 3: Calculate height from distance and slope */}
                      <TabsContent value="option3" className="mt-0">
                        <Card className="-mt-1 border-4 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
                          <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 md:mb-6 uppercase tracking-tight">
                            Find Height
                          </h2>
                          
                          <div className="grid gap-4 md:gap-6">
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Distance (meters)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter distance"
                                value={distanceSlopeToHeight.distance}
                                onChange={(e) =>
                                  setDistanceSlopeToHeight({
                                    ...distanceSlopeToHeight,
                                    distance: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Slope (%)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter slope percentage"
                                value={distanceSlopeToHeight.slope}
                                onChange={(e) =>
                                  setDistanceSlopeToHeight({
                                    ...distanceSlopeToHeight,
                                    slope: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div className="flex gap-2 md:gap-4">
                              <Button
                                onClick={calculateHeight}
                                className="flex-1 bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                <ArrowBigUp className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
                                Calculate
                              </Button>
                              <Button
                                onClick={clearDistanceSlopeForm}
                                className="flex-1 bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Clear
                              </Button>
                            </div>

                            {distanceSlopeToHeight.result !== null && (
                              <ResultCard
                                title="Required Height"
                                value={`${distanceSlopeToHeight.result} meters`}
                                subtitle={`For ${distanceSlopeToHeight.distance}m distance with ${distanceSlopeToHeight.slope}% slope`}
                              />
                            )}
                          </div>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </motion.div>
                )}

                {activeFolder === "elevation" && (
                  <motion.div key="elevation" 
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    transition={{ duration: 0.3 }}>
                    <Tabs defaultValue="option1" className="w-full">
                      <TabsList className="relative z-10 flex items-stretch w-full h-auto p-0 gap-0 bg-transparent rounded-none">
<TabsTrigger
                          value="option1"
                          className="flex-1 min-w-0 -ml-1 first:ml-0 h-auto rounded-none first:rounded-tl-lg last:rounded-tr-lg border-4 border-black bg-lime-400 hover:bg-lime-300 text-black font-bold uppercase px-1 md:px-3 py-2 md:py-3 text-[11px] leading-tight md:text-base whitespace-normal flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-none data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-lime-200 data-[state=active]:shadow-none"
                        >
                          <Calculator className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
                          <span>Find Slope</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option2"
                          className="flex-1 min-w-0 -ml-1 first:ml-0 h-auto rounded-none first:rounded-tl-lg last:rounded-tr-lg border-4 border-black bg-lime-400 hover:bg-lime-300 text-black font-bold uppercase px-1 md:px-3 py-2 md:py-3 text-[11px] leading-tight md:text-base whitespace-normal flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-none data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-lime-200 data-[state=active]:shadow-none"
                        >
                          <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                          <span>Find 2nd Point</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option3"
                          className="flex-1 min-w-0 -ml-1 first:ml-0 h-auto rounded-none first:rounded-tl-lg last:rounded-tr-lg border-4 border-black bg-lime-400 hover:bg-lime-300 text-black font-bold uppercase px-1 md:px-3 py-2 md:py-3 text-[11px] leading-tight md:text-base whitespace-normal flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 shadow-none data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-lime-200 data-[state=active]:shadow-none"
                        >
                          <Ruler className="w-4 h-4 md:w-5 md:h-5" />
                          <span>Find Distance</span>
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="option1" className="mt-0">
                        <Card className="-mt-1 border-4 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
                          <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 md:mb-6 uppercase tracking-tight">
                            Find Slope Between Points
                          </h2>
                          <div className="grid gap-4 md:gap-6">
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Point 1 Elevation (meters)
                              </label>
                              <Input
                                value={pointsToSlope.point1Height}
                                onChange={(e) => setPointsToSlope({...pointsToSlope, point1Height: e.target.value})}
                                placeholder="Enter first point elevation"
                                type="number"
                                step="0.01"
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Point 2 Elevation (meters)
                              </label>
                              <Input
                                value={pointsToSlope.point2Height}
                                onChange={(e) => setPointsToSlope({...pointsToSlope, point2Height: e.target.value})}
                                placeholder="Enter second point elevation"
                                type="number"
                                step="0.01"
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Horizontal Distance (meters)
                              </label>
                              <Input
                                value={pointsToSlope.horizontalDistance}
                                onChange={(e) => setPointsToSlope({...pointsToSlope, horizontalDistance: e.target.value})}
                                placeholder="Enter horizontal distance between points"
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div className="flex gap-2 md:gap-4">
                              <Button
                                onClick={calculateElevationSlope}
                                className="flex-1 bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Calculate
                              </Button>
                              <Button
                                onClick={clearElevationSlopeForm}
                                className="flex-1 bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Clear
                              </Button>
                            </div>
                            {pointsToSlope.slope !== null && (
                              <div className="space-y-4">
                                <ResultCard
                                  title="Slope Between Points"
                                  value={`${pointsToSlope.slope}%`}
                                  subtitle={`Height difference: ${pointsToSlope.heightDifference}m over ${pointsToSlope.horizontalDistance}m distance`}
                                  extra={`From ${pointsToSlope.point1Height}m to ${pointsToSlope.point2Height}m elevation`}
                                />
                                
                                {[pointsToSlope.point1Height, pointsToSlope.point2Height, pointsToSlope.horizontalDistance].every((v) => Number.isFinite(parseFloat(v))) &&
                                  parseFloat(pointsToSlope.horizontalDistance) !== 0 && (
                                    <PointsSection
                                      z1={parseFloat(pointsToSlope.point1Height)}
                                      z2={parseFloat(pointsToSlope.point2Height)}
                                      distance={parseFloat(pointsToSlope.horizontalDistance)}
                                      slope={pointsToSlope.slope}
                                    />
                                  )}
                              </div>
                            )}
                          </div>
                        </Card>
                      </TabsContent>

                      <TabsContent value="option2" className="mt-0">
                        <Card className="-mt-1 border-4 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
                          <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 md:mb-6 uppercase tracking-tight">Find Second Point Elevation</h2>
                          <div className="grid gap-4 md:gap-6">
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Start Point Elevation (meters)
                              </label>
                              <Input
                                value={pointSlopeToSecondPoint.point1Height}
                                onChange={(e) => setPointSlopeToSecondPoint({...pointSlopeToSecondPoint, point1Height: e.target.value})}
                                placeholder="Enter start point elevation"
                                type="number"
                                step="0.01"
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Slope (%)
                              </label>
                              <Input
                                value={pointSlopeToSecondPoint.slope}
                                onChange={(e) => setPointSlopeToSecondPoint({...pointSlopeToSecondPoint, slope: e.target.value})}
                                placeholder="Enter slope percentage"
                                type="number"
                                step="0.01"
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Horizontal Distance (meters)
                              </label>
                              <Input
                                value={pointSlopeToSecondPoint.distance}
                                onChange={(e) => setPointSlopeToSecondPoint({...pointSlopeToSecondPoint, distance: e.target.value})}
                                placeholder="Enter horizontal distance"
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">Direction</label>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => setPointSlopeToSecondPoint({...pointSlopeToSecondPoint, direction: 'uphill'})}
                                  className={`flex-1 ${pointSlopeToSecondPoint.direction === 'uphill' ? 'bg-lime-500' : 'bg-lime-300'} hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] py-3 font-black uppercase text-sm md:text-base`}
                                >
                                  Uphill
                                </Button>
                                <Button
                                  onClick={() => setPointSlopeToSecondPoint({...pointSlopeToSecondPoint, direction: 'downhill'})}
                                  className={`flex-1 ${pointSlopeToSecondPoint.direction === 'downhill' ? 'bg-lime-500' : 'bg-lime-300'} hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] py-3 font-black uppercase text-sm md:text-base`}
                                >
                                  Downhill
                                </Button>
                              </div>
                            </div>
                            <div className="flex gap-2 md:gap-4">
                              <Button
                                onClick={calculateSecondPoint}
                                className="flex-1 bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Calculate
                              </Button>
                              <Button
                                onClick={clearSecondPointForm}
                                className="flex-1 bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Clear
                              </Button>
                            </div>
                            {pointSlopeToSecondPoint.result !== null && (
                              <ResultCard
                                title="Second Point Elevation"
                                value={`${pointSlopeToSecondPoint.result} meters`}
                                subtitle={`From ${pointSlopeToSecondPoint.point1Height}m at ${pointSlopeToSecondPoint.slope}% ${pointSlopeToSecondPoint.direction}`}
                              />
                            )}
                          </div>
                        </Card>
                      </TabsContent>

                      <TabsContent value="option3" className="mt-0">
                        <Card className="-mt-1 border-4 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
                          <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 md:mb-6 uppercase tracking-tight">Find Distance from Points & Slope</h2>
                          <div className="grid gap-4 md:gap-6">
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Point 1 Elevation (meters)
                              </label>
                              <Input
                                value={pointsSlopeToDistance.point1Height}
                                onChange={(e) => setPointsSlopeToDistance({...pointsSlopeToDistance, point1Height: e.target.value})}
                                placeholder="Enter point 1 elevation"
                                type="number"
                                step="0.01"
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Point 2 Elevation (meters)
                              </label>
                              <Input
                                value={pointsSlopeToDistance.point2Height}
                                onChange={(e) => setPointsSlopeToDistance({...pointsSlopeToDistance, point2Height: e.target.value})}
                                placeholder="Enter point 2 elevation"
                                type="number"
                                step="0.01"
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Desired Slope (%)
                              </label>
                              <Input
                                value={pointsSlopeToDistance.slope}
                                onChange={(e) => setPointsSlopeToDistance({...pointsSlopeToDistance, slope: e.target.value})}
                                placeholder="Enter desired slope percentage"
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>
                            <div className="flex gap-2 md:gap-4">
                              <Button
                                onClick={calculateDistanceByPointsSlope}
                                className="flex-1 bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Calculate
                              </Button>
                              <Button
                                onClick={clearDistanceByPointsSlopeForm}
                                className="flex-1 bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Clear
                              </Button>
                            </div>
                            {pointsSlopeToDistance.result !== null && (
                              <ResultCard
                                title="Required Horizontal Distance"
                                value={`${pointsSlopeToDistance.result} meters`}
                                subtitle={`For a ${pointsSlopeToDistance.slope}% slope between ${pointsSlopeToDistance.point1Height}m and ${pointsSlopeToDistance.point2Height}m`}
                              />
                            )}
                          </div>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </motion.div>
                )}

                {activeFolder === "stairs" && (
                  <motion.div
                    key="stairs"
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                  >
                    <StairsCalculator />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Workspace tools: mounted once visited, hidden rather than unmounted */}
              {WORKSPACES.filter((tool) => visited.includes(tool.id)).map((tool) => (
                <div key={tool.id} className={activeFolder === tool.id && !leaving ? "" : "hidden"}>
                  <Suspense fallback={<ToolLoading />}>
                    <tool.workspace beta={tool.beta} />
                  </Suspense>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
