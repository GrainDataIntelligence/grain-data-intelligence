export default function DemoTrading() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-gdiGold mb-4">Demo Trading Portal</h1>
      <p className="text-gray-300 text-center max-w-2xl mb-8">
        Experience the power of data-driven trading in a safe, simulated environment. 
        Practice strategies, explore analytics, and understand market dynamics risk-free.
      </p>
      <button className="bg-gdiGold text-gray-950 font-semibold px-6 py-3 rounded-lg hover:bg-yellow-500 transition">
        Launch Demo
      </button>
    </div>
  );
}
