# 🔖 Recollect

> **Transform your bookmarks into an intelligent discovery engine**

Recollect is a sophisticated bookmark management system that combines the power of Chrome extensions with AI-driven semantic search. Never lose track of that important article, tutorial, or resource again.

![Recollect Banner](static/Recollect_logo.png)

## ✨ Features

### 🎯 **Smart Context Search**
- **Right-click Search**: Select any text on a webpage and instantly find related bookmarks
- **Automatic Page Analysis**: Get intelligent bookmark suggestions based on the content you're viewing
- **Semantic Understanding**: AI-powered search that understands meaning, not just keywords

### 🔄 **Seamless Synchronization**
- **Chrome Integration**: Sync your existing Chrome bookmarks with one click
- **Real-time Updates**: Changes in Chrome automatically reflect in your dashboard
- **Cross-device Access**: Access your bookmarks anywhere through the web interface

### 🧠 **AI-Powered Intelligence**
- **Vector Embeddings**: Advanced semantic search using OpenAI embeddings
- **Contextual Suggestions**: Smart recommendations based on page content and browsing patterns
- **Fallback Search**: Multiple search algorithms ensure you always find what you're looking for

### 🎨 **Beautiful Interface**
- **Modern Dark Theme**: Professional, eye-friendly design inspired by Notion and Asana
- **Responsive Design**: Perfect experience across desktop, tablet, and mobile
- **Intuitive Navigation**: Clean, minimal interface that gets out of your way

## 🛠️ Technology Stack

### **Frontend**
- **React 18** with TypeScript for type-safe development
- **Tailwind CSS** for beautiful, responsive styling
- **Vite** for lightning-fast development and building
- **Lucide React** for consistent, beautiful icons

### **Backend & Database**
- **Supabase** for PostgreSQL database with real-time capabilities
- **pgvector** extension for semantic search and vector operations
- **Row Level Security (RLS)** for secure data isolation

### **Chrome Extension**
- **Manifest V3** for modern Chrome extension standards
- **Content Scripts** for seamless web page integration
- **Background Service Worker** for efficient bookmark management

### **Authentication**
- **Google OAuth 2.0** for secure, passwordless authentication
- **JWT tokens** with automatic expiry and refresh
- **Session management** with secure local storage

### **AI & Search**
- **OpenAI Embeddings** for semantic understanding
- **Vector similarity search** for intelligent bookmark matching
- **Trigram search** fallback for text-based queries
- **Multi-layered search** with graceful degradation

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Chrome browser
- Supabase account
- OpenAI API key (optional, for enhanced semantic search)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/recollect.git
   cd recollect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase and Google OAuth credentials
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Install the Chrome extension**
   - Follow the detailed guide in [installation.md](installation.md)

## 📖 How It Works

### 1. **Save & Sync**
Import your existing Chrome bookmarks or add new ones through the web interface. Everything stays synchronized automatically.

### 2. **Browse & Discover**
As you browse the web, Recollect analyzes page content and suggests relevant bookmarks from your collection.

### 3. **Search & Find**
Use the context menu to search for bookmarks related to any text you select, or use the powerful search interface in the web app.

### 4. **Organize & Manage**
Keep your bookmarks organized with folders, tags, and intelligent categorization.

## 🎯 Use Cases

- **Researchers**: Quickly find related papers, articles, and resources
- **Developers**: Locate documentation, tutorials, and code examples
- **Students**: Organize study materials and reference sources
- **Content Creators**: Manage inspiration and reference materials
- **Professionals**: Keep track of industry resources and tools

## 🔧 Development

### Project Structure
```
recollect/
├── src/                    # React application source
│   ├── components/         # Reusable UI components
│   ├── services/          # API and business logic
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
├── public/                # Chrome extension files
│   ├── manifest.json      # Extension configuration
│   ├── background.js      # Service worker
│   ├── content.js         # Content script
│   └── popup.html         # Extension popup
├── supabase/              # Database migrations
└── docs/                  # Documentation
```

### Key Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for embedding technology
- **Supabase** for the amazing backend platform
- **Chrome Extensions Team** for the robust extension APIs
- **React Team** for the incredible framework

## 📞 Support

- 📧 **Email**: support@recollect.app
- 🐛 **Issues**: [GitHub Issues](https://github.com/your-username/recollect/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/your-username/recollect/discussions)

---

<div align="center">

**Made with ❤️ by the Recollect Team**

[Website](https://recollect.app) • [Documentation](https://docs.recollect.app) • [Chrome Extension](https://chrome.google.com/webstore/detail/recollect)

</div>