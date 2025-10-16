import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import About from "./pages/About";
import DataPortal from "./pages/DataPortal";
import Pricing from "./pages/Pricing.jsx";
import Contact from "./pages/Contact";
import Education from "./pages/Education";


function App() {
  return (
    <Router>
      <div className="bg-gray-950 text-gray-100 font-sans min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/education" element={<Education />} />
            <Route path="/about" element={<About />} />
            <Route path="/data-portal" element={<DataPortal />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </div>
        <footer className="text-center py-6 border-t border-gray-800 text-gray-500 text-sm">
          © {new Date().getFullYear()} Grain Data Intelligence. All rights reserved.
        </footer>
      </div>
    </Router>
  );
}

export default App;
