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
                // Just do a refresh of current words as a fallback
                this.updateWordCloud(Array.from(this.words.values()), true);
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
        }
    }
    
    // Updates the word cloud with new tags
    async updateWordCloud(tags, isResizing = false) {
        if (!this.container) {
            console.error("WordCloud: Container not found during updateWordCloud");
            return;
        }
        
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
                console.log("WordCloud: Placeholder removed");
            }
        }
        
        // Track semantic themes for dynamic color assignment
        // Log language for debugging
        console.log(`Word cloud updating with language: ${this.language}, tags: ${tags.length}`);
        const semanticThemes = this.identifyThemes(tags);
        
        // Create a new Map for tracking current update's words
        const currentUpdate = new Map();
        
        // Add language/translation indicator to word cloud
        this.updateLanguageIndicator();
        
        // Process each tag
        for (const tag of tags) {
            try {
                // Extract tag data
                const text = tag.text || tag;
                const confidence = tag.confidence || 'medium';
                const count = tag.count || 1;
                
                // Skip empty or very short tags
                if (!text || text.length < 2) continue;
                
                // Get the size class using the helper method or fallback
                const sizeClass = this.getSizeClass ? 
                    this.getSizeClass(confidence, count) : 
                    this.getDefaultSizeClass(confidence, count);
                
                // Check if this word already exists in the cloud
                if (this.words.has(text)) {
                    // Update existing word
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
                            word.element.classList.add(tag.status);
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
                    const wordElement = document.createElement('div');
                    
                    // Set text content
                    wordElement.textContent = text;
                    
                    // Set class based on size and confidence
                    wordElement.className = `word ${sizeClass} ${confidence}-confidence`;
                    
                    // Add status classes
                    if (tag.status) {
                        wordElement.classList.add(tag.status);
                    }
                    
                    // Apply theme color
                    const themeColor = this.getThemeColor(text, semanticThemes);
                    wordElement.style.color = themeColor;
                    
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
                console.error(`Error processing tag "${tag.text || tag}":`, error);
            }
        }
        
        // If this is a resize operation, reposition all words but don't remove any
        if (isResizing) {
            console.log("WordCloud: Repositioning all words due to resize");
            try {
                for (const word of this.words.values()) {
                    if (word.element) {
                        const position = this.getOptimalPosition(word.element, this.getSizeClass(word.confidence, word.count));
                        
                        // Apply the position with animation
                        word.element.style.transition = 'all 0.5s ease-out';
                        word.element.style.left = `${position.left}px`;
                        word.element.style.top = `${position.top}px`;
                        word.element.style.transform = 'none';
                    }
                }
            } catch (error) {
                console.error("Error during resize repositioning:", error);
            }
            return;
        }
        
        // Handle words that weren't in this update (fade them out)
        for (const [text, word] of this.words.entries()) {
            if (!currentUpdate.has(text)) {
                // Word not in current update, fade it out
                if (word.element) {
                    word.element.classList.add('fade-out');
                    
                    // Remove after animation completes
                    setTimeout(() => {
                        try {
                            if (word.element && word.element.parentNode) {
                                word.element.parentNode.removeChild(word.element);
                            }
                            this.words.delete(text);
                        } catch (error) {
                            console.error(`Error removing word "${text}":`, error);
                        }
                    }, 500);
                } else {
                    // If no element, just remove it
                    this.words.delete(text);
                }
            }
        }
        
        // Add any new words from current update
        for (const [text, word] of currentUpdate.entries()) {
            if (word.element && !word.positioned) {
                try {
                    // Get the proper size class
                    const sizeClass = this.getSizeClass(word.confidence, word.count);
                    
                    // Get the optimal position with error handling
                    let position;
                    try {
                        position = this.getOptimalPosition(word.element, sizeClass);
                    } catch (posError) {
                        console.warn(`Error getting position for word "${text}":`, posError);
                        // Fallback position
                        position = {
                            left: Math.random() * (this.containerWidth - 100) + 50,
                            top: Math.random() * (this.containerHeight - 50) + 25
                        };
                    }
                    
                    // Check if position is valid before using it
                    if (!position || typeof position.left === 'undefined' || typeof position.top === 'undefined') {
                        console.warn(`Invalid position for word "${text}". Using fallback.`);
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
                    console.error(`Error positioning word "${text}":`, error);
                    
                    // Apply fallback positioning even after errors
                    try {
                        word.element.style.left = `${Math.random() * (this.containerWidth - 100)}px`;
                        word.element.style.top = `${Math.random() * (this.containerHeight - 50)}px`;
                        word.element.style.transform = 'none';
                        word.positioned = true;
                    } catch (fallbackError) {
                        console.error(`Critical error applying fallback position for "${text}":`, fallbackError);
                    }
                }
            }
        }
    }
    
    // New method to identify semantic themes from the current set of tags
    identifyThemes(tags) {
        // Add Portuguese-specific theme detection
        const isPortuguese = this.language === 'pt-BR';
        console.log(`Identifying themes with language: ${this.language}, isPortuguese: ${isPortuguese}`);
        
        // For Portuguese, consider groups based on Brazilian industries/topics
        if (isPortuguese) {
            // Define Portuguese theme keywords
            const themeKeywords = {
                'tecnologia': ['tecnologia', 'digital', 'app', 'aplicativo', 'software', 'computador', 'internet', 'rede', 'programação', 'código', 'inteligência artificial', 'ia', 'dados'],
                'saúde': ['saúde', 'médico', 'hospital', 'medicina', 'enfermagem', 'tratamento', 'doença', 'bem-estar', 'fitness', 'exercício'],
                'finanças': ['finanças', 'dinheiro', 'investimento', 'banco', 'economia', 'mercado', 'financeiro', 'bolsa', 'ações'],
                'educação': ['educação', 'escola', 'universidade', 'ensino', 'aprendizagem', 'professor', 'aluno', 'estudo'],
                'governo': ['governo', 'política', 'público', 'lei', 'legislação', 'presidente', 'ministro', 'congresso']
            };
            
            // Apply Portuguese-specific grouping logic
            const themes = [];
            const processedWords = new Set();
            
            // Group words by theme
            for (const tag of tags) {
                const word = tag.text.toLowerCase();
                if (processedWords.has(word)) continue;
                
                // Check each theme category
                let foundTheme = false;
                for (const [theme, keywords] of Object.entries(themeKeywords)) {
                    if (keywords.some(keyword => word.includes(keyword.toLowerCase()))) {
                        // Find other words in the same theme
                        const relatedWords = tags
                            .filter(t => !processedWords.has(t.text.toLowerCase()) && 
                                keywords.some(k => t.text.toLowerCase().includes(k.toLowerCase())))
                            .map(t => t.text.toLowerCase());
                        
                        if (relatedWords.length > 0) {
                            themes.push({
                                words: relatedWords,
                                color: this.generateThemeColor(themes.length)
                            });
                            
                            relatedWords.forEach(w => processedWords.add(w));
                            foundTheme = true;
                            break;
                        }
                    }
                }
                
                // If not found in any theme, check for related words
                if (!foundTheme) {
                    const relatedWords = tags.filter(t => 
                        this.areWordsRelated(word, t.text.toLowerCase()) && 
                        !processedWords.has(t.text.toLowerCase())
                    ).map(t => t.text.toLowerCase());
                    
                    if (relatedWords.length > 0) {
                        relatedWords.push(word);
                        relatedWords.forEach(w => processedWords.add(w));
                        
                        themes.push({
                            words: relatedWords,
                            color: this.generateThemeColor(themes.length)
                        });
                    } else {
                        // No theme or related words, add as individual
                        processedWords.add(word);
                        themes.push({
                            words: [word],
                            color: this.generateThemeColor(themes.length)
                        });
                    }
                }
            }
            
            return themes;
        }
        
        // Original English theme detection
        // Create thematic clusters based on word relationships
        const themes = [];
        const processedWords = new Set();
        
        // Extract themes based on similar words or patterns
        for (const tag of tags) {
            if (processedWords.has(tag.text.toLowerCase())) continue;
            
            const relatedWords = tags.filter(t => 
                this.areWordsRelated(tag.text, t.text) && 
                !processedWords.has(t.text.toLowerCase())
            ).map(t => t.text.toLowerCase());
            
            if (relatedWords.length > 0) {
                // Add the current word to its related words
                relatedWords.push(tag.text.toLowerCase());
                
                // Mark all these words as processed
                relatedWords.forEach(word => processedWords.add(word));
                
                // Create a new theme with a unique color
                themes.push({
                    words: relatedWords,
                    color: this.generateThemeColor(themes.length)
                });
            }
        }
        
        // Handle any remaining unprocessed words
        const remainingTags = tags.filter(t => !processedWords.has(t.text.toLowerCase()));
        if (remainingTags.length > 0) {
            const groupSize = 3; // Group remaining words in small clusters
            
            for (let i = 0; i < remainingTags.length; i += groupSize) {
                const group = remainingTags.slice(i, i + groupSize);
                const groupWords = group.map(t => t.text.toLowerCase());
                
                themes.push({
                    words: groupWords,
                    color: this.generateThemeColor(themes.length)
                });
                
                groupWords.forEach(word => processedWords.add(word));
            }
        }
        
        return themes;
    }
    
    // Check if two words are semantically related
    areWordsRelated(word1, word2) {
        if (word1.toLowerCase() === word2.toLowerCase()) return true;
        
        // Simple stemming - check if one word starts with the other
        const w1 = word1.toLowerCase();
        const w2 = word2.toLowerCase();
        
        if (w1.startsWith(w2) || w2.startsWith(w1)) return true;
        
        // Check for common prefixes (at least 4 chars)
        const minPrefixLength = 4;
        const maxLength = Math.min(w1.length, w2.length);
        
        if (maxLength >= minPrefixLength) {
            const commonPrefix = w1.substring(0, maxLength);
            if (w2.startsWith(commonPrefix)) return true;
        }
        
        // Check for semantic relationships (could be expanded with NLP libraries)
        const relationPatterns = [
            // Same subject areas
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
            const w1Match = pattern.some(term => w1.includes(term));
            const w2Match = pattern.some(term => w2.includes(term));
            if (w1Match && w2Match) return true;
        }
        
        return false;
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
            // Create a variation of an existing color
            const baseColor = colorPalette[index % colorPalette.length];
            return this.adjustColor(baseColor, index);
        }
    }
    
    // Adjust a color to create a variation
    adjustColor(hexColor, seed) {
        // Convert hex to RGB
        let r = parseInt(hexColor.slice(1, 3), 16);
        let g = parseInt(hexColor.slice(3, 5), 16);
        let b = parseInt(hexColor.slice(5, 7), 16);
        
        // Adjust each component based on seed
        const adjust = (value, amount) => {
            return Math.max(0, Math.min(255, value + amount));
        };
        
        r = adjust(r, (seed * 13) % 60 - 30);
        g = adjust(g, (seed * 17) % 60 - 30);
        b = adjust(b, (seed * 19) % 60 - 30);
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // Get the color for a word based on its theme
    getThemeColor(word, themes) {
        word = word.toLowerCase();
        
        // Find which theme the word belongs to
        for (const theme of themes) {
            if (theme.words.includes(word)) {
                return theme.color;
            }
        }
        
        // Default color if no theme is found
        return '#757575'; // Gray
    }
    
    // Find an optimal position for a word that minimizes overlaps
    getOptimalPosition(element, sizeClass) {
        const padding = 10;
        let width, height;
        
        // Estimate dimensions based on sizeClass and text length
        if (sizeClass === 'large' || sizeClass === 'x-large') {
            width = element.textContent.length * 18 + padding;
            height = 45 + padding;
        } else if (sizeClass === 'medium') {
            width = element.textContent.length * 14 + padding;
            height = 35 + padding;
        } else {
            width = element.textContent.length * 10 + padding;
            height = 25 + padding;
        }
        
        // Safety margins to keep words within container
        const safetyMargin = 20;
        const maxWidth = Math.max(10, this.containerWidth - width - safetyMargin);
        const maxHeight = Math.max(10, this.containerHeight - height - safetyMargin);
        
        // If collision detection is disabled or we have few words, use simple random positioning
        if (!this.collisionDetection || this.words.size < 5) {
            return {
                left: Math.random() * maxWidth + safetyMargin,
                top: Math.random() * maxHeight + safetyMargin
            };
        }
        
        // Try to find a position with minimal overlap
        let bestPosition = null;
        const attempts = 15; // Number of positions to try
        
        for (let i = 0; i < attempts; i++) {
            const left = Math.random() * maxWidth + safetyMargin;
            const top = Math.random() * maxHeight + safetyMargin;
            
            // Use this position if it's the first attempt
            if (bestPosition === null) {
                bestPosition = { left, top };
            }
        }
        
        // If we couldn't find a good position, use a random one
        if (!bestPosition) {
            bestPosition = {
                left: Math.random() * maxWidth + safetyMargin,
                top: Math.random() * maxHeight + safetyMargin
            };
        }
        
        return bestPosition;
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
            const sourceLang = translationSettings.language === 'pt-BR' ? 'PT' : 'EN';
            const targetLang = translationSettings.language === 'pt-BR' ? 'EN' : 'PT';
            indicator.textContent = `${sourceLang} → ${targetLang}`;
        } else {
            indicator.textContent = translationSettings.language === 'pt-BR' ? 'Português' : 'English';
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
            return 'x-large';
        } else if (count > 1.5) {
            return 'large';
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