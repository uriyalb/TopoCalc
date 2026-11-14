
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { motion, AnimatePresence } from "framer-motion";
import TopographyBackground from "../components/TopographyBackground";
import ResultCard from "../components/ResultCard";
import { Calculator, Ruler, LineChart, ArrowBigUp, MoveUp, ChevronLeft, ChevronRight, MapPin, Menu, X } from "lucide-react";

export default function SlopeCalculator() {
  const [activeFolder, setActiveFolder] = useState("slope"); // 'slope', 'stairs', or 'elevation'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
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

  // State for stairs calculator tabs
  const [heightDistanceToStairs, setHeightDistanceToStairs] = useState({
    height: "",
    distance: "",
    results: [],
    selectedOption: 0,
    calculated: false,
    error: null
  });

  const [distanceStairsToHeight, setDistanceStairsToHeight] = useState({
    distance: "",
    stairs: "",
    results: [],
    selectedOption: 0,
    calculated: false,
    error: null
  });

  const [heightStairsToDistance, setHeightStairsToDistance] = useState({
    height: "",
    stairs: "",
    results: [],
    selectedOption: 0,
    calculated: false,
    error: null
  });

  // Effect for real-time calculation updates after initial calculation
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

  useEffect(() => {
    if (heightDistanceToStairs.calculated) {
      calculateStairsByHeightDistance();
    }
  }, [heightDistanceToStairs.height, heightDistanceToStairs.distance]);

  useEffect(() => {
    if (distanceStairsToHeight.calculated) {
      calculateHeightByDistanceStairs();
    }
  }, [distanceStairsToHeight.distance, distanceStairsToHeight.stairs]);

  useEffect(() => {
    if (heightStairsToDistance.calculated) {
      calculateDistanceByHeightStairs();
    }
  }, [heightStairsToDistance.height, heightStairsToDistance.stairs]);

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
  
  // Stairs Calculation functions
  const calculateStairsByHeightDistance = () => {
    const height = parseFloat(heightDistanceToStairs.height);
    const distance = parseFloat(heightDistanceToStairs.distance);
    
    if (isNaN(height) || isNaN(distance)) return;
    
    // Convert to cm for calculations
    const heightCm = height * 100;
    const distanceCm = distance * 100;
    
    const results = [];
    let error = null;
    
    // Try different odd numbers of stairs starting from 3
    for (let stairs = 3; stairs <= 99; stairs += 2) {
      const riserHeight = heightCm / stairs;
      
      // Check if riser height is within allowed range
      if (riserHeight < 10 || riserHeight > 17.5) continue;
      
      // Calculate required tread depth based on formula: 2 risers + 1 tread = 61-63cm
      // Using average of 62cm: tread = 62 - (2 * riserHeight);
      const idealTread = 62 - (2 * riserHeight);
      
      // Check if tread meets minimum requirement
      if (idealTread < 26) continue;
      
      // Calculate total run without landings
      const totalRunWithoutLandings = idealTread * (stairs - 1);
      
      // Calculate number of landings needed (one landing per 75cm of vertical height)
      const numLandings = Math.floor(heightCm / 75);
      
      // Total run including landings (each landing is 1.5m = 150cm)
      const totalRunWithLandings = totalRunWithoutLandings + (numLandings * 150);
      
      // Check if total run is within the available distance
      if (totalRunWithLandings <= distanceCm) {
        results.push({
          stairs,
          riserHeight: riserHeight.toFixed(2),
          treadDepth: idealTread.toFixed(2),
          numLandings,
          totalRun: (totalRunWithLandings / 100).toFixed(2), // Convert back to meters
        });
      }
    }
    
    if (results.length === 0) {
      error = "No viable stair configurations found for the given dimensions.";
    }
    
    setHeightDistanceToStairs({
      ...heightDistanceToStairs,
      results,
      error,
      calculated: true,
      selectedOption: 0
    });
  };

  const calculateHeightByDistanceStairs = () => {
    const distance = parseFloat(distanceStairsToHeight.distance);
    const stairs = parseInt(distanceStairsToHeight.stairs);
    
    if (isNaN(distance) || isNaN(stairs) || stairs % 2 === 0 || stairs < 3) {
      setDistanceStairsToHeight({
        ...distanceStairsToHeight,
        results: [],
        error: "Number of stairs must be an odd number greater than or equal to 3.",
        calculated: true
      });
      return;
    }
    
    // Convert distance to cm
    const distanceCm = distance * 100;
    
    const results = [];
    let error = null;
    
    // Try different riser heights within the allowed range
    for (let riserHeight = 10; riserHeight <= 17.5; riserHeight += 0.5) {
      // Calculate total height
      const totalHeight = riserHeight * stairs;
      
      // Calculate tread depth based on formula
      const treadDepth = 62 - (2 * riserHeight);
      
      // Check if tread meets minimum requirement
      if (treadDepth < 26) continue;
      
      // Calculate number of landings needed
      const numLandings = Math.floor(totalHeight / 75);
      
      // Calculate total run
      const totalRunWithoutLandings = treadDepth * (stairs - 1);
      const totalRunWithLandings = totalRunWithoutLandings + (numLandings * 150);
      
      // Check if total run is within the available distance
      if (totalRunWithLandings <= distanceCm) {
        results.push({
          height: (totalHeight / 100).toFixed(2), // Convert to meters
          riserHeight: riserHeight.toFixed(2),
          treadDepth: treadDepth.toFixed(2),
          numLandings,
          totalRun: (totalRunWithLandings / 100).toFixed(2), // Convert to meters
        });
      }
    }
    
    if (results.length === 0) {
      error = "No viable stair configurations found for the given parameters.";
    }
    
    setDistanceStairsToHeight({
      ...distanceStairsToHeight,
      results,
      error,
      calculated: true,
      selectedOption: 0
    });
  };

  const calculateDistanceByHeightStairs = () => {
    const height = parseFloat(heightStairsToDistance.height);
    const stairs = parseInt(heightStairsToDistance.stairs);
    
    if (isNaN(height) || isNaN(stairs) || stairs % 2 === 0 || stairs < 3) {
      setHeightStairsToDistance({
        ...heightStairsToDistance,
        results: [],
        error: "Number of stairs must be an odd number greater than or equal to 3.",
        calculated: true
      });
      return;
    }
    
    // Convert height to cm
    const heightCm = height * 100;
    
    const results = [];
    let error = null;
    
    // Calculate riser height
    const riserHeight = heightCm / stairs;
    
    // Check if riser height is within allowed range
    if (riserHeight < 10 || riserHeight > 17.5) {
      error = "Riser height is outside the acceptable range (10-17.5 cm).";
    } else {
      // Calculate tread depth based on formula
      const treadDepth = 62 - (2 * riserHeight);
      
      // Check if tread depth meets minimum requirement
      if (treadDepth < 26) {
        error = "Tread depth is less than the minimum requirement (26 cm).";
      } else {
        // Calculate number of landings
        const numLandings = Math.floor(heightCm / 75);
        
        // Calculate total run
        const totalRunWithoutLandings = treadDepth * (stairs - 1);
        const totalRunWithLandings = totalRunWithoutLandings + (numLandings * 150);
        
        results.push({
          distance: (totalRunWithLandings / 100).toFixed(2), // Convert to meters
          riserHeight: riserHeight.toFixed(2),
          treadDepth: treadDepth.toFixed(2),
          numLandings,
          totalRun: (totalRunWithLandings / 100).toFixed(2) // Convert to meters
        });
      }
    }
    
    setHeightStairsToDistance({
      ...heightStairsToDistance,
      results,
      error,
      calculated: true,
      selectedOption: 0
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

  const clearHeightDistanceToStairsForm = () => {
    setHeightDistanceToStairs({
      height: "",
      distance: "",
      results: [],
      selectedOption: 0,
      calculated: false,
      error: null
    });
  };

  const clearDistanceStairsToHeightForm = () => {
    setDistanceStairsToHeight({
      distance: "",
      stairs: "",
      results: [],
      selectedOption: 0,
      calculated: false,
      error: null
    });
  };

  const clearHeightStairsToDistanceForm = () => {
    setHeightStairsToDistance({
      height: "",
      stairs: "",
      results: [],
      selectedOption: 0,
      calculated: false,
      error: null
    });
  };

  return (
    <div className="min-h-screen bg-lime-100 relative overflow-hidden">
      <TopographyBackground />
      
      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] p-3"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
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
              className="bg-lime-200 w-80 h-full p-6 border-r-4 border-black shadow-[8px_0px_0px_#000]"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-black text-lime-900 mb-6 uppercase mt-16">
                Calculators
              </h2>
              <div className="space-y-4">
                <button
                  onClick={() => {
                    setActiveFolder("slope");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full p-4 font-bold text-black border-4 border-black rounded-lg shadow-[4px_4px_0px_#000] uppercase flex items-center gap-3 ${
                    activeFolder === "slope" ? "bg-lime-500" : "bg-lime-400 hover:bg-lime-300"
                  }`}
                >
                  <Calculator className="w-6 h-6" />
                  Slope Calculator
                </button>
                <button
                  onClick={() => {
                    setActiveFolder("elevation");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full p-4 font-bold text-black border-4 border-black rounded-lg shadow-[4px_4px_0px_#000] uppercase flex items-center gap-3 ${
                    activeFolder === "elevation" ? "bg-lime-500" : "bg-lime-400 hover:bg-lime-300"
                  }`}
                >
                  <MapPin className="w-6 h-6" />
                  Elevation Calculator
                </button>
                <button
                  onClick={() => {
                    setActiveFolder("stairs");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full p-4 font-bold text-black border-4 border-black rounded-lg shadow-[4px_4px_0px_#000] uppercase flex items-center gap-3 ${
                    activeFolder === "stairs" ? "bg-lime-500" : "bg-lime-400 hover:bg-lime-300"
                  }`}
                >
                  <MoveUp className="w-6 h-6" />
                  Stairs Calculator
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 md:p-8 relative z-10">
        <div className="max-w-4xl mx-auto">
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
              <button
                onClick={() => setActiveFolder("slope")}
                className={`${
                  activeFolder === "slope" ? "bg-lime-200 relative z-20" : "bg-lime-400 hover:bg-lime-300"
                } py-3 px-6 font-bold text-black border-4 border-b-0 border-black rounded-t-lg shadow-[4px_0px_0px_#000] uppercase flex items-center gap-2`}
              >
                <Calculator className="w-5 h-5" />
                Slope
              </button>
              <button
                onClick={() => setActiveFolder("elevation")}
                className={`${
                  activeFolder === "elevation" ? "bg-lime-200 relative z-20" : "bg-lime-400 hover:bg-lime-300"
                } py-3 px-6 font-bold text-black border-4 border-b-0 border-l-0 border-black rounded-t-lg shadow-[4px_0px_0px_#000] uppercase flex items-center gap-2 ml-[-4px]`}
              >
                <MapPin className="w-5 h-5" />
                Elevation
              </button>
              <button
                onClick={() => setActiveFolder("stairs")}
                className={`${
                  activeFolder === "stairs" ? "bg-lime-200 relative z-20" : "bg-lime-400 hover:bg-lime-300"
                } py-3 px-6 font-bold text-black border-4 border-b-0 border-l-0 border-black rounded-t-lg shadow-[4px_0px_0px_#000] uppercase flex items-center gap-2 ml-[-4px]`}
              >
                <MoveUp className="w-5 h-5" />
                Stairs
              </button>
              <div className="flex-1 border-black relative z-10"></div>
            </div>

            {/* Mobile Current Calculator Indicator */}
            <div className="md:hidden mb-4 text-center">
              <div className="inline-flex items-center gap-2 bg-lime-300 px-4 py-2 border-4 border-black rounded-lg shadow-[4px_4px_0px_#000]">
                {activeFolder === "slope" && <Calculator className="w-5 h-5" />}
                {activeFolder === "elevation" && <MapPin className="w-5 h-5" />}
                {activeFolder === "stairs" && <MoveUp className="w-5 h-5" />}
                <span className="font-bold text-black uppercase">
                  {activeFolder === "slope" && "Slope"}
                  {activeFolder === "elevation" && "Elevation"}
                  {activeFolder === "stairs" && "Stairs"}
                </span>
              </div>
            </div>

            <div className="relative">
              <AnimatePresence mode="wait">
                {activeFolder === "slope" && (
                  <motion.div
                    key="slope"
                    initial={{ opacity: 0, x: -50 }} // Changed to x for desktop, will update to y for mobile if needed
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }} // Changed to x for desktop, will update to y for mobile if needed
                    transition={{ duration: 0.3 }}
                  >
                    <Tabs defaultValue="option1" className="w-full">
                      <TabsList className="bg-lime-200 text-muted-foreground p-0 h-10 pt-1 items-center rounded-md w-full gap-0 md:gap-0 flex justify-between border-black rounded-t-lg">
                        <TabsTrigger
                          value="option1"
                          className="flex-1 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-0 bg-lime-400 hover:bg-lime-300 text-black px-1 md:px-2 py-2 md:py-3 text-sm md:text-lg uppercase border-4 border-black rounded-t-lg flex items-center justify-center gap-1"
                        >
                          <Calculator className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Slope & Height</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option2"
                          className="flex-1 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-0 bg-lime-400 hover:bg-lime-300 text-black px-1 md:px-2 py-2 md:py-3 text-sm md:text-lg uppercase border-4 border-black rounded-t-lg flex items-center justify-center gap-1"
                        >
                          <Ruler className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Distance & Height</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option3"
                          className="flex-1 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-0 bg-lime-400 hover:bg-lime-300 text-black px-1 md:px-2 py-2 md:py-3 text-sm md:text-lg uppercase border-4 border-black rounded-t-lg flex items-center justify-center gap-1"
                        >
                          <LineChart className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Distance & Slope</span>
                        </TabsTrigger>
                      </TabsList>

                      {/* Option 1: Calculate distance from slope and height */}
                      <TabsContent value="option1" className="mt-0">
                        <Card className="border-4 border-t-0 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6"> 
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
                        <Card className="border-4 border-t-0 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
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
                        <Card className="border-4 border-t-0 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
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
                      <TabsList className="p-0 bg-lime-200 text-muted-foreground mx-auto pt-1 h-10 items-center rounded-md w-full gap-1 md:gap-0 flex justify-between border-0 border-b-0 border-black rounded-t-lg"> 
                        <TabsTrigger
                          value="option1"
                          className="flex-1 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-0 bg-lime-400 hover:bg-lime-300 text-black px-1 md:px-2 py-2 md:py-3 text-sm md:text-lg uppercase border-4 border-black rounded-t-lg flex items-center justify-center gap-1"
                        >
                          <Calculator className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Find Slope</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option2"
                          className="flex-1 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-0 bg-lime-400 hover:bg-lime-300 text-black px-1 md:px-2 py-2 md:py-3 text-sm md:text-lg uppercase border-4 border-black rounded-t-lg flex items-center justify-center gap-1"
                        >
                          <MapPin className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Find 2nd Point</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option3"
                          className="flex-1 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-0 bg-lime-400 hover:bg-lime-300 text-black px-1 md:px-2 py-2 md:py-3 text-sm md:text-lg uppercase border-4 border-black rounded-t-lg flex items-center justify-center gap-1"
                        >
                          <Ruler className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Find Distance</span>
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="option1" className="mt-0">
                        <Card className="border-4 border-t-0 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
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
                                
                                <Card className="bg-lime-800 text-lime-100 border-4 border-black shadow-[4px_4px_0px_#000] p-4">
                                  <div className="text-center">
                                    <h4 className="text-sm font-bold mb-2 uppercase tracking-wide">
                                      Elevation Profile
                                    </h4>
                                    <div className="flex justify-between items-end h-20 bg-lime-900 rounded px-4 py-2">
                                      <div className="text-center flex flex-col items-center">
                                        <div className="w-3 h-3 bg-lime-300 rounded-full mb-1"></div>
                                        <div className="text-xs font-bold">Point 1</div>
                                        <div className="text-xs">{pointsToSlope.point1Height}m</div>
                                      </div>
                                      <div className="flex-1 h-px bg-lime-300 mx-2 relative">
                                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-bold bg-lime-800 px-1">
                                          {pointsToSlope.slope}%
                                        </div>
                                      </div>
                                      <div className="text-center flex flex-col items-center">
                                        <div className="w-3 h-3 bg-lime-300 rounded-full mb-1"></div>
                                        <div className="text-xs font-bold">Point 2</div>
                                        <div className="text-xs">{pointsToSlope.point2Height}m</div>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              </div>
                            )}
                          </div>
                        </Card>
                      </TabsContent>

                      <TabsContent value="option2" className="mt-0">
                        <Card className="border-4 border-t-0 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
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
                        <Card className="border-4 border-t-0 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
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
                    <Tabs defaultValue="option1" className="w-full">
                      <TabsList className="p-0 bg-lime-200 text-muted-foreground mx-auto pt-1 h-10 items-center rounded-md w-full gap-1 md:gap-0 flex justify-between border-0 border-b-0 border-black rounded-t-lg"> 
                        <TabsTrigger
                          value="option1"
                          className="flex-1 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-0 bg-lime-400 hover:bg-lime-300 text-black px-1 md:px-2 py-2 md:py-3 text-sm md:text-lg uppercase border-4 border-black rounded-t-lg flex items-center justify-center gap-1"
                        >
                          <MoveUp className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Height & Distance</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option2"
                          className="flex-1 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-0 bg-lime-400 hover:bg-lime-300 text-black px-1 md:px-2 py-2 md:py-3 text-sm md:text-lg uppercase border-4 border-black rounded-t-lg flex items-center justify-center gap-1"
                        >
                          <Ruler className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Distance & Stairs</span>
                        </TabsTrigger>
                        <TabsTrigger
                          value="option3"
                          className="flex-1 data-[state=active]:bg-lime-200 data-[state=active]:text-lime-900 data-[state=active]:border-b-0 bg-lime-400 hover:bg-lime-300 text-black px-1 md:px-2 py-2 md:py-3 text-sm md:text-lg uppercase border-4 border-black rounded-t-lg flex items-center justify-center gap-1"
                        >
                          <ArrowBigUp className="w-4 h-4 md:w-5 md:h-5" />
                          <span className="hidden md:inline">Height & Stairs</span>
                        </TabsTrigger>
                      </TabsList>

                      {/* Option 1: Calculate stairs from height and distance */}
                      <TabsContent value="option1" className="mt-0">
                        <Card className="border-4 border-t-0 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6"> 
                          <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 md:mb-6 uppercase tracking-tight">
                            Find Number of Stairs
                          </h2>
                          
                          <div className="grid gap-4 md:gap-6">
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Total Height (meters)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter vertical height"
                                value={heightDistanceToStairs.height}
                                onChange={(e) =>
                                  setHeightDistanceToStairs({
                                    ...heightDistanceToStairs,
                                    height: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Available Distance (meters)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter horizontal distance"
                                value={heightDistanceToStairs.distance}
                                onChange={(e) =>
                                  setHeightDistanceToStairs({
                                    ...heightDistanceToStairs,
                                    distance: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div className="flex gap-2 md:gap-4">
                              <Button
                                onClick={calculateStairsByHeightDistance}
                                className="flex-1 bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                <MoveUp className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
                                Calculate Stairs
                              </Button>
                              <Button
                                onClick={clearHeightDistanceToStairsForm}
                                className="flex-1 bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Clear
                              </Button>
                            </div>

                            {heightDistanceToStairs.error && (
                              <Card className="mt-4 bg-red-100 text-red-800 border-4 border-black shadow-[8px_8px_0px_#000] p-4 md:p-6">
                                <div className="text-center">
                                  <h3 className="text-lg font-bold mb-2 uppercase tracking-wide">
                                    Error
                                  </h3>
                                  <p className="text-lg font-medium">{heightDistanceToStairs.error}</p>
                                </div>
                              </Card>
                            )}

                            {heightDistanceToStairs.results.length > 0 && (
                              <div className="mt-4">
                                <ResultCard
                                  title="Stair Configuration"
                                  value={`${heightDistanceToStairs.results[heightDistanceToStairs.selectedOption].stairs} Steps`}
                                  subtitle={`Riser: ${heightDistanceToStairs.results[heightDistanceToStairs.selectedOption].riserHeight} cm | Tread: ${heightDistanceToStairs.results[heightDistanceToStairs.selectedOption].treadDepth} cm`}
                                  extra={`${heightDistanceToStairs.results[heightDistanceToStairs.selectedOption].numLandings} landings | Total run: ${heightDistanceToStairs.results[heightDistanceToStairs.selectedOption].totalRun} meters`}
                                />

                                {heightDistanceToStairs.results.length > 1 && (
                                  <div className="mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => {
                                          setHeightDistanceToStairs({
                                            ...heightDistanceToStairs,
                                            selectedOption: Math.max(0, heightDistanceToStairs.selectedOption - 1)
                                          });
                                        }}
                                        disabled={heightDistanceToStairs.selectedOption === 0}
                                        className="border-2 border-black rounded-full"
                                      >
                                        <ChevronLeft className="h-5 w-5" />
                                      </Button>
                                      <p className="text-center font-bold">
                                        Option {heightDistanceToStairs.selectedOption + 1} of {heightDistanceToStairs.results.length}
                                      </p>
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => {
                                          setHeightDistanceToStairs({
                                            ...heightDistanceToStairs,
                                            selectedOption: Math.min(heightDistanceToStairs.results.length - 1, heightDistanceToStairs.selectedOption + 1)
                                          });
                                        }}
                                        disabled={heightDistanceToStairs.selectedOption === heightDistanceToStairs.results.length - 1}
                                        className="border-2 border-black rounded-full"
                                      >
                                        <ChevronRight className="h-5 w-5" />
                                      </Button>
                                    </div>
                                    <div className="py-4">
                                      <p className="text-center font-semibold mb-2">Select Option</p>
                                      <Slider
                                        value={[heightDistanceToStairs.selectedOption]}
                                        min={0}
                                        max={heightDistanceToStairs.results.length - 1}
                                        step={1}
                                        onValueChange={(value) => {
                                          setHeightDistanceToStairs({
                                            ...heightDistanceToStairs,
                                            selectedOption: value[0]
                                          });
                                        }}
                                        className="border-4 border-black p-1 rounded-lg bg-lime-100"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>
                      </TabsContent>

                      {/* Option 2: Calculate height from distance and stairs */}
                      <TabsContent value="option2" className="mt-0">
                        <Card className="border-4 border-t-0 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
                          <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 md:mb-6 uppercase tracking-tight">
                            Find Stair Height
                          </h2>
                          
                          <div className="grid gap-4 md:gap-6">
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Available Distance (meters)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter horizontal distance"
                                value={distanceStairsToHeight.distance}
                                onChange={(e) =>
                                  setDistanceStairsToHeight({
                                    ...distanceStairsToHeight,
                                    distance: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Number of Stairs (odd number)
                              </label>
                              <Input
                                type="number"
                                min="3"
                                step="2"
                                placeholder="Enter number of stairs (odd number)"
                                value={distanceStairsToHeight.stairs}
                                onChange={(e) =>
                                  setDistanceStairsToHeight({
                                    ...distanceStairsToHeight,
                                    stairs: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div className="flex gap-2 md:gap-4">
                              <Button
                                onClick={calculateHeightByDistanceStairs}
                                className="flex-1 bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                <MoveUp className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
                                Calculate Height
                              </Button>
                              <Button
                                onClick={clearDistanceStairsToHeightForm}
                                className="flex-1 bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Clear
                              </Button>
                            </div>

                            {distanceStairsToHeight.error && (
                              <Card className="mt-4 bg-red-100 text-red-800 border-4 border-black shadow-[8px_8px_0px_#000] p-4 md:p-6">
                                <div className="text-center">
                                  <h3 className="text-lg font-bold mb-2 uppercase tracking-wide">
                                    Error
                                  </h3>
                                  <p className="text-lg font-medium">{distanceStairsToHeight.error}</p>
                                </div>
                              </Card>
                            )}

                            {distanceStairsToHeight.results.length > 0 && (
                              <div className="mt-4">
                                <ResultCard
                                  title="Stair Configuration"
                                  value={`${distanceStairsToHeight.results[distanceStairsToHeight.selectedOption].height} meters height`}
                                  subtitle={`Riser: ${distanceStairsToHeight.results[distanceStairsToHeight.selectedOption].riserHeight} cm | Tread: ${distanceStairsToHeight.results[distanceStairsToHeight.selectedOption].treadDepth} cm`}
                                  extra={`${distanceStairsToHeight.results[distanceStairsToHeight.selectedOption].numLandings} landings | Total run: ${distanceStairsToHeight.results[distanceStairsToHeight.selectedOption].totalRun} meters`}
                                />

                                {distanceStairsToHeight.results.length > 1 && (
                                  <div className="mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => {
                                          setDistanceStairsToHeight({
                                            ...distanceStairsToHeight,
                                            selectedOption: Math.max(0, distanceStairsToHeight.selectedOption - 1)
                                          });
                                        }}
                                        disabled={distanceStairsToHeight.selectedOption === 0}
                                        className="border-2 border-black rounded-full"
                                      >
                                        <ChevronLeft className="h-5 w-5" />
                                      </Button>
                                      <p className="text-center font-bold">
                                        Option {distanceStairsToHeight.selectedOption + 1} of {distanceStairsToHeight.results.length}
                                      </p>
                                      <Button 
                                        variant="ghost" 
                                        size="icon"
                                        onClick={() => {
                                          setDistanceStairsToHeight({
                                            ...distanceStairsToHeight,
                                            selectedOption: Math.min(distanceStairsToHeight.results.length - 1, distanceStairsToHeight.selectedOption + 1)
                                          });
                                        }}
                                        disabled={distanceStairsToHeight.selectedOption === distanceStairsToHeight.results.length - 1}
                                        className="border-2 border-black rounded-full"
                                      >
                                        <ChevronRight className="h-5 w-5" />
                                      </Button>
                                    </div>
                                    <div className="py-4">
                                      <p className="text-center font-semibold mb-2">Select Option</p>
                                      <Slider
                                        value={[distanceStairsToHeight.selectedOption]}
                                        min={0}
                                        max={distanceStairsToHeight.results.length - 1}
                                        step={1}
                                        onValueChange={(value) => {
                                          setDistanceStairsToHeight({
                                            ...distanceStairsToHeight,
                                            selectedOption: value[0]
                                          });
                                        }}
                                        className="border-4 border-black p-1 rounded-lg bg-lime-100"
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </Card>
                      </TabsContent>

                      {/* Option 3: Calculate distance from height and stairs */}
                      <TabsContent value="option3" className="mt-0">
                        <Card className="border-4 border-t-0 rounded-t-none border-black shadow-[8px_8px_0px_#000] bg-lime-200 p-4 md:p-6">
                          <h2 className="text-xl md:text-2xl font-black text-lime-900 mb-4 md:mb-6 uppercase tracking-tight">
                            Find Required Distance
                          </h2>
                          
                          <div className="grid gap-4 md:gap-6">
                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Total Height (meters)
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="Enter vertical height"
                                value={heightStairsToDistance.height}
                                onChange={(e) =>
                                  setHeightStairsToDistance({
                                    ...heightStairsToDistance,
                                    height: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div>
                              <label className="block text-lime-800 text-base md:text-lg font-bold mb-2 uppercase">
                                Number of Stairs (odd number)
                              </label>
                              <Input
                                type="number"
                                min="3"
                                step="2"
                                placeholder="Enter number of stairs (odd number)"
                                value={heightStairsToDistance.stairs}
                                onChange={(e) =>
                                  setHeightStairsToDistance({
                                    ...heightStairsToDistance,
                                    stairs: e.target.value,
                                  })
                                }
                                className="border-4 border-black text-base md:text-lg p-3 md:p-4 font-bold bg-white shadow-[4px_4px_0px_#000] focus-visible:ring-0 focus-visible:ring-offset-0"
                              />
                            </div>

                            <div className="flex gap-2 md:gap-4">
                              <Button
                                onClick={calculateDistanceByHeightStairs}
                                className="flex-1 bg-lime-500 hover:bg-lime-600 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                <MoveUp className="w-4 h-4 md:w-5 md:h-5 mr-1 md:mr-2" />
                                Calculate Distance
                              </Button>
                              <Button
                                onClick={clearHeightStairsToDistanceForm}
                                className="flex-1 bg-lime-300 hover:bg-lime-400 text-black border-4 border-black shadow-[4px_4px_0px_#000] px-2 md:px-4 py-4 md:py-6 text-base md:text-lg font-black uppercase"
                              >
                                Clear
                              </Button>
                            </div>

                            {heightStairsToDistance.error && (
                              <Card className="mt-4 bg-red-100 text-red-800 border-4 border-black shadow-[8px_8px_0px_#000] p-4 md:p-6">
                                <div className="text-center">
                                  <h3 className="text-lg font-bold mb-2 uppercase tracking-wide">
                                    Error
                                  </h3>
                                  <p className="text-lg font-medium">{heightStairsToDistance.error}</p>
                                </div>
                              </Card>
                            )}

                            {heightStairsToDistance.results.length > 0 && (
                              <div className="mt-4">
                                <ResultCard
                                  title="Required Distance"
                                  value={`${heightStairsToDistance.results[0].distance} meters`}
                                  subtitle={`Riser: ${heightStairsToDistance.results[0].riserHeight} cm | Tread: ${heightStairsToDistance.results[0].treadDepth} cm`}
                                  extra={`${heightStairsToDistance.results[0].numLandings} landings | Total run: ${heightStairsToDistance.results[0].totalRun} meters`}
                                />
                              </div>
                            )}
                          </div>
                        </Card>
                      </TabsContent>
                    </Tabs>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
