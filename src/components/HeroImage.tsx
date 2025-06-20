import React from "react";

const HeroImage: React.FC = () => {
  return (
    <div className="relative mx-auto max-w-lg">
      <div className="glass-card rounded-2xl overflow-hidden border-2 border-gray-700/30">
        <div className="bg-gray-900/70 p-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div className="glass-card text-white/80 text-xs py-1 px-2 rounded-md flex-1 text-center">
            research-paper.com/artificial-intelligence
          </div>
        </div>

        <div className="p-8 bg-gray-900/50">
          <div className="h-64 overflow-y-auto rounded-lg relative font-serif text-white/90 leading-relaxed space-y-4">
            <h2 className="text-2xl mb-4 text-white">
              The Evolution of AI Systems
            </h2>

            <p>
              Recent advances in{" "}
              <span className="bg-primary-500/30 px-1 rounded cursor-pointer">
                artificial intelligence
              </span>{" "}
              have revolutionized how we process and understand information. The
              integration of{" "}
              <span className="bg-primary-500/30 px-1 rounded cursor-pointer">
                neural networks
              </span>{" "}
              with traditional computing systems has opened new possibilities.
            </p>

            <p>
              One of the most significant breakthroughs has been in the field of{" "}
              <span className="bg-primary-500/30 px-1 rounded cursor-pointer">
                vector databases
              </span>
              , which enable efficient storage and retrieval of semantic
              information. These systems can understand context and
              relationships between different pieces of data.
            </p>

            <p>
              The application of{" "}
              <span className="bg-primary-500/30 px-1 rounded cursor-pointer">
                machine learning
              </span>{" "}
              in everyday tools has made technology more accessible and
              intuitive for users. From smart assistants to intelligent
              bookmarking systems, AI continues to enhance our digital
              experience.
            </p>
          </div>
        </div>
      </div>

      {/* Floating card 1 */}
      <div
        className="absolute -right-8 -top-12 glass-card w-64 transform rotate-6 animate-float bg-gray-900/30"
        style={{ animationDelay: "1s" }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full glass flex items-center justify-center flex-shrink-0 bg-primary-900/50">
            <BookmarkIcon size={16} />
          </div>
          <div>
            <h4 className="text-white font-medium">Neural Networks Guide</h4>
            <p className="text-white/70 text-sm mt-1">Saved 2 days ago</p>
          </div>
        </div>
      </div>

      {/* Floating card 2 */}
      <div
        className="absolute -left-12 -bottom-8 glass-card w-60 transform -rotate-3 animate-float bg-gray-900/30"
        style={{ animationDelay: "2s" }}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full glass flex items-center justify-center flex-shrink-0 bg-primary-900/50">
            <BookmarkIcon size={16} />
          </div>
          <div>
            <h4 className="text-white font-medium">AI Systems Overview</h4>
            <p className="text-white/70 text-sm mt-1">Saved last week</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const BookmarkIcon = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="text-white"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
  </svg>
);

export default HeroImage;
