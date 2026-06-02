export default function Educational() {
  return (
    <div className="min-h-screen bg-slate-100 p-10 text-slate-900">
      <h1 className="mb-6 text-center text-4xl font-bold text-slate-950">Educational Resources</h1>
      <p className="mx-auto mb-12 max-w-3xl text-center text-slate-600">
        Learn more about the South African grain markets, trading strategies, and data analytics.
        Our educational center provides accessible insights for students to traders and anyone in between.
      </p>

      <div className="mx-auto max-w-3xl space-y-6">
        {[
          ["Getting Started with SAFEX", "A beginner-friendly introduction to South Africa's futures market structure and trading fundamentals."],
          ["Seasonal Price Analysis", "Explore how seasonal data patterns can guide planting and hedging decisions across key commodities."],
          ["Strategy Development", "Understand backtesting, risk control, and how to build robust market strategies using GDI tools."],
        ].map(([title, text]) => (
          <div key={title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-semibold text-slate-950">{title}</h2>
            <p className="text-slate-600">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
