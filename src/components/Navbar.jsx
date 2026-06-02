import { NavLink } from "react-router-dom";
import { useState } from "react";
import Logo from "../assets/logo.png"; // adjust if needed

function Navbar() {
  const [fundamentalsOpen, setFundamentalsOpen] = useState(false);

  return (
    <nav className="w-full bg-[#0a1128] text-white shadow-md border-b border-gray-700">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
        
        {/* LEFT SIDE: Logo + Name */}
        <div className="flex items-center space-x-3">
          <img src={Logo} alt="GDI Logo" className="h-8" />
          <span className="text-lg font-semibold text-yellow-400">
            Grain Data Intelligence
          </span>
        </div>

        {/* RIGHT SIDE: Menu */}
        <div className="flex items-center space-x-6">

          <NavLink
            to="/home"
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-semibold" : "hover:text-yellow-300"
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/seasonal-charts"
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-semibold" : "hover:text-yellow-300"
            }
          >
            Seasonal Charts
          </NavLink>

          {/* FUNDAMENTALS DROPDOWN */}
          <div
            className="relative"
            onMouseEnter={() => setFundamentalsOpen(true)}
            onMouseLeave={() => setFundamentalsOpen(false)}
          >
            <button
              type="button"
              onClick={() => setFundamentalsOpen((open) => !open)}
              className="hover:text-yellow-300 flex items-center space-x-1"
            >
              <span>Fundamentals</span>
              <span className="text-xs">▼</span>
            </button>

            {fundamentalsOpen && (
              <div className="absolute left-0 top-full w-52 pt-3 z-50">
                <div className="bg-[#0f1629] border border-gray-700 rounded-lg shadow-lg overflow-hidden">
                <NavLink
                  to="/fundamentals/deliveries"
                  className="block px-4 py-2 hover:bg-gray-800"
                >
                  Deliveries
                </NavLink>

                <NavLink
                  to="/fundamentals/imports-exports"
                  className="block px-4 py-2 hover:bg-gray-800"
                >
                  Imports & Exports
                </NavLink>

                <NavLink
                  to="/fundamentals/cftc"
                  className="block px-4 py-2 hover:bg-gray-800"
                >
                  CFTC Positions
                </NavLink>

                <NavLink
                  to="/supply-and-demand"
                  className="block px-4 py-2 hover:bg-gray-800"
                >
                  S&D Hub
                </NavLink>

                </div>
              </div>
            )}
          </div>

          <NavLink
            to="/demo-trading"
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-semibold" : "hover:text-yellow-300"
            }
          >
            Demo Trading
          </NavLink>

          <NavLink
            to="/educational"
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-semibold" : "hover:text-yellow-300"
            }
          >
            Educational
          </NavLink>

          <NavLink
            to="/pricing"
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-semibold" : "hover:text-yellow-300"
            }
          >
            Pricing
          </NavLink>

          <NavLink
            to="/about"
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-semibold" : "hover:text-yellow-300"
            }
          >
            About Us
          </NavLink>

        </div>

        {/* LOGIN / SIGNUP */}
        <div className="flex items-center space-x-3">
          <button className="px-4 py-1 border border-yellow-400 rounded-lg text-yellow-400 hover:bg-yellow-500 hover:text-black transition">
            Login
          </button>

          <button className="px-4 py-1 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition">
            Sign Up
          </button>
        </div>

      </div>
    </nav>
  );
}

export default Navbar;
