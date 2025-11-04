import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Platform from "./pages/Platform";
import Deliveries from "./pages/Deliveries";
import SupplyAndDemand from "./pages/SupplyAndDemand";
import Backtesting from "./pages/Backtesting";
import DemoTrading from "./pages/DemoTrading";
import Educational from "./pages/Educational";
import Pricing from "./pages/Pricing";
import About from "./pages/About";

function App() {
  return (
    <Router basename="/grain-data-intelligence">
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/home" />} />
        <Route path="/home" element={<Home />} />

        {/* PLATFORM SECTION */}
        <Route path="/platform" element={<Platform />}>
          {/* 👇 Redirect blank /platform to /platform/deliveries */}
          <Route index element={<Navigate to="deliveries" replace />} />
          <Route path="deliveries" element={<Deliveries />} />
          <Route path="supply-demand" element={<SupplyAndDemand />} />
          <Route path="backtesting" element={<Backtesting />} />
        </Route>

        <Route path="/demo-trading" element={<DemoTrading />} />
        <Route path="/educational" element={<Educational />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  );
}

export default App;
