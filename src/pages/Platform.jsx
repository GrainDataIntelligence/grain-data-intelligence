import React from "react";
import { NavLink, Outlet } from "react-router-dom";

export default function Platform() {
  const subLinkClasses =
    "text-gray-300 hover:text-yellow-400 transition-colors duration-300 px-2 py-1 text-sm";
  const activeSubLink =
    "text-yellow-400 border-b-2 border-yellow-400 font-semibold";

  return (
    <div className="text-gray-100 bg-gray-900 min-h-screen">
      {/* Platform Section Header */}
      <div className="px-6 pt-6 pb-2 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-yellow-400">Platform</h1>
        <p className="text-sm text-gray-400 mt-1">
          Select a tool below to explore analytics, deliveries, or market models.
        </p>
      </div>

      {/* Secondary Navigation Bar */}
      <div className="flex space-x-6 px-6 py-3 border-b border-gray-700 bg-gray-800">
        <NavLink
          to="/platform/deliveries"
          className={({ isActive }) =>
            isActive ? `${subLinkClasses} ${activeSubLink}` : subLinkClasses
          }
        >
          Deliveries Hub
        </NavLink>

        <NavLink
          to="/platform/supply-demand"
          className={({ isActive }) =>
            isActive ? `${subLinkClasses} ${activeSubLink}` : subLinkClasses
          }
        >
          S&D Hub
        </NavLink>

        <NavLink
          to="/platform/backtesting"
          className={({ isActive }) =>
            isActive ? `${subLinkClasses} ${activeSubLink}` : subLinkClasses
          }
        >
          Backtesting
        </NavLink>
      </div>

      {/* 👇 THIS PART IS CRITICAL — renders Deliveries/S&D/Backtesting */}
      <div className="p-6">
        <Outlet />
      </div>
    </div>
  );
}
