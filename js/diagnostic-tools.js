/**
 * Diagnostic tools for Echo Life app
 * Provides functions to test API connectivity and audio functionality
 */

document.addEventListener('DOMContentLoaded', () => {
    const testWhisperButton = document.getElementById('testWhisperButton');
    const testWhisperResult = document.getElementById('testWhisperResult');
    
    if (testWhisperButton) {
        testWhisperButton.addEventListener('click', async () => {
            try {
                // Get current language for localized messages
                const language = localStorage.getItem('echolife_language') || 'en-US';
                
                testWhisperButton.disabled = true;
                testWhisperButton.textContent = language === 'pt-BR' ? 'Testando...' : 'Testing...';
                testWhisperResult.textContent = '';
                testWhisperResult.style.display = 'block';
                
                // Create and resume AudioContext first on this user interaction
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                
                // Run the actual test
                const result = await transcriptionService.testWhisperApiAccess(language);
                
                testWhisperResult.textContent = result.message;
                testWhisperResult.style.color = result.success ? 'green' : 'red';
            } catch (e) {
                console.error('Test error:', e);
                const language = localStorage.getItem('echolife_language') || 'en-US';
                const errorMsg = language === 'pt-BR' ? 
                    `Erro de teste: ${e.message}` : 
                    `Test error: ${e.message}`;
                
                testWhisperResult.textContent = errorMsg;
                testWhisperResult.style.color = 'red';
            } finally {
                // Get current language for the button text
                const language = localStorage.getItem('echolife_language') || 'en-US';
                testWhisperButton.disabled = false;
                testWhisperButton.textContent = language === 'pt-BR' ? 
                    'Testar API Whisper' : 
                    'Test Whisper API';
            }
        });
    }
    
    // Update the test button text when language changes
    document.getElementById('languageSelector')?.addEventListener('change', (e) => {
        const language = e.target.value;
        if (testWhisperButton && !testWhisperButton.disabled) {
            testWhisperButton.textContent = language === 'pt-BR' ? 
                'Testar API Whisper' : 
                'Test Whisper API';
        }
    });
});
