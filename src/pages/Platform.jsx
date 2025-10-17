export default function Platform() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-10">
      <h1 className="text-4xl font-bold text-gdiGold mb-6 text-center">Our Platform</h1>
      <p className="text-gray-300 text-center mb-12 max-w-3xl mx-auto">
        The Grain Data Intelligence platform brings together years of market data and 
        analytical capability. Discover tools that transform raw data into actionable insights.
      </p>

      <div className="grid md:grid-cols-3 gap-8">
        {[
          { title: "Market Analytics", desc: "Analyze real-time and historical SAFEX data to identify seasonal opportunities." },
          { title: "Seasonal Tracking", desc: "Monitor seasonal price movements and cumulative delivery patterns across commodities." },
          { title: "Backtesting Tools", desc: "Simulate strategies and test ideas using historical market performance." },
        ].map((card, idx) => (
          <div key={idx} className="bg-gray-900 p-6 rounded-lg shadow-md hover:shadow-lg transition">
            <h2 className="text-xl font-semibold text-gdiGold mb-3">{card.title}</h2>
            <p className="text-gray-400">{card.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
