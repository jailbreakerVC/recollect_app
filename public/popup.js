// Chrome Extension Popup Script - Beautiful Dark Theme
class PopupManager {
  constructor() {
    this.isConnected = false;
    this.bookmarkCount = 0;
    this.elements = {};

    this.init();
  }

  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.loadStoredData();
    this.startConnectionMonitoring();
    this.loadSearchResults();
    this.handleAutoOpen();
  }

  handleAutoOpen() {
    // Check if popup was auto-opened due to search results
    chrome.storage.local.get(["lastSearchResults"], (result) => {
      const searchData = result.lastSearchResults;

      if (searchData && searchData.timestamp) {
        const timeSinceSearch = Date.now() - searchData.timestamp;

        // If search was recent (within 10 seconds), it was likely auto-opened
        if (timeSinceSearch < 10000) {
          // Clear the badge since user is now viewing results
          chrome.action.setBadgeText({ text: "" });

          // Highlight the search results section with a subtle animation
          if (
            this.elements.searchSection &&
            searchData.results &&
            searchData.results.length > 0
          ) {
            this.elements.searchSection.style.animation =
              "fadeIn 0.5s ease-in-out";
          }
        }
      }
    });
  }

  // Replace your cacheElements method with this debugged version

  cacheElements() {
    console.log("🔍 Caching DOM elements...");

    this.elements = {
      bookmarkCount: document.getElementById("bookmarkCount"),
      lastSync: document.getElementById("lastSync"),
      statusIndicator: document.getElementById("statusIndicator"),
      statusText: document.getElementById("statusText"),
      searchSection: document.getElementById("searchSection"),
      searchQuery: document.getElementById("searchQuery"),
      searchQueryText: document.getElementById("searchQueryText"),
      searchTitle: document.getElementById("searchTitle"),
      searchResults: document.getElementById("searchResults"),
      noResults: document.getElementById("noResults"),
      openWebAppBtn: document.getElementById("openWebAppBtn"),
    };

    // Debug: Check if all elements were found
    console.log("🔍 Cached elements:");
    Object.entries(this.elements).forEach(([key, element]) => {
      console.log(`🔍 ${key}:`, element ? "✅ Found" : "❌ NOT FOUND");
      if (!element) {
        console.error(`❌ Element with ID '${key}' not found in DOM`);
      }
    });

    // Check if searchResults element exists and is accessible
    if (this.elements.searchResults) {
      console.log("🔍 searchResults element details:");
      console.log("🔍 - Tag name:", this.elements.searchResults.tagName);
      console.log("🔍 - Class name:", this.elements.searchResults.className);
      console.log(
        "🔍 - Current innerHTML length:",
        this.elements.searchResults.innerHTML.length,
      );
    }
  }

  setupEventListeners() {
    this.elements.openWebAppBtn.addEventListener("click", () =>
      this.openWebApp(),
    );

    // Listen for storage changes (for real-time updates)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.lastSearchResults) {
        this.loadSearchResults();
      }
    });
  }

  // async loadSearchResults() {
  //   try {
  //     const response = await chrome.runtime.sendMessage({
  //       action: "getSearchResults",
  //     });

  //     if (response && response.success && response.searchData) {
  //       this.displaySearchResults(response.searchData);
  //     } else {
  //       this.showNoResults();
  //     }
  //   } catch (error) {
  //     this.showNoResults();
  //   }
  // }
  // Replace your loadSearchResults method with this debugged version

  async loadSearchResults() {
    try {
      console.log("🔍 Popup requesting search results...");

      const response = await chrome.runtime.sendMessage({
        action: "getSearchResults",
      });

      console.log("🔍 Popup received response:", response);
      console.log("🔍 Response type:", typeof response);
      console.log("🔍 Response keys:", Object.keys(response || {}));
      console.log("🔍 Response.success:", response?.success);
      console.log("🔍 Response.searchData:", response?.searchData);

      if (response && response.success && response.searchData) {
        console.log("✅ Valid search data found, calling displaySearchResults");
        this.displaySearchResults(response.searchData);
      } else {
        console.log("❌ No valid search data, showing no results");
        console.log("❌ Response success:", response?.success);
        console.log("❌ Response searchData:", response?.searchData);
        this.showNoResults();
      }
    } catch (error) {
      console.error("❌ Error loading search results:", error);
      this.showNoResults();
    }
  }

  // displaySearchResults(searchData) {
  //   const { results, query, searchType, timestamp } = searchData;

  //   if (!results || results.length === 0) {
  //     this.showNoResults();
  //     return;
  //   }

  //   // Show search query if available
  //   if (query) {
  //     this.elements.searchQueryText.textContent = query;
  //     this.elements.searchQuery.classList.remove('hidden');
  //   } else {
  //     this.elements.searchQuery.classList.add('hidden');
  //   }

  //   // Update title based on search type
  //   const searchTypeLabels = {
  //     keyword: '🔍 Keyword Search Results',
  //     context: '🤖 Related Bookmarks Found',
  //     manual: '📋 Search Results'
  //   };

  //   const titleText = searchTypeLabels[searchType] || '📋 Found bookmarks:';
  //   this.elements.searchTitle.innerHTML = `
  //     <span>${this.getSearchTypeIcon(searchType)}</span>
  //     <span>${titleText}</span>
  //   `;

  //   // Add timestamp info for recent searches
  //   const timeSinceSearch = Date.now() - timestamp;
  //   if (timeSinceSearch < 30000) { // Less than 30 seconds
  //     const timeText = timeSinceSearch < 1000 ? 'just now' : `${Math.round(timeSinceSearch / 1000)}s ago`;
  //     this.elements.searchTitle.innerHTML += ` <span style="color: rgba(255,255,255,0.5); font-size: 12px;">(${timeText})</span>`;
  //   }

  //   // Display results
  //   const resultsHtml = results.map((result, index) => `
  //     <div class="search-result" data-index="${index}" data-url="${this.escapeHtml(result.url)}">
  //       <div class="result-title">${this.escapeHtml(result.title || 'Untitled')}</div>
  //       <div class="result-url">${this.escapeHtml(this.truncateUrl(result.url))}</div>
  //       <div class="result-meta">
  //         <span class="result-type">${this.getSearchTypeLabel(result.search_type)}</span>
  //         <span class="result-score">${Math.round((result.similarity_score || 0.5) * 100)}%</span>
  //       </div>
  //     </div>
  //   `).join('');

  //   this.elements.searchResults.innerHTML = resultsHtml;
  //   this.elements.noResults.classList.add('hidden');

  //   // Add click handlers for opening bookmarks
  //   this.elements.searchResults.querySelectorAll('.search-result').forEach((element) => {
  //     element.addEventListener('click', (e) => {
  //       e.preventDefault();

  //       const url = element.dataset.url;
  //       if (url) {
  //         // Open in new tab
  //         chrome.tabs.create({ url: url });

  //         // Close popup after opening bookmark
  //         window.close();
  //       }
  //     });
  //   });

  //   // Add keyboard navigation
  //   this.setupKeyboardNavigation();
  // }
  // Add this debugging to your popup.js displaySearchResults method

  // Add this enhanced debugging to your displaySearchResults method

  displaySearchResults(searchData) {
    console.log("🔍 Popup displaySearchResults called with:", searchData);
    console.log("🔍 Search data type:", typeof searchData);
    console.log("🔍 Search data keys:", Object.keys(searchData || {}));

    const { results, query, searchType, timestamp } = searchData;

    console.log("🔍 Extracted results:", results);
    console.log("🔍 Results type:", typeof results);
    console.log("🔍 Results length:", results?.length);
    console.log("🔍 Query:", query);
    console.log("🔍 Search type:", searchType);

    if (!results || results.length === 0) {
      console.log("❌ No results found, showing no results message");
      this.showNoResults();
      return;
    }

    console.log("✅ Results found, proceeding to display");

    // Check DOM elements
    console.log("🔍 DOM elements check:");
    console.log("🔍 searchQueryText element:", this.elements.searchQueryText);
    console.log("🔍 searchQuery element:", this.elements.searchQuery);
    console.log("🔍 searchTitle element:", this.elements.searchTitle);
    console.log("🔍 searchResults element:", this.elements.searchResults);
    console.log("🔍 noResults element:", this.elements.noResults);

    // Show search query if available
    if (query) {
      console.log("🔍 Setting search query text to:", query);
      this.elements.searchQueryText.textContent = query;
      this.elements.searchQuery.classList.remove("hidden");
      console.log(
        "🔍 Search query element classes after removing hidden:",
        this.elements.searchQuery.className,
      );
    } else {
      this.elements.searchQuery.classList.add("hidden");
    }

    // Update title based on search type
    const searchTypeLabels = {
      keyword: "Keyword Search Results",
      context: "🤖 Related Bookmarks Found",
      manual: "📋 Search Results",
    };

    const titleText = searchTypeLabels[searchType] || "📋 Found bookmarks:";
    console.log("🔍 Setting title to:", titleText);

    this.elements.searchTitle.innerHTML = `
      <span>${this.getSearchTypeIcon(searchType)}</span>
      <span>${titleText}</span>
    `;

    console.log(
      "🔍 Title element after update:",
      this.elements.searchTitle.innerHTML,
    );

    // Add timestamp info for recent searches
    const timeSinceSearch = Date.now() - timestamp;
    if (timeSinceSearch < 30000) {
      // Less than 30 seconds
      const timeText =
        timeSinceSearch < 1000
          ? "just now"
          : `${Math.round(timeSinceSearch / 1000)}s ago`;
      this.elements.searchTitle.innerHTML += ` <span style="color: rgba(255,255,255,0.5); font-size: 12px;">(${timeText})</span>`;
    }

    // Generate results HTML
    console.log("🔍 Generating results HTML for", results.length, "results");

    const resultsHtml = results
      .map((result, index) => {
        console.log(`🔍 Processing result ${index}:`, result);

        const title = this.escapeHtml(result.title || "Untitled");
        const url = this.escapeHtml(result.url);
        const truncatedUrl = this.escapeHtml(this.truncateUrl(result.url));
        const typeLabel = this.getSearchTypeLabel(result.search_type);
        const score = Math.round((result.similarity_score || 0.5) * 100);

        console.log(`🔍 Result ${index} processed values:`, {
          title,
          url,
          truncatedUrl,
          typeLabel,
          score,
        });

        return `
        <div class="search-result" data-index="${index}" data-url="${url}">
          <div class="result-title">${title}</div>
          <div class="result-url">${truncatedUrl}</div>
          <div class="result-meta">
            <span class="result-type">${typeLabel}</span>
            <span class="result-score">${score}%</span>
          </div>
        </div>
      `;
      })
      .join("");

    console.log("🔍 Generated results HTML length:", resultsHtml.length);
    console.log(
      "🔍 Generated results HTML preview:",
      resultsHtml.substring(0, 200) + "...",
    );

    // Insert results into DOM
    console.log(
      "🔍 Inserting results into DOM element:",
      this.elements.searchResults,
    );
    this.elements.searchResults.innerHTML = resultsHtml;

    console.log(
      "🔍 Results element HTML after insertion:",
      this.elements.searchResults.innerHTML.substring(0, 200) + "...",
    );
    console.log(
      "🔍 Results element children count:",
      this.elements.searchResults.children.length,
    );

    // Hide no results message
    this.elements.noResults.classList.add("hidden");
    console.log(
      "🔍 No results element classes after hiding:",
      this.elements.noResults.className,
    );

    // Add click handlers for opening bookmarks
    console.log("🔍 Adding click handlers to results");
    this.elements.searchResults
      .querySelectorAll(".search-result")
      .forEach((element, index) => {
        console.log(`🔍 Adding click handler to result ${index}`);
        element.addEventListener("click", (e) => {
          e.preventDefault();

          const url = element.dataset.url;
          console.log("🔍 Result clicked, opening URL:", url);
          if (url) {
            // Open in new tab
            chrome.tabs.create({ url: url });

            // Close popup after opening bookmark
            window.close();
          }
        });
      });

    // Add keyboard navigation
    console.log("🔍 Setting up keyboard navigation");
    this.setupKeyboardNavigation();

    console.log("✅ displaySearchResults completed");
  }

  showNoResults() {
    this.elements.searchQuery.classList.add("hidden");
    this.elements.searchResults.innerHTML = "";
    this.elements.noResults.classList.remove("hidden");

    this.elements.searchTitle.innerHTML = `
      <span>🔍</span>
      <span>Ready to search</span>
    `;
  }

  setupKeyboardNavigation() {
    const results =
      this.elements.searchResults.querySelectorAll(".search-result");
    let selectedIndex = 0;

    // Highlight first result
    if (results.length > 0) {
      results[0].style.background = "rgba(100, 255, 218, 0.1)";
      results[0].style.borderColor = "rgba(100, 255, 218, 0.3)";
    }

    // Handle keyboard events
    document.addEventListener("keydown", (e) => {
      if (results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          // Remove highlight from current
          results[selectedIndex].style.background = "rgba(255, 255, 255, 0.05)";
          results[selectedIndex].style.borderColor = "rgba(255, 255, 255, 0.1)";

          selectedIndex = (selectedIndex + 1) % results.length;

          // Add highlight to new
          results[selectedIndex].style.background = "rgba(100, 255, 218, 0.1)";
          results[selectedIndex].style.borderColor = "rgba(100, 255, 218, 0.3)";
          results[selectedIndex].scrollIntoView({ block: "nearest" });
          break;

        case "ArrowUp":
          e.preventDefault();
          // Remove highlight from current
          results[selectedIndex].style.background = "rgba(255, 255, 255, 0.05)";
          results[selectedIndex].style.borderColor = "rgba(255, 255, 255, 0.1)";

          selectedIndex =
            selectedIndex === 0 ? results.length - 1 : selectedIndex - 1;

          // Add highlight to new
          results[selectedIndex].style.background = "rgba(100, 255, 218, 0.1)";
          results[selectedIndex].style.borderColor = "rgba(100, 255, 218, 0.3)";
          results[selectedIndex].scrollIntoView({ block: "nearest" });
          break;

        case "Enter":
          e.preventDefault();
          const selectedResult = results[selectedIndex];
          if (selectedResult) {
            const url = selectedResult.dataset.url;
            if (url) {
              chrome.tabs.create({ url: url });
              window.close();
            }
          }
          break;
      }
    });
  }

  getSearchTypeIcon(searchType) {
    switch (searchType) {
      case "keyword":
        return "🔍";
      case "context":
        return "🤖";
      case "manual":
        return "📋";
      default:
        return "📋";
    }
  }

  getSearchTypeLabel(searchType) {
    switch (searchType) {
      case "semantic":
        return "AI Match";
      case "trigram":
        return "Text Match";
      case "keyword":
        return "Keyword";
      case "context":
        return "Context";
      case "text_fallback":
        return "Simple Match";
      default:
        return "Match";
    }
  }

  truncateUrl(url, maxLength = 40) {
    if (!url) return "";
    if (url.length <= maxLength) return url;

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;

      if (domain.length + 3 >= maxLength) {
        return domain.substring(0, maxLength - 3) + "...";
      }

      const remainingLength = maxLength - domain.length - 3;
      const truncatedPath =
        path.length > remainingLength
          ? path.substring(0, remainingLength) + "..."
          : path;

      return domain + truncatedPath;
    } catch {
      return url.substring(0, maxLength) + "...";
    }
  }

  escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  updateStatus(connected, message) {
    this.isConnected = connected;
    this.elements.statusText.textContent = connected
      ? "Connected"
      : "Disconnected";

    // Update status indicator
    this.elements.statusIndicator.className = `status-indicator ${
      connected ? "status-connected" : "status-disconnected"
    }`;
  }

  updateBookmarkCount(count) {
    this.bookmarkCount = count;
    this.elements.bookmarkCount.textContent = count.toLocaleString();
  }

  updateLastSync() {
    const now = new Date();
    this.elements.lastSync.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    chrome.storage.local.set({
      lastSyncTime: now.toISOString(),
      lastBookmarkCount: this.bookmarkCount,
    });
  }

  loadStoredData() {
    chrome.storage.local.get(
      ["lastSyncTime", "lastBookmarkCount"],
      (result) => {
        if (result.lastSyncTime) {
          const lastSync = new Date(result.lastSyncTime);
          this.elements.lastSync.textContent = lastSync.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        if (result.lastBookmarkCount) {
          this.updateBookmarkCount(result.lastBookmarkCount);
        }
      },
    );
  }

  startConnectionMonitoring() {
    this.checkConnection();
    setInterval(() => this.checkConnection(), 3000);
  }

  async checkConnection() {
    try {
      const webAppUrls = [
        "http://localhost:*/*",
        "https://localhost:*/*",
        "https://*.netlify.app/*",
        "https://*.vercel.app/*",
      ];

      const tabs = await chrome.tabs.query({ url: webAppUrls });

      if (tabs && tabs.length > 0) {
        for (const tab of tabs) {
          const isResponsive = await this.testTabResponsiveness(tab);
          if (isResponsive) {
            this.updateStatus(true, "Connected");
            this.getBookmarkCount();
            return;
          }
        }

        this.updateStatus(false, "Not Responsive");
      } else {
        this.updateStatus(false, "Not Open");
      }
    } catch (error) {
      this.updateStatus(false, "Error");
    }
  }

  async testTabResponsiveness(tab) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "testConnection",
      });

      return response?.success && response?.responsive;
    } catch (error) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content.js"],
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "testConnection",
        });

        return response?.success && response?.responsive;
      } catch (injectionError) {
        return false;
      }
    }
  }

  getBookmarkCount() {
    chrome.bookmarks.getTree((bookmarkTree) => {
      if (chrome.runtime.lastError) {
        return;
      }

      const count = this.countBookmarks(bookmarkTree);
      this.updateBookmarkCount(count);
    });
  }

  countBookmarks(bookmarkTree) {
    let count = 0;

    const traverse = (nodes) => {
      if (!nodes) return;

      for (const node of nodes) {
        if (node.url) {
          count++;
        } else if (node.children) {
          traverse(node.children);
        }
      }
    };

    traverse(bookmarkTree);
    return count;
  }

  openWebApp() {
    const urls = ["https://recollect-bolt.netlify.app/"];

    chrome.tabs.create({ url: urls[0] }, (tab) => {
      if (chrome.runtime.lastError) {
        // Failed to open tab
      } else {
        window.close();
      }
    });
  }
}

// Initialize popup when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new PopupManager();
});

// Add CSS animation for fade in effect
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);
