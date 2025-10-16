import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="flex items-center justify-between px-8 py-4 bg-gray-900 border-b border-gray-800"
    >
      {/* --- Left side: Logo --- */}
      <div className="flex items-center space-x-3">
        <img
          src="/gdi_logo.jpeg"
          alt="Grain Data Intelligence Logo"
          className="h-10 w-auto rounded-md"
        />
        <span className="text-xl font-semibold text-gdiGold tracking-wide">
          Grain Data Intelligence
        </span>
      </div>

      {/* --- Middle: Navigation Links --- */}
      <ul className="flex space-x-8 text-gray-300">
        {[
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
          { name: "Data Portal", path: "/data-portal" },
          { name: "Pricing", path: "/pricing" },
          { name: "Contact", path: "/contact" },
        ].map((link) => (
          <li key={link.path}>
            <NavLink
              to={link.path}
              className={({ isActive }) =>
                isActive
                  ? "text-gdiGold border-b-2 border-gdiGold pb-1 transition-colors"
                  : "hover:text-gdiGold transition-colors"
              }
            >
              {link.name}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* --- Right side: Login / Signup --- */}
      <div className="flex items-center space-x-4">
        <button className="px-4 py-1 text-sm font-medium text-gray-200 border border-gray-700 rounded-md hover:border-gdiGold hover:text-gdiGold transition-colors">
          Log In
        </button>
        <button className="px-4 py-1 text-sm font-medium text-gray-900 bg-gdiGold rounded-md hover:bg-yellow-500 transition-colors">
          Sign Up
        </button>
      </div>
    </motion.nav>
  );
}
