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
    
    async extractTags(text, maxTags = 8, useContext = true, language = null) {
        if (!this.apiKey) {
            throw new Error('API key not set for tag extraction');
        }
        if (!text || text.trim().length < 10) {
            return [{text: 'Too short', confidence: 'low', count: 1, group: "other"}];
        }
        
        // Get the current app language and translation settings
        if (!language) {
            // Get language from translation controller if available
            if (window.translationController) {
                const settings = window.translationController.getSettings();
                // Use the actual language of the text, which depends on translation setting
                language = settings.translateEnabled ? settings.targetLanguage : settings.language;
            } else {
                language = localStorage.getItem('echolife_language') || 'en-US';
            }
        }
        
        try {
            const contextPrompt = useContext ? this.getContextPrompt() : "";
            const isPortuguese = language === 'pt-BR';
            
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
                            content: `${isPortuguese ? 
                                `Extraia ${maxTags} tags, contextos ou conceitos chave do seguinte texto.
                                ${contextPrompt}
                                Para cada tag, avalie seu nível de confiança (alto, médio ou baixo) com base em quão claramente ela se relaciona com o texto.
                                Retorne um array JSON de objetos com propriedades "text" e "confidence".` :
                                
                                `Extract ${maxTags} key tags, contexts, or concepts from the following text. 
                                ${contextPrompt}
                                For each tag, assess its confidence level (high, medium, or low) based on how clearly it relates to the text.
                                Return a JSON array of objects with "text" and "confidence" properties.`}`
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
            
            // Rest of parsing logic remains the same
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
            // Log each tag
            tags.forEach(tag => console.log(tag));
            return tags;
        } catch (error) {
            console.error('Error extracting tags:', error);
            const errorMessage = language === 'pt-BR' ? 'Erro ao extrair tags' : 'Error extracting tags';
            return [{text: errorMessage, confidence: 'low', count: 1, group: "other"}];
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

    async extractTagsRealtime(partialText, maxTags = 5, language = null) {
        if (!this.apiKey || !partialText || partialText.trim().length < 5) {
            const placeholderText = language === 'pt-BR' ? 'Ouvindo...' : 'Listening...';
            return [{text: placeholderText, confidence: 'low', count: 1, group: "other"}];
        }
        
        // Get the current app language and translation settings
        if (!language) {
            // Get language from translation controller if available
            if (window.translationController) {
                const settings = window.translationController.getSettings();
                // Use the actual language of the text, which depends on translation setting
                language = settings.translateEnabled ? settings.targetLanguage : settings.language;
            } else {
                language = localStorage.getItem('echolife_language') || 'en-US';
            }
        }
        
        try {
            // Use context history if available for better continuity
            const contextPrompt = this.contextHistory.length > 0 ? 
                "Previous context: " + this.contextHistory.slice(-2).join(" ") : "";
            
            const isPortuguese = language === 'pt-BR';
            
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
                            content: `${isPortuguese ? 
                                `Extraia até ${maxTags} tópicos chave deste discurso parcial.
                                ${contextPrompt}
                                Para cada tópico, avalie seu nível de confiança com base na clareza e contexto.
                                Retorne um array JSON com objetos contendo:
                                - "text": o termo do tópico
                                - "confidence": "high", "medium", ou "low"
                                - "uncertain": true se você não tiver certeza sobre o significado/contexto

                                Exemplo: [{"text": "aprendizado de máquina", "confidence": "high"}, 
                                          {"text": "redes neurais?", "confidence": "low", "uncertain": true}]

                                Adicione um ponto de interrogação a termos incertos. Seja mais conservador com os níveis de confiança durante o discurso parcial.` :
                                
                                `Extract up to ${maxTags} key topics from this partial speech.
                                ${contextPrompt}
                                For each topic, assess your confidence level based on clarity and context.
                                Return a JSON array with objects having:
                                - "text": the topic term
                                - "confidence": "high", "medium", or "low"
                                - "uncertain": true if you're unsure about the meaning/context

                                Example: [{"text": "machine learning", "confidence": "high"}, 
                                          {"text": "neural networks?", "confidence": "low", "uncertain": true}]

                                Append a question mark to uncertain terms. Be more conservative with confidence levels during partial speech.`}`
                        },
                        {
                            role: 'user',
                            content: partialText
                        }
                    ],
                    max_tokens: 150,
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
                    
                    // Process the tags to handle uncertainty markers
                    tags = rawTags.map(tag => {
                        // Set the base text - if it already has a question mark from the API, use as is
                        let text = tag.text;
                        
                        // Add uncertainty indicator if flagged but not already included
                        if (tag.uncertain === true && !text.endsWith('?')) {
                            text = text + '?';
                        }
                        
                        // Normalize confidence
                        let confidence = tag.confidence ? tag.confidence.toLowerCase() : 'medium';
                        
                        // If the term is uncertain, never rate it higher than medium
                        if (tag.uncertain === true && confidence === 'high') {
                            confidence = 'medium';
                        }
                        
                        return {
                            text: text,
                            confidence: confidence,
                            count: 1,
                            group: this.determineGroup(text),
                            uncertain: tag.uncertain === true
                        };
                    });
                } else {
                    tags = [{text: 'Processing...', confidence: 'low', count: 1, group: "other"}];
                }
            } catch (e) {
                console.error('Error parsing real-time tags:', e);
                const processingText = language === 'pt-BR' ? 'Processando...' : 'Processing...';
                tags = [{text: processingText, confidence: 'low', count: 1, group: "other"}];
            }
            
            // Merge into our overall tagConfidence store with uncertainty handling
            tags = this.trackTagConfidenceWithUncertainty(tags);
            // Log each tag
            tags.forEach(tag => console.log(tag));
            return tags;
        } catch (error) {
            console.error('Real-time tag extraction error:', error);
            const listeningText = language === 'pt-BR' ? 'Ouvindo...' : 'Listening...';
            return [{text: listeningText, confidence: 'low', count: 1, group: "other"}];
        }
    }
    
    // Enhanced version for tracking confidence with uncertainty handling
    trackTagConfidenceWithUncertainty(newTags) {
        const now = Date.now();
        
        // Update or add new tags
        newTags.forEach(tag => {
            const tagText = tag.text.toLowerCase();
            const isUncertain = tag.uncertain === true || tagText.endsWith('?');
            
            // Base text without question mark for uncertainty
            const baseText = isUncertain ? tagText.replace(/\?$/, '') : tagText;
            
            if (this.tagConfidence.has(baseText)) {
                let info = this.tagConfidence.get(baseText);
                
                // Update count based on confidence and uncertainty
                if (tag.confidence === 'high' && !isUncertain) {
                    info.count = info.count + 1.5;  // Boost high confidence terms
                } else if (tag.confidence === 'low' || isUncertain) {
                    info.count = info.count + 0.5;  // Reduce impact of uncertain terms
                } else {
                    info.count = info.count + 1;  // Medium confidence
                }
                
                // Refresh the timestamp
                info.lastUpdated = now;
                
                // Update confidence level if new one is higher
                if (tag.confidence === 'high' && info.confidence !== 'high') {
                    info.confidence = 'high';
                }
                
                // Update uncertain state - if we were uncertain before but now we're certain, remove uncertainty
                if (info.uncertain && !isUncertain && tag.confidence !== 'low') {
                    info.uncertain = false;
                    info.text = baseText; // Remove question mark
                } 
                // If we're uncertain now, mark it
                else if (isUncertain) {
                    info.uncertain = true;
                    info.text = baseText + '?'; // Add question mark
                }
                
                // Update group if needed
                info.group = this.determineGroup(baseText);
                
                this.tagConfidence.set(baseText, info);
            } else {
                // For new tags, check if there's a version without question mark
                const textWithoutQuestion = tagText.replace(/\?$/, '');
                
                if (isUncertain && this.tagConfidence.has(textWithoutQuestion)) {
                    // If we already have the base term, just update it to be uncertain
                    let info = this.tagConfidence.get(textWithoutQuestion);
                    info.uncertain = true;
                    info.text = textWithoutQuestion + '?';
                    info.lastUpdated = now;
                    this.tagConfidence.set(textWithoutQuestion, info);
                } else {
                    // Completely new tag
                    this.tagConfidence.set(baseText, {
                        text: isUncertain ? baseText + '?' : baseText,
                        confidence: tag.confidence,
                        count: tag.confidence === 'high' ? 1.5 : (tag.confidence === 'low' ? 0.5 : 1),
                        lastUpdated: now,
                        group: this.determineGroup(baseText),
                        uncertain: isUncertain
                    });
                }
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
        
        // Add a special visual indicator class for uncertain terms
        return Array.from(this.tagConfidence.values()).map(tag => {
            if (tag.uncertain) {
                tag.status = 'uncertain';
            }
            return tag;
        });
    }
}

// Create a global instance of the tag extractor
const tagExtractor = new TagExtractor();
