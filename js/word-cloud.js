class WordCloud {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container with ID ${containerId} not found`);
            return;
        }
        
        this.words = new Map(); // Store word objects with their properties
        this.containerWidth = this.container.clientWidth;
        this.containerHeight = this.container.clientHeight;
        this.isFullscreen = false;
        this.collisionDetection = true;
        this.lastUpdateTime = Date.now(); // Track last update time
        
        // Add language awareness
        this.language = localStorage.getItem('echolife_language') || 'en-US';
        
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
        }
    }
    
    // Updates the word cloud with new tags
    async updateWordCloud(tags, isResizing = false) {
        if (!this.container) return;
        
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
            }
        }
        
        // Track semantic themes for dynamic color assignment
        const semanticThemes = this.identifyThemes(tags);
        
        // Create a new Map for tracking current update's words
        const currentUpdate = new Map();
        
        // Process each tag
        for (const tag of tags) {
            const text = tag.text.toLowerCase();
            // Determine font size based on count (relevance)
            let fontSize = 14 + (tag.count * 2); // base 14px + 2px per count
            
            // Determine confidence class for fallback if needed
            let sizeClass = 'word-medium';
            if (tag.confidence === 'high') sizeClass = 'word-high';
            else if (tag.confidence === 'low') sizeClass = 'word-low';
            
            // Get dynamic color based on semantic themes
            const themeColor = this.getThemeColor(text, semanticThemes);
            
            // Build CSS classes including uncertain status if needed
            let cssClasses = 'word visible';
            if (tag.status === 'uncertain' || tag.uncertain || text.endsWith('?')) {
                cssClasses += ' uncertain';
            }
            
            currentUpdate.set(text, {
                id: `word-${text.replace(/\s+/g, '-').replace(/\?/g, '')}`,
                text,
                fontSize,
                groupColor: themeColor,
                confidence: tag.confidence,
                cssClasses: cssClasses,
                count: tag.count,
                uncertain: tag.status === 'uncertain' || tag.uncertain || text.endsWith('?'),
                lastSeen: Date.now()
            });
            
            // Check if this word already exists
            if (this.words.has(text)) {
                // Update existing word
                const existingWord = this.words.get(text);
                const wordElement = document.getElementById(existingWord.id);
                
                if (wordElement) {
                    // Apply smooth transition for size and color updates
                    wordElement.style.transition = 'all 1s ease-out';
                    wordElement.style.fontSize = `${fontSize}px`;
                    wordElement.style.backgroundColor = themeColor;
                    
                    // Update classes for uncertainty
                    if (tag.status === 'uncertain' || tag.uncertain || text.endsWith('?')) {
                        wordElement.classList.add('uncertain');
                    } else {
                        wordElement.classList.remove('uncertain');
                    }
                    
                    existingWord.lastSeen = Date.now();
                    // Update the stored color and uncertainty
                    existingWord.groupColor = themeColor;
                    existingWord.uncertain = tag.status === 'uncertain' || tag.uncertain || text.endsWith('?');
                }
            } else {
                // Create new word element
                const wordElement = document.createElement('div');
                const wordId = `word-${text.replace(/\s+/g, '-').replace(/\?/g, '')}`;
                wordElement.id = wordId;
                wordElement.className = cssClasses;
                wordElement.textContent = text;
                wordElement.style.fontSize = `${fontSize}px`;
                wordElement.style.backgroundColor = themeColor;
                
                // Position the word randomly initially
                const position = this.getOptimalPosition(wordElement, sizeClass);
                wordElement.style.left = `${position.x}px`;
                wordElement.style.top = `${position.y}px`;
                
                // Set smooth transition for entering
                wordElement.style.transition = 'all 1s ease-out';
                
                // Random slight rotation for visual interest
                const rotation = Math.random() * 10 - 5; // -5 to +5 degrees
                wordElement.style.transform = `rotate(${rotation}deg) scale(0)`;
                
                // Add to container
                this.container.appendChild(wordElement);
                
                // Make visible with delay for staggered appearance
                setTimeout(() => {
                    wordElement.style.transform = `rotate(${rotation}deg) scale(1)`;
                }, 100 * this.words.size);
                
                // Add to words map
                this.words.set(text, {
                    id: wordId,
                    text,
                    fontSize,
                    groupColor: themeColor,
                    confidence: tag.confidence,
                    count: tag.count,
                    uncertain: tag.status === 'uncertain' || tag.uncertain || text.endsWith('?'),
                    lastSeen: Date.now(),
                    position
                });
            }
        }
        
        // If this is a resize operation, reposition all words but don't remove any
        if (isResizing) {
            this.words.forEach((word) => {
                const wordElement = document.getElementById(word.id);
                if (wordElement) {
                    const position = this.getOptimalPosition(wordElement, 'word-medium');
                    
                    // Animate to new position
                    wordElement.style.transition = 'left 0.8s ease, top 0.8s ease';
                    wordElement.style.left = `${position.x}px`;
                    wordElement.style.top = `${position.y}px`;
                    
                    // Update stored position
                    word.position = position;
                }
            });
            return;
        }
        
        // Handle words that weren't in this update (fade them out)
        for (const [text, word] of this.words.entries()) {
            if (!currentUpdate.has(text)) {
                const timeSinceLastSeen = Date.now() - word.lastSeen;
                
                // If word hasn't been seen in a while, remove it
                if (timeSinceLastSeen > 2000) {  // use 2s for smoother fade-out
                    const wordElement = document.getElementById(word.id);
                    if (wordElement) {
                        // Fade out animation
                        wordElement.style.transition = 'all 0.8s ease-out';
                        wordElement.style.opacity = '0';
                        wordElement.style.transform = 'scale(0)';
                        
                        // Remove from DOM after animation
                        setTimeout(() => {
                            if (wordElement.parentNode) {
                                wordElement.parentNode.removeChild(wordElement);
                            }
                        }, 800);
                        
                        // Remove from tracking
                        this.words.delete(text);
                    }
                }
            }
        }
        
        // Add any new words from current update
        for (const [text, word] of currentUpdate.entries()) {
            if (!this.words.has(text)) {
                this.words.set(text, word);
            }
        }
    }
    
    // New method to identify semantic themes from the current set of tags
    identifyThemes(tags) {
        // Add Portuguese-specific theme detection
        const isPortuguese = this.language === 'pt-BR';
        
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
            
            // Apply the same theme detection logic but with Portuguese keywords
            // ...rest of the method remains unchanged
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
        if (sizeClass === 'word-high') {
            width = element.textContent.length * 18 + padding;
            height = 45 + padding;
        } else if (sizeClass === 'word-medium') {
            width = element.textContent.length * 14 + padding;
            height = 35 + padding;
        } else {
            width = element.textContent.length * 10 + padding;
            height = 25 + padding;
        }
        
        // Safety margins to keep words within container
        const safetyMargin = 20;
        const maxX = this.containerWidth - width - safetyMargin;
        const maxY = this.containerHeight - height - safetyMargin;
        
        // If collision detection is disabled or we have few words, just return random position
        if (!this.collisionDetection || this.words.size < 5) {
            return {
                x: Math.random() * maxX + safetyMargin,
                y: Math.random() * maxY + safetyMargin
            };
        }
        
        // Try to find a position with minimal overlap
        let bestPosition = null;
        let minOverlap = Infinity;
        const attempts = 20; // Number of positions to try
        
        for (let i = 0; i < attempts; i++) {
            const x = Math.random() * maxX + safetyMargin;
            const y = Math.random() * maxY + safetyMargin;
            const rect = {x, y, width, height};
            
            // Calculate total overlap with existing words
            let totalOverlap = 0;
            for (const word of this.words.values()) {
                const wordElement = document.getElementById(word.id);
                if (!wordElement) continue;
                
                const wordRect = {
                    x: parseFloat(wordElement.style.left),
                    y: parseFloat(wordElement.style.top),
                    width: wordElement.offsetWidth,
                    height: wordElement.offsetHeight
                };
                
                if (this.isOverlapping(rect, wordRect)) {
                    totalOverlap += this.calculateOverlap(rect, wordRect);
                }
            }
            
            // If we found a position with less overlap, remember it
            if (totalOverlap < minOverlap) {
                minOverlap = totalOverlap;
                bestPosition = {x, y};
                
                // If we found a position with no overlap, use it immediately
                if (minOverlap === 0) break;
            }
        }
        
        return bestPosition || {
            x: Math.random() * maxX + safetyMargin,
            y: Math.random() * maxY + safetyMargin
        };
    }
    
    // Check if two rectangles overlap
    isOverlapping(rect1, rect2) {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }
    
    // Calculate the area of overlap between two rectangles
    calculateOverlap(rect1, rect2) {
        const xOverlap = Math.max(0, Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - Math.max(rect1.x, rect2.x));
        const yOverlap = Math.max(0, Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - Math.max(rect1.y, rect2.y));
        return xOverlap * yOverlap;
    }
}

// Initialize word cloud when document is ready
let wordCloud;
document.addEventListener('DOMContentLoaded', () => {
    wordCloud = new WordCloud('wordCloudContainer');
    
    // Make wordCloud globally available
    window.wordCloud = wordCloud;
    
    // Listen for language changes to update the word cloud
    document.getElementById('languageSelector')?.addEventListener('change', (e) => {
        const language = e.target.value;
        wordCloud.language = language;
        wordCloud.updatePlaceholder();
        // Dispatch event for other components
        window.dispatchEvent(new CustomEvent('languageChanged', { 
            detail: { language } 
        }));
    });
});
