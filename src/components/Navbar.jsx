import { NavLink } from "react-router-dom";
import logo from "../assets/logo.png";


function Navbar() {
  const linkClasses =
    "text-gray-300 hover:text-yellow-400 transition-colors duration-300 px-3 py-2 text-sm font-medium";
  const activeLinkClasses =
    "text-yellow-400 font-semibold border-b-2 border-yellow-400 transition-colors duration-300";

  return (
    <nav className="bg-gray-900 text-gray-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Left section — logo and title */}
        <div className="flex items-center space-x-2">
          <img
  src={logo}
  alt="Grain Data Intelligence Logo"
  className="h-8 w-auto mr-2"
/>
<span className="text-yellow-400 font-semibold">
  Grain Data Intelligence
</span>
        </div>

        {/* Center section — navigation links */}
        <div className="flex space-x-6">
          <NavLink
            to="/home"
            className={({ isActive }) =>
              isActive ? `${linkClasses} ${activeLinkClasses}` : linkClasses
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/platform"
            className={({ isActive }) =>
              isActive ? `${linkClasses} ${activeLinkClasses}` : linkClasses
            }
          >
            Platform
          </NavLink>

          <NavLink
            to="/demo-trading"
            className={({ isActive }) =>
              isActive ? `${linkClasses} ${activeLinkClasses}` : linkClasses
            }
          >
            Demo Trading
          </NavLink>

          <NavLink
            to="/educational"
            className={({ isActive }) =>
              isActive ? `${linkClasses} ${activeLinkClasses}` : linkClasses
            }
          >
            Educational
          </NavLink>

          <NavLink
            to="/pricing"
            className={({ isActive }) =>
              isActive ? `${linkClasses} ${activeLinkClasses}` : linkClasses
            }
          >
            Pricing
          </NavLink>

          <NavLink
            to="/about"
            className={({ isActive }) =>
              isActive ? `${linkClasses} ${activeLinkClasses}` : linkClasses
            }
          >
            About Us
          </NavLink>
        </div>

        {/* Right section — login/signup buttons */}
        <div className="flex space-x-3">
          <button className="bg-transparent border border-yellow-400 text-yellow-400 px-3 py-1 rounded-md hover:bg-yellow-400 hover:text-gray-900 transition-colors duration-300">
            Login
          </button>
          <button className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-md font-semibold hover:bg-yellow-300 transition-colors duration-300">
            Sign Up
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
