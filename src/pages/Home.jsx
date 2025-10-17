export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold text-gdiGold mb-4 text-center">
        Welcome to Grain Data Intelligence
      </h1>
      <p className="text-lg text-gray-300 max-w-3xl text-center mb-8">
        Your analytics gateway to South Africa’s grain markets. 
        Explore data-driven insights, seasonal trends, and powerful tools 
        designed to empower producers, traders, and analysts alike.
      </p>
      <button className="bg-gdiGold text-gray-950 font-semibold px-6 py-3 rounded-lg hover:bg-yellow-500 transition">
        Explore Platform
      </button>
    </div>
  );
}
