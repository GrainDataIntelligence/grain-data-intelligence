export default function Pricing() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center py-16 px-4">
      <h1 className="text-4xl font-bold text-gdiGold mb-10">Pricing Plans</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
        {/* --- Free Demo --- */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg flex flex-col items-center p-8 hover:scale-105 transition-transform">
          <h2 className="text-2xl font-semibold mb-4">Free Demo</h2>
          <p className="text-4xl font-bold text-gdiGold mb-2">$0</p>
          <p className="text-sm text-gray-400 mb-6">
            Access to one commodity (e.g. white maize)
          </p>

          <ul className="text-gray-300 space-y-2 mb-6 text-center">
            <li>Basic Analytics</li>
            <li>1 Commodity Limit</li>
            <li>Delivery Reports</li>
            <li>Access to Seasonal Trends</li>
          </ul>

          <button className="w-full bg-gray-700 hover:bg-gdiGold hover:text-gray-900 text-sm font-semibold py-2 rounded transition-colors">
            Register for Free
          </button>
        </div>

        {/* --- Standard Plan --- */}
        <div className="bg-gray-900 border-2 border-gdiGold rounded-xl shadow-xl flex flex-col items-center p-8 hover:scale-105 transition-transform">
          <h2 className="text-2xl font-semibold mb-4 text-gdiGold">Standard</h2>
          <p className="text-4xl font-bold mb-2">$29</p>
          <p className="text-sm text-gray-400 mb-6">
            per month (VAT may apply)
          </p>

          <ul className="text-gray-300 space-y-2 mb-6 text-center">
            <li>All Commodities</li>
            <li>Portfolio Overview</li>
            <li>Backtesting Tools</li>
            <li>Seasonal & Delivery Data</li>
            <li>Basic Alerts</li>
          </ul>

          <button className="w-full bg-gdiGold text-gray-900 font-semibold py-2 rounded hover:bg-yellow-500 transition-colors">
            Choose Plan
          </button>
        </div>

        {/* --- Deluxe Plan --- */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-lg flex flex-col items-center p-8 hover:scale-105 transition-transform">
          <h2 className="text-2xl font-semibold mb-4">Deluxe</h2>
          <p className="text-4xl font-bold text-gdiGold mb-2">$59</p>
          <p className="text-sm text-gray-400 mb-6">
            per month (advanced analytics)
          </p>

          <ul className="text-gray-300 space-y-2 mb-6 text-center">
            <li>All Standard Features</li>
            <li>Advanced Backtesting</li>
            <li>Custom Strategy Builder</li>
            <li>Priority Support</li>
            <li>Early Feature Access</li>
          </ul>

          <button className="w-full bg-gray-700 hover:bg-gdiGold hover:text-gray-900 text-sm font-semibold py-2 rounded transition-colors">
            Upgrade to Deluxe
          </button>
        </div>
      </div>
    </div>
  );
}
