// Initialize the chat service with an API key
function initializeChatService() {
    // Try to get API key from localStorage first
    const savedApiKey = localStorage.getItem('openai_api_key');
    
    if (savedApiKey) {
        console.log('API key found in localStorage');
        chatService.setApiKey(savedApiKey);
        transcriptionService.setApiKey(savedApiKey);
        tagExtractor.setApiKey(savedApiKey);
    } else {
        // If no saved API key, prompt the user
        const apiKey = prompt('Please enter your OpenAI API key:');
        if (apiKey) {
            console.log('New API key provided');
            chatService.setApiKey(apiKey);
            transcriptionService.setApiKey(apiKey);
            tagExtractor.setApiKey(apiKey);
            // Save for future use
            localStorage.setItem('openai_api_key', apiKey);
        } else {
            console.error('No API key provided!');
            alert('An OpenAI API key is required to use this application.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing application...');
    initializeChatService();
    
    console.log('Audio interface initialized');

    // DOM elements
    const recordButton = document.getElementById('recordButton');
    const recordingStatus = document.getElementById('recordingStatus');
    const recordingIndicator = document.getElementById('recordingIndicator');
    const chatContainer = document.getElementById('chatContainer');
    const aiTagsContainer = document.getElementById('aiTagsContainer');
    const feedbackButton = document.getElementById('feedbackButton');
    
    // State variables
    let apiKey = localStorage.getItem('openai_api_key');
    let isProcessingAudio = false;
    let currentTranscript = "";
    let lastTagUpdateTime = 0;
    let tagUpdateInterval = null;
    let partialTranscript = "";
    let recognizedSpeech = false;
    
    // Initialize with API key
    if (!apiKey) {
        promptForApiKey();
    } else {
        initializeWithApiKey(apiKey);
    }
    
    // Event listeners
    recordButton.addEventListener('click', toggleRecording);
    feedbackButton.addEventListener('click', requestAIFeedback);
    
    // Functions
    function promptForApiKey() {
        const key = prompt('Please enter your OpenAI API key:');
        if (key) {
            localStorage.setItem('openai_api_key', key);
            initializeWithApiKey(key);
        } else {
            alert('API key is required to use this application.');
        }
    }
    
    function initializeWithApiKey(key) {
        transcriptionService.setApiKey(key);
        chatService.setApiKey(key);
        tagExtractor.setApiKey(key);
        
        // Enable conversational mode by default for more engaging responses
        chatService.setConversationMode(true);
        
        // Initialize SpeechRecognition for real-time transcription if available
        initializeSpeechRecognition();
    }
    
    // Initialize speech recognition for real-time tag updates
    function initializeSpeechRecognition() {
        if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
            window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            window.speechRecognition = new SpeechRecognition();
            window.speechRecognition.continuous = true;
            window.speechRecognition.interimResults = true;
            window.speechRecognition.lang = 'en-US';
            
            window.speechRecognition.onresult = (event) => {
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        partialTranscript += event.results[i][0].transcript + ' ';
                        recognizedSpeech = true;
                    } else {
                        interimTranscript += event.results[i][0].transcript;
                    }
                }
                
                // Use only the interim transcript for real-time tag extraction
                handleRealtimeSpeech(interimTranscript);
            };
            
            window.speechRecognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
            };
            
            console.log('Speech recognition initialized');
        } else {
            console.warn('Speech recognition not supported - will use periodic updates instead');
        }
    }
    
    // Handle real-time speech updates for tag extraction
    async function handleRealtimeSpeech(text) {
        const now = Date.now();
        
        // Don't update tags too frequently - at most once every 1.5 seconds
        if (now - lastTagUpdateTime > 1500 && text.length > 10) {
            lastTagUpdateTime = now;
            updateRealtimeTags(text);
        }
    }
    
    // Update tags in real-time during speech
    async function updateRealtimeTags(text) {
        try {
            // Extract tags from the partial transcript
            const tags = await tagExtractor.extractTagsRealtime(text);
            
            // Update word cloud instead of using tag display
            if (window.wordCloud) {
                window.wordCloud.updateWordCloud(tags);
            }
            
            // Enable feedback button if we have speech
            if (recognizedSpeech) {
                feedbackButton.disabled = false;
            }
        } catch (error) {
            console.error('Error updating real-time tags:', error);
        }
    }
    
    async function toggleRecording() {
        if (isProcessingAudio) return;
        
        if (!audioRecorder.isRecording) {
            // Reset for new recording
            currentTranscript = "";
            partialTranscript = "";
            recognizedSpeech = false;
            tagExtractor.resetContext();
            
            // Clear existing messages
            chatContainer.innerHTML = '';
            
            // Clear the AI tags display
            aiTagsContainer.innerHTML = '<span class="tag-placeholder">Tags from AI responses will appear here</span>';
            
            const started = await audioRecorder.startRecording();
            if (started) {
                recordingStatus.textContent = 'Recording... Click to stop';
                recordingIndicator.classList.remove('hidden');
                feedbackButton.disabled = true;
                
                // Start real-time speech recognition if available
                if (window.speechRecognition) {
                    try {
                        window.speechRecognition.start();
                    } catch (e) {
                        console.error('Error starting speech recognition:', e);
                    }
                } else {
                    // Fallback: periodic updates for tags
                    tagUpdateInterval = setInterval(() => {
                        // Not implemented - would require partial results from audioRecorder
                        // which isn't currently available
                    }, 3000);
                }
            } else {
                alert('Could not access microphone. Please check permissions.');
            }
        } else {
            isProcessingAudio = true;
            recordButton.classList.remove('recording');
            recordingIndicator.classList.add('hidden');
            
            // Stop the speech recognition
            if (window.speechRecognition) {
                try {
                    window.speechRecognition.stop();
                } catch (e) {
                    console.error('Error stopping speech recognition:', e);
                }
            }
            
            // Clear any interval if it was set
            if (tagUpdateInterval) {
                clearInterval(tagUpdateInterval);
                tagUpdateInterval = null;
            }
            
            // Show processing state
            recordingStatus.textContent = 'Processing...';
            recordButton.disabled = true;
            recordButton.classList.add('processing');
            
            const audioBlob = await audioRecorder.stopRecording();
            
            if (audioBlob) {
                try {
                    // Get the transcript
                    currentTranscript = await transcriptionService.transcribeAudio(audioBlob);
                    
                    // Extract tags from the full transcript
                    const tags = await tagExtractor.extractTags(currentTranscript, 8, true);
                    
                    // Update word cloud instead of traditional tag display
                    if (window.wordCloud) {
                        window.wordCloud.updateWordCloud(tags);
                    }
                    
                    // Add it to the chat as a user message
                    addMessageToChat('user', currentTranscript);
                    
                    // Enable the feedback button
                    feedbackButton.disabled = false;
                    
                    // Save the recording to history without AI response yet
                    if (window.audioHandler) {
                        window.audioHandler.addRecordingToHistory(
                            new File([audioBlob], "recording.webm", { type: "audio/webm" }),
                            currentTranscript
                        );
                    }
                } catch (error) {
                    console.error('Error processing audio:', error);
                    alert('Error: ' + error.message);
                    feedbackButton.disabled = true;
                } finally {
                    // Reset the recording UI
                    recordingStatus.textContent = 'Click to start recording';
                    recordButton.disabled = false;
                    recordButton.classList.remove('processing');
                    isProcessingAudio = false;
                }
            } else {
                recordingStatus.textContent = 'No audio recorded. Try again.';
                recordButton.disabled = false;
                recordButton.classList.remove('processing');
                isProcessingAudio = false;
                feedbackButton.disabled = true;
            }
        }
    }
    
    // Request AI feedback when button is clicked
    async function requestAIFeedback() {
        if (!currentTranscript || feedbackButton.disabled) {
            return;
        }
        
        try {
            // Show loading state
            feedbackButton.disabled = true;
            feedbackButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            // Get AI response
            const response = await chatService.sendMessage(currentTranscript, { conversationalResponse: true });
            
            // Extract tags from AI response
            const aiTags = await tagExtractor.extractTags(response, 8, false);
            
            // Update word cloud with AI tags
            if (window.wordCloud) {
                window.wordCloud.updateWordCloud(aiTags);
            }
            
            // Add AI response to chat
            addMessageToChat('assistant', response);
            
            // Update any history records with this response
            if (window.audioHandler) {
                window.audioHandler.updateCurrentHistoryWithResponse(response);
            }
        } catch (error) {
            console.error('Error getting AI feedback:', error);
            alert('Error getting AI feedback: ' + error.message);
        } finally {
            // Reset button
            feedbackButton.disabled = false;
            feedbackButton.innerHTML = '<i class="fas fa-comment-dots"></i> Get AI Feedback';
        }
    }
    
    function addMessageToChat(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${role}-message`);
        messageDiv.textContent = content;
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to bottom
    }
    
    // Display tags with confidence indicators
    function displayTags(tags, container) {
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        if (!tags || tags.length === 0) {
            container.innerHTML = '<span class="tag-placeholder">No tags extracted</span>';
            return;
        }
        
        tags.forEach((tag, index) => {
            const tagElement = document.createElement('span');
            
            // Base class
            let tagClasses = 'tag';
            
            // Add confidence class
            if (tag.confidence) {
                tagClasses += ` ${tag.confidence}-confidence`;
            }
            
            // Add status-based classes if available
            if (tag.status) {
                if (tag.status === 'new') {
                    tagClasses += ' new-context';
                } else if (tag.status === 'changing') {
                    tagClasses += ' changing-context';
                }
            }
            
            tagElement.className = tagClasses;
            tagElement.textContent = tag.text || tag;
            
            // Add a slight delay for staggered animation
            tagElement.style.animationDelay = `${index * 0.1}s`;
            
            // Add pulse effect when tags update
            setTimeout(() => {
                tagElement.classList.add('pulse');
                setTimeout(() => tagElement.classList.remove('pulse'), 1000);
            }, index * 100 + 500);
            
            container.appendChild(tagElement);
        });
    }
    
    // Make these functions available globally
    window.addMessageToChat = addMessageToChat;
    window.displayTags = displayTags;
});
