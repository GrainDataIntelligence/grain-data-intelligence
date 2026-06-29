export default function Home() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <section className="mx-auto flex min-h-[calc(100vh-72px)] max-w-7xl flex-col justify-center px-6 py-16">
        <div className="max-w-4xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Grain Data Intelligence
          </p>
          <h1 className="mb-5 text-5xl font-bold text-slate-950">
            South African grain market intelligence, built for real decisions.
          </h1>
          <p className="mb-8 max-w-3xl text-lg leading-8 text-slate-600">
            Track fundamentals, compare seasonal moves, test market ideas, and build
            sharper context around South Africa's grain markets from one clean workspace.
          </p>
          <button className="rounded-md bg-gdiGold px-6 py-3 font-semibold text-slate-950 transition hover:bg-yellow-500">
            Explore Platform
          </button>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            ["Fundamentals", "Deliveries, imports, exports, and market-year comparisons."],
            ["Charting", "Seasonal charts, long-term price history, and backtesting."],
            ["Learning", "Educational tools for producers, traders, analysts, and students."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-bold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
