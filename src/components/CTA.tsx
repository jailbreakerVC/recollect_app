import React from 'react';
import { Chrome, BookmarkPlus } from 'lucide-react';

const CTA: React.FC = () => {
  return (
    <section id="download" className="section">
      <div className="glass-card max-w-4xl mx-auto p-10 relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 text-center space-y-8">
          <h2 className="heading-2 mb-4">
            Transform Your Bookmarking Experience
          </h2>

          <p className="text-white/90 text-xl max-w-2xl mx-auto">
            Try Recollect today and experience the future of intelligent bookmark management
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
            <a
              href="#"
              className="glass-button bg-white text-primary-700 hover:bg-white/90 flex items-center justify-center gap-2"
            >
              <Chrome className="w-5 h-5" />
              Add to Chrome
            </a>

            <a
              href="#"
              className="glass-button bg-primary-600 text-white hover:bg-primary-700 flex items-center justify-center gap-2"
            >
              <BookmarkPlus className="w-5 h-5" />
              Learn More
            </a>
          </div>

          <div className="flex justify-center gap-8 pt-4">
            <div className="text-center">
              <div className="text-white font-bold text-3xl">10,000+</div>
              <div className="text-white/70 text-sm">Active Users (that's a lie)</div>
            </div>

            <div className="text-center">
              <div className="text-white font-bold text-3xl">4.8/5</div>
              <div className="text-white/70 text-sm">User Rating (by who?)</div>
            </div>

            <div className="text-center">
              <div className="text-white font-bold text-3xl">Free</div>
              <div className="text-white/70 text-sm">Forever (and OSS too!)</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
