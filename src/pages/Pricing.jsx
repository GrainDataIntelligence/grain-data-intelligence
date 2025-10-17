export default function Pricing() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-10 flex flex-col items-center">
      <h1 className="text-4xl font-bold text-gdiGold mb-6 text-center">Pricing Plans</h1>
      <p className="text-gray-300 text-center mb-12 max-w-2xl">
        Choose a plan that fits your needs. Start with a free demo or unlock full analytical capabilities with a premium subscription.
      </p>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl">
        {[
          { name: "Free Demo", price: "R0", features: ["Limited access", "1 commodity", "Basic analytics"] },
          { name: "Standard", price: "R499/month", features: ["All commodities", "Seasonal tracking", "Analytics tools"] },
          { name: "Deluxe", price: "R799/month", features: ["Full data suite", "Backtesting", "Priority support"] },
        ].map((plan, idx) => (
          <div key={idx} className="bg-gray-900 p-6 rounded-lg shadow-md hover:shadow-lg transition flex flex-col items-center">
            <h2 className="text-2xl font-semibold text-gdiGold mb-2">{plan.name}</h2>
            <p className="text-3xl font-bold mb-4">{plan.price}</p>
            <ul className="text-gray-400 space-y-2 mb-6">
              {plan.features.map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
            <button className="bg-gdiGold text-gray-950 font-semibold px-6 py-2 rounded-lg hover:bg-yellow-500 transition">
              Select
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
