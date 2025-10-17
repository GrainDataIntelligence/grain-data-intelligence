export default function About() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center p-10">
      <h1 className="text-4xl font-bold text-gdiGold mb-6">About Grain Data Intelligence</h1>
      <p className="text-gray-300 text-center max-w-3xl mb-8">
        Grain Data Intelligence (GDI) was founded with a single mission: 
        to empower agricultural stakeholders with data clarity. 
        By combining analytics, seasonal tracking, and visualization, 
        GDI transforms South African grain market data into actionable intelligence.
      </p>
      <div className="bg-gray-900 p-6 rounded-lg max-w-2xl text-center">
        <h2 className="text-xl font-semibold text-gdiGold mb-2">Our Vision</h2>
        <p className="text-gray-400">
          To become South Africa’s leading platform for grain market intelligence — 
          bridging the gap between producers, traders, and analysts through data transparency.
        </p>
      </div>
    </div>
  );
}
