class TagExtractor {
    constructor() {
        this.apiKey = null;
        this.contextHistory = [];
        this.tagConfidence = new Map(); // Track confidence for tags over time
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    // Reset all context history
    resetContext() {
        this.contextHistory = [];
        this.tagConfidence.clear();
    }

    // Get currently accumulated context as a prompt
    getContextPrompt() {
        if (this.contextHistory.length === 0) {
            return "";
        }
        
        return "Previous context: " + this.contextHistory.slice(-3).join(" ");
    }

    async extractTags(text, maxTags = 8, useContext = true) {
        if (!this.apiKey) {
            throw new Error('API key not set for tag extraction');
        }

        if (!text || text.trim().length < 10) {
            return [{text: 'Too short', confidence: 'low'}];
        }

        try {
            // Accumulate context from multiple extractions
            const contextPrompt = useContext ? this.getContextPrompt() : "";
            
            // Using OpenAI's cheaper model for tag extraction
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo', // Using a cheaper model for tag extraction
                    messages: [
                        {
                            role: 'system',
                            content: `Extract ${maxTags} key tags, contexts, or concepts from the following text. 
                            ${contextPrompt}
                            For each tag, assess its confidence level (high, medium, or low) based on how clearly it relates to the text.
                            Return a JSON array of objects with "text" and "confidence" properties.
                            Example: [{"text": "health", "confidence": "high"}, {"text": "data privacy", "confidence": "medium"}]`
                        },
                        {
                            role: 'user',
                            content: text
                        }
                    ],
                    max_tokens: 200,
                    temperature: 0.3
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Tag extraction error: ${error.error?.message || response.statusText}`);
            }
            
            const data = await response.json();
            const tagResponse = data.choices[0].message.content;
            
            // Parse the JSON response
            let tags = [];
            try {
                // Handle different response formats
                if (tagResponse.includes('[') && tagResponse.includes(']')) {
                    const jsonString = tagResponse.substring(
                        tagResponse.indexOf('['),
                        tagResponse.lastIndexOf(']') + 1
                    );
                    tags = JSON.parse(jsonString);
                } else {
                    // Fallback if not properly formatted JSON
                    tags = tagResponse.split(',')
                        .map(tag => ({
                            text: tag.trim(),
                            confidence: 'medium'
                        }))
                        .filter(tag => tag.text)
                        .slice(0, maxTags);
                }
            } catch (e) {
                console.error('Error parsing tags:', e);
                // Simple fallback: split by commas or new lines
                tags = tagResponse.split(/[,\n]/)
                    .map(tag => ({
                        text: tag.trim(),
                        confidence: 'medium'
                    }))
                    .filter(tag => tag.text && !tag.text.includes('{') && !tag.text.includes('}'))
                    .slice(0, maxTags);
            }
            
            // Update context with this extraction
            if (useContext && tags.length > 0) {
                // Add to context history - just use the text of highest confidence tags
                const contextUpdate = tags
                    .filter(tag => tag.confidence === 'high')
                    .map(tag => tag.text)
                    .join(", ");
                
                if (contextUpdate) {
                    this.contextHistory.push(contextUpdate);
                    // Keep context history manageable
                    if (this.contextHistory.length > 10) {
                        this.contextHistory.shift();
                    }
                }
                
                // Update confidence tracking for all tags
                tags = this.trackTagConfidence(tags);
            }
            
            return tags;
        } catch (error) {
            console.error('Error extracting tags:', error);
            return [{text: 'Error extracting tags', confidence: 'low'}];
        }
    }
    
    // Real-time tag extraction during speech - simpler, faster version
    async extractTagsRealtime(partialText, maxTags = 5) {
        if (!this.apiKey || !partialText || partialText.trim().length < 5) {
            return [{text: 'Listening...', confidence: 'low'}];
        }
        
        try {
            // Use a more efficient prompt for real-time extraction
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo', 
                    messages: [
                        {
                            role: 'system',
                            content: `Extract up to ${maxTags} key topics from this partial speech. 
                            Return only a JSON array of single words or short phrases.
                            Example: ["health", "finance", "future plans"]`
                        },
                        {
                            role: 'user',
                            content: partialText
                        }
                    ],
                    max_tokens: 50,
                    temperature: 0.3
                })
            });
            
            if (!response.ok) {
                throw new Error('Real-time tag extraction failed');
            }
            
            const data = await response.json();
            let tagResponse = data.choices[0].message.content;
            
            // Parse the response
            let tags = [];
            try {
                if (tagResponse.includes('[') && tagResponse.includes(']')) {
                    const jsonString = tagResponse.substring(
                        tagResponse.indexOf('['),
                        tagResponse.lastIndexOf(']') + 1
                    );
                    const rawTags = JSON.parse(jsonString);
                    tags = rawTags.map(text => ({
                        text: text,
                        confidence: 'medium' // Default for real-time
                    }));
                } else {
                    tags = [{text: 'Processing...', confidence: 'low'}];
                }
            } catch (e) {
                tags = [{text: 'Processing...', confidence: 'low'}];
            }
            
            return tags;
        } catch (error) {
            console.error('Real-time tag extraction error:', error);
            return [{text: 'Listening...', confidence: 'low'}];
        }
    }
    
    // Track tag confidence over time
    trackTagConfidence(newTags) {
        // For each new tag, update its confidence based on history
        newTags.forEach(tag => {
            const tagText = tag.text.toLowerCase();
            
            if (this.tagConfidence.has(tagText)) {
                const currentInfo = this.tagConfidence.get(tagText);
                currentInfo.count++;
                
                // If it was already seen with high confidence, keep it high
                if (currentInfo.confidence === 'high') {
                    tag.confidence = 'high';
                    tag.status = 'consistent';
                } 
                // If confidence is improving
                else if (tag.confidence === 'high' && currentInfo.confidence !== 'high') {
                    tag.status = 'improving';
                    currentInfo.confidence = 'high';
                }
                // If confidence is decreasing
                else if (tag.confidence === 'low' && currentInfo.confidence === 'high') {
                    tag.status = 'changing';
                    tag.confidence = 'medium'; // Don't drop too quickly
                }
                // Update the stored confidence if the new one is higher
                else if (
                    (tag.confidence === 'high' && currentInfo.confidence !== 'high') ||
                    (tag.confidence === 'medium' && currentInfo.confidence === 'low')
                ) {
                    currentInfo.confidence = tag.confidence;
                }
                
                this.tagConfidence.set(tagText, currentInfo);
            } else {
                // First time seeing this tag
                this.tagConfidence.set(tagText, {
                    confidence: tag.confidence,
                    count: 1,
                    firstSeen: Date.now()
                });
                tag.status = 'new';
            }
        });
        
        return newTags;
    }
}

// Create a global instance of the tag extractor
const tagExtractor = new TagExtractor();
