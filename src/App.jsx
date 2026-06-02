import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import Navbar from "./components/Navbar";

import Home from "./pages/Home";
import SeasonalCharts from "./pages/SeasonalCharts";
import Platform from "./pages/Platform";
import Deliveries from "./pages/Deliveries";
import SupplyAndDemand from "./pages/SupplyAndDemand";
import Backtesting from "./pages/Backtesting";
import DemoTrading from "./pages/DemoTrading";
import Educational from "./pages/Educational";
import Pricing from "./pages/Pricing";
import About from "./pages/About";
import LongTermChart  from "./pages/LongTermCharts";  

// NEW PAGE
import LongTermCharts from "./pages/LongTermCharts";

function App() {
  return (
    <Router basename="/">
      <Navbar />

      <Routes>
        {/* Redirect root → /home */}
        <Route path="/" element={<Navigate to="/home" />} />

        {/* MAIN PAGES */}
        <Route path="/home" element={<Home />} />
        <Route path="/seasonal-charts" element={<SeasonalCharts />} />
        <Route path="/platform" element={<Platform />} />
        <Route path="/deliveries" element={<Deliveries />} />
        <Route path="/supply-and-demand" element={<SupplyAndDemand />} />
        <Route path="/backtesting" element={<Backtesting />} />
        <Route path="/demo-trading" element={<DemoTrading />} />
        <Route path="/educational" element={<Educational />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
        <Route path="/long-term-chart" element={<LongTermChart />} />


        {/* NEW LONG-TERM CHARTS MODULE */}
        <Route path="/long-term-charts" element={<LongTermCharts />} />

        {/* 404 FALLBACK */}
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
    </Router>
  );
}

export default App;
