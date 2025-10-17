export default function Educational() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-10">
      <h1 className="text-4xl font-bold text-gdiGold mb-6 text-center">Educational Resources</h1>
      <p className="text-gray-300 text-center mb-12 max-w-3xl mx-auto">
        Learn more about the South African grain markets, trading strategies, and data analytics.
        Our educational center provides accessible insights for students to traders and anyone in between.
      </p>

      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-gdiGold mb-2">Getting Started with SAFEX</h2>
          <p className="text-gray-400">A beginner-friendly introduction to South Africa’s futures market structure and trading fundamentals.</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-gdiGold mb-2">Seasonal Price Analysis</h2>
          <p className="text-gray-400">Explore how seasonal data patterns can guide planting and hedging decisions across key commodities.</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold text-gdiGold mb-2">Strategy Development</h2>
          <p className="text-gray-400">Understand backtesting, risk control, and how to build robust market strategies using GDI tools.</p>
        </div>
      </div>
    </div>
  );
}
