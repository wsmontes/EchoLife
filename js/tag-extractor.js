class TagExtractor {
    constructor() {
        this.apiKey = null;
        this.contextHistory = [];
        this.tagConfidence = new Map(); // maps tag -> {text, confidence, count, lastUpdated, group}
        // New decay threshold in ms for realtime updates
        this.realtimeDecayThreshold = 3000;
    }

    setApiKey(key) {
        this.apiKey = key;
    }

    resetContext() {
        this.contextHistory = [];
        this.tagConfidence.clear();
    }

    getContextPrompt() {
        if (this.contextHistory.length === 0) return "";
        return "Previous context: " + this.contextHistory.slice(-3).join(" ");
    }

    // New helper to determine a tag group based on simple keyword matching.
    determineGroup(text) {
        const lower = text.toLowerCase();
        if (lower.includes("health") || lower.includes("fitness") || lower.includes("wellness")) {
            return "health";
        } else if (lower.includes("money") || lower.includes("finance") || lower.includes("invest")) {
            return "finance";
        } else if (lower.includes("tech") || lower.includes("ai") || lower.includes("machine") || lower.includes("software")) {
            return "technology";
        }
        return "other";
    }
    
    async extractTags(text, maxTags = 8, useContext = true) {
        if (!this.apiKey) {
            throw new Error('API key not set for tag extraction');
        }
        if (!text || text.trim().length < 10) {
            return [{text: 'Too short', confidence: 'low', count: 1, group: "other"}];
        }
        try {
            const contextPrompt = useContext ? this.getContextPrompt() : "";
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
                            content: `Extract ${maxTags} key tags, contexts, or concepts from the following text. 
${contextPrompt}
For each tag, assess its confidence level (high, medium, or low) based on how clearly it relates to the text.
Return a JSON array of objects with "text" and "confidence" properties.`
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
            let tags = [];
            try {
                if (tagResponse.includes('[') && tagResponse.includes(']')) {
                    const jsonString = tagResponse.substring(
                        tagResponse.indexOf('['),
                        tagResponse.lastIndexOf(']') + 1
                    );
                    tags = JSON.parse(jsonString);
                } else {
                    tags = tagResponse.split(',')
                        .map(tag => ({ text: tag.trim(), confidence: 'medium' }))
                        .filter(tag => tag.text)
                        .slice(0, maxTags);
                }
            } catch (e) {
                console.error('Error parsing tags:', e);
                tags = tagResponse.split(/[,\n]/)
                    .map(tag => ({ text: tag.trim(), confidence: 'medium' }))
                    .filter(tag => tag.text && !tag.text.includes('{') && !tag.text.includes('}'))
                    .slice(0, maxTags);
            }
            if (useContext && tags.length > 0) {
                const contextUpdate = tags.filter(tag => tag.confidence === 'high')
                    .map(tag => tag.text)
                    .join(", ");
                if (contextUpdate) {
                    this.contextHistory.push(contextUpdate);
                    if (this.contextHistory.length > 10) { this.contextHistory.shift(); }
                }
                // Merge new tags into our tagConfidence store
                tags = this.trackTagConfidence(tags);
            }
            return tags;
        } catch (error) {
            console.error('Error extracting tags:', error);
            return [{text: 'Error extracting tags', confidence: 'low', count: 1, group: "other"}];
        }
    }
    
    // Modified merge function for realtime smoothing and decay
    trackTagConfidence(newTags) {
        const now = Date.now();
        // Update or add new tags
        newTags.forEach(tag => {
            const tagText = tag.text.toLowerCase();
            if (this.tagConfidence.has(tagText)) {
                let info = this.tagConfidence.get(tagText);
                info.count = info.count + 1;  // increment smoothly
                info.lastUpdated = now;
                if (tag.confidence === 'high') info.confidence = 'high';
                info.group = this.determineGroup(tag.text);
                this.tagConfidence.set(tagText, info);
            } else {
                this.tagConfidence.set(tagText, {
                    text: tag.text,
                    confidence: tag.confidence,
                    count: 1,
                    lastUpdated: now,
                    group: this.determineGroup(tag.text)
                });
            }
        });
        // Decay tags that were not refreshed recently
        for (let [key, info] of this.tagConfidence) {
            const delta = now - info.lastUpdated;
            if (delta > this.realtimeDecayThreshold) {
                // reduce count gradually (e.g. subtract 1 for each threshold period elapsed)
                const decayUnits = Math.floor(delta / this.realtimeDecayThreshold);
                info.count = info.count - decayUnits;
                if (info.count <= 0) {
                    this.tagConfidence.delete(key);
                    continue;
                } else {
                    // update lastUpdated to a later time so counting is smooth
                    info.lastUpdated = now - (delta % this.realtimeDecayThreshold);
                    this.tagConfidence.set(key, info);
                }
            }
        }
        return Array.from(this.tagConfidence.values());
    }

    async extractTagsRealtime(partialText, maxTags = 5) {
        if (!this.apiKey || !partialText || partialText.trim().length < 5) {
            return [{text: 'Listening...', confidence: 'low', count: 1, group: "other"}];
        }
        try {
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
Return only a JSON array of single words or short phrases.`
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
                        confidence: 'medium',
                        count: 1,
                        group: this.determineGroup(text)
                    }));
                } else {
                    tags = [{text: 'Processing...', confidence: 'low', count: 1, group: "other"}];
                }
            } catch (e) {
                tags = [{text: 'Processing...', confidence: 'low', count: 1, group: "other"}];
            }
            // Merge into our overall tagConfidence store
            tags = this.trackTagConfidence(tags);
            return tags;
        } catch (error) {
            console.error('Real-time tag extraction error:', error);
            return [{text: 'Listening...', confidence: 'low', count: 1, group: "other"}];
        }
    }
}

// Create a global instance of the tag extractor
const tagExtractor = new TagExtractor();
