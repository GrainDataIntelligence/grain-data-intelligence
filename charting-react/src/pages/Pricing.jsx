export default function Pricing() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-slate-100 p-10 text-slate-900">
      <h1 className="mb-6 text-center text-4xl font-bold text-slate-950">Pricing Plans</h1>
      <p className="mb-12 max-w-2xl text-center text-slate-600">
        Choose a plan that fits your needs. Start with a free demo or unlock full analytical
        capabilities with a premium subscription.
      </p>

      <div className="grid max-w-5xl gap-8 md:grid-cols-3">
        {[
          { name: "Free Demo", price: "R0", features: ["Limited access", "1 commodity", "Basic analytics"] },
          { name: "Standard", price: "R499/month", features: ["All commodities", "Seasonal tracking", "Analytics tools"] },
          { name: "Deluxe", price: "R799/month", features: ["Full data suite", "Backtesting", "Priority support"] },
        ].map((plan, idx) => (
          <div key={idx} className="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
            <h2 className="mb-2 text-2xl font-semibold text-slate-950">{plan.name}</h2>
            <p className="mb-4 text-3xl font-bold">{plan.price}</p>
            <ul className="mb-6 space-y-2 text-slate-600">
              {plan.features.map((feature) => (
                <li key={feature}>- {feature}</li>
              ))}
            </ul>
            <button className="rounded-md bg-gdiGold px-6 py-2 font-semibold text-slate-950 transition hover:bg-yellow-500">
              Select
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
