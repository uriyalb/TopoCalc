import React from "react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function ResultCard({ title, value, subtitle, extra }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="mt-4 bg-lime-900 text-lime-100 border-4 border-black shadow-[8px_8px_0px_#000] p-6">
        <div className="text-center">
          <h3 className="text-lg font-bold mb-2 text-lime-100 uppercase tracking-wide">
            {title}
          </h3>
          <p className="text-4xl font-black mb-2">{value}</p>
          <p className="text-lime-300 text-sm">{subtitle}</p>
          {extra && <p className="text-lime-300 text-sm mt-2">{extra}</p>}
        </div>
      </Card>
    </motion.div>
  );
}