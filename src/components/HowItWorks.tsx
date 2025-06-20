import React from "react";
import { BookmarkPlus, Database, Search, BrainCircuit } from "lucide-react";

const HowItWorks: React.FC = () => {
  return (
    <section id="how-it-works" className="section bg-primary-900/30 glass">
      <div className="text-center mb-16">
        <h2 className="heading-2 mb-4">How BookmarkAI Works</h2>
        <p className="text-white/90 text-xl max-w-3xl mx-auto">
          A seamless, intelligent bookmarking experience powered by vector
          embeddings
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="relative">
          {/* Connection lines */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 -translate-x-1/2 hidden md:block"></div>

          {steps.map((step, index) => (
            <div
              key={index}
              className={`relative z-10 mb-16 last:mb-0 ${
                index % 2 === 0
                  ? "md:pr-8 lg:pr-16 md:text-right"
                  : "md:pl-8 lg:pl-16 md:ml-auto"
              }`}
              style={{
                animationDelay: `${index * 0.2}s`,
              }}
            >
              <div
                className={`flex items-center gap-4 mb-4 ${
                  index % 2 === 0
                    ? "md:flex-row-reverse md:justify-start"
                    : "md:flex-row md:justify-start"
                }`}
              >
                <div
                  className="w-12 h-12 rounded-full glass flex items-center justify-center
                  flex-shrink-0 border-2 border-white/20"
                >
                  {step.icon}
                </div>
                <h3 className="text-white text-2xl font-semibold">
                  {step.title}
                </h3>
              </div>

              <div
                className={`glass-card ${index % 2 === 0 ? "md:ml-auto" : "md:mr-auto"} md:max-w-md`}
              >
                <p className="text-white/90">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const steps = [
  {
    icon: <BookmarkPlus className="w-6 h-6 text-white" />,
    title: "Save Bookmarks",
    description:
      "Click the BookmarkAI icon or highlight text and use the context menu to save any webpage or specific content to your collection.",
  },
  {
    icon: <Database className="w-6 h-6 text-white" />,
    title: "Vector Indexing",
    description:
      "BookmarkAI processes your saved content, creating vector embeddings that capture the semantic meaning behind your bookmarks.",
  },
  {
    icon: <BrainCircuit className="w-6 h-6 text-white" />,
    title: "Intelligent Matching",
    description:
      "As you browse, the extension analyzes the current page and compares it with your vector database to find relevant bookmarks.",
  },
  {
    icon: <Search className="w-6 h-6 text-white" />,
    title: "Contextual Retrieval",
    description:
      "Highlight any text on a webpage to search your bookmarks semantically, or receive automatic suggestions based on page content.",
  },
];

export default HowItWorks;
