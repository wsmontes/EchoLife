/**
 * TagExtractor class for extracting key concepts and tags from text
 * using OpenAI's API
 */
class TagExtractor {
    constructor() {
        this.apiKey = null;
        this.context = [];
        this.systemPrompt = `
        Extract the 4-8 most important keywords or phrases from the text. 
        Focus on substantive topics, not conversational filler.
        Respond with JSON array format only: 
        [{"text": "keyword1", "confidence": "high/medium/low"}, ...] 
        Do not include confidence labels in the text field.
        Do not include explanations or additional text.`;
        
        // Language-specific settings
        this.language = localStorage.getItem('echolife_language') || 'en-US';
        
        // Listen for language changes
        window.addEventListener('languageChanged', (e) => {
            this.language = e.detail.language;
            console.log(`Tag extractor language set to: ${this.language}`);
        });
    }
    
    setApiKey(key) {
        this.apiKey = key;
    }
    
    resetContext() {
        this.context = [];
    }
    
    /**
     * Extract tags from text
     * @param {string} text - The text to extract tags from
     * @param {number} maxTags - Maximum number of tags to extract
     * @param {boolean} trackContext - Whether to track context over time
     * @returns {Promise<Array>} - Array of tags
     */
    async extractTags(text, maxTags = 5, trackContext = true) {
        if (!this.apiKey) {
            throw new Error('API key not set');
        }
        
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return [];
        }
        
        try {
            // Determine the language to use for the prompt
            const promptLanguage = this.language === 'pt-BR' ? 'Portuguese' : 'English';
            
            // Create a more focused prompt for the specific language
            const prompt = `
            Extract ${maxTags} most important keywords or phrases from this ${promptLanguage} text. 
            Focus on substantive topics, not conversational filler.
            Return ONLY JSON array: [{"text": "keyword", "confidence": "high/medium/low"}]
            No explanations or additional text.`;
            
            // Call OpenAI API
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    temperature: 0.3,
                    messages: [
                        { role: 'system', content: prompt },
                        { role: 'user', content: text }
                    ]
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `API error: ${response.status}`);
            }
            
            const result = await response.json();
            const content = result.choices[0].message.content;
            
            // Extract and parse the JSON array
            const tags = this.parseTagsFromResponse(content);
            
            // Filter out any improperly formatted tags
            const cleanedTags = this.cleanTags(tags);
            
            // Track context if requested
            if (trackContext) {
                this.updateContext(cleanedTags);
            }
            
            return cleanedTags;
        } catch (error) {
            console.error('Error extracting tags:', error);
            return [];
        }
    }
    
    /**
     * Clean tags and remove structural elements
     * @param {Array} tags - Array of tag objects
     * @returns {Array} - Cleaned tag objects
     */
    cleanTags(tags) {
        return tags
            .filter(tag => tag && tag.text)
            .map(tag => {
                // Create a clean copy of the tag
                const cleanTag = { ...tag };
                
                // Clean up the text field - remove confidence labels and formatting
                let cleanText = tag.text
                    .replace(/\s*-\s*Confidence:\s*(High|Medium|Low)\s*/gi, '')
                    .replace(/\d+\.\s+/g, '') // Remove numbered list markers
                    .replace(/^['"\s(]|['"\s)]+$/g, '') // Trim quotes/parens/spaces from start/end
                    .trim();
                
                // Limit to 30 characters for display
                if (cleanText.length > 30) {
                    cleanText = cleanText.substring(0, 27) + '...';
                }
                
                cleanTag.text = cleanText;
                
                // Ensure we have a valid confidence value
                if (!['high', 'medium', 'low'].includes(cleanTag.confidence?.toLowerCase())) {
                    cleanTag.confidence = 'medium';
                }
                
                return cleanTag;
            })
            .filter(tag => tag.text.length > 0 && tag.text.length <= 30);
    }
    
    /**
     * Parse tags from OpenAI response
     * @param {string} response - The raw response from OpenAI
     * @returns {Array} - Array of tag objects
     */
    parseTagsFromResponse(response) {
        try {
            // First, try to find and extract JSON array using regex
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e) {
                    console.warn('JSON extraction failed:', e);
                }
            }
            
            // If regex extraction failed, try to parse the entire response as JSON
            try {
                return JSON.parse(response);
            } catch (e) {
                console.warn('Complete response JSON parsing failed:', e);
            }
            
            // Last resort: manual extraction for malformed responses
            // This tries to handle cases where the model returns improperly formatted JSON
            const tagEntries = response
                .split(/[\n,]+/)
                .filter(line => line.includes(':') && 
                              (line.includes('"text"') || 
                               line.includes('"confidence"')));
            
            if (tagEntries.length > 0) {
                console.log('Falling back to manual JSON extraction');
                
                // Extract tag objects from lines
                const manualTags = [];
                let currentTag = {};
                
                for (const line of tagEntries) {
                    if (line.includes('"text"')) {
                        // If we already have a text field and this is a new one, save the current tag
                        if (currentTag.text) {
                            manualTags.push({...currentTag});
                            currentTag = {};
                        }
                        
                        const textMatch = line.match(/"text"\s*:\s*"([^"]*)"/);
                        if (textMatch) {
                            currentTag.text = textMatch[1];
                        }
                    }
                    
                    if (line.includes('"confidence"')) {
                        const confMatch = line.match(/"confidence"\s*:\s*"([^"]*)"/);
                        if (confMatch) {
                            currentTag.confidence = confMatch[1];
                            
                            // If we have both text and confidence, save this tag
                            if (currentTag.text) {
                                manualTags.push({...currentTag});
                                currentTag = {};
                            }
                        }
                    }
                }
                
                // Add the last tag if it's not empty
                if (currentTag.text) {
                    manualTags.push(currentTag);
                }
                
                return manualTags;
            }
            
            // Everything failed, return empty array
            console.error('Tag extraction completely failed for response:', response);
            return [];
            
        } catch (error) {
            console.error('Error parsing tags from response:', error);
            return [];
        }
    }
    
    /**
     * Extract tags for real-time updates during recording
     * @param {string} text - Text to extract tags from
     * @param {number} maxTags - Maximum number of tags to extract
     * @param {string} language - Language code
     * @returns {Promise<Array>} - Array of tag objects
     */
    async extractTagsRealtime(text, maxTags = 5, language = null) {
        if (!this.apiKey) {
            throw new Error('API key not set');
        }
        
        console.log(`[TAG-EXTRACTOR] Starting realtime extraction: ${text.length} chars`);
        console.time('tag-extraction');
        
        // Use specified language or fall back to the default
        const lang = language || this.language;
        
        // For very short text, return placeholder
        if (text.length < 25) {
            console.log(`[TAG-EXTRACTOR] Text too short (${text.length} chars), using placeholder`);
            console.timeEnd('tag-extraction');
            return this.getPlaceholderTags(lang);
        }
        
        try {
            // Check if we can use fallback for quick responses
            const shouldUseFallback = Math.random() < 0.25; // 25% chance to use fallback for faster updates
            
            if (shouldUseFallback && text.length < 500) {
                console.log('[TAG-EXTRACTOR] Using fallback extraction for quick response');
                const fallbackTags = await this.fallbackKeywordExtraction(text, maxTags);
                console.timeEnd('tag-extraction');
                return fallbackTags;
            }
            
            // Improved prompt designed to be more efficient and handle a variety of content
            const prompt = lang === 'pt-BR' 
                ? `Analise este texto e extraia ${maxTags} termos chave. Responda APENAS com JSON: [{"text": "termo", "confidence": "high/medium/low"}]`
                : `Extract ${maxTags} key terms from this text. ONLY respond with JSON: [{"text": "term", "confidence": "high/medium/low"}]`;
            
            console.log(`[TAG-EXTRACTOR] Sending API request with ${text.length} chars of text, language: ${lang}`);
            
            // For realtime updates, use a faster model with more constraints
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    temperature: 0.2,
                    max_tokens: 150,
                    presence_penalty: -0.1, // Discourage verbosity
                    messages: [
                        { role: 'system', content: prompt },
                        { role: 'user', content: text.substring(0, 1000) } // Limit text length for faster response
                    ]
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                console.error(`[TAG-EXTRACTOR] API error: ${error.error?.message || response.status}`);
                throw new Error(error.error?.message || `API error: ${response.status}`);
            }
            
            const result = await response.json();
            const content = result.choices[0].message.content;
            
            console.log(`[TAG-EXTRACTOR] API response received:`, content);
            
            // Extract and parse tags
            const tags = this.parseTagsFromResponse(content);
            console.log(`[TAG-EXTRACTOR] Parsed ${tags.length} tags from response`);
            
            // Clean the tags
            const cleanedTags = this.cleanTags(tags);
            console.log(`[TAG-EXTRACTOR] Cleaned tags (${cleanedTags.length}):`, cleanedTags);
            
            // If we got any valid tags, update the context and return them
            if (cleanedTags.length > 0) {
                this.updateContext(cleanedTags);
                console.timeEnd('tag-extraction');
                return cleanedTags;
            }
            
            console.log('[TAG-EXTRACTOR] No valid tags extracted, falling back to keyword extraction');
            // Fallback to basic keyword extraction if AI extraction failed
            const fallbackTags = await this.fallbackKeywordExtraction(text, maxTags);
            console.log(`[TAG-EXTRACTOR] Fallback extraction produced ${fallbackTags.length} tags:`, fallbackTags);
            console.timeEnd('tag-extraction');
            return fallbackTags;
            
        } catch (error) {
            console.error('[TAG-EXTRACTOR] Error in real-time tag extraction:', error);
            
            // Fallback to basic keyword extraction in case of API errors
            console.log('[TAG-EXTRACTOR] Using fallback keyword extraction due to error');
            const fallbackTags = await this.fallbackKeywordExtraction(text, maxTags);
            console.timeEnd('tag-extraction');
            return fallbackTags;
        }
    }
    
    /**
     * Fallback method to extract keywords without API
     * @param {string} text - Text to extract keywords from
     * @param {number} maxWords - Maximum number of keywords
     * @returns {Array} - Array of tag objects
     */
    fallbackKeywordExtraction(text, maxWords = 5) {
        try {
            // Define stop words for English and Portuguese
            const stopWords = {
                'en-US': ['i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
                         'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 
                         'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 
                         'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 
                         'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 
                         'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 
                         'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 
                         'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 
                         'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 
                         'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 
                         'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 
                         'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now', 'd', 
                         'll', 'm', 'o', 're', 've', 'y', 'ain', 'aren', 'couldn', 'didn', 'doesn', 'hadn', 
                         'hasn', 'haven', 'isn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn', 
                         'weren', 'won', 'wouldn', 'know', 'think', 'like', 'said', 'actually', 'really',
                         'pretty', 'kind', 'okay', 'yeah', 'yes', 'no', 'hey', 'hi', 'hello', 'ok', 'sure'],
                         
                'pt-BR': ['a', 'à', 'ao', 'aos', 'aquela', 'aquelas', 'aquele', 'aqueles', 'aquilo', 'as', 'às', 
                         'até', 'com', 'como', 'da', 'das', 'de', 'dela', 'delas', 'dele', 'deles', 'depois', 
                         'do', 'dos', 'e', 'é', 'ela', 'elas', 'ele', 'eles', 'em', 'entre', 'era', 'eram', 
                         'éramos', 'essa', 'essas', 'esse', 'esses', 'esta', 'está', 'estamos', 'estão', 
                         'estas', 'estava', 'estavam', 'estávamos', 'este', 'esteja', 'estejam', 'estejamos', 
                         'estes', 'esteve', 'estive', 'estivemos', 'estiver', 'estivera', 'estiveram', 
                         'estiverem', 'estivermos', 'estou', 'eu', 'foi', 'fomos', 'for', 'fora', 'foram', 
                         'forem', 'formos', 'fosse', 'fossem', 'fôssemos', 'fui', 'há', 'haja', 'hajam', 
                         'hajamos', 'hão', 'havemos', 'havia', 'hei', 'houve', 'houvemos', 'houver', 'houvera', 
                         'houveram', 'houverei', 'houverem', 'houveremos', 'houveria', 'houveriam', 
                         'houvermos', 'houverá', 'houverão', 'houveríamos', 'houverão', 'isso', 'isto', 'já', 
                         'lhe', 'lhes', 'mais', 'mas', 'me', 'mesmo', 'meu', 'meus', 'minha', 'minhas', 'muito', 
                         'na', 'nas', 'nem', 'no', 'nos', 'nós', 'nossa', 'nossas', 'nosso', 'nossos', 'num', 
                         'numa', 'o', 'os', 'ou', 'para', 'pela', 'pelas', 'pelo', 'pelos', 'por', 'qual', 
                         'quando', 'que', 'quem', 'são', 'se', 'seja', 'sejam', 'sejamos', 'sem', 'será', 
                         'serão', 'seria', 'seriam', 'seríamos', 'seu', 'seus', 'só', 'somos', 'sou', 'sua', 
                         'suas', 'também', 'te', 'tem', 'tém', 'temos', 'tenha', 'tenham', 'tenhamos', 'tenho', 
                         'terá', 'terão', 'terei', 'teremos', 'teria', 'teriam', 'teríamos', 'teu', 'teus', 
                         'teve', 'tinha', 'tinham', 'tínhamos', 'tive', 'tivemos', 'tiver', 'tivera', 'tiveram', 
                         'tiverem', 'tivermos', 'tu', 'tua', 'tuas', 'um', 'uma', 'você', 'vocês', 'vos', 'sim', 
                         'então', 'vamos', 'ok', 'né', 'tipo']
            };
            
            // Select stop words based on language
            const currentStopWords = stopWords[this.language] || stopWords['en-US'];
            
            // Tokenize
            const words = text.toLowerCase()
                             .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
                             .split(/\s+/)              // Split on whitespace
                             .filter(word => word.length > 2 && !currentStopWords.includes(word));
            
            // Count word frequencies
            const wordCounts = {};
            words.forEach(word => {
                wordCounts[word] = (wordCounts[word] || 0) + 1;
            });
            
            // Convert to array of {word, count} objects and sort by count
            const sortedWords = Object.entries(wordCounts)
                .map(([word, count]) => ({ word, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, maxWords);
            
            // Convert to tag objects
            return sortedWords.map(({ word, count }) => ({
                text: word,
                confidence: count > 3 ? 'high' : (count > 1 ? 'medium' : 'low'),
                count: count
            }));
        } catch (error) {
            console.error('Error in fallback keyword extraction:', error);
            return this.getPlaceholderTags(this.language);
        }
    }
    
    // Helper to return placeholder tags based on language
    getPlaceholderTags(language) {
        if (language === 'pt-BR') {
            return [
                { text: 'Analisando...', confidence: 'medium', count: 1 }
            ];
        } else {
            return [
                { text: 'Analyzing...', confidence: 'medium', count: 1 }
            ];
        }
    }
    
    /**
     * Update stored context with new tags
     * @param {Array} newTags - Array of new tag objects
     */
    updateContext(newTags) {
        if (!newTags || newTags.length === 0) return;
        
        // Keep context limited to most recent tags
        this.context = this.context.slice(0, 20);
        
        // Update existing tags or add new ones
        for (const newTag of newTags) {
            const existingTagIndex = this.context.findIndex(
                t => t.text.toLowerCase() === newTag.text.toLowerCase()
            );
            
            if (existingTagIndex >= 0) {
                // Update existing tag
                const existingTag = this.context[existingTagIndex];
                
                // Mark as changing context if confidence has changed
                if (existingTag.confidence !== newTag.confidence) {
                    newTag.status = 'changing';
                }
                
                // Update the existing tag
                this.context[existingTagIndex] = {
                    ...newTag,
                    count: (existingTag.count || 1) + 1,
                    lastUpdated: Date.now()
                };
            } else {
                // Add new tag
                this.context.push({
                    ...newTag,
                    count: 1,
                    lastUpdated: Date.now(),
                    status: 'new'
                });
            }
        }
        
        // Sort by count (descending)
        this.context.sort((a, b) => (b.count || 0) - (a.count || 0));
    }
}

// Create a global instance
const tagExtractor = new TagExtractor();

// Make it globally available
window.tagExtractor = tagExtractor;
