import { motion } from "framer-motion";

export default function Home() {
  const fadeIn = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeIn}
      className="flex flex-col items-center justify-center text-center flex-grow px-6 py-24"
    >
      <h1 className="text-5xl font-bold text-gdiGold mb-4">
        Grain Data Intelligence
      </h1>
      <p className="text-lg text-gray-400 max-w-2xl">
        Delivering data-driven insights into South Africa’s grain markets.  
        Analyze trends, explore SAFEX data, and gain clarity from years of historical analytics.
      </p>
    </motion.div>
  );
}
