class WordCloud {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`WordCloud: Container with ID "${containerId}" not found!`);
            // Create a fallback container if not found
            this.container = document.createElement('div');
            this.container.id = containerId;
            this.container.className = 'word-cloud-container';
            document.body.appendChild(this.container);
            console.log(`WordCloud: Created fallback container with ID "${containerId}"`);
        }
        
        this.words = new Map(); // Store word objects with their properties
        this.containerWidth = this.container.clientWidth;
        this.containerHeight = this.container.clientHeight;
        this.isFullscreen = false;
        this.collisionDetection = true;
        this.lastUpdateTime = Date.now(); // Track last update time
        
        // Add language awareness with log for debugging
        this.language = localStorage.getItem('echolife_language') || 'en-US';
        console.log(`Word cloud initialized with language: ${this.language}`);
        
        // Setup fullscreen toggle
        const toggleButton = document.getElementById('fullscreenToggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', this.toggleFullscreen.bind(this));
        }
        
        // Initialize the word cloud placeholder with correct language
        this.updatePlaceholder();
        
        // Listen for language changes
        window.addEventListener('languageChanged', (e) => {
            this.language = e.detail.language;
            console.log(`Word cloud language changed to: ${this.language}`);
            this.updatePlaceholder();
        });
        
        // Track container size changes
        window.addEventListener('resize', () => this.handleResize());
        
        // Remove placeholder on first data
        this.placeholderRemoved = false;
        
        // Setup health indicator
        this.setupHealthIndicator();
        
        // Setup heartbeat to ensure the cloud stays responsive
        this.heartbeatInterval = setInterval(() => this.checkHealth(), 5000);
        
        console.log(`WordCloud: Fully initialized with container size ${this.containerWidth}x${this.containerHeight}`);
    }
    
    setupHealthIndicator() {
        // Add a small indicator to show when updates happen
        this.healthIndicator = document.createElement('div');
        this.healthIndicator.style.position = 'absolute';
        this.healthIndicator.style.bottom = '5px';
        this.healthIndicator.style.right = '5px';
        this.healthIndicator.style.width = '8px';
        this.healthIndicator.style.height = '8px';
        this.healthIndicator.style.borderRadius = '50%';
        this.healthIndicator.style.backgroundColor = 'gray';
        this.healthIndicator.style.transition = 'background-color 0.5s';
        this.healthIndicator.style.opacity = '0.5';
        this.container.appendChild(this.healthIndicator);
    }
    
    // Show a visual update indicator and check health
    checkHealth() {
        // Check if we've had updates recently
        const timeSinceLastUpdate = Date.now() - this.lastUpdateTime;
        
        // If no updates for over 15 seconds during recording, 
        // add a small fallback update to keep things fresh
        if (timeSinceLastUpdate > 15000 && window.audioRecorder && window.audioRecorder.isRecording) {
            console.log('No word cloud updates for 15s during recording - triggering heartbeat update');
            
            // Try to trigger a small update if we can
            if (window.partialTranscript && window.tagExtractor && typeof window.updateRealtimeTags === 'function') {
                window.updateRealtimeTags(window.partialTranscript);
            } else {
                // If we can't do a proper update, at least update the health indicator
                this.healthIndicator.style.backgroundColor = '#FFA500';
                setTimeout(() => {
                    this.healthIndicator.style.backgroundColor = 'gray';
                }, 500);
            }
        }
    }
    
    toggleFullscreen() {
        this.isFullscreen = !this.isFullscreen;
        this.container.classList.toggle('fullscreen', this.isFullscreen);
        
        const icon = document.querySelector('#fullscreenToggle i');
        if (icon) {
            icon.className = this.isFullscreen ? 'fas fa-compress' : 'fas fa-expand';
        }
        
        // Update dimensions and reposition words
        setTimeout(() => {
            this.handleResize();
        }, 100);
    }
    
    handleResize() {
        this.containerWidth = this.container.clientWidth;
        this.containerHeight = this.container.clientHeight;
        
        // Reposition all words with animation
        this.updateWordCloud(Array.from(this.words.values()), true);
    }
    
    updatePlaceholder() {
        const placeholder = this.container.querySelector('.word-cloud-placeholder');
        if (placeholder) {
            placeholder.textContent = getTranslation('words_appear', this.language);
            console.log(`Word cloud placeholder updated to language: ${this.language}`);
        } else {
            // Create a placeholder if it doesn't exist
            const newPlaceholder = document.createElement('div');
            newPlaceholder.className = 'word-cloud-placeholder';
            newPlaceholder.textContent = getTranslation('words_appear', this.language);
            this.container.appendChild(newPlaceholder);
            console.log(`Word cloud placeholder created with language: ${this.language}`);
        }
    }
    
    // Updates the word cloud with new tags
    async updateWordCloud(tags, isResizing = false) {
        if (!this.container) {
            console.error("[WORD-CLOUD] Container not found during updateWordCloud");
            return;
        }
        
        console.log(`[WORD-CLOUD] Updating with ${tags.length} tags, isResizing: ${isResizing}`);
        console.log(`[WORD-CLOUD] Tags received:`, tags);
        
        // Update last update time
        this.lastUpdateTime = Date.now();
        
        // Show update activity in health indicator
        if (this.healthIndicator) {
            this.healthIndicator.style.backgroundColor = '#4CAF50';
            setTimeout(() => {
                this.healthIndicator.style.backgroundColor = 'gray';
            }, 500);
        }
        
        // Remove placeholder if it's still there
        if (!this.placeholderRemoved && tags.length > 0) {
            const placeholder = this.container.querySelector('.word-cloud-placeholder');
            if (placeholder) {
                placeholder.style.display = 'none';
                this.placeholderRemoved = true;
                console.log("[WORD-CLOUD] Placeholder removed");
            }
        }
        
        // Track semantic themes for dynamic color assignment
        console.log(`[WORD-CLOUD] Language: ${this.language}, tags: ${tags.length}`);
        const semanticThemes = this.identifyThemes(tags);
        
        // Create a new Map for tracking current update's words
        const currentUpdate = new Map();
        
        // Add language/translation indicator to word cloud
        this.updateLanguageIndicator();
        
        // Process each tag
        console.log(`[WORD-CLOUD] Processing ${tags.length} tags for display`);
        for (const tag of tags) {
            try {
                // Extract tag data
                const text = tag.text || tag;
                const confidence = tag.confidence || 'medium';
                const count = tag.count || 1;
                
                // Skip empty or very short tags
                if (!text || text.length < 2) {
                    console.log(`[WORD-CLOUD] Skipping empty/short tag: "${text}"`);
                    continue;
                }
                
                // Get the size class using the helper method or fallback
                const sizeClass = this.getSizeClass ? 
                    this.getSizeClass(confidence, count) : 
                    this.getDefaultSizeClass(confidence, count);
                
                // Check if this word already exists in the cloud
                if (this.words.has(text)) {
                    // Update existing word
                    console.log(`[WORD-CLOUD] Updating existing word: "${text}" (confidence: ${confidence}, size: ${sizeClass})`);
                    const word = this.words.get(text);
                    
                    // Update properties
                    word.confidence = confidence;
                    word.lastUpdated = Date.now();
                    
                    // Update count if provided
                    if (tag.count !== undefined) {
                        word.count = count;
                    }
                    
                    // Update element if it exists
                    if (word.element) {
                        // Update element classes
                        word.element.className = `word ${sizeClass} ${confidence}-confidence`;
                        
                        // Add status classes
                        if (tag.status) {
                            if (tag.status === 'new') {
                                word.element.classList.add('new');
                                console.log(`[WORD-CLOUD] Word "${text}" marked as new`);
                            } else if (tag.status === 'changing') {
                                word.element.classList.add('changing');
                                console.log(`[WORD-CLOUD] Word "${text}" marked as changing`);
                            }
                        }
                        
                        // Apply theme color
                        const themeColor = this.getThemeColor(text, semanticThemes);
                        word.element.style.color = themeColor;
                        
                        // Add pulse effect for visual feedback
                        word.element.classList.add('update-pulse');
                        setTimeout(() => word.element.classList.remove('update-pulse'), 1000);
                    }
                    
                    // Add to current update
                    currentUpdate.set(text, word);
                    
                } else {
                    // Create new word element
                    console.log(`[WORD-CLOUD] Adding new word: "${text}" (confidence: ${confidence}, size: ${sizeClass})`);
                    const wordElement = document.createElement('div');
                    
                    // Set text content
                    wordElement.textContent = text;
                    
                    // Set class based on size and confidence
                    wordElement.className = `word ${sizeClass} ${confidence}-confidence`;
                    
                    // Add status classes
                    if (tag.status) {
                        wordElement.classList.add(tag.status);
                        console.log(`[WORD-CLOUD] Adding status class "${tag.status}" to "${text}"`);
                    }
                    
                    // Apply theme color
                    const themeColor = this.getThemeColor(text, semanticThemes);
                    wordElement.style.color = themeColor;
                    console.log(`[WORD-CLOUD] Set color for "${text}" to ${themeColor}`);
                    
                    // Set initial positions (will be adjusted later)
                    wordElement.style.left = '50%';
                    wordElement.style.top = '50%';
                    wordElement.style.transform = 'translate(-50%, -50%)';
                    
                    // Create word object
                    const wordObj = {
                        text,
                        element: wordElement,
                        confidence,
                        count: count || 1,
                        lastUpdated: Date.now()
                    };
                    
                    // Add to maps
                    this.words.set(text, wordObj);
                    currentUpdate.set(text, wordObj);
                    
                    // Add to container with animation
                    this.container.appendChild(wordElement);
                }
            } catch (error) {
                console.error(`[WORD-CLOUD] Error processing tag "${tag.text || tag}":`, error);
            }
        }
        
        // Position new words
        console.log(`[WORD-CLOUD] Positioning ${currentUpdate.size} words in cloud`);
        
        // Add any new words from current update
        for (const [text, word] of currentUpdate.entries()) {
            if (word.element && !word.positioned) {
                try {
                    // Get the proper size class
                    const sizeClass = this.getSizeClass ? 
                        this.getSizeClass(word.confidence, word.count) : 
                        this.getDefaultSizeClass(word.confidence, word.count);
                    
                    // Get the optimal position with error handling
                    let position;
                    try {
                        position = this.getOptimalPosition(word.element, sizeClass);
                        console.log(`[WORD-CLOUD] Positioned "${text}" at x:${position.left}, y:${position.top}`);
                    } catch (posError) {
                        console.error(`[WORD-CLOUD] Error getting position for "${text}":`, posError);
                        position = {
                            left: Math.random() * (this.containerWidth - 100) + 50,
                            top: Math.random() * (this.containerHeight - 50) + 25
                        };
                    }
                    
                    // Check if position is valid before using it
                    if (!position || typeof position.left === 'undefined' || typeof position.top === 'undefined') {
                        console.warn(`[WORD-CLOUD] Invalid position for word "${text}", using random position`);
                        position = {
                            left: Math.random() * (this.containerWidth - 100) + 50,
                            top: Math.random() * (this.containerHeight - 50) + 25
                        };
                    }
                    
                    // Apply the position with animation
                    word.element.style.transition = 'all 0.5s ease-out';
                    word.element.style.left = `${position.left}px`;
                    word.element.style.top = `${position.top}px`;
                    word.element.style.transform = 'none';
                    
                    // Mark as positioned
                    word.positioned = true;
                } catch (error) {
                    console.error(`[WORD-CLOUD] Error positioning word "${text}":`, error);
                    
                    // Apply fallback positioning even after errors
                    try {
                        word.element.style.left = `${Math.random() * (this.containerWidth - 100) + 50}px`;
                        word.element.style.top = `${Math.random() * (this.containerHeight - 50) + 25}px`;
                        word.element.style.transform = 'none';
                        word.positioned = true;
                        console.log(`[WORD-CLOUD] Applied fallback positioning for "${text}"`);
                    } catch (fallbackError) {
                        console.error(`[WORD-CLOUD] Even fallback positioning failed for "${text}":`, fallbackError);
                    }
                }
            }
        }
        
        console.log(`[WORD-CLOUD] Update complete with ${this.words.size} total words in cloud`);
    }
    
    // Find an optimal position for a word that minimizes overlaps
    getOptimalPosition(element, sizeClass) {
        const padding = 10;
        let width, height;
        
        // Estimate dimensions based on sizeClass and text length
        if (sizeClass === 'large' || sizeClass === 'x-large') {
            width = element.textContent.length * 14;
            height = 40;
        } else if (sizeClass === 'medium') {
            width = element.textContent.length * 10;
            height = 30;
        } else {
            width = element.textContent.length * 8;
            height = 20;
        }
        
        // Safety margins to keep words within container
        const safetyMargin = 20;
        const maxWidth = Math.max(10, this.containerWidth - width - safetyMargin);
        const maxHeight = Math.max(10, this.containerHeight - height - safetyMargin);
        
        // If collision detection is disabled or we have few words, use simple random positioning
        if (!this.collisionDetection || this.words.size < 5) {
            return {
                left: Math.random() * maxWidth + safetyMargin / 2,
                top: Math.random() * maxHeight + safetyMargin / 2
            };
        }
        
        // Try to find a position with minimal overlap
        let bestPosition = null;
        let lowestOverlap = Infinity;
        const attempts = 15; // Number of positions to try
        
        for (let i = 0; i < attempts; i++) {
            // Start with a random position
            const position = {
                left: Math.random() * maxWidth + safetyMargin / 2,
                top: Math.random() * maxHeight + safetyMargin / 2
            };
            
            // Calculate total overlap with existing words
            let totalOverlap = 0;
            for (const [existingText, existingWord] of this.words.entries()) {
                if (existingWord.element && existingWord.positioned && existingText !== element.textContent) {
                    // Get existing element position and dimensions
                    const existingRect = existingWord.element.getBoundingClientRect();
                    const containerRect = this.container.getBoundingClientRect();
                    
                    // Adjust for container offset
                    const existingLeft = existingRect.left - containerRect.left;
                    const existingTop = existingRect.top - containerRect.top;
                    const existingWidth = existingRect.width;
                    const existingHeight = existingRect.height;
                    
                    // Calculate overlap
                    const horizontalOverlap = Math.max(0, Math.min(position.left + width, existingLeft + existingWidth) - Math.max(position.left, existingLeft));
                    const verticalOverlap = Math.max(0, Math.min(position.top + height, existingTop + existingHeight) - Math.max(position.top, existingTop));
                    const overlap = horizontalOverlap * verticalOverlap;
                    
                    totalOverlap += overlap;
                }
            }
            
            // Keep track of best position
            if (totalOverlap < lowestOverlap) {
                lowestOverlap = totalOverlap;
                bestPosition = position;
                
                // If we found a position with no overlap, use it
                if (totalOverlap === 0) break;
            }
        }
        
        // If we couldn't find a good position, use a random one
        if (!bestPosition) {
            bestPosition = {
                left: Math.random() * maxWidth + safetyMargin / 2,
                top: Math.random() * maxHeight + safetyMargin / 2
            };
        }
        
        return bestPosition;
    }
    
    // Helper method to generate a theme color for a word
    getThemeColor(word, themes) {
        word = word.toLowerCase();
        
        // Find which theme the word belongs to
        for (let i = 0; i < themes.length; i++) {
            const theme = themes[i];
            if (theme.words.includes(word)) {
                return this.generateThemeColor(theme.index);
            }
        }
        
        // Default color if no theme is found
        return '#757575'; // Gray
    }
    
    // Generate a visually pleasing color for a theme
    generateThemeColor(index) {
        // Vibrant color palette with good contrast and visual appeal
        const colorPalette = [
            '#4285F4', // Blue
            '#EA4335', // Red
            '#34A853', // Green
            '#FBBC05', // Yellow
            '#9C27B0', // Purple
            '#00BCD4', // Cyan
            '#FF9800', // Orange
            '#795548', // Brown
            '#607D8B', // Blue Gray
            '#E91E63', // Pink
            '#3F51B5', // Indigo
            '#009688', // Teal
            '#8BC34A', // Light Green
            '#FFC107', // Amber
            '#673AB7', // Deep Purple
            '#FF5722', // Deep Orange
            '#2196F3', // Light Blue
            '#CDDC39', // Lime
        ];
        
        // If we have more themes than colors, create variations
        if (index < colorPalette.length) {
            return colorPalette[index];
        } else {
            // Create variations by adjusting an existing color
            const baseColor = colorPalette[index % colorPalette.length];
            return this.adjustColor(baseColor, index);
        }
    }
    
    // New method to identify semantic themes from the current set of tags
    identifyThemes(tags) {
        // Add Portuguese-specific theme detection
        const isPortuguese = this.language === 'pt-BR';
        console.log(`Identifying themes with language: ${this.language}, isPortuguese: ${isPortuguese}`);
        
        // For Portuguese, consider groups based on Brazilian industries/topics
        if (isPortuguese) {
            // Portuguese-specific theme detection will go here
            // This is simplified for now
        }
        
        // Original English theme detection
        // Create thematic clusters based on word relationships
        const themes = [];
        const processedWords = new Set();
        
        // Extract themes based on similar words or patterns
        for (const tag of tags) {
            const word = tag.text.toLowerCase();
            
            // Skip already processed words
            if (processedWords.has(word)) continue;
            
            // Check if this word is related to existing themes
            let foundTheme = false;
            for (const theme of themes) {
                for (const themeWord of theme.words) {
                    if (this.areWordsRelated(word, themeWord)) {
                        theme.words.push(word);
                        processedWords.add(word);
                        foundTheme = true;
                        break;
                    }
                }
                if (foundTheme) break;
            }
            
            // If not related to existing themes, create a new theme
            if (!foundTheme) {
                themes.push({
                    index: themes.length,
                    words: [word]
                });
                processedWords.add(word);
            }
        }
        
        // Handle any remaining unprocessed words
        const remainingTags = tags.filter(t => !processedWords.has(t.text.toLowerCase()));
        if (remainingTags.length > 0) {
            // Add remaining words to existing themes or create new ones
            for (const tag of remainingTags) {
                const word = tag.text.toLowerCase();
                if (!processedWords.has(word)) {
                    // Just add as a new theme
                    themes.push({
                        index: themes.length,
                        words: [word]
                    });
                    processedWords.add(word);
                }
            }
        }
        
        return themes;
    }
    
    // Check if two words are semantically related
    areWordsRelated(word1, word2) {
        if (word1.toLowerCase() === word2.toLowerCase()) {
            return true;
        }
        
        // Simple stemming - check if one word starts with the other
        const w1 = word1.toLowerCase();
        const w2 = word2.toLowerCase();
        
        if (w1.startsWith(w2) || w2.startsWith(w1)) {
            return true;
        }
        
        // Check for common prefixes (at least 4 chars)
        const minPrefixLength = 4;
        const maxLength = Math.min(w1.length, w2.length);
        
        if (maxLength >= minPrefixLength) {
            const commonPrefix = w1.substring(0, maxLength);
            if (w2.startsWith(commonPrefix)) {
                return true;
            }
        }
        
        // Check for semantic relationships (could be expanded with NLP libraries)
        const relationPatterns = [
            ['health', 'doctor', 'medical', 'wellness', 'fitness', 'diet'],
            ['tech', 'computer', 'software', 'programming', 'digital'],
            ['finance', 'money', 'bank', 'investment', 'stock', 'market'],
            ['travel', 'vacation', 'trip', 'tour', 'destination'],
            ['food', 'cooking', 'recipe', 'meal', 'kitchen', 'dining'],
            ['music', 'song', 'artist', 'band', 'concert'],
            ['sport', 'game', 'team', 'player', 'competition'],
            ['work', 'job', 'career', 'office', 'professional']
        ];
        
        for (const pattern of relationPatterns) {
            if (pattern.includes(w1) && pattern.includes(w2)) {
                return true;
            }
        }
        
        return false;
    }
    
    // Adjust a color to create a variation
    adjustColor(hexColor, seed) {
        // Convert hex to RGB
        let r = parseInt(hexColor.slice(1, 3), 16);
        let g = parseInt(hexColor.slice(3, 5), 16);
        let b = parseInt(hexColor.slice(5, 7), 16);
        
        // Adjust each component based on seed
        const adjust = (value, amount) => {
            return Math.min(255, Math.max(0, value + amount));
        };
        
        r = adjust(r, (seed * 13) % 60 - 30);
        g = adjust(g, (seed * 17) % 60 - 30);
        b = adjust(b, (seed * 19) % 60 - 30);
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    updateLanguageIndicator() {
        // Remove any existing indicator
        const existingIndicator = this.container.querySelector('.word-cloud-language-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Get translation settings
        const translationSettings = window.translationController ? 
            window.translationController.getSettings() : 
            { language: this.language, translateEnabled: false };
        
        // Create indicator with language and translation status
        const indicator = document.createElement('div');
        indicator.className = 'word-cloud-language-indicator';
        
        if (translationSettings.translateEnabled) {
            indicator.textContent = translationSettings.language === 'pt-BR' ? '🇧🇷 (Tradução)' : '🇺🇸 (Translation)';
        } else {
            indicator.textContent = translationSettings.language === 'pt-BR' ? '🇧🇷' : '🇺🇸';
        }
        
        this.container.appendChild(indicator);
    }
    
    // Helper method to get size class based on confidence and count
    getSizeClass(confidence, count = 1) {
        // Base size on confidence
        let baseSize = 'small';
        if (confidence === 'high') {
            baseSize = 'large';
        } else if (confidence === 'medium') {
            baseSize = 'medium';
        }
        
        // Adjust for count if needed
        if (count > 2) {
            // Upgrade size class for frequently occurring terms
            if (baseSize === 'small') baseSize = 'medium';
            else if (baseSize === 'medium') baseSize = 'large';
            else if (baseSize === 'large') baseSize = 'x-large';
        } else if (count >= 1.5) {
            // Slight upgrade for terms that occur more than once
            if (baseSize === 'small') baseSize = 'medium';
        }
        
        return baseSize;
    }
    
    // Fallback method for getting size class
    getDefaultSizeClass(confidence, count = 1) {
        // Simplified version as a fallback
        if (confidence === 'high' || count > 1.5) {
            return 'large';
        } else if (confidence === 'medium') {
            return 'medium';
        }
        return 'small';
    }
}

// Create and export a global instance
window.WordCloud = WordCloud;