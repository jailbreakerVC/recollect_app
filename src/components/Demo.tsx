import React, { useState } from "react";
import { Search, Link, BookmarkCheck } from "lucide-react";

const Demo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<
    "highlight" | "browse" | "organize"
  >("highlight");

  return (
    <section id="demo" className="section">
      <div className="text-center mb-16">
        <h2 className="heading-2 mb-4">See Recollect in Action</h2>
        <p className="text-white/90 text-xl max-w-3xl mx-auto">
          Experience how Recollect transforms your browsing and research
        </p>
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`glass-button flex items-center gap-2 ${
                activeTab === tab.id
                  ? "bg-accent-500 text-white hover:bg-accent-500"
                  : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white/90"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Demo Content */}
        <div className="glass-card p-0 overflow-hidden">
          <div className="bg-gray-900 p-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="bg-gray-800 text-white/80 text-xs py-1 px-2 rounded-md flex-1 text-center">
              {activeTab === "highlight" &&
                "designsystems.com/what-is-a-design-system"}
              {activeTab === "browse" &&
                "blog.vector-db.com/understanding-embeddings"}
              {activeTab === "organize" && "recollect-dashboard.com"}
            </div>
          </div>

          <div className="bg-white p-8">
            {activeTab === "highlight" && <HighlightDemo />}
            {activeTab === "browse" && <BrowseDemo />}
            {activeTab === "organize" && <OrganizeDemo />}
          </div>
        </div>
      </div>
    </section>
  );
};

const tabs = [
  {
    id: "highlight" as const,
    label: "Highlight Search",
    icon: <Search className="w-4 h-4" />,
  },
  {
    id: "browse" as const,
    label: "Smart Browsing",
    icon: <Link className="w-4 h-4" />,
  },
  {
    id: "organize" as const,
    label: "Organize Bookmarks",
    icon: <BookmarkCheck className="w-4 h-4" />,
  },
];

const HighlightDemo: React.FC = () => {
  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-8 h-8 rounded-full bg-blue-500"></div>
        <div>
          <h3 className="font-semibold">Design Systems Weekly</h3>
          <p className="text-gray-600 text-sm">Published on March 15, 2024</p>
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-6">What is a design system?</h1>

      <p className="text-gray-800 leading-relaxed text-lg">
        Defining what a{" "}
        <span className="bg-yellow-500/30 px-1 rounded cursor-pointer">
          Design System
        </span>{" "}
        is and what it means for an organization can be tricky. In this post,
        we'll take the conversation of Design Systems past style guides and
        component libraries and get into{" "}
        <span className="bg-green-500/30 px-1 rounded cursor-pointer">
          breaking down silos between development and design
        </span>
        .
      </p>

      <div className="bg-gray-100 rounded-xl p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Related Bookmarks</h3>
          <span className="text-gray-600 text-sm">3 matches found</span>
        </div>

        <div className="space-y-4">
          {[
            {
              title: "Building a Scalable Design System",
              url: "designsystem.guide/scalable-systems",
              date: "2 weeks ago",
              relevance: 95,
            },
            {
              title: "Design Systems at Scale",
              url: "enterprise-design.com/systems",
              date: "1 month ago",
              relevance: 88,
            },
            {
              title: "Component Library Best Practices",
              url: "ui-patterns.net/components",
              date: "2 months ago",
              relevance: 82,
            },
          ].map((bookmark, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-4 shadow-sm hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {bookmark.title}
                  </h4>
                  <p className="text-primary-600 text-sm mt-1">
                    {bookmark.url}
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    Saved {bookmark.date}
                  </p>
                </div>
                <span className="text-xs bg-green-100 text-primary-700 px-2 py-1 rounded">
                  {bookmark.relevance}% match
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const BrowseDemo: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-gray-900">
      <div className="md:col-span-2 space-y-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
            VD
          </div>
          <div>
            <h3 className="font-semibold">Vector Database Guide</h3>
            <p className="text-gray-600 text-sm">By Sarah Chen • 10 min read</p>
          </div>
        </div>

        <h1 className="text-3xl font-bold">Understanding Vector Embeddings</h1>

        <div className="prose">
          <p className="text-gray-800 leading-relaxed text-lg">
            Vector embeddings are numerical representations of data that capture
            semantic meaning. In the context of machine learning and AI, these
            embeddings enable powerful similarity searches and semantic
            understanding.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">
            Key Concepts
          </h2>

          <ul className="list-disc list-inside space-y-2 text-gray-800">
            <li>Dimensional representation of data</li>
            <li>Semantic similarity measurements</li>
            <li>Efficient nearest neighbor search</li>
            <li>Applications in NLP and image processing</li>
          </ul>
        </div>
      </div>

      <div className="md:col-span-1">
        <div className="bg-gray-100 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Similar Content</h3>
            <span className="text-gray-600 text-sm">Auto-detected</span>
          </div>

          <div className="space-y-4">
            {[
              {
                title: "Vector Search Implementation",
                url: "vector-search.dev/guide",
                relevance: 94,
                type: "Tutorial",
              },
              {
                title: "Embeddings in Production",
                url: "mlops.tech/embeddings",
                relevance: 89,
                type: "Article",
              },
              {
                title: "Vector DB Comparison",
                url: "db-weekly.com/vectors",
                relevance: 85,
                type: "Review",
              },
            ].map((content, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-4 shadow-sm hover:bg-gray-50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {content.title}
                    </h4>
                    <p className="text-primary-600 text-sm mt-1">
                      {content.url}
                    </p>
                    <span className="text-xs text-gray-600 px-2 py-0.5 rounded-full border border-gray-200 mt-2 inline-block">
                      {content.type}
                    </span>
                  </div>
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                    {content.relevance}% match
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const OrganizeDemo: React.FC = () => {
  return (
    <div className="space-y-6 text-gray-900">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Bookmarks</h1>
          <p className="text-gray-600">
            458 saved items • Last synced 2 minutes ago
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        {["All", "Design", "Development", "AI/ML", "Articles", "Tutorials"].map(
          (category, index) => (
            <button
              key={index}
              className={`rounded-full px-4 py-1.5 text-sm ${
                index === 0
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {category}
            </button>
          ),
        )}
      </div>

      <div className="bg-gray-100 rounded-xl p-6">
        <div className="bg-white rounded-lg mb-6 flex items-center gap-2 px-4 py-2 border border-gray-200">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search bookmarks..."
            className="bg-transparent border-none outline-none w-full text-gray-900"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: "Modern Design System Architecture",
              url: "design-weekly.com/systems",
              category: "Design",
              date: "2 days ago",
              tags: ["design-systems", "architecture"],
            },
            {
              title: "Vector Embeddings Guide",
              url: "ai-handbook.dev/embeddings",
              category: "AI/ML",
              date: "1 week ago",
              tags: ["machine-learning", "vectors"],
            },
            {
              title: "Component Library Setup",
              url: "frontend-masters.io/components",
              category: "Development",
              date: "2 weeks ago",
              tags: ["react", "components"],
            },
            {
              title: "Research Methods in AI",
              url: "ai-research.org/methods",
              category: "AI/ML",
              date: "3 weeks ago",
              tags: ["research", "methodology"],
            },
          ].map((bookmark, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-4 shadow-sm hover:bg-gray-50"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium text-gray-900">{bookmark.title}</h4>
                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                  {bookmark.category}
                </span>
              </div>
              <p className="text-primary-600 text-sm">{bookmark.url}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {bookmark.tags.map((tag, tagIndex) => (
                  <span
                    key={tagIndex}
                    className="text-xs text-gray-600 px-2 py-0.5 rounded-full border border-gray-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <p className="text-gray-600 text-xs mt-3">
                Saved {bookmark.date}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Demo;
