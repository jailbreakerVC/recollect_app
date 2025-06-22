import React from "react";
import { ArrowRight } from "lucide-react";
import HeroImage from "./HeroImage";
import GoogleSignInButton from "./GoogleSignInButton";

const Hero: React.FC = () => {
  return (
    <>
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <h1 className="heading-1 font-mono">
              <span className="block">Remember Everything</span>
              <span className="block text-accent-300">With Recollect</span>
            </h1>

            <p className="text-xl text-white/90 leading-relaxed">
              Remember that frustrating moment when you know you saved something
              important, but can't find it when you need it? Recollect turns
              your bookmarks into an intelligent discovery engine. It analyzes
              what you're browsing and instantly surfaces your most relevant
              saved bookmarks—before you even ask.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <GoogleSignInButton />
              <a
                href="#demo"
                className="glass-button text-white flex items-center justify-center gap-2"
              >
                Learn More
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="relative animate-float">
            <HeroImage />
          </div>
        </div>
      </section>

      <section className="text-center max-w-5xl mx-auto px-4 pb-0">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-mono mb-8 text-white">
          We're not trying to reinvent the bookmark,
          <br className="hidden sm:block" />
          we're working on making existing systems smarter.
        </h2>
        <p className="text-lg sm:text-xl text-white/90 mb-6">
          Simply import your existing chrome bookmarks to get started.
        </p>
        <p className="text-base sm:text-lg text-accent-300 font-mono tracking-wide">
          #ChangeTheWayYouWeb
        </p>
      </section>
    </>
  );
};

export default Hero;
