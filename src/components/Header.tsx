import React, { useState, useEffect } from "react";
import { BookmarkPlus, Menu, X } from "lucide-react";

const Header: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-gray-900/50 backdrop-blur-lg py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-4 flex justify-between items-center">
        <a
          href="#"
          className="flex items-center gap-2 text-white font-brand font-semibold text-2xl"
        >
          <img
            src="/Recollect_logo.png"
            alt="Bookmark icon"
            className="h-10 w-10 invert"
          />

          <span>Recollect</span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-white/90 hover:text-white transition-colors"
          >
            Features
          </a>
          <a
            href="#demo"
            className="text-white/90 hover:text-white transition-colors"
          >
            Demo
          </a>
          <a
            href="#faq"
            className="text-white/90 hover:text-white transition-colors"
          >
            FAQ
          </a>
          <a
            href="https://github.com/jailbreakerVC/recollect_app/blob/main/installation.md"
            className="glass-button bg-white/10 text-white hover:bg-white/20"
          >
            Install Extension
          </a>
        </nav>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden text-white p-2"
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-gray-900/30 backdrop-blur-lg mt-3 py-4 px-4 animate-fade-in">
          <nav className="flex flex-col gap-4">
            <a
              href="#features"
              className="text-white/90 hover:text-white transition-colors py-2"
              onClick={toggleMenu}
            >
              Features
            </a>
            <a
              href="#demo"
              className="text-white/90 hover:text-white transition-colors py-2"
              onClick={toggleMenu}
            >
              Demo
            </a>
            <a
              href="#faq"
              className="text-white/90 hover:text-white transition-colors py-2"
              onClick={toggleMenu}
            >
              FAQ
            </a>
            <a
              href="#download"
              className="glass-button bg-white/10 text-white text-center"
              onClick={toggleMenu}
            >
              Install Extension
            </a>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
