export default function About() {
  return (
    <div className="min-h-screen bg-slate-100 p-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-4xl font-bold text-slate-950">About Grain Data Intelligence</h1>
        <p className="mb-8 max-w-3xl text-slate-600 leading-7">
          Grain Data Intelligence (GDI) was founded with a single mission: to empower
          agricultural stakeholders with data clarity. By combining analytics, seasonal
          tracking, and visualization, GDI transforms South African grain market data into
          actionable intelligence.
        </p>
        <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-2 text-xl font-semibold text-slate-950">Our Vision</h2>
          <p className="text-slate-600 leading-7">
            To become South Africa's leading platform for grain market intelligence,
            bridging the gap between producers, traders, and analysts through data
            transparency.
          </p>
        </div>
      </div>
    </div>
  );
}
