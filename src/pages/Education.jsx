export default function Education() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 text-gray-100 font-sans px-6">
      <h1 className="text-4xl font-bold text-gdiGold mb-6">Education</h1>
      <p className="text-lg text-gray-300 max-w-2xl text-center mb-8">
        Welcome to the Grain Data Intelligence Education Portal — where data meets learning.
        Here we’ll share articles, tutorials, and insights to help you better understand 
        South African grain markets, data analytics, and futures trading.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <div className="bg-gray-900 p-6 rounded-2xl shadow-lg hover:shadow-gdiGold transition duration-300">
          <h2 className="text-xl font-semibold text-gdiGold mb-2">Getting Started</h2>
          <p className="text-gray-400">Learn the basics of SAFEX markets and agricultural data analytics.</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl shadow-lg hover:shadow-gdiGold transition duration-300">
          <h2 className="text-xl font-semibold text-gdiGold mb-2">Data Analytics</h2>
          <p className="text-gray-400">Explore techniques for analyzing seasonal patterns and delivery data.</p>
        </div>

        <div className="bg-gray-900 p-6 rounded-2xl shadow-lg hover:shadow-gdiGold transition duration-300">
          <h2 className="text-xl font-semibold text-gdiGold mb-2">Market Insights</h2>
          <p className="text-gray-400">Stay up to date with insights on trends shaping South Africa’s grain markets.</p>
        </div>
      </div>
    </div>
  );
}
