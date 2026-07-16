import { NavLink } from "react-router-dom";
import { useState } from "react";
import NavbarLogo from "../assets/gdi-navbar-logo.png";

function Navbar() {
  const [fundamentalsOpen, setFundamentalsOpen] = useState(false);
  const [balanceSheetOpen, setBalanceSheetOpen] = useState(false);

  return (
    <nav className="w-full bg-[#0a1128] text-white shadow-md border-b border-gray-700">
      <div className="mx-auto flex w-full items-center justify-between gap-6 px-10 py-2">
        
        {/* LEFT SIDE: Logo */}
        <div className="flex min-w-[360px] items-center">
          <img
            src={NavbarLogo}
            alt="Grain Data Intelligence"
            className="h-14 w-[360px] object-contain object-left"
          />
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

          {/* BALANCE SHEET DROPDOWN */}
          <div
            className="relative"
            onMouseEnter={() => setBalanceSheetOpen(true)}
            onMouseLeave={() => setBalanceSheetOpen(false)}
          >
            <button
              type="button"
              onClick={() => setBalanceSheetOpen((open) => !open)}
              className="hover:text-yellow-300 flex items-center space-x-1"
            >
              <span>Balance Sheet</span>
              <span className="text-xs">▼</span>
            </button>

            {balanceSheetOpen && (
              <div className="absolute left-0 top-full w-44 pt-3 z-50">
                <div className="bg-[#0f1629] border border-gray-700 rounded-lg shadow-lg overflow-hidden">
                  <NavLink
                    to="/balance-sheet/wheat"
                    className="block px-4 py-2 hover:bg-gray-800"
                  >
                    Wheat
                  </NavLink>
                  <NavLink
                    to="/balance-sheet/maize"
                    className="block px-4 py-2 hover:bg-gray-800"
                  >
                    Maize
                  </NavLink>
                  <NavLink
                    to="/balance-sheet/soybeans"
                    className="block px-4 py-2 hover:bg-gray-800"
                  >
                    Soybeans
                  </NavLink>
                  <NavLink
                    to="/balance-sheet/sunflowers"
                    className="block px-4 py-2 hover:bg-gray-800"
                  >
                    Sunflowers
                  </NavLink>
                </div>
              </div>
            )}
          </div>

          <NavLink
            to="/annual-sd-summary"
            className={({ isActive }) =>
              isActive ? "text-yellow-400 font-semibold" : "hover:text-yellow-300"
            }
          >
            <span>Annual S&D</span>
          </NavLink>

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
