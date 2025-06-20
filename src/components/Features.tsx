import React from "react";
import { BookmarkPlus, Database, Search, ArrowRightLeft } from "lucide-react";

const Features: React.FC = () => {
  return (
    <section id="features" className="section">
      <div className="text-center mb-16">
        <h2 className="heading-2 mb-4">How It Works</h2>
        <p className="text-white/90 text-xl max-w-3xl mx-auto">
          A seamless experience that transforms how you save and retrieve
          information
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        {features.map((feature, index) => (
          <div key={index} className="relative pl-8 pb-12 last:pb-0">
            <div className="timeline-dot absolute left-0 top-2"></div>
            {index !== features.length - 1 && (
              <div className="timeline-line"></div>
            )}

            <div className="glass-card bg-gray-900/40 border-secondary-accent-500/20 ml-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center bg-secondary-accent-500/20 text-secondary-accent-300 p-2.5">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-white/80">{feature.description}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

const features = [
  {
    icon: <BookmarkPlus className="w-full h-full" />,
    title: "Save with Context",
    description:
      "Bookmark any webpage or highlight specific text. Recollect automatically captures and indexes the content for intelligent retrieval.",
  },
  {
    icon: <Database className="w-full h-full" />,
    title: "Smart Organization",
    description:
      "Your bookmarks are automatically categorized and tagged based on content, making them easy to find when you need them.",
  },
  {
    icon: <Search className="w-full h-full" />,
    title: "Highlight to Search",
    description:
      "Select any text on a webpage to instantly find related bookmarks from your collection.",
  },
  {
    icon: <ArrowRightLeft className="w-full h-full" />,
    title: "Contextual Suggestions",
    description:
      "As you browse, Recollect suggests relevant bookmarks based on the current page content, helping you rediscover saved information.",
  },
];

export default Features;