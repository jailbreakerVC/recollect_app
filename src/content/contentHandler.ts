import { SemanticSearchService } from '../services/semanticSearchService';
import { Logger } from '../utils/logger';

// Handle messages from the extension
chrome.runtime.onMessage.addListener(
  async (request, sender, sendResponse) => {
    try {
      if (request.action === 'forwardToWebApp') {
        const { payload } = request;
        
        if (payload.action === 'searchByKeyword') {
          const results = await SemanticSearchService.searchByQuery(
            payload.keyword,
            localStorage.getItem('userId'),
            { maxResults: 10 }
          );
          
          sendResponse({
            success: true,
            results: results,
            requestId: payload.requestId
          });
        }
        
        if (payload.action === 'searchByPageContext') {
          const results = await SemanticSearchService.searchByPageContext(
            payload.context,
            localStorage.getItem('userId'),
            { maxResults: 10 }
          );
          
          sendResponse({
            success: true,
            results: results,
            requestId: payload.requestId
          });
        }
      }
    } catch (error) {
      Logger.error('ContentHandler', 'Failed to handle search request', error);
      sendResponse({
        success: false,
        message: error.message,
        requestId: request.payload?.requestId
      });
    }
    return true; // Keep the message channel open
  }
);
